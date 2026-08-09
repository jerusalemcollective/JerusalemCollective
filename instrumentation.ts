import * as Sentry from '@sentry/nextjs'

// Next.js calls register() once when the server starts. Load the Sentry init for
// whichever runtime we booted in (Node server vs. edge). Both configs are DSN-gated,
// so this is inert until a DSN is set.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Captures errors thrown in server components, route handlers, and middleware and
// forwards them to Sentry (a no-op until Sentry is initialised with a DSN).
export const onRequestError = Sentry.captureRequestError
