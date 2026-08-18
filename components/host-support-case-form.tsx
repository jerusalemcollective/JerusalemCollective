'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export type HostCaseBooking = {
  id: string
  check_in: string
  check_out: string
  title: string
}

const CASE_TYPES = [
  { value: 'damage', label: 'Damage' },
  { value: 'broke_house_rules', label: 'Broke house rules' },
  { value: 'didnt_pay', label: "Didn't pay" },
  { value: 'no_show', label: 'No-show' },
  { value: 'other', label: 'Other' },
] as const

// Case types where a money amount is relevant (repair cost / amount owed).
const AMOUNT_TYPES = new Set(['damage', 'didnt_pay'])

const inputClass = 'mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-900'

export function HostSupportCaseForm({ userId, bookings }: { userId: string; bookings: HostCaseBooking[] }) {
  const [bookingId, setBookingId] = useState('')
  const [caseType, setCaseType] = useState<string>('damage')
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('ILS')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const isDamage = caseType === 'damage'
  const showAmount = AMOUNT_TYPES.has(caseType)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    if (!bookingId) {
      setMessage('Please choose the stay this is about.')
      return
    }
    if (!reason.trim()) {
      setMessage('Please add a short reason.')
      return
    }
    if (isDamage && files.length === 0) {
      setMessage('Damage reports need at least one photo.')
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()

      // Upload any evidence photos to the private case-photos bucket first.
      const attachmentPaths: string[] = []
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
        const path = `${userId}/${bookingId}/${Date.now()}-${index}.${extension}`
        const { error: uploadError } = await supabase.storage.from('case-photos').upload(path, file)
        if (uploadError) {
          setMessage(`Could not upload ${file.name}: ${uploadError.message}`)
          setIsSubmitting(false)
          return
        }
        attachmentPaths.push(path)
      }

      const { error: rpcError } = await supabase.rpc('create_host_support_case', {
        target_booking_id: bookingId,
        case_type_input: caseType,
        reason_input: reason.trim(),
        details_input: details.trim(),
        requested_amount_input: showAmount && amount ? Number(amount) : null,
        currency_input: showAmount && amount ? currency : null,
        attachment_urls_input: attachmentPaths,
      })

      if (rpcError) {
        setMessage(rpcError.message)
        setIsSubmitting(false)
        return
      }

      setSubmitted(true)
      setMessage('Your report has been sent to JLM Collective.')
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-3xl bg-[#fff4ef] p-6">
        <p className="font-bold text-stone-950">Report submitted</p>
        <p className="mt-2 text-sm text-stone-600">
          JLM Collective will review it and follow up. You can track it in the list below.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false)
            setBookingId('')
            setCaseType('damage')
            setReason('')
            setDetails('')
            setAmount('')
            setFiles([])
            setMessage(null)
          }}
          className="mt-4 inline-flex rounded-full bg-[#252525] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#111111]"
        >
          Report another issue
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-stone-950">Report an issue</h2>

      <label className="mt-5 block text-sm font-semibold text-stone-700">
        Stay
        <select value={bookingId} onChange={(event) => setBookingId(event.target.value)} className={inputClass}>
          <option value="">Choose a stay</option>
          {bookings.map((booking) => (
            <option key={booking.id} value={booking.id}>
              {booking.title} ({booking.check_in} to {booking.check_out})
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-sm font-semibold text-stone-700">
        Type
        <select value={caseType} onChange={(event) => setCaseType(event.target.value)} className={inputClass}>
          {CASE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-sm font-semibold text-stone-700">
        Short reason
        <input value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} />
      </label>

      <label className="mt-4 block text-sm font-semibold text-stone-700">
        Details
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={5} className={inputClass} />
      </label>

      {isDamage && (
        <label className="mt-4 block text-sm font-semibold text-stone-700">
          Photos of the damage (required)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
            className="mt-2 block w-full text-sm text-stone-700 file:mr-3 file:rounded-full file:border-0 file:bg-[#fff4ef] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#c76f55]"
          />
          {files.length > 0 && (
            <span className="mt-1 block text-xs font-normal text-stone-500">
              {files.length} {files.length === 1 ? 'photo' : 'photos'} selected
            </span>
          )}
        </label>
      )}

      {showAmount && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
          <label className="block text-sm font-semibold text-stone-700">
            {isDamage ? 'Estimated cost (optional)' : 'Amount owed (optional)'}
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-semibold text-stone-700">
            Currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value)} className={inputClass}>
              <option value="ILS">ILS</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>
      )}

      {message && <p className="mt-4 text-sm text-stone-600">{message}</p>}

      <button
        type="submit"
        disabled={isSubmitting || bookings.length === 0}
        className="mt-5 rounded-full bg-[#252525] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Sending…' : 'Send report'}
      </button>

      {bookings.length === 0 && (
        <p className="mt-3 text-sm text-stone-500">You can report an issue once you have a booking.</p>
      )}
    </form>
  )
}
