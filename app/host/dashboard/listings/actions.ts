'use server'

import { revalidatePath } from 'next/cache'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { syncExternalCalendar } from '@/lib/calendar-sync'
import { getPaymentRouteSettings } from '@/lib/platform-settings'
import { toLegacyPrices } from '@/lib/fx'
import { isHostPriceCurrency } from '@/lib/currencies'
import {
  calculateShulDistances,
  saveShulDistances,
} from '@/lib/shul-distances'

type ExternalCalendarState = {
  status: string
  message: string
}

export async function setHostListingVisibility(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')
  const rawValue = String(formData.get('value') || '')

  if (!listingId || !['true', 'false'].includes(rawValue)) {
    throw new Error('Invalid listing visibility update.')
  }

  const { supabase, hostIds } = await requireHostDashboardAccess()

  const { data, error } = await supabase
    .from('listings')
    .update({ is_published: rawValue === 'true' })
    .eq('id', listingId)
    .in('host_id', hostIds)
    .select('id')

  if (error) throw error

  // Row-level security refusals return no error, they just change nothing.
  if (!data || data.length === 0) {
    throw new Error(
      'That listing could not be updated. If this keeps happening the host update policy is missing on the listings table (migration 069).',
    )
  }

  revalidatePath('/host/dashboard')
  revalidatePath('/host/dashboard/listings')
  revalidatePath(`/host/dashboard/listings/${listingId}`)
  revalidatePath(`/listings/${listingId}`)
  revalidatePath('/stays')
}

export async function deleteHostListing(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')

  if (!listingId) {
    throw new Error('Missing listing id.')
  }

  const { supabase, hostIds } = await requireHostDashboardAccess()

  // Confirm the listing belongs to this host before touching anything.
  const { data: owned } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listingId)
    .in('host_id', hostIds)
    .maybeSingle()

  if (!owned) {
    throw new Error('That listing was not found on your account.')
  }

  // A listing with bookings must not be destroyed: the booking and payment
  // history depends on it. Hide it instead.
  const { count: bookingCount } = await supabase
    .from('booking_requests')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId)

  if ((bookingCount || 0) > 0) {
    throw new Error(
      'This listing has booking history, so it cannot be deleted. Hide it instead - it comes off the site immediately and your records stay intact. Contact JLM Collective if you need it removed entirely.',
    )
  }

  await supabase.from('listing_photos').delete().eq('listing_id', listingId)
  await supabase.from('listing_unavailable_ranges').delete().eq('listing_id', listingId)

  const { data: deleted, error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)
    .in('host_id', hostIds)
    .select('id')

  if (error) {
    throw new Error(
      `This listing could not be deleted because other records still reference it. Hide it instead. (${error.message})`,
    )
  }

  if (!deleted || deleted.length === 0) {
    throw new Error(
      'Nothing was deleted. The host delete policy is missing on the listings table (migration 069).',
    )
  }

  revalidatePath('/host/dashboard')
  revalidatePath('/host/dashboard/listings')
  revalidatePath('/stays')
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
