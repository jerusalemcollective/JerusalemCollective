import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSampleListing } from '@/lib/sample-listings'
import {
  ListingDetailClient,
  type ListingBlockedRange,
  type ListingDetailHost,
  type ListingDetailListing,
  type ListingDetailPhoto,
  type ListingDetailReview,
} from '@/components/listing-detail-client'

type HostRecord = {
  name: string
  display_name: string | null
  show_full_name: boolean
}

type HostRow = HostRecord & {
  id: string
  is_verified: boolean | null
  profile_photo_url: string | null
}

type ListingPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getPublicName(host: HostRecord): string {
  if (host.show_full_name) return host.name
  return host.display_name || host.name.split(' ')[0]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: listing }, { data: coverPhoto }] = await Promise.all([
    supabase
      .from('listings')
      .select('title, area, bedrooms, max_guests, price_ils, price_usd, description')
      .eq('id', id)
      .single(),
    supabase
      .from('listing_photos')
      .select('photo_url')
      .eq('listing_id', id)
      .eq('is_cover', true)
      .limit(1)
      .maybeSingle(),
  ])

  if (!listing) {
    return {
      title: 'Stay | JLM Collective',
    }
  }

  const title = `${listing.title} | JLM Collective`
  const description = listing.description
    ? listing.description.slice(0, 155)
    : `${listing.bedrooms ?? 1}-bedroom stay in ${listing.area}, Jerusalem. Verified by JLM Collective.`
  const priceText = listing.price_usd
    ? `From $${Number(listing.price_usd).toLocaleString()} per night`
    : listing.price_ils
      ? `From ₪${Number(listing.price_ils).toLocaleString()} per night`
      : null
  const ogDescription = priceText ? `${description} ${priceText}.` : description
  const images = coverPhoto?.photo_url
    ? [
        {
          url: coverPhoto.photo_url,
          width: 1200,
          height: 800,
          alt: listing.title,
        },
      ]
    : [
        {
          url: '/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp',
          width: 1200,
          height: 630,
          alt: 'JLM Collective',
        },
      ]

  return {
    title,
    description,
    openGraph: {
      title,
      description: ogDescription,
      url: `https://jlmcollective.co/listings/${id}`,
      siteName: 'JLM Collective',
      images,
      locale: 'en_GB',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: ogDescription,
      images: images.map((image) => image.url),
    },
  }
}

export default async function ListingDetailPage({ params, searchParams }: ListingPageProps) {
  const { id } = await params
  const query = searchParams ? await searchParams : {}
  const from = Array.isArray(query.from) ? query.from[0] : query.from
  const fromStays = from === 'stays'
  const supabase = await createClient()

  const { data: listingData } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single()

  if (!listingData) {
    const sampleListing = getSampleListing(id)

    if (sampleListing) {
      return (
        <ListingDetailClient
          listing={{
            ...sampleListing,
            host_id: null,
            bathrooms: sampleListing.bathrooms || null,
            amenities: sampleListing.amenities || [],
            description: sampleListing.description || null,
          }}
          host={null}
          publicHostName={null}
          photos={sampleListing.cover_photo_url ? [{
            id: `${sampleListing.id}-cover`,
            photo_url: sampleListing.cover_photo_url,
            is_cover: true,
          }] : []}
          reviews={[]}
          blockedRanges={[]}
          fromStays={fromStays}
        />
      )
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F5F2] px-4">
        <h1 className="mb-4 text-2xl font-bold text-stone-800">Listing not found</h1>
        <Link href="/stays" className="text-[#c76f55] hover:underline">
          Browse all stays
        </Link>
      </div>
    )
  }

  const listing = listingData as ListingDetailListing
  const [
    { data: photosData },
    { data: hostData },
    { data: reviewsData },
    { data: blockedRangesData },
  ] = await Promise.all([
    supabase
      .from('listing_photos')
      .select('id, photo_url, is_cover')
      .eq('listing_id', id)
      .order('sort_order', { ascending: true }),
    listing.host_id
      ? supabase
          .from('hosts')
          .select('id, name, display_name, show_full_name, is_verified, profile_photo_url')
          .eq('id', listing.host_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('reviews')
      .select('id, reviewer_name, rating, content')
      .eq('listing_id', id)
      .eq('is_approved', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('listing_unavailable_ranges')
      .select('start_date, end_date')
      .eq('listing_id', id),
  ])

  const hostRecord = hostData as HostRow | null
  const publicHostName = hostRecord ? getPublicName(hostRecord) : null
  const host: ListingDetailHost | null = hostRecord
    ? {
        id: hostRecord.id,
        is_verified: hostRecord.is_verified,
        profile_photo_url: hostRecord.profile_photo_url,
      }
    : null

  const photos = (photosData || []) as ListingDetailPhoto[]
  const reviews = (reviewsData || []) as ListingDetailReview[]
  const jsonLd = buildListingJsonLd({
    listing,
    photos,
    reviews,
    publicHostName,
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ListingDetailClient
        listing={listing}
        host={host}
        publicHostName={publicHostName}
        photos={photos}
        reviews={reviews}
        blockedRanges={(blockedRangesData || []) as ListingBlockedRange[]}
        fromStays={fromStays}
      />
    </>
  )
}

function buildListingJsonLd({
  listing,
  photos,
  reviews,
  publicHostName,
}: {
  listing: ListingDetailListing
  photos: ListingDetailPhoto[]
  reviews: ListingDetailReview[]
  publicHostName: string | null
}) {
  const coverPhoto = photos.find((photo) => photo.is_cover) || photos[0]
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: listing.title,
    description: listing.description || `Curated stay in ${listing.area}, Jerusalem.`,
    url: `https://jlmcollective.co/listings/${listing.id}`,
    image: coverPhoto?.photo_url ? [coverPhoto.photo_url] : undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: listing.area,
      addressRegion: 'Jerusalem',
      addressCountry: 'IL',
    },
    numberOfRooms: listing.bedrooms,
    maximumAttendeeCapacity: listing.max_guests,
    amenityFeature: listing.amenities?.map((amenity) => ({
      '@type': 'LocationFeatureSpecification',
      name: amenity,
      value: true,
    })),
    priceRange: listing.price_usd
      ? `$${listing.price_usd.toLocaleString()}`
      : listing.price_ils
        ? `₪${listing.price_ils.toLocaleString()}`
        : 'Price on request',
    provider: publicHostName
      ? {
          '@type': 'Person',
          name: publicHostName,
        }
      : undefined,
  }

  if (reviews.length > 0) {
    const ratingValue = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(ratingValue.toFixed(1)),
      reviewCount: reviews.length,
    }
    jsonLd.review = reviews.slice(0, 5).map((review) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.reviewer_name,
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
      },
      reviewBody: review.content || undefined,
    }))
  }

  return jsonLd
}
