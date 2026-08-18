'use client'

import { useActionState } from 'react'
import { updateSupportCase, type SupportCaseState } from '@/app/admin/case-actions'

type SupportCaseFormProps = {
  supportCase: {
    id: string
    status: string
    approved_refund_amount: number
    resolution_notes: string | null
  }
}

const initialState: SupportCaseState = {
  status: 'idle',
  message: '',
}

export function SupportCaseForm({ supportCase }: SupportCaseFormProps) {
  const [state, formAction, pending] = useActionState(updateSupportCase, initialState)

  return (
    <form action={formAction} className="w-full max-w-sm rounded-2xl bg-[#F8F5F2] p-4 lg:w-[340px]">
      <input type="hidden" name="caseId" value={supportCase.id} />

      <label className="block text-sm font-semibold text-stone-700">
        Status
        <select
          name="status"
          defaultValue={supportCase.status}
          className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
        >
          <option value="open">Open</option>
          <option value="under_review">Under review</option>
          <option value="waiting_on_guest">Waiting on guest</option>
          <option value="waiting_on_host">Waiting on host</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </label>

      <label className="mt-4 block text-sm font-semibold text-stone-700">
        Approved refund amount
        <input
          type="number"
          min="0"
          step="0.01"
          name="approvedRefundAmount"
          defaultValue={supportCase.approved_refund_amount || 0}
          className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
        />
      </label>

      <label className="mt-4 block text-sm font-semibold text-stone-700">
        Resolution notes
        <textarea
          name="resolutionNotes"
          rows={4}
          defaultValue={supportCase.resolution_notes || ''}
          className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
          placeholder="What was agreed, promised, or paid?"
        />
      </label>

      {state.message && (
        <p className={`mt-3 text-sm ${state.status === 'success' ? 'text-green-700' : 'text-rose-700'}`}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-full bg-[#252525] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Saving...' : 'Save report'}
      </button>
    </form>
  )
}
