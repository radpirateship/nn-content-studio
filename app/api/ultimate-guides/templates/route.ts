import { type NextRequest, NextResponse } from 'next/server'
import { getSQL } from '@/lib/db'

// GET  /api/ultimate-guides/templates          — list all templates
// POST /api/ultimate-guides/templates          — create from guide config
// DELETE /api/ultimate-guides/templates?id=uuid — delete

export async function GET() {
  const sql = getSQL()
  try {
    const rows = await sql`
      SELECT * FROM guide_templates ORDER BY created_at DESC LIMIT 50
    `
    return NextResponse.json(rows)
  } catch (error) {
    console.error('[guide-templates GET]', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const sql = getSQL()
  const body = await request.json()

  const {
    name,
    description,
    collection_slug,
    topic_short,
    topic_short_plural,
    topic_full,
    breadcrumb_l2_name,
    breadcrumb_l2_slug,
    related_guides,
    product_roles,
    read_time_mins,
  } = body

  if (!name) {
    return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
  }

  try {
    const rows = await sql`
      INSERT INTO guide_templates (
        name, description,
        collection_slug, topic_short, topic_short_plural, topic_full,
        breadcrumb_l2_name, breadcrumb_l2_slug,
        related_guides, product_roles, read_time_mins
      ) VALUES (
        ${name}, ${description || null},
        ${collection_slug || null}, ${topic_short || null},
        ${topic_short_plural || null}, ${topic_full || null},
        ${breadcrumb_l2_name || null}, ${breadcrumb_l2_slug || null},
        ${JSON.stringify(related_guides || [])},
        ${JSON.stringify(product_roles || [])},
        ${read_time_mins || 15}
      )
      RETURNING *
    `
    return NextResponse.json(rows[0], { status: 201 })
  } catch (error) {
    console.error('[guide-templates POST]', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const sql = getSQL()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  try {
    await sql`DELETE FROM guide_templates WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[guide-templates DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
