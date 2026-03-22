'use client'

import { useState, useCallback } from 'react'
import { Zap, Loader2, Check, Circle, AlertCircle, FileText, Link2, ImageIcon, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ArticleInput, GeneratedArticle, Product } from '@/lib/types'
import type { NNCategory } from '@/lib/nn-categories'
import type { ImageModel } from '@/lib/imageGeneration'

type AutoStep = 'idle' | 'content' | 'links' | 'images' | 'done' | 'error'

interface StepState {
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped'
  message: string
  detail?: string
}

interface AutoRunViewProps {
  onComplete: (article: GeneratedArticle) => void
  onCancel: () => void
  generateSlug: (title: string) => string
  generateSchemaMarkup: (article: GeneratedArticle) => string
  saveArticleToDb: (article: GeneratedArticle) => Promise<number | null>
}

export function AutoRunView({
  onComplete,
  onCancel,
  generateSlug,
  generateSchemaMarkup,
  saveArticleToDb,
}: AutoRunViewProps) {
  const [currentStep, setCurrentStep] = useState<AutoStep>('idle')
  const [steps, setSteps] = useState<Record<string, StepState>>({
    content: { status: 'pending', message: 'Generate Article Content' },
    links: { status: 'pending', message: 'Apply Internal Links' },
    images: { status: 'pending', message: 'Generate & Insert Images' },
  })
  const [article, setArticle] = useState<GeneratedArticle | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    keyword: '',
    collection: '',
  })

  const updateStep = (key: string, update: Partial<StepState>) => {
    setSteps(prev => ({ ...prev, [key]: { ...prev[key], ...update } }))
  }

  const runAll = useCallback(async () => {
    if (!formData.title || !formData.keyword) return

    setCurrentStep('content')
    setErrorMessage('')
    updateStep('content', { status: 'running', detail: 'Analyzing topic...' })
    updateStep('links', { status: 'pending', detail: '' })
    updateStep('images', { status: 'pending', detail: '' })

    // Map collection to category
    const collectionToCategory: Record<string, string> = {
      'Protein Powder': 'protein-powder', 'Whey Protein': 'whey-protein',
      'Vegan Protein Powder': 'vegan-protein-powder',
      'Collagen Peptides': 'collagen-peptides',
      'Overnight Oats': 'overnight-oats',
      'Performance & Recovery': 'improve-performance-recovery',
      'Supplements': 'supplements', 'Kids': 'kids',
    }
    const category = collectionToCategory[formData.collection] || 'general-nutrition'

    try {
      // ââ Step 1: Generate outline ââ
      updateStep('content', { detail: 'Creating article outline...' })
      const outlineRes = await fetch('/api/generate/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formData.title, keyword: formData.keyword, category }),
      })
      if (!outlineRes.ok) throw new Error('Failed to generate outline')
      const { outline } = await outlineRes.json()

      // ââ Fetch products ââ
      updateStep('content', { detail: 'Finding product recommendations...' })
      let products: Product[] = []
      try {
        const searchParam = encodeURIComponent(`${formData.title} ${formData.keyword}`)
        const productsRes = await fetch(`/api/products?category=${category}&search=${searchParam}&limit=4`)
        if (productsRes.ok) {
          const data = await productsRes.json()
          products = data.products || []
        }
      } catch (error) {
        console.warn('[auto-run] Product fetch failed, continuing without products:', error)
      }

      // ââ Fetch topical authority for links + related articles ââ
      updateStep('content', { detail: 'Fetching topical authority data...' })
      let relatedArticles: { title: string; url: string; description: string }[] = []
      let internalLinks: { title: string; url: string; description?: string }[] = []
      try {
        // Scope by collection slug â no fuzzy matching needed
        const resourcesRes = await fetch(`/api/resources?type=topical-authority&collection=${category}`)
        if (resourcesRes.ok) {
          const data = await resourcesRes.json()
          const allTopics = data.items || []

          // Exclude the article being generated, keep only rows with a URL
          const withUrls = allTopics.filter((t: { title: string; existingUrl: string }) =>
            t.existingUrl && t.title?.toLowerCase() !== formData.title.toLowerCase()
          )
          internalLinks = withUrls.slice(0, 15).map((t: { title: string; existingUrl: string; metaDescription?: string }) => ({
            title: t.title, url: t.existingUrl, description: t.metaDescription || '',
          }))

          const pillar = withUrls.find((t: { type?: string; title: string }) =>
            t.type?.toLowerCase() === 'pillar' || t.title?.toLowerCase().includes('ultimate guide')
          )
          const cluster = withUrls.filter((t: { type?: string; title: string }) =>
            t.type?.toLowerCase() !== 'pillar' && !t.title?.toLowerCase().includes('ultimate guide')
          )
          const rList: typeof relatedArticles = []
          if (pillar) rList.push({ title: (pillar as any).title, url: (pillar as any).existingUrl, description: (pillar as any).metaDescription || '' })
          cluster.slice(0, 2).forEach((t: any) => rList.push({ title: t.title, url: t.existingUrl, description: t.metaDescription || '' }))
          relatedArticles = rList
        }
      } catch (error) {
        console.warn('[auto-run] Topical authority fetch failed, continuing without links:', error)
      }

      // ââ Step 1 cont: Generate full content ââ
      updateStep('content', { detail: 'Writing article with AI...' })
      const contentRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title, keyword: formData.keyword, category,
          tone: 'authoritative', wordCount: 2500,
          products: products.map(p => ({
            title: p.title, description: p.description, price: p.price, imageUrl: p.imageUrl,
            url: p.handle ? `https://nakednutrition.com/products/${p.handle}` : p.url, handle: p.handle,
          })),
          relatedArticles,
        }),
      })
      if (!contentRes.ok) throw new Error('Failed to generate content')
      const { content, metaDescription: generatedMeta } = await contentRes.json()

      const textContent = content.replace(/<[^>]*>/g, ' ')
      const wordCount = textContent.split(/\s+/).filter(Boolean).length
      const slug = generateSlug(formData.title)
      const metaDescription = generatedMeta || `Learn about ${formData.keyword}. Comprehensive guide from Naked Nutrition.`.slice(0, 160)

      const newArticle: GeneratedArticle = {
        id: `article-${Date.now()}`,
        title: formData.title, slug, metaDescription,
        content: textContent, htmlContent: content,
        featuredImage: undefined, contentImages: [],
        products: products.map(p => ({
          ...p,
          tags: typeof (p as any).tags === 'string' ? (p as any).tags.split(',').map((t: string) => t.trim()) : (p as any).tags || [],
          url: p.handle ? `https://nakednutrition.com/products/${p.handle}` : '#',
          isAvailable: true,
        })),
        faqs: outline?.faq?.map((f: { question: string; briefAnswer: string }) => ({
          question: f.question, answer: f.briefAnswer,
        })) || [],
        schemaMarkup: '', category: category as NNCategory, keyword: formData.keyword,
        wordCount, createdAt: new Date(), status: 'draft',
        hasInternalLinks: false, hasImages: false, linkCount: 0, imageCount: 0,
      }
      newArticle.schemaMarkup = generateSchemaMarkup(newArticle)

      const dbId = await saveArticleToDb(newArticle)
      if (dbId) newArticle.dbId = dbId

      updateStep('content', { status: 'done', detail: `${(wordCount ?? 0).toLocaleString()} words generated` })
      setArticle(newArticle)

      // ââ Step 2: Auto-apply links ââ
      setCurrentStep('links')
      if (internalLinks.length > 0) {
        updateStep('links', { status: 'running', detail: `Inserting from ${internalLinks.length} available links...` })
        try {
          const linkRes = await fetch('/api/articles/add-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              articleId: newArticle.dbId,
              htmlContent: newArticle.htmlContent,
              internalLinks,
            }),
          })
          if (linkRes.ok) {
            const linkData = await linkRes.json()
            newArticle.htmlContent = linkData.htmlContent
            newArticle.hasInternalLinks = true
            newArticle.linkCount = linkData.linkCount
            const warn = linkData.warning ? ' (DB save failed — may not persist)' : ''
            updateStep('links', { status: 'done', detail: `${linkData.linkCount} links inserted${warn}` })
          } else {
            updateStep('links', { status: 'error', detail: 'Failed, continuing...' })
          }
        } catch {
          updateStep('links', { status: 'error', detail: 'Failed, continuing...' })
        }
      } else {
        updateStep('links', { status: 'skipped', detail: 'No topical authority data available' })
      }

      // ââ Step 3: Auto-generate images ââ
      setCurrentStep('images')
      updateStep('images', { status: 'running', detail: 'Generating images with Gemini...' })
      try {
        const imageRes = await fetch('/api/articles/add-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleId: newArticle.dbId,
            htmlContent: newArticle.htmlContent,
            category,
            model: 'gemini-nano-banana',
          }),
        })
        if (imageRes.ok) {
          const imageData = await imageRes.json()
          newArticle.htmlContent = imageData.htmlContent
          newArticle.hasImages = true
          newArticle.imageCount = imageData.imageCount
          const warn = imageData.warning ? ' (DB save failed — may not persist)' : ''
          updateStep('images', { status: 'done', detail: `${imageData.imageCount} images generated with Gemini${warn}` })
        } else {
          updateStep('images', { status: 'error', detail: 'Failed, continuing...' })
        }
      } catch {
        updateStep('images', { status: 'error', detail: 'Failed, continuing...' })
      }

      setCurrentStep('done')
      setArticle(newArticle)

    } catch (err) {
      setCurrentStep('error')
      setErrorMessage(err instanceof Error ? err.message : 'Auto-run failed')
      const stepKeys = ['content', 'links', 'images']
      stepKeys.forEach(k => {
        if (steps[k]?.status === 'running') updateStep(k, { status: 'error', detail: 'Aborted' })
      })
    }
  }, [formData, generateSlug, generateSchemaMarkup, saveArticleToDb, steps])

  const StepIcon = ({ status }: { status: StepState['status'] }) => {
    if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--nn-accent)' }} />
    if (status === 'done') return <Check className="h-4 w-4" style={{ color: 'var(--nn-accent)' }} />
    if (status === 'error') return <AlertCircle className="h-4 w-4" style={{ color: '#c53030' }} />
    if (status === 'skipped') return <Circle className="h-4 w-4 opacity-30" style={{ color: 'var(--text4)' }} />
    return <Circle className="h-4 w-4" style={{ color: 'var(--text4)' }} />
  }

  const isRunning = currentStep !== 'idle' && currentStep !== 'done' && currentStep !== 'error'

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[640px] px-6 pt-8 pb-20">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4" style={{ color: 'var(--nn-accent)' }} />
            <h1 className="font-serif text-[20px] font-semibold tracking-tight" style={{ color: 'var(--text1)' }}>
              Auto-Run
            </h1>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text3)' }}>
            Runs all generation steps automatically: content, internal links, and images. Review the final result before publishing.
          </p>
        </div>

        {/* Quick form (only shown when idle) */}
        {currentStep === 'idle' && (
          <div className="rounded-lg border p-5 mb-6" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            <div className="grid gap-4">
              <div>
                <label className="text-[10px] font-mono font-medium tracking-[0.6px] uppercase mb-1.5 block" style={{ color: 'var(--text3)' }}>
                  Article Topic / Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Best Whey Protein Powder for Muscle Gain"
                  className="w-full rounded-md border px-3 py-[9px] text-[13px] outline-none"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-medium tracking-[0.6px] uppercase mb-1.5 block" style={{ color: 'var(--text3)' }}>
                    Target Keyword
                  </label>
                  <input
                    type="text"
                    value={formData.keyword}
                    onChange={e => setFormData(prev => ({ ...prev, keyword: e.target.value }))}
                    placeholder="best whey protein powder"
                    className="w-full rounded-md border px-3 py-[9px] text-[13px] outline-none"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono font-medium tracking-[0.6px] uppercase mb-1.5 block" style={{ color: 'var(--text3)' }}>
                    Collection
                  </label>
                  <select
                    value={formData.collection}
                    onChange={e => setFormData(prev => ({ ...prev, collection: e.target.value }))}
                    className="w-full rounded-md border px-3 py-[9px] text-[13px] outline-none"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
                  >
                    <option value="">-- Select --</option>
                    <option value="Protein Powder">Protein Powder</option>
                    <option value="Whey Protein">Whey Protein</option>
                    <option value="Vegan Protein Powder">Vegan Protein Powder</option>
                    <option value="Collagen Peptides">Collagen Peptides</option>
                    <option value="Overnight Oats">Overnight Oats</option>
                    <option value="Performance & Recovery">Performance & Recovery</option>
                    <option value="Supplements">Supplements</option>
                    <option value="Kids">Kids</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
              <Button
                size="sm"
                disabled={!formData.title || !formData.keyword}
                onClick={runAll}
                className="gap-1.5"
              >
                <Zap className="h-3.5 w-3.5" />
                Start Auto-Run
              </Button>
            </div>
          </div>
        )}

        {/* Progress tracker */}
        {currentStep !== 'idle' && (
          <div className="rounded-lg border p-5 mb-6" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            {/* Title */}
            {formData.title && (
              <div className="mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--text1)' }}>{formData.title}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>{formData.keyword}</p>
              </div>
            )}

            {/* Steps */}
            <div className="flex flex-col gap-3">
              {Object.entries(steps).map(([key, step]) => (
                <div key={key} className="flex items-start gap-3">
                  <div className="mt-0.5"><StepIcon status={step.status} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium" style={{
                        color: step.status === 'running' ? 'var(--nn-accent)' : step.status === 'done' ? 'var(--text1)' : 'var(--text3)',
                      }}>
                        {step.message}
                      </span>
                      {step.status === 'done' && (
                        <span className="text-[10px] font-mono rounded px-1.5 py-0.5" style={{ background: 'var(--nn-accent-light)', color: 'var(--nn-accent)' }}>
                          Done
                        </span>
                      )}
                      {step.status === 'skipped' && (
                        <span className="text-[10px] font-mono rounded px-1.5 py-0.5" style={{ background: 'var(--surface)', color: 'var(--text4)' }}>
                          Skipped
                        </span>
                      )}
                    </div>
                    {step.detail && (
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text4)' }}>{step.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Error */}
            {currentStep === 'error' && (
              <div className="mt-4 rounded-md border px-3 py-2.5" style={{ borderColor: '#fed7d7', background: '#fff5f5' }}>
                <p className="text-[12px] font-medium" style={{ color: '#c53030' }}>{errorMessage}</p>
              </div>
            )}

            {/* Done: summary card */}
            {currentStep === 'done' && article && (
              <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--nn-accent) 12%, transparent)' }}>
                    <Check className="h-4 w-4" style={{ color: 'var(--nn-accent)' }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--text1)' }}>Auto-Run Complete</p>
                    <p className="text-[11px]" style={{ color: 'var(--text3)' }}>Article is ready for review</p>
                  </div>
                </div>
                <div className="rounded-md border divide-y mb-4" style={{ background: 'var(--bg-warm)', borderColor: 'var(--border)' }}>
                  {[
                    { label: 'Title', value: article.title },
                    { label: 'Words', value: article.wordCount?.toLocaleString() || '--' },
                    { label: 'Links', value: `${article.linkCount || 0} internal links` },
                    { label: 'Images', value: `${article.imageCount || 0} generated` },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-3 py-2">
                      <span className="text-[10px] font-mono uppercase tracking-[0.5px]" style={{ color: 'var(--text4)' }}>{row.label}</span>
                      <span className="text-[12px] font-medium truncate max-w-[260px]" style={{ color: 'var(--text1)' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={onCancel}>New Article</Button>
                  <Button
                    size="sm"
                    onClick={() => onComplete(article)}
                    className="gap-1.5"
                                      >
                    <Eye className="h-3.5 w-3.5" />
                    Review Article
                  </Button>
                </div>
              </div>
            )}

            {/* Error: expanded card with details + troubleshooting */}
            {currentStep === 'error' && (
              <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: '#fef2f2' }}>
                    <AlertCircle className="h-4 w-4" style={{ color: '#c53030' }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: '#c53030' }}>Generation Failed</p>
                    <p className="text-[11px]" style={{ color: 'var(--text3)' }}>Your inputs have been saved -- you can retry without losing progress.</p>
                  </div>
                </div>

                {/* Error details box */}
                <div className="rounded-md border px-3.5 py-3 mb-4" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.5px] mb-1" style={{ color: '#991b1b' }}>Error Details</p>
                  <p className="text-[12px]" style={{ color: '#991b1b' }}>{errorMessage}</p>
                </div>

                {/* What was saved */}
                {article && (
                  <div className="rounded-md border divide-y mb-4" style={{ background: 'var(--bg-warm)', borderColor: 'var(--border)' }}>
                    {[
                      { label: 'Article', value: article.title },
                      { label: 'Status', value: 'Draft -- Incomplete', accent: '#b8860b' },
                      { label: 'Outline', value: 'Saved', accent: 'var(--nn-accent)' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between px-3 py-2">
                        <span className="text-[10px] font-mono uppercase tracking-[0.5px]" style={{ color: 'var(--text4)' }}>{row.label}</span>
                        <span className="text-[12px] font-medium" style={{ color: row.accent || 'var(--text1)' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Troubleshooting tips */}
                <div className="rounded-md border px-3.5 py-3 mb-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.5px] mb-2" style={{ color: 'var(--text4)' }}>Troubleshooting</p>
                  <div className="flex flex-col gap-1.5">
                    {[
                      'Wait 60 seconds and retry -- rate limits reset quickly',
                      'Try a shorter outline (fewer sections) to reduce API calls',
                      'Check API key status in Settings',
                    ].map((tip, i) => (
                      <p key={i} className="text-[11px]" style={{ color: 'var(--text3)' }}>
                        {tip}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {article && (
                    <Button variant="outline" size="sm" onClick={() => onComplete(article)}>View Partial Draft</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={() => { setCurrentStep('idle'); setErrorMessage('') }}
                    className="gap-1.5"
                                      >
                    Retry Generation
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
