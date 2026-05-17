import Link from 'next/link'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { HostDashboardNav } from '@/components/host-dashboard-nav'

type HostApplication = {
  id: string
  apartment_title: string
  area: string
  status: string
  verification_status: string
  admin_feedback: string | null
  created_at: string
  bedrooms: number | null
  sleeps: number | null
}

type HostListing = {
  id: string
  title: string
  area: string
  is_published: boolean
  is_featured: boolean
  bedrooms: number
  max_guests: number
  created_at: string
}

type ListingPhoto = {
  application_id: string | null
  listing_id: string | null
  photo_url: string
  is_cover: boolean
  sort_order: number
}

export default async function HostListingsPage() {
  const { supabase } = await requireHostDashboardAccess()

  const [{ data: applications }, { data: listings }, { data: photos }] = await Promise.all([
    supabase
      .from('host_applications')
      .select('id, apartment_title, area, status, verification_status, admin_feedback, created_at, bedrooms, sleeps')
      .order('created_at', { ascending: false }),
    supabase
      .from('listings')
      .select('id, title, area, is_published, is_featured, bedrooms, max_guests, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('listing_photos')
      .select('application_id, listing_id, photo_url, is_cover, sort_order')
      .order('is_cover', { ascending: false })
      .order('sort_order', { ascending: true }),
  ])

  const hostApplications = (applications || []) as HostApplication[]
  const hostListings = (listings || []) as HostListing[]
  const listingPhotos = (photos || []) as ListingPhoto[]
  const pendingApplications = hostApplications.filter(
    (application) => application.status !== 'approved',
  )

  const coverByApplication = new Map<string, string>()
  const coverByListing = new Map<string, string>()

  listingPhotos.forEach((photo) => {
    if (photo.application_id && !coverByApplication.has(photo.application_id)) {
      coverByApplication.set(photo.application_id, photo.photo_url)
    }
    if (photo.listing_id && !coverByListing.has(photo.listing_id)) {
      coverByListing.set(photo.listing_id, photo.photo_url)
    }
  })

  const publishedCount = hostListings.filter((listing) => listing.is_published).length
  const inReviewCount = pendingApplications.filter((application) =>
    ['new', 'in_review'].includes(application.status),
  ).length
  const needsActionCount = pendingApplications.filter(
    (application) => application.status === 'rejected',
  ).length

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <HostDashboardNav />
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Host dashboard</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">Your stays</h1>
            <p className="mt-2 max-w-2xl text-stone-600">
              See every stay in one place, from submitted to live, with the next useful action always nearby.
            </p>
          </div>
          <Link
            href="/become-a-host"
            className="inline-flex w-fit rounded-full bg-[#252525] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#111111]"
          >
            Add another stay
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Live stays" value={publishedCount} tone="green" />
          <SummaryCard label="In review" value={inReviewCount} tone="amber" />
          <SummaryCard label="Needs attention" value={needsActionCount} tone="rose" />
        </div>

        <div className="mt-8 grid gap-6">
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-stone-950">Live listings</h2>
                <p className="mt-1 text-sm text-stone-600">
                  Public stays already approved and ready for guests.
                </p>
              </div>
            </div>

            {hostListings.length === 0 ? (
              <EmptyPanel text="No live listings yet. Approved stays will appear here." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {hostListings.map((listing) => (
                  <article key={listing.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                    <StayImage src={coverByListing.get(listing.id)} title={listing.title} />
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                            {listing.area}
                          </p>
                          <h3 className="mt-2 text-xl font-bold text-stone-950">{listing.title}</h3>
                        </div>
                        <StatusBadge
                          label={listing.is_published ? 'Live' : 'Hidden'}
                          tone={listing.is_published ? 'green' : 'stone'}
                        />
                      </div>
                      <p className="mt-3 text-sm text-stone-600">
                        {listing.bedrooms} bedrooms | sleeps {listing.max_guests}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                          href={`/host/dashboard/listings/${listing.id}`}
                          className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300"
                        >
                          Manage listing
                        </Link>
                        <Link
                          href={`/listings/${listing.id}`}
                          className="rounded-full bg-[#252525] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#111111]"
                        >
                          View public page
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-stone-950">Submitted stays</h2>
              <p className="mt-1 text-sm text-stone-600">
                Applications that are waiting, being reviewed, approved, or need changes.
              </p>
            </div>

            {pendingApplications.length === 0 ? (
              <EmptyPanel text="No submitted stays yet." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {pendingApplications.map((application) => (
                  <article key={application.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                    <StayImage
                      src={coverByApplication.get(application.id)}
                      title={application.apartment_title}
                    />
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                            {application.area}
                          </p>
                          <h3 className="mt-2 text-xl font-bold text-stone-950">
                            {application.apartment_title}
                          </h3>
                        </div>
                        <StatusBadge
                          label={application.status.replace('_', ' ')}
                          tone={statusTone(application.status)}
                        />
                      </div>
                      <p className="mt-3 text-sm text-stone-600">
                        {application.bedrooms || '-'} bedrooms | sleeps {application.sleeps || '-'}
                      </p>
                      <div className="mt-4 rounded-2xl bg-[#F8F5F2] p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
                          What happens next
                        </p>
                        <p className="mt-2 text-sm leading-6 text-stone-700">
                          {nextStepText(application.status, application.verification_status)}
                        </p>
                      </div>
                      {application.admin_feedback && (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
                            Message from JLM Collective
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-900">
                            {application.admin_feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'green' | 'amber' | 'rose'
}) {
  const toneClasses = {
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-stone-500">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className={`inline-flex h-11 min-w-11 items-center justify-center rounded-2xl px-3 text-lg font-bold ${toneClasses[tone]}`}>
          {value}
        </span>
      </div>
    </div>
  )
}

function StayImage({ src, title }: { src?: string; title: string }) {
  return (
    <div className="relative aspect-[16/9] bg-stone-200">
      {src ? (
        <img src={src} alt={title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-stone-200 to-stone-300" />
      )}
    </div>
  )
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-3xl bg-white p-6 text-sm text-stone-600 shadow-sm">{text}</div>
}

function StatusBadge({
  label,
  tone,
}: {
  label: string
  tone: 'green' | 'amber' | 'rose' | 'stone'
}) {
  const toneClasses = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    stone: 'bg-stone-100 text-stone-700',
  }

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${toneClasses[tone]}`}>
      {label}
    </span>
  )
}

function statusTone(status: string): 'green' | 'amber' | 'rose' | 'stone' {
  if (status === 'approved') return 'green'
  if (status === 'changes_requested') return 'amber'
  if (status === 'rejected') return 'rose'
  if (status === 'in_review') return 'amber'
  return 'stone'
}

function nextStepText(status: string, verificationStatus: string) {
  if (status === 'approved') {
    return 'Approved. If this stay is published, guests can now discover it on JLM Collective.'
  }

  if (status === 'rejected') {
    return 'This stay needs attention before it can go live. Contact support for the exact changes required.'
  }

  if (status === 'changes_requested') {
    return 'JLM Collective has requested changes before this stay can move forward.'
  }

  if (verificationStatus === 'pending') {
    return 'Documents are waiting for review. We will move this stay forward once verification is complete.'
  }

  if (status === 'in_review') {
    return 'The stay is being reviewed by the JLM Collective team.'
  }

  return 'Submitted successfully. The review process will begin shortly.'
}
