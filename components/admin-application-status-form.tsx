'use client'

import { useActionState } from 'react'
import {
  updateApplicationStatusWithFeedback,
  type ApplicationStatusState,
} from '@/app/admin/actions'

const initialState: ApplicationStatusState = {
  status: 'idle',
  message: '',
}

export function AdminApplicationStatusForm({
  applicationId,
  status,
  label,
  tone,
}: {
  applicationId: string
  status: 'in_review' | 'rejected'
  label: string
  tone: 'neutral' | 'danger'
}) {
  const [state, formAction, pending] = useActionState(
    updateApplicationStatusWithFeedback,
    initialState,
  )

  const buttonClass =
    tone === 'danger'
      ? 'border-red-200 text-red-700 hover:bg-red-50'
      : 'border-stone-200 text-stone-700 hover:border-stone-300'

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="status" value={status} />
      <button
        disabled={pending}
        className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${buttonClass}`}
      >
        {pending ? 'Updating...' : label}
      </button>
      {state.message && (
        <p
          className={`rounded-2xl px-3 py-2 text-sm ${
            state.status === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}
