import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase/public'
import {
  findNeighborhoodBySlug,
  neighborhoodDescriptions,
} from '@/lib/neighborhood-pages'
import { ListingCard, LISTING_GRID_CLASS } from '@/components/listing-card'
import {
  getListingCardExtras,
  LISTING_CARD_COLUMNS,
  toListingCardData,
  type ListingCardRow,
} from '@/lib/listing-cards'

export const revalidate = 86400

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const name = findNeighborhoodBySlug(slug)

  if (!name) {
    return {
      title: 'Neighbourhood',
      alternates: { canonical: `/neighbourhoods/${slug}` },
    }
  }

  const description = `Browse verified short-term stays in ${name}, Jerusalem. Curated by JLM Collective.`

  // Don't index a neighbourhood page with neither editorial content nor live
  // listings — it reads as thin/near-duplicate and drags site-quality signals.
  const hasEditorial = Boolean(neighborhoodDescriptions[name])
  let indexable = hasEditorial
  if (!hasEditorial) {
    try {
      const supabase = createPublicClient()
      const { count } = await supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true)
        .eq('area', name)
      indexable = (count || 0) > 0
    } catch {
      indexable = false
    }
  }

  return {
    title: `Stays in ${name}, Jerusalem`,
    description,
    robots: { index: indexable, follow: true },
    alternates: { canonical: `/neighbourhoods/${slug}` },
    openGraph: {
      title: `Stays in ${name}, Jerusalem | JLM Collective`,
      description,
      url: `/neighbourhoods/${slug}`,
      type: 'website',
      images: [
        {
          url: '/api/og',
          width: 1200,
          height: 630,
          alt: 'JLM Collective',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Stays in ${name}, Jerusalem | JLM Collective`,
      description,
    },
  }
}

export default async function NeighbourhoodPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const name = findNeighborhoodBySlug(slug)

  if (!name) notFound()

  const supabase = createPublicClient()
  const { data: listingsData } = await supabase
    .from('listings')
    .select(LISTING_CARD_COLUMNS)
    .eq('is_published', true)
    .eq('area', name)
    .order('is_featured', { ascending: false })

  const listings = (listingsData || []) as ListingCardRow[]
  const extras = await getListingCardExtras(supabase, listings.map((listing) => listing.id))
  const description = neighborhoodDescriptions[name] || null

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://jlmcollective.co' },
      { '@type': 'ListItem', position: 2, name: 'Stays', item: 'https://jlmcollective.co/stays' },
      {
        '@type': 'ListItem',
        position: 3,
        name: `Stays in ${name}`,
        item: `https://jlmcollective.co/neighbourhoods/${slug}`,
      },
    ],
  }

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026'),
        }}
      />
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-stone-500">
          <Link href="/stays" className="hover:text-[#c76f55]">
            Stays
          </Link>
          <span>/</span>
          <span className="text-stone-900">
            {name}
          </span>
        </div>

        <Link
          href="/stays"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 transition hover:text-stone-900"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          All stays
        </Link>

        <h1 className="font-display mt-4 text-4xl font-bold tracking-tight text-stone-950 md:text-5xl">
          Stays in {name}
        </h1>

        {description ? (
          <p className="mt-4 max-w-2xl text-base leading-8 text-stone-600">
            {description}
          </p>
        ) : (
          <p className="mt-4 text-base text-stone-500">
            Verified stays in {name}, Jerusalem {'\u2014'} curated by JLM Collective.
          </p>
        )}

        <div className="mt-3">
          <Link
            href={`/stays?neighborhood=${encodeURIComponent(name)}`}
            className="text-sm font-semibold text-[#c76f55] hover:underline"
          >
            View all {name} listings {'\u2192'}
          </Link>
        </div>

        {listings.length > 0 ? (
          <div className={`mt-10 ${LISTING_GRID_CLASS}`}>
            {listings.map((listing, index) => (
              <ListingCard key={listing.id} priority={index < 4} listing={toListingCardData(listing, extras)} />
            ))}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-stone-500">
              No listings available in {name} right now.
            </p>
            <Link
              href="/stays"
              className="mt-4 inline-flex rounded-full bg-[#252525] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#111111]"
            >
              Browse all stays
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

