// In-memory product store matching Shopify export schema
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
