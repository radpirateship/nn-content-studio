'use client'

import { useState, useEffect } from 'react'
import {
  RefreshCw,
  Loader2,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  ChevronDown,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface LogEntry {
  id: number
  action: string
  category: string
  detail: string | null
  status: 'success' | 'error' | 'warning'
  duration_ms: number | null
  metadata: Record<string, unknown>
  created_at: string
}

/* ------------------------------------------------------------------ */
/*  Micro-components                                                   */
/* ------------------------------------------------------------------ */

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#1a7f37' }} />
    case 'error':
      return <XCircle className="h-3.5 w-3.5" style={{ color: '#9b2c2c' }} />
    case 'warning':
      return <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#b8860b' }} />
    default:
      return <Clock className="h-3.5 w-3.5" style={{ color: 'var(--text4)' }} />
  }
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string }> = {
    success: { bg: '#e6f4ea', color: '#1a7f37' },
    error: { bg: '#fde8e8', color: '#9b2c2c' },
    warning: { bg: '#fef9ec', color: '#7a5c1e' },
  }
  const c = config[status] || { bg: 'var(--surface2)', color: 'var(--text4)' }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium font-mono"
      style={{ background: c.bg, color: c.color }}
    >
      <StatusIcon status={status} />
      {status}
    </span>
  )
}

function CategoryBadge({ category }: { category: string }) {
  const palette: Record<string, { bg: string; color: string }> = {
    generation: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' },
    revamp: { bg: 'rgba(168,85,247,0.1)', color: '#a855f7' },
    publish: { bg: 'rgba(34,197,94,0.1)', color: '#16a34a' },
    articles: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
    images: { bg: 'rgba(236,72,153,0.1)', color: '#ec4899' },
    general: { bg: 'var(--surface2)', color: 'var(--text3)' },
  }
  const c = palette[category] || palette.general
  return (
    <span
      className="inline-block rounded px-1.5 py-px text-[10px] font-mono font-medium"
      style={{ background: c.bg, color: c.color }}
    >
      {category}
    </span>
  )
}

function TimeAgo({ date }: { date: string }) {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  let text: string
  if (diffMins < 1) text = 'just now'
  else if (diffMins < 60) text = `${diffMins}m ago`
  else if (diffHours < 24) text = `${diffHours}h ago`
  else text = `${diffDays}d ago`

  return (
    <span
      className="text-[11px] font-mono"
      style={{ color: 'var(--text4)' }}
      title={then.toLocaleString()}
    >
      {text}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Filter dropdown                                                    */
/* ------------------------------------------------------------------ */

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (val: string) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-md border pl-2.5 pr-7 py-1.5 text-[12px] font-medium cursor-pointer"
        style={{
          color: 'var(--text2)',
          borderColor: 'var(--border)',
          background: 'var(--bg)',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3"
        style={{ color: 'var(--text4)' }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function LogsView() {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/activity-log?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setEntries(json.entries || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [categoryFilter, statusFilter])

  // Derive unique categories from data
  const categories = Array.from(new Set(entries.map((e) => e.category))).sort()

  // Client-side search filtering
  const filtered = searchTerm
    ? entries.filter(
        (e) =>
          e.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (e.detail && e.detail.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : entries

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[900px] px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="font-serif text-[24px] font-semibold"
              style={{ color: 'var(--text1)' }}
            >
              Activity Logs
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Recent actions and events &middot; auto-cleaned after 7 days
            </p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium border"
            style={{ color: 'var(--text2)', borderColor: 'var(--border)' }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div
            className="rounded-lg border px-4 py-3 mb-6 text-[13px]"
            style={{ background: '#fde8e8', borderColor: '#f5c6c6', color: '#9b2c2c' }}
          >
            Failed to load logs: {error}
          </div>
        )}

        {/* Filters bar */}
        <div
          className="flex flex-wrap items-center gap-3 mb-4 rounded-lg border px-3 py-2.5"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
        >
          <Filter className="h-3.5 w-3.5" style={{ color: 'var(--text4)' }} />

          <FilterDropdown
            label="Category"
            value={categoryFilter}
            options={[
              { value: 'all', label: 'All categories' },
              { value: 'generation', label: 'Generation' },
              { value: 'revamp', label: 'Revamp' },
              { value: 'publish', label: 'Publish' },
              { value: 'articles', label: 'Articles' },
              { value: 'images', label: 'Images' },
              { value: 'general', label: 'General' },
            ]}
            onChange={setCategoryFilter}
          />

          <FilterDropdown
            label="Status"
            value={statusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'success', label: 'Success' },
              { value: 'error', label: 'Error' },
              { value: 'warning', label: 'Warning' },
            ]}
            onChange={setStatusFilter}
          />

          <div className="flex-1" />

          <div className="relative">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: 'var(--text4)' }}
            />
            <input
              type="text"
              placeholder="Search actions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-md border pl-7 pr-3 py-1.5 text-[12px] w-[180px]"
              style={{
                color: 'var(--text1)',
                borderColor: 'var(--border)',
                background: 'var(--bg)',
              }}
            />
          </div>

          <span className="text-[11px] font-mono" style={{ color: 'var(--text4)' }}>
            {filtered.length} entries
          </span>
        </div>

        {/* Loading state */}
        {loading && entries.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--nn-accent)' }} />
            <span className="ml-2 text-[13px]" style={{ color: 'var(--text3)' }}>
              Loading activity logs...
            </span>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div
            className="rounded-lg border px-6 py-12 text-center"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
          >
            <Clock className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--text4)' }} />
            <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--text2)' }}>
              No activity logged yet
            </p>
            <p className="text-[12px]" style={{ color: 'var(--text4)' }}>
              Activity will appear here as you generate articles, revamp content, and publish.
              {searchTerm && ' Try clearing your search.'}
            </p>
          </div>
        )}

        {/* Log entries */}
        {filtered.length > 0 && (
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {filtered.map((entry, i) => {
              const isExpanded = expandedId === entry.id
              const hasMeta =
                entry.metadata && Object.keys(entry.metadata).length > 0

              return (
                <div
                  key={entry.id}
                  className="transition-colors"
                  style={{
                    borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                    background: isExpanded ? 'var(--surface)' : 'var(--bg)',
                  }}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3"
                  >
                    <StatusIcon status={entry.status} />

                    <span
                      className="text-[13px] font-medium flex-1 truncate"
                      style={{ color: 'var(--text1)' }}
                    >
                      {entry.action}
                    </span>

                    <CategoryBadge category={entry.category} />

                    {entry.duration_ms !== null && (
                      <span
                        className="text-[11px] font-mono shrink-0"
                        style={{ color: 'var(--text4)' }}
                      >
                        {entry.duration_ms >= 1000
                          ? `${(entry.duration_ms / 1000).toFixed(1)}s`
                          : `${entry.duration_ms}ms`}
                      </span>
                    )}

                    <TimeAgo date={entry.created_at} />
                  </button>

                  {isExpanded && (
                    <div
                      className="px-4 pb-3 pt-0 text-[12px] space-y-2"
                      style={{ color: 'var(--text2)' }}
                    >
                      {entry.detail && (
                        <div className="rounded-md px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          {entry.detail}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--text3)' }}>
                        <span>
                          <strong>Status:</strong> <StatusBadge status={entry.status} />
                        </span>
                        <span>
                          <strong>Time:</strong>{' '}
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                        {entry.duration_ms !== null && (
                          <span>
                            <strong>Duration:</strong> {entry.duration_ms}ms
                          </span>
                        )}
                      </div>

                      {hasMeta && (
                        <div>
                          <div
                            className="text-[10px] font-mono font-medium uppercase tracking-wider mb-1"
                            style={{ color: 'var(--text4)' }}
                          >
                            Metadata
                          </div>
                          <pre
                            className="rounded-md px-3 py-2 text-[11px] font-mono overflow-x-auto"
                            style={{
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              color: 'var(--text2)',
                            }}
                          >
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
