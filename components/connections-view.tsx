'use client'

import { useState, useEffect } from 'react'
import {
  Database,
  Cpu,
  ImageIcon,
  ShoppingBag,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Key,
  HardDrive,
  Clock,
  Server,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface EnvVar {
  key: string
  required: boolean
  hint: string
  present: boolean
  preview: string
}

interface DbTable {
  name: string
  columns: number
  rows: number
}

interface DiagnosticsData {
  env: EnvVar[]
  database: {
    status: string
    version?: string
    databaseName?: string
    latencyMs?: number
    tableCount?: number
    tables?: DbTable[]
    samples?: Record<string, unknown[]>
    error?: string | null
  }
  claude: {
    status: string
    model?: string
    latencyMs?: number
    error?: string | null
  }
  shopify: {
    status: string
    domain?: string
    shopName?: string
    shopEmail?: string
    plan?: string
    latencyMs?: number
    error?: string | null
  }
  gemini: {
    status: string
    availableModels?: string[]
    latencyMs?: number
    error?: string | null
  }
  totalLatencyMs?: number
  timestamp?: string
  environment?: string
}

/* ------------------------------------------------------------------ */
/*  Micro-components                                                   */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; bg: string; color: string; label: string }> = {
    connected: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, bg: '#e6f4ea', color: '#1a7f37', label: 'Connected' },
    error: { icon: <XCircle className="h-3.5 w-3.5" />, bg: '#fde8e8', color: '#9b2c2c', label: 'Error' },
    not_configured: { icon: <AlertCircle className="h-3.5 w-3.5" />, bg: '#fef9ec', color: '#7a5c1e', label: 'Not Configured' },
    unknown: { icon: <Clock className="h-3.5 w-3.5" />, bg: 'var(--surface2)', color: 'var(--text4)', label: 'Unknown' },
  }
  const c = config[status] || config.unknown
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: c.bg, color: c.color }}
    >
      {c.icon}
      {c.label}
    </span>
  )
}

function ServiceCard({
  icon,
  title,
  status,
  latency,
  error,
  children,
}: {
  icon: React.ReactNode
  title: string
  status: string
  latency?: number
  error?: string | null
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: 'var(--nn-accent-light)', color: 'var(--nn-accent)' }}>
            {icon}
          </div>
          <h3 className="text-[14px] font-semibold" style={{ color: 'var(--text1)' }}>{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {latency !== undefined && (
            <span className="text-[11px] font-mono" style={{ color: 'var(--text4)' }}>{latency}ms</span>
          )}
          <StatusBadge status={status} />
        </div>
      </div>
      {error && (
        <div className="rounded-md px-3 py-2 mb-3 text-[12px]" style={{ background: '#fde8e8', color: '#9b2c2c' }}>
          {error}
        </div>
      )}
      {children && <div className="text-[12.5px]" style={{ color: 'var(--text2)' }}>{children}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ConnectionsView() {
  const [data, setData] = useState<DiagnosticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const runDiagnostics = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/diagnostics')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run diagnostics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { runDiagnostics() }, [])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[800px] px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-[24px] font-semibold" style={{ color: 'var(--text1)' }}>
              Connections
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Service health, database diagnostics, and environment status
            </p>
          </div>
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium border"
            style={{ color: 'var(--text2)', borderColor: 'var(--border)' }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Running...' : 'Re-run diagnostics'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border px-4 py-3 mb-6 text-[13px]" style={{ background: '#fde8e8', borderColor: '#f5c6c6', color: '#9b2c2c' }}>
            Failed to run diagnostics: {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--nn-accent)' }} />
            <span className="ml-2 text-[13px]" style={{ color: 'var(--text3)' }}>Running diagnostics...</span>
          </div>
        )}

        {data && (
          <>
            {/* Summary bar */}
            <div className="flex items-center gap-4 mb-6 rounded-lg border px-4 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              <span className="text-[11px] font-mono" style={{ color: 'var(--text4)' }}>
                {data.environment === 'vercel' ? 'Vercel' : 'Local'} &middot; {data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : ''} &middot; {data.totalLatencyMs}ms total
              </span>
            </div>

            {/* Service Cards */}
            <div className="space-y-4 mb-8">
              {/* Database */}
              <ServiceCard
                icon={<Database className="h-4 w-4" />}
                title="Neon PostgreSQL"
                status={data.database.status}
                latency={data.database.latencyMs}
                error={data.database.error}
              >
                {data.database.status === 'connected' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-[12px]">
                      <span style={{ color: 'var(--text3)' }}>Database:</span>
                      <span className="font-mono font-medium" style={{ color: 'var(--text1)' }}>{data.database.databaseName}</span>
                      <span style={{ color: 'var(--text3)' }}>Version:</span>
                      <span className="font-mono" style={{ color: 'var(--text1)' }}>{data.database.version}</span>
                    </div>
                  </div>
                )}
              </ServiceCard>

              {/* Claude */}
              <ServiceCard
                icon={<Cpu className="h-4 w-4" />}
                title="Anthropic Claude"
                status={data.claude.status}
                latency={data.claude.latencyMs}
                error={data.claude.error}
              >
                {data.claude.model && (
                  <span className="font-mono text-[11px]" style={{ color: 'var(--text3)' }}>Model: {data.claude.model}</span>
                )}
              </ServiceCard>

              {/* Gemini */}
              <ServiceCard
                icon={<ImageIcon className="h-4 w-4" />}
                title="Google Gemini"
                status={data.gemini.status}
                latency={data.gemini.latencyMs}
                error={data.gemini.error}
              >
                {data.gemini.availableModels && data.gemini.availableModels.length > 0 && (
                  <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
                    Models: {data.gemini.availableModels.map(m => m.replace('models/', '')).join(', ')}
                  </span>
                )}
              </ServiceCard>

              {/* Shopify */}
              <ServiceCard
                icon={<ShoppingBag className="h-4 w-4" />}
                title="Shopify Admin"
                status={data.shopify.status}
                latency={data.shopify.latencyMs}
                error={data.shopify.error}
              >
                {data.shopify.status === 'connected' && (
                  <div className="space-y-0.5">
                    <div className="text-[12px]">
                      <span style={{ color: 'var(--text3)' }}>Store: </span>
                      <span className="font-medium" style={{ color: 'var(--text1)' }}>{data.shopify.shopName}</span>
                    </div>
                    <div className="text-[12px]">
                      <span style={{ color: 'var(--text3)' }}>Domain: </span>
                      <span className="font-mono" style={{ color: 'var(--text1)' }}>{data.shopify.domain}</span>
                    </div>
                    {data.shopify.plan && (
                      <div className="text-[12px]">
                        <span style={{ color: 'var(--text3)' }}>Plan: </span>
                        <span style={{ color: 'var(--text1)' }}>{data.shopify.plan}</span>
                      </div>
                    )}
                  </div>
                )}
              </ServiceCard>
            </div>

            {/* Environment Variables */}
            <h2
              className="text-[10px] font-mono font-semibold tracking-[1.8px] uppercase mt-8 mb-3 pb-2"
              style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
            >
              Environment Variables
            </h2>
            <div className="rounded-lg border overflow-hidden mb-8" style={{ borderColor: 'var(--border)' }}>
              {data.env.map((env, i) => (
                <div
                  key={env.key}
                  className="flex items-center gap-3 px-3 py-2 text-[12px]"
                  style={{
                    borderBottom: i < data.env.length - 1 ? '1px solid var(--border)' : undefined,
                    background: env.present ? 'var(--bg)' : env.required ? '#fef9ec' : 'var(--bg)',
                  }}
                >
                  {env.present ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#1a7f37' }} />
                  ) : env.required ? (
                    <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: '#9b2c2c' }} />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" style={{ color: '#b8860b' }} />
                  )}
                  <span className="font-mono font-medium w-[280px] shrink-0" style={{ color: 'var(--text1)' }}>
                    {env.key}
                  </span>
                  {env.present ? (
                    <span className="font-mono text-[11px] truncate" style={{ color: 'var(--text3)' }}>
                      {env.preview}
                    </span>
                  ) : (
                    <span className="text-[11px]" style={{ color: env.required ? '#9b2c2c' : 'var(--text4)' }}>
                      {env.required ? 'Missing (required)' : `Not set — ${env.hint}`}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Database Tables */}
            {data.database.tables && data.database.tables.length > 0 && (
              <>
                <h2
                  className="text-[10px] font-mono font-semibold tracking-[1.8px] uppercase mt-8 mb-3 pb-2"
                  style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
                >
                  Database Tables ({data.database.tableCount})
                </h2>
                <div className="rounded-lg border overflow-hidden mb-8" style={{ borderColor: 'var(--border)' }}>
                  <div
                    className="grid px-3 py-1.5 text-[10px] font-mono font-medium uppercase tracking-wider"
                    style={{ gridTemplateColumns: '1fr 80px 80px', background: 'var(--surface)', color: 'var(--text4)' }}
                  >
                    <span>Table</span>
                    <span className="text-right">Columns</span>
                    <span className="text-right">Rows</span>
                  </div>
                  {data.database.tables.map((table, i) => (
                    <div
                      key={table.name}
                      className="grid px-3 py-1.5 text-[12px]"
                      style={{
                        gridTemplateColumns: '1fr 80px 80px',
                        borderTop: '1px solid var(--border)',
                        background: 'var(--bg)',
                      }}
                    >
                      <span className="font-mono" style={{ color: 'var(--text1)' }}>
                        <HardDrive className="inline h-3 w-3 mr-1.5 opacity-40" />
                        {table.name}
                      </span>
                      <span className="text-right font-mono" style={{ color: 'var(--text3)' }}>{table.columns}</span>
                      <span className="text-right font-mono" style={{ color: table.rows >= 0 ? 'var(--text1)' : 'var(--text4)' }}>
                        {table.rows >= 0 ? table.rows.toLocaleString() : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Sample Data */}
            {data.database.samples && Object.keys(data.database.samples).length > 0 && (
              <>
                <h2
                  className="text-[10px] font-mono font-semibold tracking-[1.8px] uppercase mt-8 mb-3 pb-2"
                  style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
                >
                  Sample Data (verify correct database)
                </h2>
                {Object.entries(data.database.samples).map(([tableName, rows]) => (
                  <div key={tableName} className="mb-4">
                    <h3 className="text-[12px] font-mono font-semibold mb-1.5" style={{ color: 'var(--text2)' }}>
                      {tableName}
                    </h3>
                    <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
                      {(rows as Record<string, unknown>[]).length > 0 ? (
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr style={{ background: 'var(--surface)' }}>
                              {Object.keys((rows as Record<string, unknown>[])[0]).map(col => (
                                <th
                                  key={col}
                                  className="px-2.5 py-1.5 text-left font-mono font-medium"
                                  style={{ color: 'var(--text4)' }}
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(rows as Record<string, unknown>[]).map((row, i) => (
                              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                {Object.values(row).map((val, j) => (
                                  <td
                                    key={j}
                                    className="px-2.5 py-1.5 font-mono max-w-[200px] truncate"
                                    style={{ color: 'var(--text2)' }}
                                  >
                                    {val === null ? <span style={{ color: 'var(--text4)' }}>null</span> : String(val)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--text4)' }}>No rows</div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
