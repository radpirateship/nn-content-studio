'use client'

import { useState, useCallback } from 'react'
import { GripVertical, X, Plus, ArrowLeft, RotateCcw, Check } from 'lucide-react'
import type { ArticleInput } from '@/lib/types'

// Outline data structures
export interface OutlineSection {
  id: string
  heading: string
  headingLevel: 'H2'
  notes: string
  subheadings: { id: string; text: string }[]
  type?: 'product' | 'faq' | 'default'
  products?: string[]
}

export interface OutlineData {
  h1: string
  sections: OutlineSection[]
  suggestedKeywords?: string[]
}

interface Props {
  outline: OutlineData
  articleInput: ArticleInput
  onApprove: (outline: OutlineData) => void
  onRegenerate: () => void
  onBack: () => void
  isRegenerating?: boolean
}

let idCounter = 0
function genId() { return `os-${Date.now()}-${++idCounter}` }

/** Convert the API outline JSON into our editable OutlineData format */
export function parseApiOutline(raw: Record<string, unknown>, title: string): OutlineData {
  const sections: OutlineSection[] = []
  const rawSections = (raw.sections || []) as Array<{
    heading: string
    keyPoints?: string[]
    subheadings?: string[]
  }>

  for (const s of rawSections) {
    const heading = s.heading || 'Untitled Section'
    const isProduct = heading.toLowerCase().includes('top ') || heading.toLowerCase().includes('best ') || heading.toLowerCase().includes('our pick')
    const isFaq = heading.toLowerCase().includes('faq') || heading.toLowerCase().includes('frequently')

    const notes = (s.keyPoints || []).join(', ')
    const subheadings = (s.subheadings || []).map(sh => ({ id: genId(), text: sh }))

    sections.push({
      id: genId(),
      heading,
      headingLevel: 'H2',
      notes: notes ? `~${Math.round(notes.length * 2)} words - ${notes}` : '',
      subheadings,
      type: isFaq ? 'faq' : isProduct ? 'product' : 'default',
    })
  }

  // Add FAQ section if API included faq array but no FAQ section
  const rawFaq = (raw.faq || []) as Array<{ question: string }>
  if (rawFaq.length > 0 && !sections.some(s => s.type === 'faq')) {
    sections.push({
      id: genId(),
      heading: 'Frequently Asked Questions',
      headingLevel: 'H2',
      notes: `${rawFaq.length} auto-generated PAA questions with Schema markup`,
      subheadings: rawFaq.map(q => ({ id: genId(), text: q.question })),
      type: 'faq',
    })
  }

  return {
    h1: title,
    sections,
    suggestedKeywords: (raw.suggestedKeywords || []) as string[],
  }
}

// --- STYLES ---
const fieldLabel = 'text-[9px] font-mono font-medium uppercase tracking-[1.2px]'

export function OutlineReviewView({ outline, articleInput, onApprove, onRegenerate, onBack, isRegenerating }: Props) {
  const [data, setData] = useState<OutlineData>(outline)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // --- Section operations ---
  const updateH1 = (text: string) => setData(d => ({ ...d, h1: text }))

  const updateHeading = (sectionId: string, text: string) => {
    setData(d => ({
      ...d,
      sections: d.sections.map(s => s.id === sectionId ? { ...s, heading: text } : s),
    }))
  }

  const updateSubheading = (sectionId: string, subId: string, text: string) => {
    setData(d => ({
      ...d,
      sections: d.sections.map(s =>
        s.id === sectionId
          ? { ...s, subheadings: s.subheadings.map(sh => sh.id === subId ? { ...sh, text } : sh) }
          : s
      ),
    }))
  }

  const removeSection = (sectionId: string) => {
    setData(d => ({ ...d, sections: d.sections.filter(s => s.id !== sectionId) }))
  }

  const addSection = () => {
    setData(d => ({
      ...d,
      sections: [...d.sections, {
        id: genId(),
        heading: 'New Section',
        headingLevel: 'H2',
        notes: '',
        subheadings: [],
        type: 'default',
      }],
    }))
  }

  const addSubheading = (sectionId: string) => {
    setData(d => ({
      ...d,
      sections: d.sections.map(s =>
        s.id === sectionId
          ? { ...s, subheadings: [...s.subheadings, { id: genId(), text: 'New Subheading' }] }
          : s
      ),
    }))
  }

  const removeSubheading = (sectionId: string, subId: string) => {
    setData(d => ({
      ...d,
      sections: d.sections.map(s =>
        s.id === sectionId
          ? { ...s, subheadings: s.subheadings.filter(sh => sh.id !== subId) }
          : s
      ),
    }))
  }

  // --- Drag and drop ---
  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }, [])

  const handleDrop = useCallback((idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return }
    setData(d => {
      const sections = [...d.sections]
      const [moved] = sections.splice(dragIdx, 1)
      sections.splice(idx, 0, moved)
      return { ...d, sections }
    })
    setDragIdx(null)
    setDragOverIdx(null)
  }, [dragIdx])

  // --- Stats ---
  const sectionCount = data.sections.length
  const subCount = data.sections.reduce((sum, s) => sum + s.subheadings.length, 0)
  const estWords = data.sections.length * 300

  // --- Wireframe article config labels ---
  const ARTICLE_TYPE_LABELS: Record<string, string> = {
    'buyers-guide': "Buyer's Guide", 'comparison': 'Comparison', 'how-to': 'How-To Guide',
    'listicle': 'Listicle', 'benefit-deep-dive': 'Benefit Deep-Dive', 'brand-review': 'Brand Review',
    'ultimate-guide': 'Ultimate Guide', 'custom': 'Custom',
  }
  const AUDIENCE_LABELS: Record<string, string> = {
    'general': 'General Consumer', 'enthusiast': 'Wellness Enthusiast', 'athlete': 'Athlete / Performance',
    'first-time': 'First-Time Buyer', 'professional': 'Health Professional',
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Two-panel layout: outline editor + config sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Outline editor */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Topbar */}
          <div className="flex items-center justify-between border-b px-6 py-3" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            <div>
              <div className="font-serif text-[17px] font-semibold" style={{ color: 'var(--text1)' }}>Outline Review</div>
              <div className="text-[12px] mt-0.5" style={{ color: 'var(--text3)' }}>{articleInput.title}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ background: 'rgba(200, 150, 50, 0.12)', color: '#b8860b' }}>
                Pending Approval
              </span>
              <span className="text-[11px] font-mono" style={{ color: 'var(--text3)' }}>
                {ARTICLE_TYPE_LABELS[articleInput.articleType || ''] || 'Article'}
              </span>
              <span className="text-[11px] font-mono" style={{ color: 'var(--text3)' }}>
                {articleInput.wordCount?.toLocaleString() || '2,500'} words
              </span>
            </div>
          </div>

          {/* Scrollable outline content */}
          <div className="flex-1 overflow-y-auto px-6 py-5" style={{ background: 'var(--bg-warm)' }}>
            {/* Instruction hint */}
            <div
              className="flex items-start gap-2.5 rounded-lg border px-4 py-3 mb-5 text-[12px] leading-relaxed"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text2)' }}
            >
              <span className="flex-shrink-0 mt-px">*</span>
              Drag to reorder sections, edit headings inline, or add/remove sections. Approve when ready to generate the full article.
            </div>

            {/* H1 */}
            <div
              className="flex items-center gap-2.5 rounded-lg border px-4 py-3.5 mb-3"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
            >
              <span className="rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wide flex-shrink-0" style={{ background: 'var(--nn-accent-light)', color: 'var(--nn-accent)' }}>H1</span>
              <input
                className="flex-1 bg-transparent text-[14px] font-medium outline-none border-b border-dashed border-transparent focus:border-[var(--nn-accent)]"
                style={{ color: 'var(--text1)' }}
                value={data.h1}
                onChange={(e) => updateH1(e.target.value)}
              />
            </div>

            {/* Sections */}
            <div className="flex flex-col gap-1.5">
              {data.sections.map((section, idx) => (
                <div
                  key={section.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                  className="group relative flex items-start gap-2 rounded-lg border px-3.5 py-3 transition-all"
                  style={{
                    background: 'var(--bg)',
                    borderColor: dragOverIdx === idx ? 'var(--nn-accent)' : 'var(--border)',
                    borderLeft: section.type === 'product' ? '3px solid var(--nn-accent)' : section.type === 'faq' ? '3px solid #b8860b' : undefined,
                    opacity: dragIdx === idx ? 0.5 : 1,
                    boxShadow: dragOverIdx === idx ? '0 2px 8px rgba(0,0,0,0.08)' : undefined,
                  }}
                >
                  {/* Drag handle */}
                  <div className="cursor-grab pt-0.5 text-[14px]" style={{ color: 'var(--text4)' }}>
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Section body */}
                  <div className="flex flex-1 flex-col gap-1.5">
                    {/* H2 heading */}
                    <div className="flex items-center gap-2">
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wide flex-shrink-0" style={{ background: 'var(--nn-accent-light)', color: 'var(--nn-accent)' }}>H2</span>
                      <input
                        className="flex-1 bg-transparent text-[14px] font-medium outline-none border-b border-dashed border-transparent focus:border-[var(--nn-accent)]"
                        style={{ color: 'var(--text1)' }}
                        value={section.heading}
                        onChange={(e) => updateHeading(section.id, e.target.value)}
                      />
                    </div>

                    {/* Notes */}
                    {section.notes && (
                      <div className="text-[11px] leading-relaxed pl-0.5" style={{ color: 'var(--text3)' }}>{section.notes}</div>
                    )}

                    {/* Product list (for product sections) */}
                    {section.type === 'product' && section.products && section.products.length > 0 && (
                      <div className="flex flex-col gap-0.5 mt-1">
                        {section.products.map((p, i) => (
                          <div key={i} className="rounded px-2 py-1 text-[11px] font-mono" style={{ background: 'var(--surface)', color: 'var(--text2)' }}>
                            {p}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Subheadings */}
                    {section.subheadings.length > 0 && (
                      <div className="flex flex-col gap-1 mt-1">
                        {section.subheadings.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-2 ml-6">
                            <span className="rounded px-1 py-0.5 text-[8px] font-mono font-medium flex-shrink-0" style={{ background: 'var(--surface)', color: 'var(--text3)' }}>H3</span>
                            <input
                              className="flex-1 bg-transparent text-[13px] outline-none border-b border-dashed border-transparent focus:border-[var(--nn-accent)]"
                              style={{ color: 'var(--text2)' }}
                              value={sub.text}
                              onChange={(e) => updateSubheading(section.id, sub.id, e.target.value)}
                            />
                            <button
                              onClick={() => removeSubheading(section.id, sub.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50"
                              style={{ color: 'var(--text4)' }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add sub-heading */}
                    <button
                      onClick={() => addSubheading(section.id)}
                      className="self-start ml-6 mt-0.5 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--nn-accent)' }}
                    >
                      + Add H3
                    </button>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeSection(section.id)}
                    className="absolute top-2 right-2 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text4)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(200,50,50,0.08)'; e.currentTarget.style.color = '#c43' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text4)' }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {/* Add section button */}
              <button
                onClick={addSection}
                className="rounded-lg border border-dashed py-2.5 text-center text-[12px] font-medium transition-all mt-1"
                style={{ borderColor: 'var(--border)', color: 'var(--text3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--nn-accent)'; e.currentTarget.style.color = 'var(--nn-accent)'; e.currentTarget.style.background = 'var(--nn-accent-light)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
              >
                <Plus className="inline-block h-3.5 w-3.5 mr-1 -mt-px" />
                Add Section
              </button>
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-between border-t px-6 py-3.5" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium border"
              style={{ background: 'var(--bg)', color: 'var(--text2)', borderColor: 'var(--border)' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Settings
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium border"
                style={{ background: 'var(--bg)', color: 'var(--text2)', borderColor: 'var(--border)', opacity: isRegenerating ? 0.5 : 1 }}
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                {isRegenerating ? 'Regenerating...' : 'Regenerate Outline'}
              </button>
              <button
                onClick={() => onApprove(data)}
                disabled={isRegenerating}
                className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-[13px] font-semibold text-white"
                style={{ background: 'var(--nn-accent)', opacity: isRegenerating ? 0.5 : 1 }}
              >
                <Check className="h-4 w-4" />
                Approve & Generate Article
              </button>
            </div>
          </div>
        </div>

        {/* Right: Config sidebar */}
        <div className="w-[240px] flex-shrink-0 overflow-y-auto border-l px-4 py-5" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className={`${fieldLabel} mb-2.5`} style={{ color: 'var(--text4)' }}>Article Config</div>
          <div className="flex flex-col gap-1.5">
            <ConfigRow label="Type" value={ARTICLE_TYPE_LABELS[articleInput.articleType || ''] || 'Article'} />
            <ConfigRow label="Collection" value={articleInput.collection || 'General'} />
            <ConfigRow label="Keyword" value={articleInput.keyword} />
            <ConfigRow label="Target" value={`${(articleInput.wordCount || 2500).toLocaleString()} words`} />
            <ConfigRow label="Tone" value={articleInput.tone || 'Educational'} />
            <ConfigRow label="Audience" value={AUDIENCE_LABELS[articleInput.audience || 'general'] || 'General'} />
          </div>

          <div className={`${fieldLabel} mt-4 mb-2.5`} style={{ color: 'var(--text4)' }}>Modules</div>
          <div className="flex flex-col gap-1.5">
            <ModuleChip label="Products" enabled={articleInput.includeProducts !== false} />
            <ModuleChip label="FAQ" enabled={articleInput.includeFAQ !== false} />
            <ModuleChip label="Comparison" enabled={articleInput.includeComparisonTable || false} />
            <ModuleChip label="Links" enabled={articleInput.includeInternalLinks !== false} />
            <ModuleChip label="Images" enabled={articleInput.includeAIImages !== false} />
          </div>

          <div className={`${fieldLabel} mt-4 mb-2.5`} style={{ color: 'var(--text4)' }}>Outline Stats</div>
          <div className="flex flex-col gap-1.5">
            <ConfigRow label="Sections" value={String(sectionCount)} />
            <ConfigRow label="H3 depth" value={`${subCount} sub-headings`} />
            <ConfigRow label="Est. words" value={`~${estWords.toLocaleString()}`} />
          </div>

          {data.suggestedKeywords && data.suggestedKeywords.length > 0 && (
            <>
              <div className={`${fieldLabel} mt-4 mb-2.5`} style={{ color: 'var(--text4)' }}>Suggested Keywords</div>
              <div className="flex flex-wrap gap-1">
                {data.suggestedKeywords.map((kw, i) => (
                  <span key={i} className="rounded px-2 py-0.5 text-[10px] font-mono" style={{ background: 'var(--surface)', color: 'var(--text3)' }}>{kw}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span style={{ color: 'var(--text3)' }}>{label}</span>
      <span className="font-medium" style={{ color: 'var(--text1)' }}>{value}</span>
    </div>
  )
}

function ModuleChip({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-mono ${!enabled ? 'line-through' : ''}`}
      style={{
        background: enabled ? 'var(--nn-accent-light)' : 'var(--surface)',
        color: enabled ? 'var(--nn-accent)' : 'var(--text4)',
      }}
    >
      {label}
    </span>
  )
}
