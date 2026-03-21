// Product store — provides both in-memory (for POST/DELETE flows) and
// DB-backed (for cold-start-safe recommendations) access to products.
import { getSQL } from "@/lib/db";

export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  compareAtPrice?: string;
  sku?: string;
  vendor?: string;
  productType?: string;
  tags?: string;
  category?: string;
  imageUrl?: string;
  handle?: string;
  status?: string;
  inventoryQty?: string;
  url?: string;
}

// Category keywords for supplement matching
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'whey-protein': ['whey', 'whey protein', 'whey isolate', 'whey concentrate', 'grass-fed whey'],
  'casein-protein': ['casein', 'casein protein', 'micellar casein', 'slow-release protein'],
  'pea-protein': ['pea protein', 'plant protein', 'plant-based protein', 'hemp protein', 'vegan protein'],
  'rice-protein': ['rice protein', 'brown rice protein'],
  'creatine': ['creatine', 'creatine monohydrate', 'creatine hcl'],
  'mass-gainer': ['mass gainer', 'weight gainer', 'mass builder', 'bulking'],
  'pre-workout': ['pre-workout', 'pre workout', 'energy boost', 'pump formula', 'caffeine'],
  'post-workout': ['post-workout', 'post workout', 'recovery', 'recovery formula'],
  'bcaa': ['bcaa', 'branched chain', 'amino acid', 'eaa', 'essential amino'],
  'collagen': ['collagen', 'collagen peptides', 'hydrolyzed collagen', 'collagen protein'],
  'greens': ['greens', 'superfood', 'green powder', 'spirulina', 'chlorella', 'vegetable powder'],
  'fiber': ['fiber', 'psyllium', 'digestive health', 'prebiotic fiber', 'inulin'],
  'vitamins': ['vitamin', 'mineral', 'multivitamin', 'vitamin d', 'vitamin c', 'zinc', 'magnesium'],
  'probiotics': ['probiotic', 'lactobacillus', 'bifidobacterium', 'gut health', 'digestive enzyme'],
  'energy': ['energy', 'focus', 'nootropic', 'mental clarity', 'caffeine pill'],
  'weight-management': ['weight loss', 'fat burner', 'thermogenic', 'appetite', 'metabolism'],
  'keto': ['keto', 'ketogenic', 'low carb', 'mct oil', 'mct powder'],
  'vegan': ['vegan', 'plant-based', 'dairy-free', 'vegan nutrition'],
  'general-nutrition': ['nutrition', 'supplement', 'health', 'wellness'],
};

class ProductStore {
  private products: Product[] = [];

  setProducts(products: Product[]) {
    this.products = products;
  }

  clear() {
    this.products = [];
  }

  getAll(): Product[] {
    return this.products;
  }

  getByCategory(category: string): Product[] {
    const keywords = CATEGORY_KEYWORDS[category] || [category];
    
    return this.products.filter((p) => {
      const searchText = [
        p.title,
        p.description,
        p.productType,
        p.tags,
        p.vendor
      ].filter(Boolean).join(' ').toLowerCase();
      
      return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    });
  }
  
  // Get wellness category for a product
  detectCategory(product: Product): string | null {
    const searchText = [
      product.title,
      product.description,
      product.productType,
      product.tags
    ].filter(Boolean).join(' ').toLowerCase();
    
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(keyword => searchText.includes(keyword.toLowerCase()))) {
        return category;
      }
    }
    return null;
  }

  getCategories(): string[] {
    const categories = new Set<string>();

    this.products.forEach((p) => {
      if (p.category) categories.add(p.category);
      if (p.productType) categories.add(p.productType);
    });

    return Array.from(categories).filter(Boolean).sort();
  }

  search(query: string): Product[] {
    const queryLower = query.toLowerCase();
    return this.products.filter(
      (p) =>
        p.title?.toLowerCase().includes(queryLower) ||
        p.description?.toLowerCase().includes(queryLower) ||
        p.vendor?.toLowerCase().includes(queryLower) ||
        p.tags?.toLowerCase().includes(queryLower)
    );
  }

  getRecommendations(category: string, limit: number = 3): Product[] {
    const categoryProducts = this.getByCategory(category);

    // Prioritize products with images and prices
    const sorted = categoryProducts.sort((a, b) => {
      const aScore = (a.imageUrl ? 2 : 0) + (a.price ? 1 : 0);
      const bScore = (b.imageUrl ? 2 : 0) + (b.price ? 1 : 0);
      return bScore - aScore;
    });

    return sorted.slice(0, limit);
  }

  getCount(): number {
    return this.products.length;
  }
}

export const productStore = new ProductStore();

// ── DB-backed functions (cold-start safe) ──────────────────────────────────
// These query the products table directly, so they work even on a fresh
// serverless instance where the in-memory store is empty.

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id ?? ""),
    title: (row.title as string) || "",
    description: (row.description as string) || "",
    price: (row.price as string) || "",
    compareAtPrice: (row.compare_at_price as string) || "",
    sku: (row.sku as string) || "",
    vendor: (row.vendor as string) || "",
    productType: (row.product_type as string) || "",
    tags: (row.tags as string) || "",
    category: (row.category as string) || "",
    imageUrl: (row.image_url as string) || "",
    handle: (row.handle as string) || "",
    status: (row.status as string) || "active",
    inventoryQty: (row.inventory_qty as string) || "",
    url: (row.url as string) || "",
  };
}

/**
 * Fetch product recommendations from the database for a given category.
 * Uses CATEGORY_KEYWORDS to build an ILIKE query, then ranks by image + price.
 * Falls back to the in-memory store if the DB query fails.
 */
export async function getProductRecommendationsFromDB(
  category: string,
  limit: number = 4
): Promise<Product[]> {
  try {
    const sql = getSQL();
    const keywords = CATEGORY_KEYWORDS[category] || [category.replace(/-/g, " ")];

    // Fetch all products from DB (the table is small — typically <1000 rows)
    // and filter/sort in JS using the same keyword logic as the in-memory store.
    const allRows = await sql`SELECT * FROM products ORDER BY title LIMIT 500`;

    if (allRows.length === 0) {
      console.warn(`[product-store] No products in DB — falling back to in-memory store`);
      return productStore.getRecommendations(category, limit);
    }

    const allProducts = allRows.map(rowToProduct);
    const filtered = allProducts.filter((p) => {
      const text = [p.title, p.description, p.productType, p.tags, p.category, p.vendor]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return keywords.some((kw) => text.includes(kw.toLowerCase()));
    });

    // Sort: prefer products with images and prices
    const sorted = (filtered.length > 0 ? filtered : allProducts).sort((a, b) => {
      const aScore = (a.imageUrl ? 2 : 0) + (a.price && a.price !== "0" ? 1 : 0);
      const bScore = (b.imageUrl ? 2 : 0) + (b.price && b.price !== "0" ? 1 : 0);
      return bScore - aScore;
    });

    console.log(
      `[product-store] DB recommendations for "${category}": ${sorted.slice(0, limit).length} products ` +
      `(${filtered.length} matched keywords, ${allProducts.length} total in DB)`
    );
    return sorted.slice(0, limit);
  } catch (err) {
    console.error("[product-store] DB query failed, falling back to in-memory:", err);
    return productStore.getRecommendations(category, limit);
  }
}
