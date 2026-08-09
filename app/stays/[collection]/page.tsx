import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase/public'
import { findStayCollection } from '@/lib/stay-collections'
import { ListingCard } from '@/components/listing-card'
import { formatPreferredNightlyPrice } from '@/lib/utils/currency'

type CollectionListing = {
  id: string
  title: string
  area: string
  bedrooms: number | null
  max_guests: number | null
  price_ils: number | null
  price_usd: number | null
  cover_photo_url: string | null
}

export const revalidate = 3600

function escapeJsonLd(value: string) {
  return value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ collection: string }>
}): Promise<Metadata> {
  const { collection: slug } = await params
  const collection = findStayCollection(slug)
  if (!collection) {
    return { title: 'Stays', alternates: { canonical: '/stays' } }
  }
  return {
    title: collection.metaTitle,
    description: collection.metaDescription,
    alternates: { canonical: `/stays/${collection.slug}` },
    openGraph: {
      title: collection.metaTitle,
      description: collection.metaDescription,
      url: `/stays/${collection.slug}`,
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
    twitter: { card: 'summary_large_image', title: collection.metaTitle, description: collection.metaDescription },
  }
}

export default async function StayCollectionPage({
  params,
}: {
  params: Promise<{ collection: string }>
}) {
  const { collection: slug } = await params
  const collection = findStayCollection(slug)
  if (!collection) notFound()

  const supabase = createPublicClient()
  let query = supabase
    .from('listings')
    .select('id, title, area, bedrooms, max_guests, price_ils, price_usd, cover_photo_url')
    .eq('is_published', true)
    .order('is_featured', { ascending: false })

  if (collection.filter === 'kosher') {
    query = query.in('kosher_kitchen_level', ['kosher', 'glatt_kosher', 'chalav_yisrael'])
  } else if (collection.filter === 'sukkah') {
    query = query.eq('sukkah_balcony', true)
  }

  const { data: listingsData } = await query
  const listings = (listingsData || []) as CollectionListing[]

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: collection.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://jlmcollective.co' },
      { '@type': 'ListItem', position: 2, name: 'Stays', item: 'https://jlmcollective.co/stays' },
      { '@type': 'ListItem', position: 3, name: collection.h1, item: `https://jlmcollective.co/stays/${collection.slug}` },
    ],
  }

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(JSON.stringify(faqJsonLd)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(JSON.stringify(breadcrumbJsonLd)) }} />

      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-2 text-sm text-stone-500">
          <Link href="/stays" className="hover:text-[#c76f55]">
            Stays
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-stone-900">{collection.h1}</span>
        </nav>

        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">{collection.eyebrow}</p>
        <h1 className="font-display mt-2 text-4xl font-bold tracking-tight text-stone-950 md:text-5xl">
          {collection.h1}
        </h1>

        <div className="mt-4 max-w-2xl space-y-4">
          {collection.intro.map((paragraph, index) => (
            <p key={index} className="text-base leading-8 text-stone-600">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-4">
          <Link href="/stays" className="text-sm font-semibold text-[#c76f55] hover:underline">
            Browse all Jerusalem stays {'\u2192'}
          </Link>
        </div>

        {listings.length > 0 ? (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing, index) => {
              const priceLabel = formatPreferredNightlyPrice(listing)
              return (
                <ListingCard
                  key={listing.id}
                  priority={index < 4}
                  listing={{
                    id: listing.id,
                    title: listing.title,
                    area: listing.area,
                    bedrooms: listing.bedrooms,
                    max_guests: listing.max_guests,
                    coverPhotoUrl: listing.cover_photo_url ?? null,
                    rating: null,
                    priceLabel,
                    hasPrice: Boolean(listing.price_ils || listing.price_usd),
                  }}
                />
              )
            })}
          </div>
        ) : (
          <div className="mt-12 rounded-3xl bg-[#F8F5F2] p-8 text-center">
            <p className="text-stone-600">
              No matching stays are live right now. Browse all stays or message us and we will help you find one.
            </p>
            <Link
              href="/stays"
              className="mt-4 inline-flex rounded-full bg-[#252525] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#111111]"
            >
              Browse all stays
            </Link>
          </div>
        )}

        <section className="mt-16 border-t border-stone-200 pt-10">
          <h2 className="font-display text-2xl font-bold text-stone-950">Frequently asked questions</h2>
          <div className="mt-6 max-w-2xl divide-y divide-stone-200 border-y border-stone-200">
            {collection.faqs.map((faq) => (
              <details key={faq.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-stone-900">
                  {faq.q}
                  <span className="text-stone-500 transition group-open:rotate-180" aria-hidden="true">
                    ⌄
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-stone-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
