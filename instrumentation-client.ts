import * as Sentry from '@sentry/nextjs'

// Client-runtime Sentry init. Next.js loads this before the app hydrates. Only the
// public DSN is available in the browser, and it's still gated + production-only, so
// nothing runs until NEXT_PUBLIC_SENTRY_DSN is set in the deployed environment.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === 'production',
    tracesSampleRate: 0.1,
  })
}

// Ties client-side route navigations into Sentry tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
