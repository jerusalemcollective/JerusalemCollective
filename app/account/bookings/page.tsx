import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/breadcrumb'
import { formatDateDisplay } from '@/lib/utils/date'
import { CancelBookingButton } from './cancel-booking-button'
import { PayBalanceButton } from '@/components/pay-balance-button'
import { DirectPaymentScheduleSummary } from '@/components/direct-payment-schedule-summary'
import { parsePayout } from '@/lib/direct-payment'

const bookingRowSchema = z.object({
  id: z.string(),
  check_in: z.string().nullable(),
  check_out: z.string().nullable(),
  status: z.string().nullable().optional(),
  listings: z
    .object({
      id: z.string(),
      title: z.string(),
      area: z.string().nullable(),
    })
    .nullable()
    .optional(),
})

const statusBadge: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelled', className: 'bg-stone-200 text-stone-500' },
  completed: { label: 'Completed', className: 'bg-stone-100 text-stone-600' },
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>
}) {
  const { payment } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/account/bookings')
  }

  const { data } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, status, listings(id, title, area)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const bookings = z.array(bookingRowSchema).parse(data ?? [])
  const today = new Date().toISOString().slice(0, 10)

  // Balance owed per booking (the deposit's booking_payments row also carries
  // the balance amount, due date and status).
  type BalancePaymentRow = {
    booking_id: string | null
    id: string
    currency: string | null
    balance_amount: number | null
    balance_due_date: string | null
    balance_status: string | null
  }
  const bookingIds = bookings.map((booking) => booking.id)
  const { data: paymentsData } = bookingIds.length
    ? await supabase
        .from('booking_payments')
        .select('booking_id, id, currency, balance_amount, balance_due_date, balance_status')
        .eq('guest_id', user.id)
        .in('booking_id', bookingIds)
    : { data: [] }
  const paymentByBooking = new Map<string, BalancePaymentRow>()
  for (const paymentRow of (paymentsData || []) as BalancePaymentRow[]) {
    if (paymentRow.booking_id) paymentByBooking.set(paymentRow.booking_id, paymentRow)
  }

  // Direct-payment schedule per booking (host's terms, readable only for the
  // guest's own bookings via a definer function).
  const { data: scheduleRows } = await supabase.rpc('get_my_booking_payment_schedules')
  const scheduleByBooking = new Map<
    string,
    { accepts_direct: boolean; instructions: string | null; payout_details: unknown }
  >()
  for (const row of (scheduleRows || []) as {
    booking_id: string
    accepts_direct: boolean
    instructions: string | null
    payout_details: unknown
  }[]) {
    scheduleByBooking.set(row.booking_id, {
      accepts_direct: row.accepts_direct,
      instructions: row.instructions,
      payout_details: row.payout_details,
    })
  }

  // After Stripe checkout the guest is redirected here immediately, before the
  // webhook has necessarily finished. Derive the banner from the actual latest
  // payment so we never claim "confirmed" when the booking failed or is still
  // finalising.
  let paymentNotice: 'confirmed' | 'review' | 'processing' | 'failed' | null = null
  if (payment === 'success') {
    const { data: latestPayment } = await supabase
      .from('booking_payments')
      .select('status, needs_manual_review, booking_id')
      .eq('guest_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        status: string | null
        needs_manual_review: boolean | null
        booking_id: string | null
      }>()

    if (latestPayment?.needs_manual_review) {
      paymentNotice = 'review'
    } else if (latestPayment?.status === 'paid' || latestPayment?.booking_id) {
      paymentNotice = 'confirmed'
    } else if (latestPayment?.status === 'failed') {
      paymentNotice = 'failed'
    } else {
      paymentNotice = 'processing'
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-6">
        <Breadcrumb items={[{ label: 'Account', href: '/account' }, { label: 'My trips' }]} />

        {paymentNotice === 'confirmed' && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            <p className="font-semibold">Payment received — your stay is confirmed.</p>
            <p className="mt-1 text-green-700">
              Your booking is listed below. You can add it to your calendar from the booking.
            </p>
          </div>
        )}

        {paymentNotice === 'processing' && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <p className="font-semibold">Payment received — we&rsquo;re finalising your booking.</p>
            <p className="mt-1 text-amber-800">
              This usually takes a few moments. Refresh this page shortly and your stay will appear below.
            </p>
          </div>
        )}

        {paymentNotice === 'review' && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <p className="font-semibold">Payment received — we&rsquo;re confirming this manually.</p>
            <p className="mt-1 text-amber-800">
              Something needed a closer look on our end. Your payment is safe, and the JLM Collective team will contact you shortly to confirm your stay.
            </p>
          </div>
        )}

        {paymentNotice === 'failed' && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p className="font-semibold">Your payment didn&rsquo;t go through.</p>
            <p className="mt-1 text-red-700">
              No charge was completed and no booking was made. Please try booking again, or contact us if you need help.
            </p>
          </div>
        )}

        {payment === 'balance_success' && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            <p className="font-semibold">Balance paid — thank you.</p>
            <p className="mt-1 text-green-700">Your stay is now paid in full.</p>
          </div>
        )}

        {payment === 'balance_cancelled' && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <p className="font-semibold">Balance payment not completed.</p>
            <p className="mt-1 text-amber-800">
              No charge was made. You can pay your balance any time from the booking below.
            </p>
          </div>
        )}

        {payment === 'balance_error' && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <p className="font-semibold">We couldn&rsquo;t open your balance payment.</p>
            <p className="mt-1 text-amber-800">
              It may already be paid, or the booking isn&rsquo;t ready yet. Find your stay below to pay the balance or check its status.
            </p>
          </div>
        )}

        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-stone-950">My trips</h1>
        </header>

        {bookings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {bookings.map((booking) => {
              const status = booking.status || 'pending'
              const badge = statusBadge[status] || statusBadge.pending
              const bookingPayment = paymentByBooking.get(booking.id)
              const sched = scheduleByBooking.get(booking.id)
              const isCancellable =
                status !== 'cancelled' &&
                status !== 'completed' &&
                Boolean(booking.check_in && booking.check_in >= today)

              return (
                <div
                  key={booking.id}
                  className="grid gap-3 py-5 transition hover:bg-white/50 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <Link href={booking.listings?.id ? `/listings/${booking.listings.id}` : '/stays'}>
                      <p className="font-bold text-stone-950">{booking.listings?.title || 'Stay'}</p>
                      <p className="mt-1 text-sm text-stone-600">{booking.listings?.area || 'Jerusalem'}</p>
                      <p className="mt-2 text-sm font-medium text-stone-700">
                        {formatDateDisplay(booking.check_in)} to {formatDateDisplay(booking.check_out)}
                      </p>
                      {booking.check_in && booking.check_out && (
                        <span className="text-xs text-stone-500">
                          {Math.round(
                            (new Date(booking.check_out).getTime() -
                              new Date(booking.check_in).getTime()) /
                              (1000 * 60 * 60 * 24),
                          )} nights
                        </span>
                      )}
                    </Link>
                    <a
                      href={`/api/booking-calendar/${booking.id}`}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#c76f55] transition hover:underline"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Add to calendar
                    </a>
                    {status === 'confirmed' && sched && sched.accepts_direct && Boolean(sched.instructions || sched.payout_details) && (
                      <DirectPaymentScheduleSummary
                        instructions={sched.instructions}
                        checkIn={booking.check_in}
                        payout={parsePayout(sched.payout_details)}
                      />
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}>
                      {badge.label}
                    </span>
                    {bookingPayment?.balance_status === 'due' &&
                      Number(bookingPayment.balance_amount) > 0 &&
                      status !== 'cancelled' &&
                      status !== 'completed' && (
                      <div className="flex flex-col items-start gap-1 md:items-end">
                        <p className="text-xs text-stone-600">
                          Balance {formatMoney(bookingPayment.currency, bookingPayment.balance_amount)} due by{' '}
                          {formatDateDisplay(bookingPayment.balance_due_date)}
                        </p>
                        <PayBalanceButton
                          bookingPaymentId={bookingPayment.id}
                          label={`Pay balance ${formatMoney(bookingPayment.currency, bookingPayment.balance_amount)}`}
                        />
                      </div>
                    )}
                    {bookingPayment?.balance_status === 'paid' && (
                      <p className="text-xs font-semibold text-green-700">Paid in full</p>
                    )}
                    {isCancellable && <CancelBookingButton bookingId={booking.id} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function formatMoney(currency: string | null, amount: number | null) {
  const value = Number(amount || 0)
  const symbol = currency === 'USD' ? '$' : currency === 'ILS' ? '₪' : ''
  return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function EmptyState() {
  return (
    <div className="rounded-lg bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
        <CalendarDays className="h-8 w-8 text-stone-400" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-stone-900">No trips yet</h2>
      <p className="mb-6 text-stone-600">When you book a stay, it will appear here.</p>
      <Link
        href="/stays"
        className="inline-flex rounded-full bg-[#252525] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#111111]"
      >
        Start exploring
      </Link>
    </div>
  )
}
