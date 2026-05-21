'use server'

import { revalidatePath } from 'next/cache'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'

export async function addUnavailableRange(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')
  const startDate = String(formData.get('startDate') || '')
  const endDate = String(formData.get('endDate') || '')
  const reason = String(formData.get('reason') || '').trim()

  if (!listingId || !startDate || !endDate) {
    throw new Error('Choose a listing and a complete date range.')
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
    .maybeSingle()

  if (!listing) {
    throw new Error('Listing not found.')
  }

  const { error } = await supabase.from('listing_unavailable_ranges').insert({
    listing_id: listingId,
    host_id: host.id,
    start_date: startDate,
    end_date: endDate,
    reason: reason || null,
    source: 'manual',
  })

  if (error) throw error

  revalidatePath('/host/dashboard/calendar')
}

export async function blockDateRange(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')
  const startDate = String(formData.get('startDate') || '')
  const endDate = String(formData.get('endDate') || '')

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

  const { error } = await supabase
    .from('listing_unavailable_ranges')
    .insert({
      listing_id: listingId,
      host_id: host.id,
      start_date: startDate,
      end_date: endDate,
      source: 'manual',
    })

  if (error) throw error

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
