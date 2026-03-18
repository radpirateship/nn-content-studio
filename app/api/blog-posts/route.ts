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

const sql = getSQL()

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

// GET: Return all blog posts with optional sorting and filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sort = searchParams.get('sort') || 'clicks'
    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 1000)

    // Validate sort parameter
    const validSortFields = ['clicks', 'impressions', 'ctr', 'position']
    const sortField = validSortFields.includes(sort) ? sort : 'clicks'

    let query = 'SELECT * FROM blog_posts'
    const params: any[] = []

    if (category) {
      query += ' WHERE category = $1'
      params.push(category)
    }

    query += ` ORDER BY ${sortField} DESC LIMIT $${params.length + 1}`
    params.push(limit)

    const result = await sql(query, params)

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
    await sql('DELETE FROM blog_posts')

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

      return sql(
        `INSERT INTO blog_posts (url, section, slug, category, clicks, impressions, ctr, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          post.url || '',
          post.section || null,
          post.slug || '',
          post.category || null,
          clicks,
          impressions,
          ctr,
          position,
        ]
      )
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
    await sql('DELETE FROM blog_posts')

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
