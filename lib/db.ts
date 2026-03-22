import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Cache the Neon SQL client at module scope so we reuse the same HTTP-based
// query function across all requests in a single serverless invocation.
// This avoids creating a new client on every call to getSQL().
let cachedSQL: NeonQueryFunction<false, false> | null = null;

export function getSQL() {
  if (cachedSQL) return cachedSQL;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  cachedSQL = neon(connectionString);
  return cachedSQL;
}

/**
 * Execute a database query with a timeout to prevent hung queries from
 * blocking an entire Vercel function invocation.
 *
 * Usage:
 *   const sql = getSQL();
 *   const rows = await withTimeout(sql`SELECT * FROM articles`, 10_000);
 *
 * @param queryPromise - The tagged-template query promise from neon()
 * @param ms - Timeout in milliseconds (default: 15 000 = 15s)
 */
export function withTimeout<T>(queryPromise: Promise<T>, ms = 15_000): Promise<T> {
  return Promise.race([
    queryPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Database query timed out after ${ms}ms`)), ms)
    ),
  ]);
}
