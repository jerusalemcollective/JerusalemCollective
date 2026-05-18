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
  const { supabase, hostIds } = await requireHostDashboardAccess()

  const [{ data: applications }, { data: listings }] = await Promise.all([
    supabase
      .from('host_applications')
      .select('id, apartment_title, area, status, verification_status, admin_feedback, created_at, bedrooms, sleeps')
      .in('host_id', hostIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('listings')
      .select('id, title, area, is_published, is_featured, bedrooms, max_guests, created_at')
      .in('host_id', hostIds)
      .order('created_at', { ascending: false }),
  ])

  const hostApplications = (applications || []) as HostApplication[]
  const hostListings = (listings || []) as HostListing[]
  const applicationIds = hostApplications.map((application) => application.id)
  const listingIds = hostListings.map((listing) => listing.id)
  const { data: photos } =
    applicationIds.length || listingIds.length
      ? await supabase
          .from('listing_photos')
          .select('application_id, listing_id, photo_url, is_cover, sort_order')
          .or(
            [
              applicationIds.length ? `application_id.in.(${applicationIds.join(',')})` : '',
              listingIds.length ? `listing_id.in.(${listingIds.join(',')})` : '',
            ]
              .filter(Boolean)
              .join(','),
          )
          .order('is_cover', { ascending: false })
          .order('sort_order', { ascending: true })
      : { data: [] }
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
    (application) => ['rejected', 'changes_requested'].includes(application.status),
  ).length

  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-8 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">
        <HostDashboardNav />

        <header className="flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-950">Listings</h1>
            <p className="mt-2 text-stone-600">
              Live stays and submitted stays in one clear place.
            </p>
          </div>
          <Link
            href="/become-a-host"
            className="inline-flex w-fit rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Add another stay
          </Link>
        </header>

        <div className="grid gap-4 border-b border-stone-200 py-5 sm:grid-cols-3">
          <Metric label="Live stays" value={publishedCount} />
          <Metric label="In review" value={inReviewCount} />
          <Metric label="Needs attention" value={needsActionCount} />
        </div>

        <section className="py-8">
          <SectionHeading
            title="Live listings"
            detail="Approved stays already visible to guests."
          />
          {hostListings.length === 0 ? (
            <EmptyPanel text="No live listings yet. Approved stays will appear here." />
          ) : (
            <div className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
              {hostListings.map((listing) => (
                <ListingRow
                  key={listing.id}
                  title={listing.title}
                  area={listing.area}
                  meta={`${listing.bedrooms} bedrooms · sleeps ${listing.max_guests}`}
                  image={coverByListing.get(listing.id)}
                  badge={{
                    label: listing.is_published ? 'Live' : 'Hidden',
                    tone: listing.is_published ? 'green' : 'stone',
                  }}
                  actions={[
                    { href: `/host/dashboard/listings/${listing.id}`, label: 'Manage' },
                    { href: `/listings/${listing.id}`, label: 'View public page' },
                  ]}
                />
              ))}
            </div>
          )}
        </section>

        <section className="pb-8">
          <SectionHeading
            title="Submitted stays"
            detail="Applications waiting for review or needing changes."
          />
          {pendingApplications.length === 0 ? (
            <EmptyPanel text="No submitted stays waiting at the moment." />
          ) : (
            <div className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
              {pendingApplications.map((application) => (
                <ApplicationRow
                  key={application.id}
                  application={application}
                  image={coverByApplication.get(application.id)}
                />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
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

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-stone-950">{title}</h2>
      <p className="mt-1 text-sm text-stone-600">{detail}</p>
    </div>
  )
}

function ListingRow({
  title,
  area,
  meta,
  image,
  badge,
  actions,
}: {
  title: string
  area: string
  meta: string
  image?: string
  badge: { label: string; tone: 'green' | 'stone' }
  actions: Array<{ href: string; label: string }>
}) {
  return (
    <article className="grid gap-4 py-4 md:grid-cols-[96px_1fr_auto] md:items-center">
      <Thumb src={image} title={title} />
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{area}</p>
        <h3 className="mt-1 font-bold text-stone-950">{title}</h3>
        <p className="mt-1 text-sm text-stone-600">{meta}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <StatusBadge label={badge.label} tone={badge.tone} />
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-full border border-stone-200 px-3 py-1.5 text-sm font-semibold text-stone-700 transition hover:border-stone-300"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </article>
  )
}

function ApplicationRow({
  application,
  image,
}: {
  application: HostApplication
  image?: string
}) {
  const needsAction = ['changes_requested', 'rejected'].includes(application.status)

  return (
    <article className="grid gap-4 py-4 md:grid-cols-[96px_1fr_auto] md:items-center">
      <Thumb src={image} title={application.apartment_title} />
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{application.area}</p>
        <h3 className="mt-1 font-bold text-stone-950">{application.apartment_title}</h3>
        <p className="mt-1 text-sm text-stone-600">
          {application.bedrooms || '-'} bedrooms · sleeps {application.sleeps || '-'}
        </p>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {nextStepText(application.status, application.verification_status)}
        </p>
        {application.admin_feedback && (
          <p className="mt-2 text-sm font-medium text-amber-800">
            Message from JLM Collective available
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <StatusBadge label={application.status.replace('_', ' ')} tone={statusTone(application.status)} />
        {needsAction && (
          <Link
            href={`/host/dashboard/applications/${application.id}`}
            className="rounded-full bg-stone-950 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Edit and resubmit
          </Link>
        )}
      </div>
    </article>
  )
}

function Thumb({ src, title }: { src?: string; title: string }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-200">
      {src ? (
        <img src={src} alt={title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-stone-200 to-stone-300" />
      )}
    </div>
  )
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="mt-4 border-y border-stone-200 py-6 text-sm text-stone-600">{text}</div>
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
    stone: 'bg-stone-200 text-stone-700',
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
  if (status === 'approved') return 'Approved and ready for publication.'
  if (status === 'rejected') return 'This stay needs attention before it can move forward.'
  if (status === 'changes_requested') return 'Changes were requested before review can continue.'
  if (verificationStatus === 'pending') return 'Verification is still waiting for review.'
  if (status === 'in_review') return 'Currently being reviewed by JLM Collective.'
  return 'Submitted successfully and waiting for review.'
}
