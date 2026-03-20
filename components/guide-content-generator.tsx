'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Link2,
  Sparkles,
  Undo2,
  History,
  Eye,
  EyeOff,
  PanelRightClose,
  PanelRightOpen,
  ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UltimateGuide } from './ultimate-guide-wizard'
import { assembleCompleteGuideHtml, type AssemblerClusterLink } from '@/lib/guide-assembler'

const SECTIONS = [
  { key: 'key-takeaways', label: 'Key Takeaways' },
  { key: 'what-is', label: 'What Is...' },
  { key: 'how-it-works', label: 'How It Works' },
  { key: 'types', label: 'Types' },
  { key: 'health-benefits', label: 'Health Benefits' },
  { key: 'how-to-use', label: 'How to Use' },
  { key: 'safety', label: 'Safety & Considerations' },
  { key: 'featured-products', label: 'Featured Products' },
  { key: 'faq', label: 'FAQ' },
  { key: 'meta', label: 'Meta Description' },
] as const

interface SectionContent {
  key: string
  title: string
  html: string
  status: 'pending' | 'generating' | 'ready' | 'error'
  error?: string
}

interface SectionVersion {
  html: string
  ts: string // ISO timestamp
}

// Per-section version stack: { "key-takeaways": [oldest, ..., newest], ... }
type VersionMap = Record<string, SectionVersion[]>

const MAX_VERSIONS_PER_SECTION = 5

// Re-use the assembler's ClusterLink type
type ClusterLink = AssemblerClusterLink

interface GuideContentGeneratorProps {
  guide: UltimateGuide
  onSave: (guide: UltimateGuide) => void
  onBack: () => void
}

function SectionNav({ sections, activeKey, onSelect, versionCounts }: { sections: SectionContent[]; activeKey: string; onSelect: (key: string) => void; versionCounts?: Record<string, number> }) {
  return (
    <div className="flex flex-col gap-1.5 pr-4">
      {sections.map(section => (
        <button
          key={section.key}
          onClick={() => onSelect(section.key)}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-all',
            activeKey === section.key
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'hover:bg-gray-100 text-gray-700'
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full flex-shrink-0',
              section.status === 'ready'
                ? 'bg-green-500'
                : section.status === 'generating'
                ? 'bg-blue-500 animate-pulse'
                : section.status === 'error'
                ? 'bg-red-500'
                : 'bg-gray-300'
            )}
          />
          <span className="truncate flex-1">{section.title}</span>
          {(versionCounts?.[section.key] || 0) > 0 && (
            <History className="h-3 w-3 text-gray-400 flex-shrink-0" />
          )}
        </button>
      ))}
    </div>
  )
}

function SectionPreview({ section }: { section: SectionContent }) {
  if (section.status === 'generating') {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-600">Generating content...</span>
      </div>
    )
  }

  if (section.status === 'error') {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <div className="flex gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900">Error generating content</p>
            <p className="text-sm text-red-700 mt-1">{section.error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!section.html) {
    return (
      <div className="rounded-lg border-2 border-dashed p-8 text-center text-gray-500">
        Click Generate to create this section
      </div>
    )
  }

  return (
    <div
      className="prose prose-sm max-w-none rounded-lg bg-gray-50 p-4 border"
      dangerouslySetInnerHTML={{ __html: section.html }}
    />
  )
}

function MetaEditor({ value, onChange, onDraftMeta, isDrafting }: { value: string; onChange: (v: string) => void; onDraftMeta: () => void; isDrafting: boolean }) {
  const charCount = value.length
  const charColor = charCount === 0 ? 'text-gray-500' : charCount >= 150 && charCount <= 160 ? 'text-green-600' : charCount > 160 ? 'text-red-500' : 'text-amber-600'
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">Meta Description</label>
        <Button
          onClick={onDraftMeta}
          disabled={isDrafting}
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
        >
          {isDrafting ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Drafting...</>
          ) : (
            <><Sparkles className="h-3 w-3" /> Draft with AI</>
          )}
        </Button>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Enter SEO meta description (150-160 characters)"
        className="w-full px-3 py-2 border rounded-lg"
        rows={3}
      />
      <p className={cn('text-xs', charColor)}>
        {charCount} characters (recommended: 150-160)
      </p>
    </div>
  )
}

function LivePreviewPanel({ html, isOpen }: { html: string; isOpen: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!isOpen || !iframeRef.current) return
    const doc = iframeRef.current.contentDocument
    if (doc) {
      doc.open()
      doc.write(html || '<html><body style="font-family:system-ui;color:#999;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><p>Generate sections to see a live preview</p></body></html>')
      doc.close()
    }
  }, [html, isOpen])

  if (!isOpen) return null

  return (
    <div className="flex flex-col border-l bg-white" style={{ width: '45%', minWidth: 360 }}>
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-gray-50">
        <Eye className="h-4 w-4 text-gray-500" />
        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Live Preview</span>
      </div>
      <iframe
        ref={iframeRef}
        className="flex-1 w-full"
        sandbox="allow-same-origin"
        title="Guide Preview"
        style={{ border: 'none' }}
      />
    </div>
  )
}

async function generateSection(
  guide: UltimateGuide,
  sectionKey: string,
  topicShort: string,
  clusterLinks: ClusterLink[] = [],
  previousSections: Record<string, string> = {},
  userFeedback: string = ''
): Promise<string> {
  const res = await fetch('/api/ultimate-guides/generate-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sectionId: sectionKey,
      guideTitle: guide.title,
      topicShort: topicShort,
      topicShortPlural: guide.topic_short_plural || topicShort + 's',
      topicFull: guide.topic_full || topicShort,
      products: (guide.selected_products || []).map(p => ({
        title: p.title,
        vendor: p.vendor,
        price: p.price,
        subcategory: '',
        role: p.selected_role || 'best-value',
        desc: '',
        specs: [],
      })),
      clusterLinks,
      previousSections,
      userFeedback,
    }),
  })

  if (!res.ok) {
    throw new Error('Failed to generate section')
  }

  const data = await res.json()
  return data.html || ''
}

// Product cards and final HTML assembly are handled by guide-assembler.ts

// Generate a meta description draft via the existing 'meta' section endpoint
async function draftMetaDescription(
  guide: UltimateGuide,
  topicShort: string,
  sectionSummaries: Record<string, string>
): Promise<string> {
  const res = await fetch('/api/ultimate-guides/generate-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sectionId: 'meta',
      guideTitle: guide.title,
      topicShort: topicShort,
      topicShortPlural: guide.topic_short_plural || topicShort + 's',
      topicFull: guide.topic_full || topicShort,
      products: (guide.selected_products || []).map(p => ({
        title: p.title,
        vendor: p.vendor,
        price: p.price,
        subcategory: '',
        role: p.selected_role || 'best-value',
        desc: '',
        specs: [],
      })),
      clusterLinks: [],
      previousSections: sectionSummaries,
    }),
  })

  if (!res.ok) throw new Error('Failed to draft meta description')

  const data = await res.json()
  // The meta endpoint returns { metaData: { metaDescription, ... } } or { html }
  if (data.metaData?.metaDescription) return data.metaData.metaDescription
  // Fallback: try to parse the html field as JSON
  if (data.html) {
    try {
      const parsed = JSON.parse(data.html)
      if (parsed.metaDescription) return parsed.metaDescription
    } catch { /* not JSON, ignore */ }
  }
  return ''
}

// Fetch all products for the guide's collection from the DB
async function fetchCollectionProducts(
  collectionSlug: string
): Promise<Array<{ title: string; handle: string; price: string; vendor: string; description: string; productType: string; tags: string; imageUrl: string }>> {
  try {
    const res = await fetch(`/api/products?category=${encodeURIComponent(collectionSlug)}&limit=100`)
    if (!res.ok) {
      console.error(`[Products API Error] Status: ${res.status} for slug: "${collectionSlug}"`)
      try { console.error('[Products API Error] Body:', await res.text()) } catch (e) { console.error('[Products API Error] Could not read response body:', e) }
      return []
    }
    const data = await res.json()
    const products = data.products || data || []
    console.log(`[Products API] Fetched ${products.length} products (source: ${data.source || 'unknown'}, total in DB: ${data.total || '?'}) for slug: "${collectionSlug}"`)
    return products.map((p: Record<string, unknown>) => ({
      title: (p.title as string) || '',
      handle: (p.handle as string) || '',
      price: String(p.price || '0'),
      vendor: (p.vendor as string) || '',
      description: (p.description as string) || '',
      productType: (p.productType as string) || '',
      tags: (p.tags as string) || '',
      imageUrl: (p.imageUrl as string) || (p.image_url as string) || '',
    }))
  } catch (err) {
    console.error('Failed to fetch collection products:', err)
    return []
  }
}

// Ask Claude to select featured products based on guide content
async function selectFeaturedProducts(
  guide: UltimateGuide,
  sectionSummaries: Record<string, string>,
  allProducts: Array<{ title: string; handle: string; price: string; vendor: string; description: string; productType: string; tags: string; imageUrl: string }>
): Promise<{
  selectedProducts: Array<{ handle: string; role: string; reason: string }>
  introHtml: string
} | null> {
  try {
    const res = await fetch('/api/ultimate-guides/select-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guideTitle: guide.title,
        topicShort: guide.topic_short,
        topicFull: guide.topic_full || guide.topic_short,
        sectionSummaries,
        products: allProducts,
      }),
    })
    const data = await res.json().catch(() => ({}))
    console.log(`[Select Products API] Status: ${res.status}, sent ${allProducts.length} products`)
    if (!res.ok) {
      // If the API returned a partial result (422), use it — better than nothing
      if (data.partialResult && data.partialResult.selectedProducts?.length > 0) {
        console.warn('[Select Products] Using partial result:', data.error, data.partialResult.selectedProducts)
        return { selectedProducts: data.partialResult.selectedProducts, introHtml: data.partialResult.introHtml || '' }
      }
      console.error('[Select Products] Failed:', res.status, data.error || res.statusText)
      return null
    }
    console.log(`[Select Products] AI returned ${data.selectedProducts?.length || 0} products:`, data.selectedProducts?.map((sp: { handle: string; role: string }) => `${sp.handle} (${sp.role})`))
    return data
  } catch (err) {
    console.error('Product selection error:', err)
    return null
  }
}

export function GuideContentGenerator({ guide, onSave, onBack }: GuideContentGeneratorProps) {
  const [sections, setSections] = useState<SectionContent[]>(() => {
    const saved = guide.section_content as Record<string, string> | undefined
    return SECTIONS.map(s => {
      const savedHtml = saved && saved[s.key] ? saved[s.key] : ''
      return {
        key: s.key,
        title: s.label,
        html: savedHtml,
        status: savedHtml ? 'ready' as const : 'pending' as const,
      }
    })
  })
  const [activeSection, setActiveSection] = useState('key-takeaways')
  const [metaDescription, setMetaDescription] = useState(guide.meta_description || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isDraftingMeta, setIsDraftingMeta] = useState(false)
  const [versions, setVersions] = useState<VersionMap>(() => {
    // Load persisted versions from guide data
    const saved = (guide as unknown as Record<string, unknown>).section_versions as VersionMap | undefined
    return saved && typeof saved === 'object' ? saved : {}
  })
  const [showPreview, setShowPreview] = useState(false)
  const [sectionFeedback, setSectionFeedback] = useState<Record<string, string>>({})
  const [clusterLinks, setClusterLinks] = useState<ClusterLink[]>([])
  const [linksLoaded, setLinksLoaded] = useState(false)
  const [isSelectingProducts, setIsSelectingProducts] = useState(false)
  const [productSelectionDone, setProductSelectionDone] = useState(
    // If guide already has AI-selected products, skip re-selection
    (guide.selected_products?.length || 0) >= 1
  )
  const [collectionProducts, setCollectionProducts] = useState<
    Array<{ title: string; handle: string; price: string; vendor: string; description: string; productType: string; tags: string; imageUrl: string }>
  >([])
  const [selectedProductResults, setSelectedProductResults] = useState<
    Array<{ handle: string; role: string; reason: string }>
  >([])

  // Load all products for the collection on mount
  useEffect(() => {
    if (!guide.collection_slug) {
      console.warn('[Products] No collection_slug on guide — cannot load products')
      return
    }
    console.log(`[Products] Loading products for collection_slug: "${guide.collection_slug}"`)
    fetchCollectionProducts(guide.collection_slug).then(products => {
      setCollectionProducts(products)
      if (products.length === 0) {
        console.warn(`[Products] 0 products returned for "${guide.collection_slug}". Have you uploaded a product CSV for this collection?`)
      } else {
        console.log(`[Products] Loaded ${products.length} products for "${guide.collection_slug}"`)
      }
    })
  }, [guide.collection_slug])

  // Load cluster links from topical authority resources
  useEffect(() => {
    async function loadClusterLinks() {
      try {
        const collectionSlug = guide.collection_slug || ''
        const taUrl = collectionSlug
          ? `/api/resources?type=topical-authority&collection=${encodeURIComponent(collectionSlug)}`
          : '/api/resources?type=topical-authority'

        const resp = await fetch(taUrl)
        if (resp.ok) {
          const data = await resp.json()
          // Resources API returns { items: [...], count } or { resources: [...] } or an array
          const resources = data.items || data.resources || data || []
          const links: ClusterLink[] = resources
            .filter((r: Record<string, unknown>) => r.slug || r.url || r.existingUrl)
            .map((r: Record<string, unknown>) => {
              // Extract slug from existingUrl if no slug field: "/blogs/wellness/my-article" -> "my-article"
              const existingUrl = (r.existingUrl as string) || (r.url as string) || ''
              const slugFromUrl = existingUrl.replace(/^.*\/blogs\/wellness\//, '').replace(/^\//, '')
              return {
                title: (r.title as string) || (r.anchor as string) || (r.primaryKeyword as string) || '',
                slug: (r.slug as string) || slugFromUrl || '',
                url: existingUrl,
                anchor: (r.anchor as string) || (r.title as string) || (r.primaryKeyword as string) || '',
              }
            })
            .filter((l: ClusterLink) => l.slug || l.url)
          setClusterLinks(links)
          console.log(`Loaded ${links.length} cluster links for guide`)
        }
      } catch (err) {
        console.error('Failed to load cluster links:', err)
      } finally {
        setLinksLoaded(true)
      }
    }
    loadClusterLinks()
  }, [guide.collection_slug])

  // Assemble preview HTML whenever sections change
  const previewHtml = useMemo(() => {
    const sectionData: Record<string, string> = {}
    for (const s of sections) {
      if (s.html && s.key !== 'meta') sectionData[s.key] = s.html
    }
    if (Object.keys(sectionData).length === 0) return ''
    return assembleCompleteGuideHtml(
      {
        title: guide.title,
        slug: guide.slug,
        topic_short: guide.topic_short,
        topic_short_plural: guide.topic_short_plural,
        topic_full: guide.topic_full,
        meta_description: metaDescription || guide.meta_description,
        breadcrumb_l2_name: guide.breadcrumb_l2_name,
        breadcrumb_l2_slug: guide.breadcrumb_l2_slug,
        collection_slug: guide.collection_slug,
        hero_image_cdn_url: guide.hero_image_cdn_url,
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
  }, [sections, metaDescription, guide, clusterLinks])

  const currentSection = sections.find(s => s.key === activeSection)!

  // Persist individual section content to DB incrementally
  const saveSectionToDb = async (sectionKey: string, html: string, allSections: SectionContent[]) => {
    try {
      const sectionData: Record<string, string> = {}
      for (const s of allSections) {
        if (s.html) sectionData[s.key] = s.html
      }
      sectionData[sectionKey] = html
      const payload = JSON.stringify({ id: guide.id, section_content: sectionData })
      console.log(`[Save Section] Saving "${sectionKey}" (payload: ${(payload.length / 1024).toFixed(1)}KB)`)
      const res = await fetch('/api/ultimate-guides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error(`[Save Section] PUT failed (${res.status}):`, errData.error || res.statusText)
      }
    } catch (err) {
      console.error('[Save Section] Failed:', err)
    }
  }

  // Push current HTML to version history before overwriting
  const pushVersion = (sectionKey: string, html: string) => {
    if (!html) return // nothing to save
    setVersions(prev => {
      const stack = prev[sectionKey] || []
      const newEntry: SectionVersion = { html, ts: new Date().toISOString() }
      const updated = [...stack, newEntry].slice(-MAX_VERSIONS_PER_SECTION)
      const newVersions = { ...prev, [sectionKey]: updated }
      // Persist to DB (fire-and-forget)
      persistVersions(newVersions)
      return newVersions
    })
  }

  const persistVersions = async (versionMap: VersionMap) => {
    try {
      const res = await fetch('/api/ultimate-guides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: guide.id, section_versions: versionMap }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error(`[Persist Versions] PUT failed (${res.status}):`, errData.error || res.statusText)
      }
    } catch (err) {
      console.error('[Persist Versions] Failed:', err)
    }
  }

  // Undo: pop the most recent version and restore it
  const handleUndo = (sectionKey: string) => {
    setVersions(prev => {
      const stack = prev[sectionKey] || []
      if (stack.length === 0) return prev
      const restored = stack[stack.length - 1]
      const remaining = stack.slice(0, -1)
      const newVersions = { ...prev, [sectionKey]: remaining }

      // Restore the section HTML
      setSections(s =>
        s.map(sec =>
          sec.key === sectionKey
            ? { ...sec, html: restored.html, status: 'ready' as const }
            : sec
        )
      )
      // Persist both the restored content and trimmed version stack
      saveSectionToDb(sectionKey, restored.html, sections.map(sec =>
        sec.key === sectionKey ? { ...sec, html: restored.html } : sec
      ))
      persistVersions(newVersions)
      return newVersions
    })
  }

  const getVersionCount = (sectionKey: string): number => {
    return (versions[sectionKey] || []).length
  }

  const handleGenerateSection = async () => {
    // Save current version before regenerating
    const current = sections.find(s => s.key === activeSection)
    if (current?.html) pushVersion(activeSection, current.html)

    setSections(prev =>
      prev.map(s => (s.key === activeSection ? { ...s, status: 'generating' as const } : s))
    )

    try {
      // Pass summaries of already-generated sections so AI stays consistent
      const prevSummaries = getSectionSummaries(sections)
      // Don't include the current section in its own context
      delete prevSummaries[activeSection]
      const feedback = sectionFeedback[activeSection] || ''
      const html = await generateSection(guide, activeSection, guide.topic_short, clusterLinks, prevSummaries, feedback)
      setSections(prev => {
        const updated = prev.map(s =>
          s.key === activeSection
            ? { ...s, html, status: 'ready' as const, error: undefined }
            : s
        )
        saveSectionToDb(activeSection, html, updated)
        return updated
      })
    } catch (err) {
      setSections(prev =>
        prev.map(s =>
          s.key === activeSection
            ? { ...s, status: 'error' as const, error: err instanceof Error ? err.message : 'Unknown error' }
            : s
        )
      )
    }
  }

  // Build plain-text summaries from generated sections for meta context
  const getSectionSummaries = (currentSections: SectionContent[]): Record<string, string> => {
    const summaries: Record<string, string> = {}
    for (const s of currentSections) {
      if (s.html && s.key !== 'meta') {
        // Strip HTML tags to get plain text summary
        summaries[s.key] = s.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
      }
    }
    return summaries
  }

  const handleDraftMeta = async (latestSections?: SectionContent[]) => {
    setIsDraftingMeta(true)
    // Update meta section nav indicator
    setSections(prev =>
      prev.map(s => (s.key === 'meta' ? { ...s, status: 'generating' as const } : s))
    )
    try {
      const sectionsToUse = latestSections || sections
      const summaries = getSectionSummaries(sectionsToUse)
      const draft = await draftMetaDescription(guide, guide.topic_short, summaries)
      if (draft) {
        setMetaDescription(draft)
        setSections(prev =>
          prev.map(s => (s.key === 'meta' ? { ...s, html: draft, status: 'ready' as const } : s))
        )
      } else {
        setSections(prev =>
          prev.map(s => (s.key === 'meta' ? { ...s, status: 'pending' as const } : s))
        )
      }
    } catch (err) {
      console.error('Failed to draft meta description:', err)
      setSections(prev =>
        prev.map(s => (s.key === 'meta' ? { ...s, status: 'error' as const, error: 'Failed to draft meta' } : s))
      )
    } finally {
      setIsDraftingMeta(false)
    }
  }

  // Price-ranked fallback — same logic as the main article generator (always works)
  function priceRankedFallback(
    products: Array<{ title: string; handle: string; price: string; vendor: string; description: string; productType: string; tags: string; imageUrl: string }>
  ): UltimateGuide['selected_products'] {
    // Prefer products with images, then sort by price for badge diversity
    const withImages = products.filter(p => p.imageUrl)
    const pool = withImages.length >= 4 ? withImages : products
    const sorted = [...pool].sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0))
    // Pick up to 8: cheapest, most expensive, then fill from middle
    const picks: typeof sorted = []
    if (sorted.length >= 1) picks.push(sorted[0]) // cheapest
    if (sorted.length >= 2) picks.push(sorted[sorted.length - 1]) // most expensive
    if (sorted.length >= 3) picks.push(sorted[Math.floor(sorted.length / 3)]) // lower-mid
    if (sorted.length >= 4) picks.push(sorted[Math.floor(sorted.length * 2 / 3)]) // upper-mid
    // Fill remaining from products not yet picked, up to 8
    const pickedHandles = new Set(picks.map(p => p.handle))
    for (const p of sorted) {
      if (picks.length >= 8) break
      if (!pickedHandles.has(p.handle)) { picks.push(p); pickedHandles.add(p.handle) }
    }
    const ROLES = ['Best Value', 'Commercial Grade', 'Top Pick', 'Premium Choice', 'Best for Beginners', 'Most Versatile', "Editor's Pick", 'Best Splurge']
    return picks.map((p, i) => ({
      id: p.handle,
      title: p.title,
      handle: p.handle,
      image_url: p.imageUrl,
      price: parseFloat(p.price) || 0,
      vendor: p.vendor,
      selected_role: i < 2 ? (i === 0 ? 'best-value' as const : 'best-upgrade' as const) : (i % 2 === 0 ? 'best-value' as const : 'best-upgrade' as const),
      selected_subcategory: ROLES[i] || 'Featured',
    }))
  }

  // AI product selection — called after all sections generate
  // Falls back to price-ranked selection (same as main article flow) if AI fails
  const handleSelectProducts = async (latestSections?: SectionContent[]) => {
    // If products haven't loaded yet, wait briefly and retry once
    let products = collectionProducts
    if (products.length === 0 && guide.collection_slug) {
      console.log('Products not loaded yet, retrying fetch...')
      products = await fetchCollectionProducts(guide.collection_slug)
      if (products.length > 0) {
        setCollectionProducts(products)
      }
    }

    if (products.length === 0) {
      console.warn(`[Select Products] No products found for "${guide.collection_slug}" after retry. DB may be empty for this collection.`)
      setSections(prev =>
        prev.map(s =>
          s.key === 'featured-products'
            ? { ...s, status: 'error' as const, error: `No products found for "${guide.collection_slug}". Upload a product CSV for this collection, then click "Select Products" to retry.` }
            : s
        )
      )
      return
    }

    setIsSelectingProducts(true)
    // Show the featured-products section as generating
    setSections(prev =>
      prev.map(s => (s.key === 'featured-products' ? { ...s, status: 'generating' as const } : s))
    )
    setActiveSection('featured-products')

    // Helper to finalize product selection (shared by AI path and fallback path)
    const finalizeSelection = async (
      selectedWithDetails: UltimateGuide['selected_products'],
      introHtml?: string
    ) => {
      setSelectedProductResults(
        selectedWithDetails.map(p => ({ handle: p.handle, role: p.selected_subcategory || '', reason: '' }))
      )
      setProductSelectionDone(true)

      if (introHtml) {
        setSections(prev => {
          const updated = prev.map(s =>
            s.key === 'featured-products'
              ? { ...s, html: introHtml, status: 'ready' as const }
              : s
          )
          saveSectionToDb('featured-products', introHtml, updated)
          return updated
        })
      } else {
        setSections(prev =>
          prev.map(s =>
            s.key === 'featured-products'
              ? { ...s, html: `<p>We've selected the best ${guide.topic_short || 'products'} across different price points and use cases to help you find the right fit.</p>`, status: 'ready' as const }
              : s
          )
        )
      }

      // Persist selected products to DB
      try {
        await fetch('/api/ultimate-guides', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: guide.id,
            selected_products: selectedWithDetails,
            products_complete: true,
          }),
        })
      } catch (err) {
        console.error('Failed to persist selected products:', err)
      }

      guide.selected_products = selectedWithDetails
      guide.products_complete = true
      console.log(`Selected ${selectedWithDetails.length} products for the guide`)
    }

    try {
      const sectionsToUse = latestSections || sections
      const summaries = getSectionSummaries(sectionsToUse)

      // Send at most 40 products to AI (trim to reduce payload / improve reliability)
      const productsForAI = products.slice(0, 40)
      console.log(`[AI Selection] Sending ${productsForAI.length} of ${products.length} products to AI`)
      const result = await selectFeaturedProducts(guide, summaries, productsForAI)

      if (result && result.selectedProducts && result.selectedProducts.length > 0) {
        // Normalize handles for matching (AI may strip ® ™ etc.) — original handles preserved
        const normalizeHandle = (h: string) => h.normalize('NFKD').replace(/[^\x00-\x7F]/g, '').replace(/--+/g, '-').replace(/^-|-$/g, '').toLowerCase()
        const productHandleMap = new Map<string, typeof products[0]>()
        for (const p of products) {
          productHandleMap.set(p.handle.toLowerCase(), p)
          productHandleMap.set(normalizeHandle(p.handle), p)
        }
        const selectedWithDetails = result.selectedProducts.map(sp => {
          const full = productHandleMap.get(sp.handle.toLowerCase()) || productHandleMap.get(normalizeHandle(sp.handle))
          if (!full) {
            console.warn(`[Product Match] AI handle "${sp.handle}" did not match any loaded product`)
            return null
          }
          const roleType: 'best-value' | 'best-upgrade' =
            /premium|upgrade|splurge|commercial|editor/i.test(sp.role) ? 'best-upgrade' : 'best-value'
          return {
            id: full.handle,
            title: full.title,
            handle: full.handle,
            image_url: full.imageUrl,
            price: parseFloat(full.price) || 0,
            vendor: full.vendor,
            selected_role: roleType,
            selected_subcategory: sp.role,
          }
        }).filter(Boolean) as UltimateGuide['selected_products']

        if (selectedWithDetails.length >= 2) {
          console.log(`[AI Selection] Success — ${selectedWithDetails.length} products matched`)
          await finalizeSelection(selectedWithDetails, result.introHtml)
        } else {
          // AI returned products but handles didn't match — fall back
          console.warn(`[AI Selection] Only ${selectedWithDetails.length} handles matched. Falling back to price-ranked.`)
          const fallback = priceRankedFallback(products)
          await finalizeSelection(fallback)
        }
      } else {
        // AI returned nothing useful — fall back
        console.warn('[AI Selection] No results. Falling back to price-ranked selection.')
        const fallback = priceRankedFallback(products)
        await finalizeSelection(fallback)
      }
    } catch (err) {
      // AI call failed entirely — fall back
      console.error('[AI Selection] Failed:', err, '— using price-ranked fallback')
      const fallback = priceRankedFallback(products)
      await finalizeSelection(fallback)
    } finally {
      setIsSelectingProducts(false)
    }
  }

  const handleGenerateAll = async () => {
    let latestSections: SectionContent[] = []
    // Build cumulative context as each section generates
    const cumulativeSummaries: Record<string, string> = {}

    for (const section of SECTIONS) {
      if (section.key === 'meta') continue

      // Save current version before regenerating
      const current = latestSections.find(s => s.key === section.key) || sections.find(s => s.key === section.key)
      if (current?.html) pushVersion(section.key, current.html)

      setSections(prev =>
        prev.map(s => (s.key === section.key ? { ...s, status: 'generating' as const } : s))
      )
      setActiveSection(section.key)

      try {
        // Pass cumulative summaries of all previously generated sections
        const html = await generateSection(guide, section.key, guide.topic_short, clusterLinks, cumulativeSummaries)
        // Add this section's summary to the cumulative context for subsequent sections
        const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        cumulativeSummaries[section.key] = plainText.slice(0, 300)
        setSections(prev => {
          const updated = prev.map(s =>
            s.key === section.key
              ? { ...s, html, status: 'ready' as const, error: undefined }
              : s
          )
          saveSectionToDb(section.key, html, updated)
          latestSections = updated
          return updated
        })
      } catch (err) {
        setSections(prev => {
          const updated = prev.map(s =>
            s.key === section.key
              ? { ...s, status: 'error' as const, error: err instanceof Error ? err.message : 'Unknown error' }
              : s
          )
          latestSections = updated
          return updated
        })
      }
    }

    // Auto-draft meta description if not already written
    if (!metaDescription) {
      setActiveSection('meta')
      await handleDraftMeta(latestSections)
    }

    // Auto-select featured products after all content is generated
    if (!productSelectionDone) {
      await handleSelectProducts(latestSections)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      // Build section_content map for persistence
      const sectionData: Record<string, string> = {}
      for (const s of sections) {
        if (s.html && s.key !== 'meta') sectionData[s.key] = s.html
      }

      // Assemble the complete, publish-ready page HTML
      let finalHtml = ''
      try {
        finalHtml = assembleCompleteGuideHtml(
          {
            title: guide.title,
            slug: guide.slug,
            topic_short: guide.topic_short,
            topic_short_plural: guide.topic_short_plural,
            topic_full: guide.topic_full,
            meta_description: metaDescription || guide.meta_description,
            breadcrumb_l2_name: guide.breadcrumb_l2_name,
            breadcrumb_l2_slug: guide.breadcrumb_l2_slug,
            collection_slug: guide.collection_slug,
            hero_image_cdn_url: guide.hero_image_cdn_url,
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
      } catch (assemblerErr) {
        console.error('[handleSave] Assembler error (proceeding anyway):', assemblerErr)
      }

      // Convert loaded cluster links to guide's DB format so downstream steps have them
      const clusterLinksForGuide = clusterLinks.map(l => ({
        url: l.url || (l.slug ? `/blogs/wellness/${l.slug}` : ''),
        anchor: l.title || l.anchor || '',
      }))

      const updatedGuide: UltimateGuide = {
        ...guide,
        selected_products: guide.selected_products, // Include AI-selected products
        html_content: finalHtml || '',
        content_complete: true,
        products_complete: (guide.selected_products?.length || 0) >= 1,
        meta_description: metaDescription || guide.meta_description,
        section_content: sectionData,
        cluster_links: clusterLinksForGuide.length > 0 ? clusterLinksForGuide : guide.cluster_links,
      }

      // Persist to DB — don't let failure block proceeding to images
      try {
        const putRes = await fetch('/api/ultimate-guides', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: guide.id,
            html_content: finalHtml,
            content_complete: true,
            meta_description: metaDescription || guide.meta_description,
            section_content: sectionData,
            cluster_links: clusterLinksForGuide.length > 0 ? clusterLinksForGuide : guide.cluster_links,
          }),
        })
        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}))
          console.error(`[handleSave] PUT failed (${putRes.status}):`, errData.error || putRes.statusText)
        }
      } catch (putErr) {
        console.error('[handleSave] Failed to persist to DB (proceeding anyway):', putErr)
      }

      onSave(updatedGuide)
    } catch (err) {
      console.error('[handleSave] Unexpected error:', err)
      // Still try to proceed — don't leave the user stuck
      const fallbackData: Record<string, string> = {}
      for (const s of sections) {
        if (s.html && s.key !== 'meta') fallbackData[s.key] = s.html
      }
      onSave({
        ...guide,
        content_complete: true,
        section_content: fallbackData,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const readySections = sections.filter(s => s.status === 'ready').length
  const totalSections = SECTIONS.length - 1 // exclude meta

  return (
    <div className="flex flex-1 gap-6 p-8 overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="w-48 flex-shrink-0 pt-6">
        <p className="text-xs font-mono uppercase text-gray-500 mb-3">Sections</p>
        <SectionNav
          sections={sections}
          activeKey={activeSection}
          onSelect={setActiveSection}
          versionCounts={Object.fromEntries(
            Object.entries(versions).map(([k, v]) => [k, v.length])
          )}
        />

        {clusterLinks.length > 0 && (
          <div className="mt-4 p-2 rounded bg-green-50 border border-green-200">
            <div className="flex items-center gap-1 text-xs font-medium text-green-700">
              <Link2 className="h-3 w-3" />
              {clusterLinks.length} cluster links loaded
            </div>
          </div>
        )}

        {/* Product selection status */}
        <div className={cn(
          'mt-3 p-2 rounded border',
          productSelectionDone
            ? 'bg-green-50 border-green-200'
            : isSelectingProducts
            ? 'bg-blue-50 border-blue-200'
            : 'bg-gray-50 border-gray-200'
        )}>
          <div className="flex items-center gap-1 text-xs font-medium">
            {isSelectingProducts ? (
              <><Loader2 className="h-3 w-3 animate-spin text-blue-600" /><span className="text-blue-700">AI selecting products...</span></>
            ) : productSelectionDone ? (
              <><ShoppingBag className="h-3 w-3 text-green-600" /><span className="text-green-700">{guide.selected_products?.length || 0} products selected</span></>
            ) : collectionProducts.length === 0 ? (
              <><AlertCircle className="h-3 w-3 text-amber-500" /><span className="text-amber-600">No products loaded for &ldquo;{guide.collection_slug}&rdquo;</span></>
            ) : (
              <><ShoppingBag className="h-3 w-3 text-gray-400" /><span className="text-gray-600">{collectionProducts.length} products available</span></>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <Button onClick={handleGenerateAll} size="sm" className="w-full gap-2">
            Generate All ({readySections}/{totalSections})
          </Button>
          {!productSelectionDone && (
            <Button
              onClick={() => handleSelectProducts()}
              disabled={isSelectingProducts || readySections < 3}
              size="sm"
              variant="outline"
              className="w-full gap-2"
              title={readySections < 3 ? 'Generate at least 3 sections first' : collectionProducts.length === 0 ? 'No products loaded — will retry fetch' : 'Let AI choose featured products'}
            >
              {isSelectingProducts ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Selecting...</>
              ) : (
                <><ShoppingBag className="h-4 w-4" /> Select Products</>
              )}
            </Button>
          )}
          {productSelectionDone && (
            <Button
              onClick={() => { setProductSelectionDone(false); handleSelectProducts() }}
              disabled={isSelectingProducts}
              size="sm"
              variant="outline"
              className="w-full gap-2"
            >
              {isSelectingProducts ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Re-selecting...</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Re-select Products</>
              )}
            </Button>
          )}
          {!productSelectionDone && !isSelectingProducts && (
            <Button
              onClick={() => {
                setProductSelectionDone(true)
                setSections(prev => prev.map(s =>
                  s.key === 'featured-products' ? { ...s, status: 'ready' as const, html: s.html || '<p>Products will be added manually.</p>', error: undefined } : s
                ))
              }}
              size="sm"
              variant="ghost"
              className="w-full gap-2 text-xs text-gray-500"
            >
              Skip Products
            </Button>
          )}
          <Button
            onClick={() => setShowPreview(p => !p)}
            size="sm"
            variant="outline"
            className="w-full gap-2"
          >
            {showPreview ? (
              <><PanelRightClose className="h-4 w-4" /> Hide Preview</>
            ) : (
              <><PanelRightOpen className="h-4 w-4" /> Live Preview</>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{currentSection.title}</h3>
              {currentSection.key !== 'meta' && (
                <div className="flex items-center gap-2">
                  {getVersionCount(currentSection.key) > 0 && (
                    <Button
                      onClick={() => handleUndo(currentSection.key)}
                      disabled={currentSection.status === 'generating'}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      title={`${getVersionCount(currentSection.key)} previous version${getVersionCount(currentSection.key) > 1 ? 's' : ''}`}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Undo
                      <span className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gray-200 px-1 text-[10px] font-medium text-gray-700">
                        {getVersionCount(currentSection.key)}
                      </span>
                    </Button>
                  )}
                  <Button
                    onClick={handleGenerateSection}
                    disabled={currentSection.status === 'generating'}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    {currentSection.status === 'generating' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" /> {currentSection.html ? 'Regenerate' : 'Generate'}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Feedback input for steering regeneration */}
            {currentSection.key !== 'meta' && currentSection.html && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Steer regeneration, e.g. &quot;Make this more clinical&quot; or &quot;Shorter, punchier&quot;"
                  value={sectionFeedback[currentSection.key] || ''}
                  onChange={e => setSectionFeedback(prev => ({ ...prev, [currentSection.key]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && currentSection.status !== 'generating') handleGenerateSection() }}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-amber-50 border-amber-200 placeholder:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
            )}

            {currentSection.key === 'meta' ? (
              <MetaEditor value={metaDescription} onChange={setMetaDescription} onDraftMeta={() => handleDraftMeta()} isDrafting={isDraftingMeta} />
            ) : (
              <SectionPreview section={currentSection} />
            )}
          </div>
        </div>

        </div>

        <div className="flex gap-2 pt-6 border-t">
          <Button onClick={onBack} variant="outline" className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back to Setup
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="ml-auto gap-2"
            style={{ background: 'var(--nn-accent)', color: '#fff' }}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                Continue to Images <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      <LivePreviewPanel html={previewHtml} isOpen={showPreview} />
    </div>
  )
}
