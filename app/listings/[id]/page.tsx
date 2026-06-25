import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getSampleListing } from '@/lib/sample-listings'
import { getPaymentRouteSettings, getServicesBarEnabled } from '@/lib/platform-settings'
import {
  ListingDetailClient,
  type ListingDetailHost,
  type ListingDetailListing,
  type ListingDetailPhoto,
  type ListingDetailReview,
} from '@/components/listing-detail-client'
import { neighborhoodDescriptions } from '@/lib/neighborhood-pages'

type HostRecord = {
  name: string
  display_name: string | null
  show_full_name: boolean
}

type ListingPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
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

type ShulDistance = {
  shul_name: string
  walking_minutes: number
}

type ResponseTimeRow = {
  created_at: string
  first_response_at: string
}

const KOTEL_LAT = 31.7767
const KOTEL_LNG = 35.2345

const listingDetailListingSchema = z.object({
  id: z.string(),
  host_id: z.string().nullable(),
  title: z.string(),
  area: z.string(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  max_guests: z.number().nullable(),
  sleeping_setup: z.string().nullable().optional().transform((value) => value ?? null),
  price_ils: z.number().nullable(),
  price_usd: z.number().nullable(),
  booking_type: z.string(),
  online_payment_enabled: z.boolean().nullish().transform((value) => Boolean(value)),
  amenities: z.array(z.string()).nullable(),
  description: z.string().nullable(),
  house_rules: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  shabbat_elevator: z.boolean().nullish().transform((value) => Boolean(value)),
  physical_key_entry: z.boolean().nullish().transform((value) => Boolean(value)),
  shabbat_clock: z.boolean().nullish().transform((value) => Boolean(value)),
  kosher_kitchen_level: z.string().nullable().optional().transform((value) => value ?? null),
  walking_minutes_to_kotel: z.number().nullable().optional().transform((value) => value ?? null),
  near_synagogue: z.boolean().nullish().transform((value) => Boolean(value)),
  sukkah_balcony: z.boolean().nullish().transform((value) => Boolean(value)),
  american_comfort: z.boolean().nullish().transform((value) => Boolean(value)),
  central_ac: z.boolean().nullish().transform((value) => Boolean(value)),
  american_washer_dryer: z.boolean().nullish().transform((value) => Boolean(value)),
  american_mattress: z.boolean().nullish().transform((value) => Boolean(value)),
  powerful_water_heater: z.boolean().nullish().transform((value) => Boolean(value)),
})

const hostRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  display_name: z.string().nullable(),
  show_full_name: z.boolean(),
  is_verified: z.boolean().nullable(),
  profile_photo_url: z.string().nullable(),
})

const listingPhotoSchema = z.object({
  id: z.string(),
  photo_url: z.string(),
  is_cover: z.boolean().nullable(),
  label: z.string().nullable().optional().transform((value) => value ?? null),
})

const listingReviewSchema = z.object({
  id: z.string(),
  reviewer_name: z.string(),
  rating: z.number(),
  content: z.string().nullable(),
})

const blockedRangeSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
})

const similarListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  area: z.string(),
  bedrooms: z.number().nullable(),
  max_guests: z.number().nullable(),
  price_ils: z.number().nullable(),
  price_usd: z.number().nullable(),
})

const shulDistanceSchema = z.object({
  shul_name: z.string(),
  walking_minutes: z.number(),
})

const responseTimeSchema = z.object({
  created_at: z.string(),
  first_response_at: z.string(),
})

const paymentProfileSchema = z.object({
  accepts_jlm_payment: z.boolean().nullable(),
  payout_currencies: z.array(z.string()).nullable(),
})

export const revalidate = 3600

function getPublicName(host: HostRecord): string {
  if (host.show_full_name) return host.name
  return host.display_name || host.name.split(' ')[0]
}

function estimateWalkingMinutes(
  lat: number,
  lng: number,
): number {
  const R = 6371000
  const dLat = ((KOTEL_LAT - lat) * Math.PI) / 180
  const dLng = ((KOTEL_LNG - lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos((lat * Math.PI) / 180) *
      Math.cos((KOTEL_LAT * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c =
    2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    )
  const distanceMetres = R * c
  return Math.round((distanceMetres / 80) * 1.3)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
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
      .order('is_cover', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  if (!listing) {
    return {
      title: 'Stay',
      alternates: { canonical: `/listings/${id}` },
    }
  }

  const title =
    listing.title.trim().toLowerCase() === listing.area.trim().toLowerCase()
      ? `Stay in ${listing.area}`
      : `${listing.title} in ${listing.area}`
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
          height: 630,
          alt: title,
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
    alternates: {
      canonical: `/listings/${id}`,
    },
    openGraph: {
      title: `${title} | JLM Collective`,
      description: ogDescription,
      url: `/listings/${id}`,
      siteName: 'JLM Collective',
      images,
      locale: 'en_GB',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | JLM Collective`,
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
  const [servicesBarEnabled, paymentRoutes] = await Promise.all([
    getServicesBarEnabled(),
    getPaymentRouteSettings(),
  ])
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
            sleeping_setup: null,
            amenities: sampleListing.amenities || [],
            description: sampleListing.description || null,
            house_rules: null,
            online_payment_enabled: false,
            latitude: sampleListing.latitude || null,
            longitude: sampleListing.longitude || null,
            shabbat_elevator: false,
            physical_key_entry: false,
            shabbat_clock: false,
            kosher_kitchen_level: null,
            walking_minutes_to_kotel: null,
            near_synagogue: false,
            sukkah_balcony: false,
            american_comfort: false,
            central_ac: false,
            american_washer_dryer: false,
            american_mattress: false,
            powerful_water_heater: false,
          }}
          host={null}
          publicHostName={null}
          photos={sampleListing.cover_photo_url ? [{
            id: `${sampleListing.id}-cover`,
            photo_url: sampleListing.cover_photo_url,
            is_cover: true,
            label: null,
          }] : []}
          reviews={[]}
          blockedRanges={[]}
          similarListings={[]}
          fromStays={fromStays}
          neighbourhoodDescription={null}
          walkingMinutes={null}
          shulDistances={[]}
          avgResponseHours={null}
          servicesBarEnabled={servicesBarEnabled}
        />
      )
    }

    notFound()
  }

  const structuredListing = listingDetailListingSchema.parse(listingData)
  const listing: ListingDetailListing = structuredListing
  const walkingMinutes =
    listing.walking_minutes_to_kotel ||
    (structuredListing.latitude && structuredListing.longitude
      ? estimateWalkingMinutes(
          structuredListing.latitude,
          structuredListing.longitude,
        )
      : null)
  const neighbourhoodDescription = listingData?.area
    ? neighborhoodDescriptions[listingData.area] || null
    : null
  const [
    { data: photosData },
    { data: hostData },
    { data: paymentProfileData },
    { data: reviewsData },
    { data: blockedRangesData },
    { data: shulDistancesData },
    { data: responseData },
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
    listing.host_id
      ? supabase
          .from('host_payment_profiles')
          .select('accepts_jlm_payment, payout_currencies')
          .eq('host_id', listing.host_id)
          .maybeSingle()
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
    supabase
      .from('listing_shul_distances')
      .select('shul_name, walking_minutes')
      .eq('listing_id', id)
      .order('walking_minutes', { ascending: true }),
    listing.host_id
      ? supabase
          .from('booking_requests')
          .select('created_at, first_response_at')
          .eq('host_id', listing.host_id)
          .not('first_response_at', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null }),
  ])

  const { data: similarRaw } = await supabase
    .from('listings')
    .select('id, title, area, bedrooms, max_guests, price_ils, price_usd')
    .eq('is_published', true)
    .eq('area', listing.area)
    .neq('id', id)
    .limit(3)

  const similarListings: SimilarListing[] = [...z.array(similarListingSchema).parse(similarRaw ?? [])]

  if (similarListings.length < 3) {
    const excludeIds = [id, ...similarListings.map((similarListing) => similarListing.id)]
    const { data: additionalSimilarRaw } = await supabase
      .from('listings')
      .select('id, title, area, bedrooms, max_guests, price_ils, price_usd')
      .eq('is_published', true)
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .order('is_featured', { ascending: false })
      .limit(3 - similarListings.length)

    similarListings.push(...z.array(similarListingSchema).parse(additionalSimilarRaw ?? []))
  }

  const hostRecord = hostData ? hostRowSchema.parse(hostData) : null
  const publicHostName = hostRecord ? getPublicName(hostRecord) : null
  const host: ListingDetailHost | null = hostRecord
    ? {
        id: hostRecord.id,
        is_verified: hostRecord.is_verified,
        profile_photo_url: hostRecord.profile_photo_url,
      }
    : null

  const photos: ListingDetailPhoto[] = z.array(listingPhotoSchema).parse(photosData ?? [])
  const reviews: ListingDetailReview[] = z.array(listingReviewSchema).parse(reviewsData ?? [])
  const shulDistances: ShulDistance[] = z.array(shulDistanceSchema).parse(shulDistancesData ?? [])
  const responseRows: ResponseTimeRow[] = z.array(responseTimeSchema).parse(responseData ?? [])
  const paymentProfile = paymentProfileData
    ? paymentProfileSchema.parse(paymentProfileData)
    : null
  const listingCurrency = listing.price_usd ? 'USD' : listing.price_ils ? 'ILS' : null
  const hostCanReceiveListingCurrency =
    listingCurrency !== null &&
    Boolean(paymentProfile?.payout_currencies?.includes(listingCurrency))
  const avgResponseHours =
    responseRows.length > 0
      ? responseRows.reduce((sum, row) => {
          const created = new Date(row.created_at).getTime()
          const responded = new Date(row.first_response_at).getTime()

          return sum + (responded - created) / (1000 * 60 * 60)
        }, 0) / responseRows.length
      : null
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
        listing={{
          ...listing,
          online_payment_enabled:
            paymentRoutes.jlmPaymentsEnabled &&
            listing.online_payment_enabled &&
            Boolean(paymentProfile?.accepts_jlm_payment) &&
            hostCanReceiveListingCurrency,
        }}
        host={host}
        publicHostName={publicHostName}
        photos={photos}
        reviews={reviews}
        blockedRanges={z.array(blockedRangeSchema).parse(blockedRangesData ?? [])}
        similarListings={similarListings}
        fromStays={fromStays}
        neighbourhoodDescription={neighbourhoodDescription}
        walkingMinutes={walkingMinutes}
        shulDistances={shulDistances}
        avgResponseHours={avgResponseHours}
        servicesBarEnabled={servicesBarEnabled}
      />
    </>
  )
}


