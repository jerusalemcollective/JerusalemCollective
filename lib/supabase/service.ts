import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The single place a privileged, service-role Supabase client is constructed.
//
// This client is keyed with SUPABASE_SERVICE_ROLE_KEY and therefore BYPASSES RLS.
// Only import it from trusted, server-only contexts — webhooks, cron jobs,
// token-authed feeds, and server-only email helpers. NEVER import it into anything
// reachable by a browser session.
//
// Auth persistence/refresh is disabled deliberately: these handlers run in
// stateless serverless invocations with no user session to store or refresh, and
// leaving persistence on risks a client trying to touch storage that isn't there.
// Centralising it here guarantees every privileged client is built identically
// (some call sites previously passed no auth options at all).
//
// Callers keep their own env reads + validation so they can return context-specific
// errors; this factory only owns the construction/config.
export function createServiceRoleClient(
  supabaseUrl: string,
  serviceRoleKey: string,
): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
