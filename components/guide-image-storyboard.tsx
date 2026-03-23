'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  AlertCircle,
  Image as ImageIcon,
  Wand2,
  CheckCircle2,
  Pencil,
} from 'lucide-react'
import type { UltimateGuide } from './ultimate-guide-wizard'
import { assembleCompleteGuideHtml, type AssemblerClusterLink } from '@/lib/guide-assembler'

interface ImageConcept {
  id: string
  label: string
  prompt: string
  altText: string
  type: 'featured' | 'technical'
  targetSectionId: string
  status: 'draft' | 'generating' | 'ready' | 'error'
  image_url?: string
  error?: string
  editedPrompt?: string
}

interface GuideImageStoryboardProps {
  guide: UltimateGuide
  onSave: (guide: UltimateGuide) => void
  onBack: () => void
}

/* ââ Concept Card (matches article storyboard layout) ââ */
function ConceptCard({
  concept,
  index,
  onGenerate,
  onEditPrompt,
}: {
  concept: ImageConcept
  index: number
  onGenerate: () => void
  onEditPrompt: (prompt: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const currentPrompt = concept.editedPrompt || concept.prompt

  const statusBadge = {
    draft: <Badge variant="secondary" className="text-xs">Draft</Badge>,
    generating: (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Generatingâ¦
      </Badge>
    ),
    ready: (
      <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Generated
      </Badge>
    ),
    error: (
      <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
        <AlertCircle className="mr-1 h-3 w-3" /> Failed
      </Badge>
    ),
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          {/* Left: Image or Placeholder */}
          <div className="flex w-full items-center justify-center bg-muted/30 lg:w-80 lg:shrink-0">
            {concept.image_url ? (
              <img
                src={concept.image_url}
                alt={concept.altText || concept.label}
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
                  {concept.status === 'generating' ? 'Generatingâ¦' : 'Not generated yet'}
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
                  Section: {concept.targetSectionId.replace(/-/g, ' ')}
                </p>
              </div>
            </div>

            {/* Alt text */}
            {concept.altText && (
              <p className="text-xs text-muted-foreground/70 italic">Alt: {concept.altText}</p>
            )}

            {/* Error message */}
            {concept.status === 'error' && concept.error && (
              <div className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                {concept.error}
              </div>
            )}

            {/* Prompt (editable) */}
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={currentPrompt}
                  onChange={(e) => onEditPrompt(e.target.value)}
                  rows={4}
                  className="text-xs"
                />
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  Done Editing
                </Button>
              </div>
            ) : (
              <div
                className="cursor-pointer rounded-md border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground transition-colors hover:border-border hover:bg-muted/50"
                onClick={() => setIsEditing(true)}
              >
                {currentPrompt}
                <span className="mt-1 block text-[10px] font-medium text-primary/60">
                  <Pencil className="inline h-2.5 w-2.5 mr-0.5" /> Click to edit prompt
                </span>
              </div>
            )}

            {/* Generate Button */}
            <div className="mt-auto flex justify-end">
              <Button
                size="sm"
                onClick={onGenerate}
                disabled={concept.status === 'generating' || !currentPrompt}
                variant={concept.status === 'ready' ? 'outline' : 'default'}
                className="gap-1.5"
              >
                {concept.status === 'generating' ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generatingâ¦</>
                ) : concept.status === 'ready' ? (
                  <><Sparkles className="h-3.5 w-3.5" /> Regenerate</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> Generate</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ââ Main Component ââ */
export function GuideImageStoryboard({ guide, onSave, onBack }: GuideImageStoryboardProps) {
  const [concepts, setConcepts] = useState<ImageConcept[]>([])
  const [isDrafting, setIsDrafting] = useState(false)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [clusterLinks, setClusterLinks] = useState<AssemblerClusterLink[]>([])

  // Track the last ready-count so we only reassemble when a new image finishes
  const prevReadyCountRef = useRef(0)
  // Track the latest guide data so handleSave always has fresh state.
  // Updated by the useEffect when images finish (without calling onSave).
  const latestGuideRef = useRef(guide)
  // Keep ref in sync if guide prop changes from parent
  useEffect(() => { latestGuideRef.current = guide }, [guide])

  // Load cluster links: from guide.cluster_links first, then fetch from API as fallback
  useEffect(() => {
    const fromGuide: AssemblerClusterLink[] = (guide.cluster_links || [])
      .filter(l => l.url || l.anchor)
      .map(l => ({
        title: l.anchor || l.url,
        slug: l.url?.replace('/blogs/news/', '') || '',
        url: l.url,
        anchor: l.anchor,
      }))

    if (fromGuide.length > 0) {
      setClusterLinks(fromGuide)
      return
    }

    // Fallback: fetch from /api/resources if guide.cluster_links is empty
    if (guide.collection_slug) {
      fetch(`/api/resources?type=topical-authority&collection=${guide.collection_slug}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.links?.length > 0) {
            setClusterLinks(data.links.map((l: { title?: string; slug?: string; url?: string; anchor?: string }) => ({
              title: l.title || l.anchor || '',
              slug: l.slug || '',
              url: l.url || (l.slug ? `/blogs/news/${l.slug}` : ''),
              anchor: l.anchor || l.title || '',
            })))
          }
        })
        .catch(() => {})
    }
  }, [guide.cluster_links, guide.collection_slug])

  const SECTION_ORDER = [
    'key-takeaways', 'what-is', 'how-it-works', 'types',
    'health-benefits', 'how-to-use', 'safety', 'featured-products', 'faq',
  ]

  const getGuideHtml = () => {
    const sections = guide.section_content as Record<string, string> | undefined
    if (sections && Object.keys(sections).length > 0) {
      const ordered = SECTION_ORDER
        .filter(key => key in sections)
        .map(key => `<h2 id="${key}">${key.replace(/-/g, ' ')}</h2>\n${sections[key]}`)
      // Append any sections not in the defined order
      const extra = Object.keys(sections)
        .filter(key => !SECTION_ORDER.includes(key) && key !== 'meta')
        .map(key => `<h2 id="${key}">${key.replace(/-/g, ' ')}</h2>\n${sections[key]}`)
      return [...ordered, ...extra].join('\n\n')
    }
    return guide.html_content || ''
  }

  /* Draft prompts from guide content using Claude */
  const handleDraftPrompts = async () => {
    setIsDrafting(true)
    setDraftError(null)
    try {
      const htmlContent = getGuideHtml()
      if (!htmlContent || htmlContent.length < 100) {
        setDraftError('Guide content is too short. Please generate content in the previous step first.')
        return
      }
      const res = await fetch('/api/ultimate-guides/draft-image-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent,
          guideTitle: guide.title,
          topicShort: guide.topic_short,
          collectionSlug: guide.collection_slug,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to draft prompts')
      }
      const data = await res.json()
      if (data.concepts && data.concepts.length > 0) {
        setConcepts(data.concepts.map((c: { id: string; label: string; prompt: string; altText: string; type: string; targetSectionId: string }) => ({
          id: c.id,
          label: c.label,
          prompt: c.prompt,
          altText: c.altText || '',
          type: c.type as 'featured' | 'technical',
          targetSectionId: c.targetSectionId,
          status: 'draft' as const,
        })))
      }
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Failed to draft prompts')
    } finally {
      setIsDrafting(false)
    }
  }

  /* Generate a single image with Gemini, then upload to Shopify CDN */
  const handleGenerateImage = async (id: string) => {
    const concept = concepts.find(c => c.id === id)
    if (!concept) return
    const currentPrompt = concept.editedPrompt || concept.prompt
    if (!currentPrompt) return

    setConcepts(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'generating' as const, error: undefined } : c
    ))

    try {
      const res = await fetch('/api/articles/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: currentPrompt,
          conceptId: concept.id,
          imageType: concept.type,
          title: concept.type === 'featured' ? guide.title : undefined,
        }),
      })
      if (!res.ok) throw new Error('Image generation failed')
      const data = await res.json()
      const imageData = data.imageUrl
      if (!imageData) throw new Error('No image returned')

      // Upload to Shopify CDN
      const uploadRes = await fetch('/api/articles/upload-to-shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageData,
          altText: `${concept.altText || concept.label} - Naked Nutrition`,
        }),
      })
      if (!uploadRes.ok) throw new Error('CDN upload failed')
      const uploadData = await uploadRes.json()

      setConcepts(prev => prev.map(c =>
        c.id === id
          ? { ...c, image_url: uploadData.shopifyUrl, status: 'ready' as const }
          : c
      ))
    } catch (err) {
      setConcepts(prev => prev.map(c =>
        c.id === id
          ? { ...c, status: 'error' as const, error: err instanceof Error ? err.message : 'Failed' }
          : c
      ))
    }
  }

  /* Generate all pending images sequentially */
  const handleGenerateAll = async () => {
    setIsGeneratingAll(true)
    const pending = concepts.filter(c => c.status === 'draft' || c.status === 'error')
    for (const concept of pending) {
      await handleGenerateImage(concept.id)
    }
    setIsGeneratingAll(false)
  }

  const handleEditPrompt = (id: string, prompt: string) => {
    setConcepts(prev => prev.map(c => c.id === id ? { ...c, editedPrompt: prompt } : c))
  }

  /* Auto-reassemble HTML whenever a new image finishes generating */
  useEffect(() => {
    const currentReadyCount = concepts.filter(c => c.status === 'ready').length
    if (currentReadyCount > prevReadyCountRef.current && currentReadyCount > 0) {
      // A new image just finished — rebuild HTML with all current images
      const savedSections = guide.section_content as Record<string, string> | undefined
      const sectionData: Record<string, string> = savedSections ? { ...savedSections } : {}
      const readyConcepts = concepts.filter(c => c.status === 'ready')
      const heroUrl = readyConcepts.find(c => c.type === 'featured')?.image_url
      const allUrls = readyConcepts.map(c => c.image_url).filter(Boolean) as string[]

      for (const concept of readyConcepts) {
        if (!concept.image_url || !concept.targetSectionId || concept.type === 'featured') continue
        const sectionHtml = sectionData[concept.targetSectionId]
        if (!sectionHtml) continue
        // Only inject if this image isn't already in the section
        if (sectionHtml.includes(concept.image_url)) continue
        const imageHtml = `<img src="${concept.image_url}" alt="${concept.altText || concept.label}" style="width:100%;border-radius:8px;margin:1.5em 0;" loading="lazy" width="1200" height="675">`
        const firstParaEnd = sectionHtml.indexOf('</p>')
        if (firstParaEnd !== -1) {
          sectionData[concept.targetSectionId] = sectionHtml.slice(0, firstParaEnd + 4) + '\n' + imageHtml + '\n' + sectionHtml.slice(firstParaEnd + 4)
        } else {
          sectionData[concept.targetSectionId] = imageHtml + '\n' + sectionHtml
        }
      }

      const updatedHeroUrl = heroUrl || guide.hero_image_cdn_url
      const finalHtml = assembleCompleteGuideHtml(
        {
          title: guide.title,
          slug: guide.slug,
          topic_short: guide.topic_short,
          topic_short_plural: guide.topic_short_plural,
          topic_full: guide.topic_full,
          meta_description: guide.meta_description,
          breadcrumb_l2_name: guide.breadcrumb_l2_name,
          breadcrumb_l2_slug: guide.breadcrumb_l2_slug,
          collection_slug: guide.collection_slug,
          hero_image_cdn_url: updatedHeroUrl,
          hero_image_url: guide.hero_image_url,
          date_published: guide.date_published,
          read_time_mins: guide.read_time_mins,
          related_guides: guide.related_guides,
          selected_products: guide.selected_products,
          cluster_links: guide.cluster_links,
        },
        sectionData,
        clusterLinks
      )

      // Persist to DB in the background (silent — handleSave does the authoritative save)
      fetch('/api/ultimate-guides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guide.id,
          html_content: finalHtml,
          hero_image_cdn_url: updatedHeroUrl,
          image_count: allUrls.length,
          has_images: allUrls.length > 0,
          section_content: sectionData,
        }),
      }).catch(() => {})

      // Store latest guide data in ref so handleSave can use it.
      // Do NOT call onSave here — that would navigate the wizard to the
      // review step and abort remaining image generation.
      latestGuideRef.current = {
        ...guide,
        html_content: finalHtml,
        hero_image_cdn_url: updatedHeroUrl,
        image_cdn_urls: allUrls,
        image_count: allUrls.length,
        has_images: allUrls.length > 0,
        section_content: sectionData,
      }
    }
    prevReadyCountRef.current = currentReadyCount
  }, [concepts])

  /* Save images into section_content, then reassemble the complete page */
  const handleSave = async () => {
    const readyConcepts = concepts.filter(c => c.status === 'ready')
    if (readyConcepts.length === 0) {
      alert('Please generate at least one image before continuing.')
      return
    }
    setIsSaving(true)
    try {
      // Start from stored section_content (individual fragments, no shell)
      const savedSections = guide.section_content as Record<string, string> | undefined
      const sectionData: Record<string, string> = savedSections ? { ...savedSections } : {}

      const heroUrl = readyConcepts.find(c => c.type === 'featured')?.image_url
      const allUrls = readyConcepts.map(c => c.image_url).filter(Boolean) as string[]

      // Inject each image into the correct section fragment
      for (const concept of readyConcepts) {
        if (!concept.image_url || !concept.targetSectionId) continue

        const imageHtml = `<img src="${concept.image_url}" alt="${concept.altText || concept.label}" style="width:100%;border-radius:8px;margin:1.5em 0;" loading="lazy" width="1200" height="675">`

        if (concept.type === 'featured') {
          // Hero image is handled at the page-shell level by the assembler
          // (no injection needed into a section)
          continue
        }

        const sectionHtml = sectionData[concept.targetSectionId]
        if (sectionHtml) {
          // Inject after the very first <p> tag so the image floats near the top
          const firstParaEnd = sectionHtml.indexOf('</p>')
          if (firstParaEnd !== -1) {
            sectionData[concept.targetSectionId] =
              sectionHtml.slice(0, firstParaEnd + 4) +
              '\n' + imageHtml + '\n' +
              sectionHtml.slice(firstParaEnd + 4)
          } else {
            // Fallback: prepend if no <p> found
            sectionData[concept.targetSectionId] = imageHtml + '\n' + sectionHtml
          }
        }
      }

      // Reassemble the complete publish-ready page with images + hero in shell
      const updatedHeroUrl = heroUrl || guide.hero_image_cdn_url
      const finalHtml = assembleCompleteGuideHtml(
        {
          title: guide.title,
          slug: guide.slug,
          topic_short: guide.topic_short,
          topic_short_plural: guide.topic_short_plural,
          topic_full: guide.topic_full,
          meta_description: guide.meta_description,
          breadcrumb_l2_name: guide.breadcrumb_l2_name,
          breadcrumb_l2_slug: guide.breadcrumb_l2_slug,
          collection_slug: guide.collection_slug,
          hero_image_cdn_url: updatedHeroUrl,
          hero_image_url: guide.hero_image_url,
          date_published: guide.date_published,
          read_time_mins: guide.read_time_mins,
          related_guides: guide.related_guides,
          selected_products: guide.selected_products,
          cluster_links: guide.cluster_links,
        },
        sectionData,
        clusterLinks
      )

      const updatedGuide: UltimateGuide = {
        ...guide,
        html_content: finalHtml,
        hero_image_cdn_url: updatedHeroUrl,
        image_cdn_urls: allUrls,
        image_count: allUrls.length,
        has_images: true,
        section_content: sectionData,
      }

      await fetch('/api/ultimate-guides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guide.id,
          html_content: finalHtml,
          hero_image_cdn_url: updatedHeroUrl,
          image_count: allUrls.length,
          has_images: true,
          section_content: sectionData,
        }),
      })

      onSave(updatedGuide)
    } finally {
      setIsSaving(false)
    }
  }

  const readyCount = concepts.filter(c => c.status === 'ready').length
  const pendingCount = concepts.filter(c => c.status === 'draft' || c.status === 'error').length
  let figureIndex = 0

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <ImageIcon className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Step 4: Visual Concepts</h2>
                <p className="text-sm text-muted-foreground">
                  Draft prompts from your content, then generate images with Gemini.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {concepts.length > 0 && pendingCount > 0 && (
                <Button
                  onClick={handleGenerateAll}
                  disabled={isGeneratingAll}
                  variant="outline"
                  className="gap-2"
                >
                  {isGeneratingAll ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating {concepts.length - pendingCount}/{concepts.length}â¦</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Generate All ({pendingCount})</>
                  )}
                </Button>
              )}
              <Button
                onClick={handleDraftPrompts}
                disabled={isDrafting}
                className="gap-2"
                style={{ background: 'var(--nn-accent)', color: '#fff' }}
              >
                {isDrafting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Drafting Promptsâ¦</>
                ) : concepts.length > 0 ? (
                  <><Wand2 className="h-4 w-4" /> Re-draft Prompts</>
                ) : (
                  <><Wand2 className="h-4 w-4" /> Draft Prompts from Content</>
                )}
              </Button>
            </div>
          </div>

          {/* Error */}
          {draftError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {draftError}
            </div>
          )}

          {/* Concept Cards - vertical list like article storyboard */}
          {concepts.map((concept) => {
            if (concept.type !== 'featured') figureIndex++
            return (
              <ConceptCard
                key={concept.id}
                concept={concept}
                index={concept.type === 'featured' ? 0 : figureIndex}
                onGenerate={() => handleGenerateImage(concept.id)}
                onEditPrompt={(prompt) => handleEditPrompt(concept.id, prompt)}
              />
            )
          })}

          {/* Empty state */}
          {concepts.length === 0 && !isDrafting && !draftError && (
            <Card className="border-border/50 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ImageIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No visual concepts yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Click &ldquo;Draft Prompts from Content&rdquo; to generate image prompts for each section
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="flex-shrink-0 border-t px-6 py-4" style={{ background: 'color-mix(in srgb, var(--nn-accent) 6%, var(--bg))', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <Button onClick={onBack} variant="outline" className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back to Content
          </Button>
          <div className="flex items-center gap-3">
            {readyCount > 0 && (
              <span className="text-sm text-green-700">
                <CheckCircle2 className="inline h-4 w-4 mr-1" />
                {readyCount} of {concepts.length} images ready
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving || readyCount === 0}
              className="gap-2"
              style={{ background: 'var(--nn-accent)', color: '#fff' }}
            >
              {isSaving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Savingâ¦</>
              ) : (
                <>Continue to Review <ChevronRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
