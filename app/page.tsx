'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { AppTopbar } from '@/components/app-topbar'
import { AppSidebar, type ViewId } from '@/components/app-sidebar'
import { NewArticleView, type RunMode } from '@/components/new-article-view'
import { GenerationProgress } from '@/components/generation-progress'
import { ArticlePreview } from '@/components/article-preview'
import { ArticleEditor } from '@/components/article-editor'
import { SectionEditor } from '@/components/section-editor'
import { ArticleHistory } from '@/components/article-history'
import { ProductCatalogManager } from '@/components/product-catalog-manager'
import { ContentResourcesManager } from '@/components/content-resources-manager'
import { LinkReviewer } from '@/components/link-reviewer'
import { ImageStoryboard } from '@/components/image-storyboard'
import { AutoRunView } from '@/components/auto-run-view'
import { BulkUploadView } from '@/components/bulk-upload-view'
import { ContentQueueView } from '@/components/content-queue-view'
import { SeoAnalysisView } from '@/components/seo-analysis-view'
import { OutlineReviewView, parseApiOutline, type OutlineData } from '@/components/outline-review-view'
import { PublishConfirmView } from '@/components/publish-confirm-view'
import { ArticleWorkshopView } from '@/components/article-workshop-view'
import { RevampArticleView } from '@/components/revamp-article-view'
import { RevampAnalysisView } from '@/components/revamp-analysis-view'
import { GuideView } from '@/components/guide-view'
import { ArticleContextBar } from '@/components/article-context-bar'
import { TechnicalGuideView } from '@/components/technical-guide-view'
import { ConnectionsView } from '@/components/connections-view'
import { LogsView } from '@/components/logs-view'
import { BarChart3, Clock, Layers, Zap } from 'lucide-react'
import type { ArticleInput, ArticleStatus, GeneratedArticle, GenerationStep, Product } from '@/lib/types'

export default function ContentStudio() {
  // Navigation
  const [activeView, setActiveView] = useState<ViewId>('revamp-input')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Core state
  const [articles, setArticles] = useState<GeneratedArticle[]>([])
  const [currentArticle, setCurrentArticle] = useState<GeneratedArticle | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [productCount, setProductCount] = useState(0)
  const [topicalAuthorityCount, setTopicalAuthorityCount] = useState(0)
  const [collectionsCount, setCollectionsCount] = useState(0)
  const [generationStep, setGenerationStep] = useState<GenerationStep>('idle')
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationMessage, setGenerationMessage] = useState('')

  // Revamp state
  const [revampAnalysis, setRevampAnalysis] = useState<any>(null)
  const [revampOriginalContent, setRevampOriginalContent] = useState('')
  const [revampCitations, setRevampCitations] = useState<{url: string; title?: string; notes?: string}[]>([])
  const [revampSettings, setRevampSettings] = useState<any>(null)

  // Outline state (Step 0 – review before content generation)
  const [pendingOutline, setPendingOutline] = useState<OutlineData | null>(null)
  const [pendingInput, setPendingInput] = useState<ArticleInput | null>(null)
  const [isRegeneratingOutline, setIsRegeneratingOutline] = useState(false)

  // Links state
  const [availableInternalLinks, setAvailableInternalLinks] = useState<{ title: string; url: string; description?: string }[]>([])
  const [availableCollectionsLinks, setAvailableCollectionsLinks] = useState<{ title: string; url: string }[]>([])

  // Load articles from DB
  useEffect(() => {
    async function loadArticles() {
      try {
        const response = await fetch('/api/articles')
        if (response.ok) {
          const data = await response.json()
          const articlesWithDates = data.map((a: { id: string; title: string; slug: string; category: string; keyword: string; status: string; word_count: number; meta_description?: string; created_at: string; updated_at: string }) => ({
            id: `article-${a.id}`,
            dbId: a.id,
            title: a.title,
            slug: a.slug,
            category: a.category,
            keyword: a.keyword,
            status: a.status,
            wordCount: a.word_count,
            metaDescription: a.meta_description || '',
            createdAt: new Date(a.created_at),
          }))
          setArticles(articlesWithDates)
        }
      } catch (error) {
        console.error('[loadArticles] Failed to load articles from DB:', error)
        toast.error('Failed to load articles from database')
      }
    }
    loadArticles()
  }, [])

  // Load collections links
  useEffect(() => {
    async function loadCollections() {
      try {
        const response = await fetch('/api/resources?type=collections')
        if (response.ok) {
          const data = await response.json()
          const items = data.items || []
          setAvailableCollectionsLinks(
            items
              .filter((c: { url: string }) => c.url)
              .slice(0, 20)
              .map((c: { url: string; primaryKeyword?: string; optimizedTitleTag?: string }) => ({
                title: c.optimizedTitleTag || c.primaryKeyword || c.url,
                url: c.url,
              }))
          )
        }
      } catch (error) {
        console.warn('[loadCollections] Failed to load collection links:', error)
      }
    }
    loadCollections()
  }, [])

  // Save / Update article
  const saveArticleToDb = async (article: GeneratedArticle) => {
    try {
      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          slug: article.slug,
          category: article.category,
          keyword: article.keyword,
          html_content: article.htmlContent,
          meta_description: article.metaDescription,
          schema_markup: article.schemaMarkup,
        featured_image_url: article.featuredImage?.url,
        image_storyboard: article.imageStoryboard ?? null,
        word_count: article.wordCount,
        status: 'draft',
          article_type: article.articleType || null,
          shopify_blog_tag: article.shopifyBlogTag || null,
        }),
      })
      if (response.ok) {
        const saved = await response.json()
        return saved.id
      }
    } catch (error) {
      console.error('[saveArticleToDb] Failed to save article:', error)
      toast.error('Failed to save article to database')
    }
    return null
  }

  const updateArticleInDb = async (article: GeneratedArticle) => {
    if (!article.dbId) return
    try {
      const payload: Record<string, unknown> = {
        id: article.dbId,
        html_content: article.htmlContent,
        meta_description: article.metaDescription,
        schema_markup: article.schemaMarkup,
        word_count: article.wordCount,
      }

      if (article.featuredImage?.url) payload.featured_image_url = article.featuredImage.url
      if (article.imageStoryboard !== undefined) payload.image_storyboard = article.imageStoryboard

      await fetch('/api/articles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      console.error('[updateArticleInDb] Failed to update article:', error)
      toast.error('Failed to update article in database')
    }
  }

  // Auto-save: debounced save of current article to DB (30s after last change)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>('')
  useEffect(() => {
    if (!currentArticle?.dbId || !currentArticle.htmlContent) return
    // Create a content fingerprint using a lightweight hash to detect real changes
    // (length-only fingerprints miss edits that don't change character count)
    const content = currentArticle.htmlContent
    const hashSample = content.slice(0, 128) + content.slice(-128) + content.length
    let hash = 0
    for (let i = 0; i < hashSample.length; i++) {
      hash = ((hash << 5) - hash + hashSample.charCodeAt(i)) | 0
    }
    const fingerprint = `${currentArticle.dbId}-${hash}`
    if (fingerprint === lastSavedRef.current) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await updateArticleInDb(currentArticle)
        lastSavedRef.current = fingerprint
      } catch {
        // Silent — manual save still works as fallback
      }
    }, 30_000)
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  }, [currentArticle])

  // Warn before navigating away with unsaved changes (pending auto-save timer)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (autoSaveTimerRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const updateProgress = (step: GenerationStep, progress: number, message: string) => {
    setGenerationStep(step)
    setGenerationProgress(progress)
    setGenerationMessage(message)
  }

  const generateSlug = (title: string): string =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const generateSchemaMarkup = (article: Partial<GeneratedArticle>): string => {
    const now = new Date().toISOString()
    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": article.title,
      "description": article.metaDescription,
      "author": { "@type": "Organization", "name": "Naked Nutrition" },
      "publisher": {
        "@type": "Organization",
        "name": "Naked Nutrition",
        "logo": { "@type": "ImageObject", "url": "https://nakednutrition.com/cdn/shop/files/naked-nutrition-logo.png" },
      },
      "datePublished": article.createdAt ? new Date(article.createdAt).toISOString() : now,
      "dateModified": now,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://nakednutrition.com/blogs/news/${article.slug}`,
      },
      ...(article.wordCount ? { "wordCount": article.wordCount } : {}),
      ...(article.category ? { "articleSection": article.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) } : {}),
      ...(article.featuredImage?.url ? { "image": article.featuredImage.url } : {}),
    }
    if (article.faqs && article.faqs.length > 0) {
      return JSON.stringify([
        schema,
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": article.faqs.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": { "@type": "Answer", "text": faq.answer },
          })),
        },
      ], null, 2)
    }
    return JSON.stringify(schema, null, 2)
  }

  // --- GENERATE: outline + content in one flow (or route to auto-run/bulk) ---
  const handleGenerate = async (input: ArticleInput, runMode: RunMode = 'step') => {
    // Route Auto-Run and Bulk to their dedicated views
    if (runMode === 'auto') {
      setPendingInput(input)
      setActiveView('auto-run')
      return
    }
    if (runMode === 'bulk') {
      setActiveView('bulk-queue')
      return
    }

    setIsGenerating(true)
    setCurrentArticle(null)

    try {
      updateProgress('generating-outline', 10, 'Analyzing topic and creating article outline...')
      const outlineResponse = await fetch('/api/generate/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: input.title, keyword: input.keyword, category: input.category }),
      })
      if (!outlineResponse.ok) {
        let errMsg = `Failed to generate outline (${outlineResponse.status})`
        try { const errData = await outlineResponse.json(); if (errData.error) errMsg = errData.error } catch (e) { console.warn('[generateArticle] Could not parse outline error response:', e) }
        throw new Error(errMsg)
      }
      const { outline } = await outlineResponse.json()

      updateProgress('generating-outline', 25, 'Finding relevant product recommendations...')
      let products: Product[] = []
      if (input.includeProducts) {
        try {
          let effectiveCategory = input.category
          const titleAndKeyword = `${input.title} ${input.keyword}`.toLowerCase()
          if (input.category === 'general-nutrition' || effectiveCategory === 'general-nutrition') {
            if (titleAndKeyword.includes('whey') || titleAndKeyword.includes('whey protein')) effectiveCategory = 'whey-protein'
            else if (titleAndKeyword.includes('casein')) effectiveCategory = 'casein-protein'
            else if (titleAndKeyword.includes('pea protein') || titleAndKeyword.includes('plant protein')) effectiveCategory = 'pea-protein'
            else if (titleAndKeyword.includes('creatine')) effectiveCategory = 'creatine'
            else if (titleAndKeyword.includes('pre-workout') || titleAndKeyword.includes('pre workout')) effectiveCategory = 'pre-workout'
            else if (titleAndKeyword.includes('collagen')) effectiveCategory = 'collagen'
            else if (titleAndKeyword.includes('greens') || titleAndKeyword.includes('superfood')) effectiveCategory = 'greens'
            else if (titleAndKeyword.includes('mass gainer') || titleAndKeyword.includes('weight gain')) effectiveCategory = 'mass-gainer'
            else if (titleAndKeyword.includes('bcaa') || titleAndKeyword.includes('amino acid')) effectiveCategory = 'bcaa'
            else if (titleAndKeyword.includes('probiotic') || titleAndKeyword.includes('gut health')) effectiveCategory = 'probiotics'
            else if (titleAndKeyword.includes('keto') || titleAndKeyword.includes('low carb')) effectiveCategory = 'keto'
            else if (titleAndKeyword.includes('vegan')) effectiveCategory = 'vegan'
          }
          const searchParam = encodeURIComponent(`${input.title} ${input.keyword}`)
          const productsResponse = await fetch(`/api/products?category=${effectiveCategory}&search=${searchParam}&limit=4`)
          if (productsResponse.ok) {
            const productsData = await productsResponse.json()
            products = productsData.products || []
            if (products.length === 0) {
              const fallbackResponse = await fetch(`/api/products?search=${searchParam}&limit=4`)
              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json()
                products = fallbackData.products || []
              }
            }
          }
        } catch (err) {
          console.log('Could not fetch products:', err)
        }
      }

      updateProgress('generating-outline', 30, 'Fetching topical authority data...')
      let relatedArticles: { title: string; url: string; description: string }[] = []
      let fetchedInternalLinks: { title: string; url: string; description?: string }[] = []
      try {
        // Collection-scoped fetch: only get topical authority items for this article's collection
        const collectionSlug = input.category || ''
        const taUrl = collectionSlug
          ? `/api/resources?type=topical-authority&collection=${encodeURIComponent(collectionSlug)}`
          : '/api/resources?type=topical-authority'
        const resourcesResponse = await fetch(taUrl)
        if (resourcesResponse.ok) {
          const resourcesData = await resourcesResponse.json()
          const allTopics = resourcesData.items || []

          // Filter out the current article by title, but no fuzzy category matching needed
          // since items are already scoped to the correct collection
          const relatedTopics = allTopics.filter((topic: { title: string; existingUrl: string; primaryKeyword: string; type?: string }) => {
            const topicTitle = topic.title?.toLowerCase() || ''
            if (topicTitle === input.title.toLowerCase()) return false
            return true
          })

          const topicsWithUrls = relatedTopics.filter((t: { existingUrl: string }) => t.existingUrl)
          const pillarPage = topicsWithUrls.find((t: { type?: string; title: string }) =>
            t.type?.toLowerCase() === 'pillar' || t.title?.toLowerCase().includes('ultimate guide') || t.title?.toLowerCase().includes('complete guide')
          )
          const clusterPages = topicsWithUrls.filter((t: { type?: string; title: string }) =>
            t.type?.toLowerCase() !== 'pillar' && !t.title?.toLowerCase().includes('ultimate guide')
          )

          fetchedInternalLinks = clusterPages.slice(0, 15).map((t: { title: string; existingUrl: string; metaDescription?: string }) => ({
            title: t.title, url: t.existingUrl, description: t.metaDescription || '',
          }))

          const relatedList: { title: string; url: string; description: string }[] = []
          if (pillarPage) {
            relatedList.push({
              title: (pillarPage as { title: string }).title,
              url: (pillarPage as { existingUrl: string }).existingUrl,
              description: (pillarPage as { metaDescription?: string }).metaDescription || 'Your complete guide to this nutrition topic.',
            })
          }
          clusterPages.slice(5, 7).forEach((t: { title: string; existingUrl: string; metaDescription?: string }) => {
            relatedList.push({ title: t.title, url: t.existingUrl, description: t.metaDescription || 'Explore more from Naked Nutrition.' })
          })
          if (relatedList.length < 3) {
            clusterPages.slice(0, 3 - relatedList.length).forEach((t: { title: string; existingUrl: string; metaDescription?: string }) => {
              if (!relatedList.find(r => r.url === t.existingUrl)) {
                relatedList.push({ title: t.title, url: t.existingUrl, description: t.metaDescription || 'Explore more from Naked Nutrition.' })
              }
            })
          }
          relatedArticles = relatedList
        }
      } catch {
        console.log('Could not fetch resources')
      }
      setAvailableInternalLinks(fetchedInternalLinks)

      updateProgress('writing-content', 40, 'Writing article content with AI...')
      const contentResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.title, keyword: input.keyword, category: input.category,
          tone: input.tone, wordCount: input.wordCount,
          articleType: input.articleType,
          audience: input.audience,
          collection: input.collection,
          specialInstructions: input.specialInstructions,
          includeComparisonTable: input.includeComparisonTable,
          outline,
          products: products.map(p => ({
            title: p.title, description: p.description, price: p.price, imageUrl: p.imageUrl,
            url: p.handle ? `https://nakednutrition.com/products/${p.handle}` : p.url, handle: p.handle,
          })),
          relatedArticles,
        }),
      })
      if (!contentResponse.ok) {
        const errData = await contentResponse.json().catch(() => ({}))
        throw new Error(errData.error || `Failed to generate content (${contentResponse.status})`)
      }
      const { content } = await contentResponse.json()

      updateProgress('optimizing-html', 80, 'Optimizing HTML and adding schema markup...')
      const faqs = Array.isArray(outline?.faq) ? outline.faq.map((f: { question: string; briefAnswer: string }) => ({
        question: f.question, answer: f.briefAnswer,
      })) : []

      const metaDescription = input.metaDescription || `Learn about ${input.keyword}. This comprehensive guide from Naked Nutrition covers everything you need to know about ${input.title.toLowerCase()}.`.slice(0, 160)
      const titleTag = input.titleTag || input.title
      const slug = input.shopifySlug || generateSlug(input.title)
      const textContent = content.replace(/<[^>]*>/g, ' ')
      const wordCount = textContent.split(/\s+/).filter(Boolean).length

      const article: GeneratedArticle = {
        id: `article-${Date.now()}`,
        title: titleTag, slug, metaDescription,
        content: textContent, htmlContent: content,
        featuredImage: undefined, contentImages: [],
        products: products.map(p => ({
          ...p,
          tags: typeof p.tags === 'string' ? (p.tags as string).split(',').map((t: string) => t.trim()) : p.tags || [],
          url: p.handle ? `https://nakednutrition.com/products/${p.handle}` : '#',
          isAvailable: true,
        })),
        faqs, schemaMarkup: '', category: input.category, keyword: input.keyword,
        wordCount, createdAt: new Date(), status: 'draft',
        shopifyBlogTag: input.shopifyBlogTag,
        articleType: input.articleType,
        hasInternalLinks: false, hasImages: false, linkCount: 0, imageCount: 0,
        imageStoryboard: null,
      }
      article.schemaMarkup = generateSchemaMarkup(article)
      updateProgress('ready-for-review', 100, 'Article ready! Use sidebar to add links and images.')

      const dbId = await saveArticleToDb(article)
      if (dbId) article.dbId = dbId

      setCurrentArticle(article)
      setArticles(prev => [article, ...prev])
      setActiveView('article-content')
      setTimeout(() => updateProgress('idle', 0, ''), 3000)
    } catch (error) {
      console.error('[generateArticle] Generation error:', error)
      const errMsg = error instanceof Error ? error.message : 'Failed to generate article'
      updateProgress('error', 0, errMsg)
      toast.error('Article generation failed', { description: errMsg })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveEdit = async (editedArticle: GeneratedArticle) => {
    setCurrentArticle(editedArticle)
    setArticles(prev => prev.map(a => a.id === editedArticle.id ? editedArticle : a))
    setIsEditing(false)
    await updateArticleInDb(editedArticle)
  }

  const handleContentUpdate = async (newHtml: string, updates?: Partial<GeneratedArticle>) => {
    if (!currentArticle) return
    const updatedArticle = {
      ...currentArticle, ...updates,
      htmlContent: newHtml,
      wordCount: newHtml.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length,
    }
    setCurrentArticle(updatedArticle)
    setArticles(prev => prev.map(a => a.id === updatedArticle.id ? updatedArticle : a))
    await updateArticleInDb(updatedArticle)
  }

  const handleApplyLinks = async (enrichedHtml: string, linkCount: number) => {
    await handleContentUpdate(enrichedHtml, { hasInternalLinks: true, linkCount })
    setActiveView('article-images')
  }

  const handleInsertImages = (enrichedHtml: string, imageCount: number, featuredImage?: { url: string; altText: string }) => {
    const updates: Record<string, unknown> = { hasImages: true, imageCount }
    if (featuredImage) {
      updates.featuredImage = { url: featuredImage.url, altText: featuredImage.altText }
    }
    handleContentUpdate(enrichedHtml, updates)
  }

  const handleStoryboardChange = (storyboard: GeneratedArticle['imageStoryboard']) => {
    if (!currentArticle) return

    const updatedArticle = {
      ...currentArticle,
      imageStoryboard: storyboard,
    }

    setCurrentArticle(updatedArticle)
    setArticles(prev => prev.map(a => a.id === updatedArticle.id ? { ...a, imageStoryboard: storyboard } : a))
  }

  const handleDeleteArticle = async (id: string) => {
    // Remove from UI immediately
    setArticles(prev => prev.filter(a => a.id !== id))
    if (currentArticle?.id === id) {
      setCurrentArticle(null)
      setActiveView('new-article')
    }
    // Delete from database so it doesn't come back on reload
    const article = articles.find(a => a.id === id)
    const dbId = article?.dbId
    if (dbId) {
      try {
        await fetch(`/api/articles?id=${dbId}`, { method: 'DELETE' })
      } catch (e) {
        console.error('Failed to delete article from DB:', e)
      }
    }
  }

  const handleStatusChange = async (id: string, status: ArticleStatus) => {
    // Look up the numeric database ID from the client-side article ID
    const article = articles.find(a => a.id === id)
    const dbId = article?.dbId
    if (!dbId) {
      console.error('Cannot update status: no dbId for article', id)
      return
    }
    try {
      const response = await fetch('/api/articles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dbId, status }),
      })
      if (response.ok) {
        setArticles(prev => prev.map(a => a.id === id ? { ...a, status } : a))
        if (currentArticle?.id === id) setCurrentArticle(prev => prev ? { ...prev, status } : prev)
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const loadInternalLinksForArticle = useCallback(async (article: GeneratedArticle) => {
    try {
      const collectionSlug = article.category || ''

      // Helper to extract links from TA items
      const extractLinks = (allTopics: { title: string; existingUrl: string; primaryKeyword: string; type?: string; metaDescription?: string }[]) => {
        const relatedTopics = allTopics.filter((topic) => {
          if ((topic.title?.toLowerCase() || '') === (article.title || '').toLowerCase()) return false
          return true
        })
        const topicsWithUrls = relatedTopics.filter((t) => t.existingUrl)
        const clusterPages = topicsWithUrls.filter((t) =>
          t.type?.toLowerCase() !== 'pillar' && !t.title?.toLowerCase().includes('ultimate guide')
        )
        return clusterPages.slice(0, 15).map((t) => ({
          title: t.title, url: t.existingUrl, description: t.metaDescription || '',
        }))
      }

      // Try collection-scoped first
      if (collectionSlug) {
        const scopedRes = await fetch(`/api/resources?type=topical-authority&collection=${encodeURIComponent(collectionSlug)}`)
        if (scopedRes.ok) {
          const scopedData = await scopedRes.json()
          const scopedItems = scopedData.items || []
          if (scopedItems.length > 0) {
            setAvailableInternalLinks(extractLinks(scopedItems))
            return
          }
        }
      }

      // Fallback: fetch all unscoped, then keyword-filter to this category
      const allRes = await fetch('/api/resources?type=topical-authority')
      if (allRes.ok) {
        const allData = await allRes.json()
        const allTopics = allData.items || []
        if (collectionSlug && allTopics.length > 0) {
          // Keyword-filter: keep items whose title/keyword loosely matches the collection
          const categoryWords = collectionSlug.replace(/-/g, ' ').split(' ')
          const filtered = allTopics.filter((t: { title: string; primaryKeyword: string }) => {
            const text = `${t.title} ${t.primaryKeyword}`.toLowerCase()
            return categoryWords.some((w: string) => w.length > 2 && text.includes(w))
          })
          setAvailableInternalLinks(extractLinks(filtered.length > 0 ? filtered : allTopics))
        } else {
          setAvailableInternalLinks(extractLinks(allTopics))
        }
      }
    } catch (error) {
      console.warn('[loadInternalLinks] Failed to load internal links:', error)
    }
  }, [])

  const loadArticleFromDb = async (article: GeneratedArticle) => {
    if (!article.htmlContent && article.dbId) {
      try {
        const response = await fetch(`/api/articles?id=${article.dbId}`)
        if (response.ok) {
          const fullArticle = await response.json()
          const loaded = {
            ...article,
            htmlContent: fullArticle.html_content,
            metaDescription: fullArticle.meta_description,
            schemaMarkup: fullArticle.schema_markup,
            articleType: fullArticle.article_type ?? article.articleType,
            hasInternalLinks: fullArticle.has_internal_links || false,
            hasImages: fullArticle.has_images || false,
            linkCount: fullArticle.link_count || 0,
            imageCount: fullArticle.image_count || 0,
            featuredImage: fullArticle.featured_image_url
              ? { id: `feat-${article.id}`, prompt: '', url: fullArticle.featured_image_url, altText: fullArticle.featured_image_alt || article.title, placement: 'featured' as const }
              : undefined,
            imageStoryboard: fullArticle.image_storyboard || null,
          }
          setCurrentArticle(loaded)
          await loadInternalLinksForArticle(loaded)
          return
        }
      } catch (error) {
        console.error('Failed to fetch article:', error)
      }
    }
    setCurrentArticle(article)
    await loadInternalLinksForArticle(article)
  }

  // Compute workflow steps for sidebar
  const workflowSteps = currentArticle ? [
    { label: 'Content', status: 'done' as const },
    { label: 'Internal Links', status: currentArticle.hasInternalLinks ? 'done' as const : activeView === 'article-links' ? 'current' as const : 'pending' as const },
    { label: 'Images', status: currentArticle.hasImages ? 'done' as const : activeView === 'article-images' ? 'current' as const : 'pending' as const },
  ] : []

  const draftCount = articles.filter(a => a.status === 'draft').length

  // Article badges for sidebar
  const articleBadges = currentArticle ? {
    content: currentArticle.wordCount ? `${Math.round(currentArticle.wordCount / 1000)}k` : undefined,
    links: currentArticle.hasInternalLinks ? `${currentArticle.linkCount || 0}` : undefined,
    linksVariant: currentArticle.hasInternalLinks ? 'green' as const : 'grey' as const,
    images: currentArticle.hasImages ? `${currentArticle.imageCount || 0}` : undefined,
    imagesVariant: currentArticle.hasImages ? 'green' as const : 'grey' as const,
  } : undefined

  // Close current article and return to library
  const handleCloseArticle = () => {
    setCurrentArticle(null)
    setIsEditing(false)
    setActiveView('library')
  }

  // Handle sidebar navigation -- when clicking article-* views without an article, redirect to library
  const handleNavigate = (view: ViewId) => {
    if ((view.startsWith('article-') || view === 'publish-confirm') && !currentArticle) {
      toast.error('No article selected', { description: 'Pick an article from the library first.' })
      setActiveView('library')
      return
    }
    // Clear stale revamp state when entering revamp-input fresh
    if (view === 'revamp-input') {
      setRevampAnalysis(null)
      setRevampOriginalContent('')
      setRevampCitations([])
      setRevampSettings(null)
    }
    setActiveView(view)
  }

  return (
    <div className="grid h-screen overflow-hidden" style={{ gridTemplateColumns: sidebarCollapsed ? '56px 1fr' : 'var(--sidebar-w) 1fr', gridTemplateRows: 'var(--header-h) 1fr', transition: 'grid-template-columns 0.2s ease' }}>
      {/* Topbar */}
      <div style={{ gridColumn: '1 / -1', gridRow: '1' }}>
        <AppTopbar isGenerating={isGenerating} generationMessage={generationMessage} />
      </div>

      {/* Sidebar */}
      <div style={{ gridRow: '2', gridColumn: '1', overflow: 'hidden' }}>
        <AppSidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          articleCounts={{ drafts: draftCount, published: articles.filter(a => a.status === 'published').length }}
          workflowSteps={workflowSteps}
          hasCurrentArticle={!!currentArticle}
          currentArticleTitle={currentArticle?.title}
          articleBadges={articleBadges}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        />
      </div>

      {/* Main Content */}
      <main className="flex flex-col overflow-hidden" style={{ gridRow: '2', gridColumn: '2', background: 'var(--bg-warm)' }}>
        {/* Article Context Bar — persistent when an article is loaded */}
        {currentArticle && activeView !== 'revamp-input' && activeView !== 'revamp-analysis' && (
          <ArticleContextBar
            title={currentArticle.title}
            status={currentArticle.status || 'draft'}
            wordCount={currentArticle.wordCount}
            category={currentArticle.category}
            activeView={activeView}
            hasLinks={currentArticle.hasInternalLinks || false}
            hasImages={currentArticle.hasImages || false}
            onNavigate={handleNavigate}
            onClose={handleCloseArticle}
          />
        )}

        {/* === Revamp Input View === */}
        {activeView === 'revamp-input' && (
          <RevampArticleView
            onAnalysisComplete={(analysis: any, originalContent: string, citations: any[], settings: any) => {
              setRevampAnalysis(analysis)
              setRevampOriginalContent(originalContent)
              setRevampCitations(citations)
              setRevampSettings(settings)
              setActiveView('revamp-analysis')
            }}
          />
        )}

        {/* === Revamp Analysis View === */}
        {activeView === 'revamp-analysis' && revampAnalysis && (
          <RevampAnalysisView
            analysis={revampAnalysis}
            originalContent={revampOriginalContent}
            citations={revampCitations.map(c => ({ ...c, title: c.title || c.url }))}
            settings={revampSettings}
            onGenerateComplete={(article: GeneratedArticle) => {
              setCurrentArticle(article)
              setArticles(prev => [article, ...prev])
              setActiveView('article-content')
            }}
            onBack={() => setActiveView('revamp-input')}
            onStartOver={() => {
              setRevampAnalysis(null)
              setRevampOriginalContent('')
              setRevampCitations([])
              setRevampSettings(null)
              setActiveView('revamp-input')
            }}
            generateSlug={generateSlug}
            generateSchemaMarkup={generateSchemaMarkup}
            saveArticleToDb={saveArticleToDb}
          />
        )}

        {/* === New Article View === */}
        {activeView === 'new-article' && !currentArticle && generationStep === 'idle' && !isGenerating && (
          <NewArticleView onGenerate={handleGenerate} isGenerating={isGenerating} />
        )}

        {/* === Generation Progress === */}
        {(activeView === 'new-article' && isGenerating) && (
          <div className="flex flex-1 items-center justify-center p-10" style={{ background: 'var(--bg-warm)' }}>
            <div className="w-full max-w-[560px] rounded-xl border p-9" style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <GenerationProgress step={generationStep} progress={generationProgress} message={generationMessage} />
            </div>
          </div>
        )}

        {/* === New Article view when an article is already loaded — offer to start fresh === */}
        {activeView === 'new-article' && currentArticle && !isGenerating && (
          <div className="flex flex-1 items-center justify-center p-10" style={{ background: 'var(--bg-warm)' }}>
            <div className="w-full max-w-[440px] rounded-xl border p-8 text-center" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
              <p className="text-[15px] font-medium mb-1" style={{ color: 'var(--text1)' }}>
                You&apos;re currently editing &ldquo;{currentArticle.title}&rdquo;
              </p>
              <p className="text-[13px] mb-6" style={{ color: 'var(--text3)' }}>
                Close the current article to create a new one, or go back to continue editing.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setActiveView('article-content')}
                  className="rounded-lg px-4 py-2 text-[13px] font-medium border"
                  style={{ color: 'var(--text2)', borderColor: 'var(--border)' }}
                >
                  Back to article
                </button>
                <button
                  onClick={() => { setCurrentArticle(null); setIsEditing(false) }}
                  className="rounded-lg px-4 py-2 text-[13px] font-medium text-white"
                  style={{ background: 'var(--nn-accent)' }}
                >
                  Start new article
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === Article Content View === */}
        {activeView === 'article-content' && currentArticle && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {!isEditing ? (
                <ArticlePreview
                  article={currentArticle}
                  onEdit={() => setIsEditing(true)}
                  onContentUpdate={handleContentUpdate}
                  onStatusChange={handleStatusChange}
                  onPublish={() => setActiveView('publish-confirm')}
                  internalLinks={availableInternalLinks}
                  onGoToStep={() => setActiveView('article-links')}
                />
              ) : (
                <ArticleEditor article={currentArticle} onSave={handleSaveEdit} onCancel={() => setIsEditing(false)} />
              )}
            </div>
          </div>
        )}

        {/* === Article Links View === */}
        {activeView === 'article-links' && currentArticle && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <LinkReviewer
                article={currentArticle}
                internalLinks={availableInternalLinks}
                collectionsLinks={availableCollectionsLinks}
                onApplyLinks={handleApplyLinks}
                onNext={() => setActiveView('article-images')}
                onBack={() => setActiveView('article-content')}
              />
            </div>
          </div>
        )}

        {/* === Article Images View === */}
        {activeView === 'article-images' && currentArticle && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <ImageStoryboard
                article={currentArticle}
                onInsertImages={handleInsertImages}
                onStoryboardChange={handleStoryboardChange}
                onBack={() => setActiveView('article-links')}
                onSkip={() => setActiveView('article-content')}
              />
            </div>
          </div>
        )}

        {/* === Article SEO View (split: content + SEO sidebar) === */}
        {activeView === 'article-seo' && currentArticle && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Article content */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <ArticlePreview
                  article={currentArticle}
                  onEdit={() => { setIsEditing(true); setActiveView('article-content') }}
                  onContentUpdate={handleContentUpdate}
                  onStatusChange={handleStatusChange}
                  onPublish={() => setActiveView('publish-confirm')}
                  internalLinks={availableInternalLinks}
                  onGoToStep={() => setActiveView('article-links')}
                />
              </div>
            </div>
            {/* Right: SEO panel */}
            <div className="w-[340px] flex-shrink-0 border-l overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
              <SeoAnalysisView article={currentArticle} />
            </div>
          </div>
        )}

        {/* === Library View === */}
        {activeView === 'library' && (
          <div className="flex-1 overflow-hidden">
            <ArticleHistory
              articles={articles}
              onSelect={(article) => {
                loadArticleFromDb(article)
                setIsEditing(false)
                setActiveView('article-content')
              }}
              onDelete={handleDeleteArticle}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}

        {/* === Queue View (Kanban) === */}
        {activeView === 'queue' && (
          <ContentQueueView
            articles={articles}
            onNewArticle={() => setActiveView('new-article')}
            onOpenArticle={(article) => { loadArticleFromDb(article); setIsEditing(false); setActiveView('article-content') }}
          />
        )}

        {/* === Products View === */}
        {activeView === 'products' && (
          <div className="flex-1 overflow-y-auto p-6">
            <ProductCatalogManager onProductsLoaded={setProductCount} />
          </div>
        )}

        {/* === Resources View === */}
        {activeView === 'resources' && (
          <div className="flex-1 overflow-y-auto p-6">
            <ContentResourcesManager
              onTopicalAuthorityLoaded={setTopicalAuthorityCount}
              onCollectionsLoaded={setCollectionsCount}
            />
          </div>
        )}

        {/* === Bulk Upload View – always mounted so background generation persists === */}
        <div style={{ display: activeView === 'bulk-queue' ? 'contents' : 'none' }}>
          <BulkUploadView
            onArticleGenerated={(article) => {
              setArticles(prev => [article, ...prev])
            }}
            onOpenArticle={(article) => { loadArticleFromDb(article); setIsEditing(false); setActiveView('article-content') }}
            generateSlug={generateSlug}
            generateSchemaMarkup={generateSchemaMarkup}
            saveArticleToDb={saveArticleToDb}
          />
        </div>

        {/* === Auto-Run View === */}
        {activeView === 'auto-run' && (
          <AutoRunView
            onComplete={(article) => {
              setCurrentArticle(article)
              setArticles(prev => {
                const exists = prev.find(a => a.id === article.id)
                return exists ? prev.map(a => a.id === article.id ? article : a) : [article, ...prev]
              })
              setActiveView('article-content')
            }}
            onCancel={() => setActiveView('new-article')}
            generateSlug={generateSlug}
            generateSchemaMarkup={generateSchemaMarkup}
            saveArticleToDb={saveArticleToDb}
          />
        )}

        {/* === Publish Confirmation === */}
        {activeView === 'publish-confirm' && currentArticle && (
          <PublishConfirmView
            article={currentArticle}
            onBackToEditor={() => setActiveView('article-content')}
            onNewArticle={() => { setCurrentArticle(null); setActiveView('new-article') }}
            onViewLibrary={() => setActiveView('library')}
            onViewQueue={() => setActiveView('queue')}
            onStatusChange={handleStatusChange}
          />
        )}

        {/* === Article Workshop === */}
        {activeView === 'workshop' && (
          <ArticleWorkshopView />
        )}

        {/* === Guide === */}
        {activeView === 'guide' && (
          <GuideView onNavigate={setActiveView} />
        )}

        {/* === Technical Guide === */}
        {activeView === 'tech-guide' && (
          <TechnicalGuideView />
        )}

        {/* === Connections === */}
        {activeView === 'connections' && (
          <ConnectionsView />
        )}

        {/* === Logs === */}
        {activeView === 'logs' && (
          <LogsView />
        )}

      </main>
    </div>
  )
}
