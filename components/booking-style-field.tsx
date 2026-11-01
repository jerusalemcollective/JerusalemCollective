'use client'

import { useState } from 'react'
import Link from 'next/link'

type BookingStyle = 'request' | 'instant' | 'enquiry'

const OPTIONS: Array<{ value: BookingStyle; title: string; description: string }> = [
  {
    value: 'request',
    title: 'Request to book',
    description:
      'Guests send a request for their dates. Nothing is booked until you accept it, and you can decline.',
  },
  {
    value: 'instant',
    title: 'Instant book',
    description:
      'Guests book straight away, with no request to accept. The stay is confirmed and the dates are blocked as soon as they click Book now.',
  },
]

// Host listing editor: how guests book (instant vs request). Payment method — JLM
// card or bank transfer to the host — is a separate choice, set on the Payments
// page.
export function BookingStyleField({ defaultValue }: { defaultValue: string | null }) {
  const initial: BookingStyle =
    defaultValue === 'instant' || defaultValue === 'enquiry' ? defaultValue : 'request'
  const [value, setValue] = useState<BookingStyle>(initial)

  // Legacy listings may still be enquiry-only; keep that choice available for them
  // so saving the form never silently changes it.
  const options =
    initial === 'enquiry'
      ? [
          ...OPTIONS,
          {
            value: 'enquiry' as const,
            title: 'Enquiry only',
            description: 'Guests can only message you. They cannot request dates or book from the listing.',
          },
        ]
      : OPTIONS

  return (
    <fieldset className="mt-5">
      <legend className="text-sm font-semibold text-stone-800">Booking style</legend>
      <p className="mt-1 text-sm leading-6 text-stone-600">
        Choose how guests book this listing. How they pay (by card through JLM or by bank transfer to you)
        is set separately on your{' '}
        <Link href="/host/dashboard/payments" className="font-semibold text-[#c76f55] underline-offset-2 hover:underline">
          Payments page
        </Link>
        .
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
              value === option.value ? 'border-[#c76f55] bg-[#FBF4F1]' : 'border-stone-200 bg-white hover:border-stone-300'
            }`}
          >
            <input
              type="radio"
              name="bookingType"
              value={option.value}
              checked={value === option.value}
              onChange={() => setValue(option.value)}
              className="mt-1"
            />
            <span>
              <span className="block font-bold text-stone-950">{option.title}</span>
              <span className="mt-1 block text-sm leading-6 text-stone-600">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      {value === 'instant' && (
        <p
          role="alert"
          className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
        >
          Guests can book instantly without asking — keep your calendar up to date.
        </p>
      )}
    </fieldset>
  )
}
