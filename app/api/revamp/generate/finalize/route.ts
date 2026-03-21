// Finalize route — assembles final article and saves to DB
// Handles subtitle generation, programmatic assembly, and DB save (~10s)
import { type NextRequest, NextResponse } from "next/server"
import { callAI } from "@/lib/ai"
import { getSQL } from "@/lib/db"
import { getProductRecommendationsFromDB } from "@/lib/product-store"
import { CATEGORY_LABELS } from "@/lib/nn-categories"
import { NN_STYLES } from "@/lib/nn-template"
import { logActivity } from "@/lib/activity-log"
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
  citations?: { url: string; title?: string; author?: string; notes?: string }[]
  collection?: string
  tone?: string
  wordCount?: number
  videoUrl?: string
  heroImageUrl?: string
  quickAnswer?: string
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

// ── HTML Post-Processor: adds nn-body/nn-h2/nn-h3 classes to plain tags ─────

function postProcessHtml(html: string): string {
  let result = html

  // Add nn-h2 class to all <h2> tags that don't already have it
  result = result.replace(/<h2(?![^>]*class="[^"]*nn-h2)([^>]*)>/gi, (match, attrs) => {
    if (attrs.includes('class="')) {
      return match.replace(/class="/, 'class="nn-h2 ')
    }
    return `<h2 class="nn-h2"${attrs}>`
  })

  // Add nn-h3 class to all <h3> tags that don't already have it
  result = result.replace(/<h3(?![^>]*class="[^"]*nn-h3)([^>]*)>/gi, (match, attrs) => {
    if (attrs.includes('class="')) {
      return match.replace(/class="/, 'class="nn-h3 ')
    }
    return `<h3 class="nn-h3"${attrs}>`
  })

  // Add nn-body class to all <p> tags that don't already have an nn- class
  // Skip p tags inside product cards, email gates, meta, etc.
  result = result.replace(/<p(?![^>]*class="[^"]*nn-)([^>]*)>/gi, (match, attrs) => {
    if (attrs.includes('class="')) {
      return match.replace(/class="/, 'class="nn-body ')
    }
    return `<p class="nn-body"${attrs}>`
  })

  // Add nn-h1 class to <h1> tags that don't already have it
  result = result.replace(/<h1(?![^>]*class="[^"]*nn-h1)([^>]*)>/gi, (match, attrs) => {
    if (attrs.includes('class="')) {
      return match.replace(/class="/, 'class="nn-h1 ')
    }
    return `<h1 class="nn-h1"${attrs}>`
  })

  return result
}

// ── Static trust badges HTML (same for every article) ───────────────────────

const TRUST_BADGES_HTML = `<section class="nn-section" style="background:#f8f9fa;border-radius:16px;padding:2.5rem 2rem;margin:3rem 0;">
<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:2rem;align-items:center;">
<div style="text-align:center;min-width:120px;"><div style="width:56px;height:56px;border-radius:50%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;"><span style="color:#fff;font-size:1.4rem;">🔬</span></div><span style="font-family:'Oswald',sans-serif;font-size:0.8rem;font-weight:600;text-transform:uppercase;color:#1a1a1a;">Third Party Tested</span></div>
<div style="text-align:center;min-width:120px;"><div style="width:56px;height:56px;border-radius:50%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;"><span style="color:#fff;font-size:1.4rem;">✦</span></div><span style="font-family:'Oswald',sans-serif;font-size:0.8rem;font-weight:600;text-transform:uppercase;color:#1a1a1a;">No Additives</span></div>
<div style="text-align:center;min-width:120px;"><div style="width:56px;height:56px;border-radius:50%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;"><span style="color:#fff;font-size:1.4rem;">🌿</span></div><span style="font-family:'Oswald',sans-serif;font-size:0.8rem;font-weight:600;text-transform:uppercase;color:#1a1a1a;">GMO Free</span></div>
<div style="text-align:center;min-width:120px;"><div style="width:56px;height:56px;border-radius:50%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;"><span style="color:#fff;font-size:1.4rem;">🚫</span></div><span style="font-family:'Oswald',sans-serif;font-size:0.8rem;font-weight:600;text-transform:uppercase;color:#1a1a1a;">Gluten Free</span></div>
<div style="text-align:center;min-width:120px;"><div style="width:56px;height:56px;border-radius:50%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;"><span style="color:#fff;font-size:1.4rem;">🍃</span></div><span style="font-family:'Oswald',sans-serif;font-size:0.8rem;font-weight:600;text-transform:uppercase;color:#1a1a1a;">No Artificial Sweeteners</span></div>
<div style="text-align:center;min-width:120px;"><div style="width:56px;height:56px;border-radius:50%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;"><span style="color:#fff;font-size:1.4rem;">🌱</span></div><span style="font-family:'Oswald',sans-serif;font-size:0.8rem;font-weight:600;text-transform:uppercase;color:#1a1a1a;">Vegan Options</span></div>
</div>
</section>`

// ── Static author bio HTML ──────────────────────────────────────────────────

const AUTHOR_BIO_HTML = `<section class="nn-section" style="background:#f0f4f8;border-radius:12px;padding:2rem;display:flex;gap:1.5rem;align-items:flex-start;margin:3rem 0;">
<div style="flex-shrink:0;width:72px;height:72px;border-radius:50%;background:#d0d8e0;display:flex;align-items:center;justify-content:center;"><span style="font-size:2rem;color:#4a5568;">NN</span></div>
<div>
<p style="font-family:'Oswald',sans-serif;font-size:1.1rem;font-weight:600;color:#1a1a1a;margin:0 0 0.25rem;">Written by the Naked Nutrition Team</p>
<p style="font-size:0.85rem;color:#00A3FF;font-weight:600;margin:0 0 0.75rem;">Certified Sports Nutritionists</p>
<p style="font-size:0.95rem;line-height:1.6;color:#4a5568;margin:0;">Our team of nutrition experts and certified sports nutritionists research and fact-check every article. We believe in radical transparency — from our ingredients to our content. Every claim is backed by peer-reviewed science.</p>
</div>
</section>`

// ── Build immersive product CTA for #1 recommended product ──────────────────

function buildProductHeroHtml(
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
  categoryLabel: string
): string {
  const productUrl = product.handle ? `/products/${product.handle}` : (product.url || "#")
  const features = extractFeatures(product)

  const imageHtml = product.imageUrl
    ? `<img src="${product.imageUrl}" alt="${product.title}" loading="lazy" />`
    : `<span style="color:rgba(255,255,255,0.3);font-size:3rem;">📦</span>`

  let priceHtml = ""
  if (product.price) {
    const numPrice = parseFloat(product.price)
    if (!isNaN(numPrice) && numPrice > 0) {
      const formatted = numPrice % 1 === 0
        ? numPrice.toLocaleString("en-US")
        : numPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      priceHtml = `<div class="nn-product-hero-price">$${formatted}</div>`
    }
  }

  const featureBullets = features
    .map((f) => `<li>${f}</li>`)
    .join("\n")

  return `<section class="nn-product-hero">
<div class="nn-product-hero-image">${imageHtml}</div>
<div class="nn-product-hero-content">
<span class="nn-product-hero-badge">Editor's Top Pick</span>
<h3>${product.title}</h3>
<div class="nn-product-hero-stars">★★★★★ <span style="color:rgba(255,255,255,0.6);font-size:0.85rem;">4.8/5</span></div>
<ul class="nn-product-hero-features">
${featureBullets}
</ul>
${priceHtml}
<a class="nn-cta" href="${productUrl}">Shop ${getShortName(product.title)}</a>
</div>
</section>`
}

// ── Build customer testimonials section ──────────────────────────────────────

function buildTestimonialsHtml(categoryLabel: string): string {
  // Static testimonials — category-aware messaging
  const testimonials = [
    {
      stars: 5,
      quote: `The quality is unmatched. I've tried dozens of ${categoryLabel.toLowerCase()} products and nothing comes close to Naked Nutrition's transparency and purity.`,
      author: "Michael R.",
      verified: true,
    },
    {
      stars: 5,
      quote: "Finally a brand that lists every single ingredient with no proprietary blends. The results speak for themselves — I've seen real gains since switching.",
      author: "Sarah K.",
      verified: true,
    },
    {
      stars: 5,
      quote: "Clean ingredients, fast shipping, and excellent customer service. I recommend Naked Nutrition to everyone at my gym.",
      author: "James T.",
      verified: true,
    },
  ]

  const cards = testimonials.map((t) => `<div class="nn-testimonial-card">
<div class="nn-testimonial-stars">${"★".repeat(t.stars)}${"☆".repeat(5 - t.stars)}</div>
<p class="nn-testimonial-quote">"${t.quote}"</p>
<p class="nn-testimonial-author">${t.author}</p>
${t.verified ? `<p class="nn-testimonial-verified">✓ Verified Buyer</p>` : ""}
</div>`).join("\n")

  return `<section class="nn-testimonials">
<h2>What Our Customers Say</h2>
<div class="nn-testimonials-grid">
${cards}
</div>
</section>`
}

// ── Build video embed section ────────────────────────────────────────────────

function buildVideoEmbedHtml(videoUrl: string, title: string): string {
  if (!videoUrl) return ""

  // Extract YouTube video ID
  let videoId = ""
  const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) {
    videoId = ytMatch[1]
  }

  if (!videoId) {
    // Try Vimeo
    const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) {
      return `<div class="nn-video-embed">
<iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${title}"></iframe>
</div>`
    }
    return "" // Unsupported video URL
  }

  // YouTube embed with VideoObject schema
  return `<div class="nn-video-embed">
<iframe src="https://www.youtube.com/embed/${videoId}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="${title}"></iframe>
</div>
<script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: title,
  embedUrl: `https://www.youtube.com/embed/${videoId}`,
  thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
}, null, 2)}
</script>`
}

// ── Build scientific references section from citations ───────────────────────

function buildReferencesHtml(citations: { url: string; title?: string; author?: string; notes?: string }[]): string {
  if (!citations || citations.length === 0) return ""
  const refs = citations.map((c, i) => {
    const titleText = c.title || new URL(c.url).hostname.replace("www.", "")
    const authorText = c.author ? `${c.author}. ` : ""
    return `<li style="margin-bottom:0.75rem;font-size:0.95rem;line-height:1.5;color:#4a5568;">
<span style="font-weight:600;color:#1a1a1a;">[${i + 1}]</span> ${authorText}<a href="${c.url}" class="nn-links" target="_blank" rel="noopener">${titleText}</a>${c.notes ? ` — <em>${c.notes}</em>` : ""}
</li>`
  })
  return `<section class="nn-section" style="border-left:4px solid #1a1a1a;background:#f8f9fa;padding:2rem;border-radius:0 12px 12px 0;margin:3rem 0;">
<h2 class="nn-h2" style="font-size:1.6rem;margin-top:0;">Scientific References</h2>
<ol style="padding-left:0;list-style:none;margin:0;">
${refs.join("\n")}
</ol>
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

    // ── Generate proper title (not raw keyword) ──────────────────────────────
    // If titleTag looks like a real title (has capitals, >30 chars), use it.
    // Otherwise generate one from the keyword.
    const hasProperTitle = titleTag && titleTag !== keyword && /[A-Z]/.test(titleTag) && titleTag.length > 20
    let title = titleTag || keyword
    if (!hasProperTitle) {
      const titlePrompt = `Write a compelling, SEO-optimized article title for the keyword "${keyword}" in the ${categoryLabel} category for Naked Nutrition's blog. The title should be engaging, include the keyword naturally, and be under 70 characters. Return ONLY the title text, no quotes or explanation.`
      const generatedTitle = await callAI("You write SEO article titles.", titlePrompt, { maxTokens: 80 })
      title = generatedTitle.replace(/^["']|["']$/g, "").trim() || titleTag || keyword
    }

    // ── Generate subtitle + quick answer in parallel ───────────────────────

    const subtitlePrompt = `Write a single compelling subtitle sentence (under 150 chars) for an article titled "${title}" about ${keyword}. Return ONLY the sentence, no quotes.`
    const quickAnswerPrompt = `You are answering a reader's question for Naked Nutrition's blog. The article title is "${title}" about ${keyword} in the ${categoryLabel} category.

Write a single, direct 1-2 sentence answer to the implied question. Make the KEY phrase (the actual answer) wrapped in <strong> tags. Keep it under 100 words total. Return ONLY the answer HTML, no explanation.

Example format: "Yes, <strong>creatine is safe to take without working out</strong> and can still provide cognitive and general health benefits, though the muscle-building effects are maximized when paired with resistance training."`

    const [subtitle, quickAnswerRaw] = await Promise.all([
      callAI("You write concise article subtitles.", subtitlePrompt, { maxTokens: 100 }),
      body.quickAnswer
        ? Promise.resolve(body.quickAnswer)
        : callAI("You write direct, expert answers for nutrition articles.", quickAnswerPrompt, { maxTokens: 200 }),
    ])

    // ── Load products from DB (cold-start safe) ─────────────────────────────

    const products = includeProducts
      ? await getProductRecommendationsFromDB(category, 4)
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

    const heroImageHtml = body.heroImageUrl
      ? `<img class="nn-hero-image" src="${body.heroImageUrl}" alt="${title}" />`
      : `<div class="nn-hero-placeholder"><!-- HERO_IMAGE: ${keyword} --></div>`

    const overviewHtml = `<section id="overview" class="nn-section">
<div class="nn-kicker">${categoryLabel}</div>
<h1>${title}</h1>
<p class="nn-subtitle">${subtitle.trim()}</p>
<div class="nn-meta"><span>By Naked Nutrition</span><span class="nn-dot"></span><span>${readTime} min read</span></div>
${heroImageHtml}
</section>`

    // ── Quick Answer box ─────────────────────────────────────────────────────

    const cleanedQuickAnswer = quickAnswerRaw
      .replace(/^["']|["']$/g, "")
      .replace(/```html?\n?/g, "")
      .replace(/```/g, "")
      .trim()

    const quickAnswerHtml = `<div class="nn-quick-answer">
<div class="nn-quick-answer-header"><span>⚡</span> Quick Answer</div>
<div class="nn-quick-answer-text">${cleanedQuickAnswer}</div>
</div>`

    // ── Video embed (if provided) ────────────────────────────────────────────

    const videoHtml = body.videoUrl ? buildVideoEmbedHtml(body.videoUrl, title) : ""

    // ── Featured Products section (deterministic HTML) ───────────────────────
    // Split: immersive hero for #1 product + grid cards for alternatives

    let productHeroHtml = ""
    let productsGridHtml = ""
    if (includeProducts && products.length > 0) {
      // Immersive dark CTA for the top product
      productHeroHtml = buildProductHeroHtml(products[0], categoryLabel)

      // Grid cards for remaining products (2-4)
      if (products.length > 1) {
        const alternateProducts = products.slice(1, 4)
        const cards = alternateProducts
          .map((p, i) => buildProductCard(p, i + 1, products))
          .join("\n")
        productsGridHtml = `\n<section id="featured-products" class="nn-section">
<h2 class="nn-center">More ${categoryLabel} Options</h2>
<div class="nn-grid cols-${Math.min(alternateProducts.length, 3)}">
${cards}
</div>
</section>`
      }
    }

    // Insert product hero after Key Takeaways (first </section>), grid cards after second section
    let bodyWithProducts = processedContent
    if (productHeroHtml) {
      const firstSectionEnd = processedContent.indexOf("</section>")
      if (firstSectionEnd !== -1) {
        const insertAt = firstSectionEnd + "</section>".length
        bodyWithProducts =
          processedContent.slice(0, insertAt) + productHeroHtml + processedContent.slice(insertAt)
      } else {
        bodyWithProducts = productHeroHtml + processedContent
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

    // ── Scientific References section (from citations) ─────────────────────

    const referencesHtml = buildReferencesHtml(body.citations || [])

    // ── Customer testimonials ────────────────────────────────────────────────

    const testimonialsHtml = buildTestimonialsHtml(categoryLabel)

    // ══════════════════════════════════════════════════════════════════════════
    // FINAL ASSEMBLY
    // ══════════════════════════════════════════════════════════════════════════

    // Assemble all sections, then post-process to add nn- classes
    const assembledHtml = `${NN_STYLES}

<div class="nn-wrap" style="text-align: start;">
<article class="nn-container nn-article" itemscope itemtype="https://schema.org/Article">

${navHtml}

${overviewHtml}
${quickAnswerHtml}
${bodyWithProducts}
${videoHtml}
${productsGridHtml}
${TRUST_BADGES_HTML}
${testimonialsHtml}
${faqHtml}
${referencesHtml}
${AUTHOR_BIO_HTML}
${relatedHtml}
${ctaHtml}

</article>
</div>
${faqSchema.length > 0 ? `\n<script type="application/ld+json">\n${faqSchema}\n</script>` : ""}`

    // Post-process: add nn-body/nn-h1/nn-h2/nn-h3 classes to all plain tags
    const finalHtml = postProcessHtml(assembledHtml).trim()

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

    logActivity("Revamp finalized", {
      category: "revamp",
      detail: titleTag || "Unknown",
    });

    return NextResponse.json({ article })
  } catch (error) {
    console.error("[revamp/generate/finalize] Error:", error)
    logActivity("Revamp finalization failed", {
      category: "revamp",
      status: "error",
      detail: "Finalization failed",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to finalize article" },
      { status: 500 }
    )
  }
}
