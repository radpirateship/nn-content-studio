// Scan links route — uses lib/ai.ts callAI helper
// Updated: 2026-02-19 — rebuilt fresh for Turbopack
import { type NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const { htmlContent, internalLinks, collectionsLinks, articleTitle, articleKeyword } = await request.json();

    if (!htmlContent) {
      return NextResponse.json({ error: "htmlContent is required" }, { status: 400 });
    }

    if ((!internalLinks || internalLinks.length === 0) && (!collectionsLinks || collectionsLinks.length === 0)) {
      return NextResponse.json({ error: "At least one of internalLinks or collectionsLinks is required" }, { status: 400 });
    }

    const plainText = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const allLinks: { title: string; url: string; type: string }[] = [];
    if (internalLinks?.length) {
      internalLinks.forEach((l: any) => allLinks.push({ title: l.title, url: l.url, type: 'topical-authority' }));
    }
    if (collectionsLinks?.length) {
      collectionsLinks.forEach((l: any) => allLinks.push({ title: l.title, url: l.url, type: 'collection' }));
    }

    const linksReference = allLinks.map((l, i) => `${i + 1}. [${l.type}] "${l.title}" -> ${l.url}`).join('\n');

    const systemPrompt = `You are a Senior SEO Strategist. Analyze an article and identify the best internal linking opportunities from a provided URL list.

RULES:
- Identify 6-10 high-value linking opportunities
- Choose 2-4 word anchor text that exists naturally in the article
- Spread links across different sections
- Never suggest the same URL twice
- Never suggest anchor text from headings

OUTPUT: Return ONLY a valid JSON array with objects: { "anchor_text", "target_url", "target_title", "rationale" }`;

    const userPrompt = `ARTICLE: "${articleTitle}" (keyword: "${articleKeyword}")

AVAILABLE URLS:
${linksReference}

ARTICLE TEXT:
${plainText.slice(0, 8000)}`;

    console.log("[v0] Scan-links: calling callAI...");
    let rawText = await callAI(systemPrompt, userPrompt, { maxTokens: 4000 });
    console.log("[v0] Scan-links: callAI returned");

    rawText = rawText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();

    let suggestions;
    try {
      suggestions = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse AI link suggestions:", rawText.slice(0, 500));
      return NextResponse.json({ error: "AI returned invalid JSON for link suggestions" }, { status: 500 });
    }

    const normalizedSuggestions = (Array.isArray(suggestions) ? suggestions : []).map(
      (s: any, i: number) => ({
        id: `link-${Date.now()}-${i}`,
        anchorText: s.anchor_text || '',
        targetUrl: s.target_url || '',
        targetTitle: s.target_title || '',
        rationale: s.rationale || '',
        status: 'pending' as const,
      })
    ).filter((s: any) => s.anchorText && s.targetUrl);

    return NextResponse.json({ suggestions: normalizedSuggestions, count: normalizedSuggestions.length, success: true });
  } catch (error) {
    console.error("[scan-links] Error:", { articleTitle, internalLinksCount: internalLinks?.length ?? 0, error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to scan for link opportunities" },
      { status: 500 }
    );
  }
}
