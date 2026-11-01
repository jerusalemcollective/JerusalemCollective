import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPermission } from '@/lib/admin'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { oneOrNull } from '@/lib/utils/one-or-null'
import {
  bookingGuestName,
  bookingNights,
  bookingStatusLabel,
  bookingTotal,
  enquiryOutcomeLabel,
  formatDateRange,
  formatGuestCount,
  formatMoney,
  formatNights,
  formatStayDate,
  jerusalemToday,
  paymentMethodLabel,
  paymentStatusLabel,
} from '@/lib/booking-display'
import { BookingBadge } from '../booking-badge'

type BookingRecord = {
  id: string
  user_id: string | null
  listing_id: string | null
  host_id: string | null
  check_in: string | null
  check_out: string | null
  guests: number | null
  status: string | null
  payment_status: string | null
  payment_notes: string | null
  payment_updated_at: string | null
  total_amount_usd: number | null
  total_amount_ils: number | null
  deposit_amount_usd: number | null
  deposit_amount_ils: number | null
  commission_percent: number | null
  commission_amount_usd: number | null
  commission_amount_ils: number | null
  host_payout_usd: number | null
  host_payout_ils: number | null
  created_at: string | null
  updated_at: string | null
  listings: { id: string; title: string | null; area: string | null } | null
  hosts: { id: string; name: string | null; email: string | null; user_id: string | null } | null
}

type BookingQueryRow = Omit<BookingRecord, 'listings' | 'hosts'> & {
  listings?: BookingRecord['listings'] | NonNullable<BookingRecord['listings']>[] | null
  hosts?: BookingRecord['hosts'] | NonNullable<BookingRecord['hosts']>[] | null
}

type PaymentRow = {
  id: string
  payment_mode: string | null
  payment_method: string | null
  currency: string | null
  amount: number | null
  platform_fee_amount: number | null
  processor_fee_amount: number | null
  host_payout_amount: number | null
  host_payout_currency: string | null
  status: string | null
  payout_status: string | null
  paid_at: string | null
  balance_amount: number | null
  balance_due_date: string | null
  balance_status: string | null
  balance_paid_at: string | null
  refunded_at: string | null
  needs_manual_review: boolean | null
  manual_review_reason: string | null
  created_at: string | null
}

type RequestRow = {
  id: string
  status: string | null
  guests: number | null
  message: string | null
  conversation_id: string | null
  created_at: string | null
  updated_at: string | null
}

type PersonRow = { user_id: string; email: string | null; full_name: string | null; phone: string | null }

type MessageRow = { id: string; sender_id: string | null; content: string; created_at: string }

function formatDateTime(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  })
}

function humanize(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback
  const text = value.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireAdminPermission('guests')

  const { data: bookingData, error: bookingError } = await supabase
    .from('bookings')
    .select('*, listings(id, title, area), hosts(id, name, email, user_id)')
    .eq('id', id)
    .maybeSingle()

  if (bookingError && bookingError.code !== '22P02') throw bookingError
  if (!bookingData) notFound()

  const raw = bookingData as BookingQueryRow
  const booking: BookingRecord = { ...raw, listings: oneOrNull(raw.listings), hosts: oneOrNull(raw.hosts) }
  const hostUserId = booking.hosts?.user_id || booking.hosts?.id || null

  const [{ data: paymentData }, { data: requestData }, { data: peopleData }] = await Promise.all([
    supabase
      .from('booking_payments')
      .select(
        'id, payment_mode, payment_method, currency, amount, platform_fee_amount, processor_fee_amount, host_payout_amount, host_payout_currency, status, payout_status, paid_at, balance_amount, balance_due_date, balance_status, balance_paid_at, refunded_at, needs_manual_review, manual_review_reason, created_at',
      )
      .eq('booking_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('booking_requests')
      .select('id, status, guests, message, conversation_id, created_at, updated_at')
      .eq('booking_id', id)
      .order('created_at', { ascending: true })
      .limit(1),
    // Email lives in auth.users, so read guest/host contact details through the
    // admin-gated definer function (it requires the same 'guests' permission).
    supabase.rpc('list_platform_people'),
  ])

  const payments = (paymentData || []) as PaymentRow[]
  const payment = payments.find((row) => row.status === 'paid') || payments[0] || null
  const request = ((requestData || []) as RequestRow[])[0] || null
  const people = (peopleData || []) as PersonRow[]
  let guestPerson = booking.user_id ? people.find((row) => row.user_id === booking.user_id) || null : null
  const hostPerson = hostUserId ? people.find((row) => row.user_id === hostUserId) || null : null

  if (!guestPerson && booking.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', booking.user_id)
      .maybeSingle<{ full_name: string | null; phone: string | null }>()
    if (profile) guestPerson = { user_id: booking.user_id, email: null, ...profile }
  }

  // Guest-host conversation. conversations/messages are RLS-scoped to the two
  // participants, so (like the admin listing page) read them with the service
  // role; this page is admin-gated above.
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const svc = serviceUrl && serviceKey ? createServiceRoleClient(serviceUrl, serviceKey) : null
  let conversationId: string | null = request?.conversation_id || null
  let messages: MessageRow[] = []
  if (svc) {
    if (!conversationId && booking.user_id && booking.listing_id) {
      const { data: convo } = await svc
        .from('conversations')
        .select('id')
        .eq('participant_1', booking.user_id)
        .eq('listing_id', booking.listing_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>()
      conversationId = convo?.id || null
    }
    if (conversationId) {
      const { data: messageData } = await svc
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200)
      messages = (messageData || []) as MessageRow[]
    }
  }

  const today = jerusalemToday()
  const nights = bookingNights(booking.check_in, booking.check_out)
  const guestName = bookingGuestName({ full_name: guestPerson?.full_name, email: guestPerson?.email })
  const hostName = booking.hosts?.name || hostPerson?.full_name || 'Host'
  const status = bookingStatusLabel(booking, today)

  const currency = payment?.currency?.toUpperCase() === 'ILS' ? 'ILS' : payment?.currency ? 'USD' : null
  const total = bookingTotal(booking, currency)
  const pick = (usd: number | null, ils: number | null) =>
    total?.currency === 'ILS' ? ils : total?.currency === 'USD' ? usd : usd ?? ils
  const money = (value: number | null) => (value === null || value === undefined ? '—' : formatMoney(value, total?.currency || 'USD'))
  const nightlyRate = total && nights > 0 ? total.amount / nights : null

  const senderName = (senderId: string | null) => {
    if (!senderId) return 'System'
    if (senderId === booking.user_id) return guestName
    if (senderId === hostUserId || senderId === booking.host_id) return hostName
    return 'JLM Collective'
  }

  const timeline: { label: string; at: string | null; note?: string }[] = []
  if (request) {
    timeline.push({ label: 'Requested', at: request.created_at, note: 'Guest sent an enquiry' })
    timeline.push({ label: 'Accepted', at: booking.created_at, note: 'Host accepted; booking created' })
  } else {
    timeline.push({ label: 'Booked', at: booking.created_at, note: 'Booked directly (no enquiry)' })
  }
  if (payment?.paid_at) {
    timeline.push({
      label: payment.balance_paid_at ? 'Deposit paid' : 'Paid',
      at: payment.paid_at,
      note: paymentMethodLabel(payment.payment_mode),
    })
  }
  if (payment?.balance_paid_at) timeline.push({ label: 'Balance paid', at: payment.balance_paid_at })
  if (!payment && booking.payment_status && booking.payment_status !== 'unpaid' && booking.payment_updated_at) {
    timeline.push({ label: paymentStatusLabel(booking.payment_status).label, at: booking.payment_updated_at, note: 'Recorded by host' })
  }
  if (booking.status === 'cancelled') {
    timeline.push({ label: 'Cancelled', at: booking.updated_at, note: 'Time of the last change to the booking' })
  }
  if (payment?.refunded_at) timeline.push({ label: 'Refunded', at: payment.refunded_at })
  timeline.sort((a, b) => (a.at || '').localeCompare(b.at || ''))

  return (
    <div className="space-y-6">
      <Link href="/admin/bookings" className="inline-flex text-sm font-semibold text-[#c76f55] hover:underline">
        ← Back to bookings
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl">
            {booking.listings?.title || 'Listing removed'}
          </h2>
          <BookingBadge {...status} />
        </div>
        <p className="mt-1 text-sm text-stone-600">
          {formatDateRange(booking.check_in, booking.check_out)} · {formatNights(nights)} · {formatGuestCount(booking.guests)}
        </p>
        <p className="mt-1 break-all text-xs text-stone-400">Booking {booking.id}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Stay">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Listing">
              {booking.listings ? (
                <Link href={`/admin/listings/${booking.listings.id}`} className="font-semibold text-[#c76f55] hover:underline">
                  {booking.listings.title || 'Untitled listing'}
                </Link>
              ) : (
                'Listing removed'
              )}
              {booking.listings?.area && <span className="block text-xs text-stone-500">{booking.listings.area}</span>}
            </Detail>
            <Detail label="Status">{status.label}</Detail>
            <Detail label="Check-in">{formatStayDate(booking.check_in)}</Detail>
            <Detail label="Check-out">{formatStayDate(booking.check_out)}</Detail>
            <Detail label="Nights">{formatNights(nights)}</Detail>
            <Detail label="Guests">{formatGuestCount(booking.guests)}</Detail>
          </dl>
        </Section>

        <Section title="People">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Guest">
              {booking.user_id ? (
                <Link href={`/admin/users/${booking.user_id}`} className="font-semibold text-[#c76f55] hover:underline">
                  {guestName}
                </Link>
              ) : (
                guestName
              )}
              <ContactLines email={guestPerson?.email} phone={guestPerson?.phone} />
            </Detail>
            <Detail label="Host">
              {hostUserId ? (
                <Link href={`/admin/users/${hostUserId}`} className="font-semibold text-[#c76f55] hover:underline">
                  {hostName}
                </Link>
              ) : (
                hostName
              )}
              <ContactLines email={booking.hosts?.email || hostPerson?.email} phone={hostPerson?.phone} />
            </Detail>
          </dl>
        </Section>

        <Section title="Price">
          <dl className="space-y-2 text-sm">
            <Row label={`Stay total${nightlyRate ? ` (${formatNights(nights)} × ${money(Math.round(nightlyRate * 100) / 100)})` : ''}`}>
              {total ? formatMoney(total.amount, total.currency) : 'Not priced'}
            </Row>
            <Row label="Deposit">{money(pick(booking.deposit_amount_usd, booking.deposit_amount_ils))}</Row>
            <Row label={`JLM commission (${Number(booking.commission_percent || 0)}%)`}>
              {money(pick(booking.commission_amount_usd, booking.commission_amount_ils))}
            </Row>
            <Row label="Host payout" strong>
              {money(pick(booking.host_payout_usd, booking.host_payout_ils))}
            </Row>
          </dl>
          {booking.total_amount_usd != null && booking.total_amount_ils != null && (
            <p className="mt-3 text-xs text-stone-500">
              Recorded in both currencies: {formatMoney(booking.total_amount_usd, 'USD')} / {formatMoney(booking.total_amount_ils, 'ILS')}.
            </p>
          )}
        </Section>

        <Section title="Payment">
          <dl className="space-y-2 text-sm">
            <Row label="Payment status">
              <BookingBadge {...paymentStatusLabel(booking.payment_status)} />
            </Row>
            <Row label="Method">{paymentMethodLabel(payment?.payment_mode)}</Row>
            {payment && (
              <>
                <Row label="JLM payment">{humanize(payment.status)}</Row>
                <Row label={payment.balance_amount ? 'Deposit charged' : 'Amount charged'}>
                  {formatMoney(payment.amount, payment.currency)}
                </Row>
                {payment.balance_amount ? (
                  <Row label={`Balance${payment.balance_due_date ? ` (due ${formatStayDate(payment.balance_due_date)})` : ''}`}>
                    {formatMoney(payment.balance_amount, payment.currency)} · {humanize(payment.balance_status, 'Not due yet')}
                  </Row>
                ) : null}
                <Row label="JLM fee">{formatMoney(payment.platform_fee_amount, payment.currency)}</Row>
                {Number(payment.processor_fee_amount || 0) > 0 && (
                  <Row label="Card processing fee">{formatMoney(payment.processor_fee_amount, payment.currency)}</Row>
                )}
                <Row label="Host payout">
                  {formatMoney(payment.host_payout_amount, payment.host_payout_currency || payment.currency)} ·{' '}
                  {humanize(payment.payout_status)}
                </Row>
              </>
            )}
          </dl>
          {payment?.needs_manual_review && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Needs manual review{payment.manual_review_reason ? `: ${payment.manual_review_reason}` : ''}
            </p>
          )}
          {booking.payment_notes && (
            <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-700">Host note: {booking.payment_notes}</p>
          )}
          {payments.length > 1 && (
            <p className="mt-3 text-xs text-stone-500">{payments.length} payment attempts recorded; showing the latest successful one.</p>
          )}
        </Section>
      </div>

      <Section title="Timeline">
        <ol className="space-y-3">
          {timeline.map((event, index) => (
            <li key={`${event.label}-${index}`} className="flex gap-3">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#c76f55]" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-stone-900">{event.label}</p>
                <p className="text-xs text-stone-500">
                  {formatDateTime(event.at) || 'Time not recorded'}
                  {event.note ? ` · ${event.note}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
        {request && (
          <p className="mt-4 text-xs text-stone-500">
            Enquiry status: {enquiryOutcomeLabel(request.status, null).label}
          </p>
        )}
      </Section>

      <Section title="Conversation">
        {request?.message && (
          <div className="mb-4 rounded-2xl bg-[#fbfaf8] p-4 text-sm text-stone-700">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Enquiry message</p>
            <p className="mt-1 whitespace-pre-line">{request.message}</p>
          </div>
        )}
        {!svc ? (
          <p className="text-sm text-stone-500">Messages can’t be shown: the service role key isn’t configured.</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-stone-500">{conversationId ? 'No messages in this conversation yet.' : 'No conversation linked to this booking.'}</p>
        ) : (
          <ol className="space-y-3">
            {messages.map((message) => (
              <li key={message.id} className="rounded-2xl border border-stone-100 p-3">
                <p className="text-xs text-stone-500">
                  <span className="font-semibold text-stone-800">{senderName(message.sender_id)}</span> ·{' '}
                  {formatDateTime(message.created_at)}
                </p>
                <p className="mt-1 whitespace-pre-line break-words text-sm text-stone-800">{message.content}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <h3 className="mb-4 text-lg font-bold text-stone-950">{title}</h3>
      {children}
    </section>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-widest text-stone-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-stone-900">{children}</dd>
    </div>
  )
}

function Row({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-stone-600">{label}</dt>
      <dd className={`text-right ${strong ? 'font-bold text-stone-950' : 'font-semibold text-stone-900'}`}>{children}</dd>
    </div>
  )
}

function ContactLines({ email, phone }: { email?: string | null; phone?: string | null }) {
  return (
    <span className="mt-1 block space-y-0.5 text-xs text-stone-600">
      {email ? (
        <a href={`mailto:${email}`} className="block break-all hover:underline">
          {email}
        </a>
      ) : (
        <span className="block text-stone-400">No email</span>
      )}
      {phone ? (
        <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="block hover:underline">
          {phone}
        </a>
      ) : (
        <span className="block text-stone-400">No phone</span>
      )}
    </span>
  )
}
