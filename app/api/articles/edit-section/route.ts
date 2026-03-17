import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const { sectionHtml, sectionType, editInstructions, articleContext } = await request.json();

    if (!sectionHtml || !editInstructions) {
      return NextResponse.json(
        { error: "Section HTML and edit instructions are required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a wellness content editor for Naked Nutrition. You specialize in editing specific sections of articles about wellness equipment (float tanks, saunas, cold plunge systems, red light therapy, etc.).

Your task is to revise the provided HTML section according to the user's instructions while:
1. Maintaining the exact same HTML structure and class names
2. Keeping the same PPW styling conventions
3. Ensuring content remains evidence-based and accurate
4. Preserving any existing links, images, or interactive elements
5. Matching the tone and style of the rest of the article

IMPORTANT: Return ONLY the revised HTML for this section, nothing else. Do not include explanations or markdown code blocks.`;

    const userPrompt = `Here is the section to edit (type: ${sectionType || "content"}):

\`\`\`html
${sectionHtml}
\`\`\`

${articleContext ? `Article context: ${articleContext}` : ""}

Edit instructions: ${editInstructions}

Please revise this section according to the instructions. Return ONLY the revised HTML, maintaining the exact same structure and class names.`;

    const revisedHtml = (await callAI(systemPrompt, userPrompt, { maxTokens: 4096 })).trim();

    // Clean up any markdown code blocks if Claude accidentally added them
    const cleanedHtml = revisedHtml
      .replace(/^```html\n?/i, "")
      .replace(/^```\n?/, "")
      .replace(/\n?```$/g, "")
      .trim();

    return NextResponse.json({
      revisedHtml: cleanedHtml,
      originalHtml: sectionHtml,
    });
  } catch (error) {
    console.error("Error editing section:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to edit section" },
      { status: 500 }
    );
  }
}
