/**
 * Retry utility with exponential backoff.
 * Used by AI, image generation, and Shopify API calls
 * to survive transient failures (5xx, network blips, rate limits).
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 2, meaning up to 3 total tries) */
  maxRetries?: number;
  /** Base delay in milliseconds before first retry (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 10000) */
  maxDelayMs?: number;
  /**
   * Predicate that decides whether a given error is retryable.
   * Return true to retry, false to fail immediately.
   * Default: retries on network errors and 5xx status codes.
   */
  isRetryable?: (error: unknown) => boolean;
  /** Optional label for log messages (e.g., "Anthropic", "Gemini") */
  label?: string;
}

/**
 * Default retryable check: network errors and server errors (5xx).
 * Does NOT retry client errors (4xx) except 429 (rate limit) and 529 (overloaded).
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Network-level failures
    if (
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('socket hang up') ||
      msg.includes('timeout') ||
      msg.includes('abort')
    ) {
      return true;
    }
    // HTTP status-based errors (our API wrappers put status in the message)
    if (msg.includes('status: 5') || msg.includes('status: 429') || msg.includes('status: 529')) {
      return true;
    }
    // Rate limit / overloaded messages
    if (msg.includes('rate limit') || msg.includes('overloaded') || msg.includes('temporarily')) {
      return true;
    }
  }
  return false;
}

/**
 * Execute an async function with retries and exponential backoff.
 *
 * Usage:
 *   const result = await withRetry(() => fetchFromAPI(), { label: 'Shopify', maxRetries: 2 });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 1_000;
  const maxDelayMs = options?.maxDelayMs ?? 10_000;
  const shouldRetry = options?.isRetryable ?? isTransientError;
  const label = options?.label ?? 'retry';

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Exponential backoff with jitter: base * 2^attempt + random(0..500ms)
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 500,
        maxDelayMs
      );

      console.warn(
        `[${label}] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${Math.round(delay)}ms:`,
        error instanceof Error ? error.message : error
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}
