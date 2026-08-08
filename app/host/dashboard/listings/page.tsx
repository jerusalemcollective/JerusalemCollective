import Link from 'next/link'
import Image from 'next/image'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { ListingQualityScore } from '@/components/listing-quality-score'
import { calculateListingScore } from '@/lib/marketplace-rules'

type HostApplication = {
  id: string
  apartment_title: string
  area: string
  status: string
  verification_status?: string | null
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
  bedrooms: number | null
  bathrooms: number | null
  max_guests: number
  amenities: string[] | null
  description: string | null
  price_usd: number | null
  price_ils: number | null
  american_comfort: boolean | null
  created_at: string
}

type ListingPhoto = {
  application_id: string | null
  listing_id: string | null
  photo_url: string
  is_cover: boolean
  sort_order: number
}

type PriceComparison = {
  listing_id: string
  comparable_count: number
  median_price_usd: number | null
  low_price_usd: number | null
  high_price_usd: number | null
  percent_difference_usd: number | null
  median_price_ils: number | null
  low_price_ils: number | null
  high_price_ils: number | null
  percent_difference_ils: number | null
  price_position: 'above_market' | 'below_market' | 'in_line' | 'not_enough_data'
  recommendation: string
}

type PerformanceInsight = {
  listing_id: string
  views: number
  saves: number
  enquiries: number
  booking_requests: number
  accepted_requests: number
  enquiry_rate: number | null
  request_acceptance_rate: number | null
  avg_response_hours: number | null
  demand_signal: 'building_data' | 'low_conversion' | 'strong_demand' | 'slow_response' | 'steady_interest'
  recommendation: string
}

export default async function HostListingsPage() {
  const { supabase, hostIds } = await requireHostDashboardAccess()

  const [{ data: applications }, { data: listings }] = await Promise.all([
    supabase
      .from('host_applications')
      .select('id, apartment_title, area, status, admin_feedback, created_at, bedrooms, sleeps')
      .in('host_id', hostIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('listings')
      .select('id, title, area, is_published, is_featured, bedrooms, bathrooms, max_guests, amenities, description, price_usd, price_ils, american_comfort, created_at')
      .in('host_id', hostIds)
      .order('created_at', { ascending: false }),
  ])

  const hostApplications: HostApplication[] = (applications || []).map((application: HostApplication) => ({
    id: application.id,
    apartment_title: application.apartment_title,
    area: application.area,
    status: application.status,
    verification_status: application.verification_status,
    admin_feedback: application.admin_feedback,
    created_at: application.created_at,
    bedrooms: application.bedrooms,
    sleeps: application.sleeps,
  }))
  const hostListings: HostListing[] = (listings || []).map((listing: HostListing) => ({
    id: listing.id,
    title: listing.title,
    area: listing.area,
    is_published: listing.is_published,
    is_featured: listing.is_featured,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    max_guests: listing.max_guests,
    amenities: listing.amenities,
    description: listing.description,
    price_usd: listing.price_usd,
    price_ils: listing.price_ils,
    american_comfort: listing.american_comfort,
    created_at: listing.created_at,
  }))
  const applicationIds = hostApplications.map((application) => application.id)
  const listingIds = hostListings.map((listing) => listing.id)
  const [{ data: photos }, comparisonRows, performanceRows] = await Promise.all([
    applicationIds.length || listingIds.length
      ? supabase
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
      : Promise.resolve({ data: [] }),
    listingIds.length
      ? Promise.all(
          listingIds.map(async (listingId) => {
            const { data } = await supabase
              .rpc('get_listing_price_comparison', {
                target_listing_id: listingId,
              })
              .maybeSingle<PriceComparison>()

            return data
          }),
        )
      : Promise.resolve([]),
    listingIds.length
      ? Promise.all(
          listingIds.map(async (listingId) => {
            const { data } = await supabase
              .rpc('get_listing_performance_insights', {
                target_listing_id: listingId,
                lookback_days: 30,
              })
              .maybeSingle<PerformanceInsight>()

            return data
          }),
        )
      : Promise.resolve([]),
  ])
  const listingPhotos: ListingPhoto[] = (photos || []).map((photo: ListingPhoto) => ({
    application_id: photo.application_id,
    listing_id: photo.listing_id,
    photo_url: photo.photo_url,
    is_cover: photo.is_cover,
    sort_order: photo.sort_order,
  }))
  const comparisonByListing = new Map(
    comparisonRows
      .filter((comparison): comparison is PriceComparison => Boolean(comparison))
      .map((comparison) => [comparison.listing_id, comparison]),
  )
  const performanceByListing = new Map(
    performanceRows
      .filter((performance): performance is PerformanceInsight => Boolean(performance))
      .map((performance) => [performance.listing_id, performance]),
  )
  // Rejected submissions drop off the host's list after a week, so it doesn't
  // fill up with dead attempts. They are only hidden from this view, never
  // deleted, so admins keep the full history.
  const rejectedVisibleDays = 7
  const rejectedVisibleCutoff = Date.now() - rejectedVisibleDays * 24 * 60 * 60 * 1000
  const pendingApplications = hostApplications.filter((application) => {
    if (application.status === 'approved') return false
    if (application.status !== 'rejected') return true

    const submittedAt = application.created_at ? new Date(application.created_at).getTime() : 0
    return submittedAt >= rejectedVisibleCutoff
  })

  const coverByApplication = new Map<string, string>()
  const coverByListing = new Map<string, string>()
  const photoCountByListing = new Map<string, number>()

  listingPhotos.forEach((photo) => {
    if (photo.application_id && !coverByApplication.has(photo.application_id)) {
      coverByApplication.set(photo.application_id, photo.photo_url)
    }
    if (photo.listing_id && !coverByListing.has(photo.listing_id)) {
      coverByListing.set(photo.listing_id, photo.photo_url)
    }
    if (photo.listing_id) {
      photoCountByListing.set(
        photo.listing_id,
        (photoCountByListing.get(photo.listing_id) || 0) + 1,
      )
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
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-8 text-[#252525] md:px-6">
      <section className="mx-auto max-w-6xl">

        <header className="flex flex-col gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-stone-950">Listings</h1>
            <p className="mt-2 text-sm text-stone-500">
              {hostListings.length === 0
                ? 'No listings yet'
                : hostListings.length === 1
                  ? '1 listing'
                  : `${hostListings.length} listings`}
            </p>
          </div>
          <Link
            href="/become-a-host"
            className="inline-flex w-fit rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            {hostListings.length === 0 ? 'List your first stay' : 'Add another stay'}
          </Link>
        </header>


        <section className="py-8">
          <SectionHeading title="Live listings" />
          {hostListings.length === 0 ? (
            <EmptyPanel text="No live listings yet. Approved stays will appear here." />
          ) : (
            <div className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
              {hostListings.map((listing) => {
                const photoCount = photoCountByListing.get(listing.id) || 0
                const scoreInput = {
                  photo_count: photoCount,
                  description: listing.description,
                  bedrooms: listing.bedrooms,
                  bathrooms: listing.bathrooms,
                  amenities: listing.amenities || [],
                  price_usd: listing.price_usd,
                  price_ils: listing.price_ils,
                }

                return (
                  <ListingRow
                    key={listing.id}
                    id={listing.id}
                    title={listing.title}
                    area={listing.area}
                    meta={`${listing.bedrooms || '-'} bedrooms · sleeps ${listing.max_guests}`}
                    image={coverByListing.get(listing.id)}
                    score={calculateListingScore(scoreInput)}
                    suggestions={listingStrengthSuggestions(listing, photoCount)}
                    comparison={comparisonByListing.get(listing.id) || null}
                    bedrooms={listing.bedrooms}
                    americanComfort={Boolean(listing.american_comfort)}
                    performance={performanceByListing.get(listing.id) || null}
                    badge={{
                      label: listing.is_published ? 'Live' : 'Hidden',
                      tone: listing.is_published ? 'green' : 'stone',
                    }}
                    isPublished={listing.is_published}
                  />
                )
              })}
            </div>
          )}
        </section>

        <section className="pb-8">
          <SectionHeading title="Submitted stays" />
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

function SectionHeading({ title }: { title: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-stone-950">{title}</h2>
    </div>
  )
}

function ListingRow({
  id,
  title,
  area,
  meta,
  image,
  score,
  suggestions,
  comparison,
  bedrooms,
  americanComfort,
  performance,
  badge,
  isPublished,
}: {
  id: string
  title: string
  area: string
  meta: string
  image?: string
  score: number
  suggestions: string[]
  comparison: PriceComparison | null
  bedrooms: number | null
  americanComfort: boolean
  performance: PerformanceInsight | null
  badge: { label: string; tone: 'green' | 'stone' }
  isPublished: boolean
}) {
  return (
    <article className="grid gap-4 py-4 md:grid-cols-[96px_1fr_auto] md:items-center">
      <Thumb src={image} title={title} />
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{area}</p>
        <h3 className="mt-1 font-bold text-stone-950">{title}</h3>
        <p className="mt-1 text-sm text-stone-600">{meta}</p>
        <div className="mt-4 max-w-xl">
          <ListingQualityScore score={score} label="Listing strength" suggestions={suggestions} />
        </div>
        <PriceInsight
          comparison={comparison}
          area={area}
          bedrooms={bedrooms}
          americanComfort={americanComfort}
        />
        <PerformanceInsightCard performance={performance} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              isPublished ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {isPublished ? 'Live' : 'Hidden'}
          </span>
          <Link
            href={`/host/dashboard/listings/${id}`}
            className="rounded-full bg-stone-950 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-stone-800"
          >
            Manage property
          </Link>
          <Link
            href={`/listings/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:border-stone-300"
          >
            View live ↗
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <StatusBadge label={badge.label} tone={badge.tone} />
      </div>
    </article>
  )
}

function PerformanceInsightCard({ performance }: { performance: PerformanceInsight | null }) {
  if (!performance) return null

  const tone =
    performance.demand_signal === 'strong_demand'
      ? 'bg-green-100 text-green-800'
      : performance.demand_signal === 'low_conversion'
        ? 'bg-amber-100 text-amber-800'
        : performance.demand_signal === 'slow_response'
          ? 'bg-rose-100 text-rose-800'
          : performance.demand_signal === 'steady_interest'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-stone-100 text-stone-600'

  const signalLabel: Record<PerformanceInsight['demand_signal'], string> = {
    building_data: 'Building data',
    low_conversion: 'Needs attention',
    strong_demand: 'Strong demand',
    slow_response: 'Reply faster',
    steady_interest: 'Steady interest',
  }

  return (
    <div className="mt-4 max-w-xl rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
            Demand, last 30 days
          </p>
          <p className="mt-1 text-sm font-semibold text-stone-950">
            {performance.views} views · {performance.enquiries + performance.booking_requests} enquiries
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>
          {signalLabel[performance.demand_signal]}
        </span>
      </div>
      <div className="mt-3 grid gap-3 text-xs text-stone-600 sm:grid-cols-3">
        <InsightMetric
          label="Enquiry rate"
          value={
            performance.enquiry_rate !== null
              ? `${performance.enquiry_rate}%`
              : 'Not enough views'
          }
        />
        <InsightMetric
          label="Accepted"
          value={`${performance.accepted_requests}/${performance.booking_requests}`}
        />
        <InsightMetric
          label="Avg reply"
          value={
            performance.avg_response_hours !== null
              ? `${performance.avg_response_hours}h`
              : 'No replies yet'
          }
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-stone-500">
        {performance.recommendation}
      </p>
    </div>
  )
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F8F5F2] px-3 py-2">
      <p className="font-bold uppercase tracking-widest text-stone-500">{label}</p>
      <p className="mt-1 font-semibold text-stone-900">{value}</p>
    </div>
  )
}

function PriceInsight({
  comparison,
  area,
  bedrooms,
  americanComfort,
}: {
  comparison: PriceComparison | null
  area: string
  bedrooms: number | null
  americanComfort: boolean
}) {
  if (!comparison) return null

  const useUsd = comparison.median_price_usd !== null || comparison.percent_difference_usd !== null
  const median = useUsd ? comparison.median_price_usd : comparison.median_price_ils
  const low = useUsd ? comparison.low_price_usd : comparison.low_price_ils
  const high = useUsd ? comparison.high_price_usd : comparison.high_price_ils
  const difference = useUsd ? comparison.percent_difference_usd : comparison.percent_difference_ils
  const currency = useUsd ? '$' : '₪'
  const absoluteDifference = Math.abs(Math.round(difference || 0))
  const bedroomLabel = bedrooms
    ? `${bedrooms}-bedroom`
    : 'similar'

  const tone =
    comparison.price_position === 'above_market'
      ? 'bg-amber-100 text-amber-800'
      : comparison.price_position === 'below_market'
        ? 'bg-blue-100 text-blue-800'
        : comparison.price_position === 'in_line'
          ? 'bg-green-100 text-green-800'
          : 'bg-stone-100 text-stone-600'

  const label =
    comparison.price_position === 'above_market'
      ? `${absoluteDifference}% higher`
      : comparison.price_position === 'below_market'
        ? `${absoluteDifference}% lower`
        : comparison.price_position === 'in_line'
          ? 'In line'
          : 'Building comparison set'
  const intelligence =
    comparison.price_position === 'above_market'
      ? `You are ${absoluteDifference}% higher than similar ${bedroomLabel} homes in ${area}.`
      : comparison.price_position === 'below_market'
        ? americanComfort
          ? 'You are priced below comparable homes with American comfort.'
          : `You are ${absoluteDifference}% below similar ${bedroomLabel} homes in ${area}.`
        : comparison.price_position === 'in_line'
          ? `You are priced in line with similar ${bedroomLabel} homes in ${area}.`
          : comparison.recommendation

  // Nothing useful to show until there are enough comparable listings — hide the
  // card entirely rather than repeating "not enough data".
  if (comparison.price_position === 'not_enough_data') {
    return null
  }

  return (
    <div className="mt-4 max-w-xl rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
            Price position
          </p>
          <p className="mt-1 text-sm font-semibold text-stone-950">
            {comparison.comparable_count >= 3 && median
              ? `Similar ${currency}${Math.round(low || median).toLocaleString()}–${currency}${Math.round(high || median).toLocaleString()} / night`
              : 'Not enough similar listings yet'}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>
          {label}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-stone-800">
        {intelligence}
      </p>
      {intelligence !== comparison.recommendation && (
        <p className="mt-1 text-xs leading-5 text-stone-500">
          {comparison.recommendation}
        </p>
      )}
    </div>
  )
}

function listingStrengthSuggestions(listing: HostListing, photoCount: number) {
  const suggestions: string[] = []
  const descriptionLength = listing.description?.length || 0
  const amenities = listing.amenities || []

  if (photoCount < 10) suggestions.push('Add more photos, ideally at least 10.')
  if (descriptionLength <= 150) {
    suggestions.push('Write a fuller description with sleeping setup, location, and guest details.')
  }
  if (listing.bathrooms === null) suggestions.push('Add the bathroom count.')
  if (!listing.price_usd && !listing.price_ils) suggestions.push('Add a clear price.')
  if (amenities.length < 5) suggestions.push('Add at least five useful amenities.')

  return suggestions.slice(0, 3)
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
        <StatusBadge label={hostStatusLabel(application.status)} tone={statusTone(application.status)} />
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
        <Image src={src} alt={title} fill className="object-cover" sizes="(max-width: 768px) 40vw, 220px" />
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
  if (status === 'new') return 'amber'
  if (status === 'in_review') return 'amber'
  return 'stone'
}

function hostStatusLabel(status: string) {
  if (status === 'new') return 'In review'
  if (status === 'changes_requested') return 'Changes requested'
  return status.replaceAll('_', ' ')
}

function nextStepText(status: string, verificationStatus?: string | null) {
  if (status === 'approved') return 'Approved and ready for publication.'
  if (status === 'rejected') return 'This stay needs attention before it can move forward.'
  if (status === 'changes_requested') return 'Changes were requested before review can continue.'
  if (status === 'new') return 'Submitted successfully and now waiting for JLM Collective review.'
  if (status === 'in_review') return 'Currently being reviewed by JLM Collective.'
  if (verificationStatus === 'pending') return 'Verification is still waiting for review.'
  return 'Submitted successfully and waiting for review.'
}

