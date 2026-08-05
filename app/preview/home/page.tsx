import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowUpDown,
  Building2,
  Home,
  Landmark,
  LayoutGrid,
  Lock,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Tent,
  Trees,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { sampleListings } from '@/lib/sample-listings'
import { defaultExploreNeighborhoods } from '@/lib/neighborhoods'
import { slugifyNeighborhood } from '@/lib/neighborhood-pages'
import { HomeSearchForm } from '@/components/home-search-form'
import { PreviewImage } from '@/components/preview-image'

// Draft of the photo-led homepage (option 2: clean cream hero, editorial body).
// Lives at /preview/home so the live homepage is untouched. Not indexed.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Homepage preview',
  robots: { index: false, follow: false },
}

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
  sort_order?: number | null
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
  sample?: boolean
}

type PopularNeighborhoodRow = {
  neighborhood: string | null
}

type CategoryChip = {
  label: string
  href: string
  Icon: LucideIcon
}

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

const neighbourhoodIcons: LucideIcon[] = [Building2, Trees, Home, Landmark, MapPin]

// Illustrated Jerusalem scenes are the final fallback behind the stock photos.
const placeholderScenes = [
  '/preview-placeholders/scene-1.svg',
  '/preview-placeholders/scene-2.svg',
  '/preview-placeholders/scene-3.svg',
  '/preview-placeholders/scene-4.svg',
  '/preview-placeholders/scene-5.svg',
]

// Preview-only real stock photography, fetched in the visitor's browser. Keyed
// so each card/tile is stable. Swapped for real listing photos in production.
function stockPhoto(keywords: string, seed: number) {
  return `https://loremflickr.com/640/480/${keywords}?lock=${seed}`
}
function stockFallback(seed: number) {
  return `https://picsum.photos/seed/jlm-${seed}/640/480`
}

// Preview-only: pad the grid with sample cards so the dense layout is visible
// even before real listings exist. Real listings always come first.
const sampleTitles = [
  'Sunlit garden apartment',
  'Stone-walled retreat',
  'Quiet courtyard flat',
  'Rooftop studio',
  'Family maisonette',
  'Bright city-view home',
  'Restored heritage flat',
  'Peaceful lane house',
]

function padFeatured(stays: FeaturedStay[], neighbourhoods: string[], target: number): FeaturedStay[] {
  const result = [...stays]
  let index = 0
  while (result.length < target) {
    const area = neighbourhoods[index % neighbourhoods.length] || 'Jerusalem'
    result.push({
      id: `sample-${index}`,
      title: sampleTitles[index % sampleTitles.length],
      area,
      bedrooms: (index % 3) + 1,
      max_guests: (index % 4) + 2,
      price_ils: null,
      price_usd: 150 + (index % 5) * 30,
      is_featured: null,
      coverPhotoUrl: null,
      sample: true,
    })
    index += 1
  }
  return result
}

function buildCategoryChips(popularNeighborhoods: string[]): CategoryChip[] {
  const neighbourhoodChips = popularNeighborhoods.slice(0, 5).map((area, index) => ({
    label: area,
    href: `/neighbourhoods/${slugifyNeighborhood(area)}`,
    Icon: neighbourhoodIcons[index % neighbourhoodIcons.length] ?? MapPin,
  }))

  return [
    { label: 'All stays', href: '/stays', Icon: LayoutGrid },
    ...neighbourhoodChips,
    { label: 'Lift access', href: `/stays?feature=${encodeURIComponent('Lift access')}`, Icon: ArrowUpDown },
    { label: 'Sukkah option', href: `/stays?feature=${encodeURIComponent('Sukkah option')}`, Icon: Tent },
  ]
}

async function getHomepageData() {
  try {
    const supabase = await createClient()
    const [{ data: listingsData }, { data: neighborhoodsData }] = await Promise.all([
      supabase
        .from('listings')
        .select('id, title, area, bedrooms, max_guests, price_ils, price_usd, booking_type, amenities, latitude, longitude, is_featured')
        .eq('is_published', true)
        .eq('is_featured', true)
        .limit(12),
      supabase.rpc('popular_neighborhoods', {
        result_limit: 6,
        lookback_days: 30,
      }),
    ])

    let featuredRows = (listingsData || []) as ListingRow[]
    if (featuredRows.length === 0) {
      const { data: fallbackListingsData } = await supabase
        .from('listings')
        .select('id, title, area, bedrooms, max_guests, price_ils, price_usd, booking_type, amenities, latitude, longitude, is_featured')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(12)

      featuredRows = (fallbackListingsData || []) as ListingRow[]
    }
    const featuredIds = featuredRows.map((listing) => listing.id)
    const { data: photoData } = featuredIds.length
      ? await supabase
          .from('listing_photos')
          .select('listing_id, photo_url, is_cover, sort_order')
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
  } catch (error) {
    console.error('Failed to load homepage preview data', error)

    return {
      featuredStays: defaultFeatured,
      popularNeighborhoods: defaultExploreNeighborhoods.slice(0, 6),
    }
  }
}

export default async function HomePreviewPage() {
  const { featuredStays, popularNeighborhoods } = await getHomepageData()
  const categoryChips = buildCategoryChips(popularNeighborhoods)

  const displayStays = padFeatured(featuredStays, popularNeighborhoods, 12)
  const tileNeighbourhoods = popularNeighborhoods.slice(0, 6)

  return (
    <div className="min-h-screen bg-[#F8F5F2] text-[#2D2D2D] antialiased">
      <div className="bg-[#252525] px-6 py-2 text-center text-xs text-stone-300">
        Homepage preview — not live.{' '}
        <Link href="/" className="font-semibold text-white underline">
          View current homepage
        </Link>
      </div>

      <div>
        {/* Clean, cream, text-led hero — same fast top as today */}
        <section className="pt-10 text-center md:pt-14">
          <div className="mx-auto max-w-7xl px-6 pb-8">
            <h1 className="font-display mx-auto max-w-3xl text-3xl font-bold tracking-tight text-stone-950 md:text-4xl">
              Curated stays in Jerusalem
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-stone-500 md:text-base">
              A small, hand-picked collection of homes across the city.
            </p>

            <div className="mt-7">
              <HomeSearchForm />
            </div>
          </div>
        </section>

        <section aria-label="Browse by category" className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap justify-center gap-2 border-b border-stone-200 pb-8">
            {categoryChips.map((chip, index) => (
              <Link
                key={chip.label}
                href={chip.href}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  index === 0
                    ? 'bg-[#252525] text-white hover:bg-[#111111]'
                    : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:ring-stone-400'
                }`}
              >
                <chip.Icon className="h-4 w-4" aria-hidden="true" />
                {chip.label}
              </Link>
            ))}
          </div>
        </section>

        {/* Photo-led body starts here */}
        <section id="stays" className="mx-auto max-w-7xl px-6 pt-10">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-bold tracking-tight text-stone-950">
              Featured stays
            </h2>
            <Link href="/stays" className="text-sm font-semibold text-[#c76f55] hover:underline">
              View all
            </Link>
          </div>

          {/* Airbnb-style density: 2 on mobile, 3 tablet, 5 desktop, 6 wide. */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {displayStays.map((stay, index) => (
              <FeaturedCard key={stay.id} listing={stay} sceneIndex={index} />
            ))}
          </div>
        </section>

        <section aria-label="Explore by neighbourhood" className="mx-auto max-w-7xl px-6 pt-12">
          <h2 className="font-display mb-5 text-2xl font-bold tracking-tight text-stone-950">
            Explore by neighbourhood
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {tileNeighbourhoods.map((area, index) => (
              <NeighbourhoodTile
                key={area}
                area={area}
                scene={placeholderScenes[(index + 1) % placeholderScenes.length]}
                sceneIndex={index}
              />
            ))}
          </div>
        </section>

        <section aria-label="Why book with JLM Collective" className="mx-auto max-w-7xl px-6 pt-14">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 border-t border-stone-200 pt-8 text-sm text-stone-600">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#c76f55]" aria-hidden="true" />
              Verified hosts
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#c76f55]" aria-hidden="true" />
              Local Jerusalem team
            </span>
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#c76f55]" aria-hidden="true" />
              Secure payment
            </span>
            <span className="inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#c76f55]" aria-hidden="true" />
              Real human support
            </span>
          </div>
        </section>

        <section id="owner" className="mx-auto max-w-7xl px-6 pb-16 pt-12">
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-[#252525] shadow-sm">
            <div className="flex flex-col gap-4 p-5 text-white md:flex-row md:items-center md:justify-between md:p-6">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight">Have a Jerusalem stay to list?</h2>
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
      </div>
    </div>
  )
}

function FeaturedCard({ listing, sceneIndex }: { listing: FeaturedStay; sceneIndex: number }) {
  const sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw'
  const scene = placeholderScenes[sceneIndex % placeholderScenes.length]
  const stayHref = listing.sample ? '/stays' : `/listings/${listing.id}?from=stays`

  return (
    <div className="group">
      <Link href={stayHref} className="block">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-stone-100">
          {listing.coverPhotoUrl ? (
            <Image
              src={listing.coverPhotoUrl}
              alt={listing.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes={sizes}
              loading="lazy"
            />
          ) : (
            <PreviewImage
              src={stockPhoto('apartment,interior', sceneIndex + 1)}
              fallbackSrc={stockFallback(sceneIndex + 1)}
              scene={scene}
              alt={`Example interior for a stay in ${listing.area}`}
            />
          )}
        </div>
      </Link>

      <div className="mt-2.5">
        <Link href={stayHref} className="block">
          <p className="line-clamp-1 text-sm font-semibold leading-snug text-stone-950">
            {listing.title}
          </p>
          <p className="text-[13px] text-stone-500">
            {[
              listing.area,
              listing.max_guests ? `sleeps ${listing.max_guests}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="pt-0.5 text-sm text-stone-950">
            <span className="font-semibold">{formatFeaturedPrice(listing)}</span>
            {(listing.price_ils || listing.price_usd) && (
              <span className="text-stone-500"> night</span>
            )}
          </p>
        </Link>
      </div>
    </div>
  )
}

function NeighbourhoodTile({
  area,
  scene,
  sceneIndex,
}: {
  area: string
  scene: string
  sceneIndex: number
}) {
  return (
    <Link
      href={`/neighbourhoods/${slugifyNeighborhood(area)}`}
      className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl bg-stone-200 p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <PreviewImage
        src={stockPhoto('jerusalem,architecture,street', sceneIndex + 20)}
        fallbackSrc={stockFallback(sceneIndex + 20)}
        scene={scene}
        alt={`${area} neighbourhood`}
      />
      <span className="absolute inset-0 bg-black/25 transition group-hover:bg-black/35" aria-hidden="true" />
      <span className="relative text-sm font-semibold text-white drop-shadow">{area}</span>
    </Link>
  )
}

function formatFeaturedPrice(listing: Pick<FeaturedStay, 'price_ils' | 'price_usd'>) {
  if (listing.price_usd) return `$${Number(listing.price_usd).toLocaleString()}`
  if (listing.price_ils) return `₪${Number(listing.price_ils).toLocaleString()}`
  return 'Price on request'
}
