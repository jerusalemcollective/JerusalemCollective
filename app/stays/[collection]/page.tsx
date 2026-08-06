import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createPublicClient } from '@/lib/supabase/public'
import { findStayCollection } from '@/lib/stay-collections'

type CollectionListing = {
  id: string
  title: string
  area: string
  bedrooms: number | null
  max_guests: number | null
  price_ils: number | null
  price_usd: number | null
}

type ListingPhoto = { listing_id: string | null; photo_url: string }

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
          url: '/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp',
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
    .select('id, title, area, bedrooms, max_guests, price_ils, price_usd')
    .eq('is_published', true)
    .order('is_featured', { ascending: false })

  if (collection.filter === 'kosher') {
    query = query.in('kosher_kitchen_level', ['kosher', 'glatt_kosher', 'chalav_yisrael'])
  } else if (collection.filter === 'sukkah') {
    query = query.eq('sukkah_balcony', true)
  }

  const { data: listingsData } = await query
  const listings = (listingsData || []) as CollectionListing[]
  const listingIds = listings.map((listing) => listing.id)

  const { data: photoData } = listingIds.length
    ? await supabase.from('listing_photos').select('listing_id, photo_url').eq('is_cover', true).in('listing_id', listingIds)
    : { data: [] }
  const photoMap = new Map((photoData || []).map((photo: ListingPhoto) => [photo.listing_id, photo.photo_url]))

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
              const coverPhotoUrl = photoMap.get(listing.id)
              return (
                <Link key={listing.id} href={`/listings/${listing.id}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100 shadow-sm transition-shadow duration-200 group-hover:shadow-md">
                    {coverPhotoUrl ? (
                      <Image
                        src={coverPhotoUrl}
                        alt={listing.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        {...(index < 4 ? { priority: true } : { loading: 'lazy' as const })}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#F8F5F2]">
                        <p className="text-xs text-stone-600">Photo coming soon</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 space-y-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#c76f55]">{listing.area}</p>
                    <p className="line-clamp-1 font-semibold leading-snug text-stone-950">{listing.title}</p>
                    <p className="text-sm text-stone-500">
                      {[
                        listing.bedrooms ? `${listing.bedrooms} bed` : null,
                        listing.max_guests ? `sleeps ${listing.max_guests}` : null,
                      ]
                        .filter(Boolean)
                        .join(' \u00b7 ')}
                    </p>
                    <p className="pt-1 text-sm font-semibold text-stone-950">
                      {listing.price_usd
                        ? `$${Number(listing.price_usd).toLocaleString()}`
                        : listing.price_ils
                          ? `\u20aa${Number(listing.price_ils).toLocaleString()}`
                          : 'Price on request'}
                      {(listing.price_usd || listing.price_ils) && (
                        <span className="font-normal text-stone-500"> / night</span>
                      )}
                    </p>
                  </div>
                </Link>
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
