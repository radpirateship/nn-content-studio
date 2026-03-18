// Revamp article generation route — NN Style Guide compliant
// Multi-call approach: body content → FAQ → programmatic assembly
// DB-saving, productStore-backed, uuid-based article IDs
import { type NextRequest, NextResponse } from "next/server"
import { type NNCategory } from "@/lib/nn-categories"
import { callAI } from "@/lib/ai"
import { getSQL } from "@/lib/db"
import { productStore } from "@/lib/product-store"
import { CATEGORY_LABELS } from "@/lib/nn-categories"
import { NN_STYLES } from "@/lib/nn-template"
import { randomUUID } from "crypto"

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

interface GenerateRequest {
  existingContent: string
  existingShopifyId?: number
  existingHandle?: string
  category: string
  keyword: string
  tone?: string
  wordCount?: number
  includeProducts?: boolean
  includeFAQ?: boolean
  includeEmailCapture?: boolean
  includeCalculator?: boolean
  calculatorType?: string
  includeComparisonTable?: boolean
  specialInstructions?: string
  titleTag?: string
  metaDescription?: string
  approvedOutline: OutlineSection[]
  citations: Citation[]
  revampSourceId?: number
  // Legacy compat — frontend may send these nested in settings
  collection?: string
  relatedArticles?: { title: string; url: string; description: string }[]
}

// ── SVG icon for external links ──────────────────────────────────────────────

const LINK_SVG = '<svg stroke-linejoin="round" stroke-linecap="round" stroke-width="2" stroke="currentColor" fill="none" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>'

// ── Category → Shopify collection slug mapping ──────────────────────────────

const CATEGORY_COLLECTION: Record<string, string> = {
  "whey-protein": "whey-protein",
  "casein-protein": "casein-protein",
  "pea-protein": "pea-protein",
  "rice-protein": "rice-protein",
  "creatine": "creatine",
  "mass-gainer": "mass-gainer",
  "pre-workout": "pre-workout",
  "post-workout": "post-workout",
  "bcaa": "bcaa",
  "collagen": "collagen",
  "greens": "greens",
  "fiber": "fiber",
  "vitamins": "vitamins",
  "probiotics": "probiotics",
  "energy": "energy",
  "weight-management": "weight-management",
  "keto": "keto",
  "vegan": "vegan",
  "general-nutrition": "all",
}

function collectionNameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

// ── Badge config for product cards ───────────────────────────────────────────

const BADGE_BEST_VALUE   = { label: "Best Value", color: "#16a34a" }
const BADGE_EDITORS_PICK = { label: "Editor's Pick", color: "#dc2626" }
const BADGE_PREMIUM      = { label: "Premium Formula", color: "#9333ea" }
const BADGE_PRO_LEVEL    = { label: "Pro-Level", color: "#ea580c" }

function assignBadge(products: { price?: string }[], index: number): { label: string; color: string } {
  if (products.length <= 1) return BADGE_EDITORS_PICK
  const priceRanked = products
    .map((p, i) => ({ i, price: parseFloat(p.price || "0") || 0 }))
    .sort((a, b) => a.price - b.price)
  const rank = priceRanked.findIndex(r => r.i === index)
  const total = priceRanked.length
  if (rank === 0) return BADGE_BEST_VALUE
  if (rank === total - 1) return BADGE_PRO_LEVEL
  if (rank === 1) return BADGE_EDITORS_PICK
  return BADGE_PREMIUM
}

// ── Extract short product name for CTA button ────────────────────────────────

function getShortName(title: string): string {
  const cleaned = title
    .replace(/^(naked|optimum nutrition|muscletech|cellucor|gaspari|xtend|isoflex|isopure)\s+/i, "")
    .replace(/\s+(powder|blend|formula|complex|stack|ultra|pro|elite)\s*$/i, "")
    .trim()
  const words = cleaned.split(/\s+/).slice(0, 3)
  return words.join(" ") || title.split(/\s+/).slice(0, 2).join(" ")
}

// ── Extract feature bullets from product data ────────────────────────────────

function extractFeatures(product: {
  title: string
  description?: string
  tags?: string
  vendor?: string
}): string[] {
  const features: string[] = []
  const combined = `${product.title || ""} ${product.description || ""} ${product.tags || ""}`.toLowerCase()

  const featureMap: [RegExp, string][] = [
    [/whey[\s-]?protein|whey/i, "Whey Protein Base"],
    [/casein[\s-]?protein|casein/i, "Casein Protein"],
    [/plant[\s-]?based|vegan|pea[\s-]?protein|hemp/i, "Plant-Based Protein"],
    [/isolate/i, "Protein Isolate"],
    [/hydrolysate|hydrolyzed/i, "Hydrolyzed Peptides"],
    [/bca[a]|branched[\s-]?chain/i, "BCAA Formula"],
    [/creatine[\s-]?monohydrate/i, "Creatine Monohydrate"],
    [/creatine/i, "Creatine Formula"],
    [/caffeine|stimulant/i, "Caffeine Boost"],
    [/beta[\s-]?alanine/i, "Beta-Alanine"],
    [/citrulline|pump|nitric[\s-]?oxide/i, "Nitric Oxide Booster"],
    [/glutamine/i, "L-Glutamine"],
    [/collagen|peptides|gelatin/i, "Hydrolyzed Collagen"],
    [/electrolyte|sodium|potassium/i, "Electrolyte Blend"],
    [/omega[\s-]?3|fish[\s-]?oil|epa[\s-]?dha/i, "Omega-3 Fish Oil"],
    [/probiotics?|lactobacillus/i, "Probiotic Cultures"],
    [/enzyme|digestive/i, "Digestive Enzymes"],
    [/green[\s-]?tea|egcg|antioxidant/i, "Antioxidant Blend"],
    [/vegan|vegetarian|dairy[\s-]?free|gluten[\s-]?free/i, "Dietary Certified"],
    [/nsf[\s-]?certified|usda[\s-]?organic|non[\s-]?gmo|third[\s-]?party|informed[\s-]?choice/i, "Third-Party Tested"],
    [/sugar[\s-]?free|stevia|artificial[\s-]?sweetener/i, "Zero Sugar"],
    [/keto|ketogenic|low[\s-]?carb/i, "Keto-Friendly"],
  ]

  for (const [pattern, label] of featureMap) {
    if (pattern.test(combined) && features.length < 3 && !features.includes(label)) {
      features.push(label)
    }
  }

  // Pad to 3 with generic features
  const genericFeatures = ["Free Shipping Included", "Expert Nutrition Support", "Quality Verified"]
  for (const gf of genericFeatures) {
    if (features.length >= 3) break
    features.push(gf)
  }

  // Always lead with Free Shipping, cap at 3, then add closer
  features.unshift("Free Shipping Included")
  const trimmed = features.slice(0, 3)
  trimmed.push("Evidence-Based Formulas")

  return trimmed
}

// ── Build NN product card HTML ───────────────────────────────────────────────

function buildProductCard(
  product: {
    title: string
    description?: string
    price?: string
    imageUrl?: string
    url?: string
    handle?: string
    vendor?: string
    tags?: string
  },
  index: number,
  allProducts: { price?: string }[]
): string {
  const badge = assignBadge(allProducts, index)
  const productUrl = product.handle ? `/products/${product.handle}` : (product.url || "#")
  const shortName = getShortName(product.title)
  const features = extractFeatures(product)

  const imageHtml = product.imageUrl
    ? `<div class="nn-product-image-container"><img src="${product.imageUrl}" alt="${product.title}" class="nn-product-image" loading="lazy" /></div>`
    : ""

  let priceHtml = ""
  if (product.price) {
    const numPrice = parseFloat(product.price)
    if (!isNaN(numPrice) && numPrice > 0) {
      const formatted = numPrice % 1 === 0
        ? numPrice.toLocaleString("en-US")
        : numPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      priceHtml = `<p style="font-weight:800;font-size:1.6rem;color:${badge.color};margin:0.5rem 0;">$${formatted}</p>`
    }
  }

  const featureBullets = features
    .map((f, i) => (i === 0 ? `<li>✓ <strong>${f}</strong></li>` : `<li>✓ ${f}</li>`))
    .join("\n")

  return `<div class="nn-product-card" style="border-color:${badge.color};">
<span class="nn-badge" style="background:${badge.color};align-self:flex-start;margin-bottom:1rem;">${badge.label}</span>
${imageHtml}
<h3>${product.title}</h3>
${priceHtml}
<ul>
${featureBullets}
</ul>
<div style="margin-top:auto;"><a class="nn-cta" href="${productUrl}">View ${shortName}</a></div>
</div>`
}

// ── Build related articles footer ────────────────────────────────────────────

function buildRelatedArticlesHtml(articles: { title: string; url: string; description: string }[]): string {
  if (!articles || articles.length === 0) return ""
  const cards = articles.slice(0, 3).map((a) =>
    `<article class="nn-card">
<h3 class="nn-card-title"><a href="${a.url}" class="nn-links">${a.title} ${LINK_SVG}</a></h3>
<p class="nn-sm">${a.description}</p>
</article>`
  ).join("\n")

  return `<section class="nn-section">
<h2>Continue Your Nutrition Journey</h2>
<div class="nn-grid cols-3">
${cards}
</div>
</section>`
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json()

    const {
      existingContent,
      existingShopifyId,
      existingHandle,
      category,
      keyword,
      tone = "educational",
      wordCount = 2500,
      includeProducts = true,
      includeFAQ = true,
      includeEmailCapture = true,
      includeCalculator = false,
      calculatorType,
      includeComparisonTable = false,
      specialInstructions,
      approvedOutline,
      citations = [],
      revampSourceId,
      collection,
      relatedArticles,
    } = body

    const categoryLabel = (CATEGORY_LABELS as Record<string, string>)[category] || category || "Supplements"
    const collectionSlug = CATEGORY_COLLECTION[category] || (collection ? collectionNameToSlug(collection) : "all")
    const targetWordCount = wordCount
    const articleTone = tone
    const readTime = Math.max(5, Math.round(targetWordCount / 250))

    // ── 1. Load products via productStore ────────────────────────────────────

    const products = includeProducts
      ? productStore.getRecommendations(category, 4)
      : []

    // ── 2. Build outline context ─────────────────────────────────────────────

    const outlineContext = approvedOutline?.length
      ? `APPROVED REWRITE OUTLINE (FOLLOW THIS STRUCTURE):\n${approvedOutline
          .map((item) => {
            const tag = item.isNew ? " [NEW SECTION]" : " [FROM ORIGINAL]"
            return `- ${item.heading}${tag}\n  Key points: ${item.keyPoints.join(", ")}`
          })
          .join("\n")}`
      : ""

    // ── 3. Build citation references ─────────────────────────────────────────

    const citationsText = citations.length
      ? citations
          .map(
            (c, i) =>
              `[${i + 1}] ${c.url}${c.title ? ` — ${c.title}` : ""}${c.notes ? `\nNotes: ${c.notes}` : ""}`
          )
          .join("\n")
      : ""

    // ── 4. Conversion element instructions ───────────────────────────────────

    const emailCaptureHtml = includeEmailCapture
      ? `\n<section class="nn-section nn-email-gate">
<h3>Get Expert Nutrition Tips</h3>
<p>Subscribe to our newsletter for the latest supplement research and exclusive NN member benefits.</p>
<form class="nn-email-form">
<input type="email" placeholder="Enter your email" required />
<button type="submit" class="nn-cta">Subscribe</button>
</form>
</section>`
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
    // CALL 1: Generate body content (NO FAQ, NO images, NO product cards)
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

TITLE: ${body.titleTag || keyword}
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

    console.log("[revamp] Generate: calling AI for NN body content rewrite...")
    const maxTokens = Math.min(8000, Math.round((targetWordCount / 0.75) * 1.25))
    const bodyContent = await callAI(systemPrompt, userPrompt, { maxTokens })
    console.log("[revamp] Generate: body content received, length:", bodyContent.length)

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
      console.log("[revamp] Generate: Stripped complete FAQ section from body content")
    } else if (faqPartialSectionRegex.test(cleanedBodyContent)) {
      cleanedBodyContent = cleanedBodyContent.replace(faqPartialSectionRegex, "")
      console.log("[revamp] Generate: Stripped partial/truncated FAQ section from body content")
    } else if (faqHeadingRegex.test(cleanedBodyContent)) {
      cleanedBodyContent = cleanedBodyContent.replace(faqHeadingRegex, "")
      console.log("[revamp] Generate: Stripped stray FAQ heading from body content")
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

    // ══════════════════════════════════════════════════════════════════════════
    // CALL 2: Generate FAQ separately (reliable structure every time)
    // ══════════════════════════════════════════════════════════════════════════

    let cleanFaqSection = ""
    const faqItems: { question: string; answer: string }[] = []

    if (includeFAQ) {
      console.log("[revamp] Generate: Making dedicated FAQ call...")
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

TITLE: ${body.titleTag || keyword}
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

        console.log("[revamp] Generate: FAQ section generated and appended successfully")
      } else {
        console.warn("[revamp] Generate: FAQ call returned unexpected format, skipping:", cleanedFaqContent.substring(0, 200))
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CALL 3: Generate subtitle
    // ══════════════════════════════════════════════════════════════════════════

    const title = body.titleTag || keyword
    const subtitlePrompt = `Write a single compelling subtitle sentence (under 150 chars) for an article titled "${title}" about ${keyword}. Return ONLY the sentence, no quotes.`
    const subtitle = await callAI("You write concise article subtitles.", subtitlePrompt, { maxTokens: 100 })

    // ══════════════════════════════════════════════════════════════════════════
    // PROGRAMMATIC ASSEMBLY
    // ══════════════════════════════════════════════════════════════════════════

    // Parse section headings for navigation
    const headingMatches = Array.from(cleanedBodyContent.matchAll(/<h2[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h2>/gi))
    const navItems: { id: string; text: string }[] = []
    for (const match of headingMatches) {
      const text = match[2].replace(/<[^>]+>/g, "").trim()
      const id = match[1] || text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      navItems.push({ id, text })
    }

    // Ensure headings have IDs
    let processedContent = cleanedBodyContent
    for (const nav of navItems) {
      const escapedText = nav.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const headingRegex = new RegExp(`<h2([^>]*)>${escapedText}</h2>`, "i")
      if (!processedContent.match(new RegExp(`id="${nav.id}"`))) {
        processedContent = processedContent.replace(headingRegex, `<h2$1 id="${nav.id}">${nav.text}</h2>`)
      }
    }

    // ── Overview / Hero section ──────────────────────────────────────────────

    const overviewHtml = `<section id="overview" class="nn-section">
<div class="nn-kicker">${categoryLabel}</div>
<h1>${title}</h1>
<p class="nn-subtitle">${subtitle.trim()}</p>
<div class="nn-meta"><span>By Naked Nutrition</span><span class="nn-dot"></span><span>${readTime} min read</span></div>
</section>`

    // ── Featured Products section (deterministic HTML) ───────────────────────

    let productsHtml = ""
    if (includeProducts && products.length > 0) {
      const displayProducts = products.slice(0, 4)
      const cards = displayProducts
        .map((p, i) => buildProductCard(p, i, displayProducts))
        .join("\n")
      productsHtml = `\n<section id="featured-products" class="nn-section">
<h2 class="nn-center">Top ${categoryLabel} Picks</h2>
<p style="margin-bottom:3rem;color:#666;font-size:1.6rem;" class="nn-center">Evidence-based formulas with free shipping included and expert nutrition support.</p>
<div class="nn-grid cols-2">
${cards}
</div>
</section>`
    }

    // Insert products after Key Takeaways (first </section>)
    let bodyWithProducts = processedContent
    if (productsHtml) {
      const firstSectionEnd = processedContent.indexOf("</section>")
      if (firstSectionEnd !== -1) {
        const insertAt = firstSectionEnd + "</section>".length
        bodyWithProducts =
          processedContent.slice(0, insertAt) + productsHtml + processedContent.slice(insertAt)
      } else {
        bodyWithProducts = productsHtml + processedContent
      }
    }

    // ── Related Articles footer ──────────────────────────────────────────────

    const relatedHtml = buildRelatedArticlesHtml(relatedArticles || [])

    // ── Shop CTA ─────────────────────────────────────────────────────────────

    const ctaHtml = `\n<section class="nn-section nn-center">
<a href="/collections/${collectionSlug}" class="nn-cta">Shop The Collection</a>
</section>`

    // ── FAQ Schema JSON-LD ───────────────────────────────────────────────────

    const faqSchema = faqItems.length > 0
      ? `\n<script type="application/ld+json">\n${JSON.stringify(
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
        )}\n</script>`
      : ""

    // ── Navigation (built from final assembled content) ──────────────────────

    const fullBodyForNav = `${bodyWithProducts}${cleanFaqSection}`
    const excludeNavPatterns = ["continue-your", "shop", "key-takeaway", "featured-product"]
    const finalH2Regex = /<h2[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h2>/gi
    const finalNavItems: { id: string; text: string }[] = []
    let navMatch
    while ((navMatch = finalH2Regex.exec(fullBodyForNav)) !== null) {
      const text = navMatch[2].replace(/<[^>]+>/g, "").trim()
      const id =
        navMatch[1] ||
        text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      if (!excludeNavPatterns.some((p) => id.includes(p)) && text) {
        finalNavItems.push({ id, text })
      }
    }

    const navLinks = [
      `<a href="#overview">Overview</a>`,
      ...finalNavItems.map((n) => `<a href="#${n.id}">${n.text}</a>`),
    ]
    const navHtml = `<nav class="nn-topnav" aria-label="Quick navigation">\n${navLinks.join("\n")}\n</nav>`

    // ══════════════════════════════════════════════════════════════════════════
    // FINAL ASSEMBLY
    // ══════════════════════════════════════════════════════════════════════════

    const finalHtml = `${NN_STYLES}

<div class="nn-wrap" style="text-align: start;">
<article class="nn-container nn-article" itemscope itemtype="https://schema.org/Article">

${navHtml}

${overviewHtml}
${bodyWithProducts}
${cleanFaqSection}
${relatedHtml}
${ctaHtml}

</article>
</div>
${faqSchema}`.trim()

    console.log("[revamp] Generate: NN article assembled, total length:", finalHtml.length)

    // ── Word count from stripped HTML ────────────────────────────────────────

    const wordCountActual = finalHtml
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .split(/\s+/)
      .filter(Boolean).length

    // ── Generate slug ────────────────────────────────────────────────────────

    const slug =
      existingHandle ??
      keyword
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

    // ── Save to database ─────────────────────────────────────────────────────

    const sql = getSQL()

    const [savedArticle] = await sql`
      INSERT INTO articles (
        title, slug, keyword, category, status,
        html_content, word_count,
        source_type, original_shopify_id,
        created_at, updated_at
      ) VALUES (
        ${title}, ${slug}, ${keyword}, ${category}, 'draft',
        ${finalHtml}, ${wordCountActual},
        'revamp', ${existingShopifyId ?? null},
        NOW(), NOW()
      )
      RETURNING id
    `

    const dbId = savedArticle.id

    // Update the revamp_sources row with the article reference if it exists
    if (revampSourceId) {
      await sql`
        UPDATE revamp_sources
        SET article_id = ${dbId}
        WHERE id = ${revampSourceId}
      `
    }

    // ── Build response ───────────────────────────────────────────────────────

    const article = {
      id: randomUUID(),
      dbId,
      title,
      slug,
      titleTag: body.titleTag ?? title,
      metaDescription: body.metaDescription ?? subtitle.trim().slice(0, 160),
      content: finalHtml.replace(/<[^>]+>/g, " ").trim(),
      htmlContent: finalHtml,
      featuredImage: undefined,
      contentImages: [],
      products: products.map((p) => ({
        id: p.id ?? p.handle,
        handle: p.handle,
        title: p.title,
        description: p.description ?? "",
        vendor: p.vendor ?? "Naked Nutrition",
        productType: p.productType ?? "",
        tags: p.tags ? (p.tags as string).split(",").map((t: string) => t.trim()) : [],
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        imageUrl: p.imageUrl,
        url: p.url ?? `https://www.nakednutrition.com/products/${p.handle}`,
        category,
        isAvailable: true,
      })),
      faqs: faqItems,
      schemaMarkup: faqSchema,
      category,
      keyword,
      wordCount: wordCountActual,
      createdAt: new Date(),
      status: "draft" as const,
      sourceType: "revamp" as const,
      originalShopifyId: existingShopifyId,
      hasInternalLinks: false,
      hasImages: false,
      linkCount: 0,
      imageCount: 0,
    }

    return NextResponse.json({ article })
  } catch (error) {
    console.error("[revamp/generate] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate revamped content" },
      { status: 500 }
    )
  }
}
