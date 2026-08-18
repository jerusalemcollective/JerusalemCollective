'use client'

import { useState } from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/components/status-badge'

export type AdminApplicationRow = {
  id: string
  host_name: string
  apartment_title: string
  area: string
  status: string
  created_at: string
}

const PAGE_SIZE = 25
const OPEN_STATUSES = ['new', 'in_review', 'changes_requested']

// "In review" covers both in_review and changes_requested — a change request is
// still mid-review, just waiting on the host.
const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'In review', value: 'in_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
]

function matchesFilter(status: string, filter: string): boolean {
  if (filter === 'all') return OPEN_STATUSES.includes(status)
  if (filter === 'in_review') return status === 'in_review' || status === 'changes_requested'
  return status === filter
}

// Client-side filtering + pagination so switching chips is instant — no server
// round-trip (the previous URL-param chips re-ran auth + queries on every click).
export function AdminApplicationsBrowser({ applications }: { applications: AdminApplicationRow[] }) {
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  const filtered = applications.filter((application) => matchesFilter(application.status, filter))
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setFilter(option.value)
              setPage(1)
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === option.value
                ? 'bg-stone-950 text-white'
                : 'border border-stone-200 bg-white text-stone-700 hover:border-stone-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.7fr] gap-4 border-b border-stone-100 px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-500">
          <span>Application</span>
          <span>Area</span>
          <span>Status</span>
          <span>Submitted</span>
        </div>

        {pageRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-stone-500">No applications.</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {pageRows.map((application) => (
              <Link
                key={application.id}
                href={`/admin/applications/${application.id}`}
                className="grid grid-cols-1 gap-3 px-6 py-5 transition hover:bg-stone-50 md:grid-cols-[1.3fr_1fr_0.8fr_0.7fr] md:items-center"
              >
                <div>
                  <p className="font-bold text-stone-950">{application.apartment_title}</p>
                  <p className="mt-1 text-sm text-stone-500">{application.host_name}</p>
                </div>
                <p className="text-sm text-stone-700">{application.area}</p>
                <div>
                  <StatusBadge status={application.status} scheme="application" />
                </div>
                <p className="text-sm text-stone-500">
                  {new Date(application.created_at).toLocaleDateString('en-GB')}
                </p>
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
