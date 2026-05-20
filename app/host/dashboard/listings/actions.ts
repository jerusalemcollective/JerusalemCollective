'use server'

import { revalidatePath } from 'next/cache'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { syncExternalCalendar } from '@/lib/calendar-sync'

type ExternalCalendarState = {
  status: string
  message: string
}

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

export async function updateHostApplication(formData: FormData) {
  const applicationId = String(formData.get('applicationId') || '')
  const title = String(formData.get('title') || '')
  const area = String(formData.get('area') || '')
  const exactAddress = String(formData.get('exactAddress') || '')
  const latitudeValue = String(formData.get('latitude') || '')
  const longitudeValue = String(formData.get('longitude') || '')
  const bedrooms = Number(formData.get('bedrooms') || 0)
  const bathroomsValue = String(formData.get('bathrooms') || '')
  const bathrooms = bathroomsValue ? Number(bathroomsValue) : null
  const sleeps = Number(formData.get('sleeps') || 0)
  const priceIlsValue = String(formData.get('priceIls') || '')
  const priceUsdValue = String(formData.get('priceUsd') || '')
  const priceIls = priceIlsValue ? Number(priceIlsValue) : null
  const priceUsd = priceUsdValue ? Number(priceUsdValue) : null
  const amenities = formData.getAll('amenities').map(String)
  const description = String(formData.get('description') || '')

  if (!applicationId) {
    throw new Error('Missing application id.')
  }

  const { supabase } = await requireHostDashboardAccess()
  const { error } = await supabase.rpc('update_current_host_application', {
    application_uuid: applicationId,
    new_title: title,
    new_area: area,
    new_exact_address: exactAddress,
    new_latitude: latitudeValue ? Number(latitudeValue) : null,
    new_longitude: longitudeValue ? Number(longitudeValue) : null,
    new_bedrooms: bedrooms,
    new_bathrooms: bathrooms,
    new_sleeps: sleeps,
    new_price_ils: priceIls,
    new_price_usd: priceUsd,
    new_amenities: amenities,
    new_description: description,
  })

  if (error) {
    throw error
  }

  revalidatePath('/host/dashboard')
  revalidatePath('/host/dashboard/listings')
  revalidatePath(`/host/dashboard/applications/${applicationId}`)
}

export async function saveExternalCalendarUrl(
  _prev: ExternalCalendarState,
  formData: FormData,
): Promise<ExternalCalendarState> {
  const listingId = String(formData.get('listingId') || '')
  const url = String(formData.get('calendarUrl') || '').trim()

  if (!listingId) {
    return { status: 'error', message: 'Missing listing.' }
  }

  if (url && !url.startsWith('http')) {
    return {
      status: 'error',
      message: 'Please enter a valid calendar URL.',
    }
  }

  const { supabase, hostIds } = await requireHostDashboardAccess()
  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listingId)
    .in('host_id', hostIds)
    .maybeSingle()

  if (!listing) {
    return { status: 'error', message: 'Listing not found.' }
  }

  const listingUpdate = url
    ? { external_calendar_url: url }
    : { external_calendar_url: null, calendar_last_synced_at: null }

  const { error } = await supabase
    .from('listings')
    .update(listingUpdate)
    .eq('id', listingId)
    .in('host_id', hostIds)

  if (error) return { status: 'error', message: error.message }

  if (url) {
    await syncExternalCalendar(supabase, listingId, url)
  } else {
    await supabase
      .from('listing_unavailable_ranges')
      .delete()
      .eq('listing_id', listingId)
      .eq('source', 'external_calendar')
  }

  revalidatePath('/host/dashboard/listings')
  revalidatePath(`/host/dashboard/listings/${listingId}`)
  revalidatePath(`/listings/${listingId}`)

  return {
    status: 'success',
    message: url ? 'Calendar connected and synced.' : 'Calendar disconnected.',
  }
}
