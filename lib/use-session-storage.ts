'use client'

import { useEffect, useCallback } from 'react'

const PREFIX = 'nn-studio:'

/**
 * Save a value to sessionStorage under a prefixed key.
 */
export function sessionSet(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value))
  } catch {
    // sessionStorage may be unavailable or full
  }
}

/**
 * Read a value from sessionStorage.
 */
export function sessionGet<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${key}`)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/**
 * Remove a value from sessionStorage.
 */
export function sessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(`${PREFIX}${key}`)
  } catch {
    // Ignore
  }
}

/**
 * Auto-persist a value to sessionStorage whenever it changes.
 */
export function useSessionPersist(key: string, value: unknown): void {
  useEffect(() => {
    sessionSet(key, value)
  }, [key, value])
}
