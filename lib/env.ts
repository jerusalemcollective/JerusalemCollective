/**
 * Centralized, validated environment-variable access.
 *
 * - `publicEnv` holds NEXT_PUBLIC_* values (safe in client or server code).
 * - `getServerEnv()` returns server-only secrets and throws with the exact
 *   variable name if any required value is missing. Call it ONLY from route
 *   handlers, server actions, or server modules — never from a 'use client'
 *   component (that would bundle secrets into the browser).
 *
 * Adopt incrementally: new server code should prefer getServerEnv() over
 * reading process.env directly, so misconfiguration fails fast and clearly
 * instead of surfacing as a confusing downstream error.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
} as const

export function getServerEnv() {
  return {
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: required(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    serviceRoleKey: required(
      'SUPABASE_SERVICE_ROLE_KEY',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    stripeSecretKey: required('STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY),
    stripeWebhookSecret: required('STRIPE_WEBHOOK_SECRET', process.env.STRIPE_WEBHOOK_SECRET),
    resendApiKey: required('RESEND_API_KEY', process.env.RESEND_API_KEY),
    googleMapsApiKey: required('GOOGLE_MAPS_API_KEY', process.env.GOOGLE_MAPS_API_KEY),
    openaiApiKey: required('OPENAI_API_KEY', process.env.OPENAI_API_KEY),
  }
}
