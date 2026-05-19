'use client'

import { useActionState } from 'react'
import { requestApplicationChanges, type RequestChangesState } from '@/app/admin/application-actions'

const initialState: RequestChangesState = {
  status: 'idle',
  message: '',
}

export function AdminRequestChangesForm({ applicationId }: { applicationId: string }) {
  const [state, formAction] = useActionState(requestApplicationChanges, initialState)

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div>
        <p className="text-sm font-bold text-stone-950">Message host / request changes</p>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          Use this for submitted stays that are not live yet. The host will see it as a message from JLM Collective and can edit the stay.
        </p>
      </div>
      <textarea
        name="feedback"
        required
        rows={5}
        placeholder="Tell the host exactly what needs fixing..."
        className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#c76f55]"
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
