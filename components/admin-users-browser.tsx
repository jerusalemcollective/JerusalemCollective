'use client'

import { useState } from 'react'
import Link from 'next/link'

export type AdminUserRow = {
  user_id: string
  email: string | null
  full_name: string | null
  phone: string | null
  isHost: boolean
  isGuest: boolean
  isAdmin: boolean
  admin_role: string | null
  booking_count: number
  saved_count: number
}

const PAGE_SIZE = 25

const ROLE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'host', label: 'Hosts' },
  { key: 'guest', label: 'Guests' },
  { key: 'admin', label: 'Admins' },
]

// Client-side name/email search + role filter + pagination over the full people
// list, so typing and switching are instant (no server round-trip per keystroke).
export function AdminUsersBrowser({ people }: { people: AdminUserRow[] }) {
  const [role, setRole] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const q = query.trim().toLowerCase()
  const filtered = people.filter((person) => {
    const roleOk =
      role === 'all' ||
      (role === 'host' && person.isHost) ||
      (role === 'guest' && person.isGuest) ||
      (role === 'admin' && person.isAdmin)
    if (!roleOk) return false
    if (!q) return true
    return (
      (person.full_name || '').toLowerCase().includes(q) ||
      (person.email || '').toLowerCase().includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <>
      <div className="mb-4">
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(1)
          }}
          placeholder="Search by name or email"
          className="w-full max-w-sm rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
          aria-label="Search users by name or email"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {ROLE_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => {
              setRole(filter.key)
              setPage(1)
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              role === filter.key
                ? 'bg-stone-950 text-white'
                : 'border border-stone-200 bg-white text-stone-700 hover:border-[#c76f55] hover:text-[#c76f55]'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden border-y border-stone-200">
        <div className="grid gap-4 border-b border-stone-200 py-4 text-xs font-bold uppercase tracking-widest text-stone-500 md:grid-cols-[1.1fr_1fr_0.8fr_0.9fr_0.5fr_0.5fr]">
          <span>Name</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Roles</span>
          <span>Trips</span>
          <span>Saves</span>
        </div>

        {paged.length === 0 ? (
          <div className="py-12 text-center text-stone-500">No users match.</div>
        ) : (
          <div className="divide-y divide-stone-200">
            {paged.map((person) => (
              <Link
                key={person.user_id}
                href={`/admin/users/${person.user_id}`}
                className="grid gap-4 py-5 transition hover:bg-stone-50 md:grid-cols-[1.1fr_1fr_0.8fr_0.9fr_0.5fr_0.5fr] md:items-center"
              >
                <p className="font-bold text-stone-950">{person.full_name || 'Unnamed user'}</p>
                <p className="truncate text-sm text-stone-700">{person.email || 'No email'}</p>
                <p className="text-sm text-stone-700">{person.phone || 'No phone'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {person.isHost && <RolePill label="Host" />}
                  {person.isGuest && <RolePill label="Guest" muted />}
                  {person.isAdmin && <RolePill label="Admin" accent />}
                </div>
                <p className="text-sm text-stone-700">{person.booking_count}</p>
                <p className="text-sm text-stone-700">{person.saved_count}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-stone-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
            className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </>
  )
}

function RolePill({ label, muted = false, accent = false }: { label: string; muted?: boolean; accent?: boolean }) {
  const tone = accent
    ? 'bg-[#c76f55]/15 text-[#9d513b]'
    : muted
      ? 'bg-stone-200 text-stone-700'
      : 'bg-stone-950 text-white'
  return (
    <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${tone}`}>{label}</span>
  )
}
