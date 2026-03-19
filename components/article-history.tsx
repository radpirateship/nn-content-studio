'use client'

import { useState, useMemo } from 'react'
import {
  FileText,
  Clock,
  Search,
  Trash2,
  CheckCircle2,
  Undo2,
  Link2,
  ImageIcon,
} from 'lucide-react'
import type { GeneratedArticle, ArticleStatus } from '@/lib/types'
import { CATEGORY_LABELS } from '@/lib/types'

interface ArticleHistoryProps {
  articles: GeneratedArticle[]
  onSelect: (article: GeneratedArticle) => void
  onDelete: (id: string) => void
  onStatusChange?: (id: string, status: ArticleStatus) => void
}

type FilterStatus = 'all' | 'draft' | 'published'

export function ArticleHistory({ articles, onSelect, onDelete, onStatusChange }: ArticleHistoryProps) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  const stats = useMemo(() => ({
    total: articles.length,
    drafts: articles.filter(a => a.status === 'draft' || a.status === 'reviewing' || a.status === 'approved').length,
    published: articles.filter(a => a.status === 'published').length,
  }), [articles])

  const filtered = useMemo(() => {
    let list = articles
    if (filterStatus === 'draft') list = list.filter(a => a.status !== 'published')
    if (filterStatus === 'published') list = list.filter(a => a.status === 'published')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.keyword || '').toLowerCase().includes(q) ||
        (a.category || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [articles, filterStatus, search])

  return (
    <div className="flex h-full flex-col">
      {/* Panel toolbar */}
      <div className="flex items-center gap-3 border-b px-6 py-3.5 flex-shrink-0 flex-wrap" style={{ borderColor: 'var(--surface2)', background: 'var(--bg-warm)' }}>
        <h1 className="font-serif text-[20px] font-bold mr-auto" style={{ color: 'var(--text1)' }}>
          Articles
        </h1>
        <div
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', width: 260 }}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text4)' }} />
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-none bg-transparent text-[13px] outline-none font-sans placeholder:text-[var(--text4)]"
            style={{ color: 'var(--text1)' }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 px-6 pt-5 pb-1 flex-shrink-0">
        <StatCard label="Total Articles" value={stats.total} />
        <StatCard label="Drafts" value={stats.drafts} color="amber" />
        <StatCard label="Published" value={stats.published} color="green" />
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 px-6 py-3 border-b flex-shrink-0 flex-wrap" style={{ borderColor: 'var(--surface2)' }}>
        <span className="text-[11px] font-bold uppercase tracking-[0.4px] font-mono" style={{ color: 'var(--text4)' }}>
          Status
        </span>
        {(['all', 'draft', 'published'] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className="rounded-md px-2.5 py-1 text-[12px] font-medium transition-all"
            style={{
              background: filterStatus === s ? 'var(--nn-accent-light)' : 'var(--surface)',
              color: filterStatus === s ? 'var(--nn-accent)' : 'var(--text3)',
              fontWeight: filterStatus === s ? 600 : 400,
            }}
          >
            {s === 'all' ? 'All' : s === 'draft' ? 'Drafts' : 'Published'}
          </button>
        ))}
      </div>

      {/* Articles grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-3 h-10 w-10 opacity-20" style={{ color: 'var(--text4)' }} />
            <p className="text-[14px]" style={{ color: 'var(--text3)' }}>
              {articles.length === 0 ? 'No articles generated yet' : 'No articles match your filters'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {filtered.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onSelect={onSelect}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: 'green' | 'amber' | 'blue' }) {
  const numColor = color === 'green' ? 'var(--nn-accent)' : color === 'amber' ? '#d4930a' : color === 'blue' ? '#4a8fe7' : 'var(--text1)'
  return (
    <div
      className="flex-1 rounded-lg border px-4 py-3 text-center"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <div className="text-[22px] font-extrabold" style={{ color: numColor }}>{value}</div>
      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>{label}</div>
    </div>
  )
}

function ArticleCard({
  article,
  onSelect,
  onDelete,
  onStatusChange,
}: {
  article: GeneratedArticle
  onSelect: (a: GeneratedArticle) => void
  onDelete: (id: string) => void
  onStatusChange?: (id: string, status: ArticleStatus) => void
}) {
  const createdAt = article.createdAt ? new Date(article.createdAt) : new Date()
  const categoryLabel = (CATEGORY_LABELS[article.category as keyof typeof CATEGORY_LABELS] ?? article.category ?? 'Unknown')
  const title = article.title || 'Untitled Article'

  const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: 'var(--surface2)', color: 'var(--text3)', label: 'Draft' },
    reviewing: { bg: 'rgba(212,147,10,0.1)', color: '#d4930a', label: 'Reviewing' },
    approved: { bg: 'rgba(74,143,231,0.08)', color: '#4a8fe7', label: 'Approved' },
    published: { bg: 'rgba(26,122,84,0.08)', color: 'var(--nn-accent)', label: 'Published' },
    failed: { bg: 'rgba(204,68,68,0.08)', color: '#c44', label: 'Failed' },
  }
  const st = statusStyles[article.status] || statusStyles.draft

  return (
    <div
      className="flex flex-col gap-2.5 rounded-[10px] border p-4 transition-all cursor-pointer hover:shadow-sm"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      onClick={() => onSelect(article)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(article)}
      role="button"
      tabIndex={0}
    >
      {/* Top row: title + status */}
      <div className="flex items-start gap-2.5">
        <h3 className="flex-1 font-serif text-[15px] font-semibold leading-snug" style={{ color: 'var(--text1)' }}>
          {title}
        </h3>
        <span
          className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.3px]"
          style={{ background: st.bg, color: st.color }}
        >
          {st.label}
        </span>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="rounded px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: 'rgba(26,122,84,0.06)', color: 'var(--nn-accent)' }}
        >
          {categoryLabel}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
          {article.wordCount?.toLocaleString()} words
        </span>
        <span style={{ color: 'var(--border2)' }}>|</span>
        <span className="flex items-center gap-0.5 text-[11px]" style={{ color: 'var(--text3)' }}>
          <Clock className="h-3 w-3" />
          {createdAt.toLocaleDateString()}
        </span>
      </div>

      {/* Tags row: links + images */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {article.hasInternalLinks && (
          <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--nn-accent)' }}>
            <Link2 className="h-3 w-3" /> {article.linkCount || 0} links
          </span>
        )}
        {article.hasImages && (
          <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--nn-accent)' }}>
            <ImageIcon className="h-3 w-3" /> {article.imageCount || 0} images
          </span>
        )}
      </div>

      {/* Bottom: actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        {onStatusChange && article.status !== 'published' && (
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange(article.id, 'published') }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all hover:opacity-80"
            style={{ background: 'rgba(26,122,84,0.08)', color: 'var(--nn-accent)' }}
            title="Mark as published"
          >
            <CheckCircle2 className="h-3 w-3" /> Publish
          </button>
        )}
        {onStatusChange && article.status === 'published' && (
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange(article.id, 'draft') }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all hover:opacity-80"
            style={{ background: 'rgba(212,147,10,0.08)', color: '#d4930a' }}
            title="Move to drafts"
          >
            <Undo2 className="h-3 w-3" /> Unpublish
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(article.id) }}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all hover:opacity-80"
          style={{ color: 'var(--text4)' }}
          title="Delete article"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
