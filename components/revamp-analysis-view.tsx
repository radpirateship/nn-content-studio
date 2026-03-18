'use client'

import { useState, useMemo } from 'react'
import { ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react'
import { RevampGenerationProgress } from './revamp-generation-progress'
import type { GeneratedArticle, OutlineSection, FAQItem, Product, GeneratedImage } from '@/lib/types'

interface Claim {
  text: string
  citationIndex?: number
}

interface SuggestedOutlineSection {
  heading: string
  keyPoints: string[]
  isNew: boolean
}

interface AnalysisData {
  wordCount: number
  headings: string[]
  links: number
  images: number
  claims: Claim[]
  suggestedOutline?: SuggestedOutlineSection[]
}

interface Citation {
  url: string
  title: string
  author?: string
}

interface RevampAnalysisViewProps {
  analysis: AnalysisData
  originalContent: string
  citations: Citation[]
  settings: {
    category: string
    keyword: string
    tone: string
    wordCount: number
    includeProducts?: boolean
    includeFAQ?: boolean
    includeSchema?: boolean
    includeImages?: boolean
    videoUrl?: string
  }
  onGenerateComplete: (article: GeneratedArticle) => void
  onBack: () => void
  generateSlug: (title: string) => string
  generateSchemaMarkup: (article: Partial<GeneratedArticle>) => string
  saveArticleToDb: (article: GeneratedArticle) => Promise<{ id: number; dbId: number }>
}

interface OutlineSectionState extends OutlineSection {
  id: string
  isNew: boolean
}

export function RevampAnalysisView({
  analysis,
  originalContent,
  citations,
  settings,
  onGenerateComplete,
  onBack,
  generateSlug,
  generateSchemaMarkup,
  saveArticleToDb,
}: RevampAnalysisViewProps) {
  // Populate outline from AI analysis suggestedOutline (P0 fix)
  const initialOutline: OutlineSectionState[] = analysis.suggestedOutline?.length
    ? analysis.suggestedOutline.map((s: SuggestedOutlineSection, i: number) => ({
        id: String(i + 1),
        heading: s.heading,
        keyPoints: s.keyPoints || ['Key point'],
        estimatedWords: Math.round((settings.wordCount || 2500) / (analysis.suggestedOutline?.length || 6)),
        isNew: s.isNew ?? false,
      }))
    : [
        { id: '1', heading: 'Introduction', keyPoints: ['Hook', 'Problem statement', 'Solution preview'], estimatedWords: 200, isNew: false },
        { id: '2', heading: 'Main Content', keyPoints: ['Key insight 1', 'Key insight 2', 'Key insight 3'], estimatedWords: 800, isNew: false },
        { id: '3', heading: 'Conclusion', keyPoints: ['Summary of key points', 'Call to action', 'Final thought'], estimatedWords: 200, isNew: false },
      ]

  const [outline, setOutline] = useState<OutlineSectionState[]>(initialOutline)

  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState<'idle' | 'content' | 'images' | 'faq' | 'polishing' | 'saving' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const citationMapping = useMemo(() => {
    return analysis.claims.map((claim, idx) => ({
      claim: claim.text,
      citationIndex: claim.citationIndex ?? -1,
      citation: claim.citationIndex !== undefined && claim.citationIndex >= 0 ? citations[claim.citationIndex] : null,
    }))
  }, [analysis.claims, citations])

  const updateSectionHeading = (id: string, newHeading: string) => {
    setOutline(outline.map(s => (s.id === id ? { ...s, heading: newHeading } : s)))
  }

  const updateKeyPoint = (sectionId: string, pointIndex: number, newText: string) => {
    setOutline(
      outline.map(s =>
        s.id === sectionId
          ? {
              ...s,
              keyPoints: s.keyPoints.map((p, i) => (i === pointIndex ? newText : p)),
            }
          : s
      )
    )
  }

  const addKeyPoint = (sectionId: string) => {
    setOutline(
      outline.map(s =>
        s.id === sectionId
          ? {
              ...s,
              keyPoints: [...s.keyPoints, 'New point'],
            }
          : s
      )
    )
  }

  const removeKeyPoint = (sectionId: string, pointIndex: number) => {
    setOutline(
      outline.map(s =>
        s.id === sectionId
          ? {
              ...s,
              keyPoints: s.keyPoints.filter((_, i) => i !== pointIndex),
            }
          : s
      )
    )
  }

  const deleteSection = (id: string) => {
    setOutline(outline.filter(s => s.id !== id))
  }

  const addSection = () => {
    const newId = Math.max(...outline.map(s => parseInt(s.id)), 0) + 1
    setOutline([
      ...outline,
      {
        id: String(newId),
        heading: 'New Section',
        keyPoints: ['Point 1', 'Point 2'],
        estimatedWords: 300,
        isNew: true,
      },
    ])
  }

  const handleGenerate = async () => {
    setError(null)

    // Validate
    if (outline.some(s => !s.heading.trim())) {
      setError('All section headings must be filled')
      return
    }

    setIsGenerating(true)
    setGenerationStep('content')

    try {
      // Step 1: Generate body content
      const contentRes = await fetch('/api/revamp/generate/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingContent: originalContent,
          approvedOutline: outline.map(s => ({
            heading: s.heading,
            keyPoints: s.keyPoints,
            isNew: s.isNew,
          })),
          citations,
          category: settings.category,
          keyword: settings.keyword,
          tone: settings.tone,
          wordCount: settings.wordCount,
          includeEmailCapture: true,
        }),
      })

      if (!contentRes.ok) {
        const errorData = await contentRes.json().catch(() => ({}))
        throw new Error(errorData.error || 'Content generation failed')
      }

      const { bodyContent } = await contentRes.json()

      // Step 2: Generate images + FAQ in parallel
      setGenerationStep('images')

      const [imageResult, faqResult] = await Promise.all([
        // Image generation (optional — gracefully fails)
        settings.includeImages !== false
          ? fetch('/api/revamp/generate/images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bodyContent,
                keyword: settings.keyword,
                category: settings.category,
                titleTag: settings.keyword,
                maxImages: 3,
              }),
            }).then(res => res.ok ? res.json() : { bodyContent, images: [] })
              .catch(() => ({ bodyContent, images: [] }))
          : Promise.resolve({ bodyContent, images: [] }),

        // FAQ generation
        (async () => {
          setGenerationStep('faq')
          const faqRes = await fetch('/api/revamp/generate/faq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keyword: settings.keyword,
              category: settings.category,
              titleTag: settings.keyword,
            }),
          })
          if (!faqRes.ok) {
            const errorData = await faqRes.json().catch(() => ({}))
            throw new Error(errorData.error || 'FAQ generation failed')
          }
          return faqRes.json()
        })(),
      ])

      // Use image-enhanced body content if available
      const finalBodyContent = imageResult?.bodyContent || bodyContent
      const { faqHtml, faqItems, faqSchema } = faqResult

      // Step 3: Finalize (assembly + polishing)
      setGenerationStep('polishing')
      const finalRes = await fetch('/api/revamp/generate/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyContent: finalBodyContent,
          faqHtml: faqHtml || '',
          faqItems: faqItems || [],
          faqSchema: faqSchema || '',
          keyword: settings.keyword,
          category: settings.category,
          titleTag: settings.keyword,
          metaDescription: '',
          includeProducts: settings.includeProducts ?? true,
          citations: citations || [],
          tone: settings.tone,
          wordCount: settings.wordCount,
          videoUrl: settings.videoUrl || undefined,
        }),
      })

      if (!finalRes.ok) {
        const errorData = await finalRes.json().catch(() => ({}))
        throw new Error(errorData.error || 'Assembly failed')
      }

      const { article: serverArticle } = await finalRes.json()

      // Step 4: Saving to database
      setGenerationStep('saving')

      // Build article object
      const article: GeneratedArticle = {
        id: serverArticle.id,
        dbId: serverArticle.dbId,
        title: serverArticle.title,
        slug: serverArticle.slug,
        titleTag: serverArticle.titleTag || `${serverArticle.title} | Naked Nutrition`,
        metaDescription: serverArticle.metaDescription || analysis.claims?.[0]?.text || serverArticle.title,
        content: serverArticle.content || '',
        htmlContent: serverArticle.htmlContent || '',
        featuredImage: serverArticle.featuredImage,
        contentImages: serverArticle.contentImages || [],
        products: serverArticle.products || [],
        faqs: serverArticle.faqs || [],
        schemaMarkup:
          serverArticle.schemaMarkup ||
          generateSchemaMarkup({
            title: serverArticle.title,
            keyword: settings.keyword,
            category: settings.category as any,
          }),
        category: (serverArticle.category || settings.category) as any,
        keyword: serverArticle.keyword || settings.keyword,
        wordCount: serverArticle.wordCount || analysis.wordCount,
        createdAt: new Date(serverArticle.createdAt || Date.now()),
        status: serverArticle.status || 'draft',
        articleType: 'revamp',
        hasInternalLinks: serverArticle.hasInternalLinks || false,
        hasImages: serverArticle.hasImages || false,
        linkCount: serverArticle.linkCount || 0,
        imageCount: serverArticle.imageCount || 0,
        sourceType: 'revamp' as const,
      }

      setGenerationStep('done')

      // Brief pause to show "done" state before callback
      setTimeout(() => {
        onGenerateComplete(article)
      }, 1000)
    } catch (err) {
      setGenerationStep('error')
      setError(err instanceof Error ? err.message : 'Generation failed')
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex h-full gap-6 overflow-hidden">
      {isGenerating ? (
        // Progress view
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-6">
          <RevampGenerationProgress currentStep={generationStep} errorMessage={error || undefined} />

          {/* Retry button for errors */}
          {generationStep === 'error' && (
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => {
                  setError(null)
                  setGenerationStep('idle')
                  setIsGenerating(false)
                }}
                className="px-4 py-2 rounded-lg border text-[13px] font-medium"
                style={{ color: 'var(--text2)', borderColor: 'var(--border)' }}
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white"
                style={{ background: 'var(--nn-accent)' }}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Left column: Analysis Summary & Citation Mapping */}
          <div className="w-80 flex-shrink-0 overflow-y-auto border-r px-6 py-6" style={{ borderColor: 'var(--border)' }}>
            {/* Analysis Summary */}
            <div className="mb-6">
              <h2 className="text-[11px] font-mono font-medium tracking-[1px] uppercase mb-3" style={{ color: 'var(--text3)' }}>
                Analysis Summary
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between text-[13px]" style={{ color: 'var(--text2)' }}>
                  <span>Word Count:</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--text1)' }}>
                    {analysis.wordCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-[13px]" style={{ color: 'var(--text2)' }}>
                  <span>Headings:</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--text1)' }}>
                    {analysis.headings.length}
                  </span>
                </div>
                <div className="flex justify-between text-[13px]" style={{ color: 'var(--text2)' }}>
                  <span>Links:</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--text1)' }}>
                    {analysis.links}
                  </span>
                </div>
                <div className="flex justify-between text-[13px]" style={{ color: 'var(--text2)' }}>
                  <span>Images:</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--text1)' }}>
                    {analysis.images}
                  </span>
                </div>
                <div className="flex justify-between text-[13px]" style={{ color: 'var(--text2)' }}>
                  <span>Claims:</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--text1)' }}>
                    {analysis.claims.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Citation Mapping */}
            <div>
              <h2 className="text-[11px] font-mono font-medium tracking-[1px] uppercase mb-3" style={{ color: 'var(--text3)' }}>
                Citation Mapping
              </h2>
              <div className="space-y-3">
                {citationMapping.length > 0 ? (
                  citationMapping.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded border p-2.5 text-[12px]"
                      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                    >
                      <p className="mb-1.5" style={{ color: 'var(--text1)' }}>
                        {item.claim}
                      </p>
                      {item.citation ? (
                        <div className="text-[11px]" style={{ color: 'var(--text3)' }}>
                          <p className="font-medium truncate">{item.citation.title}</p>
                          <p className="truncate">{item.citation.url}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px]" style={{ color: '#d69e2e' }}>
                          <AlertCircle className="h-3 w-3" />
                          <span>No source assigned</span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-[12px]" style={{ color: 'var(--text3)' }}>
                    No claims identified
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right column: Outline Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <h1 className="font-serif text-[24px] font-semibold mb-6" style={{ color: 'var(--text1)' }}>
                Article Outline
              </h1>

              <div className="space-y-4">
                {outline.map(section => (
                  <div
                    key={section.id}
                    className="rounded-lg border p-4"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                  >
                    {/* Heading */}
                    <div className="flex items-center gap-2 mb-4">
                      <input
                        type="text"
                        value={section.heading}
                        onChange={e => updateSectionHeading(section.id, e.target.value)}
                        className="flex-1 bg-transparent text-[16px] font-semibold outline-none"
                        style={{ color: 'var(--text1)' }}
                      />
                      {section.isNew && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#e8f4f8', color: '#0f6a88' }}>
                          NEW
                        </span>
                      )}
                      {!section.isNew && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#f0f0f0', color: '#666' }}>
                          ORIGINAL
                        </span>
                      )}
                      <button
                        onClick={() => deleteSection(section.id)}
                        className="p-1 rounded hover:bg-red-100"
                        style={{ color: '#c53030' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Key Points */}
                    <div className="space-y-2 mb-3">
                      {section.keyPoints.map((point, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[12px] font-mono" style={{ color: 'var(--text4)' }}>
                            •
                          </span>
                          <input
                            type="text"
                            value={point}
                            onChange={e => updateKeyPoint(section.id, idx, e.target.value)}
                            className="flex-1 bg-transparent text-[13px] outline-none"
                            style={{ color: 'var(--text2)' }}
                          />
                          <button
                            onClick={() => removeKeyPoint(section.id, idx)}
                            className="p-0.5 rounded hover:bg-red-100"
                            style={{ color: '#c53030' }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Key Point */}
                    <button
                      onClick={() => addKeyPoint(section.id)}
                      className="flex items-center gap-1 text-[12px] px-2 py-1 rounded hover:bg-blue-50"
                      style={{ color: 'var(--nn-accent)' }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add point
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Section Button */}
              <button
                onClick={addSection}
                className="mt-6 flex items-center gap-2 px-4 py-2 rounded-lg border-2"
                style={{ color: 'var(--nn-accent)', borderColor: 'var(--nn-accent)' }}
              >
                <Plus className="h-4 w-4" />
                Add Section
              </button>
            </div>

            {/* Bottom actions */}
            <div className="border-t px-8 py-4 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              {error && (
                <div className="flex items-center gap-2 text-[12px]" style={{ color: '#c53030' }}>
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              <div className="flex-1" />
              <div className="flex gap-3">
                <button
                  onClick={onBack}
                  className="px-4 py-2 rounded-lg border text-[13px] font-medium"
                  style={{ color: 'var(--text2)', borderColor: 'var(--border)' }}
                  disabled={isGenerating}
                >
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-white"
                  style={{ background: 'var(--nn-accent)' }}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Generating...' : 'Generate Article'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
