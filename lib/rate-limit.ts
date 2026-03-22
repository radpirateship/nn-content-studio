/**
 * In-memory sliding-window rate limiter for Vercel serverless functions.
 *
 * Tracks request timestamps per key in a Map. Old entries are pruned on each
 * check. Resets on cold start, which is acceptable for a single-user internal
 * tool — the primary goal is preventing runaway loops, not fighting botnets.
 *
 * Usage in a route handler:
 *
 *   import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
 *
 *   const limit = rateLimit('generate', { windowMs: 60_000, max: 3 });
 *   if (!limit.allowed) return rateLimitResponse(limit);
 */

import { NextResponse } from "next/server";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the oldest request in the window expires */
  resetMs: number;
}

const store = new Map<string, number[]>();

/**
 * Check whether a request for `key` is within the rate limit.
 *
 * @param key - Identifies the bucket (e.g. route name or "generate")
 * @param options.windowMs - Sliding window size in ms (default: 60 000 = 1 min)
 * @param options.max - Max requests allowed within the window (default: 10)
 */
export function rateLimit(
  key: string,
  options: { windowMs?: number; max?: number } = {}
): RateLimitResult {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 10;
  const now = Date.now();
  const windowStart = now - windowMs;

  let timestamps = store.get(key);
  if (!timestamps) {
    timestamps = [];
    store.set(key, timestamps);
  }

  // Prune entries older than the window
  const pruned = timestamps.filter(t => t > windowStart);
  store.set(key, pruned);

  if (pruned.length >= max) {
    const oldestInWindow = pruned[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldestInWindow + windowMs - now,
    };
  }

  pruned.push(now);
  return {
    allowed: true,
    remaining: max - pruned.length,
    resetMs: windowMs,
  };
}

/**
 * Return a 429 response with Retry-After header for rate-limited requests.
 */
export function rateLimitResponse(limit: RateLimitResult): NextResponse {
  const retryAfter = Math.ceil(limit.resetMs / 1000);
  return NextResponse.json(
    { error: `Rate limit exceeded. Try again in ${retryAfter} seconds.` },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}
