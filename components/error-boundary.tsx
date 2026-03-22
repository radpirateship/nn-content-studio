'use client'

import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * React Error Boundary that catches render-time errors in child components.
 * Prevents the entire SPA from crashing with a white screen.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '2rem',
          fontFamily: "'Open Sans', system-ui, sans-serif",
          textAlign: 'center',
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(197, 48, 48, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            fontSize: '1.5rem',
            color: '#c53030',
            fontWeight: 700,
          }}>
            !
          </div>
          <h2 style={{
            color: '#1a1a1a',
            fontSize: '1.25rem',
            marginBottom: '0.5rem',
            fontWeight: 600,
          }}>
            Something went wrong
          </h2>
          <p style={{
            color: '#666',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            maxWidth: '420px',
            marginBottom: '1.5rem',
          }}>
            An unexpected error occurred in this view. Your data has been preserved.
          </p>
          {this.state.error?.message && (
            <pre style={{
              background: '#f7f7f7',
              borderRadius: '6px',
              padding: '0.75rem 1rem',
              fontSize: '0.8rem',
              color: '#888',
              maxWidth: '480px',
              overflow: 'auto',
              marginBottom: '1.5rem',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.6rem 1.5rem',
              background: '#00A3FF',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
