import * as Sentry from '@sentry/nextjs'

// Server-runtime Sentry init. DSN-gated: with no SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN
// set in the environment, Sentry stays completely off — this whole block is a no-op
// until the DSN is configured (e.g. in Vercel). `enabled` further limits sending to
// deployed builds so local `next dev` never reports, even if a DSN leaks into .env.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === 'production',
    // Sample 10% of transactions for performance tracing; error events are always
    // captured. Tune once you see volume.
    tracesSampleRate: 0.1,
  })
}
