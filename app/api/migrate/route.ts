// One-time migration endpoint Ã¢ÂÂ runs DB migrations and seeds collections registry
// Safe to call multiple times (all operations use IF NOT EXISTS / ON CONFLICT)
import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  return neon(process.env.DATABASE_URL)
}

// Canonical Naked Nutrition collection list — matches live Shopify collections
const CANONICAL_COLLECTIONS = [
  { label: 'Protein Powder',                slug: 'protein-powder',                    url: 'https://nakednutrition.com/collections/protein-powder' },
  { label: 'Whey Protein',                  slug: 'whey-protein',                      url: 'https://nakednutrition.com/collections/whey-protein' },
  { label: 'Collagen Peptides',             slug: 'collagen-peptides',                 url: 'https://nakednutrition.com/collections/collagen-peptides' },
  { label: 'Vegan Protein Powder',          slug: 'vegan-protein-powder',              url: 'https://nakednutrition.com/collections/vegan-protein-powder' },
  { label: 'Overnight Oats',               slug: 'overnight-oats',                    url: 'https://nakednutrition.com/collections/overnight-oats' },
  { label: 'Performance & Recovery',        slug: 'improve-performance-recovery',      url: 'https://nakednutrition.com/collections/improve-performance-recovery' },
  { label: 'Supplements',                  slug: 'supplements',                       url: 'https://nakednutrition.com/collections/supplements' },
  { label: 'Kids',                         slug: 'kids',                              url: 'https://nakednutrition.com/collections/kids' },
]

export async function GET() {
  const results: Record<string, string> = {}
  const sql = getDb()

  // --- Ensure base tables exist ---
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS collections_registry (
        slug        TEXT PRIMARY KEY,
        label       TEXT NOT NULL,
        is_builtin  BOOLEAN NOT NULL DEFAULT FALSE,
        url         TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    results['collections_registry_table'] = 'OK'
  } catch (e) { results['collections_registry_table'] = `ERROR: ${e}` }

  try {
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS collection_slug TEXT`
    await sql`CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection_slug)`
    results['products.collection_slug'] = 'OK'
  } catch (e) { results['products.collection_slug'] = `ERROR: ${e}` }

  try {
    await sql`ALTER TABLE topical_authority ADD COLUMN IF NOT EXISTS collection_slug TEXT`
    await sql`CREATE INDEX IF NOT EXISTS idx_ta_collection ON topical_authority(collection_slug)`
    results['topical_authority.collection_slug'] = 'OK'
  } catch (e) { results['topical_authority.collection_slug'] = `ERROR: ${e}` }

  try {
    await sql`ALTER TABLE collections ADD COLUMN IF NOT EXISTS collection_slug TEXT`
    results['collections.collection_slug'] = 'OK'
  } catch (e) { results['collections.collection_slug'] = `ERROR: ${e}` }

  try {
    await sql`ALTER TABLE collections_registry ADD COLUMN IF NOT EXISTS url TEXT`
    results['collections_registry.url'] = 'OK'
  } catch (e) { results['collections_registry.url'] = `ERROR: ${e}` }

  let seeded = 0
  const seedErrors: string[] = []
  for (const col of CANONICAL_COLLECTIONS) {
    try {
      await sql`
        INSERT INTO collections_registry (slug, label, is_builtin, url)
        VALUES (${col.slug}, ${col.label}, TRUE, ${col.url})
        ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, is_builtin = TRUE, url = EXCLUDED.url
      `
      seeded++
    } catch (e) { seedErrors.push(`${col.slug}: ${e}`) }
  }
  results['collections_registry_seed'] = seedErrors.length === 0
    ? `Seeded/updated ${seeded} collections`
    : `Seeded ${seeded}, errors: ${seedErrors.join('; ')}`

  try {
    const rows = await sql`SELECT slug FROM collections_registry ORDER BY label`
    results['registry_list'] = rows.map((r: Record<string, any>) => r.slug).join(', ')
  } catch (e) { results['registry_check'] = `ERROR: ${e}` }

  try {
    const c = await sql`SELECT COUNT(*) as n FROM products`
    results['products_total'] = `${c[0].n} products in DB`
    const s = await sql`SELECT COUNT(*) as n FROM products WHERE collection_slug IS NOT NULL`
    results['products_scoped'] = `${s[0].n} products scoped`
  } catch (e) { results['products_check'] = `ERROR: ${e}` }

  
  // --- Collections registry cleanup (2026-03-20): remove legacy wellness-equipment rows ---
  // These were from a previous project and have no relation to Naked Nutrition's store
  const LEGACY_WELLNESS_SLUGS = [
    'barrel-saunas', 'cold-plunges', 'hydrogen-water', 'hyperbaric-chambers',
    'infrared-saunas', 'pilates', 'red-light-therapy', 'sauna-accessories', 'saunas',
    'sensory-deprivation-tanks', 'steam', 'traditional-saunas', 'water-ionizers',
    'float-tanks', 'cold-plunge', 'pilates-equipment', 'massage-equipment',
    'compression-boots', 'recovery-tools', 'general-wellness', 'air-filters',
    'treadmills', 'elliptical-machines', 'exercise-bikes', 'stair-climbers',
    'vertical-climbers', 'sauna-heaters',
  ]
  try {
    let removed = 0
    for (const slug of LEGACY_WELLNESS_SLUGS) {
      try {
        await sql`DELETE FROM collections_registry WHERE slug = ${slug} AND is_builtin = TRUE`
        removed++
      } catch { /* skip */ }
    }
    results['collections_legacy_cleanup'] = `Removed up to ${removed} legacy wellness-equipment entries`
  } catch (e) { results['collections_legacy_cleanup'] = `ERROR: ${e}` }

  try {
    await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_type TEXT`
    results['articles.article_type'] = 'OK'
  } catch (e) { results['articles.article_type'] = `ERROR: ${e}` }

  // --- Activity log table ---
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS activity_log (
        id          SERIAL PRIMARY KEY,
        action      TEXT NOT NULL,
        category    TEXT NOT NULL DEFAULT 'general',
        detail      TEXT,
        status      TEXT NOT NULL DEFAULT 'success',
        duration_ms INTEGER,
        metadata    JSONB DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC)`
    await sql`CREATE INDEX IF NOT EXISTS idx_activity_log_category ON activity_log(category)`
    // Auto-cleanup: delete entries older than 7 days
    await sql`DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL '7 days'`
    results['activity_log_table'] = 'OK'
  } catch (e) { results['activity_log_table'] = `ERROR: ${e}` }

  return NextResponse.json({ success: true, results })
}
