'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/status-badge'

export type SupportBooking = {
  id: string
  listing_id: string
  host_id: string | null
  check_in: string
  check_out: string
  listings?: {
    title: string
  } | null
}

export type AccountSupportCase = {
  id: string
  case_type: string
  status: string
  reason: string
  requested_amount: number | null
  approved_refund_amount: number
  currency: string | null
  created_at: string
  listings?: {
    title: string
  } | null
}

type SupportCaseClientFormProps = {
  userId: string
  initialBookings: SupportBooking[]
  initialCases: AccountSupportCase[]
}

export function SupportCaseClientForm({
  userId,
  initialBookings,
  initialCases,
}: SupportCaseClientFormProps) {
  const [bookings] = useState(initialBookings)
  const [cases, setCases] = useState(initialCases)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedBookingId, setSelectedBookingId] = useState('')
  const [caseType, setCaseType] = useState('refund_request')
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [requestedAmount, setRequestedAmount] = useState('')
  const [currency, setCurrency] = useState('ILS')

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId),
    [bookings, selectedBookingId],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!reason.trim() || !selectedBooking) {
      setMessage('Please choose a booking and add a short reason.')
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('support_cases')
        .insert({
          booking_id: selectedBooking.id,
          listing_id: selectedBooking.listing_id,
          guest_id: userId,
          host_id: selectedBooking.host_id,
          created_by: userId,
          case_type: caseType,
          reason: reason.trim(),
          details: details.trim() || null,
          requested_amount: requestedAmount ? Number(requestedAmount) : null,
          currency: requestedAmount ? currency : null,
        })
        .select('id, case_type, status, reason, requested_amount, approved_refund_amount, currency, created_at, listings(title)')
        .single()

      if (error) {
        setMessage(error.message)
        return
      }

      setCases((current) => [data as AccountSupportCase, ...current])
      setSelectedBookingId('')
      setReason('')
      setDetails('')
      setRequestedAmount('')
      setCurrency('ILS')
      setMessage('Your case has been sent to JLM Collective.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-stone-950">Open a case</h2>

        <label className="mt-5 block text-sm font-semibold text-stone-700">
          Booking
          <select
            value={selectedBookingId}
            onChange={(event) => setSelectedBookingId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900"
          >
            <option value="">Choose a booking</option>
            {bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.listings?.title || 'Stay'} ({booking.check_in} to {booking.check_out})
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-sm font-semibold text-stone-700">
          Type
          <select
            value={caseType}
            onChange={(event) => setCaseType(event.target.value)}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900"
          >
            <option value="refund_request">Refund request</option>
            <option value="dispute">Dispute</option>
            <option value="damage">Damage</option>
            <option value="cancellation">Cancellation</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="mt-4 block text-sm font-semibold text-stone-700">
          Short reason
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-stone-700">
          Details
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900"
          />
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
          <label className="block text-sm font-semibold text-stone-700">
            Requested refund
            <input
              value={requestedAmount}
              onChange={(event) => setRequestedAmount(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900"
            />
          </label>
          <label className="block text-sm font-semibold text-stone-700">
            Currency
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900"
            >
              <option value="ILS">ILS</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>

        {message && <p className="mt-4 text-sm text-stone-600">{message}</p>}

        <button
          type="submit"
          disabled={isSubmitting || bookings.length === 0}
          className="mt-5 rounded-full bg-[#252525] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Sending...' : 'Send case'}
        </button>

        {bookings.length === 0 && (
          <p className="mt-3 text-sm text-stone-500">
            You can open a case once you have a booking.
          </p>
        )}
      </form>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="border-b border-stone-100 px-6 py-4">
          <h2 className="text-xl font-bold text-stone-950">Your cases</h2>
        </div>
        <div className="divide-y divide-stone-100">
          {cases.map((supportCase) => (
            <article key={supportCase.id} className="px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={supportCase.status} scheme="support" />
                <span className="text-xs font-bold uppercase tracking-widest text-stone-400">
                  {supportCase.case_type.replaceAll('_', ' ')}
                </span>
              </div>
              <h3 className="mt-3 font-bold text-stone-950">{supportCase.reason}</h3>
              <p className="mt-1 text-sm text-stone-500">
                {supportCase.listings?.title || 'Stay'} | opened{' '}
                {new Date(supportCase.created_at).toLocaleDateString('en-GB')}
              </p>
            </article>
          ))}
          {cases.length === 0 && (
            <div className="px-6 py-10 text-center text-stone-500">No cases yet.</div>
          )}
        </div>
      </section>
    </div>
  )
}
