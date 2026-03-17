import type { 
  GeneratedArticle, 
  Product, 
  TopicalAuthority, 
  GenerationProgress,
  GenerationStep 
} from './types'

// In-memory store for the application state
// In production, this would be backed by a database

class AppStore {
  private articles: Map<string, GeneratedArticle> = new Map()
  private products: Product[] = []
  private topicalAuthority: TopicalAuthority | null = null
  private generationProgress: GenerationProgress = {
    step: 'idle',
    progress: 0,
    message: ''
  }

  // Articles
  addArticle(article: GeneratedArticle): void {
    this.articles.set(article.id, article)
  }

  getArticle(id: string): GeneratedArticle | undefined {
    return this.articles.get(id)
  }

  getAllArticles(): GeneratedArticle[] {
    return Array.from(this.articles.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  updateArticle(id: string, updates: Partial<GeneratedArticle>): void {
    const article = this.articles.get(id)
    if (article) {
      this.articles.set(id, { ...article, ...updates })
    }
  }

  deleteArticle(id: string): void {
    this.articles.delete(id)
  }

  // Products
  setProducts(products: Product[]): void {
    this.products = products
  }

  getProducts(): Product[] {
    return this.products
  }

  getProductsByCategory(category: string): Product[] {
    return this.products.filter(p => 
      p.category === category || 
      p.productType.toLowerCase().includes(category.toLowerCase()) ||
      p.tags.some(tag => tag.toLowerCase().includes(category.toLowerCase()))
    )
  }

  searchProducts(query: string): Product[] {
    const lowerQuery = query.toLowerCase()
    return this.products.filter(p =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery) ||
      p.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  // Topical Authority
  setTopicalAuthority(data: TopicalAuthority): void {
    this.topicalAuthority = data
  }

  getTopicalAuthority(): TopicalAuthority | null {
    return this.topicalAuthority
  }

  // Generation Progress
  setProgress(step: GenerationStep, progress: number, message: string): void {
    this.generationProgress = { step, progress, message }
  }

  getProgress(): GenerationProgress {
    return this.generationProgress
  }

  resetProgress(): void {
    this.generationProgress = { step: 'idle', progress: 0, message: '' }
  }
}

// Singleton instance
export const store = new AppStore()
