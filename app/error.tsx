'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '520px', margin: '4rem auto', textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'rgba(197,48,48,0.08)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 1rem',
        fontSize: '1.5rem',
      }}>
        !
      </div>
      <h2 style={{ color: '#1a1a1a', fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 600 }}>
        Something went wrong
      </h2>
      <p style={{
        color: '#666',
        fontSize: '0.9rem',
        lineHeight: 1.5,
        marginBottom: '1.5rem',
      }}>
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      {error.digest && (
        <p style={{ color: '#999', fontSize: '0.75rem', marginBottom: '1rem', fontFamily: 'monospace' }}>
          Error ID: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
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
