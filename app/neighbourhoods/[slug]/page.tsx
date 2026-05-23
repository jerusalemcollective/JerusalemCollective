import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import {
  findNeighborhoodBySlug,
  neighborhoodDescriptions,
} from '@/lib/neighborhood-pages'

type NeighborhoodListing = {
  id: string
  title: string
  area: string
  bedrooms: number | null
  max_guests: number | null
  price_ils: number | null
  price_usd: number | null
  booking_type: string | null
  is_featured: boolean | null
}

type ListingPhoto = {
  listing_id: string | null
  photo_url: string
}

export const revalidate = 86400

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const name = findNeighborhoodBySlug(slug)

  if (!name) {
    return {
      title: 'Neighbourhood | JLM Collective',
    }
  }

  return {
    title: `Stays in ${name}, Jerusalem | JLM Collective`,
    description: `Browse verified short-term stays in ${name}, Jerusalem. Curated by JLM Collective.`,
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

  const supabase = await createClient()
  const { data: listingsData } = await supabase
    .from('listings')
    .select('id, title, area, bedrooms, max_guests, price_ils, price_usd, booking_type, is_featured')
    .eq('is_published', true)
    .eq('area', name)
    .order('is_featured', { ascending: false })

  const listings = (listingsData || []) as NeighborhoodListing[]
  const listingIds = listings.map((listing) => listing.id)

  const { data: photoData } = listingIds.length
    ? await supabase
        .from('listing_photos')
        .select('listing_id, photo_url')
        .eq('is_cover', true)
        .in('listing_id', listingIds)
    : { data: [] }

  const photoMap = new Map(
    ((photoData || []) as ListingPhoto[]).map((photo) => [
      photo.listing_id,
      photo.photo_url,
    ]),
  )
  const description = neighborhoodDescriptions[name] || null

  return (
    <div className="min-h-screen bg-white">
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
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => {
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
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-stone-100" />
                    )}
                  </div>
                  <div className="mt-3 space-y-0.5">
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
          <div className="mt-16 text-center">
            <p className="text-stone-500">
              No listings available in {name} right now.
            </p>
            <Link
              href="/stays"
              className="mt-4 inline-flex rounded-full bg-[#c76f55] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#b85f47]"
            >
              Browse all stays
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

