import * as Sentry from '@sentry/nextjs'

// Edge-runtime Sentry init (middleware and edge route handlers run in a separate
// runtime from the Node server, so they need their own init). Same DSN gate and
// production-only guard as the server config.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === 'production',
    tracesSampleRate: 0.1,
  })
}
