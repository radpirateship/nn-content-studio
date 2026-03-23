// Import NN categories from dedicated file
import { NNCategory } from './nn-categories'

// Article Generation Types
export interface ArticleInput {
  title: string
  keyword: string
  category: NNCategory
  tone?: ArticleTone
  wordCount?: number
  includeProducts?: boolean
  includeFAQ?: boolean
  includeSchema?: boolean
  shopifySlug?: string
  shopifyBlogTag?: string
  // New wireframe fields
  articleType?: string
  audience?: string
  collection?: string
  specialInstructions?: string
  includeComparisonTable?: boolean
  includeInternalLinks?: boolean
  includeAIImages?: boolean
  titleTag?: string
  metaDescription?: string
  includeEmailCapture?: boolean
  includeCalculator?: boolean
  calculatorType?: string
}

export type ArticleTone = 'educational' | 'conversational' | 'authoritative' | 'scientific'

export interface ArticleOutline {
  title: string
  metaDescription: string
  sections: OutlineSection[]
  suggestedProducts: Product[]
  internalLinks: InternalLink[]
  faqQuestions: FAQItem[]
}

export interface OutlineSection {
  heading: string
  subheadings?: string[]
  keyPoints: string[]
  estimatedWords: number
}

export interface GeneratedArticle {
  id: string
  dbId?: number // Database ID for persistence
  title: string
  slug: string
  titleTag?: string
  metaDescription: string
  content: string
  htmlContent: string
  featuredImage?: GeneratedImage
  contentImages: GeneratedImage[]
  products: Product[]
  faqs: FAQItem[]
  schemaMarkup: string
  category: NNCategory
  keyword: string
  wordCount: number
  createdAt: Date
  status: ArticleStatus
  articleType?: string
  // Enrichment tracking
  hasInternalLinks?: boolean
  hasImages?: boolean
  linkCount?: number
  imageCount?: number
  // Shopify integration
  shopifyBlogTag?: string
  shopifyBlogHandle?: string // Resolved blog handle from publish (e.g., 'protein', 'wellness', 'news')
  sourceType?: 'new' | 'revamp'
  originalShopifyId?: number
  imageStoryboard?: ImageStoryboardDraft | null
}

export type ArticleStatus = 'draft' | 'reviewing' | 'approved' | 'published' | 'failed'

// Product Types
export interface Product {
  id: string
  handle: string
  title: string
  description: string
  vendor: string
  productType: string
  tags: string[]
  price: string
  compareAtPrice?: string
  imageUrl?: string
  url: string
  category: NNCategory
  isAvailable: boolean
}

export interface ProductCatalog {
  products: Product[]
  lastUpdated: Date
  totalCount: number
}

// Image Generation Types
export interface GeneratedImage {
  id: string
  prompt: string
  url: string
  altText: string
  placement: 'featured' | 'inline' | 'product'
}

// Content Planning Types
export interface TopicalAuthority {
  pillarPages: PillarPage[]
  clusters: ContentCluster[]
  internalLinks: InternalLink[]
}

export interface PillarPage {
  title: string
  url: string
  category: NNCategory
  targetKeyword: string
}

export interface ContentCluster {
  pillarId: string
  supportingArticles: SupportingArticle[]
}

export interface SupportingArticle {
  title: string
  keyword: string
  url?: string
  status: 'planned' | 'draft' | 'published'
}

export interface InternalLink {
  anchorText: string
  url: string
  relevanceScore: number
}

export interface FAQItem {
  question: string
  answer: string
}

// Link Suggestion from AI scan
export interface LinkSuggestion {
  id: string
  anchorText: string
  targetUrl: string
  targetTitle: string
  rationale: string
  status: 'pending' | 'approved' | 'rejected'
  editedUrl?: string
  editedAnchor?: string
}

// Image Concept from AI
export interface ImageConcept {
  id: string
  label: string // e.g., "Figure 1: Supplement Structure Diagram"
  prompt: string // The AI-drafted prompt
  editedPrompt?: string // User-edited version
  imageUrl?: string // After generation
  altText?: string // Descriptive alt text for accessibility/SEO
  errorMessage?: string // Detailed generation failure message for UI feedback
  status: 'draft' | 'generating' | 'generated' | 'error'
  placeholderKey?: string // legacy - maps to [IMAGE_PLACEHOLDER_N]
  targetSectionId?: string // H2 id to inject image after
  targetSectionHeading?: string // Human-readable heading for placement copy
  type?: 'featured' | 'technical' // featured = cinematic featured image, technical = diagram/infographic
}

export interface ImageStoryboardDraft {
  version: 1
  concepts: ImageConcept[]
  insertedAt?: string
  insertedCount?: number
  insertedIds?: string[]   // per-concept tracking; supersedes insertedCount
  featuredImage?: {
    url: string
    altText: string
  }
  updatedAt: string
}

// Wizard step tracking
export type WizardStep = 1 | 2 | 3

// Shopify Types
export interface ShopifyBlogPost {
  title: string
  body_html: string
  author: string
  tags: string
  published: boolean
  image?: {
    src: string
    alt: string
  }
  metafields?: ShopifyMetafield[]
}

export interface ShopifyMetafield {
  namespace: string
  key: string
  value: string
  type: string
}

export interface ShopifyPublishResult {
  success: boolean
  articleId?: string
  articleUrl?: string
  error?: string
}

// App State Types
export interface GenerationProgress {
  step: GenerationStep
  progress: number
  message: string
}

export type GenerationStep =
  | 'idle'
  | 'generating-outline'
  | 'writing-content'
  | 'optimizing-html'
  | 'ready-for-review'
  | 'adding-links'
  | 'adding-images'
  | 'publishing'
  | 'complete'
  | 'error'

// Use CATEGORY_LABELS imported from nn-categories as single source of truth
export { CATEGORY_LABELS } from './nn-categories'

export const TONE_LABELS: Record<ArticleTone, string> = {
  'educational': 'Educational - Clear explanations for beginners',
  'conversational': 'Conversational - Friendly and approachable',
  'authoritative': 'Authoritative - Expert industry voice',
  'scientific': 'Scientific - Research-backed and technical'
}

export const ARTICLE_TONES = [
  { value: 'educational' as const, label: 'Educational' },
  { value: 'conversational' as const, label: 'Conversational' },
  { value: 'authoritative' as const, label: 'Authoritative' },
  { value: 'scientific' as const, label: 'Scientific' },
]
