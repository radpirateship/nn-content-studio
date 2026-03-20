/**
 * Shared AI helper — calls the Anthropic API directly via fetch.
 * All routes import this single function instead of managing their own API calls.
 * Reads ANTHROPIC_API_KEY lazily at call time (not module-load time).
 *
 * Updated: 2026-03-20 — added timeout, response validation, better errors
 */

const DEFAULT_TIMEOUT_MS = 90_000; // 90 seconds

export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; model?: string; timeoutMs?: number }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it in the Vars sidebar."
    );
  }

  const model = options?.model ?? "claude-sonnet-4-6";
  const maxTokens = options?.maxTokens ?? 4096;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

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

    // Parse specific error types for better user messages
    if (response.status === 429) {
      throw new Error("AI rate limit reached. Wait a minute and try again.");
    }
    if (response.status === 401) {
      throw new Error("Invalid Anthropic API key. Check your ANTHROPIC_API_KEY in environment variables.");
    }
    if (response.status === 529) {
      throw new Error("Anthropic API is temporarily overloaded. Try again in a few minutes.");
    }

    let msg = "AI generation failed";
    try {
      msg = JSON.parse(errorText).error?.message || msg;
    } catch {
      msg = errorText || msg;
    }
    throw new Error(msg);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "";

  // Validate we got real content back
  if (!text || text.trim().length < 20) {
    console.error("[ai] Empty or near-empty response from Claude:", JSON.stringify(data).slice(0, 500));
    throw new Error(
      "AI returned an empty response. This usually means the prompt was too constrained. " +
      "Try adjusting your inputs and generating again."
    );
  }

  return text;
}
