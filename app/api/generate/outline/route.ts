import { type NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import type { ArticleOutline } from "@/lib/types";

/**
 * POST /api/generate/outline
 *
 * Generates an article outline for the given title, keyword, and category.
 * Uses callAI with "SEO content strategist" persona for Naked Nutrition.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 5 outline generations per minute
  const limit = rateLimit("generate-outline", { windowMs: 60_000, max: 5 });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const { title, keyword, category } = await request.json();

    if (!title || !keyword || !category) {
      return NextResponse.json(
        { error: "title, keyword, and category are required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert SEO content strategist for Naked Nutrition, specializing in supplements and sports nutrition content. Create detailed, SEO-optimized article outlines that will rank well and provide genuine value to readers interested in ${category}.`;

    const userPrompt = `Create a detailed article outline for the following:

Title: ${title}
Primary Keyword: ${keyword}
Category: ${category}

Generate a comprehensive outline with:
1. A compelling introduction hook
2. 5-7 main sections (H2 headings) with:
   - SEO-friendly heading text
   - 2-3 key points to cover in each section
   - Suggested H3 subheadings where appropriate
3. A FAQ section with 4-5 relevant questions
4. A conclusion with call-to-action

Return the outline as a JSON object with this structure:
{
  "introduction": "Brief description of the intro approach",
  "sections": [
    {
      "heading": "H2 heading text",
      "keyPoints": ["point 1", "point 2", "point 3"],
      "subheadings": ["H3 subheading 1", "H3 subheading 2"]
    }
  ],
  "faqQuestions": [
    {"question": "Question text?", "answer": "Key points for answer"}
  ],
  "conclusion": "Brief description of conclusion approach",
  "suggestedKeywords": ["keyword1", "keyword2", "keyword3"]
}

Return ONLY the JSON object, no additional text.`;

    const outlineText = await callAI(systemPrompt, userPrompt, {
      maxTokens: 2000,
    });

    let parsed;
    try {
      const cleaned = outlineText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error(
        "Failed to parse outline JSON:",
        outlineText.slice(0, 500)
      );
      return NextResponse.json(
        { error: "Invalid outline format from AI" },
        { status: 500 }
      );
    }

    const outline: ArticleOutline = {
      title,
      metaDescription: `${title} - Expert guide on ${keyword} for supplements and sports nutrition.`,
      sections: (parsed.sections || []).map(
        (s: { heading: string; keyPoints: string[] }) => ({
          heading: s.heading,
          keyPoints: s.keyPoints || [],
          estimatedWords: Math.max(300, (s.keyPoints?.length || 0) * 100),
        })
      ),
      suggestedProducts: [],
      internalLinks: [],
      faqQuestions: parsed.faqQuestions || [],
    };

    return NextResponse.json({
      outline,
      suggestedKeywords: parsed.suggestedKeywords || [],
      success: true,
    });
  } catch (error) {
    console.error("Generate outline error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate outline",
      },
      { status: 500 }
    );
  }
}
