'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '600px', margin: '2rem auto' }}>
      <h2 style={{ color: '#c53030', fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h2>
      <pre style={{
        background: '#f8f8f8',
        padding: '1rem',
        borderRadius: '8px',
        overflow: 'auto',
        fontSize: '0.85rem',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        border: '1px solid #e0e0e0',
        marginBottom: '1rem',
      }}>
        {error.message}
        {error.stack && '\n\n' + error.stack}
      </pre>
      <button
        onClick={reset}
        style={{
          padding: '0.5rem 1.5rem',
          background: '#00A3FF',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Try again
      </button>
    </div>
  )
}
