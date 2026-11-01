import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Lock,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react'
import { createPublicClient } from '@/lib/supabase/public'
import { allNeighborhoods, defaultExploreNeighborhoods } from '@/lib/neighborhoods'
import { StaysFilterBar } from '@/components/stays-filter-bar'
import { MobileSearchSheet } from '@/components/mobile-search-sheet'
import { StaysNeighborhoodNav } from '@/components/stays-neighborhood-nav'
import { RecentlyViewed } from '@/components/recently-viewed-home'
import { getListingRatings, type ListingRating } from '@/lib/reviews'
import { ListingCard } from '@/components/listing-card'
import { formatPreferredNightlyPrice } from '@/lib/utils/currency'
import { getYomTovTiles } from '@/lib/yom-tov'

// Public, global content only (featured listings + neighbourhoods; the
// recently-viewed strip is client-side). Cache it via ISR instead of
// re-rendering on every visit — see createPublicClient (cookieless) below.
export const revalidate = 300

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
  cover_photo_url: string | null
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
  rating: ListingRating | null
}

type PopularNeighborhoodRow = {
  neighborhood: string | null
}

export const metadata: Metadata = {
  title: 'Jerusalem Short-Term Stays',
  description:
    'Discover curated, verified short-term stays in Jerusalem. Browse apartments by neighbourhood, dates, and amenities — with expert local support.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Jerusalem Short-Term Stays | JLM Collective',
    description: 'Curated verified stays in Jerusalem with local expertise and real human support.',
    url: '/',
    siteName: 'JLM Collective',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'JLM Collective',
      },
    ],
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

function toFeaturedStay(
  listing: ListingRow & { cover_photo_url?: string | null; rating?: ListingRating | null },
): FeaturedStay {
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
    rating: listing.rating ?? null,
  }
}

async function getHomepageData() {
  try {
    const supabase = createPublicClient()
    const [{ data: listingsData }, { data: neighborhoodsData }] = await Promise.all([
      supabase
        .from('listings')
        .select('id, title, area, bedrooms, max_guests, price_ils, price_usd, booking_type, amenities, latitude, longitude, is_featured, cover_photo_url')
        .eq('is_published', true)
        .eq('is_featured', true)
        .limit(8),
      supabase.rpc('popular_neighborhoods', {
        result_limit: 6,
        lookback_days: 30,
      }),
    ])

    let featuredRows = (listingsData || []) as ListingRow[]
    if (featuredRows.length === 0) {
      const { data: fallbackListingsData } = await supabase
        .from('listings')
        .select('id, title, area, bedrooms, max_guests, price_ils, price_usd, booking_type, amenities, latitude, longitude, is_featured, cover_photo_url')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(8)

      featuredRows = (fallbackListingsData || []) as ListingRow[]
    }
    const featuredIds = featuredRows.map((listing) => listing.id)
    const ratings = await getListingRatings(supabase, featuredIds)
    const featuredStays = featuredRows.length
      ? featuredRows.map((listing) =>
          toFeaturedStay({
            ...listing,
            rating: ratings.get(listing.id) ?? null,
          }),
        )
      : []
    const liveNeighborhoods = ((neighborhoodsData || []) as PopularNeighborhoodRow[])
      .map((row) => row.neighborhood)
      .filter((item): item is string => Boolean(item))
    const popularNeighborhoods = [
      ...liveNeighborhoods,
      ...defaultExploreNeighborhoods,
    ].filter((item, index, items) => items.indexOf(item) === index).slice(0, 6)

    return { featuredStays, popularNeighborhoods }
  } catch (error) {
    console.error('Failed to load homepage data', error)

    return {
      featuredStays: [],
      popularNeighborhoods: defaultExploreNeighborhoods.slice(0, 6),
    }
  }
}

export default async function JLMCollectiveHomePage() {
  const { featuredStays, popularNeighborhoods } = await getHomepageData()
  const yomTovTiles = getYomTovTiles()

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
      <div>
        <section className="pt-8 text-center md:pt-10">
          <div className="mx-auto max-w-7xl px-6 pb-6">
            <h1 className="font-display mx-auto max-w-3xl text-3xl font-bold tracking-tight text-stone-950 md:text-4xl">
              Curated stays in Jerusalem
            </h1>

            <div className="mx-auto mt-6 max-w-4xl">
              <Suspense fallback={<div className="h-14 rounded-full bg-white shadow-sm md:h-16 md:rounded-3xl" />}>
                <MobileSearchSheet>
                  <StaysFilterBar />
                </MobileSearchSheet>
              </Suspense>
            </div>
          </div>
        </section>

        <section aria-label="Browse by neighbourhood" className="mx-auto max-w-7xl px-6">
          <div className="border-b border-stone-200 pb-6">
            <StaysNeighborhoodNav
              neighborhoods={['All', ...allNeighborhoods]}
              featuredNeighborhoods={popularNeighborhoods.slice(0, 4)}
              selectedArea="All"
              baseQuery={{}}
            />
          </div>
        </section>

        {yomTovTiles.length > 0 && (
          <section id="yom-tov" aria-labelledby="yom-tov-heading" className="mx-auto max-w-7xl scroll-mt-[var(--header-h)] pt-9">
            <div className="px-6">
              <h2 id="yom-tov-heading" className="text-2xl font-semibold tracking-tight text-stone-950">
                Yom Tov &amp; kosher stays
              </h2>
            </div>
            {/* Sideways scroll on phones; three columns from sm. */}
            <ul className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-6 px-6 pb-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0">
              {yomTovTiles.map((tile, index) => {
                const featured = index === 0
                return (
                  <li key={tile.slug} className="w-[78%] shrink-0 snap-start sm:w-auto">
                    <Link
                      href={tile.href}
                      className={`relative flex h-full flex-col overflow-hidden rounded-2xl p-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 ${
                        featured
                          ? 'bg-[#c76f55] text-white shadow-sm hover:bg-[#b9644b]'
                          : 'border border-stone-200 bg-white text-stone-950 shadow-sm hover:border-stone-300'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        lang="he"
                        dir="rtl"
                        className={`pointer-events-none absolute -bottom-3 right-3 select-none text-7xl font-bold leading-none ${
                          featured ? 'text-white/15' : 'text-[#c76f55]/10'
                        }`}
                      >
                        {tile.hebrewWord}
                      </span>
                      <span
                        className={`text-[11px] font-bold uppercase tracking-widest ${
                          featured ? 'text-white' : 'text-[#c76f55]'
                        }`}
                      >
                        {tile.timing ?? 'All year'}
                      </span>
                      <span className="font-heading mt-2 text-lg font-semibold">{tile.title}</span>
                      <span className={`mt-1 text-sm leading-6 ${featured ? 'text-white' : 'text-stone-600'}`}>
                        {tile.blurb}
                      </span>
                      {tile.civilDate && tile.hebrewDate ? (
                        <span className={`relative mt-4 text-xs leading-5 ${featured ? 'text-white' : 'text-stone-500'}`}>
                          Begins {tile.civilDate}
                          <span className="block">{tile.hebrewDate}</span>
                        </span>
                      ) : (
                        <span className={`relative mt-4 text-xs leading-5 ${featured ? 'text-white' : 'text-stone-500'}`}>
                          Every stay shows its kitchen level
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section id="stays" className="mx-auto max-w-7xl px-6 pt-9">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
              Featured stays
            </h2>
            <Link
              href="/map"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#c76f55] hover:underline"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Show map
            </Link>
          </div>

          {featuredStays.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
              {featuredStays.map((stay) => (
                <ListingCard
                  key={stay.id}
                  listing={{
                    id: stay.id,
                    title: stay.title,
                    area: stay.area,
                    bedrooms: stay.bedrooms,
                    max_guests: stay.max_guests,
                    coverPhotoUrl: stay.coverPhotoUrl ?? null,
                    rating: stay.rating,
                    priceLabel: formatPreferredNightlyPrice(stay),
                    priceUsd: stay.price_usd,
                    priceIls: stay.price_ils,
                    hasPrice: Boolean(stay.price_ils || stay.price_usd),
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-stone-200 bg-white/60 px-6 py-16 text-center">
              <p className="font-heading text-xl font-semibold text-stone-950">New stays coming soon</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
                We&apos;re adding beautiful Jerusalem stays. Check back shortly, or send an enquiry
                and our local team will help you find the right place.
              </p>
            </div>
          )}

          <div className="pt-10">
            <RecentlyViewed />
          </div>
        </section>

        <section aria-label="Why book with JLM Collective" className="mx-auto max-w-7xl px-6 pt-12">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 border-t border-stone-200 pt-8 text-sm text-stone-600">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#c76f55]" aria-hidden="true" />
              Personally reviewed stays
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
                <h2 className="text-lg font-semibold tracking-tight">Have a Jerusalem stay to list?</h2>
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

