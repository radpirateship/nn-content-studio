// Finalize route — assembles final article and saves to DB
// Handles subtitle generation, programmatic assembly, and DB save (~10s)
import { type NextRequest, NextResponse } from "next/server"
import { callAI } from "@/lib/ai"
import { getSQL } from "@/lib/db"
import { productStore } from "@/lib/product-store"
import { CATEGORY_LABELS } from "@/lib/nn-categories"
import { NN_STYLES } from "@/lib/nn-template"
import { randomUUID } from "crypto"

export const maxDuration = 60

// ── Types ────────────────────────────────────────────────────────────────────

interface FinalizeRequest {
  bodyContent: string
  faqHtml: string
  faqItems: { question: string; answer: string }[]
  faqSchema: string
  keyword: string
  category: string
  titleTag?: string
  metaDescription?: string
  existingHandle?: string
  existingShopifyId?: number
  revampSourceId?: number
  includeProducts?: boolean
  relatedArticles?: { title: string; url: string; description: string }[]
  collection?: string
  tone?: string
  wordCount?: number
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
    const body: FinalizeRequest = await request.json()

    const {
      bodyContent,
      faqHtml,
      faqItems,
      faqSchema,
      keyword,
      category,
      titleTag,
      metaDescription,
      existingHandle,
      existingShopifyId,
      revampSourceId,
      includeProducts = true,
      relatedArticles,
      collection,
      tone = "educational",
      wordCount = 2500,
    } = body

    const categoryLabel = (CATEGORY_LABELS as Record<string, string>)[category] || category || "Supplements"
    const collectionSlug = CATEGORY_COLLECTION[category] || (collection ? collectionNameToSlug(collection) : "all")
    const readTime = Math.max(5, Math.round((wordCount || 2500) / 250))
    const title = titleTag || keyword

    // ── Generate subtitle ────────────────────────────────────────────────────

    const subtitlePrompt = `Write a single compelling subtitle sentence (under 150 chars) for an article titled "${title}" about ${keyword}. Return ONLY the sentence, no quotes.`
    const subtitle = await callAI("You write concise article subtitles.", subtitlePrompt, { maxTokens: 100 })

    // ── Load products via productStore ───────────────────────────────────────

    const products = includeProducts
      ? productStore.getRecommendations(category, 4)
      : []

    // ══════════════════════════════════════════════════════════════════════════
    // PROGRAMMATIC ASSEMBLY
    // ══════════════════════════════════════════════════════════════════════════

    // Parse section headings for navigation
    const headingMatches = Array.from(bodyContent.matchAll(/<h2[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h2>/gi))
    const navItems: { id: string; text: string }[] = []
    for (const match of headingMatches) {
      const text = match[2].replace(/<[^>]+>/g, "").trim()
      const id = match[1] || text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      navItems.push({ id, text })
    }

    // Ensure headings have IDs
    let processedContent = bodyContent
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

    // ── Navigation (built from final assembled content) ──────────────────────

    const fullBodyForNav = `${bodyWithProducts}${faqHtml}`
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
${faqHtml}
${relatedHtml}
${ctaHtml}

</article>
</div>
${faqSchema.length > 0 ? `\n<script type="application/ld+json">\n${faqSchema}\n</script>` : ""}`.trim()

    console.log("[revamp/finalize] NN article assembled, total length:", finalHtml.length)

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
      titleTag: titleTag ?? title,
      metaDescription: metaDescription ?? subtitle.trim().slice(0, 160),
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
    console.error("[revamp/generate/finalize] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to finalize article" },
      { status: 500 }
    )
  }
}
