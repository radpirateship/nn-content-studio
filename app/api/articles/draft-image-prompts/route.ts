import { type NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/articles/draft-image-prompts
 * 
 * The "Technical Illustrator" persona. Reads the article and drafts 4 detailed
 * image generation prompts: 1 cinematic featured image + 3 technical/educational graphics.
 * 
 * Does NOT generate images. Returns prompts for the user to review/edit first.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit("draft-image-prompts", { windowMs: 60_000, max: 5 });
    if (!limit.allowed) return rateLimitResponse(limit);

    const { htmlContent, articleTitle, articleKeyword, category } = await request.json();

    if (!htmlContent) {
      return NextResponse.json({ error: "htmlContent is required" }, { status: 400 });
    }

    // Extract plain text for analysis
    const plainText = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);

    // Extract H2 section IDs and their text from the article
    const h2Regex = /<h2[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h2>/gi;
    const sections: { id: string; text: string }[] = [];
    let h2Match;
    while ((h2Match = h2Regex.exec(htmlContent)) !== null) {
      const text = h2Match[2].replace(/<[^>]+>/g, '').trim();
      const id = h2Match[1] || text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      // Exclude non-content sections
      if (!id.match(/faq|key-takeaway|continue-your|featured-product|shop/)) {
        sections.push({ id, text });
      }
    }

    const sectionList = sections.map((s, i) => `  ${i + 1}. id="${s.id}" — "${s.text}"`).join('\n');

    const systemPrompt = `You are an expert Technical Illustrator and Brand Visualist for Naked Nutrition.

Your Task: Create 4 distinct image concepts (1 Hero, 3 Technical/Educational) based on the article.
Each image MUST be assigned to a specific article section by its H2 id.

Crucial Constraint: Every concept you draft must be designed to fit a strict brand style guide that will be appended to your prompt later. Do NOT include style instructions yourself — the global style suffix will handle that.

For the Featured Image: Describe a clean, high-end cinematic shot. Assign it to the FIRST content section. Focus on professional lighting and the brand color palette (e.g., premium protein powder with vibrant product photography in clean athletic setting). Think magazine cover quality. IMPORTANT: The featured image prompt MUST include this instruction at the end: "Include the article title as large, bold, elegant white text rendered directly within the image — centered near the bottom third, on a dark semi-transparent background strip. The text must be fully legible and part of the image itself, not an overlay."

For Technical Graphics: Describe charts, diagrams, molecular structures, or infographics. Each one MUST be assigned to the section it illustrates — match the image content to the section topic. Explicitly state how to use the brand colors (e.g., 'Use Navy Blue for the main molecular outlines, Red arrows to show absorption pathways, and a clean White background'). Use precise visual vocabulary: "molecular diagram," "nutritional science illustration," "supplement composition chart," "absorption pathway infographic," "performance benefits diagram."

RULES:
- Each image must go to a DIFFERENT section — never assign two images to the same section id.
- The featured image goes to the first content section.
- Technical images should be spread across different sections.
- AVOID: Generic stock photos of people smiling, relaxing, or exercising. Every image must convey INFORMATION or explain a CONCEPT. Keep text inside images to absolute minimum.

OUTPUT FORMAT: Return ONLY a valid JSON array of exactly 4 objects. No markdown, no code fences, no explanation.
Each object must have:
- "label": Short descriptive label like "Figure 1: Amino Acid Structure" or "Hero: Protein Synthesis Process"
- "prompt": The descriptive core of the image prompt (80-150 words). Do not include style instructions.
- "altText": A descriptive, SEO-friendly alt text (10-20 words) that explains exactly what the image shows. Must be specific to the content, never generic like "Article image". Example: "Diagram showing amino acid chains and protein synthesis pathway in muscle tissue"
- "type": Either "featured" or "technical"
- "targetSectionId": The exact H2 id from the list below where this image belongs`;

    const userPrompt = `ARTICLE TITLE: "${articleTitle}"
KEYWORD: "${articleKeyword}"
CATEGORY: "${category}"

AVAILABLE ARTICLE SECTIONS (use these exact ids for targetSectionId):
${sectionList}

ARTICLE CONTENT:
${plainText}

Draft 4 image prompts (1 featured + 3 technical). Assign each to a different section from the list above.

FOR THE FEATURED IMAGE PROMPT: You must end the prompt field with this exact sentence (substituting the real title): Include the text "${articleTitle}" as large, bold, elegant white text rendered directly within the image — centered near the bottom third, on a dark semi-transparent background strip. The text must be fully legible and baked into the image itself.`;

    let rawText = await callAI(systemPrompt, userPrompt, { maxTokens: 4000 });

    // Clean markdown fences
    rawText = rawText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();

    let concepts;
    try {
      concepts = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse AI image concepts:", rawText.slice(0, 500));
      return NextResponse.json({ error: "AI returned invalid JSON for image concepts" }, { status: 500 });
    }

    // Normalize into our ImageConcept format with section targeting
    const usedSections = new Set<string>();
    const sectionIds = sections.map(s => s.id);

    const normalizedConcepts = (Array.isArray(concepts) ? concepts : []).map(
      (c: { label: string; prompt: string; type: string; targetSectionId?: string; altText?: string }, i: number) => {
        // Validate targetSectionId — must be from the article's actual sections
        let targetId = c.targetSectionId || '';
        if (!sectionIds.includes(targetId) || usedSections.has(targetId)) {
          // Assign to next unused section
          targetId = sectionIds.find(id => !usedSections.has(id)) || sectionIds[0] || '';
        }
        if (targetId) usedSections.add(targetId);

        // Build descriptive alt text: prefer AI-generated, fall back to label stripped of "Figure N:" prefix
        const rawLabel = (c.label || `Image ${i + 1}`);
        const fallbackAlt = rawLabel.replace(/^(featured|hero|figure\s*\d*)\s*[:–\-]\s*/i, '').trim();

        return {
          id: `img-${Date.now()}-${i}`,
          label: rawLabel,
          prompt: c.prompt || '',
          altText: c.altText || fallbackAlt,
          type: (c.type === 'featured' || c.type === 'hero') ? 'featured' as const : 'technical' as const,
          status: 'draft' as const,
          targetSectionId: targetId,
          placeholderKey: `IMAGE_PLACEHOLDER_${i + 1}`, // legacy compat
        };
      }
    ).filter((c: { prompt: string }) => c.prompt);

    return NextResponse.json({
      concepts: normalizedConcepts,
      count: normalizedConcepts.length,
      success: true,
    });
  } catch (error) {
    console.error("Draft image prompts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to draft image prompts" },
      { status: 500 }
    );
  }
}
