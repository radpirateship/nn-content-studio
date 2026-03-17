import { type NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

function getDb() {
  return neon(process.env.DATABASE_URL!)
}

// GET - return all collections (built-in + custom), sorted alphabetically
export async function GET() {
  try {
    const sql = getDb()
    const rows = await sql`
      SELECT slug, label, is_builtin, created_at
      FROM collections_registry
      ORDER BY label ASC
    `
    return NextResponse.json({ collections: rows })
  } catch (error) {
    console.error('[collections-registry] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 })
  }
}

// POST - add a single collection by name, OR bulk upsert array of { label, slug, url }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const sql = getDb()

    // Ensure url column exists (migration-safe)
    try {
      await sql`ALTER TABLE collections_registry ADD COLUMN IF NOT EXISTS url TEXT`
    } catch { /* ignore if already exists */ }

    // BULK mode: { collections: [{ label, slug, url }] }
    if (Array.isArray(body.collections)) {
      let upserted = 0
      for (const col of body.collections) {
        if (!col.slug || !col.label) continue
        await sql`
          INSERT INTO collections_registry (slug, label, is_builtin, url)
          VALUES (${col.slug}, ${col.label}, TRUE, ${col.url || null})
          ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, is_builtin = TRUE, url = COALESCE(EXCLUDED.url, collections_registry.url)
        `
        upserted++
      }
      console.log(`[collections-registry] Bulk upserted ${upserted} collections`)
      return NextResponse.json({ success: true, count: upserted })
    }

    // SINGLE mode: { name }
    const { name } = body
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Collection name must be at least 2 characters' }, { status: 400 })
    }

    const label = name.trim()
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    if (!slug) {
      return NextResponse.json({ error: 'Could not generate a valid slug from that name' }, { status: 400 })
    }

    await sql`
      INSERT INTO collections_registry (slug, label, is_builtin)
      VALUES (${slug}, ${label}, FALSE)
      ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label
    `

    console.log(`[collections-registry] Created/updated collection: ${label} (${slug})`)
    return NextResponse.json({ slug, label, is_builtin: false }, { status: 201 })
  } catch (error) {
    console.error('[collections-registry] POST error:', error)
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 })
  }
}

// DELETE - remove a custom collection (prevents deleting built-in ones)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'slug parameter required' }, { status: 400 })
    }

    const sql = getDb()

    const rows = await sql`SELECT is_builtin FROM collections_registry WHERE slug = ${slug}`
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }
    if (rows[0].is_builtin) {
      return NextResponse.json({ error: 'Cannot delete a built-in collection' }, { status: 403 })
    }

    await sql`DELETE FROM collections_registry WHERE slug = ${slug} AND is_builtin = FALSE`

    console.log(`[collections-registry] Deleted custom collection: ${slug}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[collections-registry] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 })
  }
}
