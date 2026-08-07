import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function getSiteUrl(request: Request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    new URL(request.url).origin
  )
}

async function stripe(
  path: string,
  body: URLSearchParams,
  secretKey: string,
  idempotencyKey?: string,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method: 'POST', headers, body })
  const json = (await res.json().catch(() => ({}))) as unknown
  return { ok: res.ok, json }
}

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Connect onboarding is not configured yet.' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }

  // Ownership gate: resolve the host row exactly like requireHostDashboardAccess
  // (direct ownership or split-identity delegated host). host id comes from the
  // session, never from the client.
  const { data: host } = await supabase
    .from('hosts')
    .select('id, user_id')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle<{ id: string; user_id: string | null }>()

  const hostId = host?.id ?? user.id
  const hostIds = Array.from(new Set([hostId, user.id]))

  // Must be a real host (submitted application or owns a listing) so a random
  // signed-in guest cannot create connected accounts.
  const [{ data: application }, { data: listing }] = await Promise.all([
    supabase.from('host_applications').select('id').in('host_id', hostIds).limit(1).maybeSingle(),
    supabase.from('listings').select('id').in('host_id', hostIds).limit(1).maybeSingle(),
  ])
  if (!application && !listing) {
    return NextResponse.json({ error: 'Only hosts can set up payouts.' }, { status: 403 })
  }

  // Service-role client: the protect_host_stripe_columns trigger blocks the
  // authenticated session from writing stripe_account_id, so it is persisted here
  // (auth.uid() IS NULL under the service role).
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  const { data: existing } = await admin
    .from('host_payment_profiles')
    .select('host_id, stripe_account_id')
    .eq('host_id', hostId)
    .maybeSingle<{ host_id: string; stripe_account_id: string | null }>()

  let accountId = existing?.stripe_account_id ?? null

  if (!accountId) {
    // Create ONE Express account. Idempotency-Key derived from host id => two
    // rapid clicks or a retry return the SAME account, never a duplicate, even
    // before the id is persisted. Requesting the transfers capability does NOT
    // move money.
    const createParams = new URLSearchParams()
    createParams.set('type', 'express')
    createParams.set('metadata[host_id]', hostId)
    if (user.email) createParams.set('email', user.email)
    createParams.set('capabilities[transfers][requested]', 'true')

    const created = await stripe('accounts', createParams, stripeSecretKey, `connect_acct_create_${hostId}`)
    if (!created.ok || !isRecord(created.json) || typeof created.json.id !== 'string') {
      return NextResponse.json({ error: 'Could not start Stripe onboarding.' }, { status: 502 })
    }
    accountId = created.json.id

    const { error: upsertError } = await admin.from('host_payment_profiles').upsert(
      {
        host_id: hostId,
        stripe_account_id: accountId,
        payout_setup_status: 'pending',
        stripe_connect_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'host_id' },
    )
    if (upsertError) {
      return NextResponse.json({ error: 'Could not save your Stripe account.' }, { status: 500 })
    }
  }

  const siteUrl = getSiteUrl(request)
  const linkParams = new URLSearchParams()
  linkParams.set('account', accountId)
  linkParams.set('refresh_url', `${siteUrl}/host/dashboard/payments?connect=refresh`)
  linkParams.set('return_url', `${siteUrl}/host/dashboard/payments?connect=return`)
  linkParams.set('type', 'account_onboarding')

  const link = await stripe('account_links', linkParams, stripeSecretKey)
  if (!link.ok || !isRecord(link.json) || typeof link.json.url !== 'string') {
    return NextResponse.json({ error: 'Could not start Stripe onboarding.' }, { status: 502 })
  }

  return NextResponse.json({ url: link.json.url })
}
