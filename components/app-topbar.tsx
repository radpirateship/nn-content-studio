'use client'

import { useState, useEffect, useCallback } from 'react'

// How long (ms) before we consider the DB might have gone to sleep.
// Neon free plan suspends after 5 min; we mark as "possibly cold" after 6.
const COLD_THRESHOLD_MS = 6 * 60 * 1000

const DB_LAST_ACTIVE_KEY = 'nn_db_last_active'

type DbStatus = 'unknown' | 'cold' | 'waking' | 'ready'

interface AppTopbarProps {
  isGenerating?: boolean
  generationMessage?: string
  userName?: string
}

export function AppTopbar({ isGenerating, generationMessage, userName }: AppTopbarProps) {
  const displayName = userName || process.env.NEXT_PUBLIC_USER_NAME || 'User'
  const initial = displayName.charAt(0).toUpperCase()

  const [dbStatus, setDbStatus] = useState<DbStatus>('unknown')

  // On mount, check localStorage to see if the DB is likely cold
  useEffect(() => {
    const raw = localStorage.getItem(DB_LAST_ACTIVE_KEY)
    if (!raw) {
      setDbStatus('cold')
      return
    }
    const lastActive = parseInt(raw, 10)
    const idle = Date.now() - lastActive
    setDbStatus(idle > COLD_THRESHOLD_MS ? 'cold' : 'ready')
  }, [])

  const wakeDb = useCallback(async () => {
    setDbStatus('waking')
    try {
      const res = await fetch('/api/ping')
      if (res.ok) {
        localStorage.setItem(DB_LAST_ACTIVE_KEY, String(Date.now()))
        setDbStatus('ready')
      } else {
        setDbStatus('cold')
      }
    } catch {
      setDbStatus('cold')
    }
  }, [])

  // Expose a global helper so DB-touching API calls can record activity
  useEffect(() => {
    ;(window as any).__recordDbActivity = () => {
      localStorage.setItem(DB_LAST_ACTIVE_KEY, String(Date.now()))
      setDbStatus('ready')
    }
  }, [])

  const statusConfig: Record<DbStatus, { label: string; color: string; pulse: boolean } | null> = {
    unknown: null,
    ready: { label: 'DB ready', color: 'var(--nn-accent)', pulse: false },
    waking: { label: 'Waking DB…', color: '#f59e0b', pulse: true },
    cold: { label: 'DB may be cold', color: '#94a3b8', pulse: false },
  }

  const status = statusConfig[dbStatus]

  return (
    <header
      className="flex items-center gap-3 px-5 relative z-10"
      style={{
        gridColumn: '1 / -1',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        height: 'var(--header-h)',
      }}
    >
      {/* Logo */}
      <div className="font-serif font-semibold text-[17px] tracking-[-0.3px]" style={{ color: 'var(--nn-accent)' }}>
        NN
        <span className="font-normal text-[14px] ml-1" style={{ color: 'var(--text3)' }}>Content Studio</span>
      </div>

      {/* Generation status (only when active) */}
      {isGenerating && (
        <>
          <div className="h-6 w-px mx-1" style={{ background: 'var(--border)' }} />
          <span className="text-[12px]" style={{ color: 'var(--text3)' }}>
            {generationMessage || 'Generating...'}
          </span>
        </>
      )}

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">

        {/* DB wake indicator */}
        {status && (
          <button
            onClick={dbStatus === 'cold' ? wakeDb : undefined}
            disabled={dbStatus === 'waking' || dbStatus === 'ready'}
            title={dbStatus === 'cold' ? 'Click to wake the database' : undefined}
            className="flex items-center gap-1.5 text-[11px] rounded-full px-2.5 py-1 transition-all"
            style={{
              color: status.color,
              border: `1px solid ${status.color}`,
              opacity: dbStatus === 'ready' ? 0.6 : 1,
              cursor: dbStatus === 'cold' ? 'pointer' : 'default',
              background: 'transparent',
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: status.color,
                animation: status.pulse ? 'pulse 1.2s ease-in-out infinite' : 'none',
              }}
            />
            {status.label}
          </button>
        )}

        {/* User identity */}
        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text2)' }}>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full font-serif text-[12px] font-semibold"
            style={{
              background: 'var(--nn-accent-light)',
              border: '1.5px solid var(--nn-accent)',
              color: 'var(--nn-accent)',
            }}
          >
            {initial}
          </div>
          {displayName}
        </div>
      </div>
    </header>
  )
}
