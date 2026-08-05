import { createClient } from '@supabase/supabase-js'

// A cookieless anon Supabase client for PUBLIC data reads. Unlike the cookie
// SSR client (lib/supabase/server), it does not read request cookies, so pages
// that use it stay statically renderable (ISR / `revalidate`) instead of being
// forced dynamic on every request. Only use it for data readable by the
// anonymous role (published listings, public host info, approved reviews, etc.).
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase public env vars are not configured')
  }
  return createClient(url, key)
}
