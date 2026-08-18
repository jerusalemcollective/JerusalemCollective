import Link from 'next/link'
import Image from 'next/image'
import { requireAdminPermission } from '@/lib/admin'
import { archiveListing, deleteListing, updateListingVisibility } from '@/app/admin/listing-actions'
import { ConfirmSubmitButton } from '@/components/confirm-submit-button'
import { ListingQualityScore } from '@/components/listing-quality-score'
import { Pagination, normalizePaginationSearchParams, type PaginationSearchParams } from '@/components/pagination'
import { calculateListingScore } from '@/lib/marketplace-rules'
import { oneOrNull } from '@/lib/utils/one-or-null'

const PAGE_SIZE = 25

type ListingRow = {
  id: string
  title: string
  area: string
  host_id: string
  is_published: boolean
  is_featured: boolean
  admin_status: string | null
  archived_at: string | null
  bedrooms: number | null
  bathrooms: number | null
  max_guests: number | null
  sleeping_setup: string | null
  amenities: string[] | null
  description: string | null
  house_rules: string | null
  price_usd: number | null
  price_ils: number | null
  walking_minutes_to_kotel: number | null
  american_comfort: boolean | null
  created_at: string
  hosts?: {
    name: string
  } | null
}

type ListingPhotoRow = {
  listing_id: string | null
  photo_url: string
  is_cover: boolean
  sort_order: number
}

type ListingShulDistanceRow = {
  listing_id: string | null
}

type ListingQueryRow = Omit<ListingRow, 'hosts'> & {
  hosts?: ListingRow['hosts'] | NonNullable<ListingRow['hosts']>[] | null
}

// One filter row. Each pill maps to the underlying published/status params, so a
// single "All" resets everything instead of the old two stacked "All" pills.
const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Live', value: 'live' },
  { label: 'Hidden', value: 'hidden' },
  { label: 'Needs work', value: 'needs_work' },
  { label: 'Ready for launch', value: 'ready_for_launch' },
] as const

function buildAdminUrl(
  basePath: string,
  currentParams: Record<string, string | undefined>,
  updates: Record<string, string>,
): string {
  const params = new URLSearchParams()
  Object.entries({
    ...currentParams,
    ...updates,
    page: '1',
  }).forEach(([key, value]) => {
    if (value && value !== 'all') {
      params.set(key, value)
    }
  })
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function filterUrl(currentParams: Record<string, string | undefined>, value: string) {
  const published = value === 'live' ? 'live' : value === 'hidden' ? 'hidden' : 'all'
  const status = value === 'needs_work' || value === 'ready_for_launch' ? value : 'all'
  return buildAdminUrl('/admin/listings', currentParams, { published, status })
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams?: Promise<PaginationSearchParams>
}) {
  const { supabase } = await requireAdminPermission('listings')
  const currentSearchParams = normalizePaginationSearchParams(searchParams ? await searchParams : {})
  const publishedFilter = currentSearchParams.published || 'all'
  const statusFilter = currentSearchParams.status || 'all'
  const activeFilter =
    publishedFilter === 'live'
      ? 'live'
      : publishedFilter === 'hidden'
        ? 'hidden'
        : statusFilter === 'needs_work'
          ? 'needs_work'
          : statusFilter === 'ready_for_launch'
            ? 'ready_for_launch'
            : 'all'
  const page = Math.max(1, Number(currentSearchParams.page) || 1)
  let listingsQuery = supabase
    .from('listings')
    .select('id, title, area, host_id, is_published, is_featured, admin_status, archived_at, bedrooms, bathrooms, max_guests, sleeping_setup, amenities, description, house_rules, price_usd, price_ils, walking_minutes_to_kotel, american_comfort, created_at, hosts(name)')
    .order('created_at', { ascending: false })
  let countQuery = supabase.from('listings').select('*', { count: 'exact', head: true })

  if (publishedFilter === 'live') {
    listingsQuery = listingsQuery.eq('is_published', true)
    countQuery = countQuery.eq('is_published', true)
  } else if (publishedFilter === 'hidden') {
    listingsQuery = listingsQuery.eq('is_published', false)
    countQuery = countQuery.eq('is_published', false)
  }

  if (['needs_work', 'ready_for_launch'].includes(statusFilter)) {
    listingsQuery = listingsQuery.eq('admin_status', statusFilter)
    countQuery = countQuery.eq('admin_status', statusFilter)
  }

  const [{ data }, { count }] = await Promise.all([
    listingsQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    countQuery,
  ])

  const listings: ListingRow[] = (data || []).map((listing: ListingQueryRow) => ({
    ...listing,
    hosts: oneOrNull(listing.hosts),
  }))
  const listingIds = listings.map((listing) => listing.id)
  const [{ data: photos }, { data: shulDistances }] = await Promise.all([
    listingIds.length
      ? supabase
          .from('listing_photos')
          .select('listing_id, photo_url, is_cover, sort_order')
          .in('listing_id', listingIds)
          .order('is_cover', { ascending: false })
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] }),
    listingIds.length
      ? supabase
          .from('listing_shul_distances')
          .select('listing_id')
          .in('listing_id', listingIds)
      : Promise.resolve({ data: [] }),
  ])

  // Cover photo + photo count per listing (rows arrive cover-first, then by order).
  const photoRows = (photos || []) as ListingPhotoRow[]
  const coverByListing = new Map<string, string>()
  const photoCounts = new Map<string, number>()
  for (const photo of photoRows) {
    if (!photo.listing_id) continue
    photoCounts.set(photo.listing_id, (photoCounts.get(photo.listing_id) || 0) + 1)
    if (!coverByListing.has(photo.listing_id)) coverByListing.set(photo.listing_id, photo.photo_url)
  }
  const shulDistanceCounts = countShulDistancesByListing((shulDistances || []) as ListingShulDistanceRow[])
  const total = count || 0

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-stone-950">Listings</h2>
        <Link
          href="/admin/listings/new"
          className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-stone-800"
        >
          Create listing
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={filterUrl(currentSearchParams, option.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeFilter === option.value
                ? 'bg-stone-950 text-white'
                : 'border border-stone-200 bg-white text-stone-700 hover:border-stone-300'
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {listings.length === 0 ? (
        <div className="rounded-3xl bg-white px-6 py-12 text-center text-stone-500 shadow-sm">
          No listings match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const cover = coverByListing.get(listing.id)
            const score = calculateListingScore({
              photo_count: photoCounts.get(listing.id) || 0,
              description: listing.description,
              bedrooms: listing.bedrooms,
              bathrooms: listing.bathrooms,
              sleeping_setup: listing.sleeping_setup,
              amenities: listing.amenities || [],
              price_usd: listing.price_usd,
              price_ils: listing.price_ils,
            })
            const suggestions = listingQaSuggestions(
              listing,
              photoCounts.get(listing.id) || 0,
              shulDistanceCounts.get(listing.id) || 0,
            )
            const meta = `${listing.bedrooms ?? '-'} ${listing.bedrooms === 1 ? 'bedroom' : 'bedrooms'} · sleeps ${listing.max_guests ?? '-'}`

            return (
              <article
                key={listing.id}
                className={`rounded-2xl border border-[#eee7e0] bg-white p-4 shadow-sm md:p-5 ${
                  listing.archived_at ? 'opacity-75' : ''
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative hidden h-28 w-40 shrink-0 overflow-hidden rounded-xl bg-stone-200 sm:block">
                    {cover ? (
                      <Image src={cover} alt={listing.title} fill className="object-cover" sizes="160px" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-stone-200 to-stone-300" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{listing.area}</p>
                        <Link
                          href={`/admin/listings/${listing.id}`}
                          className="mt-0.5 block text-lg font-bold text-stone-950 hover:underline"
                        >
                          {listing.title}
                        </Link>
                        <p className="mt-0.5 text-sm text-stone-600">
                          {meta} · <span className="text-stone-500">{listing.hosts?.name || 'Host'}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {listing.archived_at ? (
                          <span className="rounded-full bg-stone-800 px-2.5 py-1 text-[11px] font-bold text-white">
                            Archived
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                              listing.is_published ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${listing.is_published ? 'bg-green-600' : 'bg-stone-400'}`} />
                            {listing.is_published ? 'Live' : 'Hidden'}
                          </span>
                        )}
                        {listing.admin_status !== 'live' && (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">
                            {adminStatusLabel(listing.admin_status)}
                          </span>
                        )}
                        {listing.is_featured && (
                          <span className="rounded-full bg-[#fff4ef] px-2.5 py-1 text-[11px] font-bold text-[#c76f55]">
                            Featured
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 max-w-xl">
                      <ListingQualityScore score={score} label="Listing strength" />
                      {suggestions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {suggestions.map((suggestion) => (
                            <span
                              key={suggestion}
                              className="rounded-full bg-[#fff4ef] px-2.5 py-1 text-[11px] font-semibold text-[#a95b45]"
                            >
                              {suggestion}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {listing.archived_at ? (
                        <form action={archiveListing}>
                          <input type="hidden" name="listingId" value={listing.id} />
                          <input type="hidden" name="restore" value="true" />
                          <ConfirmSubmitButton
                            message="Restore this listing? It will return to the admin list as hidden, so you can review it before publishing."
                            className="rounded-full bg-[#252525] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#111111]"
                          >
                            Restore
                          </ConfirmSubmitButton>
                        </form>
                      ) : (
                        <>
                          <form action={updateListingVisibility}>
                            <input type="hidden" name="listingId" value={listing.id} />
                            <input type="hidden" name="field" value="is_published" />
                            <input type="hidden" name="value" value={String(!listing.is_published)} />
                            <ConfirmSubmitButton
                              message={listing.is_published ? 'Hide this listing from the public site?' : 'Publish this listing to the public site?'}
                              className="rounded-full border border-stone-300 px-4 py-2 text-xs font-bold text-stone-700 transition hover:border-stone-400"
                            >
                              {listing.is_published ? 'Hide' : 'Publish'}
                            </ConfirmSubmitButton>
                          </form>
                          <form action={updateListingVisibility}>
                            <input type="hidden" name="listingId" value={listing.id} />
                            <input type="hidden" name="field" value="is_featured" />
                            <input type="hidden" name="value" value={String(!listing.is_featured)} />
                            <ConfirmSubmitButton
                              message={listing.is_featured ? 'Remove this listing from the featured set?' : 'Feature this listing on the homepage?'}
                              className="rounded-full border border-stone-300 px-4 py-2 text-xs font-bold text-stone-700 transition hover:border-stone-400"
                            >
                              {listing.is_featured ? 'Unfeature' : 'Feature'}
                            </ConfirmSubmitButton>
                          </form>
                        </>
                      )}

                      <Link
                        href={`/admin/listings/${listing.id}`}
                        className="rounded-full border border-stone-300 px-4 py-2 text-xs font-bold text-stone-700 transition hover:border-stone-400"
                      >
                        Edit
                      </Link>

                      {!listing.archived_at && (
                        <form action={archiveListing}>
                          <input type="hidden" name="listingId" value={listing.id} />
                          <ConfirmSubmitButton
                            message="Archive this listing? It comes off the public site immediately and keeps its booking history. You can restore it at any time."
                            className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
                          >
                            Archive
                          </ConfirmSubmitButton>
                        </form>
                      )}

                      <form action={deleteListing}>
                        <input type="hidden" name="listingId" value={listing.id} />
                        <ConfirmSubmitButton
                          message="Delete this listing permanently? This cannot be undone. If it has bookings or reviews the delete will be refused - archive it instead."
                          className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} basePath="/admin/listings" searchParams={currentSearchParams} />
    </div>
  )
}

function countShulDistancesByListing(distances: ListingShulDistanceRow[]) {
  const counts = new Map<string, number>()

  distances.forEach((distance) => {
    if (!distance.listing_id) return
    counts.set(distance.listing_id, (counts.get(distance.listing_id) || 0) + 1)
  })

  return counts
}

function listingQaSuggestions(
  listing: ListingRow,
  photoCount: number,
  shulDistanceCount: number,
) {
  const suggestions: string[] = []

  if (photoCount < 5) suggestions.push('Add at least five photos before publishing.')
  if (!listing.price_usd && !listing.price_ils) suggestions.push('Add a clear nightly price.')
  if (!listing.sleeping_setup?.trim()) suggestions.push('Add the sleeping setup.')
  if (!listing.house_rules?.trim()) suggestions.push('Add house rules for guests.')
  if (!listing.walking_minutes_to_kotel && shulDistanceCount === 0) {
    suggestions.push('Add shul or Old City walking distance.')
  }
  if (!listing.american_comfort) suggestions.push('Confirm American comfort details.')

  return suggestions.slice(0, 4)
}

function adminStatusLabel(status: string | null) {
  if (status === 'ready_for_launch') return 'Ready'
  if (status === 'live') return 'Live'
  return 'Needs work'
}
