'use client'

// Catches errors thrown in the root layout itself (where app/error.tsx can't
// reach). Must render its own <html>/<body>.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8F5F2',
          color: '#252525',
          fontFamily: 'system-ui, -apple-system, Arial, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 420 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#c76f55',
              margin: 0,
            }}
          >
            JLM Collective
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '12px 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#78716c', fontSize: 15, margin: '0 0 20px', lineHeight: 1.6 }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#252525',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: '10px 22px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
