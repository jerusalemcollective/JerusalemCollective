'use client'

import { useState, type FormEvent } from 'react'
import { blockDateRange } from '@/app/host/dashboard/calendar/actions'

type BlockRangeFormProps = {
  listingId: string
  listings?: Array<{
    id: string
    title: string
  }>
  onBlocked?: () => void
}

export function BlockRangeForm({ listingId, listings = [], onBlocked }: BlockRangeFormProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [selectedListingId, setSelectedListingId] = useState(listingId)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isBlocking, setIsBlocking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedListingId || !startDate || !endDate) return
    if (endDate < startDate) {
      setMessage('End date must be after start date.')
      setIsError(true)
      return
    }

    setIsBlocking(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.set('listingId', selectedListingId)
      formData.set('startDate', startDate)
      formData.set('endDate', endDate)
      await blockDateRange(formData)
      setMessage('Dates blocked successfully.')
      setIsError(false)
      setStartDate('')
      setEndDate('')
      onBlocked?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not block these dates.')
      setIsError(true)
    } finally {
      setIsBlocking(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-stone-950">Block a date range</h2>
      <p className="mt-1 text-sm text-stone-600">
        Guests will not be able to enquire for these dates.
      </p>
      {listings.length > 1 && (
        <label className="mt-4 block text-sm font-semibold text-stone-700">
          Listing
          <select
            value={selectedListingId}
            onChange={(event) => setSelectedListingId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
          >
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-stone-700">
          From
          <input
            type="date"
            value={startDate}
            min={today}
            required
            onChange={(event) => setStartDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
          />
        </label>
        <label className="block text-sm font-semibold text-stone-700">
          To
          <input
            type="date"
            value={endDate}
            min={startDate || today}
            required
            onChange={(event) => setEndDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
          />
        </label>
      </div>
      {message && (
        <p className={`mt-3 text-sm ${isError ? 'text-rose-600' : 'text-green-700'}`}>
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={isBlocking || !selectedListingId || !startDate || !endDate}
        className="mt-4 w-full rounded-full bg-[#252525] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBlocking ? 'Blocking...' : 'Block these dates'}
      </button>
    </form>
  )
}
