import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'
import { SupportCaseForm } from './support-case-form'
import { summarizeSupportCases } from '@/lib/marketplace-rules'

type SupportCase = {
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
  bookings?: {
    id: string
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

export default async function AdminCasesPage() {
  const { supabase } = await requireAdminPermission('cases')
  const { data } = await supabase
    .from('support_cases')
    .select(`
      id,
      case_type,
      status,
      reason,
      requested_amount,
      approved_refund_amount,
      currency,
      resolution_notes,
      created_at,
      resolved_at,
      bookings(id),
      listings(id, title),
      guest:profiles!support_cases_guest_id_fkey(full_name),
      host:hosts!support_cases_host_id_fkey(name)
    `)
    .order('created_at', { ascending: false })

  const cases = (data || []) as SupportCase[]
  const summary = summarizeSupportCases(cases)

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Disputes & refunds</h2>
        <p className="mt-2 text-stone-600">
          Track guest issues, host responses, and any refund decision in one queue.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Open" value={summary.open} />
        <SummaryCard label="Under review" value={summary.underReview} />
        <SummaryCard label="Waiting on guest" value={summary.waitingOnGuest} />
        <SummaryCard label="Waiting on host" value={summary.waitingOnHost} />
      </div>

      <div className="mt-8 space-y-4">
        {cases.map((supportCase) => (
          <article key={supportCase.id} className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={supportCase.status} />
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
              </div>

              <SupportCaseForm supportCase={supportCase} />
            </div>
          </article>
        ))}

        {cases.length === 0 && (
          <div className="rounded-3xl bg-white p-10 text-center text-stone-500 shadow-sm">
            No dispute or refund cases yet.
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-stone-950">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === 'resolved'
      ? 'bg-green-100 text-green-700'
      : status === 'closed'
        ? 'bg-stone-100 text-stone-700'
        : status === 'under_review'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-rose-100 text-rose-700'

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${styles}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex rounded-full bg-[#fff4ef] px-3 py-1 text-xs font-bold capitalize text-[#c76f55]">
      {type.replaceAll('_', ' ')}
    </span>
  )
}
