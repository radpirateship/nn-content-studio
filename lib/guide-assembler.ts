/**
 * guide-assembler.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for assembling a complete, publish-ready PPW Ultimate
 * Guide HTML page from its generated section fragments.
 *
 * Called by:
 *   - guide-content-generator.tsx  (after content is generated)
 *   - guide-image-storyboard.tsx   (after images are injected into sections)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { upgradeImagesToPicture } from './imageUtils'

export interface AssemblerProduct {
  title: string
  handle: string
  image_url: string
  price: number | string
  vendor: string
  selected_role?: 'best-value' | 'best-upgrade'
  selected_subcategory?: string
}

export interface AssemblerClusterLink {
  title: string
  slug: string
  url?: string
  anchor?: string
}

export interface AssemblerGuide {
  title: string
  slug: string
  topic_short: string
  topic_short_plural?: string
  topic_full?: string
  meta_description?: string
  breadcrumb_l2_name?: string
  breadcrumb_l2_slug?: string
  collection_slug?: string
  hero_image_cdn_url?: string
  hero_image_url?: string
  date_published?: string
  read_time_mins?: number
  related_guides?: Array<{ title: string; slug: string; description?: string }>
  selected_products?: AssemblerProduct[]
  cluster_links?: Array<{ url: string; anchor: string }>
}

// ─── Section metadata ───────────────────────────────────────────────────────

export const GUIDE_SECTION_ORDER = [
  'key-takeaways',
  'what-is',
  'how-it-works',
  'types',
  'health-benefits',
  'how-to-use',
  'safety',
  'featured-products',
  'faq',
] as const

export type GuideSectionKey = typeof GUIDE_SECTION_ORDER[number]

function getSectionLabel(key: string, topicShort: string, topicShortPlural: string, topicFull: string): string {
  const map: Record<string, string> = {
    'key-takeaways':    'key takeaways',
    'what-is':          `what is ${topicFull.toLowerCase()}?`,
    'how-it-works':     'how it works',
    'types':            `types of ${topicShortPlural.toLowerCase()}`,
    'health-benefits':  'health benefits',
    'how-to-use':       `how to use ${topicShort.toLowerCase()}`,
    'safety':           'safety & considerations',
    'featured-products':'top picks',
    'faq':              'frequently asked questions',
  }
  return map[key] ?? key.replace(/-/g, ' ')
}

// ─── CSS ────────────────────────────────────────────────────────────────────

const PPW_CSS = `<style>
/* ============================================================
   PPW Ultimate Guide CSS — embedded for Shopify Pages
   ============================================================ */
:root {
  --nn-navy: #0B1A5D;
  --nn-navy-light: #1a2f7a;
  --nn-navy-dark: #060f35;
  --text-primary: #1a1a1a;
  --text-secondary: #4a5568;
  --text-light: #718096;
  --bg-light: #f7fafc;
  --bg-white: #ffffff;
  --border-color: #e2e8f0;
  --success-green: #10b981;
  --info-blue: #3b82f6;
  --warning-orange: #f59e0b;
}
*, *::before, *::after { box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.7;
  color: var(--text-primary);
}

.container { max-width: 1200px; margin: 0 auto; padding: 0 2em; }

/* ── Typography ── */
h1,h2,h3,h4,h5,h6 { font-weight: 700; line-height: 1.2; margin-bottom: 1em; color: var(--nn-navy); }
h1 { font-size: clamp(1.8em, 5vw, 3em); }
h2 { font-size: clamp(1.4em, 4vw, 2.1em); text-transform: capitalize; }
h3 { font-size: clamp(1.1em, 3vw, 1.4em); }
h4 { font-size: 1.05em; }
p  { margin: 0.7em 0; color: var(--text-secondary); line-height: 1.7; }
li { margin: 0.5em 0; line-height: 1.7; color: var(--text-secondary); }
a  { color: var(--nn-navy); text-decoration: none; }
a:hover { text-decoration: underline; }
ul, ol { margin-left: 1.5em; margin-bottom: 1em; }
strong { color: var(--text-primary); }
em { color: var(--text-secondary); }

/* ── Breadcrumb ── */
.breadcrumb { padding: 1em 0; background: var(--bg-light); }
.breadcrumb ol { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5em; margin: 0; font-size: 0.875em; }
.breadcrumb li { display: flex; align-items: center; margin: 0; }
.breadcrumb li:not(:last-child)::after { content: '›'; margin-left: 0.5em; color: var(--text-light); }

/* ── Hero ── */
.hero { padding: 3em 0; background: linear-gradient(135deg, var(--bg-light) 0%, var(--bg-white) 100%); text-align: center; }
.hero h1 { color: var(--nn-navy) !important; }
.hero-subtitle { font-size: 1.1em; color: var(--text-secondary); max-width: 820px; margin: 0 auto 2em; line-height: 1.6; }
.hero-meta { display: flex; justify-content: center; gap: 2em; flex-wrap: wrap; font-size: 0.9em; color: var(--text-light); }
.meta-item { display: flex; align-items: center; gap: 0.4em; }

/* ── Author Bio ── */
.author-bio { padding: 2em 0; background: var(--bg-light); border-top: 1px solid var(--border-color); }
.bio-content { max-width: 900px; margin: 0 auto; }
.bio-text p { color: var(--text-secondary); margin: 0; }

/* ── Table of Contents ── */
.toc { padding: 2em 0; background: var(--bg-white); border-bottom: 1px solid var(--border-color); }
.toc h2 { margin-bottom: 1.5em; }
.toc nav ul { list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.75em; margin: 0; }
.toc nav li { margin: 0; }
.toc nav a { display: block; padding: 0.75em 1em; background: var(--bg-light); border-radius: 8px; border-left: 3px solid var(--nn-navy); transition: all 0.2s; color: var(--nn-navy); font-size: 0.95em; }
.toc nav a:hover { background: var(--nn-navy); color: white; text-decoration: none; transform: translateX(4px); }

/* ── Content Sections ── */
.content-section { padding: 4em 0; border-bottom: 1px solid var(--border-color); }
.content-section:last-of-type { border-bottom: none; }
.content-section h2 { margin-bottom: 1em; }
.content-section h3,
.content-section h4 { color: var(--nn-navy) !important; }
.content-section img { width: 100%; border-radius: 8px; margin: 1.5em 0; height: auto; display: block; }

/* ── Key Takeaways ── */
.nn-takeaways-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5em; margin: 1.5em 0; }
.nn-takeaway-card { background: var(--bg-light); border-left: 4px solid var(--nn-navy); border-radius: 8px; padding: 1.5em; }
.nn-takeaway-icon { font-size: 1.5em; display: block; margin-bottom: 0.5em; }
.nn-takeaway-card p { margin: 0; }

/* ── Two-column Layout ── */
.nn-cols-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2em; align-items: start; margin: 1.5em 0; }

/* ── Stat Box ── */
.nn-stat-box { background: var(--nn-navy); color: white; border-radius: 12px; padding: 2em; text-align: center; }
.nn-stat-value { display: block; font-size: 3em; font-weight: 700; line-height: 1; margin-bottom: 0.25em; color: white !important; }
.nn-stat-label { display: block; font-size: 0.9em; opacity: 0.85; color: white !important; }

/* ── Comparison Table ── */
.nn-table-wrap { overflow-x: auto; margin: 2em 0; }
.nn-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.nn-table thead { background: var(--nn-navy); color: white; }
.nn-table th, .nn-table td { padding: 1em; text-align: left; border-bottom: 1px solid var(--border-color); }
.nn-table th { color: white; border-bottom: none; }
.nn-table tbody tr:hover { background: var(--bg-light); }

/* ── Benefits Grid ── */
.nn-benefits-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5em; margin: 2em 0; }
.nn-benefit-card { background: var(--bg-light); padding: 2em; border-radius: 12px; border-left: 4px solid var(--nn-navy); }
.nn-benefit-icon { font-size: 2em; display: block; margin-bottom: 0.5em; }
.nn-benefit-card h4 { color: var(--nn-navy) !important; margin-bottom: 0.5em; }
.nn-benefit-card p { margin: 0; }

/* ── Callout Boxes ── */
.nn-callout-warn { background: #fffbeb; border-left: 4px solid var(--warning-orange); padding: 1.5em; border-radius: 8px; margin: 2em 0; }
.nn-callout-warn p { margin: 0; color: var(--text-primary); }
.callout-info { background: #eff6ff; border-left: 4px solid var(--info-blue); padding: 1.5em; border-radius: 8px; margin: 2em 0; }
.callout-info h3 { color: var(--nn-navy) !important; margin-bottom: 0.75em; font-size: 1.1em; }
.callout-info ul { margin-bottom: 0; }

/* ── Product Cards (PPW format) ── */
.nn-products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 2em; margin: 2em 0; }
.nn-card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.08); transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; }
.nn-card:hover { transform: translateY(-4px); box-shadow: 0 8px 16px rgba(0,0,0,0.12); }
.nn-card-featured { border: 2px solid var(--nn-navy); }
.card-badge-container { display: flex; gap: 0.5em; flex-wrap: wrap; padding: 1em 1em 0; }
.card-badge { padding: 0.25em 0.75em; font-size: 0.7em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; border-radius: 4px; }
.badge-value   { background: #dcfce7; color: #166534; }
.badge-upgrade { background: #dbeafe; color: #1e40af; }
.badge-premium { background: #fce7f3; color: #9f1239; }
.card-image { width: 100%; position: relative; padding-top: 56.25%; overflow: hidden; background: var(--bg-light); display: block; }
.card-image img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; margin: 0; border-radius: 0; }
.card-content { padding: 1.5em; flex: 1; display: flex; flex-direction: column; }
.card-title { color: var(--nn-navy) !important; margin-bottom: 0.5em !important; font-size: 1.15em !important; font-weight: 700 !important; line-height: 1.3 !important; }
.card-price { font-size: 1.6em !important; font-weight: 700 !important; color: var(--nn-navy) !important; margin-bottom: 0.75em !important; }
.card-description { color: var(--text-secondary) !important; margin-bottom: 1.25em !important; font-size: 0.95em !important; }
.card-specs { display: grid; gap: 0.6em; margin-bottom: 1.25em; padding: 1em; background: var(--bg-light); border-radius: 8px; }
.spec-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5em; font-size: 0.875em; }
.spec-label { color: var(--text-light); font-weight: 600; flex-shrink: 0; }
.spec-value { color: var(--text-primary); font-weight: 500; text-align: right; }
.card-features { list-style: none; margin: 0 0 1.25em 0; flex: 1; }
.card-features li { padding: 0.4em 0 0.4em 1.5em; position: relative; color: var(--text-secondary); font-size: 0.9em; margin: 0; }
.card-features li::before { content: '✓'; position: absolute; left: 0; color: var(--nn-navy); font-weight: 700; }

/* ── Buttons ── */
.nn-button { display: inline-block !important; padding: 0.875em 2em !important; background: var(--nn-navy) !important; color: #ffffff !important; font-weight: 600 !important; text-align: center !important; border-radius: 8px !important; border: none !important; cursor: pointer !important; transition: background 0.2s, transform 0.2s; text-decoration: none !important; font-size: 1em !important; }
.nn-button:hover { background: var(--nn-navy-light) !important; color: #ffffff !important; transform: translateY(-2px); text-decoration: none !important; }
.nn-button-large { padding: 1.25em 3em !important; font-size: 1.125em !important; }

/* ── FAQ Accordion ── */
.nn-faq-item { margin-bottom: 1em; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; background: var(--bg-white); }
.nn-faq-q { width: 100%; padding: 1.25em 1.5em; background: var(--bg-white); border: none; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 1em; font-weight: 600; color: var(--nn-navy); transition: background-color 0.2s; gap: 1em; }
.nn-faq-q:hover, .nn-faq-q[aria-expanded="true"] { background: var(--bg-light); }
.nn-faq-icon { flex-shrink: 0; font-size: 1.4em; font-weight: 300; line-height: 1; transition: transform 0.3s ease; }
.nn-faq-q[aria-expanded="true"] .nn-faq-icon { transform: rotate(45deg); }
.nn-faq-a { max-height: 0; overflow: hidden; transition: max-height 0.35s ease; }
.nn-faq-a p { padding: 0.25em 1.5em 1.5em; margin: 0; color: var(--text-secondary); line-height: 1.8; }

/* ── Internal Links ── */
.internal-links-section { padding: 4em 0; background: var(--bg-light); }
.links-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5em; margin-top: 2em; }
.link-card { background: white; padding: 1.5em; border-radius: 8px; border-left: 4px solid var(--nn-navy); transition: transform 0.2s, box-shadow 0.2s; text-decoration: none; display: block; }
.link-card:hover { transform: translateX(4px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); text-decoration: none; }
.link-card h3 { color: var(--nn-navy) !important; margin-bottom: 0.4em; font-size: 0.95em !important; font-weight: 600 !important; }
.link-card p  { color: var(--text-secondary) !important; font-size: 0.875em !important; margin: 0 !important; }

/* ── Related Guides Hub ── */
.related-guides-section { padding: 4em 0; background: var(--bg-white); border-top: 1px solid var(--border-color); }
.related-guides-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5em; margin-top: 2em; }
.related-guide-card { background: var(--bg-light); border-radius: 12px; padding: 1.5em; text-decoration: none; display: block; transition: transform 0.2s, box-shadow 0.2s; border-top: 3px solid var(--nn-navy); }
.related-guide-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); text-decoration: none; }
.related-guide-card h3 { color: var(--nn-navy) !important; margin-bottom: 0.4em; font-size: 1em !important; }
.related-guide-card p  { color: var(--text-secondary) !important; font-size: 0.875em !important; margin: 0 !important; }

/* ── Final CTA ── */
.final-cta { padding: 5em 0; background: linear-gradient(135deg, var(--nn-navy-dark) 0%, var(--nn-navy) 100%); color: white; text-align: center; }
.final-cta h2, .final-cta p, .cta-box h2, .cta-box p { color: #ffffff !important; }
.cta-box { max-width: 640px; margin: 0 auto; }
.cta-box p { font-size: 1.1em; margin-bottom: 2em; }

/* ── Responsive ── */
@media (max-width: 900px) {
  .nn-cols-2 { grid-template-columns: 1fr; }
  .nn-products-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .container { padding: 0 1.25em; }
  .hero-meta { gap: 1em; }
  .toc nav ul { grid-template-columns: 1fr; }
  .nn-takeaways-grid { grid-template-columns: 1fr; }
  .nn-benefits-grid { grid-template-columns: 1fr; }
  .links-grid { grid-template-columns: 1fr; }
  .related-guides-grid { grid-template-columns: 1fr 1fr; }
}
</style>`

// ─── Schema JSON-LD ─────────────────────────────────────────────────────────

function buildSchema(
  guide: AssemblerGuide,
  sectionContent: Record<string, string>
): string {
  const faqHtml = sectionContent['faq'] || ''
  const faqPairs: Array<{ q: string; a: string }> = []

  // Extract FAQ pairs from the nn-faq-item blocks
  const faqRegex = /<button[^>]*class="nn-faq-q"[^>]*>([\s\S]*?)<\/button>[\s\S]*?<div[^>]*class="nn-faq-a"[^>]*>([\s\S]*?)<\/div>/gi
  let match
  while ((match = faqRegex.exec(faqHtml)) !== null && faqPairs.length < 5) {
    const q = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const a = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (q && a) faqPairs.push({ q, a })
  }

  const products = guide.selected_products || []
  const pageUrl = `https://nakednutrition.com/pages/${guide.slug}`
  const heroImage = guide.hero_image_cdn_url || guide.hero_image_url || `https://nakednutrition.com/pages/${guide.slug}-og.jpg`

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": guide.title,
    "description": `Complete guide to ${guide.topic_full || guide.topic_short}`,
    "image": heroImage,
    "datePublished": guide.date_published || new Date().toISOString().slice(0, 10),
    "dateModified": new Date().toISOString().slice(0, 10),
    "author": {
      "@type": "Person",
      "name": "Naked Nutrition Editorial Team",
      "sameAs": ["https://nakednutrition.com"]
    },
    "publisher": {
      "@type": "Organization",
      "name": "Naked Nutrition",
      "url": "https://nakednutrition.com"
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": pageUrl
    }
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://nakednutrition.com" },
      { "@type": "ListItem", "position": 2, "name": guide.breadcrumb_l2_name || "Wellness", "item": `https://nakednutrition.com/collections/${guide.breadcrumb_l2_slug || ''}` },
      { "@type": "ListItem", "position": 3, "name": guide.title, "item": pageUrl }
    ]
  }

  const schemas: string[] = [
    `<script type="application/ld+json">\n${JSON.stringify(articleSchema, null, 2)}\n</script>`,
    `<script type="application/ld+json">\n${JSON.stringify(breadcrumbSchema, null, 2)}\n</script>`,
  ]

  if (products.length > 0) {
    const itemListSchema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": products.map((p, i) => ({
        "@type": "Product",
        "position": i + 1,
        "name": p.title,
        "brand": { "@type": "Brand", "name": p.vendor },
        "offers": {
          "@type": "Offer",
          "price": String(p.price),
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": `https://nakednutrition.com/products/${p.handle}`
        }
      }))
    }
    schemas.push(`<script type="application/ld+json">\n${JSON.stringify(itemListSchema, null, 2)}\n</script>`)
  }

  if (faqPairs.length > 0) {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqPairs.map(pair => ({
        "@type": "Question",
        "name": pair.q,
        "acceptedAnswer": { "@type": "Answer", "text": pair.a }
      }))
    }
    schemas.push(`<script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 2)}\n</script>`)
  }

  return schemas.join('\n')
}

// ─── Product Cards ───────────────────────────────────────────────────────────

function buildProductCards(products: AssemblerProduct[]): string {
  if (products.length === 0) return ''

  const cards = products.map(p => {
    const isUpgrade = p.selected_role === 'best-upgrade'
    const badgeLabel = isUpgrade ? 'Best Upgrade' : 'Best Value'
    const badgeClass = isUpgrade ? 'badge-upgrade' : 'badge-value'
    const isFeatured = isUpgrade ? ' nn-card-featured' : ''
    const price = typeof p.price === 'number' ? p.price.toLocaleString('en-US', { minimumFractionDigits: 0 }) : p.price
    const subcatLabel = p.selected_subcategory ? `<div class="spec-item"><span class="spec-label">Category:</span><span class="spec-value">${p.selected_subcategory}</span></div>` : ''

    return `<div class="nn-card${isFeatured}">
  <div class="card-badge-container">
    <span class="card-badge ${badgeClass}">${badgeLabel}</span>
  </div>
  <div class="card-image">
    <img width="800" height="450" loading="lazy" alt="${p.title}" src="${p.image_url}">
  </div>
  <div class="card-content">
    <h3 class="card-title">${p.title}</h3>
    <div class="card-price">$${price}</div>
    <div class="card-specs">
      <div class="spec-item">
        <span class="spec-label">Brand:</span>
        <span class="spec-value">${p.vendor}</span>
      </div>
      ${subcatLabel}
    </div>
    <a class="nn-button" href="/products/${p.handle}" style="margin-top:auto;">View Product</a>
  </div>
</div>`
  }).join('\n')

  return `<div class="nn-products-grid">
${cards}
</div>`
}

// ─── Internal Links Grid ─────────────────────────────────────────────────────

function buildInternalLinksGrid(
  clusterLinks: AssemblerClusterLink[],
  topicShort: string
): string {
  const links = clusterLinks.filter(l => l.slug || l.url).slice(0, 9)
  if (links.length === 0) return ''

  const cards = links.map(l => {
    const href = l.slug ? `/blogs/news/${l.slug}` : (l.url || '#')
    const title = l.title || l.anchor || href
    return `<a class="link-card" href="${href}">
  <h3>${title}</h3>
</a>`
  }).join('\n')

  return `<section class="internal-links-section">
  <div class="container">
    <h2>Related ${topicShort} Articles</h2>
    <div class="links-grid">
      ${cards}
    </div>
  </div>
</section>`
}

// ─── Related Ultimate Guides Hub ─────────────────────────────────────────────

function buildRelatedGuidesSection(
  relatedGuides: Array<{ title: string; slug: string; description?: string }>
): string {
  if (relatedGuides.length === 0) return ''

  const cards = relatedGuides.map(g => {
    const href = g.slug.startsWith('/') ? g.slug : `/pages/${g.slug}`
    return `<a class="related-guide-card" href="${href}">
  <h3>${g.title}</h3>
  ${g.description ? `<p>${g.description}</p>` : ''}
</a>`
  }).join('\n')

  return `<section class="related-guides-section">
  <div class="container">
    <h2>Related Ultimate Guides</h2>
    <div class="related-guides-grid">
      ${cards}
    </div>
  </div>
</section>`
}

// ─── FAQ Accordion JS ────────────────────────────────────────────────────────

const FAQ_JS = `<script>
(function() {
  function initFaq() {
    document.querySelectorAll('.nn-faq-a').forEach(function(el) {
      el.style.maxHeight = '0';
      el.style.overflow = 'hidden';
      el.style.transition = 'max-height 0.35s ease';
    });
    document.querySelectorAll('.nn-faq-q').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var isOpen = this.getAttribute('aria-expanded') === 'true';
        var answer = this.nextElementSibling;
        var icon = this.querySelector('.nn-faq-icon');
        this.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        if (icon) icon.textContent = isOpen ? '+' : '−';
        if (answer) answer.style.maxHeight = isOpen ? '0' : (answer.scrollHeight + 32) + 'px';
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFaq);
  } else {
    initFaq();
  }
})();
</script>`

// ─── TOC Builder ─────────────────────────────────────────────────────────────

function buildToc(
  sectionContent: Record<string, string>,
  topicShort: string,
  topicShortPlural: string,
  topicFull: string
): string {
  const items = GUIDE_SECTION_ORDER
    .filter(key => sectionContent[key])
    .map(key => {
      const label = getSectionLabel(key, topicShort, topicShortPlural, topicFull)
      const displayLabel = label.charAt(0).toUpperCase() + label.slice(1)
      return `<li><a href="#${key}">${displayLabel}</a></li>`
    })
    .join('\n          ')

  if (!items) return ''

  return `<section class="toc">
  <div class="container">
    <h2>Table of Contents</h2>
    <nav>
      <ul>
          ${items}
      </ul>
    </nav>
  </div>
</section>`
}

// ─── Main Assembler ───────────────────────────────────────────────────────────

/**
 * Assembles the complete, publish-ready HTML for a PPW Ultimate Guide.
 *
 * @param guide          - Guide metadata (title, slug, topic fields, etc.)
 * @param sectionContent - Map of section key → generated HTML fragment
 * @param clusterLinks   - Topical authority cluster articles for the links grid
 * @returns              - Complete HTML string ready to send to Shopify Pages
 */
export function assembleCompleteGuideHtml(
  guide: AssemblerGuide,
  sectionContent: Record<string, string>,
  clusterLinks: AssemblerClusterLink[] = []
): string {
  const topicShort      = guide.topic_short
  const topicShortPlural = guide.topic_short_plural || `${topicShort}s`
  const topicFull       = guide.topic_full || topicShort
  const slug            = guide.slug
  const breadcrumbL2Name = guide.breadcrumb_l2_name || 'Nutrition'
  const breadcrumbL2Slug = guide.breadcrumb_l2_slug || 'nutrition'
  const collectionSlug  = guide.collection_slug || slug
  const heroImageUrl    = guide.hero_image_cdn_url || guide.hero_image_url || ''
  const readTime        = guide.read_time_mins || 15
  const heroSubtitle    = `Your complete, research-backed guide to ${topicFull.toLowerCase()} — benefits, types, protocols, and top-rated products.`
  const products        = guide.selected_products || []
  const relatedGuides   = guide.related_guides || []

  // Merge guide.cluster_links (from DB format) with passed-in cluster links
  const guideClusterLinks: AssemblerClusterLink[] = (guide.cluster_links || []).map(l => ({
    title: l.anchor || l.url,
    slug: '',
    url: l.url,
  }))
  const allClusterLinks = clusterLinks.length > 0 ? clusterLinks : guideClusterLinks

  // ── Schema ──────────────────────────────────────────────────────────────────
  const schemaHtml = buildSchema(guide, sectionContent)

  // ── TOC ─────────────────────────────────────────────────────────────────────
  const tocHtml = buildToc(sectionContent, topicShort, topicShortPlural, topicFull)

  // ── Hero image or H1 ────────────────────────────────────────────────────────
  const heroContent = heroImageUrl
    ? `<img loading="eager" width="1200" height="675" style="width:100%;height:auto;display:block;border-radius:8px;margin-bottom:1.5em;" alt="${guide.title}" src="${heroImageUrl}">`
    : `<h1>${guide.title}</h1>`

  // ── Content sections ─────────────────────────────────────────────────────────
  const productCardsHtml = buildProductCards(products)

  // Render all non-FAQ content sections
  const contentSectionsHtml = GUIDE_SECTION_ORDER
    .filter(key => key !== 'faq' && sectionContent[key])
    .map(key => {
      const label = getSectionLabel(key, topicShort, topicShortPlural, topicFull)
      let body = sectionContent[key]

      // Append product cards right after the featured-products intro
      if (key === 'featured-products' && productCardsHtml) {
        body = body + '\n' + productCardsHtml
      }

      // Key Takeaways: hardcoded wrapper, strip any rogue AI wrappers
      if (key === 'key-takeaways') {
        const liOnly = body
          .replace(/<\/?ul[^>]*>/gi, '')
          .replace(/<\/?section[^>]*>/gi, '')
          .replace(/<\/?div[^>]*>/gi, '')
          .replace(/<\/?ol[^>]*>/gi, '')
          .trim()
        return `<section id="overview" class="nn-section nn-muted" style="background:var(--bg-light);padding:3em 0;">
  <div class="container">
    <h2>Key Takeaways</h2>
    <ul style="font-size:1.05em;line-height:1.8;padding-left:1.2em;">
      ${liOnly}
    </ul>
  </div>
</section>`
      }

      // What Is section: inject clear:both after body to prevent stat box float bleed
      if (key === 'what-is') {
        body = body + '\n<div style="clear:both"></div>'
      }

      return `<section class="content-section" id="${key}">
  <div class="container">
    <h2>${label}</h2>
    ${body}
  </div>
</section>`
    })
    .join('\n\n')

  // ── FAQ section (rendered separately so internal links go above it) ──────────
  const faqBody = sectionContent['faq'] || ''
  const faqHtml = faqBody ? `<section class="content-section" id="faq">
  <div class="container">
    <h2>${getSectionLabel('faq', topicShort, topicShortPlural, topicFull)}</h2>
    ${faqBody}
  </div>
</section>` : ''

  // ── Internal links grid ──────────────────────────────────────────────────────
  const internalLinksHtml = buildInternalLinksGrid(allClusterLinks, topicShort)

  // ── Related guides hub ───────────────────────────────────────────────────────
  const relatedGuidesHtml = buildRelatedGuidesSection(relatedGuides)

  // ── Final assembly ───────────────────────────────────────────────────────────
  const rawHtml = `${PPW_CSS}

${schemaHtml}

<nav aria-label="Breadcrumb" class="breadcrumb">
  <div class="container">
    <ol>
      <li><a href="/">Home</a></li>
      <li><a href="/collections/${breadcrumbL2Slug}">${breadcrumbL2Name}</a></li>
      <li><span aria-current="page">${topicShort} Guide</span></li>
    </ol>
  </div>
</nav>

<section class="hero">
  <div class="container">
    ${heroContent}
    <p class="hero-subtitle">${heroSubtitle}</p>
    <div class="hero-meta">
      <span class="meta-item">⏱ ${readTime}-minute read</span>
      <span class="meta-item">🔬 Research-backed</span>
      <span class="meta-item">👤 By Ryan O'Connor</span>
    </div>
  </div>
</section>

<section class="author-bio">
  <div class="container">
    <div class="bio-content">
      <div class="bio-text">
        <p><strong>Naked Nutrition Editorial Team</strong> — evidence-based nutrition content written and reviewed by certified sports nutritionists and registered dietitians. Our guides cover the science behind protein, collagen, creatine, and other supplements to help you make informed decisions about your nutrition.</p>
      </div>
    </div>
  </div>
</section>

${tocHtml}

${contentSectionsHtml}

${internalLinksHtml}

${faqHtml}

${relatedGuidesHtml}

<section class="final-cta">
  <div class="container">
    <div class="cta-box">
      <h2>Ready to Experience ${topicFull}?</h2>
      <p>Explore our complete selection of ${topicShortPlural.toLowerCase()} and find the right model for your home or facility. Every product is backed by our expert guidance and ships direct.</p>
      <a class="nn-button nn-button-large" href="/collections/${collectionSlug}">Shop ${topicShortPlural}</a>
    </div>
  </div>
</section>

${FAQ_JS}`

  // Upgrade all <img> tags to <picture> with WebP sources (Shopify CDN only)
  return upgradeImagesToPicture(rawHtml)
}
