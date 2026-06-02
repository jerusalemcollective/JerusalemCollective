'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminPermission } from '@/lib/admin'
import { logAdminAction } from '@/lib/audit'

export async function updateHostVerification(formData: FormData) {
  const hostId = String(formData.get('hostId') || '')
  const rawValue = String(formData.get('value') || '')

  if (!hostId) {
    throw new Error('Missing host id.')
  }

  if (!['true', 'false'].includes(rawValue)) {
    throw new Error('Invalid host verification value.')
  }

  const value = rawValue === 'true'

  const { supabase } = await requireAdminPermission('hosts')
  const { error } = await supabase
    .from('hosts')
    .update({ is_verified: value })
    .eq('id', hostId)

  if (error) throw error
  await logAdminAction(supabase, `set_verified_${value}`, 'host', hostId)

  revalidatePath('/admin')
  revalidatePath('/admin/hosts')
  revalidatePath(`/hosts/${hostId}`)
}

export async function updateHostListingBlock(formData: FormData) {
  const hostId = String(formData.get('hostId') || '')
  const rawValue = String(formData.get('value') || '')
  const reason = String(formData.get('reason') || '').trim()

  if (!hostId) {
    throw new Error('Missing host id.')
  }

  if (!['true', 'false'].includes(rawValue)) {
    throw new Error('Invalid host block value.')
  }

  const value = rawValue === 'true'
  const { supabase } = await requireAdminPermission('hosts')
  const { error } = await supabase
    .from('hosts')
    .update({
      listing_blocked: value,
      listing_blocked_at: value ? new Date().toISOString() : null,
      listing_blocked_reason: value ? reason || null : null,
    })
    .eq('id', hostId)

  if (error) throw error

  if (value) {
    const { error: listingError } = await supabase
      .from('listings')
      .update({ is_published: false })
      .eq('host_id', hostId)

    if (listingError) throw listingError
  }

  await logAdminAction(
    supabase,
    value ? 'block_host_from_listing' : 'unblock_host_from_listing',
    'host',
    hostId,
    reason || undefined,
  )

  revalidatePath('/admin')
  revalidatePath('/admin/hosts')
  revalidatePath('/admin/listings')
  revalidatePath(`/hosts/${hostId}`)
  revalidatePath('/stays')
}

export async function updateHostCommissionOverride(formData: FormData) {
  const hostId = String(formData.get('hostId') || '')
  const rawValue = String(formData.get('commissionOverride') || '').trim()
  const overrideValue = rawValue ? Number(rawValue) : null

  if (!hostId) {
    throw new Error('Missing host id.')
  }

  if (overrideValue !== null && (!Number.isFinite(overrideValue) || overrideValue < 0)) {
    throw new Error('Commission override must be 0 or higher.')
  }

  const { supabase } = await requireAdminPermission('hosts')
  const { error } = await supabase.rpc('admin_update_host_commission_override', {
    target_host_id: hostId,
    override_percent: overrideValue,
  })

  if (error) throw error

  await logAdminAction(
    supabase,
    overrideValue === null ? 'clear_host_commission_override' : 'set_host_commission_override',
    'host',
    hostId,
    overrideValue === null ? 'Use platform default commission' : `Host commission override set to ${overrideValue}%`,
  )

  revalidatePath('/admin')
  revalidatePath('/admin/hosts')
  revalidatePath(`/hosts/${hostId}`)
}
