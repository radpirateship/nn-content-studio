import { type NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── Badge helpers (mirrors generate/route.ts) ────────────────────────────────

const BADGE_BEST_VALUE   = { label: "Best Value",       color: "#16a34a" };
const BADGE_EDITORS_PICK = { label: "Editor's Pick",    color: "#dc2626" };
const BADGE_PREMIUM      = { label: "Premium Formula",  color: "#9333ea" };
const BADGE_PRO_LEVEL    = { label: "Pro-Level",        color: "#ea580c" };

function assignBadge(
  products: { price?: string }[],
  index: number
): { label: string; color: string } {
  if (products.length <= 1) return BADGE_EDITORS_PICK;
  const ranked = products
    .map((p, i) => ({ i, price: parseFloat(p.price || "0") || 0 }))
    .sort((a, b) => a.price - b.price);
  const rank = ranked.findIndex((r) => r.i === index);
  const total = ranked.length;
  if (rank === 0) return BADGE_BEST_VALUE;
  if (rank === total - 1) return BADGE_PRO_LEVEL;
  if (rank === 1) return BADGE_EDITORS_PICK;
  return BADGE_PREMIUM;
}

function getShortName(title: string): string {
  const cleaned = title
    .replace(/^(optimum nutrition|muscletech|cellucor|gaspari|xtend|isoflex|isopure)\s+/i, "")
    .replace(/\s+(powder|blend|formula|complex|stack|ultra|pro|elite)\s*$/i, "")
    .trim();
  return cleaned.split(/\s+/).slice(0, 3).join(" ") || title.split(/\s+/).slice(0, 2).join(" ");
}

function extractFeatures(product: { title: string; description?: string; tags?: string }): string[] {
  const combined = `${product.title} ${product.description || ""} ${product.tags || ""}`.toLowerCase();
  const featureMap: [RegExp, string][] = [
    [/whey[\s-]?protein|whey/i, "Whey Protein Base"],
    [/casein[\s-]?protein|casein/i, "Casein Protein"],
    [/plant[\s-]?based|vegan|pea[\s-]?protein/i, "Plant-Based Protein"],
    [/isolate/i, "Protein Isolate"],
    [/bca[a]|branched[\s-]?chain/i, "BCAA Formula"],
    [/creatine[\s-]?monohydrate/i, "Creatine Monohydrate"],
    [/creatine/i, "Creatine Formula"],
    [/caffeine|stimulant/i, "Caffeine Boost"],
    [/beta[\s-]?alanine/i, "Beta-Alanine"],
    [/citrulline|pump|nitric[\s-]?oxide/i, "Nitric Oxide Booster"],
    [/glutamine/i, "L-Glutamine"],
    [/collagen|peptides/i, "Hydrolyzed Collagen"],
    [/omega[\s-]?3|fish[\s-]?oil/i, "Omega-3 Fish Oil"],
    [/probiotics?/i, "Probiotic Cultures"],
    [/digestive[\s-]?enzyme/i, "Digestive Enzymes"],
    [/vegan|dairy[\s-]?free|gluten[\s-]?free/i, "Dietary Certified"],
    [/nsf[\s-]?certified|third[\s-]?party|informed[\s-]?choice/i, "Third-Party Tested"],
    [/sugar[\s-]?free|zero[\s-]?sugar/i, "Zero Sugar"],
    [/keto|low[\s-]?carb/i, "Keto-Friendly"],
  ];
  const features: string[] = [];
  for (const [pattern, label] of featureMap) {
    if (pattern.test(combined) && features.length < 3) {
      if (!features.includes(label)) features.push(label);
    }
  }
  while (features.length < 3) {
    const fallbacks = ["Quality Verified", "Expert Nutrition Support", "Evidence-Based Formulas"];
    const next = fallbacks.find((f) => !features.includes(f));
    if (!next) break;
    features.push(next);
  }
  features.unshift("Free Shipping Included");
  return features.slice(0, 4);
}

// ── Card + section builder ───────────────────────────────────────────────────

type ProductInput = {
  title: string;
  description?: string;
  price?: string;
  imageUrl?: string;
  url?: string;
  handle?: string;
  vendor?: string;
  tags?: string;
};

function buildProductCard(product: ProductInput, index: number, all: ProductInput[]): string {
  const badge = assignBadge(all, index);
  const productUrl = product.handle ? `/products/${product.handle}` : (product.url || "#");
  const shortName = getShortName(product.title);
  const features = extractFeatures(product);

  const imageHtml = product.imageUrl
    ? `<div class="nn-product-image-container"><img src="${product.imageUrl}" alt="${product.title}" class="nn-product-image" loading="lazy" /></div>`
    : "";

  let priceHtml = "";
  if (product.price) {
    const n = parseFloat(product.price);
    if (!isNaN(n) && n > 0) {
      const fmt = n % 1 === 0
        ? n.toLocaleString("en-US")
        : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      priceHtml = `<p style="font-weight:800;font-size:1.6rem;color:${badge.color};margin:0.5rem 0;">$${fmt}</p>`;
    }
  }

  const bullets = features
    .map((f, i) => (i === 0 ? `<li>✓ <strong>${f}</strong></li>` : `<li>✓ ${f}</li>`))
    .join("\n");

  return `<div class="nn-product-card" style="border-color:${badge.color};">
<span class="nn-badge" style="background:${badge.color};align-self:flex-start;margin-bottom:1rem;">${badge.label}</span>
${imageHtml}
<h3>${product.title}</h3>
${priceHtml}
<ul>
${bullets}
</ul>
<div style="margin-top:auto;"><a class="nn-cta" href="${productUrl}">View ${shortName}</a></div>
</div>`;
}

function buildProductSection(products: ProductInput[], categoryLabel = "Product"): string {
  const display = products.slice(0, 4);
  const cards = display.map((p, i) => buildProductCard(p, i, display)).join("\n");
  return `<section id="featured-products" class="nn-section">
<h2 class="nn-center">Top ${categoryLabel} Picks</h2>
<p style="margin-bottom:3rem;color:#666;font-size:1.6rem;" class="nn-center">Evidence-based formulas with free shipping included and expert nutrition support.</p>
<div class="nn-grid cols-2">
${cards}
</div>
</section>`;
}

// ── Inject into existing HTML ────────────────────────────────────────────────

function injectProductSection(html: string, sectionHtml: string): string {
  // Replace existing featured-products section
  const existingRe = /<section[^>]*id=["']featured-products["'][^>]*>[\s\S]*?<\/section>/i;
  if (existingRe.test(html)) {
    return html.replace(existingRe, sectionHtml);
  }
  // Insert after first closing </section> (after key-takeaways)
  const insertAfterFirst = html.replace(/<\/section>/, `</section>\n${sectionHtml}`);
  if (insertAfterFirst !== html) return insertAfterFirst;
  // Fallback: prepend
  return sectionHtml + "\n" + html;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, products, categoryLabel } = body as {
      id: number;
      products: ProductInput[];
      categoryLabel?: string;
    };

    if (!id || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: "id and non-empty products array required" }, { status: 400 });
    }

    const sql = getSQL();

    // Fetch current article HTML
    const rows = await sql`SELECT html_content FROM articles WHERE id = ${id}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const currentHtml: string = rows[0].html_content || "";
    const sectionHtml = buildProductSection(products, categoryLabel || "Product");
    const updatedHtml = injectProductSection(currentHtml, sectionHtml);

    // Persist updated HTML + products
    await sql`
      UPDATE articles
      SET
        html_content = ${updatedHtml},
        products     = ${JSON.stringify(products)}::jsonb,
        updated_at   = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, html_content: updatedHtml });
  } catch (error) {
    console.error("[inject-products]", error);
    return NextResponse.json({ error: "Failed to inject products" }, { status: 500 });
  }
}
