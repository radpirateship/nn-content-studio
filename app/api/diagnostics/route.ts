import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  return neon(process.env.DATABASE_URL)
}

// Environment variables to check (never exposes values)
const ENV_KEYS = [
  { key: 'DATABASE_URL', required: true, hint: 'Neon PostgreSQL connection string' },
  { key: 'ANTHROPIC_API_KEY', required: true, hint: 'Claude API key (sk-ant-*)' },
  { key: 'GEMINI_API_KEY', required: true, hint: 'Google Gemini API key' },
  { key: 'SHOPIFY_ACCESS_TOKEN', required: true, hint: 'Shopify Admin API token (shpat_*)' },
  { key: 'SHOPIFY_STOREFRONT_ACCESS_TOKEN', required: false, hint: 'Shopify Storefront API token' },
  { key: 'SHOPIFY_STORE_DOMAIN', required: false, hint: 'e.g. mystore.myshopify.com' },
  { key: 'NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN', required: false, hint: 'Public Shopify domain' },
  { key: 'SHOPIFY_API_KEY', required: false, hint: 'Shopify app API key (OAuth)' },
  { key: 'SHOPIFY_API_SECRET', required: false, hint: 'Shopify app API secret (OAuth)' },
  { key: 'VERCEL_OIDC_TOKEN', required: false, hint: 'Auto-injected by Vercel' },
]

export async function GET() {
  const diagnostics: Record<string, unknown> = {}
  const startTime = Date.now()

  // 1. Environment variable presence check
  diagnostics.env = ENV_KEYS.map(({ key, required, hint }) => {
    const value = process.env[key]
    const present = !!value
    let preview = ''
    if (present && value) {
      // Show safe prefix only
      if (key.includes('URL')) {
        try {
          const url = new URL(value)
          preview = `${url.protocol}//${url.host}/...`
        } catch {
          preview = value.slice(0, 20) + '...'
        }
      } else if (value.length > 8) {
        preview = value.slice(0, 6) + '...' + value.slice(-4)
      } else {
        preview = '***'
      }
    }
    return { key, required, hint, present, preview }
  })

  // 2. Database connection + table inventory
  diagnostics.database = { status: 'unknown', tables: [], error: null }
  try {
    const sql = getDb()
    const dbStart = Date.now()

    // Connection test
    const versionResult = await sql`SELECT version()`
    const version = versionResult[0]?.version || 'unknown'

    // Get current database name
    const dbNameResult = await sql`SELECT current_database() as db`
    const dbName = dbNameResult[0]?.db || 'unknown'

    // Get all tables with row counts
    const tablesResult = await sql`
      SELECT
        t.table_name,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `

    // Get row counts using pg's reltuples estimate (fast, no locks) then exact for small tables
    // Neon's tagged template literal doesn't support dynamic identifiers, so we use a single
    // query that aggregates counts across all known tables via CASE in information_schema
    const rowCountResult = await sql`
      SELECT
        t.table_name,
        (SELECT COUNT(*) FROM information_schema.columns c
         WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count,
        COALESCE(s.n_live_tup, -1)::bigint as approx_rows
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `

    const tables = rowCountResult.map((t: Record<string, unknown>) => ({
      name: String(t.table_name),
      columns: Number(t.column_count),
      rows: Number(t.approx_rows),
    }))

    // Sample data from key tables
    const samples: Record<string, unknown[]> = {}
    try {
      const articleSamples = await sql`SELECT id, title, category, status, created_at FROM articles ORDER BY created_at DESC LIMIT 3`
      samples.articles = articleSamples
    } catch { /* table might not exist */ }
    try {
      const productSamples = await sql`SELECT id, title, handle, category, collection_slug FROM products LIMIT 3`
      samples.products = productSamples
    } catch { /* table might not exist */ }
    try {
      const registrySamples = await sql`SELECT slug, label, is_builtin FROM collections_registry ORDER BY label LIMIT 5`
      samples.collections_registry = registrySamples
    } catch { /* table might not exist */ }

    diagnostics.database = {
      status: 'connected',
      version: version.split(' ').slice(0, 2).join(' '),
      databaseName: dbName,
      latencyMs: Date.now() - dbStart,
      tableCount: tables.length,
      tables,
      samples,
      error: null,
    }
  } catch (e) {
    diagnostics.database = {
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
      tables: [],
    }
  }

  // 3. Anthropic Claude API check
  diagnostics.claude = { status: 'unknown', error: null }
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const claudeStart = Date.now()
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Reply with just the word: OK' }],
        }),
      })
      if (res.ok) {
        diagnostics.claude = {
          status: 'connected',
          model: 'claude-sonnet-4-6',
          latencyMs: Date.now() - claudeStart,
          error: null,
        }
      } else {
        const err = await res.json().catch(() => ({}))
        diagnostics.claude = {
          status: 'error',
          httpStatus: res.status,
          error: (err as Record<string, unknown>).error?.toString() || `HTTP ${res.status}`,
        }
      }
    } catch (e) {
      diagnostics.claude = { status: 'error', error: e instanceof Error ? e.message : String(e) }
    }
  } else {
    diagnostics.claude = { status: 'not_configured', error: 'ANTHROPIC_API_KEY not set' }
  }

  // 4. Shopify Admin API check
  diagnostics.shopify = { status: 'unknown', error: null }
  const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || 'nakednutrition.myshopify.com'
  const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN
  if (shopifyToken) {
    try {
      const shopifyStart = Date.now()
      const res = await fetch(`https://${shopifyDomain}/admin/api/2024-10/shop.json`, {
        headers: { 'X-Shopify-Access-Token': shopifyToken },
      })
      if (res.ok) {
        const data = await res.json()
        diagnostics.shopify = {
          status: 'connected',
          domain: shopifyDomain,
          shopName: data.shop?.name,
          shopEmail: data.shop?.email,
          plan: data.shop?.plan_display_name,
          latencyMs: Date.now() - shopifyStart,
          error: null,
        }
      } else {
        diagnostics.shopify = {
          status: 'error',
          domain: shopifyDomain,
          httpStatus: res.status,
          error: `HTTP ${res.status} — check SHOPIFY_ACCESS_TOKEN`,
        }
      }
    } catch (e) {
      diagnostics.shopify = { status: 'error', domain: shopifyDomain, error: e instanceof Error ? e.message : String(e) }
    }
  } else {
    diagnostics.shopify = { status: 'not_configured', domain: shopifyDomain, error: 'SHOPIFY_ACCESS_TOKEN not set' }
  }

  // 5. Gemini API check (lightweight — just validates key format, no generation call)
  diagnostics.gemini = { status: 'unknown', error: null }
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiStart = Date.now()
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
      )
      if (res.ok) {
        const data = await res.json()
        const models = (data.models || []).map((m: { name: string }) => m.name).filter((n: string) => n.includes('gemini')).slice(0, 5)
        diagnostics.gemini = {
          status: 'connected',
          availableModels: models,
          latencyMs: Date.now() - geminiStart,
          error: null,
        }
      } else {
        diagnostics.gemini = { status: 'error', httpStatus: res.status, error: `HTTP ${res.status}` }
      }
    } catch (e) {
      diagnostics.gemini = { status: 'error', error: e instanceof Error ? e.message : String(e) }
    }
  } else {
    diagnostics.gemini = { status: 'not_configured', error: 'GEMINI_API_KEY not set' }
  }

  diagnostics.totalLatencyMs = Date.now() - startTime
  diagnostics.timestamp = new Date().toISOString()
  diagnostics.environment = process.env.VERCEL ? 'vercel' : 'local'

  return NextResponse.json(diagnostics)
}
