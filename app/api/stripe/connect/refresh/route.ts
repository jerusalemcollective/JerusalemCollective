import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function getNestedRecord(value: Record<string, unknown>, key: string) {
  const nested = value[key]
  return isRecord(nested) ? nested : null
}

// Pull the connected account's live status straight from Stripe and store the
// readiness flags. This is what lets onboarding work WITHOUT a webhook: when a
// host returns from Stripe, the card calls this and the status updates. The
// Connect webhook (if configured) does the same thing for later changes. Read
// from Stripe + status write only — NO money moves.
export async function POST() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Connect is not configured yet.' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }

  // Same ownership resolution as the onboarding route: host id from the session,
  // via the hosts.id / hosts.user_id bridge.
  const { data: host } = await supabase
    .from('hosts')
    .select('id, user_id')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle<{ id: string; user_id: string | null }>()

  const hostId = host?.id ?? user.id

  const admin = createServiceClient(supabaseUrl, serviceRoleKey)
  const { data: profile } = await admin
    .from('host_payment_profiles')
    .select('stripe_account_id')
    .eq('host_id', hostId)
    .maybeSingle<{ stripe_account_id: string | null }>()

  const accountId = profile?.stripe_account_id
  if (!accountId) {
    return NextResponse.json({ connected: false })
  }

  const res = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  })
  const account = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok || !isRecord(account)) {
    return NextResponse.json({ error: 'Could not read your Stripe account.' }, { status: 502 })
  }

  const chargesEnabled = account.charges_enabled === true
  const payoutsEnabled = account.payouts_enabled === true
  const detailsSubmitted = account.details_submitted === true
  const requirements = getNestedRecord(account, 'requirements')
  const disabledReason =
    requirements && typeof requirements.disabled_reason === 'string'
      ? requirements.disabled_reason
      : null

  let status: 'not_started' | 'pending' | 'ready' | 'restricted' = 'pending'
  if (payoutsEnabled && chargesEnabled) status = 'ready'
  else if (detailsSubmitted && disabledReason) status = 'restricted'

  await admin
    .from('host_payment_profiles')
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_details_submitted: detailsSubmitted,
      payout_setup_status: status,
      stripe_connect_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', accountId)

  return NextResponse.json({ connected: true, chargesEnabled, payoutsEnabled, status })
}
