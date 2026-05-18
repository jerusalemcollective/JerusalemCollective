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

  const { supabase, user } = await requireHostDashboardAccess()
  const { error } = await supabase.from('listing_unavailable_ranges').insert({
    listing_id: listingId,
    host_id: user.id,
    start_date: startDate,
    end_date: endDate,
    reason: reason || null,
  })

  if (error) throw error

  revalidatePath('/host/dashboard/calendar')
}

export async function removeUnavailableRange(formData: FormData) {
  const rangeId = String(formData.get('rangeId') || '')

  if (!rangeId) {
    throw new Error('Missing unavailable range id.')
  }

  const { supabase } = await requireHostDashboardAccess()
  const { error } = await supabase
    .from('listing_unavailable_ranges')
    .delete()
    .eq('id', rangeId)

  if (error) throw error

  revalidatePath('/host/dashboard/calendar')
}
