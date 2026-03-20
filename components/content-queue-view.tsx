'use client'

import { useState, useCallback } from 'react'
import { RefreshCw, Plus, GripVertical, FileText } from 'lucide-react'
import useSWR from 'swr'
import type { GeneratedArticle } from '@/lib/types'

type QueueStatus = 'queued' | 'generating' | 'review' | 'approved' | 'published'

interface QueueArticle {
  id: string
  dbId?: number
  title: string
  category: string
  keyword: string
  articleType?: string
  wordCount: number
  status: QueueStatus
  createdAt: Date
  progress?: number
  progressMessage?: string
}

const COLUMNS: { id: QueueStatus; label: string; dotColor: string; borderColor: string }[] = [
  { id: 'queued', label: 'Queued', dotColor: '#94a3b8', borderColor: '#94a3b8' },
  { id: 'generating', label: 'Generating', dotColor: '#5b5fc7', borderColor: '#5b5fc7' },
  { id: 'review', label: 'Needs Review', dotColor: '#d4930a', borderColor: '#d4930a' },
  { id: 'approved', label: 'Approved', dotColor: '#1a7a54', borderColor: '#1a7a54' },
  { id: 'published', label: 'Published', dotColor: '#22c55e', borderColor: '#22c55e' },
]

const CATEGORY_LABELS: Record<string, string> = {
  'protein-powder': 'Protein', 'whey-protein': 'Whey', 'vegan-protein-powder': 'Vegan Protein',
  'collagen-peptides': 'Collagen', 'overnight-oats': 'Oats',
  'improve-performance-recovery': 'Performance', 'supplements': 'Supplements', 'kids': 'Kids',
  'creatine': 'Creatine', 'pre-workout': 'Pre-Workout', 'post-workout': 'Post-Workout',
  'bcaa': 'BCAAs', 'greens': 'Greens', 'vitamins': 'Vitamins', 'probiotics': 'Probiotics',
  'energy': 'Energy', 'weight-management': 'Weight Mgmt', 'keto': 'Keto', 'vegan': 'Vegan',
  'general-nutrition': 'Nutrition',
}

const TYPE_LABELS: Record<string, string> = {
  'buyers-guide': "Buyer's Guide", 'comparison': 'Comparison', 'how-to': 'How-To',
  'listicle': 'Listicle', 'benefit-deep-dive': 'Benefit', 'brand-review': 'Review',
  'ultimate-guide': 'Guide', 'custom': 'Custom',
}

// Map DB status to Kanban status
function mapStatus(status: string): QueueStatus {
  switch (status) {
    case 'draft': return 'review'
    case 'review': return 'review'
    case 'approved': return 'approved'
    case 'published': return 'published'
    default: return 'review'
  }
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface Props {
  articles: GeneratedArticle[]
  onNewArticle: () => void
  onOpenArticle: (article: GeneratedArticle) => void
}

export function ContentQueueView({ articles, onNewArticle, onOpenArticle }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dragItem, setDragItem] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<QueueStatus | null>(null)

  // Also fetch from DB
  const { data: dbArticles, mutate: refreshDb } = useSWR('/api/articles', fetcher, { refreshInterval: 15000 })

  // Merge in-memory articles with DB articles into QueueArticles
  const queueArticles: QueueArticle[] = (() => {
    const seen = new Set<string>()
    const result: QueueArticle[] = []

    // In-memory articles
    for (const a of articles) {
      seen.add(a.id)
      result.push({
        id: a.id,
        dbId: a.dbId,
        title: a.title,
        category: a.category,
        keyword: a.keyword,
        wordCount: a.wordCount,
        status: mapStatus(a.status),
        createdAt: a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt),
      })
    }

    // DB articles (fill in those not already in-memory)
    if (Array.isArray(dbArticles)) {
      for (const a of dbArticles) {
        const id = `article-${a.id}`
        if (!seen.has(id)) {
          result.push({
            id,
            dbId: a.id,
            title: a.title,
            category: a.category,
            keyword: a.keyword,
            wordCount: a.word_count || 0,
            status: mapStatus(a.status || 'draft'),
            createdAt: new Date(a.created_at),
          })
        }
      }
    }

    return result
  })()

  // Filter
  const filtered = categoryFilter === 'all'
    ? queueArticles
    : queueArticles.filter(a => a.category === categoryFilter)

  // Group by status
  const columns = COLUMNS.map(col => ({
    ...col,
    items: filtered.filter(a => a.status === col.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  }))

  // Drag & drop between columns
  const handleDrop = useCallback(async (targetStatus: QueueStatus) => {
    if (!dragItem) return
    const article = queueArticles.find(a => a.id === dragItem)
    if (!article || article.status === targetStatus) { setDragItem(null); setDragOverCol(null); return }

    // Update status in DB if we have a dbId
    if (article.dbId) {
      const dbStatus = targetStatus === 'review' ? 'draft' : targetStatus
      try {
        await fetch(`/api/articles/${article.dbId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: dbStatus }),
        })
        refreshDb()
      } catch (err) {
        console.error('Failed to update status:', err)
      }
    }
    setDragItem(null)
    setDragOverCol(null)
  }, [dragItem, queueArticles, refreshDb])

  // Unique categories for filter
  const categories = [...new Set(queueArticles.map(a => a.category))]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-6 py-3" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <div className="font-serif text-[17px] font-semibold" style={{ color: 'var(--text1)' }}>Content Queue</div>
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border px-2.5 py-1.5 text-[12px]"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
            ))}
          </select>
          <button
            onClick={() => refreshDb()}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
          <button
            onClick={onNewArticle}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold text-white"
            style={{ background: 'var(--nn-accent)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Article
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex flex-1 gap-3 overflow-x-auto p-4" style={{ background: 'var(--bg-warm)' }}>
        {columns.map(col => (
          <div
            key={col.id}
            className="flex w-[220px] flex-shrink-0 flex-col rounded-lg border"
            style={{
              background: dragOverCol === col.id ? 'rgba(26,122,84,0.03)' : 'var(--bg)',
              borderColor: dragOverCol === col.id ? 'var(--nn-accent)' : 'var(--border)',
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id) }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={() => handleDrop(col.id)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: 'var(--border)' }}>
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: col.dotColor }} />
              <span className="text-[12px] font-medium" style={{ color: 'var(--text1)' }}>{col.label}</span>
              <span
                className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-mono font-medium"
                style={{ background: 'var(--surface)', color: 'var(--text3)' }}
              >
                {col.items.length}
              </span>
            </div>

            {/* Column body */}
            <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
              {col.items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-[11px]" style={{ color: 'var(--text4)' }}>
                  <FileText className="h-5 w-5 mb-1.5 opacity-40" />
                  No articles
                </div>
              )}
              {col.items.map(item => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDragItem(item.id)}
                  onDragEnd={() => { setDragItem(null); setDragOverCol(null) }}
                  onClick={() => {
                    const found = articles.find(a => a.id === item.id)
                    if (found) onOpenArticle(found)
                  }}
                  className="cursor-pointer rounded-md border px-2.5 py-2 transition-all"
                  style={{
                    background: 'var(--bg)',
                    borderColor: 'var(--border)',
                    borderLeft: `2px solid ${col.borderColor}`,
                    opacity: dragItem === item.id ? 0.5 : 1,
                  }}
                >
                  <div className="text-[12px] font-medium leading-snug" style={{ color: 'var(--text1)' }}>
                    {item.title.length > 60 ? item.title.slice(0, 60) + '...' : item.title}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text3)' }}>
                    <span className="rounded px-1 py-0.5 font-mono" style={{ background: 'var(--surface)', color: 'var(--text3)' }}>
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                    {item.wordCount > 0 && <span>{item.wordCount?.toLocaleString()} w</span>}
                  </div>

                  {/* Progress bar for generating column */}
                  {item.status === 'generating' && item.progress !== undefined && (
                    <div className="mt-1.5">
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${item.progress}%`, background: col.borderColor }} />
                      </div>
                      <div className="mt-0.5 text-[9px] font-mono font-medium" style={{ color: col.borderColor }}>
                        {item.progress}% {item.progressMessage ? `- ${item.progressMessage}` : ''}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
