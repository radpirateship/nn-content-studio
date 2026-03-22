// Content body generation route — NN Style Guide compliant
// Handles ONLY the body content AI generation (~40-50s)
import { type NextRequest, NextResponse } from "next/server"
import { type NNCategory } from "@/lib/nn-categories"
import { callAI } from "@/lib/ai"
import { CATEGORY_LABELS } from "@/lib/nn-categories"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"

export const maxDuration = 60

// ── Types ────────────────────────────────────────────────────────────────────

interface OutlineSection {
  heading: string
  keyPoints: string[]
  isNew: boolean
}

interface Citation {
  id?: string
  url: string
  title?: string
  notes?: string
}

interface ContentGenerateRequest {
  existingContent: string
  category: string
  keyword: string
  tone?: string
  wordCount?: number
  includeEmailCapture?: boolean
  includeCalculator?: boolean
  calculatorType?: string
  includeComparisonTable?: boolean
  specialInstructions?: string
  titleTag?: string
  approvedOutline: OutlineSection[]
  citations: Citation[]
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit("revamp-content", { windowMs: 60_000, max: 5 })
    if (!limit.allowed) return rateLimitResponse(limit)

    const body: ContentGenerateRequest = await request.json()

    const {
      existingContent,
      category,
      keyword,
      tone = "educational",
      wordCount = 2500,
      includeEmailCapture = true,
      includeCalculator = false,
      calculatorType,
      includeComparisonTable = false,
      specialInstructions,
      approvedOutline,
      citations = [],
      titleTag,
    } = body

    const categoryLabel = (CATEGORY_LABELS as Record<string, string>)[category] || category || "Supplements"
    const targetWordCount = wordCount
    const articleTone = tone

    // ── Build outline context ─────────────────────────────────────────────

    const outlineContext = approvedOutline?.length
      ? `APPROVED REWRITE OUTLINE (FOLLOW THIS STRUCTURE):\n${approvedOutline
          .map((item) => {
            const tag = item.isNew ? " [NEW SECTION]" : " [FROM ORIGINAL]"
            return `- ${item.heading}${tag}\n  Key points: ${item.keyPoints.join(", ")}`
          })
          .join("\n")}`
      : ""

    // ── Build citation references ─────────────────────────────────────────

    const citationsText = citations.length
      ? citations
          .map(
            (c, i) =>
              `[${i + 1}] ${c.url}${c.title ? ` — ${c.title}` : ""}${c.notes ? `\nNotes: ${c.notes}` : ""}`
          )
          .join("\n")
      : ""

    // ── Conversion element instructions ───────────────────────────────────

    const emailCaptureHtml = includeEmailCapture
      ? `\n<div class="nn-email-gate">
<span class="nn-incentive">🎁 10% Off Your First Order</span>
<h3>Get Your Free ${categoryLabel} Guide</h3>
<p class="nn-body">Subscribe for evidence-based ${categoryLabel.toLowerCase()} tips, exclusive member discounts, and our latest research roundups — delivered weekly.</p>
<!-- KLAVIYO_FORM_EMBED: nn-blog-email-capture -->
<p style="font-size:0.8rem;color:#8a94a0;margin-top:1rem;">No spam. Unsubscribe anytime.</p>
</div>`
      : ""

    const calculatorHtml =
      includeCalculator && calculatorType
        ? `\n<section class="nn-section nn-calculator">
<h3>${calculatorType} Calculator</h3>
<div class="nn-calculator-widget" data-calculator="${calculatorType}"></div>
<p class="nn-sm" style="color:#666;margin-top:1rem;">Use this calculator to personalize your supplementation strategy.</p>
</section>`
        : ""

    const comparisonInstruction = includeComparisonTable
      ? "\n- If appropriate, include a comparison table using NN grid markup: <div class=\"nn-grid cols-2\"> or cols-3 with nn-card items. IMPORTANT: The comparison table must NOT be the last content section — always close every nn-card and nn-grid div properly and follow it with at least one more prose section before the article ends."
      : ""

    const specialContext = specialInstructions
      ? `\nSPECIAL INSTRUCTIONS FROM EDITOR:\n${specialInstructions}`
      : ""

    // ══════════════════════════════════════════════════════════════════════════
    // Generate body content
    // ══════════════════════════════════════════════════════════════════════════

    const systemPrompt = `You are a Senior Content Editor at Naked Nutrition, a premium supplement and sports nutrition brand. You are rewriting an existing article, not generating from scratch. Your goal is to preserve the author's best insights and unique perspectives while dramatically improving structure, SEO optimization, and conversion elements.

OUTPUT FORMAT — You MUST use NN CSS classes (already defined in the page). Do NOT use inline styles. Do NOT use markdown syntax (**, __, *, _, ##, etc.) — use only HTML tags like <strong>, <em>, <h2>, etc.

STRUCTURE YOU MUST FOLLOW:
1. Start directly with body section content (NO <style>, NO <div class="nn-wrap">, NO <nav>, NO <h1> — those are added by the template)
2. First section: A "Key Takeaways" box:
   <section class="nn-section nn-muted">
   <h2>Key Takeaways</h2>
   <ul><li><strong>Label:</strong> description</li>...</ul>
   </section>
3. Body sections, each wrapped in:
   <section id="SLUG" class="nn-section">
   <h2>Section Title</h2>
   ...paragraphs, lists, callout boxes...
   </section>
4. Use <div class="nn-callout"> for important callout blocks
5. Weave citations into the text as linked references: "...research shows that [citation 1] claims that..."
6. Do NOT include any image tags or image placeholders. Images are added separately after content generation.
7. Do NOT include an FAQ section. The FAQ is generated in a separate step.
8. If you include a comparison table, it must NEVER be the last section. Always follow it with a prose wrap-up section.
9. RESEARCH CALLOUT BOXES: For 1-2 of the most important research findings, create a dedicated callout using this structure:
   <div class="nn-callout" style="background:linear-gradient(135deg,#f0f8ff 0%,#e6f4ff 100%);border-left-color:#00A3FF;border-left-width:5px;padding:1.5rem;">
   <p style="font-family:'Oswald',sans-serif;font-weight:600;font-size:1.1rem;margin-bottom:0.5rem;">📊 What Research Says</p>
   <p class="nn-body">[Specific finding from the research with the linked citation]</p>
   </div>
10. INFO BOXES WITH ICONS: For 1-2 key concept explanations (e.g., "How Creatine Works", "The Muscle Growth Equation", "Safety Facts"), create a rich info box using this structure:
   <div class="nn-info-box">
   <div class="nn-info-box-header">
   <div class="nn-info-box-icon"><span>[relevant emoji like 🧬 or 💪 or 🔬 or ⚡]</span></div>
   <div class="nn-info-box-title">[Concept Title]</div>
   </div>
   <ul>
   <li>[Key fact or step 1]</li>
   <li>[Key fact or step 2]</li>
   <li>[Key fact or step 3]</li>
   </ul>
   </div>

WRITING GUIDELINES:
- Preserve the original article's strongest points and insights — don't discard what works
- Rewrite for a ${articleTone} tone with genuine expertise
- STRICT WORD COUNT: Write between ${targetWordCount - 200} and ${targetWordCount + 300} words of body content. Do NOT exceed ${targetWordCount + 300} words.
- Dramatically restructure for better SEO: start with the keyword in an early H2, improve logical flow
- Weave provided citations naturally into the text as linked references [1], [2], etc.
- Scannable paragraphs (3-5 sentences)
- Include practical, actionable advice
- Use bullet points and numbered lists where appropriate${comparisonInstruction}
- Do NOT add any <h1> tag
- Section IDs must be lowercase-kebab-case
- Do NOT add any internal links or <a> tags to other articles

OUTPUT: Return ONLY the section content. No wrapping tags, no <style>, no <html>.`

    const userPrompt = `Rewrite this existing article with significant structural improvements.

TITLE: ${titleTag || keyword}
PRIMARY KEYWORD: ${keyword}
CATEGORY: ${categoryLabel}

${outlineContext}

ORIGINAL ARTICLE:
---
${existingContent}
---

${citationsText ? `CITATIONS TO WEAVE IN:\n${citationsText}` : ""}

${specialContext}

Requirements:
- Preserve the author's best insights and unique perspectives
- Dramatically improve structure, readability, and SEO
- Weave citations into the text naturally as linked references
- Do NOT include any image tags or image placeholders
- Do NOT include an FAQ section (it is generated separately)
- Key Takeaways section first using nn-muted class
- All sections use nn-section class with kebab-case IDs`

    console.log("[revamp/content] Calling AI for NN body content rewrite...")
    const maxTokens = Math.min(8000, Math.round((targetWordCount / 0.75) * 1.25))
    const bodyContent = await callAI(systemPrompt, userPrompt, { maxTokens })
    console.log("[revamp/content] Body content received, length:", bodyContent.length)

    // Clean up any stray markdown syntax or leaked image placeholders
    let cleanedBodyContent = bodyContent
      .replace(/<img[^>]*src="?\[IMAGE_PLACEHOLDER_\d+\]"?[^>]*\/?>/gi, "")
      .replace(/\[IMAGE_PLACEHOLDER_\d+\]/g, "")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<em>$1</em>")
      .replace(/(?<!=")#{2,6}\s+(.+)/g, "<h2>$1</h2>")
      .replace(/^\s*[-*]\s+/gm, "• ")

    // Strip any FAQ content the main generation may have included
    const faqFullSectionRegex = /<section\s[^>]*id=["']faq["'][^>]*>[\s\S]*?<\/section>/gi
    const faqPartialSectionRegex = /<section\s[^>]*id=["']faq["'][^>]*>[\s\S]*/gi
    const faqHeadingRegex = /<h2[^>]*>\s*Frequently Asked Questions\s*<\/h2>[\s\S]*/gi

    if (faqFullSectionRegex.test(cleanedBodyContent)) {
      cleanedBodyContent = cleanedBodyContent.replace(faqFullSectionRegex, "")
      console.log("[revamp/content] Stripped complete FAQ section from body content")
    } else if (faqPartialSectionRegex.test(cleanedBodyContent)) {
      cleanedBodyContent = cleanedBodyContent.replace(faqPartialSectionRegex, "")
      console.log("[revamp/content] Stripped partial/truncated FAQ section from body content")
    } else if (faqHeadingRegex.test(cleanedBodyContent)) {
      cleanedBodyContent = cleanedBodyContent.replace(faqHeadingRegex, "")
      console.log("[revamp/content] Stripped stray FAQ heading from body content")
    }

    cleanedBodyContent = cleanedBodyContent.replace(/\s+$/, "")

    // Insert email capture and calculator if requested
    if (emailCaptureHtml || calculatorHtml) {
      const firstSectionEnd = cleanedBodyContent.indexOf("</section>")
      if (firstSectionEnd !== -1) {
        const insertAt = firstSectionEnd + "</section>".length
        const insertContent = emailCaptureHtml + (calculatorHtml || "")
        cleanedBodyContent =
          cleanedBodyContent.slice(0, insertAt) + insertContent + cleanedBodyContent.slice(insertAt)
      }
    }

    return NextResponse.json({ bodyContent: cleanedBodyContent })
  } catch (error) {
    console.error("[revamp/generate/content] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate body content" },
      { status: 500 }
    )
  }
}
