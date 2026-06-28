'use client'

import { useActionState } from 'react'
import { sendListingMessage, type ListingMessageState } from '@/app/admin/listing-actions'

const initialState: ListingMessageState = {
  status: 'idle',
  message: '',
}

export function AdminListingMessageForm({ listingId }: { listingId: string }) {
  const [state, formAction] = useActionState(sendListingMessage, initialState)

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <p className="text-xs leading-5 text-stone-500">
        This will appear to the host as a message from JLM Collective.
      </p>
      <textarea
        name="message"
        required
        rows={5}
        placeholder="Tell the host what needs fixing on this listing..."
        className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]"
      />
      {state.message && (
        <div
          className={`rounded-2xl p-3 text-sm ${
            state.status === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {state.message}
        </div>
      )}
      <button className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100">
        Send as JLM Collective
      </button>
    </form>
  )
}
