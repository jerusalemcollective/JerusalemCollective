import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendGuestBalanceReminderEmail } from '@/lib/transactional-email'
import { pingCronHeartbeat } from '@/lib/cron-heartbeat'

const HEARTBEAT_SLUG = 'balance-reminders'

export const runtime = 'nodejs'

// How many days before the due date guests start getting a reminder.
const REMINDER_WINDOW_DAYS = 7

type DueRow = {
  id: string
  guest_id: string | null
  currency: string | null
  balance_amount: number | null
  balance_due_date: string | null
  booking_id: string | null
}

function formatMoney(currency: string | null, amount: number | null) {
  const value = Number(amount || 0)
  const symbol = currency === 'USD' ? '$' : currency === 'ILS' ? '₪' : ''
  return `${symbol}${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatDate(value: string | null) {
  if (!value) return 'the due date'
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
  // set in the project env. Reject anything else so the route isn't public.
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    await pingCronHeartbeat(HEARTBEAT_SLUG, false)
    return NextResponse.json({ error: 'Not configured.' }, { status: 500 })
  }
  const supabase = createServiceRoleClient(supabaseUrl, serviceRoleKey)

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() + REMINDER_WINDOW_DAYS)
  const cutoffDate = cutoff.toISOString().slice(0, 10)

  // Balances due within the window that we haven't reminded about yet.
  const { data: due, error } = await supabase
    .from('booking_payments')
    .select('id, guest_id, currency, balance_amount, balance_due_date, booking_id')
    .eq('balance_status', 'due')
    .eq('status', 'paid') // deposit settled + booking finalised only
    .not('booking_id', 'is', null)
    .gt('balance_amount', 0)
    .is('balance_reminder_sent_at', null)
    .lte('balance_due_date', cutoffDate)
    .limit(200)

  if (error) {
    await pingCronHeartbeat(HEARTBEAT_SLUG, false)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  for (const row of (due || []) as DueRow[]) {
    if (!row.guest_id) continue

    let listingTitle = 'your stay'
    if (row.booking_id) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('listings(title)')
        .eq('id', row.booking_id)
        .maybeSingle<{ listings: { title: string } | { title: string }[] | null }>()
      const listings = booking?.listings
      const title = Array.isArray(listings) ? listings[0]?.title : listings?.title
      if (typeof title === 'string' && title.trim()) listingTitle = title
    }

    const ok = await sendGuestBalanceReminderEmail({
      guestId: row.guest_id,
      listingTitle,
      balanceLabel: formatMoney(row.currency, row.balance_amount),
      dueDateLabel: formatDate(row.balance_due_date),
    })

    if (ok) {
      await supabase
        .from('booking_payments')
        .update({ balance_reminder_sent_at: new Date().toISOString() })
        .eq('id', row.id)
      sent += 1
    }
  }

  // Job completed successfully — ping the dead-man's switch so the external
  // monitor knows the cron is alive. If this stops arriving, it alerts.
  await pingCronHeartbeat(HEARTBEAT_SLUG)

  return NextResponse.json({ ok: true, checked: (due || []).length, sent })
}
