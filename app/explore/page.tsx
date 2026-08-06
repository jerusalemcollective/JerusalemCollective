import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  defaultExploreNeighborhoods,
  defaultPopularNeighborhoods,
} from '@/lib/neighborhoods'
import { slugifyNeighborhood } from '@/lib/neighborhood-pages'

export const metadata = {
  title: 'Explore Jerusalem stays',
  description:
    'Discover Jerusalem neighbourhoods, practical stay collections, and featured places before searching all stays.',
  alternates: {
    canonical: '/explore',
  },
  openGraph: {
    title: 'Explore Jerusalem stays | JLM Collective',
    description:
      'Discover Jerusalem neighbourhoods, practical stay collections, and featured places before searching all stays.',
    url: '/explore',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

type PopularNeighborhood = {
  neighborhood: string
  search_count: number
}

type Listing = {
  id: string
  title: string
  area: string
  bedrooms: number
  max_guests: number
  price_ils: number | null
  price_usd: number | null
}

const collectionCards = [
  {
    title: 'Family stays',
    description: 'Room to spread out, practical layouts, and stays suited to longer visits.',
    href: '/stays',
  },
  {
    title: 'Sukkah',
    description: 'Browse stays with a balcony suitable for a sukkah.',
    href: '/stays/sukkot',
  },
  {
    title: 'Near shuls',
    description: 'Useful choices for guests who want easy local access.',
    href: '/stays?nearSynagogue=1',
  },
]

const seasonalCards = [
  {
    title: 'Pesach stays',
    description: 'Verified Jerusalem apartments for Pesach — book early.',
    href: '/stays/pesach',
  },
  {
    title: 'Sukkot stays',
    description: 'Apartments with a balcony suitable for a sukkah.',
    href: '/stays/sukkot',
  },
  {
    title: 'Kosher kitchen',
    description: 'Stays with a kosher kitchen you can rely on.',
    href: '/stays/kosher-kitchen',
  },
]

const hiddenExploreNeighborhoods = new Set(['Pisgat Zeev'])
const replacementExploreNeighborhood = 'Sorotzkin'

export default async function ExplorePage() {
  let popularNeighborhoods = mergeNeighborhoods([])
  let featuredStays: Listing[] = []

  try {
    const supabase = await createClient()
    const [{ data: popularRows }, { data: featuredRows }] = await Promise.all([
      supabase.rpc('popular_neighborhoods', {
        result_limit: 6,
        lookback_days: 30,
      }),
      supabase
        .from('listings')
        .select('id, title, area, bedrooms, max_guests, price_ils, price_usd')
        .eq('is_published', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3),
    ])

    popularNeighborhoods = mergeNeighborhoods(
      (popularRows || []).map((row: PopularNeighborhood) => ({
        neighborhood: row.neighborhood,
        search_count: row.search_count,
      })),
    )
    featuredStays = (featuredRows || []).map((listing: Listing) => ({
      id: listing.id,
      title: listing.title,
      area: listing.area,
      bedrooms: listing.bedrooms,
      max_guests: listing.max_guests,
      price_ils: listing.price_ils,
      price_usd: listing.price_usd,
    }))
  } catch {
    // Keep the page useful before live data or functions are available.
  }

  return (
    <div className="min-h-screen bg-[#F8F5F2] px-5 py-10 text-[#252525] md:px-6">
      <section className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Explore</p>
          <h1 className="font-display mt-3 text-3xl font-bold tracking-tight text-stone-950 md:text-4xl">
            Find the part of Jerusalem that fits your stay
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
            Start with popular neighbourhoods, practical collections, or seasonal needs. When you are ready to compare actual homes, move into all stays.
          </p>
          <Link
            href="/stays"
            className="mt-6 inline-flex rounded-full bg-[#252525] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#111111]"
          >
            Browse all stays
          </Link>
        </div>

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-stone-950">Popular neighbourhoods</h2>
            <p className="mt-1 text-sm text-stone-600">
              Based on what guests are searching for most.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popularNeighborhoods.map((neighborhood) => (
              <Link
                key={neighborhood}
                href={`/neighbourhoods/${slugifyNeighborhood(neighborhood)}`}
                className="rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                  Neighbourhood
                </p>
                <h3 className="mt-3 text-xl font-bold text-stone-950">{neighborhood}</h3>
                <p className="mt-2 text-sm text-stone-600">See stays in this area</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-stone-950">Browse by what matters</h2>
            <p className="mt-1 text-sm text-stone-600">
              A smaller, cleaner set of useful starting points.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {collectionCards.map((card) => (
              <ExploreCard key={card.title} {...card} />
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-stone-950">Seasonal planning</h2>
            <p className="mt-1 text-sm text-stone-600">
              Useful when timing matters as much as location.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {seasonalCards.map((card) => (
              <ExploreCard key={card.title} {...card} />
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-stone-950">Featured stays</h2>
              <p className="mt-1 text-sm text-stone-600">
                A few strong listings to begin with.
              </p>
            </div>
            <Link href="/stays" className="text-sm font-semibold text-[#c76f55] hover:underline">
              View all stays
            </Link>
          </div>

          {featuredStays.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 text-sm text-stone-600 shadow-sm">
              Featured stays will appear here once listings are live.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {featuredStays.map((stay) => (
                <Link
                  key={stay.id}
                  href={`/listings/${stay.id}`}
                  className="rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">
                    {stay.area}
                  </p>
                  <h3 className="mt-3 text-xl font-bold text-stone-950">{stay.title}</h3>
                  <p className="mt-2 text-sm text-stone-600">
                    {stay.bedrooms} bedrooms | sleeps {stay.max_guests}
                  </p>
                  <p className="mt-4 text-sm font-semibold text-stone-900">
                    {stay.price_ils ? `₪${stay.price_ils.toLocaleString()}` : 'Price on request'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  )
}

function mergeNeighborhoods(rows: PopularNeighborhood[]) {
  const live = rows
    .map((row) => row.neighborhood)
    .filter((neighborhood): neighborhood is string => Boolean(neighborhood))
    .filter((neighborhood) => !hiddenExploreNeighborhoods.has(neighborhood))

  return [...live, replacementExploreNeighborhood, ...defaultExploreNeighborhoods, ...defaultPopularNeighborhoods]
    .filter((item: string, index: number, items: string[]) => items.indexOf(item) === index)
    .slice(0, 6)
}

function ExploreCard({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <h3 className="text-xl font-bold text-stone-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
    </Link>
  )
}
