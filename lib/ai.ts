/**
 * Shared AI helper — calls the Anthropic API directly via fetch.
 * All routes import this single function instead of managing their own API calls.
 * Reads ANTHROPIC_API_KEY lazily at call time (not module-load time).
 *
 * Updated: 2026-03-08 — use claude-sonnet-4-6
 */
export async function callAI(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; model?: string }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it in the Vars sidebar."
    );
  }

  const model = options?.model ?? "claude-sonnet-4-6";
  const maxTokens = options?.maxTokens ?? 4096;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[v0] Anthropic API error:", response.status, errorText);
    let msg = "AI generation failed";
    try {
      msg = JSON.parse(errorText).error?.message || msg;
    } catch {
      msg = errorText || msg;
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}
