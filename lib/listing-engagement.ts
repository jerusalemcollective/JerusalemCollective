import type { SupabaseClient } from '@supabase/supabase-js'

type ListingEngagementType = 'view' | 'save' | 'enquiry' | 'booking_request'

export async function recordListingEngagement(
  supabase: SupabaseClient,
  listingId: string,
  eventType: ListingEngagementType,
) {
  const { error } = await supabase.rpc('record_listing_engagement', {
    target_listing_id: listingId,
    engagement_type: eventType,
  })

  if (error) {
    console.error('Could not record listing engagement:', error)
  }
}
