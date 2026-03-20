import { getSQL } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/*
SQL for blog_posts table:

CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  section TEXT,
  slug TEXT NOT NULL,
  category TEXT,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr NUMERIC(5,2) DEFAULT 0,
  position NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
*/

// Helper function to parse CSV content
function parseCSV(content: string): any[] {
  const lines = content.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = line.split(',').map(v => v.trim())
    const row: any = {}

    headers.forEach((header, idx) => {
      row[header] = values[idx] || null
    })

    rows.push(row)
  }

  return rows
}

// Helper: query blog posts with validated sort field using tagged template literals
// Neon's tagged template doesn't support dynamic identifiers, so we branch per sort field
async function queryBlogPosts(
  sql: ReturnType<typeof getSQL>,
  sortField: string,
  category: string | null,
  limit: number
) {
  // Each branch uses a tagged template literal with the sort column hardcoded
  if (category) {
    switch (sortField) {
      case 'impressions':
        return sql`SELECT * FROM blog_posts WHERE category = ${category} ORDER BY impressions DESC LIMIT ${limit}`
      case 'ctr':
        return sql`SELECT * FROM blog_posts WHERE category = ${category} ORDER BY ctr DESC LIMIT ${limit}`
      case 'position':
        return sql`SELECT * FROM blog_posts WHERE category = ${category} ORDER BY position DESC LIMIT ${limit}`
      default:
        return sql`SELECT * FROM blog_posts WHERE category = ${category} ORDER BY clicks DESC LIMIT ${limit}`
    }
  } else {
    switch (sortField) {
      case 'impressions':
        return sql`SELECT * FROM blog_posts ORDER BY impressions DESC LIMIT ${limit}`
      case 'ctr':
        return sql`SELECT * FROM blog_posts ORDER BY ctr DESC LIMIT ${limit}`
      case 'position':
        return sql`SELECT * FROM blog_posts ORDER BY position DESC LIMIT ${limit}`
      default:
        return sql`SELECT * FROM blog_posts ORDER BY clicks DESC LIMIT ${limit}`
    }
  }
}

// GET: Return all blog posts with optional sorting and filtering
export async function GET(request: NextRequest) {
  try {
    const sql = getSQL()
    const searchParams = request.nextUrl.searchParams
    const sort = searchParams.get('sort') || 'clicks'
    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 1000)

    // Validate sort parameter
    const validSortFields = ['clicks', 'impressions', 'ctr', 'position']
    const sortField = validSortFields.includes(sort) ? sort : 'clicks'

    const result = await queryBlogPosts(sql, sortField, category, limit)

    return NextResponse.json({
      success: true,
      count: result.length,
      data: result,
    })
  } catch (error) {
    console.error('GET /api/blog-posts error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch blog posts' },
      { status: 500 }
    )
  }
}

// POST: Upload CSV or JSON array
export async function POST(request: NextRequest) {
  try {
    const sql = getSQL()
    const contentType = request.headers.get('content-type') || ''

    let blogPosts: any[] = []

    if (contentType.includes('application/json')) {
      // JSON array upload
      const body = await request.json()
      blogPosts = Array.isArray(body) ? body : body.data || []
    } else if (contentType.includes('multipart/form-data')) {
      // CSV file upload
      const formData = await request.formData()
      const file = formData.get('file') as File

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No file provided' },
          { status: 400 }
        )
      }

      const content = await file.text()
      blogPosts = parseCSV(content)
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid content type' },
        { status: 400 }
      )
    }

    if (blogPosts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid data found' },
        { status: 400 }
      )
    }

    // Delete existing rows
    await sql`DELETE FROM blog_posts`

    // Insert new rows
    const insertPromises = blogPosts.map(post => {
      // Parse CTR: remove % sign if present
      let ctr = 0
      if (post.ctr) {
        const ctrStr = String(post.ctr).replace('%', '').trim()
        ctr = parseFloat(ctrStr) || 0
      }

      // Parse position
      let position = 0
      if (post.position) {
        position = parseFloat(String(post.position)) || 0
      }

      // Parse clicks and impressions
      const clicks = parseInt(String(post.clicks || 0)) || 0
      const impressions = parseInt(String(post.impressions || 0)) || 0

      const url = post.url || ''
      const section = post.section || null
      const slug = post.slug || ''
      const postCategory = post.category || null

      return sql`
        INSERT INTO blog_posts (url, section, slug, category, clicks, impressions, ctr, position)
        VALUES (${url}, ${section}, ${slug}, ${postCategory}, ${clicks}, ${impressions}, ${ctr}, ${position})
      `
    })

    await Promise.all(insertPromises)

    return NextResponse.json({
      success: true,
      message: `Imported ${blogPosts.length} blog posts`,
      count: blogPosts.length,
    })
  } catch (error) {
    console.error('POST /api/blog-posts error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to import blog posts' },
      { status: 500 }
    )
  }
}

// DELETE: Clear all blog posts
export async function DELETE(request: NextRequest) {
  try {
    const sql = getSQL()
    await sql`DELETE FROM blog_posts`

    return NextResponse.json({
      success: true,
      message: 'All blog posts deleted',
    })
  } catch (error) {
    console.error('DELETE /api/blog-posts error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete blog posts' },
      { status: 500 }
    )
  }
}
