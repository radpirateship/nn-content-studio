// FAQ generation route — NN Style Guide compliant
// Handles ONLY the FAQ generation (~15-20s)
import { type NextRequest, NextResponse } from "next/server"
import { callAI } from "@/lib/ai"
import { CATEGORY_LABELS } from "@/lib/nn-categories"

export const maxDuration = 60

// ── Types ────────────────────────────────────────────────────────────────────

interface FaqGenerateRequest {
  keyword: string
  category: string
  titleTag?: string
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: FaqGenerateRequest = await request.json()

    const { keyword, category, titleTag } = body

    const categoryLabel = (CATEGORY_LABELS as Record<string, string>)[category] || category || "Supplements"

    // ══════════════════════════════════════════════════════════════════════════
    // Generate FAQ
    // ══════════════════════════════════════════════════════════════════════════

    console.log("[revamp/faq] Making dedicated FAQ call...")

    const faqSystemPrompt = `You are a Senior Content Editor at Naked Nutrition. Generate ONLY an FAQ section for an article. Output ONLY the HTML below — no explanation, no markdown, no wrapping tags.

FORMAT (use this EXACT structure):
<section id="faq" class="nn-section">
<h2>Frequently Asked Questions</h2>
<div class="nn-faq-list">
<details class="nn-faq-item"><summary class="nn-faq-question">Question?</summary><div class="nn-faq-answer"><p>Answer paragraph.</p></div></details>
</div>
</section>

RULES:
- Write exactly 8 high-quality questions a reader would actually ask — no more, no less
- Each answer should be 2-3 sentences, informative and specific
- Questions should cover different aspects (ingredients, safety, dosage, results, cost, certifications, etc.)
- Do NOT use markdown syntax — HTML only
- Do NOT include any content outside the <section> tags
- Do NOT include comparison tables, product grids, or any nn-grid / nn-card markup. This is an FAQ section ONLY.`

    const faqUserPrompt = `Write an FAQ section for this revamped article:

TITLE: ${titleTag || keyword}
KEYWORD: ${keyword}
CATEGORY: ${categoryLabel}`

    const faqContent = await callAI(faqSystemPrompt, faqUserPrompt, { maxTokens: 2000 })

    const cleanedFaqContent = faqContent
      .replace(/^```html?\n?/i, "")
      .replace(/\n?```$/i, "")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<em>$1</em>")
      // Strip any comparison table / product grid markup that leaked into FAQ
      .replace(/<div\s+class="nn-grid[^"]*">[\s\S]*?<\/div>\s*<\/div>/gi, "")
      .replace(/<div\s+class="nn-card[^"]*">[\s\S]*?<\/div>/gi, "")
      .trim()

    let cleanFaqSection = ""
    const faqItems: { question: string; answer: string }[] = []

    if (cleanedFaqContent.includes('id="faq"') && cleanedFaqContent.includes("nn-faq-item")) {
      // Sanitize FAQ section
      cleanFaqSection = cleanedFaqContent.replace(
        /(<div class="nn-faq-answer">)([\s\S]*?)(<\/div>)/gi,
        (_match: string, open: string, body: string, close: string) => {
          const cleanBody = body
            .replace(/<\/section>/gi, "")
            .replace(/<\/article>/gi, "")
            .replace(/<div\s+class="nn-grid[^"]*">[\s\S]*?<\/div>/gi, "")
            .replace(/<div\s+class="nn-card[^"]*">[\s\S]*?<\/div>/gi, "")
          return open + cleanBody + close
        }
      )

      // Parse FAQ items for schema
      const questionMatches = Array.from(cleanFaqSection.matchAll(/<summary[^>]*>(.*?)<\/summary>/gi))
      const answerMatches = Array.from(cleanFaqSection.matchAll(/<div class="nn-faq-answer">([\s\S]*?)<\/div>/gi))
      questionMatches.forEach((qm, i) => {
        const q = qm[1].replace(/<[^>]+>/g, "").trim()
        const a = answerMatches[i] ? answerMatches[i][1].replace(/<[^>]+>/g, "").trim() : ""
        if (q && a) faqItems.push({ question: q, answer: a })
      })

      console.log("[revamp/faq] FAQ section generated successfully, items:", faqItems.length)
    } else {
      console.warn("[revamp/faq] FAQ call returned unexpected format, skipping:", cleanedFaqContent.substring(0, 200))
    }

    return NextResponse.json({
      faqHtml: cleanFaqSection,
      faqItems,
      faqSchema: faqItems.length > 0
        ? JSON.stringify(
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqItems.map((f) => ({
                "@type": "Question",
                name: f.question,
                acceptedAnswer: { "@type": "Answer", text: f.answer },
              })),
            },
            null,
            2
          )
        : "",
    })
  } catch (error) {
    console.error("[revamp/generate/faq] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate FAQ" },
      { status: 500 }
    )
  }
}
