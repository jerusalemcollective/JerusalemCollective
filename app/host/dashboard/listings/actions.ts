'use server'

import { revalidatePath } from 'next/cache'
import { redirect, unstable_rethrow } from 'next/navigation'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { syncExternalCalendar } from '@/lib/calendar-sync'
import { getPaymentRouteSettings } from '@/lib/platform-settings'
import { toLegacyPrices } from '@/lib/fx'
import { isHostPriceCurrency } from '@/lib/currencies'
import type { SaveFormState } from '@/components/sticky-save-bar'
import {
  calculateShulDistances,
  saveShulDistances,
} from '@/lib/shul-distances'

// The "Other amenities" box submits one comma-separated string under the same
// field name as the checkboxes. Store each amenity as its own item (trimmed,
// de-duplicated) so guests see them as a proper list.
function readAmenities(formData: FormData) {
  const seen = new Set<string>()
  const amenities: string[] = []
  for (const value of formData.getAll('amenities')) {
    for (const part of String(value).split(',')) {
      const amenity = part.trim()
      const key = amenity.toLowerCase()
      if (!amenity || seen.has(key)) continue
      seen.add(key)
      amenities.push(amenity)
    }
  }
  return amenities
}

type ExternalCalendarState = {
  status: string
  message: string
}

export type HostListingActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export async function setHostListingVisibility(
  _prev: HostListingActionState,
  formData: FormData,
): Promise<HostListingActionState> {
  const listingId = String(formData.get('listingId') || '')
  const rawValue = String(formData.get('value') || '')

  if (!listingId || !['true', 'false'].includes(rawValue)) {
    return { status: 'error', message: 'Something went wrong — please refresh the page and try again.' }
  }

  const publish = rawValue === 'true'

  try {
    const { supabase, hostIds } = await requireHostDashboardAccess()

    const { data, error } = await supabase
      .from('listings')
      .update({ is_published: publish })
      .eq('id', listingId)
      .in('host_id', hostIds)
      .select('id')

    if (error) throw error

    // Row-level security refusals return no error, they just change nothing.
    if (!data || data.length === 0) {
      throw new Error('No listing rows were updated (host update policy on listings, migration 069).')
    }

    revalidatePath('/host/dashboard')
    revalidatePath('/host/dashboard/listings')
    revalidatePath(`/host/dashboard/listings/${listingId}`)
    revalidatePath(`/listings/${listingId}`)
    revalidatePath('/stays')
    revalidatePath('/')

    return {
      status: 'success',
      message: publish
        ? 'Your stay is now showing on the site.'
        : 'Your stay is now hidden from the site.',
    }
  } catch (error) {
    unstable_rethrow(error)
    console.error('Could not change listing visibility', error)
    return {
      status: 'error',
      message: 'Could not change whether your stay is shown — please try again or contact JLM.',
    }
  }
}

const hasHistoryMessage =
  'This stay has bookings or booking requests, so it can\'t be deleted — your records depend on it. Use "Hide from site" instead: it comes off the site straight away. Contact JLM if you need it removed completely.'

export async function deleteHostListing(
  _prev: HostListingActionState,
  formData: FormData,
): Promise<HostListingActionState> {
  const listingId = String(formData.get('listingId') || '')

  if (!listingId) {
    return { status: 'error', message: 'Something went wrong — please refresh the page and try again.' }
  }

  try {
    const { supabase, hostIds } = await requireHostDashboardAccess()

    // Confirm the listing belongs to this host before touching anything.
    const { data: owned, error: ownedError } = await supabase
      .from('listings')
      .select('id')
      .eq('id', listingId)
      .in('host_id', hostIds)
      .maybeSingle()

    if (ownedError) throw ownedError
    if (!owned) {
      return { status: 'error', message: 'That stay was not found on your account.' }
    }

    // A stay with bookings or requests must not be destroyed: the booking and
    // payment history depends on it. Check BEFORE deleting anything, and if the
    // check itself fails, do not delete.
    const [bookingCheck, requestCheck] = await Promise.all([
      supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('listing_id', listingId),
      supabase
        .from('booking_requests')
        .select('id', { count: 'exact', head: true })
        .eq('listing_id', listingId),
    ])

    if (bookingCheck.error) throw bookingCheck.error
    if (requestCheck.error) throw requestCheck.error

    if ((bookingCheck.count || 0) > 0 || (requestCheck.count || 0) > 0) {
      return { status: 'error', message: hasHistoryMessage }
    }

    const { error: photosError } = await supabase.from('listing_photos').delete().eq('listing_id', listingId)
    if (photosError) throw photosError
    const { error: rangesError } = await supabase
      .from('listing_unavailable_ranges')
      .delete()
      .eq('listing_id', listingId)
    if (rangesError) throw rangesError

    const { data: deleted, error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId)
      .in('host_id', hostIds)
      .select('id')

    if (error) throw error
    if (!deleted || deleted.length === 0) {
      throw new Error('No listing rows were deleted (host delete policy on listings, migration 069).')
    }

    revalidatePath('/host/dashboard')
    revalidatePath('/host/dashboard/listings')
    revalidatePath('/stays')
    revalidatePath('/')
  } catch (error) {
    unstable_rethrow(error)
    console.error('Could not delete listing', error)
    return {
      status: 'error',
      message: 'Could not delete this stay. You can hide it from the site instead, or contact JLM.',
    }
  }

  redirect('/host/dashboard/listings')
}

// The listing editor's save. Returns a result instead of throwing so the save
// bar only says "All changes saved" once the server has confirmed it.
export async function updateHostListing(
  _prev: SaveFormState,
  formData: FormData,
): Promise<SaveFormState> {
  try {
    await saveHostListing(formData)
    return { status: 'success', message: 'All changes saved.' }
  } catch (error) {
    unstable_rethrow(error)
    console.error('Could not save host listing', error)
    return {
      status: 'error',
      message: 'Could not save your changes — please try again or contact JLM.',
    }
  }
}

async function saveHostListing(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')
  const title = String(formData.get('title') || '')
  const area = String(formData.get('area') || '')
  const bedrooms = Number(formData.get('bedrooms') || 0)
  const bathroomsValue = String(formData.get('bathrooms') || '')
  const bathrooms = bathroomsValue ? Number(bathroomsValue) : null
  const maxGuests = Number(formData.get('maxGuests') || 0)
  const sleepingSetup = String(formData.get('sleepingSetup') || '').trim()
  // The host prices in one currency; snapshot into legacy price_ils/price_usd
  // via FX so the booking engine keeps working (see toLegacyPrices).
  const priceCurrencyRaw = String(formData.get('priceCurrency') || 'ILS')
  const priceCurrency = isHostPriceCurrency(priceCurrencyRaw) ? priceCurrencyRaw : 'ILS'
  const priceValue = String(formData.get('price') || '')
  const price = priceValue ? Number(priceValue) : null
  const { price_ils: priceIls, price_usd: priceUsd } = await toLegacyPrices(price, priceCurrency)
  // Extra-guest pricing. included_guests is clamped to [1, maxGuests]; fees are
  // non-negative. A blank included-guests field falls back to maxGuests (i.e. no
  // surcharge). The authoritative charge recomputes from these columns in SQL.
  const includedGuestsRaw = Number(formData.get('includedGuests') || '')
  const includedGuests = Number.isFinite(includedGuestsRaw)
    ? Math.min(Math.max(Math.trunc(includedGuestsRaw), 1), maxGuests || Math.trunc(includedGuestsRaw))
    : maxGuests || null
  const extraGuestFeeRaw = Number(formData.get('extraGuestFee') || '0')
  const extraGuestFee = Number.isFinite(extraGuestFeeRaw) ? Math.max(extraGuestFeeRaw, 0) : 0
  const extraLegacy = await toLegacyPrices(extraGuestFee || null, priceCurrency)
  const extraGuestFeeIls = extraLegacy.price_ils ?? 0
  const extraGuestFeeUsd = extraLegacy.price_usd ?? 0
  const bookingType = String(formData.get('bookingType') || 'request')
  const paymentRoutes = await getPaymentRouteSettings()
  const onlinePaymentEnabled =
    paymentRoutes.jlmPaymentsEnabled && formData.get('onlinePaymentEnabled') === 'on'
  const amenities = readAmenities(formData)
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
      online_payment_enabled: onlinePaymentEnabled,
      included_guests: includedGuests,
      price,
      price_currency: priceCurrency,
      extra_guest_fee: extraGuestFee,
      extra_guest_fee_ils: extraGuestFeeIls,
      extra_guest_fee_usd: extraGuestFeeUsd,
    })
    .eq('id', listingId)
    .in('host_id', hostIds)

  if (communicationError) {
    throw communicationError
  }

  // Deposit and payment schedule now live in the Pricing section of this same
  // form (they used to be a separate form). Persist them via the same RPC that
  // the standalone deposit form used. Guard the values so a stray entry can't
  // block the rest of the save.
  const depositType = String(formData.get('depositType') || '')
  if (depositType === 'percent' || depositType === 'fixed') {
    const depositValue = Number(formData.get('depositValue') || '')
    const balanceDueDaysRaw = Number(formData.get('balanceDueDays') || '0')
    const balanceDueDays = Number.isFinite(balanceDueDaysRaw)
      ? Math.min(Math.max(Math.trunc(balanceDueDaysRaw), 0), 365)
      : 0

    // Optional deposit-due date (direct bookings). Blank = due at booking (null).
    const depositDueRaw = String(formData.get('depositDueDays') || '').trim()
    const depositDueParsed = Number(depositDueRaw)
    const depositDueDays =
      depositDueRaw === '' || !Number.isFinite(depositDueParsed)
        ? null
        : Math.min(Math.max(Math.trunc(depositDueParsed), 0), 365)

    const depositValid =
      Number.isFinite(depositValue) &&
      depositValue > 0 &&
      (depositType === 'fixed' || depositValue <= 100)

    if (depositValid) {
      const { error: depositError } = await supabase.rpc('update_listing_deposit_settings', {
        listing_uuid: listingId,
        p_deposit_type: depositType,
        p_deposit_value: depositValue,
        p_balance_due_days: balanceDueDays,
        p_deposit_due_days: depositDueDays,
      })

      if (depositError) {
        throw depositError
      }
    }
  }

  const minNightsRaw = Number(formData.get('minNights') || '1')
  const minNights = Number.isFinite(minNightsRaw)
    ? Math.min(Math.max(Math.trunc(minNightsRaw), 1), 365)
    : 1
  const { error: minNightsError } = await supabase.rpc('update_listing_min_nights', {
    listing_uuid: listingId,
    p_min_nights: minNights,
  })
  if (minNightsError) {
    throw minNightsError
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
  revalidatePath('/')
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
  const priceCurrencyRaw = String(formData.get('priceCurrency') || 'ILS')
  const priceCurrency = isHostPriceCurrency(priceCurrencyRaw) ? priceCurrencyRaw : 'ILS'
  const priceValue = String(formData.get('price') || '')
  const price = priceValue ? Number(priceValue) : null
  const { price_ils: priceIls, price_usd: priceUsd } = await toLegacyPrices(price, priceCurrency)
  // The legacy currency_preference column only knows ILS/USD/Both.
  const currencyPreference = priceCurrency === 'ILS' ? 'ILS' : 'USD'
  const amenities = readAmenities(formData)
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

  // Persist the host's chosen currency + single price (the RPC above only
  // handles the legacy columns).
  const { error: priceError } = await supabase.rpc('update_host_application_price', {
    application_uuid: applicationId,
    new_price: price,
    new_price_currency: priceCurrency,
  })
  if (priceError) {
    throw priceError
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

type DepositSettingsState = {
  status: string
  message: string
}

export async function updateListingDepositSettings(
  _prev: DepositSettingsState,
  formData: FormData,
): Promise<DepositSettingsState> {
  const listingId = String(formData.get('listingId') || '')
  const depositType = String(formData.get('depositType') || 'percent')
  const depositValue = Number(formData.get('depositValue') || '')
  const balanceDueDays = Number(formData.get('balanceDueDays') || '0')
  const depositDueRaw = String(formData.get('depositDueDays') || '').trim()
  const depositDueParsed = Number(depositDueRaw)
  const depositDueDays =
    depositDueRaw === '' || !Number.isFinite(depositDueParsed)
      ? null
      : Math.min(Math.max(Math.trunc(depositDueParsed), 0), 365)

  if (!listingId) {
    return { status: 'error', message: 'Missing listing.' }
  }
  if (!['percent', 'fixed'].includes(depositType)) {
    return { status: 'error', message: 'Choose a percentage or a fixed deposit.' }
  }
  if (!Number.isFinite(depositValue) || depositValue <= 0) {
    return { status: 'error', message: 'Enter a deposit greater than zero.' }
  }
  if (depositType === 'percent' && depositValue > 100) {
    return { status: 'error', message: 'A percentage deposit cannot be more than 100%.' }
  }
  if (!Number.isFinite(balanceDueDays) || balanceDueDays < 0 || balanceDueDays > 365) {
    return { status: 'error', message: 'Balance due days must be between 0 and 365.' }
  }

  const { supabase } = await requireHostDashboardAccess()
  const { error } = await supabase.rpc('update_listing_deposit_settings', {
    listing_uuid: listingId,
    p_deposit_type: depositType,
    p_deposit_value: depositValue,
    p_balance_due_days: balanceDueDays,
    p_deposit_due_days: depositDueDays,
  })

  if (error) {
    return { status: 'error', message: error.message }
  }

  revalidatePath('/host/dashboard/listings')
  revalidatePath(`/host/dashboard/listings/${listingId}`)
  revalidatePath(`/listings/${listingId}`)

  return { status: 'success', message: 'Deposit and payment schedule saved.' }
}
