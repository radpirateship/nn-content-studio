import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

const DEFAULT_QUERY_TIMEOUT_MS = 15_000; // 15 seconds

// Cache the Neon SQL client at module scope so we reuse the same HTTP-based
// query function across all requests in a single serverless invocation.
// This avoids creating a new client on every call to getSQL().
let cachedSQL: NeonQueryFunction<false, false> | null = null;

/**
 * Return a cached Neon SQL tagged-template function.
 *
 * Every query is automatically wrapped in a 15-second timeout via
 * {@link withTimeout} so that a hung query can never block an entire
 * Vercel function invocation until the platform kills it.
 */
export function getSQL() {
  if (cachedSQL) return cachedSQL;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const rawSql = neon(connectionString);

  // Wrap the tagged-template function so every query gets an automatic timeout.
  // Tagged templates are invoked as fn(strings, ...values), which the Proxy's
  // apply trap intercepts transparently.
  cachedSQL = new Proxy(rawSql, {
    apply(target, thisArg, args) {
      const queryPromise = Reflect.apply(target, thisArg, args);
      return withTimeout(queryPromise, DEFAULT_QUERY_TIMEOUT_MS);
    },
  });

  return cachedSQL;
}

/**
 * Execute a database query with a timeout to prevent hung queries from
 * blocking an entire Vercel function invocation.
 *
 * Most callers don't need to use this directly — getSQL() now applies
 * a 15s timeout automatically. Use this only when you need a custom
 * timeout for a specific query (e.g. a longer timeout for bulk inserts).
 *
 * @param queryPromise - The tagged-template query promise from neon()
 * @param ms - Timeout in milliseconds (default: 15 000 = 15s)
 */
export function withTimeout<T>(queryPromise: Promise<T>, ms = DEFAULT_QUERY_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    queryPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Database query timed out after ${ms}ms`)), ms)
    ),
  ]);
}
