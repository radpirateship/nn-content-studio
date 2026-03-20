import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  return neon(process.env.DATABASE_URL)
}

// GET — fetch recent log entries
export async function GET(request: NextRequest) {
  try {
    const sql = getDb()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || '100'), 500)
    const category = searchParams.get('category') || null
    const status = searchParams.get('status') || null

    let rows
    if (category && status) {
      rows = await sql`
        SELECT id, action, category, detail, status, duration_ms, metadata, created_at
        FROM activity_log
        WHERE category = ${category} AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else if (category) {
      rows = await sql`
        SELECT id, action, category, detail, status, duration_ms, metadata, created_at
        FROM activity_log
        WHERE category = ${category}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else if (status) {
      rows = await sql`
        SELECT id, action, category, detail, status, duration_ms, metadata, created_at
        FROM activity_log
        WHERE status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else {
      rows = await sql`
        SELECT id, action, category, detail, status, duration_ms, metadata, created_at
        FROM activity_log
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    }

    // Also cleanup old entries (older than 7 days) on every read
    await sql`DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL '7 days'`.catch(() => {})

    return NextResponse.json({ entries: rows, count: rows.length })
  } catch (error) {
    console.error('[activity-log] GET error:', error)
    return NextResponse.json({ entries: [], count: 0, error: 'Failed to fetch activity log' }, { status: 500 })
  }
}

// POST — add a new log entry
export async function POST(request: NextRequest) {
  try {
    const sql = getDb()
    const body = await request.json()
    const { action, category = 'general', detail = null, status = 'success', duration_ms = null, metadata = {} } = body

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    await sql`
      INSERT INTO activity_log (action, category, detail, status, duration_ms, metadata)
      VALUES (${action}, ${category}, ${detail}, ${status}, ${duration_ms}, ${JSON.stringify(metadata)})
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[activity-log] POST error:', error)
    return NextResponse.json({ error: 'Failed to write activity log' }, { status: 500 })
  }
}
