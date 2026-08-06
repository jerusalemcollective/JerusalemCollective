'use client'

import { FormEvent, useState, type ReactNode } from 'react'

type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

const inputClass =
  'w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition focus:border-[#c76f55]'

const submitClass =
  'rounded-full bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60'

export function CateringEnquiryForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guestCount, setGuestCount] = useState('1')
  const [occasion, setOccasion] = useState('Shabbat dinner')
  const [kashrut, setKashrut] = useState('Glatt kosher')
  const [dietaryNotes, setDietaryNotes] = useState('')
  const [status, setStatus] = useState<FormStatus>('idle')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('submitting')

    try {
      const response = await fetch('/api/service-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: 'catering',
          name,
          email,
          propertyAddress,
          checkIn,
          checkOut,
          guestCount,
          occasion,
          kashrut,
          dietaryNotes,
        }),
      })

      setStatus(response.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <input required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Email">
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Property address or area">
            <input required value={propertyAddress} onChange={(event) => setPropertyAddress(event.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="Check-in date">
          <input required type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Check-out date">
          <input required type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Number of guests">
          <input required type="number" min={1} value={guestCount} onChange={(event) => setGuestCount(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Occasion">
          <select required value={occasion} onChange={(event) => setOccasion(event.target.value)} className={inputClass}>
            <option>Shabbat dinner</option>
            <option>Weekday meals</option>
            <option>Yom Tov package</option>
            <option>Full week package</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Kashrut level">
          <select required value={kashrut} onChange={(event) => setKashrut(event.target.value)} className={inputClass}>
            <option>Glatt kosher</option>
            <option>Kosher</option>
            <option>Chalav Yisrael</option>
            <option>Not required</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Dietary requirements or notes">
            <textarea value={dietaryNotes} onChange={(event) => setDietaryNotes(event.target.value)} rows={5} className={inputClass} />
          </Field>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button disabled={status === 'submitting'} className={submitClass}>
          {status === 'submitting' ? 'Sending...' : 'Send catering enquiry'}
        </button>
        {status === 'success' && (
          <p className="text-sm font-semibold text-green-700">Thank you — we will be in touch within 24 hours to confirm your order.</p>
        )}
        {status === 'error' && (
          <p className="text-sm font-semibold text-red-700">Something went wrong. Please try again.</p>
        )}
      </div>
    </form>
  )
}

export function CleaningEnquiryForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [serviceType, setServiceType] = useState('Guest mid-stay clean')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [dateNeeded, setDateNeeded] = useState('')
  const [propertySize, setPropertySize] = useState('1 bedroom')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<FormStatus>('idle')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('submitting')

    try {
      const response = await fetch('/api/service-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: 'cleaning',
          name,
          email,
          cleaningService: serviceType,
          propertyAddress,
          dateNeeded,
          propertySize,
          notes,
        }),
      })

      setStatus(response.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <input required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Email">
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Type of service">
          <select required value={serviceType} onChange={(event) => setServiceType(event.target.value)} className={inputClass}>
            <option>Guest mid-stay clean</option>
            <option>Host turnaround clean</option>
          </select>
        </Field>
        <Field label="Property address">
          <input required value={propertyAddress} onChange={(event) => setPropertyAddress(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Date needed">
          <input required type="date" value={dateNeeded} onChange={(event) => setDateNeeded(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Property size">
          <select required value={propertySize} onChange={(event) => setPropertySize(event.target.value)} className={inputClass}>
            <option>Studio</option>
            <option>1 bedroom</option>
            <option>2 bedrooms</option>
            <option>3 bedrooms</option>
            <option>4+ bedrooms</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Special instructions">
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} className={inputClass} />
          </Field>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button disabled={status === 'submitting'} className={submitClass}>
          {status === 'submitting' ? 'Sending...' : 'Send cleaning enquiry'}
        </button>
        {status === 'success' && (
          <p className="text-sm font-semibold text-green-700">Thank you — we will confirm your booking within a few hours.</p>
        )}
        {status === 'error' && (
          <p className="text-sm font-semibold text-red-700">Something went wrong. Please try again.</p>
        )}
      </div>
    </form>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-stone-500">{label}</span>
      {children}
    </label>
  )
}
