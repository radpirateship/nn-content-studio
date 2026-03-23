import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  try {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`SELECT 1`
    return NextResponse.json({ ok: true, latencyMs: Date.now() - start })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
