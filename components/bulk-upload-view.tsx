'use client'

import { useState, useRef } from 'react'
import { Layers, Upload, FileSpreadsheet, Plus, Trash2, Play, Loader2, Check, AlertCircle, X, Download, Eye, RotateCcw, Send, ArrowLeft, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GeneratedArticle, Product, WellnessCategory } from '@/lib/types'
import type { ImageModel } from '@/lib/imageGeneration'

interface BulkItem {
  id: string
  title: string
  keyword: string
  collection: string
  articleType?: string
  audience?: string
  tone?: string
  wordCount?: number
  includeComparisonTable?: boolean
  specialInstructions?: string
  priority?: string
  titleTag?: string
  metaDescription?: string
  shopifySlug?: string
  status: 'queued' | 'running' | 'done' | 'error'
  step?: string
  article?: GeneratedArticle
  error?: string
}

interface BulkUploadViewProps {
  onArticleGenerated: (article: GeneratedArticle) => void
  onOpenArticle?: (article: GeneratedArticle) => void
  generateSlug: (title: string) => string
  generateSchemaMarkup: (article: GeneratedArticle) => string
  saveArticleToDb: (article: GeneratedArticle) => Promise<number | null>
}

const COLLECTIONS = [
  'Hydrogen Water', 'Water Ionizers', 'Hyperbaric Chambers', 'Red Light Therapy',
  'Cold Plunges', 'Pilates', 'Infrared Saunas', 'Barrel Saunas', 'Saunas', 'Sauna Heaters',
  'Massage Equipment', 'Compression Boots', 'Sensory Deprivation Tanks', 'Sauna Accessories', 'Steam',
  'Elliptical Machines', 'Exercise Bikes', 'Treadmills', 'Stair Climbers', 'Vertical Climbers', 'Air Filters',
]

const COLLECTION_TO_CATEGORY: Record<string, string> = {
  // Display names
  'Hydrogen Water': 'hydrogen-water', 'Water Ionizers': 'water-ionizers',
  'Hyperbaric Chambers': 'hyperbaric-chambers', 'Red Light Therapy': 'red-light-therapy',
  'Cold Plunges': 'cold-plunges', 'Pilates': 'pilates',
  'Infrared Saunas': 'infrared-saunas', 'Saunas': 'saunas', 'Barrel Saunas': 'barrel-saunas',
  'Sauna Heaters': 'sauna-heaters', 'Sauna Accessories': 'sauna-accessories',
  'Massage Equipment': 'massage-equipment', 'Massage Chairs': 'massage-equipment', 'Massage': 'massage-equipment',
  'Compression Boots': 'compression-boots', 'Air Filters': 'air-filters',
  'Sensory Deprivation Tanks': 'sensory-deprivation-tanks',
  'Steam': 'steam',
  'Elliptical Machines': 'elliptical-machines', 'Exercise Bikes': 'exercise-bikes',
  'Treadmills': 'treadmills', 'Stair Climbers': 'stair-climbers', 'Vertical Climbers': 'vertical-climbers',
  // Slugs (so CSV can use either display name or slug)
  'hydrogen-water': 'hydrogen-water', 'water-ionizers': 'water-ionizers',
  'hyperbaric-chambers': 'hyperbaric-chambers', 'red-light-therapy': 'red-light-therapy',
  'cold-plunge': 'cold-plunges', 'cold-plunges': 'cold-plunges', 'infrared-saunas': 'infrared-saunas', 'saunas': 'saunas', 'barrel-saunas': 'barrel-saunas',
  'sauna-heaters': 'sauna-heaters', 'sauna-accessories': 'sauna-accessories',
  'massage-equipment': 'massage-equipment',
  'sensory-deprivation-tanks': 'sensory-deprivation-tanks',
  'steam': 'steam',
  'elliptical-machines': 'elliptical-machines', 'exercise-bikes': 'exercise-bikes',
  'treadmills': 'treadmills', 'stair-climbers': 'stair-climbers', 'vertical-climbers': 'vertical-climbers',
  'pilates': 'pilates',
}

export function BulkUploadView({
  onArticleGenerated,
  onOpenArticle,
  generateSlug,
  generateSchemaMarkup,
  saveArticleToDb,
}: BulkUploadViewProps) {
  const [items, setItems] = useState<BulkItem[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [phase, setPhase] = useState<'setup' | 'review'>('setup')
  const [selectedForPublish, setSelectedForPublish] = useState<Set<string>>(new Set())
  const [startTime, setStartTime] = useState<number | null>(null)
  const [endTime, setEndTime] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  // ââ Manual add row ââ
  const addRow = () => {
    setItems(prev => [...prev, {
      id: `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: '', keyword: '', collection: '', status: 'queued',
    }])
  }

  const updateRow = (id: string, field: keyof BulkItem, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const removeRow = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  // ââ CSV parsing ââ
  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return

      const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
      const parseLine = (line: string) => line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(s => s.replace(/^"|"$/g, '').trim()) || line.split(',').map(s => s.trim())

      // Detect header row and map column indices
      const hasHeader = lines[0]?.toLowerCase().includes('title')
      const startIdx = hasHeader ? 1 : 0
      const headerCols = hasHeader ? parseLine(lines[0]).map(h => h.toLowerCase()) : []
      const colIdx = (name: string) => { const i = headerCols.indexOf(name.toLowerCase()); return i >= 0 ? i : -1 }
      const col = {
        title: Math.max(colIdx('title'), 0),
        keyword: Math.max(colIdx('keyword'), 1),
        collection: colIdx('collection') >= 0 ? colIdx('collection') : 2,
        articleType: colIdx('articletype'),
        audience: colIdx('audience'),
        tone: colIdx('tone'),
        wordCount: colIdx('wordcount'),
        includeComparisonTable: colIdx('includecomparisontable'),
        specialInstructions: colIdx('specialinstructions'),
        priority: colIdx('priority'),
        titleTag: colIdx('titletag'),
        metaDescription: colIdx('metadescription'),
        shopifySlug: colIdx('shopifyslug'),
      }

      const getCol = (parts: string[], idx: number) => idx >= 0 ? (parts[idx] || '').trim() : ''

      const newItems: BulkItem[] = []

      for (let i = startIdx; i < lines.length && i < 51; i++) {
        const parts = parseLine(lines[i])
        if (parts.length >= 2) {
          const rawWordCount = getCol(parts, col.wordCount).replace(/,/g, '')
          const rawComparison = getCol(parts, col.includeComparisonTable).toLowerCase()
          newItems.push({
            id: `bulk-${Date.now()}-${i}`,
            title: parts[col.title] || '',
            keyword: parts[col.keyword] || '',
            collection: parts[col.collection] || '',
            articleType: getCol(parts, col.articleType) || undefined,
            audience: getCol(parts, col.audience) || undefined,
            tone: getCol(parts, col.tone) || undefined,
            wordCount: rawWordCount ? parseInt(rawWordCount, 10) || undefined : undefined,
            includeComparisonTable: rawComparison === 'true' || rawComparison === 'yes' || rawComparison === '1' || undefined,
            specialInstructions: getCol(parts, col.specialInstructions) || undefined,
            priority: getCol(parts, col.priority) || undefined,
            titleTag: getCol(parts, col.titleTag) || undefined,
            metaDescription: getCol(parts, col.metaDescription) || undefined,
            shopifySlug: getCol(parts, col.shopifySlug) || undefined,
            status: 'queued',
          })
        }
      }

      if (newItems.length > 0) {
        setItems(prev => [...prev, ...newItems])
      }
    }
    reader.readAsText(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  // ââ Download CSV template ââ
  const downloadTemplate = () => {
    const csv = 'title,keyword,collection\nBest Infrared Saunas for Home Use,best infrared saunas,Infrared Saunas\nCold Plunge Benefits for Recovery,cold plunge benefits,Cold Plunges\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nn-bulk-upload-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ââ Process single article (full auto-run) ââ
  const processItem = async (item: BulkItem): Promise<GeneratedArticle | null> => {
    const normalizedCollection = Object.keys(COLLECTION_TO_CATEGORY).find(
      k => k.toLowerCase() === item.collection.toLowerCase()
    ) || item.collection
    const category = COLLECTION_TO_CATEGORY[normalizedCollection] || 'general-wellness'

    // Update status
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'running', step: 'Generating outline...' } : i))

    try {
      // Outline
      const outlineRes = await fetch('/api/generate/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: item.title, keyword: item.keyword, category }),
      })
      if (!outlineRes.ok) throw new Error('Outline failed')
      const { outline } = await outlineRes.json()

      // Products
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, step: 'Finding products...' } : i))
      let products: Product[] = []
      try {
        const pRes = await fetch(`/api/products?category=${category}&collection=${category}&search=${encodeURIComponent(item.keyword)}&limit=4`)
        if (pRes.ok) { const d = await pRes.json(); products = d.products || [] }
      } catch {}

      // Topical authority
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, step: 'Fetching resources...' } : i))
      let internalLinks: { title: string; url: string; description?: string }[] = []
      let relatedArticles: { title: string; url: string; description: string }[] = []
      try {
        // Scope by collection slug â no fuzzy matching needed
        const rRes = await fetch(`/api/resources?type=topical-authority&collection=${category}`)
        if (rRes.ok) {
          const data = await rRes.json()
          const allTopics = data.items || []

          // Exclude the current article, keep only rows with a URL
          const withUrls = allTopics.filter((t: any) =>
            t.existingUrl && t.title?.toLowerCase() !== item.title.toLowerCase()
          )
          internalLinks = withUrls.slice(0, 15).map((t: any) => ({ title: t.title, url: t.existingUrl, description: t.metaDescription || '' }))
          const cluster = withUrls.filter((t: any) => !t.title?.toLowerCase().includes('ultimate guide'))
          relatedArticles = cluster.slice(0, 3).map((t: any) => ({ title: t.title, url: t.existingUrl, description: t.metaDescription || '' }))
        }
      } catch {}

      // Generate content
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, step: 'Writing article...' } : i))
      const contentRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title, keyword: item.keyword, category,
          collection: item.collection,
          articleType: item.articleType,
          audience: item.audience || 'general',
          tone: item.tone || 'educational',
          wordCount: item.wordCount || 2500,
          includeComparisonTable: item.includeComparisonTable || false,
          specialInstructions: item.specialInstructions || '',
          products: products.map(p => ({
            title: p.title, description: p.description, price: p.price, imageUrl: p.imageUrl,
            url: p.handle ? `https://nakednutrition.com/products/${p.handle}` : p.url, handle: p.handle,
          })),
          relatedArticles,
        }),
      })
      if (!contentRes.ok) throw new Error('Content generation failed')
      const { content, metaDescription: generatedMeta } = await contentRes.json()

      const textContent = content.replace(/<[^>]*>/g, ' ')
      const wordCount = textContent.split(/\s+/).filter(Boolean).length
      const rawSlug = (item.shopifySlug || '').replace(/^\/blogs\/[^/]+\//, '')
    const slug = rawSlug || generateSlug(item.title)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const article: any = {
        id: `article-${Date.now()}`,
        title: item.title, slug,
        titleTag: item.titleTag || undefined,
        metaDescription: item.metaDescription || generatedMeta || `Learn about ${item.keyword}.`.slice(0, 160),
        shopifySlug: item.shopifySlug || slug,
        content: textContent, htmlContent: content,
        featuredImage: undefined, contentImages: [],
        products: products.map(p => ({ ...p, tags: typeof (p as any).tags === 'string' ? (p as any).tags.split(',').map((t: string) => t.trim()) : (p as any).tags || [], url: p.handle ? `https://nakednutrition.com/products/${p.handle}` : '#', isAvailable: true })),
        faqs: outline?.faq?.map((f: any) => ({ question: f.question, answer: f.briefAnswer })) || [],
        schemaMarkup: '', category: category as WellnessCategory, keyword: item.keyword,
        shopifyBlogTag: item.collection as any,
        articleType: item.articleType,
        wordCount, createdAt: new Date(), status: 'draft',
        hasInternalLinks: false, hasImages: false, linkCount: 0, imageCount: 0,
      }
      article.schemaMarkup = generateSchemaMarkup(article)
      const dbId = await saveArticleToDb(article)
      if (dbId) article.dbId = dbId

      // Auto-apply links
      if (internalLinks.length > 0) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, step: 'Adding links...' } : i))
        try {
          const linkRes = await fetch('/api/articles/add-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articleId: article.dbId, htmlContent: article.htmlContent, internalLinks }),
          })
          if (linkRes.ok) {
            const d = await linkRes.json()
            article.htmlContent = d.htmlContent
            article.hasInternalLinks = true
            article.linkCount = d.linkCount
          }
        } catch {}
      }

      return article
    } catch (err) {
      throw err
    }
  }

  // ââ Run all items sequentially ââ
  const runAll = async () => {
    const validItems = items.filter(i => i.title && i.keyword && (i.status === 'queued' || i.status === 'error'))
    if (validItems.length === 0) return

    // Reset errored items to queued
    setItems(prev => prev.map(i => i.status === 'error' ? { ...i, status: 'queued', error: undefined } : i))

    setIsRunning(true)
    setCompletedCount(0)
    setStartTime(Date.now())
    setEndTime(null)
    abortRef.current = false

    for (const item of validItems) {
      if (abortRef.current) break

      try {
        const article = await processItem(item)
        if (article) {
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done', step: `${article.wordCount?.toLocaleString()} words`, article } : i))
          onArticleGenerated(article)
          setCompletedCount(prev => prev + 1)
        }
      } catch (err) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', step: undefined, error: err instanceof Error ? err.message : 'Failed' } : i))
      }
    }

    setIsRunning(false)
    setEndTime(Date.now())

    // Switch to review phase once processing finishes
    setPhase('review')
    // Pre-select all completed items for publish
    setSelectedForPublish(new Set(items.filter(i => i.status === 'done').map(i => i.id)))
  }

  const stopRun = () => { abortRef.current = true }

  const validCount = items.filter(i => i.title && i.keyword).length
  const doneCount = items.filter(i => i.status === 'done').length
  const errorCount = items.filter(i => i.status === 'error').length
  const skippedCount = items.filter(i => i.status === 'queued').length
  const totalTime = startTime && endTime ? Math.round((endTime - startTime) / 1000) : 0
  const avgTime = doneCount > 0 ? Math.round(totalTime / doneCount) : 0

  // Toggle selection for publish
  const toggleSelect = (id: string) => {
    setSelectedForPublish(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    const completedIds = items.filter(i => i.status === 'done').map(i => i.id)
    if (selectedForPublish.size === completedIds.length) setSelectedForPublish(new Set())
    else setSelectedForPublish(new Set(completedIds))
  }

  // Retry failed items
  const retryFailed = () => {
    setPhase('setup')
    runAll()
  }

  // --- REVIEW PHASE ---
  if (phase === 'review') {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Review header */}
        <div className="flex items-center justify-between border-b px-6 py-3" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" style={{ color: 'var(--nn-accent)' }} />
            <h1 className="font-serif text-[17px] font-semibold" style={{ color: 'var(--text1)' }}>Bulk Review</h1>
          </div>
          <button
            onClick={() => setPhase('setup')}
            className="flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: 'var(--text3)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Queue
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 border-b px-6 py-2.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <StatItem label="Total" value={String(items.length)} />
          <StatItem label="Completed" value={String(doneCount)} color="var(--nn-accent)" />
          {errorCount > 0 && <StatItem label="Failed" value={String(errorCount)} color="#c53030" />}
          {skippedCount > 0 && <StatItem label="Skipped" value={String(skippedCount)} color="#b8860b" />}
          <StatItem label="Total Time" value={`${Math.floor(totalTime / 60)}m ${totalTime % 60}s`} />
          <StatItem label="Avg/Article" value={`${Math.floor(avgTime / 60)}m ${avgTime % 60}s`} />
        </div>

        {/* Review table */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Select all */}
          <div className="flex items-center gap-3 px-2 pb-2 border-b mb-1" style={{ borderColor: 'var(--border)' }}>
            <input
              type="checkbox"
              checked={selectedForPublish.size === items.filter(i => i.status === 'done').length && doneCount > 0}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 rounded"
            />
            <span className="text-[9px] font-mono font-medium tracking-[1px] uppercase" style={{ color: 'var(--text4)' }}>
              Select All ({selectedForPublish.size} of {doneCount})
            </span>
          </div>

          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-black/[0.02] transition-colors"
            >
              {item.status === 'done' && (
                <input
                  type="checkbox"
                  checked={selectedForPublish.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="h-3.5 w-3.5 rounded flex-shrink-0"
                />
              )}
              {item.status !== 'done' && <div className="w-3.5 flex-shrink-0" />}

              {/* Status icon */}
              <div className="flex-shrink-0">
                {item.status === 'done' && <Check className="h-4 w-4" style={{ color: 'var(--nn-accent)' }} />}
                {item.status === 'error' && <AlertCircle className="h-4 w-4" style={{ color: '#c53030' }} />}
                {item.status === 'queued' && <div className="h-4 w-4 rounded-full border" style={{ borderColor: 'var(--text4)' }} />}
              </div>

              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: item.status === 'error' ? '#c53030' : 'var(--text1)' }}>
                  {item.title}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: 'var(--text3)' }}>
                  {item.article && <span>{item.article.wordCount?.toLocaleString()} words</span>}
                  {item.error && <span style={{ color: '#c53030' }}>{item.error}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {item.status === 'done' && item.article && onOpenArticle && (
                  <button
                    onClick={() => onOpenArticle(item.article!)}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium border"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text2)' }}
                  >
                    <Eye className="h-3 w-3" />
                    Review
                  </button>
                )}
                {item.status === 'error' && (
                  <button
                    onClick={() => {
                      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'queued', error: undefined } : i))
                    }}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium border"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: '#c53030' }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center justify-between border-t px-6 py-3" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <Button
                variant="outline" size="sm"
                onClick={retryFailed}
                className="gap-1.5 text-[12px]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retry All Failed ({errorCount})
              </Button>
            )}
          </div>
          <Button
            size="sm"
            disabled={selectedForPublish.size === 0}
            className="gap-1.5 text-[12px]"
            style={{ background: 'var(--nn-accent)', color: '#fff' }}
          >
            <Send className="h-3.5 w-3.5" />
            Publish {selectedForPublish.size} Selected to Shopify
          </Button>
        </div>
      </div>
    )
  }

  // --- SETUP/PROCESSING PHASE ---
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b px-6 py-3" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4" style={{ color: 'var(--nn-accent)' }} />
          <h1 className="font-serif text-[17px] font-semibold" style={{ color: 'var(--text1)' }}>Bulk Upload</h1>
          {items.length > 0 && (
            <span className="ml-2 text-[11px] font-mono rounded px-1.5 py-0.5" style={{ background: 'var(--surface)', color: 'var(--text3)' }}>
              {items.length} article{items.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 text-[12px]">
                <Download className="h-3.5 w-3.5" />
                CSV Template
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 text-[12px]"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Upload CSV
              </Button>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
              <Button
                size="sm"
                disabled={validCount === 0}
                onClick={runAll}
                className="gap-1.5 text-[12px]"
                style={{ background: 'var(--nn-accent)', color: '#fff' }}
              >
                <Play className="h-3.5 w-3.5" />
                Run All ({validCount})
              </Button>
            </>
          ) : (
            <Button size="sm" variant="destructive" onClick={stopRun} className="gap-1.5 text-[12px]">
              <X className="h-3.5 w-3.5" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar when running */}
      {isRunning && validCount > 0 && (
        <div className="h-1 w-full" style={{ background: 'var(--surface)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{ background: 'var(--nn-accent)', width: `${(completedCount / validCount) * 100}%` }}
          />
        </div>
      )}

      {/* Table area */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <div className="rounded-full p-4" style={{ background: 'var(--surface)' }}>
              <FileSpreadsheet className="h-8 w-8" style={{ color: 'var(--text4)' }} />
            </div>
            <div>
              <p className="text-[14px] font-medium" style={{ color: 'var(--text2)' }}>No articles queued</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--text4)' }}>
                Upload a CSV or manually add articles to generate in batch.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                Upload CSV
              </Button>
              <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Manually
              </Button>
            </div>
            <p className="text-[10px] font-mono" style={{ color: 'var(--text4)' }}>
              CSV format: title, keyword, collection (optional)
            </p>
          </div>
        ) : (
          <div className="px-4 py-3">
            {/* Table header */}
            <div className="grid gap-2 px-2 pb-2 border-b mb-1" style={{ gridTemplateColumns: '1fr 1fr 160px 100px 36px', borderColor: 'var(--border)' }}>
              <span className="text-[9px] font-mono font-medium tracking-[1px] uppercase" style={{ color: 'var(--text4)' }}>Title</span>
              <span className="text-[9px] font-mono font-medium tracking-[1px] uppercase" style={{ color: 'var(--text4)' }}>Keyword</span>
              <span className="text-[9px] font-mono font-medium tracking-[1px] uppercase" style={{ color: 'var(--text4)' }}>Collection</span>
              <span className="text-[9px] font-mono font-medium tracking-[1px] uppercase" style={{ color: 'var(--text4)' }}>Status</span>
              <span />
            </div>

            {/* Rows */}
            {items.map(item => (
              <div
                key={item.id}
                className="grid gap-2 items-center px-2 py-1.5 rounded-md hover:bg-black/[0.02] transition-colors"
                style={{ gridTemplateColumns: '1fr 1fr 160px 100px 36px' }}
              >
                <input
                  type="text"
                  value={item.title}
                  onChange={e => updateRow(item.id, 'title', e.target.value)}
                  disabled={item.status !== 'queued'}
                  placeholder="Article title..."
                  className="rounded border px-2 py-1.5 text-[12px] outline-none"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
                />
                <input
                  type="text"
                  value={item.keyword}
                  onChange={e => updateRow(item.id, 'keyword', e.target.value)}
                  disabled={item.status !== 'queued'}
                  placeholder="Target keyword..."
                  className="rounded border px-2 py-1.5 text-[12px] outline-none"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
                />
                <select
                  value={item.collection}
                  onChange={e => updateRow(item.id, 'collection', e.target.value)}
                  disabled={item.status !== 'queued'}
                  className="rounded border px-2 py-1.5 text-[12px] outline-none"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
                >
                  <option value="">--</option>
                  {COLLECTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex items-center gap-1.5">
                  {item.status === 'queued' && <Circle className="h-3 w-3" style={{ color: 'var(--text4)' }} />}
                  {item.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'var(--nn-accent)' }} />}
                  {item.status === 'done' && <Check className="h-3 w-3" style={{ color: 'var(--nn-accent)' }} />}
                  {item.status === 'error' && <AlertCircle className="h-3 w-3" style={{ color: '#c53030' }} />}
                  <span className="text-[11px] truncate" style={{
                    color: item.status === 'running' ? 'var(--nn-accent)' : item.status === 'error' ? '#c53030' : 'var(--text3)',
                  }}>
                    {item.status === 'queued' ? 'Queued' : item.status === 'running' ? (item.step || 'Running...') : item.status === 'done' ? (item.step || 'Done') : (item.error || 'Error')}
                  </span>
                </div>
                <button
                  onClick={() => removeRow(item.id)}
                  disabled={item.status === 'running'}
                  className="flex items-center justify-center rounded p-1 hover:bg-black/5 transition-colors disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--text4)' }} />
                </button>
              </div>
            ))}

            {/* Add row button */}
            {!isRunning && (
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 px-2 py-2 mt-1 text-[12px] rounded-md hover:bg-black/[0.02] transition-colors w-full"
                style={{ color: 'var(--text3)' }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add row
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer stats */}
      {items.length > 0 && (
        <div className="flex items-center justify-between border-t px-6 py-2.5" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--text3)' }}>
            <span>{validCount} valid</span>
            {doneCount > 0 && <span style={{ color: 'var(--nn-accent)' }}>{doneCount} completed</span>}
            {errorCount > 0 && <span style={{ color: '#c53030' }}>{errorCount} failed</span>}
          </div>
          <span className="text-[10px] font-mono" style={{ color: 'var(--text4)' }}>
            ~{Math.round(validCount * 3)} min estimated
          </span>
        </div>
      )}
    </div>
  )
}

function StatItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-mono uppercase tracking-[1px]" style={{ color: 'var(--text4)' }}>{label}</span>
      <span className="text-[14px] font-semibold" style={{ color: color || 'var(--text1)' }}>{value}</span>
    </div>
  )
}
