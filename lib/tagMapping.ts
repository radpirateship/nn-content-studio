/**
 * Naked Nutrition Tag Mapping – Single source of truth for Shopify article tags
 * Maps collection slugs and articleType values to human-readable display tags
 */

/** Maps collection slug → array of display tags to apply in Shopify */
export const COLLECTION_DISPLAY_TAGS: Record<string, string[]> = {
  // Protein
  "protein-powder": ["Protein", "Protein Powder"],
  "whey-protein": ["Protein", "Whey Protein"],
  "vegan-protein-powder": ["Protein", "Vegan Protein"],
  // Specialty protein / collagen
  "collagen-peptides": ["Collagen"],
  // Other products
  "overnight-oats": ["Nutrition", "Overnight Oats"],
  "improve-performance-recovery": ["Performance", "Recovery"],
  "supplements": ["Supplements"],
  "kids": ["Kids", "Family"],
}

/** Maps articleType CSV/UI value → Shopify display tag */
export const ARTICLE_TYPE_DISPLAY_TAGS: Record<string, string> = {
  "buyers-guide": "Buyer's Guide",
  "comparison": "Comparison",
  "how-to": "How-To",
  "deep-dive": "Deep Dive",
  "ultimate-guide": "Ultimate Guide",
  "listicle": "Listicle",
  "brand-review": "Brand Review",
  "celebrity": "Celebrity",
  "exercise-science": "Exercise Science",
  "benefit-deep-dive": "Deep Dive",
  "faq": "FAQ",
  "troubleshooting": "How-To",
}

/**
 * Build a comma-separated Shopify tag string from category and article type.
 * @param categorySlug - The NN collection slug
 * @param articleType - The article's type (from CSV or UI selector)
 * @returns Comma-separated tag string ready for Shopify API, e.g. "Protein, Whey Protein, Buyer's Guide"
 */
/** Forgiving aliases: maps display names and alternate spellings to canonical slugs */
export const COLLECTION_ALIASES: Record<string, string> = {
  'whey': 'whey-protein',
  'vegan protein': 'vegan-protein-powder',
  'collagen': 'collagen-peptides',
  'performance': 'improve-performance-recovery',
  'recovery': 'improve-performance-recovery',
  'oats': 'overnight-oats',
}

/** Resolve a potentially messy collection name to a canonical slug */
export function resolveCollectionSlug(raw: string): string {
  if (!raw) return raw
  const lower = raw.trim().toLowerCase()
  return COLLECTION_ALIASES[lower] || COLLECTION_DISPLAY_TAGS[raw] ? raw : lower.replace(/\s+/g, '-')
}

export function buildShopifyTags(
  categorySlug: string,
  articleType?: string
): string {
  const tags: string[] = []

  // Resolve aliases before lookup
  const resolved = COLLECTION_ALIASES[categorySlug.toLowerCase()] || categorySlug
  const categoryTags = COLLECTION_DISPLAY_TAGS[resolved] ?? []
  tags.push(...categoryTags)

  // Add article type tag
  if (articleType) {
    const typeTag = ARTICLE_TYPE_DISPLAY_TAGS[articleType] ?? ""
    if (typeTag) tags.push(typeTag)
  }

  // Dedupe and join for Shopify API
  return [...new Set(tags)].join(", ")
}
