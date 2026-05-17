'use server'

import { revalidatePath } from 'next/cache'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'

export async function updateHostListing(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')
  const title = String(formData.get('title') || '')
  const area = String(formData.get('area') || '')
  const bedrooms = Number(formData.get('bedrooms') || 0)
  const bathroomsValue = String(formData.get('bathrooms') || '')
  const bathrooms = bathroomsValue ? Number(bathroomsValue) : null
  const maxGuests = Number(formData.get('maxGuests') || 0)
  const priceIlsValue = String(formData.get('priceIls') || '')
  const priceUsdValue = String(formData.get('priceUsd') || '')
  const priceIls = priceIlsValue ? Number(priceIlsValue) : null
  const priceUsd = priceUsdValue ? Number(priceUsdValue) : null
  const bookingType = String(formData.get('bookingType') || 'request')
  const amenities = formData.getAll('amenities').map(String)
  const description = String(formData.get('description') || '')

  if (!listingId) {
    throw new Error('Missing listing id.')
  }

  const { supabase } = await requireHostDashboardAccess()
  const { error } = await supabase.rpc('update_current_host_listing', {
    listing_uuid: listingId,
    new_title: title,
    new_area: area,
    new_bedrooms: bedrooms,
    new_bathrooms: bathrooms,
    new_max_guests: maxGuests,
    new_price_ils: priceIls,
    new_price_usd: priceUsd,
    new_booking_type: bookingType,
    new_amenities: amenities,
    new_description: description,
  })

  if (error) {
    throw error
  }

  revalidatePath('/host/dashboard')
  revalidatePath('/host/dashboard/listings')
  revalidatePath(`/host/dashboard/listings/${listingId}`)
  revalidatePath(`/listings/${listingId}`)
  revalidatePath('/stays')
}
