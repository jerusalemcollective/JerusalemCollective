import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/breadcrumb'
import { StatusBadge } from '@/components/status-badge'
import { formatDateDisplay, formatWaitTime, shouldShowSimilarStaysLink } from '@/lib/utils/date'

const enquiryRowSchema = z.object({
  id: z.string(),
  status: z.string(),
  check_in: z.string().nullable(),
  check_out: z.string().nullable(),
  guests: z.number(),
  message: z.string().nullable(),
  created_at: z.string().nullable(),
  conversation_id: z.string().nullable(),
  listings: z
    .object({
      id: z.string(),
      title: z.string(),
      area: z.string().nullable(),
    })
    .nullable()
    .optional(),
})

type EnquiryRow = z.infer<typeof enquiryRowSchema>

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

  const enquiries: EnquiryRow[] = z.array(enquiryRowSchema).parse(data ?? [])

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-6">
        <Breadcrumb items={[{ label: 'Account', href: '/account' }, { label: 'Enquiries' }]} />

        <header className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-stone-950">Enquiries</h1>
        </header>

        {enquiries.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {enquiries.map((enquiry) => {
              const waitTime = formatWaitTime(enquiry.created_at, enquiry.status)
              const shouldShowSimilarStays = shouldShowSimilarStaysLink(enquiry.created_at, enquiry.status)
              const similarStaysHref = enquiry.listings?.id
                ? `/stays?area=${encodeURIComponent(enquiry.listings.area || '')}`
                : '/stays'

              return (
                <div
                  key={enquiry.id}
                  className="grid gap-3 py-5 transition hover:bg-white/50 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    {enquiry.listings?.id ? (
                      <Link
                        href={`/listings/${enquiry.listings.id}`}
                        className="font-semibold text-stone-950 transition hover:text-[#c76f55]"
                      >
                        {enquiry.listings.title}
                      </Link>
                    ) : (
                      <p className="font-bold text-stone-950">Stay enquiry</p>
                    )}
                    <p className="mt-1 text-sm text-stone-600">{enquiry.listings?.area || 'Jerusalem'}</p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-stone-600">
                      {enquiry.check_in && (
                        <span>
                          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                            In
                          </span>{' '}
                          {formatDateDisplay(new Date(enquiry.check_in))}
                        </span>
                      )}
                      {enquiry.check_in && enquiry.check_out && (
                        <span className="text-stone-300">→</span>
                      )}
                      {enquiry.check_out && (
                        <span>
                          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                            Out
                          </span>{' '}
                          {formatDateDisplay(new Date(enquiry.check_out))}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-stone-600">
                      {enquiry.guests} guest{enquiry.guests === 1 ? '' : 's'}
                    </p>
                    {enquiry.message && (
                      <p className="mt-3 line-clamp-2 text-sm text-stone-600">{enquiry.message}</p>
                    )}
                  </div>
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
        className="inline-flex rounded-full bg-[#252525] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#111111]"
      >
        Start exploring
      </Link>
    </div>
  )
}
