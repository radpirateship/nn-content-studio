'use client'

import { useEffect, useCallback, useState } from 'react'
import type { ViewId } from './app-sidebar'

interface KeyboardShortcutsOptions {
  onNavigate: (view: ViewId) => void
  onToggleSidebar: () => void
  onSave?: () => void
  onOpenCommandPalette: () => void
  hasCurrentArticle: boolean
}

export function useKeyboardShortcuts({
  onNavigate,
  onToggleSidebar,
  onSave,
  onOpenCommandPalette,
  hasCurrentArticle,
}: KeyboardShortcutsOptions) {
  const [showHelp, setShowHelp] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey
    const target = e.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    // Cmd+K — command palette (always active)
    if (meta && e.key === 'k') {
      e.preventDefault()
      onOpenCommandPalette()
      return
    }

    // Cmd+B — toggle sidebar
    if (meta && e.key === 'b') {
      e.preventDefault()
      onToggleSidebar()
      return
    }

    // Cmd+S — save current article
    if (meta && e.key === 's') {
      e.preventDefault()
      onSave?.()
      return
    }

    // Cmd+/ — toggle shortcuts help
    if (meta && e.key === '/') {
      e.preventDefault()
      setShowHelp(prev => !prev)
      return
    }

    // Don't process number shortcuts when typing in inputs
    if (isInput) return

    // Cmd+1-5 — navigate pipeline steps (only when article is loaded)
    if (meta && hasCurrentArticle) {
      const viewMap: Record<string, ViewId> = {
        '1': 'article-content',
        '2': 'article-links',
        '3': 'article-images',
        '4': 'article-seo',
        '5': 'publish-confirm',
      }
      if (viewMap[e.key]) {
        e.preventDefault()
        onNavigate(viewMap[e.key])
        return
      }
    }
  }, [onNavigate, onToggleSidebar, onSave, onOpenCommandPalette, hasCurrentArticle])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { showHelp, setShowHelp }
}

const shortcuts = [
  { keys: ['⌘', 'K'], description: 'Open command palette' },
  { keys: ['⌘', 'B'], description: 'Toggle sidebar' },
  { keys: ['⌘', 'S'], description: 'Save article' },
  { keys: ['⌘', '1–5'], description: 'Navigate pipeline steps' },
  { keys: ['⌘', '/'], description: 'Show this help' },
]

interface ShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative rounded-xl border p-6 shadow-xl w-[360px]"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--text1)' }}>
          Keyboard Shortcuts
        </h2>
        <div className="flex flex-col gap-3">
          {shortcuts.map(shortcut => (
            <div key={shortcut.description} className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: 'var(--text2)' }}>
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map(key => (
                  <kbd
                    key={key}
                    className="rounded px-1.5 py-0.5 text-[11px] font-mono font-medium border"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--text2)',
                    }}
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] mt-4" style={{ color: 'var(--text4)' }}>
          Press <kbd className="rounded px-1 py-0.5 text-[10px] font-mono border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>Esc</kbd> or <kbd className="rounded px-1 py-0.5 text-[10px] font-mono border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>⌘/</kbd> to close
        </p>
      </div>
    </div>
  )
}
