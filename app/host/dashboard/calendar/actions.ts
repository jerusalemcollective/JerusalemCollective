'use server'

import { revalidatePath } from 'next/cache'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'

export async function addUnavailableRange(formData: FormData) {
  return blockDateRange(formData)
}

export async function blockDateRange(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')
  const startDate = String(formData.get('startDate') || '')
  const endDate = String(formData.get('endDate') || '')
  const reason = String(formData.get('reason') || '').trim() || null

  if (!listingId || !startDate || !endDate) {
    throw new Error('Missing required fields.')
  }

  if (endDate < startDate) {
    throw new Error('End date must be after start date.')
  }

  const { supabase, host, hostIds } = await requireHostDashboardAccess()
  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listingId)
    .in('host_id', hostIds)
    .single()

  if (!listing) {
    throw new Error('Listing not found.')
  }

  // Store the block end-exclusive (the day AFTER the host's last blocked day),
  // matching the half-open overlap used everywhere availability is checked
  // (booking/ICS ranges already store end_date = checkout). Without this a
  // single-day block (start == end) left its own day bookable.
  const exclusiveEnd = new Date(`${endDate}T00:00:00.000Z`)
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1)
  const endDateExclusive = exclusiveEnd.toISOString().slice(0, 10)

  // Merge with any existing manual block that overlaps or touches this range so
  // the same dates can't be blocked more than once (blocking is idempotent).
  const { data: existingRanges } = await supabase
    .from('listing_unavailable_ranges')
    .select('id, start_date, end_date')
    .eq('listing_id', listingId)
    .eq('source', 'manual')
    .lte('start_date', endDateExclusive)
    .gte('end_date', startDate)

  const overlapping = existingRanges || []
  const alreadyBlocked = overlapping.some(
    (range) => range.start_date <= startDate && range.end_date >= endDateExclusive,
  )

  if (!alreadyBlocked) {
    let mergedStart = startDate
    let mergedEnd = endDateExclusive
    for (const range of overlapping) {
      if (range.start_date < mergedStart) mergedStart = range.start_date
      if (range.end_date > mergedEnd) mergedEnd = range.end_date
    }

    if (overlapping.length > 0) {
      const { error: deleteError } = await supabase
        .from('listing_unavailable_ranges')
        .delete()
        .in(
          'id',
          overlapping.map((range) => range.id),
        )
      if (deleteError) throw deleteError
    }

    const { error } = await supabase.from('listing_unavailable_ranges').insert({
      listing_id: listingId,
      host_id: host.id,
      start_date: mergedStart,
      end_date: mergedEnd,
      reason,
      source: 'manual',
    })

    if (error) throw error
  }

  revalidatePath('/host/dashboard/calendar')
  revalidatePath(`/host/dashboard/listings/${listingId}`)
  revalidatePath(`/listings/${listingId}`)
}

export async function removeUnavailableRange(formData: FormData) {
  const rangeId = String(formData.get('rangeId') || '')

  if (!rangeId) {
    throw new Error('Missing unavailable range id.')
  }

  const { supabase, hostIds } = await requireHostDashboardAccess()
  const { error } = await supabase
    .from('listing_unavailable_ranges')
    .delete()
    .eq('id', rangeId)
    .in('host_id', hostIds)

  if (error) throw error

  revalidatePath('/host/dashboard/calendar')
}

// Record an off-platform booking for a guest. It blocks the dates like any other
// unavailable range but as source='manual_booking' so the calendar shows it as a
// booking (green) with the guest's name.
export async function addManualBooking(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')
  const startDate = String(formData.get('startDate') || '')
  const endDate = String(formData.get('endDate') || '')
  const guestName = String(formData.get('guestName') || '').trim()

  if (!listingId || !startDate || !endDate) {
    throw new Error('Choose a stay and the check-in and check-out dates.')
  }
  if (endDate <= startDate) {
    throw new Error('Check-out must be after check-in.')
  }

  const { supabase, host, hostIds } = await requireHostDashboardAccess()
  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listingId)
    .in('host_id', hostIds)
    .single()
  if (!listing) {
    throw new Error('Listing not found.')
  }

  // A booking occupies [check-in, check-out): the check-out day is turnover day
  // and stays bookable, matching how confirmed bookings/ICS store end_date.
  const { error } = await supabase.from('listing_unavailable_ranges').insert({
    listing_id: listingId,
    host_id: host.id,
    start_date: startDate,
    end_date: endDate,
    reason: guestName ? `Booking — ${guestName}` : 'Manual booking',
    source: 'manual_booking',
  })
  if (error) throw error

  revalidatePath('/host/dashboard/calendar')
  revalidatePath(`/host/dashboard/listings/${listingId}`)
  revalidatePath(`/listings/${listingId}`)
}

// One entry point for the calendar board: block dates, or add a manual booking.
export async function saveCalendarEntry(formData: FormData) {
  const mode = String(formData.get('mode') || 'block')
  if (mode === 'booking') {
    return addManualBooking(formData)
  }
  return blockDateRange(formData)
}

type EditState = { ok?: boolean; error?: string }

function editErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Could not save the change. Please try again.'
}

// Edit an existing confirmed/pending booking (dates, guests, status).
export async function updateBookingAsHost(_prev: EditState, formData: FormData): Promise<EditState> {
  const bookingId = String(formData.get('bookingId') || '')
  const checkIn = String(formData.get('checkIn') || '')
  const checkOut = String(formData.get('checkOut') || '')
  const guests = Number(formData.get('guests') || 1)
  const status = String(formData.get('status') || '')

  if (!bookingId || !checkIn || !checkOut) {
    return { error: 'Enter the dates for this booking.' }
  }

  try {
    const { supabase } = await requireHostDashboardAccess()
    const { error } = await supabase.rpc('host_update_booking', {
      p_booking_id: bookingId,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_guests: guests,
      p_status: status,
    })
    if (error) return { error: error.message }
    revalidatePath('/host/dashboard/calendar')
    return { ok: true }
  } catch (error) {
    return { error: editErrorMessage(error) }
  }
}

// Edit a booking request / enquiry (dates, guests, status).
export async function updateRequestAsHost(_prev: EditState, formData: FormData): Promise<EditState> {
  const requestId = String(formData.get('requestId') || '')
  const checkIn = String(formData.get('checkIn') || '')
  const checkOut = String(formData.get('checkOut') || '')
  const guests = Number(formData.get('guests') || 1)
  const status = String(formData.get('status') || '')

  if (!requestId || !checkIn || !checkOut) {
    return { error: 'Enter the dates for this request.' }
  }

  try {
    const { supabase } = await requireHostDashboardAccess()
    const { error } = await supabase.rpc('host_update_booking_request', {
      p_request_id: requestId,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_guests: guests,
      p_status: status,
    })
    if (error) return { error: error.message }
    revalidatePath('/host/dashboard/calendar')
    return { ok: true }
  } catch (error) {
    return { error: editErrorMessage(error) }
  }
}
