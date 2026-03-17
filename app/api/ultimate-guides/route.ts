import { type NextRequest, NextResponse } from 'next/server'
import { getSQL } from '@/lib/db'

// GET  /api/ultimate-guides          â list all guides
// GET  /api/ultimate-guides?id=uuid  â single guide
// POST /api/ultimate-guides          â create
// PUT  /api/ultimate-guides          â update (id in body)
// DELETE /api/ultimate-guides?id=uuid â delete

export async function GET(request: NextRequest) {
  const sql = getSQL()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const slug = searchParams.get('slug')

  try {
    if (id) {
      const rows = await sql`
        SELECT * FROM ultimate_guides WHERE id = ${id} LIMIT 1
      `
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
      }
      return NextResponse.json(rows[0])
    }

    if (slug) {
      const rows = await sql`
        SELECT * FROM ultimate_guides WHERE slug = ${slug} LIMIT 1
      `
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
      }
      return NextResponse.json(rows[0])
    }

    // List â most recent first, lean payload
    const rows = await sql`
      SELECT
        id, title, slug, topic_short, status,
        config_complete, products_complete, content_complete, images_complete,
        has_images, image_count,
        created_at, updated_at, published_at
      FROM ultimate_guides
      ORDER BY created_at DESC
      LIMIT 100
    `
    return NextResponse.json(rows)
  } catch (error) {
    console.error('[ultimate-guides GET]', error)
    return NextResponse.json({ error: 'Failed to fetch guides' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const sql = getSQL()
  const body = await request.json()

  const {
    title, slug, topic_short, topic_short_plural, topic_full,
    breadcrumb_l2_name, breadcrumb_l2_slug, collection_slug,
    hero_image_url, date_published, read_time_mins,
    related_guides,
  } = body

  if (!title || !slug || !topic_short) {
    return NextResponse.json({ error: 'title, slug, and topic_short are required' }, { status: 400 })
  }

  try {
    const rows = await sql`
      INSERT INTO ultimate_guides (
        title, slug, topic_short, topic_short_plural, topic_full,
        breadcrumb_l2_name, breadcrumb_l2_slug, collection_slug,
        hero_image_url, date_published, read_time_mins,
        related_guides,
        config_complete, status
      ) VALUES (
        ${title}, ${slug}, ${topic_short}, ${topic_short_plural || topic_short}, ${topic_full || topic_short},
        ${breadcrumb_l2_name || ''}, ${breadcrumb_l2_slug || ''}, ${collection_slug || ''},
        ${hero_image_url || null}, ${date_published || new Date().toISOString().slice(0, 10)},
        ${read_time_mins || 15},
        ${JSON.stringify(related_guides || [])},
        true, 'draft'
      )
      RETURNING *
    `
    return NextResponse.json(rows[0], { status: 201 })
  } catch (error) {
    console.error('[ultimate-guides POST]', error)
    // Unique slug violation
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'A guide with this slug already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create guide' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const sql = getSQL()
  const body = await request.json()
  const { id, ...fields } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Build a safe allow-list of updatable columns
  const allowed = [
    'title', 'slug', 'topic_short', 'topic_short_plural', 'topic_full',
    'breadcrumb_l2_name', 'breadcrumb_l2_slug', 'collection_slug',
    'hero_image_url', 'hero_image_cdn_url', 'date_published', 'read_time_mins',
    'related_guides',
    'selected_products',
    'html_content', 'meta_description', 'key_takeaways', 'faq_pairs', 'cluster_links',
    'has_images', 'image_count',
    'config_complete', 'products_complete', 'content_complete', 'images_complete',
    'status', 'section_content', 'section_versions', 'shopify_page_id', 'published_at',
  ]

  // Serialize JSON fields
  const jsonFields = ['related_guides', 'selected_products', 'key_takeaways', 'faq_pairs', 'cluster_links', 'section_content', 'section_versions']

  try {
    // Build dynamic SET clause â only include provided allowed fields
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in fields) {
        updates[key] = jsonFields.includes(key) && typeof fields[key] !== 'string'
          ? JSON.stringify(fields[key])
          : fields[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Neon tagged template doesn't support truly dynamic column names cleanly,
    // so we use a small helper that builds the query safely field by field.
    // For each update, we run a separate UPDATE â acceptable for small payloads.
    // (Production alternative: use drizzle or prisma for dynamic updates.)
    // Log update payload sizes for debugging
    for (const [col, val] of Object.entries(updates)) {
      const size = typeof val === 'string' ? val.length : JSON.stringify(val).length
      if (size > 10000) console.log(`[ultimate-guides PUT] field "${col}" size: ${(size / 1024).toFixed(1)}KB`)
    }

    for (const [col, val] of Object.entries(updates)) {
     try {
      switch (col) {
        case 'title':            await sql`UPDATE ultimate_guides SET title = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'slug':             await sql`UPDATE ultimate_guides SET slug = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'topic_short':      await sql`UPDATE ultimate_guides SET topic_short = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'topic_short_plural': await sql`UPDATE ultimate_guides SET topic_short_plural = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'topic_full':       await sql`UPDATE ultimate_guides SET topic_full = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'breadcrumb_l2_name': await sql`UPDATE ultimate_guides SET breadcrumb_l2_name = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'breadcrumb_l2_slug': await sql`UPDATE ultimate_guides SET breadcrumb_l2_slug = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'collection_slug':  await sql`UPDATE ultimate_guides SET collection_slug = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'hero_image_url':   await sql`UPDATE ultimate_guides SET hero_image_url = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'hero_image_cdn_url': await sql`UPDATE ultimate_guides SET hero_image_cdn_url = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'date_published':   await sql`UPDATE ultimate_guides SET date_published = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'read_time_mins':   await sql`UPDATE ultimate_guides SET read_time_mins = ${val as number}, updated_at = NOW() WHERE id = ${id}`; break
        case 'related_guides':   await sql`UPDATE ultimate_guides SET related_guides = ${val as string}::jsonb, updated_at = NOW() WHERE id = ${id}`; break
        case 'selected_products': await sql`UPDATE ultimate_guides SET selected_products = ${val as string}::jsonb, updated_at = NOW() WHERE id = ${id}`; break
        case 'html_content':     await sql`UPDATE ultimate_guides SET html_content = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'meta_description': await sql`UPDATE ultimate_guides SET meta_description = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'key_takeaways':    await sql`UPDATE ultimate_guides SET key_takeaways = ${val as string}::jsonb, updated_at = NOW() WHERE id = ${id}`; break
        case 'faq_pairs':        await sql`UPDATE ultimate_guides SET faq_pairs = ${val as string}::jsonb, updated_at = NOW() WHERE id = ${id}`; break
        case 'cluster_links':    await sql`UPDATE ultimate_guides SET cluster_links = ${val as string}::jsonb, updated_at = NOW() WHERE id = ${id}`; break
        case 'section_content':
            await sql`UPDATE ultimate_guides SET section_content = ${val as string}::jsonb, updated_at = NOW() WHERE id = ${id}`;
            break
        case 'section_versions':
            await sql`UPDATE ultimate_guides SET section_versions = ${val as string}::jsonb, updated_at = NOW() WHERE id = ${id}`;
            break
          case 'has_images':       await sql`UPDATE ultimate_guides SET has_images = ${val as boolean}, updated_at = NOW() WHERE id = ${id}`; break
        case 'image_count':      await sql`UPDATE ultimate_guides SET image_count = ${val as number}, updated_at = NOW() WHERE id = ${id}`; break
        case 'config_complete':  await sql`UPDATE ultimate_guides SET config_complete = ${val as boolean}, updated_at = NOW() WHERE id = ${id}`; break
        case 'products_complete': await sql`UPDATE ultimate_guides SET products_complete = ${val as boolean}, updated_at = NOW() WHERE id = ${id}`; break
        case 'content_complete': await sql`UPDATE ultimate_guides SET content_complete = ${val as boolean}, updated_at = NOW() WHERE id = ${id}`; break
        case 'images_complete':  await sql`UPDATE ultimate_guides SET images_complete = ${val as boolean}, updated_at = NOW() WHERE id = ${id}`; break
        case 'status':           await sql`UPDATE ultimate_guides SET status = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'shopify_page_id':  await sql`UPDATE ultimate_guides SET shopify_page_id = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
        case 'published_at':     await sql`UPDATE ultimate_guides SET published_at = ${val as string}, updated_at = NOW() WHERE id = ${id}`; break
      }
     } catch (fieldErr) {
        const msg = fieldErr instanceof Error ? fieldErr.message : String(fieldErr)
        console.error(`[ultimate-guides PUT] Failed on field "${col}":`, msg)
        throw new Error(`DB update failed on field "${col}": ${msg}`)
     }
    }

    const rows = await sql`SELECT * FROM ultimate_guides WHERE id = ${id} LIMIT 1`
    return NextResponse.json(rows[0])
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[ultimate-guides PUT]', errMsg, error)
    return NextResponse.json({ error: `Failed to update guide: ${errMsg}` }, { status: 500 })
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
    await sql`DELETE FROM ultimate_guides WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ultimate-guides DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete guide' }, { status: 500 })
  }
}
