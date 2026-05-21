import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/breadcrumb'
import { StatusBadge } from '@/components/status-badge'

type EnquiryRow = {
  id: string
  status: string
  check_in: string | null
  check_out: string | null
  guests: number
  message: string | null
  created_at: string | null
  conversation_id: string | null
  listings?: {
    id: string
    title: string
    area: string | null
  } | null
}

export const metadata = {
  title: 'My enquiries',
  robots: { index: false, follow: false },
}

export default async function EnquiriesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/account/enquiries')
  }

  const { data } = await supabase
    .from('booking_requests')
    .select('id, status, check_in, check_out, guests, message, created_at, conversation_id, listings(id, title, area)')
    .eq('guest_id', user.id)
    .order('created_at', { ascending: false })

  const enquiries: EnquiryRow[] = data || []

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-6">
        <Breadcrumb items={[{ label: 'Account', href: '/account' }, { label: 'Enquiries' }]} />

        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-stone-950">Enquiries</h1>
          <p className="mt-2 text-stone-600">Your stay requests and host replies in one place.</p>
        </header>

        {enquiries.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {enquiries.map((enquiry) => {
              const waitTime = formatWaitTime(enquiry.created_at, enquiry.status)
              const shouldShowSimilarStays = shouldShowSimilarStaysLink(enquiry.created_at, enquiry.status)
              const enquiryHref = enquiry.conversation_id
                ? `/account/messages?conversation=${enquiry.conversation_id}`
                : enquiry.listings?.id
                  ? `/listings/${enquiry.listings.id}`
                  : '/stays'
              const similarStaysHref = enquiry.listings?.id
                ? `/stays?area=${encodeURIComponent(enquiry.listings.area || '')}`
                : '/stays'

              return (
                <div
                  key={enquiry.id}
                  className="grid gap-3 py-5 transition hover:bg-white/50 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <Link href={enquiryHref}>
                    <p className="font-bold text-stone-950">{enquiry.listings?.title || 'Stay enquiry'}</p>
                    <p className="mt-1 text-sm text-stone-600">{enquiry.listings?.area || 'Jerusalem'}</p>
                    <p className="mt-2 text-sm font-medium text-stone-700">
                      {formatDate(enquiry.check_in)} to {formatDate(enquiry.check_out)}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">
                      {enquiry.guests} guest{enquiry.guests === 1 ? '' : 's'}
                    </p>
                    {enquiry.message && (
                      <p className="mt-3 line-clamp-2 text-sm text-stone-600">{enquiry.message}</p>
                    )}
                  </Link>
                  <div>
                    <StatusBadge status={enquiry.status} scheme="enquiry" />
                    {waitTime && <p className="mt-1 text-xs text-stone-500">{waitTime}</p>}
                    {shouldShowSimilarStays && (
                      <Link
                        href={similarStaysHref}
                        className="mt-2 inline-flex text-xs font-semibold text-[#c76f55] hover:underline"
                      >
                        Browse similar stays →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
        <CalendarDays className="h-8 w-8 text-stone-400" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-stone-900">No enquiries yet</h2>
      <p className="mb-6 text-stone-600">When you enquire about a stay, it will appear here.</p>
      <Link
        href="/stays"
        className="inline-flex rounded-full bg-[#c76f55] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#b5624a]"
      >
        Start exploring
      </Link>
    </div>
  )
}

function formatDate(value?: string | null) {
  if (!value) return 'TBC'
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatWaitTime(createdAt: string | null, status: string): string | null {
  if (status !== 'new' || !createdAt) return null
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60))
  if (hours < 1) return 'Sent just now'
  if (hours < 24) return `Sent ${hours} hour${hours === 1 ? '' : 's'} ago — awaiting reply`
  const days = Math.floor(hours / 24)
  return `Sent ${days} day${days === 1 ? '' : 's'} ago — awaiting reply`
}

function shouldShowSimilarStaysLink(createdAt: string | null, status: string): boolean {
  if (status !== 'new' || !createdAt) return false
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60))
  return hours >= 48
}
