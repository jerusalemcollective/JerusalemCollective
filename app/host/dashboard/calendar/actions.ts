'use server'

import { revalidatePath } from 'next/cache'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { sendManualBookingGuestEmail } from '@/lib/transactional-email'

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
  const guestCountRaw = Number(formData.get('guests') || '')
  const guestCount = Number.isFinite(guestCountRaw) && guestCountRaw > 0 ? Math.trunc(guestCountRaw) : null
  const guestEmail = String(formData.get('guestEmail') || '').trim() || null
  const guestPhone = String(formData.get('guestPhone') || '').trim() || null
  const notes = String(formData.get('notes') || '').trim() || null

  if (!listingId || !startDate || !endDate) {
    throw new Error('Choose a stay and the check-in and check-out dates.')
  }
  if (endDate <= startDate) {
    throw new Error('Check-out must be after check-in.')
  }

  const { supabase, host, hostIds } = await requireHostDashboardAccess()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, area')
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
    guest_name: guestName || null,
    guest_count: guestCount,
    guest_email: guestEmail,
    guest_phone: guestPhone,
    notes,
  })
  if (error) throw error

  // If the host gave the guest's email, send them a confirmation. Never let an
  // email failure undo the saved booking.
  if (guestEmail) {
    await sendManualBookingGuestEmail({
      to: guestEmail,
      guestName: guestName || null,
      listingTitle: (listing as { title?: string }).title || 'your stay',
      area: (listing as { area?: string | null }).area ?? null,
      checkIn: startDate,
      checkOut: endDate,
      guests: guestCount,
    }).catch((emailError) => {
      console.error('Manual booking saved, but guest confirmation email failed', emailError)
    })
  }

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

// Accept a booking request. Reuses the canonical acceptance RPC (migration 100) —
// the same one the Messages inbox uses — which creates a CONFIRMED booking (so it
// shows in the guest's "My trips"), guards availability, and blocks the dates.
export async function acceptRequestAsHost(_prev: EditState, formData: FormData): Promise<EditState> {
  const requestId = String(formData.get('requestId') || '')
  if (!requestId) {
    return { error: 'Missing request.' }
  }

  try {
    const { supabase } = await requireHostDashboardAccess()
    const { error } = await supabase.rpc('update_booking_request_status', {
      request_uuid: requestId,
      new_status: 'accepted',
    })
    if (error) return { error: error.message }
    revalidatePath('/host/dashboard/calendar')
    return { ok: true }
  } catch (error) {
    return { error: editErrorMessage(error) }
  }
}
