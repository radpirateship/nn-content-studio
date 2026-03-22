/**
 * Shared AI helper — calls the Anthropic API directly via fetch.
 * All routes import this single function instead of managing their own API calls.
 * Reads ANTHROPIC_API_KEY lazily at call time (not module-load time).
 *
 * Updated: 2026-03-20 — added timeout, response validation, better errors
 * Updated: 2026-03-21 — added stop_reason truncation detection
 * Updated: 2026-03-22 — added retry with exponential backoff for transient errors
 */

import { withRetry } from './retry';

const DEFAULT_TIMEOUT_MS = 90_000; // 90 seconds

export interface AIResponse {
  text: string;
  stopReason: string;
  truncated: boolean;
}

/**
 * Call Claude and return structured response with truncation metadata.
 * Use this when you need to know whether the response was cut short.
 */
export async function callAIFull(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; model?: string; timeoutMs?: number }
): Promise<AIResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it in the Vars sidebar."
    );
  }

  const model = options?.model ?? "claude-sonnet-4-6";
  const maxTokens = options?.maxTokens ?? 4096;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return withRetry(async () => {
    // AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `AI request timed out after ${Math.round(timeoutMs / 1000)}s. ` +
          `Try reducing word count or simplifying the prompt.`
        );
      }
      throw new Error(
        `Could not reach the Anthropic API. Check your internet connection and try again.`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ai] Anthropic API error:", response.status, errorText);

      // 401 is not retryable — bad API key won't fix itself
      if (response.status === 401) {
        throw new Error("Invalid Anthropic API key. Check your ANTHROPIC_API_KEY in environment variables.");
      }
      // 429 and 529 are retryable (the retry util matches on these messages)
      if (response.status === 429) {
        throw new Error("AI rate limit reached (status: 429). Wait a minute and try again.");
      }
      if (response.status === 529) {
        throw new Error("Anthropic API is temporarily overloaded (status: 529). Try again in a few minutes.");
      }

      let msg = "AI generation failed";
      try {
        msg = JSON.parse(errorText).error?.message || msg;
      } catch {
        msg = errorText || msg;
      }
      // Include status in message so retry util can detect 5xx
      if (response.status >= 500) {
        throw new Error(`AI generation failed (status: ${response.status}): ${msg}`);
      }
      throw new Error(msg);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const stopReason = data.stop_reason || "unknown";
    const truncated = stopReason === "max_tokens";

    if (truncated) {
      console.warn(
        `[ai] Response TRUNCATED (stop_reason=max_tokens). ` +
        `Requested max_tokens=${maxTokens}, model=${model}. ` +
        `Response length: ${text.length} chars. ` +
        `The output may have unclosed HTML tags or incomplete content.`
      );
    }

    // Validate we got real content back
    if (!text || text.trim().length < 20) {
      console.error("[ai] Empty or near-empty response from Claude:", JSON.stringify(data).slice(0, 500));
      throw new Error(
        "AI returned an empty response. This usually means the prompt was too constrained. " +
        "Try adjusting your inputs and generating again."
      );
    }

    return { text, stopReason, truncated };
  }, { label: 'Anthropic', maxRetries: 2 });
}

/**
 * Call Claude and return just the text string (backward-compatible).
 * Logs a warning if the response was truncated but still returns the text.
 */
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; model?: string; timeoutMs?: number }
): Promise<string> {
  const result = await callAIFull(systemPrompt, userPrompt, options);

  if (result.truncated) {
    console.warn(
      "[ai] WARNING: Response was truncated (hit max_tokens). " +
      "The caller received incomplete output. Consider increasing maxTokens or reducing prompt complexity."
    );
  }

  return result.text;
}
