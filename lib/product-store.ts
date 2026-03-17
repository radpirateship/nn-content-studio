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

// Category keywords for wellness equipment matching
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'sensory-deprivation-tanks': ['float', 'sensory deprivation', 'isolation tank', 'flotation', 'float tank', 'float pod'],
  'saunas': ['sauna', 'infrared sauna', 'barrel sauna', 'traditional sauna'],
  'cold-plunge': ['cold plunge', 'ice bath', 'cold tub', 'cold therapy', 'cryotherapy'],
  'red-light-therapy': ['red light', 'led therapy', 'photobiomodulation', 'light therapy panel'],
  'hyperbaric-chambers': ['hyperbaric', 'oxygen chamber', 'hbot'],
  'massage-equipment': ['massage', 'percussion', 'theragun', 'massage chair', 'massage gun'],
  'recovery-tools': ['recovery', 'compression', 'normatec', 'foam roller'],
  'general-wellness': ['wellness', 'health', 'fitness'],
  'steam': ['steam shower', 'steam generator', 'steam room', 'mrsteam', 'kohler steam', 'thermasol', 'towel warmer', 'steam bath']
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
