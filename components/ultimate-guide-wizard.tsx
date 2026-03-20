'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  BookOpen,
  AlertCircle,
  X,
  Trash2,
  FileDown,
  Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GuideProductSelector } from './guide-product-selector'
import { GuideContentGenerator } from './guide-content-generator'
import { GuideImageStoryboard } from './guide-image-storyboard'
import { GuidePublishConfirm } from './guide-publish-confirm'
import { GuideReview } from './guide-review'

export interface UltimateGuide {
  id: string
  title: string
  slug: string
  topic_short: string
  topic_short_plural?: string
  topic_full?: string
  description: string
  collection_slug?: string
  breadcrumb_l2_name?: string
  breadcrumb_l2_slug?: string
  cluster_links?: Array<{ url: string; anchor: string }>
  related_guides?: Array<{ title: string; slug: string }>
  selected_products: Array<{
    id: string
    title: string
    handle: string
    image_url: string
    price: number
    vendor: string
    selected_role?: 'best-value' | 'best-upgrade'
    selected_subcategory?: string
  }>
  status: 'draft' | 'published'
  config_complete?: boolean
  products_complete?: boolean
  content_complete?: boolean
  images_complete?: boolean
  image_count?: number
  has_images?: boolean
  html_content?: string
  section_content?: Record<string, string>
  hero_image_cdn_url?: string
  hero_image_url?: string
  meta_description?: string
  image_cdn_urls?: string[]
  published_at?: string
  date_published?: string
  read_time_mins?: number
  shopify_page_id?: string
}

export type GuideWizardStep = 'config' | 'products' | 'content' | 'images' | 'review' | 'publish'
// Note: 'products' step is kept in the type for backwards compatibility but is skipped in the UI.
// Product selection is now handled automatically by AI during the content generation step.

interface WizardStepBarProps {
  steps: { id: GuideWizardStep; label: string }[]
  currentStep: GuideWizardStep
  completedSteps: Set<GuideWizardStep>
  onStepClick?: (step: GuideWizardStep) => void
}

function WizardStepBar({ steps, currentStep, completedSteps, onStepClick }: WizardStepBarProps) {
  return (
    <div className="flex items-center justify-center gap-3 px-8 py-6" style={{ borderBottom: '1px solid #e5e7eb' }}>
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(step.id)
        const isCurrent = step.id === currentStep
        const canClick = isCompleted || isCurrent

        return (
          <div key={step.id} className="flex items-center gap-3">
            <button
              onClick={() => canClick && onStepClick?.(step.id)}
              disabled={!canClick}
              className={cn(
                'flex items-center gap-2 transition-all',
                canClick ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all',
                  isCurrent
                    ? 'bg-blue-500 text-white'
                    : isCompleted
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  isCurrent ? 'text-gray-900' : isCompleted ? 'text-green-600' : 'text-gray-500'
                )}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-12 transition-all',
                  isCompleted ? 'bg-green-500' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Collections list (same as article system) ──
const COLLECTIONS = [
  { label: 'Protein Powder', slug: 'protein-powder' },
  { label: 'Whey Protein', slug: 'whey-protein' },
  { label: 'Vegan Protein Powder', slug: 'vegan-protein-powder' },
  { label: 'Collagen Peptides', slug: 'collagen-peptides' },
  { label: 'Overnight Oats', slug: 'overnight-oats' },
  { label: 'Performance & Recovery', slug: 'improve-performance-recovery' },
  { label: 'Supplements', slug: 'supplements' },
  { label: 'Kids', slug: 'kids' },
]

interface ConfigFormProps {
  onSave: (guide: UltimateGuide) => void
  initialGuide?: UltimateGuide | null
}

interface GuideTemplate {
  id: string
  name: string
  description?: string
  collection_slug?: string
  topic_short?: string
  topic_short_plural?: string
  topic_full?: string
  breadcrumb_l2_name?: string
  breadcrumb_l2_slug?: string
  related_guides?: Array<{ title: string; slug: string }>
  product_roles?: Array<{ subcategory: string; role: string }>
  read_time_mins?: number
}

function ConfigForm({ onSave, initialGuide }: ConfigFormProps) {
  const [formData, setFormData] = useState({
    title: initialGuide?.title || '',
    slug: initialGuide?.slug || '',
    topic_short: initialGuide?.topic_short || '',
    topic_short_plural: initialGuide?.topic_short_plural || '',
    topic_full: initialGuide?.topic_full || '',
    description: initialGuide?.description || '',
    collection_slug: initialGuide?.collection_slug || '',
    breadcrumb_l2_name: initialGuide?.breadcrumb_l2_name || '',
    breadcrumb_l2_slug: initialGuide?.breadcrumb_l2_slug || '',
    date_published: initialGuide?.date_published || new Date().toISOString().slice(0, 10),
  })
  const [isSaving, setIsSaving] = useState(false)
  const [templates, setTemplates] = useState<GuideTemplate[]>([])
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  // Load templates on mount
  useEffect(() => {
    fetch('/api/ultimate-guides/templates')
      .then(r => r.ok ? r.json() : [])
      .then(setTemplates)
      .catch(() => {})
  }, [])

  const handleLoadTemplate = (template: GuideTemplate) => {
    setFormData(prev => ({
      ...prev,
      collection_slug: template.collection_slug || prev.collection_slug,
      topic_short: template.topic_short || prev.topic_short,
      topic_short_plural: template.topic_short_plural || prev.topic_short_plural,
      topic_full: template.topic_full || prev.topic_full,
      breadcrumb_l2_name: template.breadcrumb_l2_name || prev.breadcrumb_l2_name,
      breadcrumb_l2_slug: template.breadcrumb_l2_slug || prev.breadcrumb_l2_slug,
    }))
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return
    setIsSavingTemplate(true)
    try {
      const res = await fetch('/api/ultimate-guides/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          collection_slug: formData.collection_slug,
          topic_short: formData.topic_short,
          topic_short_plural: formData.topic_short_plural,
          topic_full: formData.topic_full,
          breadcrumb_l2_name: formData.breadcrumb_l2_name,
          breadcrumb_l2_slug: formData.breadcrumb_l2_slug,
        }),
      })
      if (res.ok) {
        const saved = await res.json()
        setTemplates(prev => [saved, ...prev])
        setTemplateName('')
        setShowSaveTemplate(false)
      }
    } finally {
      setIsSavingTemplate(false)
    }
  }

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    setFormData(prev => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title),
    }))
  }

  const handleCollectionChange = (slug: string) => {
    const coll = COLLECTIONS.find(c => c.slug === slug)
    setFormData(prev => ({
      ...prev,
      collection_slug: slug,
      breadcrumb_l2_name: coll?.label || '',
      breadcrumb_l2_slug: slug,
      topic_short: prev.topic_short || coll?.label || '',
    }))
  }

  const handleSave = async () => {
    if (!formData.title || !formData.slug || !formData.topic_short) {
      alert('Please fill in Title, Slug, and Short Topic')
      return
    }

    setIsSaving(true)
    // Aggressively strip guide prefixes, suffixes, and years from topic_short
    const cleanTopic = formData.topic_short
      .replace(/^(the\s+)?(ultimate|complete|definitive|comprehensive)\s+guide\s+to\s+/i, '')
      .replace(/^(a\s+)?guide\s+to\s+/i, '')
      .replace(/\s*\(?(?:20\d{2})\)?\s*/g, '')   // strip "(2026)", "2026", etc.
      .replace(/\s+guide$/i, '')                  // strip trailing "Guide"
      .replace(/\s+guides$/i, '')                 // strip trailing "Guides"
      .trim()
    const newGuide: UltimateGuide = {
      id: initialGuide?.id || 'guide_' + Date.now(),
      title: formData.title,
      slug: formData.slug,
      topic_short: cleanTopic,
      topic_short_plural: formData.topic_short_plural || cleanTopic + 's',
      topic_full: formData.topic_full || formData.title,
      description: formData.description,
      collection_slug: formData.collection_slug,
      breadcrumb_l2_name: formData.breadcrumb_l2_name,
      breadcrumb_l2_slug: formData.breadcrumb_l2_slug,
      date_published: formData.date_published,
      selected_products: initialGuide?.selected_products || [],
      status: 'draft',
      config_complete: true,
    }
    setIsSaving(false)
    onSave(newGuide)
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-[560px] space-y-6 rounded-lg border bg-white p-8">
        <div>
          <h2 className="text-2xl font-bold mb-1">Create Ultimate Guide</h2>
          <p className="text-sm text-gray-600">Step 1: Set up your guide basics</p>
        </div>

        {/* Template loader */}
        {templates.length > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <FileDown className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <select
              className="flex-1 bg-transparent text-sm border-none outline-none cursor-pointer text-blue-800"
              defaultValue=""
              onChange={e => {
                const t = templates.find(t => t.id === e.target.value)
                if (t) handleLoadTemplate(t)
              }}
            >
              <option value="" disabled>Load from template...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.collection_slug ? ` (${t.collection_slug})` : ''}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Guide Title *</label>
            <input
              type="text"
              placeholder="e.g., The Complete Guide to Whey Protein"
              value={formData.title}
              onChange={handleTitleChange}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">URL Slug *</label>
            <input
              type="text"
              value={formData.slug}
              onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Target Collection</label>
            <select
              value={formData.collection_slug}
              onChange={e => handleCollectionChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Select collection...</option>
              {COLLECTIONS.map(c => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Links products and topical authority resources to this guide</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Short Topic *</label>
              <input
                type="text"
                placeholder="e.g., Whey Protein"
                value={formData.topic_short}
                onChange={e => setFormData(prev => ({ ...prev, topic_short: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">Entity name only — e.g. &quot;Whey Protein&quot; not &quot;The Ultimate Guide to Whey Protein&quot;</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Plural Form</label>
              <input
                type="text"
                placeholder="e.g., Whey Proteins"
                value={formData.topic_short_plural}
                onChange={e => setFormData(prev => ({ ...prev, topic_short_plural: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Full Topic / H1</label>
            <input
              type="text"
              placeholder="e.g., The Complete Guide to Whey Protein for Athletes"
              value={formData.topic_full}
              onChange={e => setFormData(prev => ({ ...prev, topic_full: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Meta Description</label>
            <textarea
              placeholder="Brief description for search engines"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Publish Date</label>
            <input
              type="date"
              value={formData.date_published}
              onChange={e => setFormData(prev => ({ ...prev, date_published: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">Displayed in the guide hero and structured data. Defaults to today.</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving} className="flex-1 gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue to Content <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setShowSaveTemplate(p => !p)}
            variant="outline"
            size="icon"
            title="Save config as reusable template"
          >
            <Save className="h-4 w-4" />
          </Button>
        </div>

        {showSaveTemplate && (
          <div className="flex gap-2 items-center p-3 rounded-lg bg-gray-50 border">
            <input
              type="text"
              placeholder="Template name (e.g. Protein Guide)"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              className="flex-1 px-3 py-1.5 border rounded-md text-sm"
              onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
            />
            <Button onClick={handleSaveTemplate} disabled={isSavingTemplate || !templateName.trim()} size="sm" className="gap-1.5">
              {isSavingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

interface GuideLibraryProps {
  guides: UltimateGuide[]
  onSelectGuide: (guide: UltimateGuide) => void
  onNewGuide: () => void
  onDeleteGuide?: (id: string) => void
}

function GuideLibrary({ guides, onSelectGuide, onNewGuide, onDeleteGuide }: GuideLibraryProps) {
  return (
    <div className="flex flex-1 flex-col p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Ultimate Guides Library</h2>
          <p className="text-sm text-gray-600">Resume or review your guides</p>
        </div>
        <Button onClick={onNewGuide} className="gap-2">
          + New Guide
        </Button>
      </div>

      {guides.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed bg-gray-50">
          <div className="text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600 mb-4">No guides yet. Create your first one!</p>
            <Button onClick={onNewGuide} variant="outline" className="gap-2">
              Create Guide <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guides.map(guide => (
            <div
              key={guide.id}
              className="relative rounded-lg border hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <button
                onClick={() => onSelectGuide(guide)}
                className="w-full text-left p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm pr-8">{guide.title}</h3>
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-1 rounded flex-shrink-0',
                      guide.status === 'published'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    )}
                  >
                    {guide.status}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-3 line-clamp-2">{guide.description || guide.topic_short}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{guide.selected_products?.length || 0} products</span>
                  {guide.collection_slug && <span className="px-1.5 py-0.5 bg-gray-100 rounded">{guide.collection_slug}</span>}
                  {guide.config_complete && <span className="text-green-600">Setup \u2713</span>}
                  {guide.products_complete && <span className="text-green-600">Products \u2713</span>}
                  {guide.content_complete && <span className="text-green-600">Content \u2713</span>}
                </div>
              </button>
              {onDeleteGuide && (
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm('Delete "' + guide.title + '"? This cannot be undone.')) onDeleteGuide(guide.id) }}
                  className="absolute top-3 right-3 p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete guide"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Wizard Component ──

interface UltimateGuideWizardProps {
  activeStep?: GuideWizardStep | 'library'
  onStepChange?: (step: GuideWizardStep | 'library') => void
  currentGuide?: UltimateGuide | null
  guides?: UltimateGuide[]
  onGuideCreated?: (guide: UltimateGuide) => void
  onGuideUpdated?: (guide: UltimateGuide) => void
  onGuideDeleted?: (id: string) => void
  onGuideSelected?: (guide: UltimateGuide) => void
  onGuidePublished?: (guide: UltimateGuide) => void
  savedGuides?: UltimateGuide[]
}

export function UltimateGuideWizard({
  activeStep = 'config',
  onStepChange,
  currentGuide: parentGuide,
  guides: parentGuides,
  onGuideCreated,
  onGuideUpdated,
  onGuideDeleted,
  onGuideSelected,
  onGuidePublished,
  savedGuides = [],
}: UltimateGuideWizardProps) {
  // Use parent-managed state if provided, otherwise manage internally
  const [internalStep, setInternalStep] = useState<GuideWizardStep>(
    activeStep === 'library' ? 'config' : activeStep as GuideWizardStep
  )
  const [completedSteps, setCompletedSteps] = useState<Set<GuideWizardStep>>(new Set())
  const [internalGuide, setInternalGuide] = useState<UltimateGuide | null>(null)
  const [internalGuides, setInternalGuides] = useState<UltimateGuide[]>(savedGuides)

  const currentGuide = parentGuide || internalGuide
  const guides = parentGuides !== undefined ? parentGuides : internalGuides

  // Sync with parent activeStep
  useEffect(() => {
    if (activeStep === 'library') return
    if (activeStep !== internalStep) {
      setInternalStep(activeStep as GuideWizardStep)
    }
  }, [activeStep])

  const currentStep = internalStep

  const setCurrentStep = (step: GuideWizardStep) => {
    setInternalStep(step)
    onStepChange?.(step)
  }

  const setCurrentGuide = (guide: UltimateGuide | null) => {
    setInternalGuide(guide)
  }

  const steps: { id: GuideWizardStep; label: string }[] = [
    { id: 'config', label: 'Setup' },
    { id: 'content', label: 'Content' },
    { id: 'images', label: 'Images' },
    { id: 'review', label: 'Review' },
    { id: 'publish', label: 'Publish' },
  ]

  const handleConfigSave = async (guide: UltimateGuide) => {
    setCompletedSteps(prev => new Set(prev).add('config'))

    // If the guide already has a real UUID (editing existing), use PUT
    const isExisting = guide.id && !guide.id.startsWith('guide_')

    try {
      if (isExisting) {
        // Update existing guide config
        const res = await fetch('/api/ultimate-guides', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: guide.id,
            title: guide.title, slug: guide.slug,
            topic_short: guide.topic_short, topic_short_plural: guide.topic_short_plural,
            topic_full: guide.topic_full, collection_slug: guide.collection_slug,
            breadcrumb_l2_name: guide.breadcrumb_l2_name, breadcrumb_l2_slug: guide.breadcrumb_l2_slug,
          }),
        })
        if (res.ok) {
          const saved = await res.json()
          const merged = { ...guide, ...saved }
          setCurrentGuide(merged)
          onGuideCreated?.(merged)
          setCurrentStep('content')
          return
        }
        console.error('PUT returned', res.status)
      } else {
        // Create new guide via POST
        const res = await fetch('/api/ultimate-guides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(guide),
        })
        if (res.ok) {
          const saved = await res.json()
          const merged = { ...guide, ...saved }
          setCurrentGuide(merged)
          onGuideCreated?.(merged)
          setCurrentStep('content')
          return
        }

        // If 409 (duplicate slug), fetch the existing guide and use its real UUID
        if (res.status === 409) {
          console.warn('Guide slug already exists, fetching existing guide...')
          const existingRes = await fetch(`/api/ultimate-guides?slug=${encodeURIComponent(guide.slug)}`)
          if (existingRes.ok) {
            const existingData = await existingRes.json()
            const existing = Array.isArray(existingData) ? existingData[0] : existingData
            if (existing?.id) {
              const merged = { ...guide, id: existing.id }
              setCurrentGuide(merged)
              onGuideCreated?.(merged)
              setCurrentStep('content')
              return
            }
          }
        }
        console.error('POST returned', res.status)
      }
    } catch (err) {
      console.error('Failed to save guide:', err)
    }

    // Fallback — use the client guide as-is (will fail on PUTs if ID is not a real UUID)
    console.warn('Using client-generated guide ID — DB saves will fail if this is not a valid UUID')
    setCurrentGuide(guide)
    onGuideCreated?.(guide)
    setCurrentStep('content')
  }

  const handleProductSave = async (guide: UltimateGuide) => {
    setCurrentGuide(guide)
    setCompletedSteps(prev => new Set(prev).add('products'))

    // Persist products + completion flag to DB
    try {
      await fetch('/api/ultimate-guides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guide.id,
          selected_products: guide.selected_products,
          products_complete: true,
        }),
      })
    } catch (err) {
      console.error('Failed to save products:', err)
    }

    onGuideUpdated?.(guide)
    setCurrentStep('content')
  }

  const handleContentSave = async (guide: UltimateGuide) => {
    setCurrentGuide(guide)
    setCompletedSteps(prev => new Set(prev).add('content'))

    // Persist content fields to DB
    try {
      await fetch('/api/ultimate-guides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guide.id,
          html_content: guide.html_content,
          section_content: guide.section_content,
          meta_description: guide.meta_description,
          content_complete: true,
        }),
      })
    } catch (err) {
      console.error('Failed to save content:', err)
    }

    onGuideUpdated?.(guide)
    setCurrentStep('images')
  }

  const handleImagesSave = async (guide: UltimateGuide) => {
    setCurrentGuide(guide)
    setCompletedSteps(prev => new Set(prev).add('images'))

    // Persist image data + assembled HTML to DB
    try {
      await fetch('/api/ultimate-guides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guide.id,
          html_content: guide.html_content,
          has_images: guide.has_images,
          image_count: guide.image_count,
          images_complete: true,
        }),
      })
    } catch (err) {
      console.error('Failed to save images:', err)
    }

    onGuideUpdated?.(guide)
    setCurrentStep('review')
  }

  const handleReviewContinue = () => {
    setCompletedSteps(prev => new Set(prev).add('review'))
    setCurrentStep('publish')
  }

  const handlePublished = (guide: UltimateGuide) => {
    setCurrentGuide(guide)
    setCompletedSteps(prev => new Set(prev).add('publish'))
    setInternalGuides(prev => {
      const exists = prev.find(g => g.id === guide.id)
      return exists ? prev.map(g => g.id === guide.id ? guide : g) : [...prev, guide]
    })
    onGuidePublished?.(guide)
    onGuideUpdated?.(guide)
  }

  const handleNewGuide = () => {
    setCurrentGuide(null)
    setCompletedSteps(new Set())
    setCurrentStep('config')
  }

  // ── Library View ──
  if (activeStep === 'library') {
    return (
      <GuideLibrary
        guides={guides}
        onDeleteGuide={onGuideDeleted}
        onSelectGuide={guide => {
          setCurrentGuide(guide)
          onGuideSelected?.(guide)
          setCompletedSteps(new Set(['config']))
          setCurrentStep('content')
        }}
        onNewGuide={() => {
          handleNewGuide()
          onStepChange?.('config')
        }}
      />
    )
  }

  // ── Config step (no guide required) ──
  if (currentStep === 'config') {
    return (
      <div className="flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
        <WizardStepBar
          steps={steps}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={step => {
            if (completedSteps.has(step) || step === currentStep) {
              setCurrentStep(step)
            }
          }}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <ConfigForm onSave={handleConfigSave} initialGuide={currentGuide} />
        </div>
      </div>
    )
  }

  // ── Steps that require a guide ──
  if (!currentGuide) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-2 text-yellow-500" />
          <p className="text-gray-600 mb-4">No guide selected. Start by creating one.</p>
          <Button onClick={handleNewGuide} className="gap-2">
            Create New Guide <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      <WizardStepBar
        steps={steps}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={step => {
          if (completedSteps.has(step) || step === currentStep) {
            setCurrentStep(step)
          }
        }}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        {/* Products step is now handled automatically during content generation.
            If an old guide tries to navigate here, redirect to content. */}
        {currentStep === 'products' && (
          <GuideContentGenerator
            guide={currentGuide}
            onSave={handleContentSave}
            onBack={() => setCurrentStep('config')}
          />
        )}

        {currentStep === 'content' && (
          <GuideContentGenerator
            guide={currentGuide}
            onSave={handleContentSave}
            onBack={() => setCurrentStep('config')}
          />
        )}

        {currentStep === 'images' && (
          <GuideImageStoryboard
            guide={currentGuide}
            onSave={handleImagesSave}
            onBack={() => setCurrentStep('content')}
          />
        )}

        {currentStep === 'review' && (
            <GuideReview
              guide={currentGuide}
              onBack={() => setCurrentStep('images')}
              onPublish={handleReviewContinue}
            />
          )}
          {currentStep === 'publish' && (
          <GuidePublishConfirm
            guide={currentGuide}
            onBack={() => setCurrentStep('review')}
            onNewGuide={handleNewGuide}
            onViewLibrary={() => {
              onStepChange?.('library')
            }}
            onGuideUpdated={handlePublished}
          />
        )}
      </div>
    </div>
  )
}
