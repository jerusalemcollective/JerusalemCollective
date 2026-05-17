'use client'

import { useActionState } from 'react'
import { grantAdminByEmail, type AdminGrantState } from '@/app/admin/actions'

const initialState: AdminGrantState = {
  status: 'idle',
  message: '',
}

export function AdminAddAdminForm() {
  const [state, formAction, pending] = useActionState(grantAdminByEmail, initialState)

  return (
    <form action={formAction} className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          name="email"
          required
          placeholder="person@example.com"
          className="h-12 flex-1 rounded-2xl border border-stone-200 px-4 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
        />
        <button
          disabled={pending}
          className="h-12 rounded-2xl bg-[#252525] px-5 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Adding...' : 'Add admin'}
        </button>
      </div>

      {state.message && (
        <p
          className={`mt-3 text-sm ${
            state.status === 'success' ? 'text-green-700' : 'text-red-600'
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}
