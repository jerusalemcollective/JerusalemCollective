'use client'

import { useActionState } from 'react'
import { grantAdminByEmail, type AdminGrantState } from '@/app/admin/admin-actions'

const initialState: AdminGrantState = {
  status: 'idle',
  message: '',
}

const roles = [
  {
    value: 'operations',
    label: 'Operations',
    detail: 'Applications, listings, hosts, guests, reviews, analytics',
  },
  {
    value: 'support',
    label: 'Support',
    detail: 'Guests, hosts, disputes, reports, and messaging',
  },
  {
    value: 'content',
    label: 'Content',
    detail: 'Applications, listings, reviews, and analytics',
  },
  {
    value: 'analyst',
    label: 'Analyst',
    detail: 'Read-focused access to analytics and people views',
  },
  {
    value: 'owner',
    label: 'Owner',
    detail: 'Full access, including changing admin roles',
  },
  {
    value: 'none',
    label: 'Remove admin',
    detail: 'Remove admin access from this user',
  },
]

export function AdminAddAdminForm() {
  const [state, formAction, pending] = useActionState(grantAdminByEmail, initialState)

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <input
          type="email"
          name="email"
          required
          placeholder="person@example.com"
          className="h-12 rounded-2xl border border-stone-200 px-4 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
        />
        <select
          name="role"
          defaultValue="operations"
          className="h-12 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-900 outline-none transition focus:border-[#c76f55]"
        >
          {roles.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <button
          disabled={pending}
          className="h-12 rounded-2xl bg-[#252525] px-5 text-sm font-bold text-white transition hover:bg-[#111111] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Saving...' : 'Save role'}
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {roles.slice(0, 5).map((role) => (
          <div key={role.value} className="rounded-2xl border border-stone-200 px-4 py-3">
            <p className="text-sm font-bold text-stone-950">{role.label}</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">{role.detail}</p>
          </div>
        ))}
      </div>

      {state.message && (
        <p
          className={`text-sm ${
            state.status === 'success' ? 'text-green-700' : 'text-red-600'
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}
