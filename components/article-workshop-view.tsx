'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Wrench,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Link2,
  ShoppingBag,
  HelpCircle,
  FileText,
  Tag,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Upload,
  Eye,
  ListFilter,
  LayoutList,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface ShopifyArticle {
  id: number
  title: string
  handle: string
  body_html: string
  tags: string
  summary_html?: string
  author?: string
  published_at?: string
  updated_at?: string
  created_at?: string
  image?: { src: string; alt: string }
  metafields?: unknown[]
  blog_id?: number
}

interface SearchResult {
  id: number
  title: string
  handle: string
  tags: string
  published_at: string
  updated_at: string
  has_image: boolean
  has_content_images: boolean
  has_internal_links: boolean
  has_products: boolean
  has_faq: boolean
}

interface AuditResult {
  label: string
  key: string
  pass: boolean
  detail: string
}

interface PendingChanges {
  body_html?: string
  tags?: string
  summary_html?: string
  image?: { src: string; alt: string }
}

interface ReviewStatus {
  shopify_article_id: number
  status: 'not_reviewed' | 'approved' | 'needs_work'
}

type WorkshopMode = 'single' | 'queue'

// ============================================================================
// CATEGORY CONSTANTS
// ============================================================================

const PARENT_CATEGORIES = ['Saunas', 'Recovery', 'Fitness', 'Wellness'] as const

const SUBCATEGORIES: Record<string, string[]> = {
  Saunas: ['All', 'Barrel Saunas', 'Infrared Saunas', 'Traditional Saunas', 'Outdoor Saunas', 'Sauna Heaters', 'Sauna Accessories', 'Steam'],
  Recovery: ['All', 'Cold Plunges', 'Red Light Therapy', 'Massage Equipment', 'Compression Boots', 'Recovery Tools'],
  Fitness: ['All', 'Treadmills', 'Elliptical Machines', 'Exercise Bikes', 'Stair Climbers', 'Vertical Climbers', 'Pilates'],
  Wellness: ['All', 'Hyperbaric Chambers', 'Hydrogen Water', 'Water Ionizers', 'Sensory Deprivation Tanks', 'Air Filters', 'General Wellness'],
}

const ARTICLE_TYPES = [
  "Buyer's Guide", 'Comparison', 'How-To', 'Deep Dive',
  'Ultimate Guide', 'Listicle', 'Brand Review', 'Celebrity', 'Exercise Science',
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ArticleWorkshopView() {
  // Mode toggle
  const [mode, setMode] = useState<WorkshopMode>('single')

  // Single article mode
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [loadedArticle, setLoadedArticle] = useState<ShopifyArticle | null>(null)
  const [isLoadingArticle, setIsLoadingArticle] = useState(false)
  const [auditResults, setAuditResults] = useState<AuditResult[]>([])
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({})
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ success: boolean; message: string } | null>(null)

  // Section regeneration loading states
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({})

  // Image generation states
  const [imageGenerating, setImageGenerating] = useState<Record<string, boolean>>({})
  const [imageProgress, setImageProgress] = useState('')

  // Queue mode
  const [queueCategory, setQueueCategory] = useState<string>('Fitness')
  const [queueSubcategory, setQueueSubcategory] = useState<string>('All')
  const [queueStatusFilter, setQueueStatusFilter] = useState<string>('all')
  const [queueArticles, setQueueArticles] = useState<SearchResult[]>([])
  const [queueReviews, setQueueReviews] = useState<Record<number, ReviewStatus>>({})
  const [isLoadingQueue, setIsLoadingQueue] = useState(false)
  const [queueIndex, setQueueIndex] = useState<number>(-1) // -1 = list view

  // ============================================================================
  // SEARCH + LOAD (Single Article Mode)
  // ============================================================================

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setSearchResults([])

    try {
      // Check if user pasted a URL
      const urlMatch = searchQuery.match(/blogs\/wellness\/([a-z0-9-]+)/i)
      if (urlMatch) {
        // Direct URL paste Ã¢ÂÂ load article by handle
        await loadArticleByHandle(urlMatch[1])
        setIsSearching(false)
        return
      }

      const res = await fetch(`/api/shopify/blog/search?q=${encodeURIComponent(searchQuery)}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setSearchResults(data.articles || [])
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const loadArticleByHandle = async (handle: string) => {
    setIsLoadingArticle(true)
    setLoadedArticle(null)
    setAuditResults([])
    setPendingChanges({})
    setPublishResult(null)

    try {
      const res = await fetch(`/api/shopify/blog/fetch?handle=${encodeURIComponent(handle)}`)
      if (!res.ok) throw new Error('Failed to fetch article')
      const article = await res.json()
      setLoadedArticle(article)
      runAudit(article)
    } catch (error) {
      console.error('Load error:', error)
    } finally {
      setIsLoadingArticle(false)
    }
  }

  const loadArticleById = async (id: number) => {
    setIsLoadingArticle(true)
    setLoadedArticle(null)
    setAuditResults([])
    setPendingChanges({})
    setPublishResult(null)

    try {
      const res = await fetch(`/api/shopify/blog/fetch?id=${id}`)
      if (!res.ok) throw new Error('Failed to fetch article')
      const article = await res.json()
      setLoadedArticle(article)
      runAudit(article)
    } catch (error) {
      console.error('Load error:', error)
    } finally {
      setIsLoadingArticle(false)
    }
  }

  // ============================================================================
  // AUDIT
  // ============================================================================

  const runAudit = useCallback((article: ShopifyArticle) => {
    const body = article.body_html || ''
    const tags = (article.tags || '').split(',').map(t => t.trim())

    const results: AuditResult[] = [
      {
        label: 'Featured Image',
        key: 'featured-image',
        pass: !!article.image?.src,
        detail: article.image?.src ? 'Image set' : 'No featured image',
      },
      {
        label: 'Content Images',
        key: 'content-images',
        pass: /<img/i.test(body),
        detail: (body.match(/<img/gi) || []).length + ' images found',
      },
      {
        label: 'Internal Links',
        key: 'internal-links',
        pass: /href="\/blogs\/wellness\//i.test(body),
        detail: (body.match(/href="\/blogs\/wellness\//gi) || []).length + ' internal links',
      },
      {
        label: 'Featured Products',
        key: 'products',
        pass: /ppw-card|ppw-product/i.test(body),
        detail: /ppw-card|ppw-product/i.test(body) ? 'Product cards found' : 'No product cards',
      },
      {
        label: 'FAQ Section',
        key: 'faq',
        pass: /<details|ppw-faq/i.test(body),
        detail: /<details|ppw-faq/i.test(body) ? 'FAQ present' : 'No FAQ section',
      },
      {
        label: 'Meta Description',
        key: 'meta',
        pass: !!article.summary_html && article.summary_html.trim().length > 0,
        detail: article.summary_html ? `${article.summary_html.length} chars` : 'Empty',
      },
      {
        label: 'Article Type Tag',
        key: 'article-type',
        pass: ARTICLE_TYPES.some(t => tags.some(tag => tag.toLowerCase() === t.toLowerCase())),
        detail: ARTICLE_TYPES.find(t => tags.some(tag => tag.toLowerCase() === t.toLowerCase())) || 'Missing',
      },
      {
        label: 'Category Tag',
        key: 'category',
        pass: ['Saunas', 'Recovery', 'Fitness', 'Wellness'].some(c => tags.includes(c)),
        detail: ['Saunas', 'Recovery', 'Fitness', 'Wellness'].find(c => tags.includes(c)) || 'Missing',
      },
    ]

    setAuditResults(results)
  }, [])

  // ============================================================================
  // SECTION REGENERATION
  // ============================================================================

  const handleRegenerate = async (section: string) => {
    if (!loadedArticle) return
    setRegenerating(prev => ({ ...prev, [section]: true }))

    try {
      const currentBody = pendingChanges.body_html || loadedArticle.body_html
      const currentTags = pendingChanges.tags !== undefined ? pendingChanges.tags : loadedArticle.tags

      const res = await fetch('/api/workshop/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          article: {
            id: loadedArticle.id,
            title: loadedArticle.title,
            handle: loadedArticle.handle,
            body_html: currentBody,
            tags: currentTags,
            summary_html: pendingChanges.summary_html || loadedArticle.summary_html,
          },
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Regeneration failed')
      }

      const data = await res.json()

      // Apply the regenerated content to pending changes
      switch (section) {
        case 'faq': {
          // Replace existing FAQ in body HTML, or append if none exists
          let newBody = currentBody || ''
          const faqRegex = /<section\s[^>]*id=["']faq["'][^>]*>[\s\S]*?<\/section>/i
          if (faqRegex.test(newBody)) {
            newBody = newBody.replace(faqRegex, data.html)
          } else {
            // Insert before the CTA section or at the end
            const ctaIndex = newBody.lastIndexOf('<section class="ppw-section ppw-center">')
            if (ctaIndex !== -1) {
              newBody = newBody.slice(0, ctaIndex) + '\n' + data.html + '\n' + newBody.slice(ctaIndex)
            } else {
              newBody = newBody + '\n' + data.html
            }
          }
          setPendingChanges(prev => ({ ...prev, body_html: newBody }))
          break
        }
        case 'meta':
          setPendingChanges(prev => ({ ...prev, summary_html: data.summary_html }))
          break
        case 'intro': {
          let newBody = currentBody || ''
          const introRegex = /<section\s+class="ppw-section ppw-muted">[\s\S]*?<\/section>/i
          if (introRegex.test(newBody)) {
            newBody = newBody.replace(introRegex, data.html)
          }
          setPendingChanges(prev => ({ ...prev, body_html: newBody }))
          break
        }
        case 'conclusion': {
          let newBody = currentBody || ''
          const conclusionRegex = /<section\s[^>]*id=["']final-thoughts["'][^>]*>[\s\S]*?<\/section>/i
          if (conclusionRegex.test(newBody)) {
            newBody = newBody.replace(conclusionRegex, data.html)
          } else {
            const faqIndex = newBody.indexOf('<section id="faq"')
            if (faqIndex !== -1) {
              newBody = newBody.slice(0, faqIndex) + '\n' + data.html + '\n' + newBody.slice(faqIndex)
            } else {
              newBody = newBody + '\n' + data.html
            }
          }
          setPendingChanges(prev => ({ ...prev, body_html: newBody }))
          break
        }
        case 'products': {
          // Insert product cards into body HTML before CTA or at end
          let prodBody = currentBody || ''
          if (data.html) {
            // Remove existing product cards first
            prodBody = prodBody.replace(/<div class="ppw-featured-products">[\s\S]*?<\/div>\s*<\/div>/gi, '')
            // Insert before CTA section, or append
            const ctaIdx = prodBody.lastIndexOf('<section class="ppw-section ppw-center">')
            if (ctaIdx !== -1) {
              prodBody = prodBody.slice(0, ctaIdx) + '\n' + data.html + '\n' + prodBody.slice(ctaIdx)
            } else {
              prodBody = prodBody + '\n' + data.html
            }
          }
          setPendingChanges(prev => ({ ...prev, body_html: prodBody }))
          break
        }
        case 'links':
          setPendingChanges(prev => ({ ...prev, body_html: data.html }))
          break
        case 'tags':
          setPendingChanges(prev => ({ ...prev, tags: data.tags }))
          break
        default:
          break
      }

      // Re-run audit with updated content
      const updatedArticle: ShopifyArticle = {
        ...loadedArticle,
        body_html: ['links', 'products', 'faq', 'intro', 'conclusion'].includes(section) ? (data.html || pendingChanges.body_html || loadedArticle.body_html) : (pendingChanges.body_html || loadedArticle.body_html),
        tags: section === 'tags' ? data.tags : (pendingChanges.tags || loadedArticle.tags),
        summary_html: section === 'meta' ? data.summary_html : (pendingChanges.summary_html || loadedArticle.summary_html),
      }
      runAudit(updatedArticle)
    } catch (error) {
      console.error(`Regenerate ${section} error:`, error)
    } finally {
      setRegenerating(prev => ({ ...prev, [section]: false }))
    }
  }

  // ============================================================================
  // IMAGE GENERATION
  // ============================================================================

  const handleRegenerateFeaturedImage = async () => {
    if (!loadedArticle) return
    setImageGenerating(prev => ({ ...prev, featured: true }))
    setImageProgress('Generating featured image...')

    try {
      // Build a prompt from article title and content
      const title = loadedArticle.title
      const currentBody = pendingChanges.body_html || loadedArticle.body_html || ''
      
      // Get category from tags
      const tags = (pendingChanges.tags || loadedArticle.tags || '').split(',').map(t => t.trim())
      const category = tags.find(t => ['Saunas', 'Recovery', 'Fitness', 'Wellness'].includes(t)) || 'Wellness'

      // First draft a featured image prompt via the AI endpoint
      const conceptRes = await fetch('/api/articles/draft-image-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent: currentBody,
          articleTitle: title,
          articleKeyword: tags[0] || title,
          category,
        }),
      })

      if (!conceptRes.ok) throw new Error('Failed to draft image concept')
      const conceptData = await conceptRes.json()
      
      // Find the featured concept
      const featuredConcept = conceptData.concepts?.find((c: { type: string }) => c.type === 'featured')
      if (!featuredConcept) throw new Error('No featured image concept generated')

      setImageProgress('Generating image from concept...')

      // Generate the actual image
      const imgRes = await fetch('/api/articles/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: featuredConcept.prompt,
          conceptId: featuredConcept.id,
          imageType: 'featured',
          title: title,
        }),
      })

      if (!imgRes.ok) throw new Error('Failed to generate featured image')
      const imgData = await imgRes.json()

      if (imgData.imageUrl) {
        setPendingChanges(prev => ({
          ...prev,
          image: { src: imgData.imageUrl, alt: featuredConcept.altText || title },
        }))
        // Re-run audit
        const updatedArticle = {
          ...loadedArticle,
          ...pendingChanges,
          image: { src: imgData.imageUrl, alt: featuredConcept.altText || title },
        }
        runAudit(updatedArticle)
      }
      setImageProgress('')
    } catch (error) {
      console.error('Featured image generation error:', error)
      setImageProgress(error instanceof Error ? error.message : 'Failed to generate featured image')
      setTimeout(() => setImageProgress(''), 4000)
    } finally {
      setImageGenerating(prev => ({ ...prev, featured: false }))
    }
  }

  const handleGenerateContentImages = async () => {
    if (!loadedArticle) return
    setImageGenerating(prev => ({ ...prev, content: true }))
    setImageProgress('Drafting image concepts...')

    try {
      const title = loadedArticle.title
      let currentBody = pendingChanges.body_html || loadedArticle.body_html || ''
      const tags = (pendingChanges.tags || loadedArticle.tags || '').split(',').map(t => t.trim())
      const category = tags.find(t => ['Saunas', 'Recovery', 'Fitness', 'Wellness'].includes(t)) || 'Wellness'

      // Step 1: Draft image concepts
      const conceptRes = await fetch('/api/articles/draft-image-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent: currentBody,
          articleTitle: title,
          articleKeyword: tags[0] || title,
          category,
        }),
      })

      if (!conceptRes.ok) throw new Error('Failed to draft image concepts')
      const conceptData = await conceptRes.json()
      const concepts = (conceptData.concepts || []).filter((c: { type: string }) => c.type === 'technical')

      if (concepts.length === 0) throw new Error('No content image concepts generated')

      // Step 2: Remove existing content images from body
      currentBody = currentBody.replace(/<figure class="ppw-content-image">[\s\S]*?<\/figure>/gi, '')

      // Step 3: Track which sections already have an image
      const sectionsWithImages = new Set<string>()

      // Step 4: Generate each image and insert into body
      for (let i = 0; i < concepts.length; i++) {
        const concept = concepts[i]
        setImageProgress(`Generating image ${i + 1} of ${concepts.length}...`)

        try {
          const imgRes = await fetch('/api/articles/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: concept.prompt,
              conceptId: concept.id,
              imageType: 'technical',
              title: title,
            }),
          })

          if (!imgRes.ok) {
            console.error(`Failed to generate image ${i + 1}`)
            continue
          }

          const imgData = await imgRes.json()
          if (!imgData.imageUrl) continue

          const cleanUrl = imgData.imageUrl.startsWith('data:')
            ? imgData.imageUrl
            : imgData.imageUrl

          const altText = (concept.altText || concept.label || 'Article illustration').replace(/"/g, '&quot;')
          const figureTag = `\n<figure class="ppw-content-image"><img src="${cleanUrl}" alt="${altText}" loading="lazy" /></figure>\n`

          // Insert after the target section H2
          const targetId = concept.targetSectionId
          if (targetId && !sectionsWithImages.has(targetId)) {
            // Try matching by id attribute
            const h2Pattern = new RegExp(
              `(<h2[^>]*(?:id=["']${targetId.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\\$&')}["'])[^>]*>[\\s\\S]*?</h2>)`,
              'i'
            )
            const h2Match = currentBody.match(h2Pattern)
            if (h2Match && h2Match.index !== undefined) {
              const insertPos = h2Match.index + h2Match[0].length
              currentBody = currentBody.slice(0, insertPos) + figureTag + currentBody.slice(insertPos)
              sectionsWithImages.add(targetId)
            } else {
              // Fallback: try matching section text in any h2
              const sectionText = concept.label?.replace(/^(Figure\s*\d*|Hero)\s*[:â\-]\s*/i, '').trim()
              if (sectionText) {
                const fuzzyPattern = new RegExp(`(<h2[^>]*>[\\s\\S]*?</h2>)`, 'gi')
                let fuzzyMatch
                let bestMatch: { index: number; length: number } | null = null
                while ((fuzzyMatch = fuzzyPattern.exec(currentBody)) !== null) {
                  const h2Text = fuzzyMatch[1].replace(/<[^>]+>/g, '').trim().toLowerCase()
                  if (!sectionsWithImages.has(h2Text)) {
                    bestMatch = { index: fuzzyMatch.index, length: fuzzyMatch[0].length }
                    sectionsWithImages.add(h2Text)
                    break
                  }
                }
                if (bestMatch) {
                  const insertPos = bestMatch.index + bestMatch.length
                  currentBody = currentBody.slice(0, insertPos) + figureTag + currentBody.slice(insertPos)
                }
              }
            }
          }
        } catch (imgErr) {
          console.error(`Error generating content image ${i + 1}:`, imgErr)
        }
      }

      // Step 5: Update pending changes with new body
      setPendingChanges(prev => ({ ...prev, body_html: currentBody }))

      // Re-run audit
      const updatedArticle = {
        ...loadedArticle,
        ...pendingChanges,
        body_html: currentBody,
      }
      runAudit(updatedArticle)
      setImageProgress('')
    } catch (error) {
      console.error('Content images generation error:', error)
      setImageProgress(error instanceof Error ? error.message : 'Failed to generate content images')
      setTimeout(() => setImageProgress(''), 4000)
    } finally {
      setImageGenerating(prev => ({ ...prev, content: false }))
    }
  }

  // ============================================================================
  // PUBLISH
  // ============================================================================

  const handlePublish = async () => {
    if (!loadedArticle || Object.keys(pendingChanges).length === 0) return
    setIsPublishing(true)
    setPublishResult(null)

    try {
      const res = await fetch('/api/shopify/blog/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopifyArticleId: loadedArticle.id,
          blogId: loadedArticle.blog_id,
          fields: pendingChanges,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Publish failed')
      }

      const data = await res.json()
      setPublishResult({ success: true, message: `Updated: ${data.article.url}` })

      // Clear pending changes and reload
      setPendingChanges({})
      setLoadedArticle(prev => prev ? {
        ...prev,
        body_html: pendingChanges.body_html || prev.body_html,
        tags: pendingChanges.tags !== undefined ? pendingChanges.tags : prev.tags,
        summary_html: pendingChanges.summary_html || prev.summary_html,
      } : null)
    } catch (error) {
      setPublishResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to publish',
      })
    } finally {
      setIsPublishing(false)
    }
  }

  // ============================================================================
  // QUEUE MODE
  // ============================================================================

  const loadQueue = async () => {
    setIsLoadingQueue(true)
    setQueueArticles([])
    setQueueReviews({})

    try {
      const tag = queueSubcategory === 'All' ? queueCategory : queueSubcategory
      const res = await fetch(`/api/shopify/blog/search?tag=${encodeURIComponent(tag)}&limit=50`)
      if (!res.ok) throw new Error('Failed to load queue')
      const data = await res.json()
      const articles = data.articles || []
      setQueueArticles(articles)

      // Fetch review statuses for all articles
      if (articles.length > 0) {
        const ids = articles.map((a: SearchResult) => a.id).join(',')
        const reviewRes = await fetch(`/api/workshop/reviews?ids=${ids}`)
        if (reviewRes.ok) {
          const reviewData = await reviewRes.json()
          setQueueReviews(reviewData.reviews || {})
        }
      }
    } catch (error) {
      console.error('Queue load error:', error)
    } finally {
      setIsLoadingQueue(false)
    }
  }

  const handleReviewAction = async (action: 'approved' | 'needs_work' | 'back') => {
    if (!loadedArticle) return

    if (action !== 'back') {
      // Save review status
      try {
        await fetch('/api/workshop/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopifyArticleId: loadedArticle.id,
            handle: loadedArticle.handle,
            title: loadedArticle.title,
            status: action,
          }),
        })

        // Update local state
        setQueueReviews(prev => ({
          ...prev,
          [loadedArticle.id]: {
            shopify_article_id: loadedArticle.id,
            status: action,
          },
        }))
      } catch (error) {
        console.error('Review save error:', error)
      }
    }

    if (action === 'approved') {
      // Auto-advance to next unreviewed article
      const nextIndex = queueArticles.findIndex(
        (a, i) => i > queueIndex && !queueReviews[a.id]
      )
      if (nextIndex !== -1) {
        setQueueIndex(nextIndex)
        await loadArticleById(queueArticles[nextIndex].id)
        return
      }
    }

    // Return to list
    setQueueIndex(-1)
    setLoadedArticle(null)
    setAuditResults([])
    setPendingChanges({})
  }

  // Sort queue: more missing items first, then by review status
  const sortedQueueArticles = [...queueArticles]
    .filter(a => {
      if (queueStatusFilter === 'all') return true
      const review = queueReviews[a.id]
      if (queueStatusFilter === 'not_reviewed') return !review || review.status === 'not_reviewed'
      if (queueStatusFilter === 'approved') return review?.status === 'approved'
      if (queueStatusFilter === 'needs_work') return review?.status === 'needs_work'
      return true
    })
    .sort((a, b) => {
      const aMissing = [a.has_image, a.has_content_images, a.has_internal_links, a.has_products, a.has_faq].filter(v => !v).length
      const bMissing = [b.has_image, b.has_content_images, b.has_internal_links, b.has_products, b.has_faq].filter(v => !v).length
      return bMissing - aMissing
    })

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getWordCount = () => {
    const html = pendingChanges.body_html || loadedArticle?.body_html || ''
    return html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length
  }

  const getCurrentTags = () => {
    return (pendingChanges.tags !== undefined ? pendingChanges.tags : loadedArticle?.tags || '').split(',').map(t => t.trim()).filter(Boolean)
  }

  const hasPendingChanges = Object.keys(pendingChanges).length > 0

  const changeCount = Object.keys(pendingChanges).length

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--nn-accent) 12%, transparent)' }}>
            <Wrench className="h-4 w-4" style={{ color: 'var(--nn-accent)' }} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold" style={{ color: 'var(--text1)' }}>Article Workshop</h2>
            <p className="text-[12px]" style={{ color: 'var(--text3)' }}>
              Pull any article from Shopify, audit, and fix section by section
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border p-0.5" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => { setMode('single'); setQueueIndex(-1); setLoadedArticle(null) }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              background: mode === 'single' ? 'var(--nn-accent)' : 'transparent',
              color: mode === 'single' ? '#fff' : 'var(--text2)',
            }}
          >
            <Search className="h-3.5 w-3.5" />
            Single Article
          </button>
          <button
            onClick={() => { setMode('queue'); setLoadedArticle(null) }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              background: mode === 'queue' ? 'var(--nn-accent)' : 'transparent',
              color: mode === 'queue' ? '#fff' : 'var(--text2)',
            }}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Review Queue
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">

          {/* ================================================================ */}
          {/* SINGLE ARTICLE MODE */}
          {/* ================================================================ */}
          {mode === 'single' && !loadedArticle && (
            <>
              {/* Search bar */}
              <Card style={{ borderColor: 'var(--border)' }}>
                <CardContent className="pt-6">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search by title or paste article URL..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="flex-1"
                    />
                    <Button onClick={handleSearch} disabled={isSearching} className="gap-1.5">
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Search
                    </Button>
                  </div>
                  <p className="mt-2 text-[12px]" style={{ color: 'var(--text3)' }}>
                    Tip: Paste a full URL like nakednutrition.com/blogs/wellness/article-handle to load directly
                  </p>
                </CardContent>
              </Card>

              {/* Search results */}
              {searchResults.length > 0 && (
                <Card style={{ borderColor: 'var(--border)' }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[15px]">{searchResults.length} articles found</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => loadArticleById(r.id)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium" style={{ color: 'var(--text1)' }}>
                            {r.title}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="text-[11px]" style={{ color: 'var(--text3)' }}>{r.handle}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3">
                          {r.has_image ? <ImageIcon className="h-3.5 w-3.5 text-green-500" /> : <ImageIcon className="h-3.5 w-3.5 text-gray-300" />}
                          {r.has_internal_links ? <Link2 className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5 text-gray-300" />}
                          {r.has_products ? <ShoppingBag className="h-3.5 w-3.5 text-green-500" /> : <ShoppingBag className="h-3.5 w-3.5 text-gray-300" />}
                          {r.has_faq ? <HelpCircle className="h-3.5 w-3.5 text-green-500" /> : <HelpCircle className="h-3.5 w-3.5 text-gray-300" />}
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ================================================================ */}
          {/* QUEUE MODE Ã¢ÂÂ LIST VIEW */}
          {/* ================================================================ */}
          {mode === 'queue' && queueIndex === -1 && !loadedArticle && (
            <>
              {/* Filters */}
              <Card style={{ borderColor: 'var(--border)' }}>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Category</label>
                      <select
                        value={queueCategory}
                        onChange={(e) => { setQueueCategory(e.target.value); setQueueSubcategory('All') }}
                        className="h-9 rounded-md border px-3 text-[13px]"
                        style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text1)' }}
                      >
                        {PARENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Subcategory</label>
                      <select
                        value={queueSubcategory}
                        onChange={(e) => setQueueSubcategory(e.target.value)}
                        className="h-9 rounded-md border px-3 text-[13px]"
                        style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text1)' }}
                      >
                        {(SUBCATEGORIES[queueCategory] || []).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Status</label>
                      <select
                        value={queueStatusFilter}
                        onChange={(e) => setQueueStatusFilter(e.target.value)}
                        className="h-9 rounded-md border px-3 text-[13px]"
                        style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text1)' }}
                      >
                        <option value="all">All</option>
                        <option value="not_reviewed">Not Reviewed</option>
                        <option value="approved">Approved</option>
                        <option value="needs_work">Needs Work</option>
                      </select>
                    </div>
                    <Button onClick={loadQueue} disabled={isLoadingQueue} className="gap-1.5">
                      {isLoadingQueue ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListFilter className="h-4 w-4" />}
                      Load Articles
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Queue list */}
              {sortedQueueArticles.length > 0 && (
                <Card style={{ borderColor: 'var(--border)' }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[15px]">{sortedQueueArticles.length} articles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {sortedQueueArticles.map((a, i) => {
                      const review = queueReviews[a.id]
                      const statusIcon = review?.status === 'approved'
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : review?.status === 'needs_work'
                          ? <AlertTriangle className="h-4 w-4 text-amber-500" />
                          : <div className="h-4 w-4 rounded border" style={{ borderColor: 'var(--border)' }} />

                      return (
                        <button
                          key={a.id}
                          onClick={() => {
                            const realIndex = queueArticles.findIndex(q => q.id === a.id)
                            setQueueIndex(realIndex)
                            loadArticleById(a.id)
                          }}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                        >
                          {statusIcon}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium" style={{ color: 'var(--text1)' }}>{a.title}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {a.has_image ? <ImageIcon className="h-3.5 w-3.5 text-green-500" /> : <ImageIcon className="h-3.5 w-3.5 text-gray-300" />}
                            {a.has_internal_links ? <Link2 className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5 text-gray-300" />}
                            {a.has_products ? <ShoppingBag className="h-3.5 w-3.5 text-green-500" /> : <ShoppingBag className="h-3.5 w-3.5 text-gray-300" />}
                            {a.has_faq ? <HelpCircle className="h-3.5 w-3.5 text-green-500" /> : <HelpCircle className="h-3.5 w-3.5 text-gray-300" />}
                            <ArrowRight className="h-3.5 w-3.5 ml-1" style={{ color: 'var(--text3)' }} />
                          </div>
                        </button>
                      )
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ================================================================ */}
          {/* LOADING STATE */}
          {/* ================================================================ */}
          {isLoadingArticle && (
            <Card style={{ borderColor: 'var(--border)' }}>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mb-3" style={{ color: 'var(--nn-accent)' }} />
                <p className="text-[14px] font-medium" style={{ color: 'var(--text2)' }}>Loading article from Shopify...</p>
              </CardContent>
            </Card>
          )}

          {/* ================================================================ */}
          {/* ARTICLE EDITOR (shared between single + queue modes) */}
          {/* ================================================================ */}
          {loadedArticle && !isLoadingArticle && (
            <>
              {/* Article header */}
              <Card style={{ borderColor: 'var(--border)' }}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {mode === 'queue' && (
                        <button
                          onClick={() => { setQueueIndex(-1); setLoadedArticle(null); setAuditResults([]); setPendingChanges({}) }}
                          className="flex items-center gap-1 mb-2 text-[12px] font-medium"
                          style={{ color: 'var(--nn-accent)' }}
                        >
                          <ArrowLeft className="h-3 w-3" />
                          Back to List
                        </button>
                      )}
                      <h3 className="text-[17px] font-semibold leading-snug" style={{ color: 'var(--text1)' }}>
                        {loadedArticle.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-[12px]" style={{ color: 'var(--text3)' }}>
                          {(getWordCount() ?? 0).toLocaleString()} words
                        </span>
                        <span style={{ color: 'var(--border)' }}>|</span>
                        <span className="text-[12px]" style={{ color: 'var(--text3)' }}>
                          {getCurrentTags().length} tags
                        </span>
                        {loadedArticle.published_at && (
                          <>
                            <span style={{ color: 'var(--border)' }}>|</span>
                            <span className="text-[12px]" style={{ color: 'var(--text3)' }}>
                              Published {new Date(loadedArticle.published_at).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {hasPendingChanges && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 shrink-0">
                        {changeCount} pending change{changeCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Audit panel */}
              <Card style={{ borderColor: 'var(--border)' }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-[15px] flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Audit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {auditResults.map((r) => (
                      <div
                        key={r.key}
                        className="flex items-center gap-2 rounded-lg px-3 py-2"
                        style={{ background: r.pass ? 'color-mix(in srgb, #16a34a 8%, transparent)' : 'color-mix(in srgb, #ea580c 8%, transparent)' }}
                      >
                        {r.pass
                          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                          : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                        }
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text1)' }}>{r.label}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--text3)' }}>{r.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Section cards */}
              <div className="space-y-3">
                <h3 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
                  Section Controls
                </h3>

                {/* Featured Image */}
                <SectionCard
                  icon={<ImageIcon className="h-4 w-4" />}
                  title="Featured Image"
                  status={loadedArticle.image?.src ? 'present' : 'missing'}
                  detail={loadedArticle.image?.src ? 'Image set' : 'No featured image'}
                  preview={loadedArticle.image?.src ? (
                    <img src={loadedArticle.image.src} alt={loadedArticle.image.alt || ''} className="h-20 w-32 rounded object-cover" />
                  ) : null}
                >
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-[12px]"
                disabled={imageGenerating.featured}
                onClick={handleRegenerateFeaturedImage}
              >
                {imageGenerating.featured ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {imageGenerating.featured ? 'Generating...' : 'Regenerate Image'}
              </Button>
              {imageGenerating.featured && imageProgress && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--text3)' }}>{imageProgress}</p>
              )}
              </SectionCard>
                {/* Content Images */}
                <SectionCard
                  icon={<ImageIcon className="h-4 w-4" />}
                  title="Content Images"
                  status={/<img/i.test(pendingChanges.body_html || loadedArticle.body_html || '') ? 'present' : 'missing'}
                  detail={`${((pendingChanges.body_html || loadedArticle.body_html || '').match(/<img/gi) || []).length} images found`}
                >
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-[12px]"
                disabled={imageGenerating.content}
                onClick={handleGenerateContentImages}
              >
                {imageGenerating.content ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {imageGenerating.content ? 'Generating...' : 'Generate Content Images'}
              </Button>
              {imageGenerating.content && imageProgress && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--text3)' }}>{imageProgress}</p>
              )}
              </SectionCard>
                {/* Internal Links */}
                <SectionCard
                  icon={<Link2 className="h-4 w-4" />}
                  title="Internal Links"
                  status={/href="\/blogs\/wellness\//i.test(pendingChanges.body_html || loadedArticle.body_html || '') ? 'present' : 'missing'}
                  detail={`${((pendingChanges.body_html || loadedArticle.body_html || '').match(/href="\/blogs\/wellness\//gi) || []).length} internal links`}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-[12px]"
                    disabled={regenerating['links']}
                    onClick={() => handleRegenerate('links')}
                  >
                    {regenerating['links'] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Re-run Link Injection
                  </Button>
                </SectionCard>

                {/* Featured Products */}
                <SectionCard
                  icon={<ShoppingBag className="h-4 w-4" />}
                  title="Featured Products"
                  status={/ppw-card|ppw-product/i.test(pendingChanges.body_html || loadedArticle.body_html || '') ? 'present' : 'missing'}
                  detail={/ppw-card|ppw-product/i.test(pendingChanges.body_html || loadedArticle.body_html || '') ? 'Product cards found' : 'No product cards'}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-[12px]"
                    disabled={regenerating['products']}
                    onClick={() => handleRegenerate('products')}
                  >
                    {regenerating['products'] ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingBag className="h-3 w-3" />}
                    Add Featured Products
                  </Button>
                </SectionCard>

                {/* FAQ */}
                <SectionCard
                  icon={<HelpCircle className="h-4 w-4" />}
                  title="FAQ Section"
                  status={/<details|ppw-faq/i.test(pendingChanges.body_html || loadedArticle.body_html || '') ? 'present' : 'missing'}
                  detail={`${((pendingChanges.body_html || loadedArticle.body_html || '').match(/<details/gi) || []).length} questions found`}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-[12px]"
                    disabled={regenerating['faq']}
                    onClick={() => handleRegenerate('faq')}
                  >
                    {regenerating['faq'] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Replace FAQ
                  </Button>
                </SectionCard>

                {/* Meta Description */}
                <SectionCard
                  icon={<FileText className="h-4 w-4" />}
                  title="Meta Description"
                  status={(pendingChanges.summary_html || loadedArticle.summary_html || '').trim().length > 0 ? 'present' : 'missing'}
                  detail={(pendingChanges.summary_html || loadedArticle.summary_html || '').slice(0, 100) || 'Empty'}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-[12px]"
                    disabled={regenerating['meta']}
                    onClick={() => handleRegenerate('meta')}
                  >
                    {regenerating['meta'] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Regenerate Meta
                  </Button>
                </SectionCard>

                {/* Tags */}
                <SectionCard
                  icon={<Tag className="h-4 w-4" />}
                  title="Tags"
                  status={getCurrentTags().length > 0 ? 'present' : 'missing'}
                  detail={getCurrentTags().join(' \u00b7 ') || 'No tags'}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-[12px]"
                    disabled={regenerating['tags']}
                    onClick={() => handleRegenerate('tags')}
                  >
                    {regenerating['tags'] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Tag className="h-3 w-3" />}
                    Fix Tags
                  </Button>
                </SectionCard>
              </div>

              {/* Publish result toast */}
              {publishResult && (
                <Card style={{ borderColor: publishResult.success ? '#16a34a' : '#dc2626' }}>
                  <CardContent className="flex items-center gap-3 py-4">
                    {publishResult.success
                      ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      : <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                    }
                    <p className="text-[14px]" style={{ color: 'var(--text1)' }}>{publishResult.message}</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* STICKY BOTTOM BAR */}
      {/* ================================================================ */}
      {loadedArticle && (
        <div className="flex-shrink-0 border-t px-6 py-3" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            {/* Left: queue nav or change count */}
            <div>
              {mode === 'queue' ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-[12px]"
                    onClick={() => handleReviewAction('back')}
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to List
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-[12px] text-amber-600 border-amber-300 hover:bg-amber-50"
                    onClick={() => handleReviewAction('needs_work')}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Needs Work
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 text-[12px] bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleReviewAction('approved')}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Approve & Next
                  </Button>
                </div>
              ) : (
                <p className="text-[12px]" style={{ color: 'var(--text3)' }}>
                  {hasPendingChanges ? `${changeCount} pending change${changeCount !== 1 ? 's' : ''}` : 'No changes yet'}
                </p>
              )}
            </div>

            {/* Right: publish */}
            <Button
              onClick={handlePublish}
              disabled={!hasPendingChanges || isPublishing}
              className="gap-1.5"
              style={{ background: hasPendingChanges ? 'var(--nn-accent)' : undefined, color: hasPendingChanges ? '#fff' : undefined }}
            >
              {isPublishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Publish Updates to Shopify
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SECTION CARD SUB-COMPONENT
// ============================================================================

function SectionCard({
  icon,
  title,
  status,
  detail,
  preview,
  children,
}: {
  icon: React.ReactNode
  title: string
  status: 'present' | 'missing'
  detail: string
  preview?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card style={{ borderColor: 'var(--border)' }}>
      <CardContent className="flex items-center gap-4 py-4">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: status === 'present'
              ? 'color-mix(in srgb, #16a34a 10%, transparent)'
              : 'color-mix(in srgb, #ea580c 10%, transparent)',
            color: status === 'present' ? '#16a34a' : '#ea580c',
          }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-medium" style={{ color: 'var(--text1)' }}>{title}</p>
            {status === 'present'
              ? <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] py-0">Present</Badge>
              : <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px] py-0">Missing</Badge>
            }
          </div>
          <p className="text-[12px] truncate" style={{ color: 'var(--text3)' }}>{detail}</p>
        </div>
        {preview && <div className="shrink-0">{preview}</div>}
        <div className="shrink-0">{children}</div>
      </CardContent>
    </Card>
  )
}
