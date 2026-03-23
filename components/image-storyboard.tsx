'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ImageIcon,
  Loader2,
  ChevronLeft,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Download,
  Info,
} from 'lucide-react'
import type { ImageConcept, GeneratedArticle, ImageStoryboardDraft } from '@/lib/types'
import { extractImageUrl } from '@/lib/imageUtils'

interface ImageStoryboardProps {
  article: GeneratedArticle
  onInsertImages: (enrichedHtml: string, imageCount: number, featuredImage?: { url: string; altText: string }) => void
  onStoryboardChange: (storyboard: ImageStoryboardDraft | null) => void
  onBack: () => void
  onSkip: () => void
}

function extractSectionHeadings(html: string): Map<string, string> {
  const headings = new Map<string, string>()
  const h2Regex = /<h2[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h2>/gi
  let match: RegExpExecArray | null

  while ((match = h2Regex.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, '').trim()
    const id = match[1] || text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (id && text) headings.set(id, text)
  }

  return headings
}

function enrichConcepts(concepts: ImageConcept[], html: string): ImageConcept[] {
  const headings = extractSectionHeadings(html)
  return concepts.map((concept) => ({
    ...concept,
    targetSectionHeading: concept.targetSectionHeading || (concept.targetSectionId ? headings.get(concept.targetSectionId) : undefined),
  }))
}

export function ImageStoryboard({
  article,
  onInsertImages,
  onStoryboardChange,
  onBack,
  onSkip,
}: ImageStoryboardProps) {
  const initialStoryboard = article.imageStoryboard || null
  const initialConcepts = initialStoryboard?.concepts ? enrichConcepts(initialStoryboard.concepts, article.htmlContent || '') : []
  const [concepts, setConcepts] = useState<ImageConcept[]>(initialConcepts)
  const [isDrafting, setIsDrafting] = useState(false)
  const [isInserting, setIsInserting] = useState(false)   // true when "Insert All" is running
  const [insertingConceptId, setInsertingConceptId] = useState<string | null>(null) // id of card being individually inserted
  const [draftError, setDraftError] = useState<string | null>(null)
  const [insertedIds, setInsertedIds] = useState<Set<string>>(
    () => new Set(initialStoryboard?.insertedIds ?? [])
  )
  const [latestHtmlContent, setLatestHtmlContent] = useState<string>(article.htmlContent || '')
  const [featuredImageState, setFeaturedImageState] = useState<{ url: string; altText: string } | undefined>(initialStoryboard?.featuredImage)
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingConceptsRef = useRef<ImageConcept[] | null>(null)
  const pendingMetaRef = useRef<Partial<ImageStoryboardDraft> | undefined>(undefined)
  const latestMetaRef = useRef<Pick<ImageStoryboardDraft, 'insertedAt' | 'insertedCount' | 'insertedIds' | 'featuredImage'>>({
    insertedAt: initialStoryboard?.insertedAt,
    insertedCount: initialStoryboard?.insertedCount,
    insertedIds: initialStoryboard?.insertedIds,
    featuredImage: initialStoryboard?.featuredImage,
  })

  // Keep latestHtmlContent in sync when the article prop updates (e.g. after link application)
  useEffect(() => {
    if (article.htmlContent && article.htmlContent.length > latestHtmlContent.length) {
      setLatestHtmlContent(article.htmlContent)
    }
  }, [article.htmlContent])

  // Re-fetch latest HTML from DB on mount to ensure we have post-link version
  // This prevents the race condition where links are applied but state hasn't propagated
  useEffect(() => {
    if (!article.dbId) return
    let cancelled = false
    fetch(`/api/articles?id=${article.dbId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (!cancelled && data?.html_content && data.html_content.length > (article.htmlContent || '').length) {
          console.log('[image-storyboard] Loaded fresher HTML from DB (has links)')
          setLatestHtmlContent(data.html_content)
        }
        if (!cancelled && data?.image_storyboard?.concepts?.length) {
          const restored = enrichConcepts(data.image_storyboard.concepts, data.html_content || article.htmlContent || '')
          setConcepts(restored)
          setInsertedIds(new Set(data.image_storyboard.insertedIds ?? []))
          setFeaturedImageState(data.image_storyboard.featuredImage)
          latestMetaRef.current = {
            insertedAt: data.image_storyboard.insertedAt,
            insertedCount: data.image_storyboard.insertedCount,
            insertedIds: data.image_storyboard.insertedIds,
            featuredImage: data.image_storyboard.featuredImage,
          }
        }
      })
      .catch((err) => {
        console.warn('[image-storyboard] Could not refresh HTML from DB:', err.message)
      })
    return () => { cancelled = true }
  }, [article.dbId, article.htmlContent])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        if (pendingConceptsRef.current) {
          void persistStoryboard(pendingConceptsRef.current, pendingMetaRef.current)
        }
      }
    }
  }, [])

  const generatedConcepts = concepts.filter(c => c.status === 'generated')

  const persistStoryboard = async (
    nextConcepts: ImageConcept[],
    meta?: Partial<ImageStoryboardDraft>,
  ) => {
    const nextInsertedIds = meta?.insertedIds ?? latestMetaRef.current.insertedIds
    const nextStoryboard: ImageStoryboardDraft = {
      version: 1,
      concepts: nextConcepts,
      insertedAt: meta?.insertedAt ?? latestMetaRef.current.insertedAt,
      insertedCount: meta?.insertedCount ?? latestMetaRef.current.insertedCount,
      insertedIds: nextInsertedIds,
      featuredImage: meta?.featuredImage ?? latestMetaRef.current.featuredImage,
      updatedAt: new Date().toISOString(),
    }

    onStoryboardChange(nextStoryboard)

    latestMetaRef.current = {
      insertedAt: nextStoryboard.insertedAt,
      insertedCount: nextStoryboard.insertedCount,
      insertedIds: nextStoryboard.insertedIds,
      featuredImage: nextStoryboard.featuredImage,
    }

    if (!article.dbId) return

    try {
      const response = await fetch('/api/articles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: article.dbId,
          image_storyboard: nextStoryboard,
          featured_image_url: nextStoryboard.featuredImage?.url,
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setPersistenceWarning(null)
    } catch (error) {
      console.error('[image-storyboard] Failed to persist storyboard:', error)
      setPersistenceWarning('Storyboard changes may not persist if you leave this page.')
    }
  }

  const schedulePersist = (nextConcepts: ImageConcept[], meta?: Partial<ImageStoryboardDraft>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    pendingConceptsRef.current = nextConcepts
    pendingMetaRef.current = meta
    saveTimerRef.current = setTimeout(() => {
      pendingConceptsRef.current = null
      pendingMetaRef.current = undefined
      void persistStoryboard(nextConcepts, meta)
    }, 500)
  }

  const handleDraftConcepts = async () => {
    if (concepts.length > 0 && !window.confirm('Re-draft concepts? This will replace your current prompts and generated storyboard state.')) {
      return
    }

    setIsDrafting(true)
    setDraftError(null)
    setConcepts([])
    setInsertedIds(new Set())
    setFeaturedImageState(undefined)
    onStoryboardChange(null)
    latestMetaRef.current = {
      insertedAt: undefined,
      insertedCount: undefined,
      insertedIds: undefined,
      featuredImage: undefined,
    }

    try {
      const response = await fetch('/api/articles/draft-image-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent: article.htmlContent,
          articleTitle: article.title,
          articleKeyword: article.keyword,
          category: article.category,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to draft concepts')

      const nextConcepts = enrichConcepts(data.concepts || [], latestHtmlContent || article.htmlContent || '')
      setConcepts(nextConcepts)
      await persistStoryboard(nextConcepts, {
        insertedAt: undefined,
        insertedCount: undefined,
        insertedIds: [],
        featuredImage: undefined,
      })
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : 'Failed to draft concepts')
    } finally {
      setIsDrafting(false)
    }
  }

  const handleGenerateImage = async (conceptId: string) => {
    setConcepts(prev =>
      prev.map(c => (c.id === conceptId ? { ...c, status: 'generating' as const } : c))
    )

    try {
      const concept = concepts.find(c => c.id === conceptId)
      if (!concept) return

      const response = await fetch('/api/articles/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: concept.editedPrompt || concept.prompt,
          conceptId,
          imageType: concept.type || 'technical',
          model: 'gemini-3.1-flash-image-preview',
          title: article.title, // always send — route only injects it for featured images
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to generate')

      const nextConcepts = concepts.map(c =>
        c.id === conceptId
          ? { ...c, imageUrl: data.imageUrl, status: 'generated' as const, errorMessage: undefined }
          : c
      )
      setConcepts(nextConcepts)
      await persistStoryboard(nextConcepts)
    } catch (error) {
      console.error('Generate image failed:', error)
      const message = error instanceof Error ? error.message : 'Image generation failed.'
      toast.error('Image generation failed', { description: message })
      const nextConcepts = concepts.map(c => (
        c.id === conceptId
          ? { ...c, status: 'error' as const, errorMessage: message }
          : c
      ))
      setConcepts(nextConcepts)
      await persistStoryboard(nextConcepts)
    }
  }

  const [isGeneratingAll, setIsGeneratingAll] = useState(false)

  const handleGenerateAll = async () => {
    const toGenerate = concepts.filter(c => c.status === 'draft' || c.status === 'error')
    if (toGenerate.length === 0) return
    setIsGeneratingAll(true)
    for (const concept of toGenerate) {
      await handleGenerateImage(concept.id)
    }
    setIsGeneratingAll(false)
  }

  const handleEditPrompt = (conceptId: string, newPrompt: string) => {
    const nextConcepts = concepts.map(c => (c.id === conceptId ? { ...c, editedPrompt: newPrompt } : c))
    setConcepts(nextConcepts)
    schedulePersist(nextConcepts)
  }

  // ── Shared Shopify upload helper ───────────────────────────────────────────
  const uploadToShopify = async (imageUrl: string, altText: string): Promise<string> => {
    if (imageUrl.includes('cdn.shopify.com')) return imageUrl
    const res = await fetch('/api/articles/upload-to-shopify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, altText }),
    })
    if (!res.ok) throw new Error(`Shopify upload HTTP ${res.status}`)
    const data = await res.json()
    return data.shopifyUrl || imageUrl
  }

  // ── Inject one body concept into the current HTML ──────────────────────────
  // Returns {newHtml, inserted} — does NOT mutate state itself.
  const injectBodyImage = (
    concept: ImageConcept,
    html: string,
    sectionsAlreadyUsed: Set<string>,
  ): { newHtml: string; inserted: boolean; sectionId: string | null } => {
    const altText = (concept.altText || concept.label || 'Article illustration').replace(/"/g, '&quot;')
    const cleanUrl = extractImageUrl(concept.imageUrl || '')
    if (!cleanUrl) return { newHtml: html, inserted: false, sectionId: null }

    const figureTag = `\n<figure class="nn-content-image"><img src="${cleanUrl}" alt="${altText}" loading="lazy" /></figure>\n`

    // Primary: match by targetSectionId
    if (concept.targetSectionId && !sectionsAlreadyUsed.has(concept.targetSectionId)) {
      const sectionRegex = new RegExp(
        `(<h2[^>]*id="${concept.targetSectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>[\\s\\S]*?<\\/h2>)`,
        'i'
      )
      const m = sectionRegex.exec(html)
      if (m) {
        const insertPos = m.index + m[0].length
        const before = html.slice(Math.max(0, insertPos - 500), insertPos)
        if (!before.includes('nn-product-card') && !before.includes('featured-products')) {
          return {
            newHtml: html.slice(0, insertPos) + figureTag + html.slice(insertPos),
            inserted: true,
            sectionId: concept.targetSectionId,
          }
        }
      }
    }

    // Fallback: label-based heading match
    const cleanLabel = (concept.label || '')
      .replace(/^(featured|figure\s*\d*|content|technical|lifestyle|comparison|infographic)\s*[:–\-]\s*/i, '')
      .trim()
      .toLowerCase()
    const labelWords = cleanLabel.split(/\s+/).filter((w: string) => w.length > 3)
    const headingRegex = /(<h2[^>]*(?:id="([^"]*)")?[^>]*>)(.*?)(<\/h2>)/gi
    let match
    let bestMatch: { index: number; sectionId: string } | null = null
    let bestScore = 0

    while ((match = headingRegex.exec(html)) !== null) {
      const sectionId = match[2] || ''
      if (sectionsAlreadyUsed.has(sectionId)) continue
      const before = html.slice(Math.max(0, match.index - 300), match.index)
      if (before.includes('nn-product-card') || before.includes('featured-products')) continue
      const headingText = match[3].replace(/<[^>]*>/g, '').toLowerCase()
      const score = labelWords.filter((w: string) => headingText.includes(w)).length
      if (score > bestScore) {
        bestScore = score
        bestMatch = { index: match.index + match[0].length, sectionId }
      }
    }

    if (bestMatch && bestScore >= Math.min(2, labelWords.length)) {
      return {
        newHtml: html.slice(0, bestMatch.index) + figureTag + html.slice(bestMatch.index),
        inserted: true,
        sectionId: bestMatch.sectionId || null,
      }
    }

    return { newHtml: html, inserted: false, sectionId: null }
  }

  // ── Insert a single concept by ID ──────────────────────────────────────────
  const handleInsertOne = async (conceptId: string) => {
    const concept = concepts.find(c => c.id === conceptId)
    if (!concept?.imageUrl || concept.status !== 'generated') return
    if (insertedIds.has(conceptId)) return  // already placed

    setInsertingConceptId(conceptId)
    try {
      if (concept.type === 'featured') {
        let featUrl = concept.imageUrl
        const featAlt = concept.altText || article.title
        try {
          featUrl = await uploadToShopify(concept.imageUrl, `${article.title} - Naked Nutrition`)
        } catch (e) {
          console.error('[image-storyboard] Featured Shopify upload failed:', e)
          toast.warning('Featured image upload failed', { description: 'Using temporary URL — re-upload before publishing.' })
        }
        // Update concept with CDN URL
        const nextConcepts = concepts.map(c => c.id === conceptId ? { ...c, imageUrl: featUrl } : c)
        setConcepts(nextConcepts)
        const featuredImage = { url: featUrl, altText: featAlt }
        setFeaturedImageState(featuredImage)
        const newIds = new Set([...insertedIds, conceptId])
        setInsertedIds(newIds)
        const bodyCount = nextConcepts.filter(c => c.type !== 'featured' && newIds.has(c.id)).length
        await persistStoryboard(nextConcepts, {
          insertedAt: new Date().toISOString(),
          insertedCount: bodyCount,
          insertedIds: [...newIds],
          featuredImage,
        })
        onInsertImages(latestHtmlContent, bodyCount, featuredImage)
        toast.success('Featured image set')
      } else {
        // Upload to Shopify first
        let imageUrl = concept.imageUrl
        try {
          imageUrl = await uploadToShopify(concept.imageUrl, concept.altText || concept.label)
          const nextConcepts = concepts.map(c => c.id === conceptId ? { ...c, imageUrl } : c)
          setConcepts(nextConcepts)
        } catch (e) {
          console.error(`[image-storyboard] Shopify upload failed for "${concept.label}":`, e)
          toast.warning(`Shopify upload failed for "${concept.label?.slice(0, 30)}"`, { description: 'Using temporary URL.' })
        }

        // Build set of sections already occupied by previously inserted body images
        const sectionsUsed = new Set<string>()
        for (const c of concepts) {
          if (c.type !== 'featured' && insertedIds.has(c.id) && c.targetSectionId) {
            sectionsUsed.add(c.targetSectionId)
          }
        }

        let html = latestHtmlContent || article.htmlContent || ''
        // Strip stale placeholders
        html = html.replace(/<img[^>]*src="?\[IMAGE_PLACEHOLDER_\d+\]"?[^>]*\/?>/gi, '')
        html = html.replace(/\[IMAGE_PLACEHOLDER_\d+\]/g, '')

        const { newHtml, inserted, sectionId } = injectBodyImage({ ...concept, imageUrl }, html, sectionsUsed)

        if (inserted) {
          setLatestHtmlContent(newHtml)
          const newIds = new Set([...insertedIds, conceptId])
          setInsertedIds(newIds)
          const bodyCount = concepts.filter(c => c.type !== 'featured' && newIds.has(c.id)).length + 1
          await persistStoryboard(concepts, {
            insertedAt: new Date().toISOString(),
            insertedCount: bodyCount,
            insertedIds: [...newIds],
            featuredImage: featuredImageState,
          })
          onInsertImages(newHtml, bodyCount, featuredImageState)
          toast.success(`Image inserted after "${sectionId || concept.targetSectionId || 'matching section'}"`)
        } else {
          toast.warning(`Couldn't find a matching section for "${concept.label}"`, {
            description: 'Try editing the prompt or using Insert All which uses a broader matching strategy.',
          })
        }
      }
    } catch (error) {
      console.error('[image-storyboard] handleInsertOne failed:', error)
      toast.error('Insert failed')
    } finally {
      setInsertingConceptId(null)
    }
  }

  // ── Insert all remaining (not yet placed) generated concepts ───────────────
  const handleInsertAll = async () => {
    const toInsert = generatedConcepts.filter(c => !insertedIds.has(c.id))
    if (toInsert.length === 0) return
    setIsInserting(true)

    try {
      // Upload all to Shopify first in parallel
      const uploadedConcepts = await Promise.all(
        toInsert.map(async c => {
          if (!c.imageUrl) return c
          const altText = c.type === 'featured'
            ? `${article.title} - Naked Nutrition`
            : (c.altText || c.label)
          try {
            const url = await uploadToShopify(c.imageUrl, altText)
            return { ...c, imageUrl: url }
          } catch {
            toast.warning(`Shopify upload failed for "${c.label?.slice(0, 30)}"`, { description: 'Using temporary URL.' })
            return c
          }
        })
      )

      // Update concepts with CDN URLs
      const conceptMap = new Map(uploadedConcepts.map(c => [c.id, c]))
      const nextConcepts = concepts.map(c => conceptMap.get(c.id) ?? c)
      setConcepts(nextConcepts)

      // Handle featured image
      const featuredConcept = uploadedConcepts.find(c => c.type === 'featured')
      const featuredImage = featuredConcept?.imageUrl
        ? { url: featuredConcept.imageUrl, altText: featuredConcept.altText || article.title }
        : featuredImageState

      if (featuredConcept && featuredImage) {
        setFeaturedImageState(featuredImage)
      }

      // Insert body images sequentially into HTML
      let html = latestHtmlContent || article.htmlContent || ''
      html = html.replace(/<img[^>]*src="?\[IMAGE_PLACEHOLDER_\d+\]"?[^>]*\/?>/gi, '')
      html = html.replace(/\[IMAGE_PLACEHOLDER_\d+\]/g, '')
      html = html.replace(
        /(<div[^>]*class="[^"]*nn-product-card[^"]*"[^>]*>)([\s\S]*?)(<\/div>\s*<\/div>\s*<\/div>)/gi,
        (match) => match.replace(/<figure[^>]*class="nn-content-image"[^>]*>[\s\S]*?<\/figure>/gi, '')
      )

      const sectionsUsed = new Set<string>()
      // Pre-populate from already-inserted concepts
      for (const c of concepts) {
        if (c.type !== 'featured' && insertedIds.has(c.id) && c.targetSectionId) {
          sectionsUsed.add(c.targetSectionId)
        }
      }

      const newlyInsertedIds = new Set<string>()
      // Add featured if present
      if (featuredConcept) newlyInsertedIds.add(featuredConcept.id)

      for (const concept of uploadedConcepts.filter(c => c.type !== 'featured')) {
        if (!concept.imageUrl) continue
        const { newHtml, inserted, sectionId } = injectBodyImage(concept, html, sectionsUsed)
        if (inserted) {
          html = newHtml
          newlyInsertedIds.add(concept.id)
          if (sectionId) sectionsUsed.add(sectionId)
        }
      }

      const allInsertedIds = new Set([...insertedIds, ...newlyInsertedIds])
      setInsertedIds(allInsertedIds)
      setLatestHtmlContent(html)

      const bodyCount = nextConcepts.filter(c => c.type !== 'featured' && allInsertedIds.has(c.id)).length
      const insertedAt = new Date().toISOString()
      await persistStoryboard(nextConcepts, {
        insertedAt,
        insertedCount: bodyCount,
        insertedIds: [...allInsertedIds],
        featuredImage,
      })
      onInsertImages(html, bodyCount, featuredImage)
    } catch (error) {
      console.error('Failed to insert images:', error)
      toast.error('Insert failed')
    } finally {
      setIsInserting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
      {/* Header */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <ImageIcon className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Step 3: Visual Concepts</CardTitle>
                <CardDescription>
                  Draft 1 featured image concept and 3 inline section image concepts, then review and generate them before inserting.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
                <ChevronLeft className="h-4 w-4" />
                Back to Links
              </Button>
              <Button variant="ghost" size="sm" onClick={onSkip} className="gap-1.5 text-muted-foreground hover:text-foreground">
                Skip Images
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Phase A: Draft Concepts */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Phase A: Concept Drafting</p>
              <p className="text-xs text-muted-foreground">
                AI drafts 4 image prompts: 1 featured image for the top of the article and 3 inline images tied to article sections
              </p>
            </div>
            <Button
              onClick={handleDraftConcepts}
              disabled={isDrafting}
              className="gap-1.5"
            >
              {isDrafting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Drafting...
                </>
              ) : concepts.length > 0 ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Re-Draft Concepts
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Draft Visual Concepts
                </>
              )}
            </Button>
          </div>

          {/* ── Image Model Selector ── */}
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <label className="text-[10px] font-mono font-medium tracking-[0.6px] uppercase mb-1.5 block" style={{ color: 'var(--text3)' }}>
              Image Model
            </label>
          </div>

          {draftError && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{draftError}</span>
            </div>
          )}

          {persistenceWarning && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{persistenceWarning}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase B: Storyboard Cards */}
      {concepts.length > 0 && (
        <div className="space-y-4">
          <Card className="border-border/50 bg-muted/20">
            <CardContent className="flex flex-col gap-3 pt-6 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Info className="h-4 w-4 text-muted-foreground" />
                Placement Guide
              </div>
              <p className="text-xs text-muted-foreground">
                Featured image: shown at the top of the article on publish.
              </p>
              <p className="text-xs text-muted-foreground">
                Inline image: inserted after its assigned section heading when you click insert.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Phase B: Storyboard
            </h3>
            <div className="flex items-center gap-2">
              {generatedConcepts.length > 0 && (
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {generatedConcepts.length} / {concepts.length} generated
                </Badge>
              )}
              {concepts.some(c => c.status === 'draft' || c.status === 'error') && (
                <Button
                  size="sm"
                  onClick={handleGenerateAll}
                  disabled={isGeneratingAll}
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isGeneratingAll ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate All Images
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {concepts.map((concept, index) => (
            <ConceptCard
              key={concept.id}
              concept={concept}
              index={index}
              onGenerate={() => handleGenerateImage(concept.id)}
              onEditPrompt={(prompt) => handleEditPrompt(concept.id, prompt)}
              isInserted={insertedIds.has(concept.id)}
              isInsertingThis={insertingConceptId === concept.id}
              anyInserting={isInserting || insertingConceptId !== null}
              onInsert={() => handleInsertOne(concept.id)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {concepts.length === 0 && !isDrafting && !draftError && (
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No visual concepts yet</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Click &ldquo;Draft Visual Concepts&rdquo; to generate image prompts
            </p>
          </CardContent>
        </Card>
      )}
        </div>{/* end space-y-6 */}
      </div>{/* end scrollable area */}

      {/* -- Sticky Footer -- */}
      {(() => {
        const remaining = generatedConcepts.filter(c => !insertedIds.has(c.id))
        const placedCount = generatedConcepts.length - remaining.length
        const allPlaced = generatedConcepts.length > 0 && remaining.length === 0
        const anyPlaced = placedCount > 0
        const anyInserting = isInserting || insertingConceptId !== null

        if (generatedConcepts.length === 0) return null

        if (allPlaced) {
          const bodyPlaced = concepts.filter(c => c.type !== 'featured' && insertedIds.has(c.id)).length
          return (
            <div className="flex-shrink-0 border-t px-6 py-4" style={{ background: 'color-mix(in srgb, #16a34a 8%, var(--bg))', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800">
                      {(featuredImageState ? '1 featured image set · ' : '') + `${bodyPlaced} inline image${bodyPlaced === 1 ? '' : 's'} inserted`}
                    </p>
                    <p className="text-xs text-green-700/70">
                      All images placed — featured image is set separately on Shopify
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={onSkip} className="gap-1.5">
                  <ChevronLeft className="h-4 w-4" />
                  Back to Editor
                </Button>
              </div>
            </div>
          )
        }

        return (
          <div className="flex-shrink-0 border-t px-6 py-4" style={{ background: 'color-mix(in srgb, var(--nn-accent) 6%, var(--bg))', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                {anyPlaced ? (
                  <p className="text-sm font-medium" style={{ color: 'var(--text1)' }}>
                    {placedCount} of {generatedConcepts.length} placed · {remaining.length} remaining
                  </p>
                ) : (
                  <p className="text-sm font-medium" style={{ color: 'var(--text1)' }}>
                    {generatedConcepts.length} image{generatedConcepts.length > 1 ? 's' : ''} ready to insert
                  </p>
                )}
                <p className="text-xs" style={{ color: 'var(--text3)' }}>
                  Use the Insert button on each card, or insert all at once below
                </p>
              </div>
              <Button
                onClick={handleInsertAll}
                disabled={anyInserting}
                className="gap-1.5 shrink-0"
              >
                {isInserting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Inserting...
                  </>
                ) : (
                  <>
                    <Download className="mr-1.5 h-4 w-4" />
                    {anyPlaced ? `Insert ${remaining.length} Remaining` : `Insert All ${generatedConcepts.length}`}
                  </>
                )}
              </Button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// --- Individual Concept Card ---
function ConceptCard({
  concept,
  index,
  onGenerate,
  onEditPrompt,
  isInserted,
  isInsertingThis,
  anyInserting,
  onInsert,
}: {
  concept: ImageConcept
  index: number
  onGenerate: () => void
  onEditPrompt: (prompt: string) => void
  isInserted: boolean
  isInsertingThis: boolean
  anyInserting: boolean
  onInsert: () => void
}) {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false)
  const currentPrompt = concept.editedPrompt || concept.prompt

  const statusBadge = {
    draft: <Badge variant="secondary" className="text-xs">Draft</Badge>,
    generating: (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        Generating...
      </Badge>
    ),
    generated: (
      <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Generated
      </Badge>
    ),
    error: (
      <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
        <AlertCircle className="mr-1 h-3 w-3" />
        Failed
      </Badge>
    ),
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          {/* Left: Image or Placeholder */}
          <div className="flex w-full items-center justify-center bg-muted/30 lg:w-80 lg:shrink-0">
            {concept.imageUrl ? (
              <img
                src={concept.imageUrl}
                alt={concept.label}
                className="w-full object-contain"
                style={{ aspectRatio: '16/9' }}
              />
            ) : (
              <div
                className="flex w-full flex-col items-center justify-center gap-2 p-8 text-muted-foreground/50"
                style={{ aspectRatio: '16/9' }}
              >
                <ImageIcon className="h-10 w-10" />
                <p className="text-xs font-medium">
                  {concept.status === 'generating' ? 'Generating...' : 'Not generated yet'}
                </p>
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="flex flex-1 flex-col gap-3 p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {concept.type === 'featured' ? 'Featured Image' : `Figure ${index}`}
                  </span>
                  {statusBadge[concept.status]}
                </div>
                <h4 className="text-sm font-medium leading-tight">{concept.label}</h4>
                <p className="text-xs text-muted-foreground">
                  {concept.type === 'featured'
                    ? 'Placement: Featured image at the top of the article'
                    : `Placement: Insert after section "${concept.targetSectionHeading || concept.targetSectionId || 'Best matching section'}"`}
                </p>
              </div>
            </div>

            {/* Prompt (editable) */}
            {isEditingPrompt ? (
              <div className="space-y-2">
                <Textarea
                  value={currentPrompt}
                  onChange={(e) => onEditPrompt(e.target.value)}
                  rows={4}
                  className="text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingPrompt(false)}
                >
                  Done Editing
                </Button>
              </div>
            ) : (
              <div
                className="cursor-pointer rounded-md border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground transition-colors hover:border-border hover:bg-muted/50"
                onClick={() => setIsEditingPrompt(true)}
              >
                {currentPrompt}
                <span className="mt-1 block text-[10px] font-medium text-primary/60">
                  Click to edit prompt
                </span>
              </div>
            )}

            {concept.status === 'error' && concept.errorMessage && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {concept.errorMessage}
              </div>
            )}

            {/* Action row: Generate/Regenerate + Insert */}
            <div className="mt-auto flex items-center justify-between gap-2">
              {/* Insert button — only shown when image is generated */}
              {concept.status === 'generated' && (
                isInserted ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {concept.type === 'featured' ? 'Featured set' : 'Inserted'}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onInsert}
                    disabled={anyInserting}
                    className="gap-1.5 border-[var(--nn-accent)] text-[var(--nn-accent)] hover:bg-[var(--nn-accent-light)]"
                  >
                    {isInsertingThis ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Inserting…
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        {concept.type === 'featured' ? 'Set as Featured' : 'Insert'}
                      </>
                    )}
                  </Button>
                )
              )}
              {concept.status !== 'generated' && <span />}

              {/* Generate / Regenerate */}
              <Button
                size="sm"
                onClick={onGenerate}
                disabled={concept.status === 'generating'}
                variant={concept.status === 'generated' ? 'ghost' : 'default'}
                className="gap-1.5"
              >
                {concept.status === 'generating' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating...
                  </>
                ) : concept.status === 'generated' ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
