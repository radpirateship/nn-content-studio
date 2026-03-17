/**
 * PPW Tag Mapping – Single source of truth for Shopify article tags
 * Maps collection slugs and articleType values to human-readable display tags
 */

/** Maps collection slug → array of display tags to apply in Shopify */
export const COLLECTION_DISPLAY_TAGS: Record<string, string[]> = {
  "infrared-saunas": ["Saunas", "Infrared"],
  "barrel-saunas": ["Saunas", "Barrel Saunas"],
  "traditional-saunas": ["Saunas", "Traditional Saunas"],
  "sauna-heaters": ["Saunas", "Sauna Heaters"],
  "sauna-accessories": ["Saunas", "Sauna Accessories"],
  "steam": ["Saunas", "Steam"],
  "saunas": ["Saunas"],
  "cold-plunges": ["Recovery", "Cold Plunges"],
  "red-light-therapy": ["Recovery", "Red Light Therapy"],
  "hyperbaric-chambers": ["Recovery", "Hyperbaric Chambers"],
  "sensory-deprivation-tanks": ["Recovery", "Sensory Deprivation Tanks"],
  "massage-equipment": ["Recovery", "Massage"],
  "compression-boots": ["Recovery", "Compression Boots"],
  "recovery-tools": ["Recovery"],
  "hydrogen-water": ["Wellness", "Hydrogen Water"],
  "water-ionizers": ["Wellness", "Water Ionizers"],
  "general-wellness": ["Wellness"],
  "treadmills": ["Fitness", "Treadmills"],
  "elliptical-machines": ["Fitness", "Elliptical Machines"],
  "exercise-bikes": ["Fitness", "Exercise Bikes"],
  "stair-climbers": ["Fitness", "Stair Climbers"],
  "vertical-climbers": ["Fitness", "Vertical Climbers"],
  "pilates": ["Fitness", "Pilates"],
  "air-filters": ["Wellness", "Air Filters"],
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
 * @param categorySlug - The wellness category (collection slug)
 * @param articleType - The article's type (from CSV or UI selector)
 * @returns Comma-separated tag string ready for Shopify API, e.g. "Saunas, Infrared, Buyer's Guide"
 */
/** Forgiving aliases: maps display names, old names, and lowercase variants to canonical slugs */
export const COLLECTION_ALIASES: Record<string, string> = {
  'massage equipment': 'massage-equipment',
  'massage chairs': 'massage-equipment',
  'massage': 'massage-equipment',
  'compression boots': 'compression-boots',
  'air filters': 'air-filters',
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
