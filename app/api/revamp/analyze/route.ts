import { type NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const { existingContent, citations, category, keyword } = await request.json();

    const citationsText = citations?.length
      ? citations.map((c: { url: string; title?: string; notes?: string }, i: number) =>
          `[${i + 1}] ${c.url}${c.title ? ` — ${c.title}` : ''}${c.notes ? `\nNotes: ${c.notes}` : ''}`
        ).join('\n')
      : 'No citations provided.';

    const systemPrompt = `You are a content strategist for Naked Nutrition (nakednutrition.com), a premium supplement brand. You are analyzing an existing blog article to plan a comprehensive rewrite. Your goal is to identify what's strong, what's missing, and create a restructuring plan that will improve SEO, readability, and conversion.`;

    const userPrompt = `Analyze this existing article for a comprehensive rewrite.

CATEGORY: ${category}
PRIMARY KEYWORD: ${keyword}

EXISTING ARTICLE CONTENT:
---
${existingContent}
---

AVAILABLE CITATIONS/RESEARCH:
${citationsText}

Analyze the article and return a JSON object with this exact structure:
{
  "currentWordCount": <number>,
  "currentHeadings": ["list of existing H2/H3 headings"],
  "readabilityNotes": "Brief assessment of current readability and tone",
  "existingTopics": ["list of topics/claims currently covered"],
  "missingElements": ["list of things the article is missing — e.g., 'No FAQ section', 'No product recommendations', 'No dosage information', 'No internal links', 'Claims lack citations'],
  "citationOpportunities": [
    {
      "claim": "The specific claim in the article that could use a citation",
      "citationId": "The index number of the matching citation from the provided list, or 'none'",
      "suggestion": "How to strengthen this claim with the citation"
    }
  ],
  "suggestedOutline": [
    {
      "heading": "Suggested H2 heading for the rewrite",
      "keyPoints": ["Key points to cover in this section"],
      "isNew": true/false
    }
  ]
}

The suggested outline should:
- Preserve the strongest sections from the original article
- Add missing sections (FAQ, product recommendations, key takeaways)
- Restructure for better SEO (keyword in first H2, logical flow)
- Plan for 5-8 H2 sections
- Include a FAQ section with 4-6 questions

Return ONLY the JSON object, no additional text or markdown fences.`;

    const result = await callAI(systemPrompt, userPrompt, { maxTokens: 3000 });

    try {
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysis = JSON.parse(cleaned);
      return NextResponse.json({ analysis });
    } catch {
      return NextResponse.json({ analysis: result });
    }
  } catch (error) {
    console.error("[revamp/analyze] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
