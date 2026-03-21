'use client'

import { X, FileText, Link2, ImageIcon, BarChart3, Send, Check, Loader2, AlertCircle } from 'lucide-react'
import type { ViewId } from './app-sidebar'

type ArticlePipelineStep = 'article-content' | 'article-links' | 'article-images' | 'article-seo' | 'publish-confirm'

const PIPELINE_STEPS: { id: ArticlePipelineStep; label: string; icon: React.ReactNode }[] = [
  { id: 'article-content', label: 'Content', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'article-links', label: 'Links', icon: <Link2 className="h-3.5 w-3.5" /> },
  { id: 'article-images', label: 'Images', icon: <ImageIcon className="h-3.5 w-3.5" /> },
  { id: 'article-seo', label: 'SEO', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: 'publish-confirm', label: 'Publish', icon: <Send className="h-3.5 w-3.5" /> },
]

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

interface ArticleContextBarProps {
  title: string
  status: string
  wordCount?: number
  category?: string
  activeView: ViewId
  hasLinks: boolean
  hasImages: boolean
  saveStatus?: SaveStatus
  onNavigate: (view: ViewId) => void
  onClose: () => void
}

export function ArticleContextBar({
  title,
  status,
  wordCount,
  category,
  activeView,
  hasLinks,
  hasImages,
  saveStatus,
  onNavigate,
  onClose,
}: ArticleContextBarProps) {
  const isArticleView = activeView.startsWith('article-') || activeView === 'publish-confirm'

  // Determine step completion
  const getStepState = (stepId: ArticlePipelineStep): 'done' | 'active' | 'upcoming' => {
    if (stepId === activeView) return 'active'

    const stepIndex = PIPELINE_STEPS.findIndex(s => s.id === stepId)
    const activeIndex = PIPELINE_STEPS.findIndex(s => s.id === activeView)

    // Mark steps as done based on actual completion or being before active step
    if (stepId === 'article-content') return 'done' // always done if we have an article
    if (stepId === 'article-links' && hasLinks) return 'done'
    if (stepId === 'article-images' && hasImages) return 'done'

    if (activeIndex >= 0 && stepIndex < activeIndex) return 'done'
    return 'upcoming'
  }

  return (
    <div
      className="flex items-center gap-4 border-b px-5 py-2"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)', minHeight: 44 }}
    >
      {/* Article info */}
      <div className="flex items-center gap-2.5 min-w-0 shrink">
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-md p-1 hover:bg-[var(--surface)]"
          style={{ color: 'var(--text3)' }}
          aria-label="Close article and return to library"
          title="Close article &amp; return to library"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold leading-tight" style={{ color: 'var(--text1)' }}>
            {title}
          </h3>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text4)' }}>
            <span
              className="rounded-sm px-1.5 py-px text-[10px] font-mono font-medium uppercase"
              style={{
                background: status === 'published' ? 'var(--nn-accent-light)' : 'var(--surface2)',
                color: status === 'published' ? 'var(--nn-accent)' : 'var(--text3)',
              }}
            >
              {status}
            </span>
            {wordCount && <span>{wordCount.toLocaleString()} words</span>}
            {category && (
              <>
                <span style={{ color: 'var(--border)' }}>&middot;</span>
                <span>{category}</span>
              </>
            )}
            {saveStatus && (
              <>
                <span style={{ color: 'var(--border)' }}>&middot;</span>
                <span
                  className="inline-flex items-center gap-1"
                  style={{
                    color: saveStatus === 'error' ? '#c44' : saveStatus === 'saving' ? 'var(--text4)' : saveStatus === 'unsaved' ? '#d4930a' : 'var(--nn-accent)',
                  }}
                >
                  {saveStatus === 'saved' && <><Check className="h-2.5 w-2.5" /> Saved</>}
                  {saveStatus === 'saving' && <><Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving...</>}
                  {saveStatus === 'unsaved' && <><AlertCircle className="h-2.5 w-2.5" /> Unsaved</>}
                  {saveStatus === 'error' && <><AlertCircle className="h-2.5 w-2.5" /> Save failed</>}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline steps — only show on article-* views */}
      {isArticleView && (
        <div className="flex items-center gap-0.5 ml-auto">
          {PIPELINE_STEPS.map((step, i) => {
            const state = getStepState(step.id)
            return (
              <div key={step.id} className="flex items-center">
                {i > 0 && (
                  <div
                    className="w-5 h-px mx-0.5"
                    style={{
                      background: state === 'upcoming' ? 'var(--border)' : 'var(--nn-accent)',
                      opacity: state === 'upcoming' ? 1 : 0.4,
                    }}
                  />
                )}
                <button
                  onClick={() => onNavigate(step.id)}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                  style={{
                    background: state === 'active' ? 'var(--nn-accent-light)' : 'transparent',
                    color: state === 'active' ? 'var(--nn-accent)' : state === 'done' ? 'var(--nn-accent)' : 'var(--text4)',
                    opacity: state === 'upcoming' ? 0.6 : 1,
                  }}
                  title={step.label}
                >
                  {step.icon}
                  <span className="hidden lg:inline">{step.label}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* When not on an article view, show a "Go to article" link */}
      {!isArticleView && (
        <button
          onClick={() => onNavigate('article-content')}
          className="ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium"
          style={{ color: 'var(--nn-accent)', background: 'var(--nn-accent-light)' }}
        >
          <FileText className="h-3.5 w-3.5" />
          Open article
        </button>
      )}
    </div>
  )
}
