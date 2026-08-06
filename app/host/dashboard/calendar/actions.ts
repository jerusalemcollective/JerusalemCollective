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
