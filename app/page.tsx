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
import { getLiveNeighborhoods, pickFeaturedAreas } from '@/lib/live-areas'
import { StaysFilterBar } from '@/components/stays-filter-bar'
import { StaysNeighborhoodNav } from '@/components/stays-neighborhood-nav'
import { RecentlyViewed } from '@/components/recently-viewed-home'
import { HomeFeaturedStays, HomeFeaturedStaysSkeleton } from '@/components/home-featured-stays'

// Public, global content only (featured listings + neighbourhoods; the
// recently-viewed strip is client-side). Cache it via ISR instead of
// re-rendering on every visit — see createPublicClient (cookieless) below.
export const revalidate = 300

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

// Area chips: only neighbourhoods with at least one published stay. The
// featured listings themselves stream in via HomeFeaturedStays.
async function getHomepageData() {
  try {
    const supabase = createPublicClient()
    const [{ data: neighborhoodsData }, liveNeighborhoods] = await Promise.all([
      supabase.rpc('popular_neighborhoods', {
        result_limit: 6,
        lookback_days: 30,
      }),
      getLiveNeighborhoods(supabase),
    ])

    const popularFromSearches = ((neighborhoodsData || []) as PopularNeighborhoodRow[])
      .map((row) => row.neighborhood)
      .filter((item): item is string => Boolean(item))
    const popularNeighborhoods = pickFeaturedAreas(
      [...popularFromSearches, ...defaultExploreNeighborhoods],
      liveNeighborhoods,
      4,
    )

    return { liveNeighborhoods, popularNeighborhoods }
  } catch (error) {
    console.error('Failed to load homepage data', error)

    return {
      liveNeighborhoods: allNeighborhoods,
      popularNeighborhoods: defaultExploreNeighborhoods.slice(0, 4),
    }
  }
}

export default async function JLMCollectiveHomePage() {
  const { liveNeighborhoods, popularNeighborhoods } = await getHomepageData()

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
              <Suspense fallback={<div className="h-16 rounded-3xl bg-white shadow-sm" />}>
                <StaysFilterBar />
              </Suspense>
            </div>
          </div>
        </section>

        <section aria-label="Browse by neighbourhood" className="mx-auto max-w-7xl px-6">
          <div className="border-b border-stone-200 pb-6">
            <StaysNeighborhoodNav
              neighborhoods={['All', ...liveNeighborhoods]}
              featuredNeighborhoods={popularNeighborhoods}
              selectedArea="All"
              baseQuery={{}}
            />
          </div>
        </section>

        <section id="stays" className="mx-auto max-w-7xl px-6 pt-9">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold tracking-tight text-stone-950">
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

          <Suspense fallback={<HomeFeaturedStaysSkeleton />}>
            <HomeFeaturedStays />
          </Suspense>

          <div className="pt-10">
            <RecentlyViewed />
          </div>
        </section>

        <section aria-label="Why book with JLM Collective" className="mx-auto max-w-7xl px-6 pt-12">
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

