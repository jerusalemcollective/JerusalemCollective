import Link from 'next/link'
import { requireAdminPermission } from '@/lib/admin'

type PopularNeighborhood = {
  neighborhood: string
  search_count: number
}

type PopularListing = {
  listing_id: string
  views: number
  saves: number
  enquiries: number
  booking_requests: number
}

type ListingTitle = {
  id: string
  title: string
  area: string
}

export default async function AdminAnalyticsPage() {
  const { supabase } = await requireAdminPermission('analytics')
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [
    { count: views },
    { count: saves },
    { count: enquiries },
    { count: bookingRequests },
    { data: neighborhoods },
    { data: popularity },
  ] = await Promise.all([
    supabase.from('listing_engagement_events').select('*', { count: 'exact', head: true }).eq('event_type', 'view').gte('created_at', thirtyDaysAgo),
    supabase.from('listing_engagement_events').select('*', { count: 'exact', head: true }).eq('event_type', 'save').gte('created_at', thirtyDaysAgo),
    supabase.from('listing_engagement_events').select('*', { count: 'exact', head: true }).eq('event_type', 'enquiry').gte('created_at', thirtyDaysAgo),
    supabase.from('listing_engagement_events').select('*', { count: 'exact', head: true }).eq('event_type', 'booking_request').gte('created_at', thirtyDaysAgo),
    supabase.rpc('popular_neighborhoods', { result_limit: 8, lookback_days: 30 }),
    supabase.rpc('listing_popularity_summary', { result_limit: 8, lookback_days: 30 }),
  ])

  const popularListings: PopularListing[] = (popularity || []).map((listing) => ({
    listing_id: listing.listing_id,
    views: Number(listing.views || 0),
    saves: Number(listing.saves || 0),
    enquiries: Number(listing.enquiries || 0),
    booking_requests: Number(listing.booking_requests || 0),
  }))
  const listingIds = popularListings.map((listing) => listing.listing_id)
  const { data: titleRows } = listingIds.length > 0
    ? await supabase.from('listings').select('id, title, area').in('id', listingIds)
    : { data: [] }

  const typedTitleRows: ListingTitle[] = (titleRows || []).map((listing) => ({
    id: listing.id,
    title: listing.title,
    area: listing.area,
  }))
  const popularNeighborhoods: PopularNeighborhood[] = (neighborhoods || []).map((item) => ({
    neighborhood: item.neighborhood,
    search_count: Number(item.search_count || 0),
  }))
  const titlesById = new Map(typedTitleRows.map((listing) => [listing.id, listing]))

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Analytics</h2>
        <p className="mt-2 text-stone-600">
          Watch demand, listing interest, and what guests are trying to find.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Listing views" value={views || 0} />
        <SummaryCard label="Saves" value={saves || 0} />
        <SummaryCard label="Enquiries" value={enquiries || 0} />
        <SummaryCard label="Booking requests" value={bookingRequests || 0} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="border-b border-stone-100 px-6 py-4">
            <h3 className="text-lg font-bold text-stone-950">Top searched neighbourhoods</h3>
            <p className="mt-1 text-sm text-stone-500">Last 30 days</p>
          </div>
          <div className="divide-y divide-stone-100">
            {popularNeighborhoods.map((item, index) => (
              <div key={item.neighborhood} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F8F5F2] text-sm font-bold text-stone-700">
                    {index + 1}
                  </span>
                  <span className="font-semibold text-stone-900">{item.neighborhood}</span>
                </div>
                <span className="text-sm font-semibold text-stone-500">{item.search_count}</span>
              </div>
            ))}
            {!neighborhoods?.length && (
              <div className="px-6 py-10 text-center text-stone-500">No search data yet.</div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="border-b border-stone-100 px-6 py-4">
            <h3 className="text-lg font-bold text-stone-950">Most engaged listings</h3>
            <p className="mt-1 text-sm text-stone-500">Last 30 days</p>
          </div>
          <div className="divide-y divide-stone-100">
            {popularListings.map((listing) => {
              const title = titlesById.get(listing.listing_id)

              return (
                <div
                  key={listing.listing_id}
                  className="grid gap-3 px-6 py-4 md:grid-cols-[1.2fr_repeat(4,0.55fr)] md:items-center"
                >
                  <div>
                    {title ? (
                      <Link href={`/listings/${title.id}`} className="font-semibold text-stone-950 hover:underline">
                        {title.title}
                      </Link>
                    ) : (
                      <p className="font-semibold text-stone-950">Listing</p>
                    )}
                    <p className="mt-1 text-sm text-stone-500">{title?.area || 'Unknown area'}</p>
                  </div>
                  <Metric label="Views" value={listing.views} />
                  <Metric label="Saves" value={listing.saves} />
                  <Metric label="Enquiries" value={listing.enquiries} />
                  <Metric label="Requests" value={listing.booking_requests} />
                </div>
              )
            })}
            {popularListings.length === 0 && (
              <div className="px-6 py-10 text-center text-stone-500">No listing engagement yet.</div>
            )}
          </div>
        </section>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  )
}
