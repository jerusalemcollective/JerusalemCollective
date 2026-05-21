'use client'

import { useActionState } from 'react'
import { updateBookingPayment } from '@/app/host/dashboard/payments/actions'

type PaymentUpdateFormProps = {
  bookingId: string
  currentStatus: string
  currentNotes: string | null
}

const initialState = {
  status: '',
  message: '',
}

export function PaymentUpdateForm({
  bookingId,
  currentStatus,
  currentNotes,
}: PaymentUpdateFormProps) {
  const [state, formAction, pending] = useActionState(updateBookingPayment, initialState)

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="block text-xs font-semibold text-stone-600">
          Status
          <select
            name="paymentStatus"
            defaultValue={currentStatus}
            className="mt-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
          >
            <option value="unpaid">Unpaid</option>
            <option value="deposit_received">Deposit received</option>
            <option value="paid_in_full">Paid in full</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label className="block flex-1 text-xs font-semibold text-stone-600">
          Notes
          <input
            name="paymentNotes"
            type="text"
            defaultValue={currentNotes || ''}
            placeholder="e.g. Bank transfer received 15 May"
            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#252525] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#111111] disabled:opacity-60"
        >
          {pending ? 'Saving...' : 'Save'}
        </button>
      </div>
      {state.message && (
        <p className={`text-xs ${state.status === 'success' ? 'text-green-700' : 'text-rose-600'}`}>
          {state.message}
        </p>
      )}
    </form>
  )
}
