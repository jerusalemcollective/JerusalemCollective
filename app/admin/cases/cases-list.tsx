'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateSupportCase } from '@/app/admin/case-actions'
import { SupportCaseForm } from './support-case-form'
import { StatusBadge } from '@/components/status-badge'

export type SupportCase = {
  id: string
  case_type: string
  status: string
  reason: string
  requested_amount: number | null
  approved_refund_amount: number
  currency: string | null
  resolution_notes: string | null
  created_at: string
  resolved_at: string | null
  guest_response: string | null
  host_response: string | null
  bookings?: {
    id: string
    stripe_checkout_session_id: string | null
  } | null
  listings?: {
    id: string
    title: string
  } | null
  guest?: {
    full_name: string | null
  } | null
  host?: {
    name: string
  } | null
}

type CasesListProps = {
  cases: SupportCase[]
}

export function CasesList({ cases }: CasesListProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const allSelected = cases.length > 0 && selectedIds.size === cases.length

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(cases.map((supportCase) => supportCase.id)))
  }

  const toggleCase = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleBulkStatus = async (status: string) => {
    await Promise.all(
      Array.from(selectedIds).map(async (id) => {
        const supportCase = cases.find((item) => item.id === id)
        const formData = new FormData()
        formData.set('caseId', id)
        formData.set('status', status)
        formData.set('resolutionNotes', supportCase?.resolution_notes || '')
        formData.set('approvedRefundAmount', String(supportCase?.approved_refund_amount || 0))
        await updateSupportCase({ status: 'idle', message: '' }, formData)
      }),
    )
    setSelectedIds(new Set())
    router.refresh()
  }

  return (
    <>
      <div className="mt-8 space-y-4">
        {cases.length > 0 && (
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-stone-300"
            />
            Select all visible reports
          </label>
        )}

        {cases.map((supportCase) => (
          <article key={supportCase.id} className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <input
                  type="checkbox"
                  checked={selectedIds.has(supportCase.id)}
                  onChange={() => toggleCase(supportCase.id)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300"
                  aria-label={`Select case ${supportCase.reason}`}
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={supportCase.status} scheme="support" />
                    <TypeBadge type={supportCase.case_type} />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-stone-950">{supportCase.reason}</h3>
                  <div className="mt-3 space-y-1 text-sm text-stone-600">
                    <p>
                      Listing:{' '}
                      {supportCase.listings ? (
                        <Link href={`/listings/${supportCase.listings.id}`} className="font-semibold text-stone-900 hover:underline">
                          {supportCase.listings.title}
                        </Link>
                      ) : (
                        'Not linked'
                      )}
                    </p>
                    <p>Guest: {supportCase.guest?.full_name || 'Guest'}</p>
                    <p>Host: {supportCase.host?.name || 'Host'}</p>
                    <p>Opened: {new Date(supportCase.created_at).toLocaleDateString('en-GB')}</p>
                    <p>
                      Requested refund:{' '}
                      {supportCase.requested_amount
                        ? `${supportCase.currency || ''} ${supportCase.requested_amount.toLocaleString()}`
                        : 'None requested'}
                    </p>
                  </div>
                  {(supportCase.guest_response || supportCase.host_response) && (
                    <div className="mt-3 space-y-2">
                      {supportCase.guest_response && (
                        <div className="rounded-xl bg-[#F8F5F2] p-3">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500">Guest&rsquo;s response</p>
                          <p className="mt-1 whitespace-pre-line text-sm text-stone-700">{supportCase.guest_response}</p>
                        </div>
                      )}
                      {supportCase.host_response && (
                        <div className="rounded-xl bg-[#F8F5F2] p-3">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500">Host&rsquo;s response</p>
                          <p className="mt-1 whitespace-pre-line text-sm text-stone-700">{supportCase.host_response}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <SupportCaseForm
                supportCase={supportCase}
                paidOnline={Boolean(supportCase.bookings?.stripe_checkout_session_id)}
              />
            </div>
          </article>
        ))}

        {cases.length === 0 && (
          <div className="rounded-3xl bg-white p-10 text-center text-stone-500 shadow-sm">
            No reports yet.
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-3 shadow-xl">
          <span className="text-sm font-semibold text-stone-900">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={() => handleBulkStatus('resolved')}
            className="rounded-full bg-green-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-green-700"
          >
            Mark resolved
          </button>
          <button
            type="button"
            onClick={() => handleBulkStatus('closed')}
            className="rounded-full bg-stone-800 px-4 py-2 text-xs font-bold text-white transition hover:bg-stone-900"
          >
            Close reports
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-stone-500 hover:text-stone-800"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  )
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex rounded-full bg-[#fff4ef] px-3 py-1 text-xs font-bold capitalize text-[#c76f55]">
      {type.replaceAll('_', ' ')}
    </span>
  )
}
