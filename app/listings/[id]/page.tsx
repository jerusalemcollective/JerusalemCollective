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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('listings').select('title, area').eq('id', id).single()

  return {
    title: data ? `${data.title} | JLM Collective` : 'Stay | JLM Collective',
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

  return (
    <ListingDetailClient
      listing={listing}
      host={host}
      publicHostName={publicHostName}
      photos={(photosData || []) as ListingDetailPhoto[]}
      reviews={(reviewsData || []) as ListingDetailReview[]}
      blockedRanges={(blockedRangesData || []) as ListingBlockedRange[]}
      fromStays={fromStays}
    />
  )
}
