'use server'

import { revalidatePath } from 'next/cache'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { syncExternalCalendar } from '@/lib/calendar-sync'
import {
  calculateShulDistances,
  saveShulDistances,
} from '@/lib/shul-distances'

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
  const sleepingSetup = String(formData.get('sleepingSetup') || '').trim()
  const priceIlsValue = String(formData.get('priceIls') || '')
  const priceUsdValue = String(formData.get('priceUsd') || '')
  const priceIls = priceIlsValue ? Number(priceIlsValue) : null
  const priceUsd = priceUsdValue ? Number(priceUsdValue) : null
  const bookingType = String(formData.get('bookingType') || 'request')
  const amenities = formData.getAll('amenities').map(String)
  const description = String(formData.get('description') || '')
  const houseRules = String(formData.get('houseRules') || '').trim() || null
  const welcomeMessage = String(formData.get('welcomeMessage') || '').trim() || null
  const checkInInstructions = String(formData.get('checkInInstructions') || '').trim() || null
  const kosherKitchenLevel = String(formData.get('kosherKitchenLevel') || '').trim() || null
  const walkingMinutesValue = String(formData.get('walkingMinutesToKotel') || '')
  const walkingMinutesToKotel = walkingMinutesValue ? Number(walkingMinutesValue) : null
  const shabbatElevator = formData.get('shabbatElevator') === 'on'
  const physicalKeyEntry = formData.get('physicalKeyEntry') === 'on'
  const shabbatClock = formData.get('shabbatClock') === 'on'
  const sukkahBalcony = formData.get('sukkahBalcony') === 'on'
  const nearSynagogue = formData.get('nearSynagogue') === 'on'
  const centralAc = formData.get('centralAc') === 'on'
  const americanWasherDryer = formData.get('americanWasherDryer') === 'on'
  const americanMattress = formData.get('americanMattress') === 'on'
  const powerfulWaterHeater = formData.get('powerfulWaterHeater') === 'on'

  if (!listingId) {
    throw new Error('Missing listing id.')
  }

  const { supabase, hostIds } = await requireHostDashboardAccess()
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
    new_sleeping_setup: sleepingSetup,
    new_description: description,
  })

  if (error) {
    throw error
  }

  const { error: communicationError } = await supabase
    .from('listings')
    .update({
      house_rules: houseRules,
      welcome_message: welcomeMessage,
      check_in_instructions: checkInInstructions,
      kosher_kitchen_level: kosherKitchenLevel,
      walking_minutes_to_kotel: walkingMinutesToKotel,
      shabbat_elevator: shabbatElevator,
      physical_key_entry: physicalKeyEntry,
      shabbat_clock: shabbatClock,
      sukkah_balcony: sukkahBalcony,
      near_synagogue: nearSynagogue,
      central_ac: centralAc,
      american_washer_dryer: americanWasherDryer,
      american_mattress: americanMattress,
      powerful_water_heater: powerfulWaterHeater,
      american_comfort:
        centralAc &&
        americanWasherDryer &&
        americanMattress &&
        powerfulWaterHeater,
    })
    .eq('id', listingId)
    .in('host_id', hostIds)

  if (communicationError) {
    throw communicationError
  }

  const { data: listingForDistances } = await supabase
    .from('listings')
    .select('id, latitude, longitude, area')
    .eq('id', listingId)
    .in('host_id', hostIds)
    .maybeSingle()

  if (
    listingForDistances?.latitude &&
    listingForDistances.longitude &&
    listingForDistances.area
  ) {
    try {
      const distances = await calculateShulDistances(
        listingId,
        listingForDistances.latitude,
        listingForDistances.longitude,
        listingForDistances.area,
      )
      await saveShulDistances(
        supabase,
        listingId,
        distances,
      )
    } catch (error) {
      console.error(
        'Shul distance calculation failed — listing update still saved:',
        error,
      )
    }
  }

  revalidatePath('/host/dashboard')
  revalidatePath('/host/dashboard/listings')
  revalidatePath(`/host/dashboard/listings/${listingId}`)
  revalidatePath(`/listings/${listingId}`)
  revalidatePath('/stays')
}

export async function updateHostApplication(formData: FormData) {
  const applicationId = String(formData.get('applicationId') || '')
  const hostName = String(formData.get('hostName') || '').trim()
  const displayName = String(formData.get('displayName') || '').trim()
  const showFullName = formData.get('showFullName') === 'on'
  const email = String(formData.get('email') || '').trim()
  const phone = String(formData.get('phone') || '').trim()
  const whatsappNumber = String(formData.get('whatsappNumber') || '').trim()
  const hostType = String(formData.get('hostType') || 'owner')
  const title = String(formData.get('title') || '')
  const area = String(formData.get('area') || '')
  const exactAddress = String(formData.get('exactAddress') || '')
  const latitudeValue = String(formData.get('latitude') || '')
  const longitudeValue = String(formData.get('longitude') || '')
  const bedrooms = Number(formData.get('bedrooms') || 0)
  const bathroomsValue = String(formData.get('bathrooms') || '')
  const bathrooms = bathroomsValue ? Number(bathroomsValue) : null
  const sleeps = Number(formData.get('sleeps') || 0)
  const sleepingSetup = String(formData.get('sleepingSetup') || '').trim()
  const priceIlsValue = String(formData.get('priceIls') || '')
  const priceUsdValue = String(formData.get('priceUsd') || '')
  const currencyPreference = String(formData.get('currencyPreference') || 'ILS')
  const priceIls = priceIlsValue ? Number(priceIlsValue) : null
  const priceUsd = priceUsdValue ? Number(priceUsdValue) : null
  const amenities = formData.getAll('amenities').map(String)
  const description = String(formData.get('description') || '')
  const photoLink = String(formData.get('photoLink') || '').trim()
  const verificationDocType = String(formData.get('verificationDocType') || '').trim()
  const idDocType = String(formData.get('idDocType') || '').trim()

  if (!applicationId) {
    throw new Error('Missing application id.')
  }

  const { supabase } = await requireHostDashboardAccess()
  const { error } = await supabase.rpc('update_current_host_application', {
    application_uuid: applicationId,
    new_host_name: hostName,
    new_display_name: displayName || hostName.split(' ')[0] || 'Host',
    new_show_full_name: showFullName,
    new_email: email,
    new_phone: phone || null,
    new_whatsapp_number: whatsappNumber || null,
    new_host_type: hostType,
    new_title: title,
    new_area: area,
    new_exact_address: exactAddress,
    new_latitude: latitudeValue ? Number(latitudeValue) : null,
    new_longitude: longitudeValue ? Number(longitudeValue) : null,
    new_bedrooms: bedrooms,
    new_bathrooms: bathrooms,
    new_sleeps: sleeps,
    new_currency_preference: currencyPreference,
    new_price_ils: priceIls,
    new_price_usd: priceUsd,
    new_amenities: amenities,
    new_sleeping_setup: sleepingSetup,
    new_description: description,
    new_photo_link: photoLink || null,
    new_verification_doc_type: verificationDocType,
    new_id_doc_type: idDocType,
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
