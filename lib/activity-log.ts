import { neon } from '@neondatabase/serverless'

/**
 * Fire-and-forget activity logger. Safe to call anywhere in API routes.
 * Silently fails if the table doesn't exist or DB is unreachable.
 */
export function logActivity(
  action: string,
  opts: {
    category?: string
    detail?: string
    status?: 'success' | 'error' | 'warning'
    durationMs?: number
    metadata?: Record<string, unknown>
  } = {}
) {
  const { category = 'general', detail, status = 'success', durationMs, metadata = {} } = opts

  // Fire-and-forget — don't await, don't block the request
  try {
    if (!process.env.DATABASE_URL) return
    const sql = neon(process.env.DATABASE_URL)
    sql`
      INSERT INTO activity_log (action, category, detail, status, duration_ms, metadata)
      VALUES (${action}, ${category}, ${detail || null}, ${status}, ${durationMs || null}, ${JSON.stringify(metadata)})
    `.catch(() => {
      // Silently fail — the log table might not exist yet
    })
  } catch {
    // Silently fail
  }
}
