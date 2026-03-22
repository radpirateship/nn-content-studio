'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'

/**
 * ARIA Live Announcer — provides screen reader announcements for dynamic content changes.
 *
 * Usage:
 *   1. Wrap your app with <AriaLiveProvider>
 *   2. Call announce("message") from any child component via useAnnounce()
 *
 * The announcer renders a visually-hidden div with aria-live="polite"
 * that screen readers will read when its content changes.
 */

type AnnounceFunction = (message: string) => void

const AriaLiveContext = createContext<AnnounceFunction>(() => {})

export function useAnnounce(): AnnounceFunction {
  return useContext(AriaLiveContext)
}

export function AriaLiveProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('')

  // Clear → set pattern ensures the screen reader picks up repeated identical messages
  const announce = useCallback((msg: string) => {
    setMessage('')
    // Use a micro-delay so the DOM sees the empty string first
    requestAnimationFrame(() => {
      setMessage(msg)
    })
  }, [])

  return (
    <AriaLiveContext.Provider value={announce}>
      {children}
      {/* Visually hidden but available to screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {message}
      </div>
    </AriaLiveContext.Provider>
  )
}
