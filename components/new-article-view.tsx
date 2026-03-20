'use client'

import { useState } from 'react'
import { Search, Zap, BookOpen } from 'lucide-react'
import type { ArticleInput, ArticleTone } from '@/lib/types'
// ShopifyBlogTag is now just a string type

/* ââ Options matching wireframe exactly ââ */
const ARTICLE_TYPES = [
  { value: 'buyers-guide', label: "Buyer's Guide" },
  { value: 'comparison', label: 'Comparison' },
  { value: 'benefit-deep-dive', label: 'Benefit Deep-Dive' },
  { value: 'brand-review', label: 'Brand Review' },
  { value: 'how-to', label: 'How-To Guide' },
  { value: 'listicle', label: 'Listicle' },
  { value: 'ultimate-guide', label: 'Ultimate Guide' },
  { value: 'custom', label: 'Custom' },
] as const

const TONES = [
  { value: 'educational', label: 'Educational & Authoritative' },
  { value: 'conversational', label: 'Conversational & Friendly' },
  { value: 'scientific', label: 'Technical & Data-Driven' },
  { value: 'authoritative', label: 'Enthusiastic & Persuasive' },
] as const

const AUDIENCES = [
  { value: 'general', label: 'General Consumer' },
  { value: 'enthusiast', label: 'Wellness Enthusiast' },
  { value: 'athlete', label: 'Athlete / Performance' },
  { value: 'professional', label: 'Health Professional' },
  { value: 'first-time', label: 'First-Time Buyer' },
] as const

const WORD_COUNT_OPTIONS = [
  { value: 1250, label: '1,000 - 1,500' },
  { value: 1750, label: '1,500 - 2,000' },
  { value: 2250, label: '2,000 - 2,500' },
  { value: 2750, label: '2,500 - 3,000' },
  { value: 3500, label: '3,000 - 4,000' },
  { value: 4500, label: '4,000+' },
] as const

const COLLECTIONS = [
  'Whey Protein', 'Casein Protein', 'Pea Protein', 'Rice Protein',
  'Creatine', 'Mass Gainer', 'Pre-Workout', 'Post-Workout Recovery',
  'BCAAs & Amino Acids', 'Collagen', 'Greens & Superfoods', 'Fiber & Digestive Health',
  'Vitamins & Minerals', 'Probiotics', 'Energy & Focus',
  'Weight Management', 'Keto & Low-Carb', 'Vegan Nutrition', 'General Nutrition',
] as const

const PRESETS = [
  { value: '', label: 'Load Preset...' },
  { value: 'buyers-guide', label: "Buyer's Guide -- 2,500w, Products ON" },
  { value: 'comparison', label: 'Comparison -- 2,000w, Products ON' },
  { value: 'benefit', label: 'Benefit Deep-Dive -- 1,800w, Educational' },
  { value: 'brand-review', label: 'Brand Review -- 2,200w, Products ON' },
  { value: 'how-to', label: 'How-To Guide -- 1,500w, Educational' },
  { value: 'listicle', label: 'Listicle -- 2,000w, Products ON' },
] as const

export type RunMode = 'step' | 'auto' | 'bulk'

interface NewArticleViewProps {
  onGenerate: (input: ArticleInput, runMode: RunMode) => void
  isGenerating: boolean
}

export function NewArticleView({ onGenerate, isGenerating }: NewArticleViewProps) {
  const [runMode, setRunMode] = useState<RunMode>('step')
  const [formData, setFormData] = useState({
    title: '',
    keyword: '',
    collection: '',
    category: 'general-nutrition' as string,
    articleType: 'buyers-guide',
    tone: 'educational' as ArticleTone,
    audience: 'general',
    wordCount: 2250,
    shopifySlug: '',
    shopifyBlogTag: 'news',
    titleTag: '',
    metaDescription: '',
    specialInstructions: '',
    includeProducts: true,
    includeFAQ: true,
    includeComparisonTable: false,
    includeInternalLinks: true,
    includeAIImages: false,
    includeSchema: true,
  })

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const applyPreset = (presetValue: string) => {
    if (!presetValue) return
    const presetMap: Record<string, Partial<typeof formData>> = {
      'buyers-guide': { articleType: 'buyers-guide', wordCount: 2750, tone: 'authoritative' as ArticleTone, includeProducts: true },
      'comparison': { articleType: 'comparison', wordCount: 2250, tone: 'authoritative' as ArticleTone, includeProducts: true, includeComparisonTable: true },
      'benefit': { articleType: 'benefit-deep-dive', wordCount: 1750, tone: 'educational' as ArticleTone },
      'brand-review': { articleType: 'brand-review', wordCount: 2250, tone: 'authoritative' as ArticleTone, includeProducts: true },
      'how-to': { articleType: 'how-to', wordCount: 1750, tone: 'educational' as ArticleTone },
      'listicle': { articleType: 'listicle', wordCount: 2250, tone: 'educational' as ArticleTone, includeProducts: true },
    }
    const preset = presetMap[presetValue]
    if (preset) setFormData(prev => ({ ...prev, ...preset }))
  }

  const handleSubmit = () => {
    if (!formData.title || !formData.keyword) return
    // Map collection name to category slug for ArticleInput
    const collectionToCategory: Record<string, string> = {
      'Whey Protein': 'whey-protein', 'Casein Protein': 'casein-protein',
      'Pea Protein': 'pea-protein', 'Rice Protein': 'rice-protein',
      'Creatine': 'creatine', 'Mass Gainer': 'mass-gainer',
      'Pre-Workout': 'pre-workout', 'Post-Workout Recovery': 'post-workout',
      'BCAAs & Amino Acids': 'bcaa', 'Collagen': 'collagen',
      'Greens & Superfoods': 'greens', 'Fiber & Digestive Health': 'fiber',
      'Vitamins & Minerals': 'vitamins', 'Probiotics': 'probiotics',
      'Energy & Focus': 'energy', 'Weight Management': 'weight-management',
      'Keto & Low-Carb': 'keto', 'Vegan Nutrition': 'vegan',
      'General Nutrition': 'general-nutrition',
    }
    const category = collectionToCategory[formData.collection] || 'general-nutrition'
    onGenerate({
      title: formData.title,
      keyword: formData.keyword,
      category: category as ArticleInput['category'],
      tone: formData.tone,
      wordCount: formData.wordCount,
      includeProducts: formData.includeProducts,
      includeFAQ: formData.includeFAQ,
      includeSchema: formData.includeSchema,
      shopifySlug: formData.shopifySlug,
      shopifyBlogTag: formData.shopifyBlogTag,
      articleType: formData.articleType,
      audience: formData.audience,
      collection: formData.collection,
      specialInstructions: formData.specialInstructions,
      includeComparisonTable: formData.includeComparisonTable,
      includeInternalLinks: formData.includeInternalLinks,
      includeAIImages: formData.includeAIImages,
      titleTag: formData.titleTag,
      metaDescription: formData.metaDescription,
    }, runMode)
  }

  /* ââ Shared style tokens ââ */
  const sectionLabel = "text-[9px] font-mono font-medium tracking-[1.5px] uppercase pb-1"
  const fieldLabel = "text-[10px] font-mono font-medium tracking-[0.6px] uppercase"
  const inputBase = "w-full rounded-md border px-3 py-[9px] text-[13px] font-sans outline-none transition-all"
  const inputStyle = { background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }
  const focusStyle = "focus:border-[var(--nn-accent)] focus:shadow-[0_0_0_3px_rgba(26,122,84,0.07)]"

  const runModes: { id: RunMode; icon: React.ReactNode; name: string; desc: string }[] = [
    { id: 'step', icon: <Search className="h-4 w-4" />, name: 'Step-by-Step', desc: 'Review and approve each step before proceeding' },
    { id: 'auto', icon: <Zap className="h-4 w-4" />, name: 'Auto-Run', desc: 'Runs all steps automatically. Review the final result before publishing.' },
    { id: 'bulk', icon: <BookOpen className="h-4 w-4" />, name: 'Bulk Queue', desc: 'Queue 10-20 articles for sequential auto-processing' },
  ]

  const contentModules = [
    { key: 'includeProducts', label: 'Product Recommendations', desc: 'Include curated products from selected collection', icon: '\u{1F4E6}' },
    { key: 'includeFAQ', label: 'FAQ Section', desc: 'Auto-generate People Also Ask questions', icon: '\u2753' },
    { key: 'includeComparisonTable', label: 'Comparison Table', desc: 'Side-by-side product/feature comparison', icon: '\u{1F4CA}' },
    { key: 'includeInternalLinks', label: 'Internal Links', desc: 'Auto-insert links to related articles & collections', icon: '\u{1F517}' },
    { key: 'includeAIImages', label: 'AI Images', desc: 'Generate Recraft V3 images for each section', icon: '\u{1F5BC}' },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[680px] px-6 pt-8 pb-32">

          {/* ââ Header ââ */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
            <div>
              <h1 className="font-serif text-[22px] font-semibold" style={{ color: 'var(--text1)' }}>
                New Article
              </h1>
              <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text3)' }}>
                Configure and generate an SEO-optimized article
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="w-[280px] rounded-md border px-3 py-2 text-[12px] font-sans"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text1)' }}
                onChange={(e) => applyPreset(e.target.value)}
                defaultValue=""
              >
                {PRESETS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <button className="rounded-md px-2.5 py-2 text-[11px] font-medium" style={{ color: 'var(--text2)' }}>
                + Save Preset
              </button>
            </div>
          </div>

          {/* ââ Form ââ */}
          <div className="flex flex-col gap-6">

            {/* Run Mode */}
            <div className="flex flex-col gap-2.5">
              <div className={sectionLabel} style={{ color: 'var(--nn-accent)', borderBottom: '1px solid var(--surface2)' }}>
                Run Mode
              </div>
              <div className="grid grid-cols-3 gap-3">
                {runModes.map(mode => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setRunMode(mode.id)}
                    className="flex flex-col rounded-lg border p-3.5 text-left transition-all"
                    style={{
                      background: runMode === mode.id ? 'rgba(26,122,84,0.03)' : 'var(--bg)',
                      borderColor: runMode === mode.id ? 'rgba(26,122,84,0.3)' : 'var(--border)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className="flex h-[14px] w-[14px] items-center justify-center rounded-full border-[1.5px]"
                        style={{
                          borderColor: runMode === mode.id ? 'var(--nn-accent)' : 'var(--border2)',
                        }}
                      >
                        {runMode === mode.id && (
                          <div className="h-[7px] w-[7px] rounded-full" style={{ background: 'var(--nn-accent)' }} />
                        )}
                      </div>
                      <span className="text-[13px] font-medium" style={{ color: runMode === mode.id ? 'var(--nn-accent)' : 'var(--text1)' }}>
                        {mode.name}
                      </span>
                      <span className="ml-auto opacity-70">{mode.icon}</span>
                    </div>
                    <span className="text-[11px] leading-relaxed" style={{ color: 'var(--text3)' }}>{mode.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Topic */}
            <div className="flex flex-col gap-2.5">
              <div className={sectionLabel} style={{ color: 'var(--nn-accent)', borderBottom: '1px solid var(--surface2)' }}>
                Topic
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={fieldLabel} style={{ color: 'var(--text3)' }}>Article Topic / Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g. Best Whey Protein Powders for Muscle Growth in 2026"
                  className={`${inputBase} ${focusStyle}`}
                  style={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={fieldLabel} style={{ color: 'var(--text3)' }}>Target Collection</label>
                  <select
                    value={formData.collection}
                    onChange={(e) => handleChange('collection', e.target.value)}
                    className={`${inputBase} ${focusStyle}`}
                    style={inputStyle}
                  >
                    <option value="">Select collection...</option>
                    {COLLECTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={fieldLabel} style={{ color: 'var(--text3)' }}>Target Keyword</label>
                  <input
                    type="text"
                    value={formData.keyword}
                    onChange={(e) => handleChange('keyword', e.target.value)}
                    placeholder="e.g. best whey protein powder"
                    className={`${inputBase} ${focusStyle}`}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={fieldLabel} style={{ color: 'var(--text3)' }}>URL Slug</label>
                <div className="flex items-center gap-0">
                  <span
                    className="rounded-l-md border border-r-0 px-2.5 py-[7px] text-[12px] font-mono"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text4)' }}
                  >
                    /blogs/.../
                  </span>
                  <input
                    type="text"
                    value={formData.shopifySlug}
                    onChange={(e) => handleChange('shopifySlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))}
                    placeholder="best-whey-protein-for-muscle-growth"
                    className={`${inputBase} ${focusStyle} rounded-l-none`}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* SEO */}
            <div className="flex flex-col gap-2.5">
              <div className={sectionLabel} style={{ color: 'var(--nn-accent)', borderBottom: '1px solid var(--surface2)' }}>
                SEO Meta Tags
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className={fieldLabel} style={{ color: 'var(--text3)' }}>Title Tag</label>
                  <span className="text-[10px] font-mono" style={{ color: formData.titleTag.length > 60 ? '#c53030' : 'var(--text4)' }}>
                    {formData.titleTag.length}/60
                  </span>
                </div>
                <input
                  type="text"
                  value={formData.titleTag}
                  onChange={(e) => handleChange('titleTag', e.target.value)}
                  placeholder="e.g. Best Whey Protein Powders for Muscle Growth (2026) | Naked Nutrition"
                  className={`${inputBase} ${focusStyle}`}
                  style={inputStyle}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className={fieldLabel} style={{ color: 'var(--text3)' }}>Meta Description</label>
                  <span className="text-[10px] font-mono" style={{ color: formData.metaDescription.length > 160 ? '#c53030' : 'var(--text4)' }}>
                    {formData.metaDescription.length}/160
                  </span>
                </div>
                <textarea
                  value={formData.metaDescription}
                  onChange={(e) => handleChange('metaDescription', e.target.value)}
                  placeholder="e.g. Compare the best whey protein powders for building muscle. See ingredients, nutrition facts, and expert picks from Naked Nutrition."
                  rows={2}
                  className={`${inputBase} ${focusStyle} resize-none`}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Configuration */}
            <div className="flex flex-col gap-2.5">
              <div className={sectionLabel} style={{ color: 'var(--nn-accent)', borderBottom: '1px solid var(--surface2)' }}>
                Configuration
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={fieldLabel} style={{ color: 'var(--text3)' }}>Article Type</label>
                  <select
                    value={formData.articleType}
                    onChange={(e) => handleChange('articleType', e.target.value)}
                    className={`${inputBase} ${focusStyle}`}
                    style={inputStyle}
                  >
                    {ARTICLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={fieldLabel} style={{ color: 'var(--text3)' }}>Word Count Target</label>
                  <select
                    value={formData.wordCount}
                    onChange={(e) => handleChange('wordCount', parseInt(e.target.value))}
                    className={`${inputBase} ${focusStyle}`}
                    style={inputStyle}
                  >
                    {WORD_COUNT_OPTIONS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={fieldLabel} style={{ color: 'var(--text3)' }}>Tone</label>
                  <select
                    value={formData.tone}
                    onChange={(e) => handleChange('tone', e.target.value)}
                    className={`${inputBase} ${focusStyle}`}
                    style={inputStyle}
                  >
                    {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={fieldLabel} style={{ color: 'var(--text3)' }}>Audience</label>
                  <select
                    value={formData.audience}
                    onChange={(e) => handleChange('audience', e.target.value)}
                    className={`${inputBase} ${focusStyle}`}
                    style={inputStyle}
                  >
                    {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Content Modules */}
            <div className="flex flex-col gap-2.5">
              <div className={sectionLabel} style={{ color: 'var(--nn-accent)', borderBottom: '1px solid var(--surface2)' }}>
                Content Modules
              </div>

              <div className="flex flex-col gap-1.5">
                {contentModules.map((toggle) => {
                  const isOn = formData[toggle.key as keyof typeof formData] as boolean
                  return (
                    <button
                      key={toggle.key}
                      type="button"
                      onClick={() => handleChange(toggle.key, !isOn)}
                      className="flex items-center justify-between rounded-md border px-3 py-[9px] transition-all"
                      style={{
                        background: isOn ? 'rgba(26,122,84,0.03)' : 'var(--bg)',
                        borderColor: isOn ? 'rgba(26,122,84,0.25)' : 'var(--border)',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-[14px]">{toggle.icon}</span>
                        <div className="text-left">
                          <div className="text-[12px] font-medium" style={{ color: 'var(--text1)' }}>{toggle.label}</div>
                          <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{toggle.desc}</div>
                        </div>
                      </div>
                      <div
                        className="relative h-5 w-9 shrink-0 rounded-full transition-all"
                        style={{ background: isOn ? 'var(--nn-accent)' : 'var(--surface3)' }}
                      >
                        <div
                          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                          style={{ left: '2px', transform: isOn ? 'translateX(16px)' : 'translateX(0)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Additional Context */}
            <div className="flex flex-col gap-2.5">
              <div className={sectionLabel} style={{ color: 'var(--nn-accent)', borderBottom: '1px solid var(--surface2)' }}>
                Additional Context <span style={{ color: 'var(--text4)', fontSize: '10px', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={fieldLabel} style={{ color: 'var(--text3)' }}>Special Instructions</label>
                <textarea
                  value={formData.specialInstructions}
                  onChange={(e) => handleChange('specialInstructions', e.target.value)}
                  rows={3}
                  placeholder="e.g. Focus on grass-fed options under $50. Mention leucine content per serving. Include a section on timing around workouts."
                  className={`${inputBase} ${focusStyle} resize-y`}
                  style={{ ...inputStyle, minHeight: '68px' }}
                />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ââ Fixed bottom action bar ââ */}
      <div
        className="flex items-center justify-between px-6 py-3.5"
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}
      >
        <span className="text-[11px] font-mono" style={{ color: 'var(--text3)' }}>
          Est. ~45s outline &middot; ~3 min full article
        </span>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border px-4 py-2 text-[13px] font-medium"
            style={{ background: 'var(--bg)', color: 'var(--text1)', borderColor: 'var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isGenerating || !formData.title || !formData.keyword}
            className="rounded-md px-5 py-2.5 text-[14px] font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: isGenerating ? 'var(--text3)' : 'var(--nn-accent)' }}
          >
            {isGenerating ? 'Generating...' : runMode === 'auto' ? 'Start Auto-Run' : runMode === 'bulk' ? 'Add to Queue' : 'Generate Outline \u2192'}
          </button>
        </div>
      </div>
    </div>
  )
}
