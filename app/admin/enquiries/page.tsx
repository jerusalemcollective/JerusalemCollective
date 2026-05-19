import { requireAdminPermission } from '@/lib/admin'
import { StatusBadge } from '@/components/status-badge'
import { Pagination } from '@/components/pagination'

const PAGE_SIZE = 25

type EnquiryRow = {
  id: string
  status: string
  listing_id: string | null
  host_id: string | null
  guest_id: string | null
  check_in: string | null
  check_out: string | null
  guests: number
  message: string | null
  conversation_id: string | null
  created_at: string
  listings?: {
    title: string
    area: string
  } | null
  guest?: {
    full_name: string | null
    phone: string | null
  } | null
  hosts?: {
    name: string
    email: string | null
  } | null
}

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { supabase } = await requireAdminPermission('messages')
  const page = Math.max(1, Number((await searchParams).page) || 1)
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from('booking_requests')
      .select(`
        id, listing_id, host_id, guest_id, status, check_in, check_out,
        guests, message, conversation_id, created_at,
        listings(title, area),
        hosts(name, email),
        guest:profiles!booking_requests_guest_id_fkey(full_name, phone)
      `)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('booking_requests').select('*', { count: 'exact', head: true }),
  ])

  const enquiries = (data || []) as EnquiryRow[]
  const total = count || 0
  const newCount = enquiries.filter((enquiry) => enquiry.status === 'new').length
  const activeCount = enquiries.filter((enquiry) => ['new', 'host_replied'].includes(enquiry.status)).length

  return (
    <div>
      <header className="border-b border-stone-200 pb-6">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Enquiries</h2>
        <p className="mt-2 text-stone-600">
          Guest requests, host replies, and booking intent in one admin queue.
        </p>
      </header>

      <div className="grid gap-4 border-b border-stone-200 py-5 sm:grid-cols-3">
        <Metric label="Total" value={total} />
        <Metric label="New" value={newCount} />
        <Metric label="Active" value={activeCount} />
      </div>

      <div className="divide-y divide-stone-200 border-y border-stone-200">
        {enquiries.map((enquiry) => (
          <article
            key={enquiry.id}
            className="grid gap-4 py-5 lg:grid-cols-[1.2fr_0.9fr_0.8fr_auto] lg:items-center"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={enquiry.status} scheme="enquiry" />
                <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                  {enquiry.listings?.area || 'Jerusalem'}
                </p>
              </div>
              <h3 className="mt-2 font-bold text-stone-950">
                {enquiry.listings?.title || 'Stay enquiry'}
              </h3>
              {enquiry.message && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600">{enquiry.message}</p>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-stone-900">
                {enquiry.guest?.full_name || 'Guest'}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Host: {enquiry.hosts?.name || 'Host'}
              </p>
            </div>

            <div className="text-sm text-stone-700">
              <p>{formatDate(enquiry.check_in)} to {formatDate(enquiry.check_out)}</p>
              <p className="mt-1 text-stone-500">
                {enquiry.guests || 1} guest{enquiry.guests === 1 ? '' : 's'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {enquiry.conversation_id && (
                <span className="rounded-full border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600">
                  Guest-host thread
                </span>
              )}
            </div>
          </article>
        ))}
        {enquiries.length === 0 && (
          <div className="py-12 text-center text-stone-500">No enquiries yet.</div>
        )}
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/admin/enquiries" />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-stone-950">{value}</p>
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return 'Date not set'
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
