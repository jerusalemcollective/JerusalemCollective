import { notFound } from 'next/navigation'
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

type ListingStructuredDataListing = ListingDetailListing & {
  latitude: number | null
  longitude: number | null
}

type SimilarListing = {
  id: string
  title: string
  area: string
  bedrooms: number | null
  max_guests: number | null
  price_ils: number | null
  price_usd: number | null
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
      ? `From \u20aa${Number(listing.price_ils).toLocaleString()} per night`
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
          similarListings={[]}
          fromStays={fromStays}
        />
      )
    }

    notFound()
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
      .select('id, photo_url, is_cover, label')
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

  const { data: similarRaw } = await supabase
    .from('listings')
    .select('id, title, area, bedrooms, max_guests, price_ils, price_usd')
    .eq('is_published', true)
    .eq('area', listing.area)
    .neq('id', id)
    .limit(3)

  const similarListings = [...((similarRaw || []) as SimilarListing[])]

  if (similarListings.length < 3) {
    const excludeIds = [id, ...similarListings.map((similarListing) => similarListing.id)]
    const { data: additionalSimilarRaw } = await supabase
      .from('listings')
      .select('id, title, area, bedrooms, max_guests, price_ils, price_usd')
      .eq('is_published', true)
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .order('is_featured', { ascending: false })
      .limit(3 - similarListings.length)

    similarListings.push(...((additionalSimilarRaw || []) as SimilarListing[]))
  }

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
  const structuredListing = listingData as ListingStructuredDataListing
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : null
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: structuredListing.title,
    description:
      structuredListing.description ||
      `${structuredListing.bedrooms ?? 1}-bedroom stay in ${structuredListing.area}, Jerusalem.`,
    url: `https://jlmcollective.co/listings/${id}`,
    image: photos.map((photo) => photo.photo_url),
    address: {
      '@type': 'PostalAddress',
      addressLocality: structuredListing.area,
      addressRegion: 'Jerusalem',
      addressCountry: 'IL',
    },
    geo:
      structuredListing.latitude && structuredListing.longitude
        ? {
            '@type': 'GeoCoordinates',
            latitude: structuredListing.latitude,
            longitude: structuredListing.longitude,
          }
        : undefined,
    numberOfRooms: structuredListing.bedrooms ?? undefined,
    occupancy: structuredListing.max_guests
      ? {
          '@type': 'QuantitativeValue',
          maxValue: structuredListing.max_guests,
        }
      : undefined,
    priceRange: structuredListing.price_usd
      ? `$${Number(structuredListing.price_usd).toLocaleString()} per night`
      : structuredListing.price_ils
        ? `\u20aa${Number(structuredListing.price_ils).toLocaleString()} per night`
        : undefined,
    aggregateRating:
      avgRating !== null && reviews.length > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: avgRating.toFixed(1),
            reviewCount: reviews.length,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    review: reviews.slice(0, 5).map((review) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.reviewer_name,
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: review.content || undefined,
    })),
  }
  const cleanJsonLd: unknown = JSON.parse(JSON.stringify(jsonLd))

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cleanJsonLd) }}
      />
      <ListingDetailClient
        listing={listing}
        host={host}
        publicHostName={publicHostName}
        photos={photos}
        reviews={reviews}
        blockedRanges={(blockedRangesData || []) as ListingBlockedRange[]}
        similarListings={similarListings}
        fromStays={fromStays}
      />
    </>
  )
}


