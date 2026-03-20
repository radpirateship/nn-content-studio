import { type NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { CATEGORY_LABELS, type NNCategory } from "@/lib/nn-categories";

export const maxDuration = 120;

/**
 * POST /api/workshop/regenerate
 *
 * Section-level regeneration router for the Article Workshop.
 * Takes the article context and a section identifier, returns new HTML for just that section.
 *
 * Body: {
 *   section: 'faq' | 'meta' | 'intro' | 'conclusion' | 'links' | 'products' | 'tags',
 *   article: {
 *     id: number,
 *     title: string,
 *     handle: string,
 *     body_html: string,
 *     tags: string,
 *     summary_html?: string,
 *     category?: string,
 *   },
 *   options?: Record<string, unknown>  // section-specific options
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { section, article, options } = await request.json();

    if (!section || !article) {
      return NextResponse.json(
        { error: "section and article are required" },
        { status: 400 }
      );
    }

    const category = article.category || detectCategory(article.tags || "");
    const categoryLabel = CATEGORY_LABELS[category as NNCategory] || category || "Nutrition";

    switch (section) {
      case "faq":
        return await regenerateFaq(article, categoryLabel);

      case "meta":
        return await regenerateMeta(article, categoryLabel);

      case "intro":
        return await regenerateIntro(article, categoryLabel);

      case "conclusion":
        return await regenerateConclusion(article, categoryLabel);

      case "links":
        return await regenerateLinks(article, category);

      case "products":
        return await regenerateProducts(article, category, categoryLabel);

      case "tags":
        return await regenerateTags(article, category, categoryLabel);

      default:
        return NextResponse.json(
          { error: `Unknown section: ${section}. Valid: faq, meta, intro, conclusion, links, products, tags` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[workshop/regenerate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate section" },
      { status: 500 }
    );
  }
}

// ============================================================================
// SECTION HANDLERS
// ============================================================================

async function regenerateFaq(
  article: { title: string; body_html: string; tags: string },
  categoryLabel: string
) {
  const systemPrompt = `You are a Senior Content Editor at Naked Nutrition. Generate ONLY an FAQ section for an article. Output ONLY the HTML below â no explanation, no markdown, no wrapping tags.

FORMAT (use this EXACT structure):
<section id="faq" class="ppw-section">
<h2>Frequently Asked Questions</h2>
<div class="ppw-faq-list">
<details class="ppw-faq-item"><summary class="ppw-faq-question">Question?</summary><div class="ppw-faq-answer"><p>Answer paragraph.</p></div></details>
</div>
</section>

RULES:
- Write exactly 8 high-quality questions a reader would actually ask
- Each answer should be 2-3 sentences, informative and specific
- Questions should cover different aspects (benefits, safety, cost, setup, maintenance, etc.)
- Do NOT use markdown syntax â HTML only
- Do NOT include any content outside the <section> tags`;

  const userPrompt = `Write an FAQ section for this article:
TITLE: ${article.title}
CATEGORY: ${categoryLabel}
EXISTING TAGS: ${article.tags}`;

  let faqHtml = await callAI(systemPrompt, userPrompt, { maxTokens: 2000 });
  faqHtml = faqHtml.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();

  return NextResponse.json({ section: "faq", html: faqHtml, success: true });
}

async function regenerateMeta(
  article: { title: string; body_html: string },
  categoryLabel: string
) {
  const bodyText = (article.body_html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 500);

  const systemPrompt = `You write SEO meta descriptions for Naked Nutrition articles. Return ONLY the meta description text â no quotes, no HTML, no explanation. Keep it under 155 characters.`;

  const userPrompt = `Write a compelling meta description for:
TITLE: ${article.title}
CATEGORY: ${categoryLabel}
CONTENT PREVIEW: ${bodyText}`;

  const meta = await callAI(systemPrompt, userPrompt, { maxTokens: 100 });

  return NextResponse.json({
    section: "meta",
    summary_html: meta.trim().slice(0, 160),
    success: true,
  });
}

async function regenerateIntro(
  article: { title: string; body_html: string; tags: string },
  categoryLabel: string
) {
  const systemPrompt = `You are a Senior Content Editor at Naked Nutrition. Rewrite ONLY the Key Takeaways section for an existing article. Output the exact HTML structure â no explanation, no markdown.

FORMAT:
<section class="ppw-section ppw-muted">
<h2>Key Takeaways</h2>
<ul><li><strong>Label:</strong> description</li>...</ul>
</section>

RULES:
- 4-6 bullet points summarizing the most important points from the article
- Each bullet starts with a bold label
- Based on the actual article content, not generic filler`;

  const bodyText = (article.body_html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 2000);

  const userPrompt = `Rewrite the Key Takeaways for:
TITLE: ${article.title}
CATEGORY: ${categoryLabel}
ARTICLE CONTENT: ${bodyText}`;

  let html = await callAI(systemPrompt, userPrompt, { maxTokens: 1000 });
  html = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();

  return NextResponse.json({ section: "intro", html, success: true });
}

async function regenerateConclusion(
  article: { title: string; body_html: string; tags: string },
  categoryLabel: string
) {
  const systemPrompt = `You are a Senior Content Editor at Naked Nutrition. Write a conclusion section for an existing article. Output ONLY the HTML â no explanation, no markdown.

FORMAT:
<section id="final-thoughts" class="ppw-section">
<h2>Final Thoughts</h2>
<p>...</p>
<p>...</p>
</section>

RULES:
- 2-3 paragraphs wrapping up the article's key points
- Include a call-to-action encouraging the reader to explore Naked Nutrition products
- Professional, helpful tone`;

  const bodyText = (article.body_html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 2000);

  const userPrompt = `Write a conclusion for:
TITLE: ${article.title}
CATEGORY: ${categoryLabel}
ARTICLE CONTENT: ${bodyText}`;

  let html = await callAI(systemPrompt, userPrompt, { maxTokens: 800 });
  html = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();

  return NextResponse.json({ section: "conclusion", html, success: true });
}

async function regenerateLinks(
  article: { title: string; body_html: string; tags: string },
  category: string
) {
  // Delegate to the existing add-links API internally
  // First, fetch internal links from topical authority
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const taUrl = category
      ? `${baseUrl}/api/resources?type=topical-authority&collection=${encodeURIComponent(category)}`
      : `${baseUrl}/api/resources?type=topical-authority`;

    const taResponse = await fetch(taUrl);
    if (!taResponse.ok) {
      return NextResponse.json(
        { error: "Could not fetch topical authority data for link injection" },
        { status: 500 }
      );
    }

    const taData = await taResponse.json();
    const allTopics = taData.items || [];
    const internalLinks = allTopics
      .filter((t: { existingUrl: string; title: string }) => t.existingUrl && t.title.toLowerCase() !== article.title.toLowerCase())
      .slice(0, 12)
      .map((t: { title: string; existingUrl: string }) => ({
        title: t.title,
        url: t.existingUrl,
      }));

    if (internalLinks.length === 0) {
      return NextResponse.json({
        section: "links",
        html: article.body_html,
        linkCount: 0,
        message: "No internal links available for this category",
        success: true,
      });
    }

    // Call the existing add-links API
    const linkResponse = await fetch(`${baseUrl}/api/articles/add-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        htmlContent: article.body_html,
        internalLinks,
      }),
    });

    if (!linkResponse.ok) {
      const errData = await linkResponse.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to inject links");
    }

    const linkData = await linkResponse.json();
    return NextResponse.json({
      section: "links",
      html: linkData.htmlContent,
      linkCount: linkData.linkCount || 0,
      success: true,
    });
  } catch (error) {
    console.error("[workshop/regenerate] Links error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate links" },
      { status: 500 }
    );
  }
}

async function regenerateProducts(
  article: { title: string; body_html: string; tags: string },
  category: string,
  categoryLabel: string
) {
  // Fetch products for this category via existing products API
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const searchParam = encodeURIComponent(article.title);
    const productsResponse = await fetch(
      `${baseUrl}/api/products?category=${category}&search=${searchParam}&limit=4`
    );

    if (!productsResponse.ok) {
      return NextResponse.json(
        { error: "Could not fetch products for this category" },
        { status: 500 }
      );
    }

    const productsData = await productsResponse.json();
    const products = productsData.products || [];

    if (products.length === 0) {
      return NextResponse.json({
        section: "products",
        html: "",
        message: "No products found for this category",
        success: true,
      });
    }

    // Build product card HTML matching the main generate route
    const displayProducts = products.slice(0, 4);
    const cards = displayProducts.map((p: { title: string; description?: string; price?: string; imageUrl?: string; url?: string; handle?: string; vendor?: string; tags?: string }, i: number) => buildProductCard(p, i, displayProducts)).join("\n");
    const productsHtml = `<section id="featured-products" class="ppw-section">
<h2 class="ppw-center">Top ${categoryLabel} Picks</h2>
<p style="margin-bottom:3rem;color:#666;font-size:1.6rem;" class="ppw-center">Premium quality with white-glove delivery included, pre-delivery inspection, and expert support.</p>
<div class="ppw-grid cols-2">
${cards}
</div>
</section>`;

    return NextResponse.json({
      section: "products",
      html: productsHtml,
      productCount: displayProducts.length,
      success: true,
    });
  } catch (error) {
    console.error("[workshop/regenerate] Products error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch products" },
      { status: 500 }
    );
  }
}

async function regenerateTags(
  article: { title: string; body_html: string; tags: string },
  category: string,
  categoryLabel: string
) {
  // Auto-generate proper tags based on content and category
  const ARTICLE_TYPES = [
    "Buyer's Guide", "Comparison", "How-To", "Deep Dive",
    "Ultimate Guide", "Listicle", "Brand Review", "Celebrity", "Exercise Science",
  ];

  const CATEGORY_TAGS: Record<string, string> = {
    "protein-powder": "Protein",
    "whey-protein": "Protein",
    "vegan-protein-powder": "Protein",
    "collagen-peptides": "Collagen",
    "overnight-oats": "Nutrition",
    "improve-performance-recovery": "Performance",
    "supplements": "Supplements",
    "kids": "Kids",
    // NNCategory fallbacks
    "creatine": "Supplements",
    "pre-workout": "Performance",
    "post-workout": "Performance",
    "bcaa": "Supplements",
    "collagen": "Collagen",
    "greens": "Supplements",
    "fiber": "Supplements",
    "vitamins": "Supplements",
    "probiotics": "Supplements",
    "energy": "Supplements",
    "weight-management": "Supplements",
    "keto": "Supplements",
    "vegan": "Protein",
    "general-nutrition": "Nutrition",
  };

  const parentCategory = CATEGORY_TAGS[category] || "Supplements";

  // Use AI to determine the article type
  const systemPrompt = `You classify nutrition and supplement articles into exactly one type. Return ONLY the type name — no explanation.
Types: ${ARTICLE_TYPES.join(", ")}`;

  const bodyText = (article.body_html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 1000);

  const userPrompt = `Classify this article:
TITLE: ${article.title}
CONTENT: ${bodyText}`;

  const articleType = await callAI(systemPrompt, userPrompt, { maxTokens: 50 });
  const cleanType = articleType.trim();
  const matchedType = ARTICLE_TYPES.find(
    (t) => t.toLowerCase() === cleanType.toLowerCase()
  ) || "Deep Dive";

  // Build tag string: parent category, subcategory label, article type
  const tags = [parentCategory, categoryLabel, matchedType].filter(Boolean);
  const tagString = [...new Set(tags)].join(", ");

  return NextResponse.json({
    section: "tags",
    tags: tagString,
    breakdown: { parentCategory, subcategory: categoryLabel, articleType: matchedType },
    success: true,
  });
}

// ============================================================================
// HELPERS
// ============================================================================


// ============================================================================
// PRODUCT CARD HELPERS (matches generate/route.ts)
// ============================================================================

const BADGE_CHEAPEST = { label: "Great Starting Point", color: "#16a34a" };
const BADGE_TOP_PICK = { label: "Top Pick", color: "#dc2626" };
const BADGE_PREMIUM = { label: "Premium Choice", color: "#9333ea" };
const BADGE_COMMERCIAL = { label: "Commercial Grade", color: "#ea580c" };

function assignBadge(products: { price?: string }[], index: number): { label: string; color: string } {
  if (products.length <= 1) return BADGE_TOP_PICK;
  const priceRanked = products
    .map((p, i) => ({ i, price: parseFloat(p.price || '0') || 0 }))
    .sort((a, b) => a.price - b.price);
  const rank = priceRanked.findIndex(r => r.i === index);
  const total = priceRanked.length;
  if (rank === 0) return BADGE_CHEAPEST;
  if (rank === total - 1) return BADGE_COMMERCIAL;
  if (rank === 1) return BADGE_TOP_PICK;
  return BADGE_PREMIUM;
}

function getShortName(title: string): string {
  const cleaned = title
    .replace(/^(naked nutrition|naked|nn)\s+/i, '')
    .replace(/\s+(powder|protein|supplement|formula|blend|complex)\s*$/i, '')
    .trim();
  const words = cleaned.split(/\s+/).slice(0, 3);
  return words.join(' ') || title.split(/\s+/).slice(0, 2).join(' ');
}

function extractFeatures(product: { title: string; description?: string; tags?: string; vendor?: string }): string[] {
  const features: string[] = [];
  const desc = (product.description || '').toLowerCase();
  const tags = (product.tags || '').toLowerCase();
  const title = (product.title || '').toLowerCase();
  const combined = `${title} ${desc} ${tags}`;

  // Supplement-specific feature detection
  const featureMap: [RegExp, string][] = [
    [/third.party[\s-]?test|nsf|informed[\s-]?sport|informed[\s-]?choice/i, 'Third-Party Tested'],
    [/grass.?fed/i, 'Grass-Fed Whey'],
    [/cold[\s-]?process/i, 'Cold-Processed'],
    [/no[\s-]?artificial|all[\s-]?natural|clean[\s-]?ingredient/i, 'No Artificial Ingredients'],
    [/gluten[\s-]?free/i, 'Gluten-Free'],
    [/sugar[\s-]?free|zero[\s-]?sugar/i, 'Sugar-Free'],
    [/vegan|plant[\s-]?based/i, 'Plant-Based'],
    [/whey[\s-]?isolate/i, 'Whey Isolate'],
    [/whey[\s-]?concentrate/i, 'Whey Concentrate'],
    [/hydrolyz/i, 'Hydrolyzed Protein'],
    [/microniz/i, 'Micronized Formula'],
    [/clinically[\s-]?dos/i, 'Clinically Dosed'],
    [/non[\s-]?gmo/i, 'Non-GMO'],
    [/keto/i, 'Keto-Friendly'],
    [/collagen|peptide/i, 'Collagen Peptides'],
  ];

  for (const [pattern, label] of featureMap) {
    if (pattern.test(combined) && features.length < 3) {
      if (!features.includes(label)) features.push(label);
    }
  }

  const genericFeatures = ['Free Shipping on Orders $99+', 'USA Manufactured', 'Money-Back Guarantee'];
  for (const gf of genericFeatures) {
    if (features.length >= 3) break;
    features.push(gf);
  }

  const trimmed = features.slice(0, 3);
  trimmed.push('30-Day Return Policy');
  return trimmed;
}

function buildProductCard(product: {
  title: string;
  description?: string;
  price?: string;
  imageUrl?: string;
  url?: string;
  handle?: string;
  vendor?: string;
  tags?: string;
}, index: number, allProducts: { price?: string }[]): string {
  const badge = assignBadge(allProducts, index);
  const productUrl = product.handle ? `/products/${product.handle}` : (product.url || "#");
  const shortName = getShortName(product.title);
  const features = extractFeatures(product);

  const imageHtml = product.imageUrl
    ? `<div class="ppw-product-image-container"><img src="${product.imageUrl}" alt="${product.title}" class="ppw-product-image" loading="lazy" /></div>`
    : "";

  let priceHtml = "";
  if (product.price) {
    const numPrice = parseFloat(product.price);
    if (!isNaN(numPrice) && numPrice > 0) {
      const formatted = numPrice % 1 === 0
        ? numPrice.toLocaleString('en-US')
        : numPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      priceHtml = `<p style="font-weight:800;font-size:1.6rem;color:${badge.color};margin:0.5rem 0;">$${formatted}</p>`;
    }
  }

  const featureBullets = features.map((f, i) =>
    i === 0
      ? `<li>\u2705 <strong>${f}</strong></li>`
      : `<li>\u2705 ${f}</li>`
  ).join("\n");

  return `<div class="ppw-product-card" style="border-color:${badge.color};">
<span class="ppw-badge" style="background:${badge.color};align-self:flex-start;margin-bottom:1rem;">${badge.label}</span>
${imageHtml}
<h3>${product.title}</h3>
${priceHtml}
<ul>
${featureBullets}
</ul>
<div style="margin-top:auto;"><a class="ppw-cta" href="${productUrl}">View ${shortName}</a></div>
</div>`;
}
function detectCategory(tags: string): string {
  const tagsLower = tags.toLowerCase();
  const categoryMap: [string, string][] = [
    ["whey protein", "whey-protein"],
    ["casein protein", "protein-powder"],
    ["pea protein", "vegan-protein-powder"],
    ["vegan protein", "vegan-protein-powder"],
    ["plant protein", "vegan-protein-powder"],
    ["protein powder", "protein-powder"],
    ["protein", "protein-powder"],
    ["collagen", "collagen-peptides"],
    ["overnight oats", "overnight-oats"],
    ["oats", "overnight-oats"],
    ["creatine", "supplements"],
    ["pre-workout", "improve-performance-recovery"],
    ["pre workout", "improve-performance-recovery"],
    ["post-workout", "improve-performance-recovery"],
    ["bcaa", "supplements"],
    ["greens", "supplements"],
    ["vitamins", "supplements"],
    ["probiotics", "supplements"],
    ["energy", "supplements"],
    ["weight management", "supplements"],
    ["keto", "supplements"],
    ["kids", "kids"],
    ["recovery", "improve-performance-recovery"],
    ["performance", "improve-performance-recovery"],
  ];

  for (const [keyword, cat] of categoryMap) {
    if (tagsLower.includes(keyword)) return cat;
  }

  // Check parent categories
  if (tagsLower.includes("fitness")) return "improve-performance-recovery";
  if (tagsLower.includes("nutrition")) return "general-nutrition";
  if (tagsLower.includes("supplement")) return "supplements";

  return "general-nutrition";
}
