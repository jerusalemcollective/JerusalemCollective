import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { sampleListings } from '@/lib/sample-listings'
import { defaultExploreNeighborhoods } from '@/lib/neighborhoods'
import { slugifyNeighborhood } from '@/lib/neighborhood-pages'
import { HomeNeighborhoodSearch, HomeSearchForm } from '@/components/home-search-form'
import { HomeMapSection } from '@/components/home-map-section'

type ListingRow = {
  id: string
  title: string
  area: string
  bedrooms: number | null
  max_guests: number | null
  price_ils: number | null
  price_usd: number | null
  booking_type: string | null
  amenities: string[] | null
  latitude: number | null
  longitude: number | null
  is_featured?: boolean | null
}

type ListingPhotoRow = {
  listing_id: string | null
  photo_url: string
  is_cover?: boolean | null
}

type FeaturedStay = {
  id: string
  title: string
  area: string
  bedrooms: number | null
  max_guests: number | null
  price_ils: number | null
  price_usd: number | null
  is_featured?: boolean | null
  coverPhotoUrl: string | null
}

type PopularNeighborhoodRow = {
  neighborhood: string | null
}

export const metadata: Metadata = {
  title: 'Jerusalem Short-Term Stays | JLM Collective',
  description:
    'Discover curated, verified short-term stays in Jerusalem. Browse apartments by neighbourhood, dates, and amenities — with expert local support.',
  openGraph: {
    title: 'Jerusalem Short-Term Stays | JLM Collective',
    description: 'Curated verified stays in Jerusalem with local expertise and real human support.',
    url: 'https://jlmcollective.co',
    siteName: 'JLM Collective',
    images: [
      {
        url: '/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp',
        width: 1200,
        height: 630,
        alt: 'JLM Collective',
      },
    ],
    locale: 'en_GB',
    type: 'website',
  },
}

const baseExploreBlocks = [
  {
    label: 'Themes',
    title: 'Search by what matters',
    items: [
      'Family stays',
      'Shabbos-friendly',
      'Near shuls',
      'Lift access',
      'Sukkah option',
      'Longer visits',
    ],
  },
  {
    label: 'Stay types',
    title: 'Choose your setup',
    items: [
      'Apartments',
      'Garden flats',
      'Penthouses',
      'Large homes',
      'Ground floor',
      'Private entrance',
    ],
  },
]

function toFeaturedStay(listing: ListingRow & { cover_photo_url?: string | null }): FeaturedStay {
  return {
    id: listing.id,
    title: listing.title,
    area: listing.area,
    bedrooms: listing.bedrooms,
    max_guests: listing.max_guests,
    price_ils: listing.price_ils,
    price_usd: listing.price_usd,
    is_featured: listing.is_featured ?? null,
    coverPhotoUrl: listing.cover_photo_url || null,
  }
}

const defaultFeatured = sampleListings.map((listing) => toFeaturedStay(listing))

function getExploreHref(blockLabel: string, item: string) {
  const params = new URLSearchParams()

  if (blockLabel === 'Neighbourhoods') return `/neighbourhoods/${slugifyNeighborhood(item)}`
  if (blockLabel === 'Themes') params.set('feature', item)
  if (blockLabel === 'Stay types') params.set('type', item)

  return `/stays?${params.toString()}`
}

async function getHomepageData() {
  const supabase = await createClient()
  const [{ data: listingsData }, { data: neighborhoodsData }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, title, area, bedrooms, max_guests, price_ils, price_usd, booking_type, amenities, latitude, longitude, is_featured')
      .eq('is_published', true)
      .eq('is_featured', true)
      .limit(6),
    supabase.rpc('popular_neighborhoods', {
      result_limit: 6,
      lookback_days: 30,
    }),
  ])

  const featuredRows = (listingsData || []) as ListingRow[]
  const featuredIds = featuredRows.map((listing) => listing.id)
  const { data: photoData } = featuredIds.length
    ? await supabase
        .from('listing_photos')
        .select('listing_id, photo_url, is_cover')
        .in('listing_id', featuredIds)
        .order('is_cover', { ascending: false })
        .order('sort_order', { ascending: true })
    : { data: [] }
  const coverPhotoByListingId = new Map<string, string>()
  ;((photoData || []) as ListingPhotoRow[]).forEach((photo) => {
    if (photo.listing_id && !coverPhotoByListingId.has(photo.listing_id)) {
      coverPhotoByListingId.set(photo.listing_id, photo.photo_url)
    }
  })

  const featuredStays = featuredRows.length
    ? featuredRows.map((listing) =>
        toFeaturedStay({
          ...listing,
          cover_photo_url: coverPhotoByListingId.get(listing.id) || null,
        }),
      )
    : defaultFeatured
  const liveNeighborhoods = ((neighborhoodsData || []) as PopularNeighborhoodRow[])
    .map((row) => row.neighborhood)
    .filter((item): item is string => Boolean(item))
  const popularNeighborhoods = [
    ...liveNeighborhoods,
    ...defaultExploreNeighborhoods,
  ].filter((item, index, items) => items.indexOf(item) === index).slice(0, 6)

  return { featuredStays, popularNeighborhoods }
}

export default async function JLMCollectiveHomePage() {
  const { featuredStays, popularNeighborhoods } = await getHomepageData()
  const exploreBlocks = [
    {
      label: 'Neighbourhoods',
      title: 'Popular areas',
      items: popularNeighborhoods.slice(0, 6),
    },
    ...baseExploreBlocks,
  ]

  return (
    <div className="min-h-screen bg-[#F8F5F2] text-[#2D2D2D] antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'JLM Collective',
            url: 'https://jlmcollective.co',
            description: 'Curated short-term stays in Jerusalem',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://jlmcollective.co/stays?area={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
      <main>
        <section className="mx-auto max-w-7xl px-6 pb-12 pt-16 text-center md:pt-20">
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-stone-200">
            <ShieldIcon className="text-[#c76f55]" />
            <span>Curated Jerusalem listings</span>
          </div>

          <div className="mx-auto mb-8 max-w-4xl">
            <h1 className="font-display text-4xl font-bold tracking-tight text-stone-950 md:text-6xl">
              Discover places to stay in Jerusalem
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-stone-600 md:text-lg">
              Short-term Jerusalem homes, beautifully organised in one place.
            </p>
          </div>

          <HomeSearchForm />

          <Link
            href="/stays?view=map"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 shadow-sm hover:border-stone-500"
          >
            <MapPinIcon className="text-[#c76f55]" />
            Open map view
          </Link>
        </section>

        <section id="explore" className="mx-auto max-w-7xl px-6 pb-8 pt-6">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Explore</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">
                Start with the Jerusalem that suits you
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                From quiet family streets to central locations, explore stays by
                area, setup and trip style.
              </p>
            </div>
            <Link
              href="/stays"
              className="w-fit rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 shadow-sm hover:border-stone-500"
            >
              View all collections
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {exploreBlocks.map((block) => (
              <div key={block.label} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-500">{block.label}</p>
                <h3 className="font-display mt-3 text-lg font-bold text-stone-950">{block.title}</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {block.items.map((item) => (
                    <Link
                      key={item}
                      href={getExploreHref(block.label, item)}
                      className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-200"
                    >
                      {item}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-3xl border border-stone-200 bg-[#252525] p-5 text-white shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-[#d9937e]">Seasonal</p>
              <h3 className="mt-3 text-lg font-bold">Planning around busy dates?</h3>
              <p className="mt-3 text-sm leading-6 text-stone-300">
                Browse stays for Yom Tov, summer visits and longer family trips.
              </p>
              <Link
                href="/stays?season=busy-dates"
                className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-950 hover:bg-stone-100"
              >
                See seasonal stays
              </Link>
            </div>
          </div>
        </section>

        <section id="stays" className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight text-stone-900">Featured stays</h2>
                <p className="text-xs text-stone-500">Browse current listings across Jerusalem</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/stays" className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-[10px] font-bold text-stone-700 shadow-sm hover:bg-stone-50">
                  Filters
                </Link>
                <Link href="/map" className="inline-flex items-center gap-1.5 rounded-full bg-[#252525] px-3 py-1.5 text-[10px] font-bold text-white shadow-sm hover:bg-[#111111]">
                  <MapPinIcon className="h-3 w-3" />
                  Map
                </Link>
              </div>
            </div>

            <HomeNeighborhoodSearch popularNeighborhoods={popularNeighborhoods.slice(0, 4)} />

            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {featuredStays.map((stay) => (
                <HomeListingCard key={stay.id} listing={stay} />
              ))}
            </div>
          </div>

          <HomeMapSection />
        </section>

        <section id="saved" className="mx-auto max-w-7xl px-6 pb-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
                  <SavedStayIcon className="h-full w-full" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-stone-900">Keep track of stays you like</h2>
                  <p className="text-xs text-stone-500">
                    Your saved properties will appear here once favourites are connected.
                  </p>
                </div>
              </div>
              <Link href="/host/register" className="w-fit rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-800 shadow-sm hover:border-stone-500">
                Create account
              </Link>
            </div>
          </div>
        </section>

        <section id="owner" className="mx-auto max-w-7xl px-6 pb-12 pt-4">
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-[#252525] shadow-sm">
            <div className="flex flex-col gap-4 p-5 text-white md:flex-row md:items-center md:justify-between md:p-6">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Have a Jerusalem stay to list?</h2>
                <p className="mt-1 max-w-xl text-xs leading-5 text-stone-300">
                  Add your property, set your details, and submit it for approval.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link href="/become-a-host" className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-stone-100">
                  List your stay
                </Link>
                <Link href="/become-a-host" className="rounded-full border border-white/25 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function HomeListingCard({ listing }: { listing: FeaturedStay }) {
  return (
    <Link
      href={`/listings/${listing.id}?from=stays`}
      className="group block"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100 shadow-sm transition-shadow duration-200 group-hover:shadow-md">
        {listing.coverPhotoUrl ? (
          <Image
            src={listing.coverPhotoUrl}
            alt={listing.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#F8F5F2]">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#c76f55]">JLM Collective</p>
              <p className="mt-1 text-xs text-stone-400">Photo coming soon</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-0.5">
        <Link
          href={`/neighbourhoods/${slugifyNeighborhood(listing.area)}`}
          className="text-[11px] font-bold uppercase tracking-widest text-[#c76f55] hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {listing.area}
        </Link>
        <p className="line-clamp-1 font-semibold leading-snug text-stone-950">
          {listing.title}
        </p>
        <p className="text-sm text-stone-500">
          {[
            listing.bedrooms ? `${listing.bedrooms} bed` : null,
            listing.max_guests ? `sleeps ${listing.max_guests}` : null,
          ]
            .filter(Boolean)
            .join(' \u00b7 ')}
        </p>
        <p className="pt-1 text-sm font-semibold text-stone-950">
          {formatFeaturedPrice(listing)}
          {(listing.price_ils || listing.price_usd) && (
            <span className="font-normal text-stone-500"> / night</span>
          )}
        </p>
      </div>
    </Link>
  )
}

function formatFeaturedPrice(listing: Pick<FeaturedStay, 'price_ils' | 'price_usd'>) {
  if (listing.price_usd) return `$${Number(listing.price_usd).toLocaleString()}`
  if (listing.price_ils) return `\u20aa${Number(listing.price_ils).toLocaleString()}`
  return 'Price on request'
}

function SavedStayIcon({ className = '' }: { className?: string }) {
  return (
    <img src="/icons/yemin-moshe-save-ui.webp" alt="" aria-hidden="true" className={`rounded-full object-cover ${className}`} />
  )
}

function MapPinIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}

function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}


