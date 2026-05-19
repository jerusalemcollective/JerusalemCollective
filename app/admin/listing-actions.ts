'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminPermission } from '@/lib/admin'
import { logAdminAction } from '@/lib/audit'

export type ListingMessageState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export async function updateListingVisibility(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')
  const field = String(formData.get('field') || '')
  const rawValue = String(formData.get('value') || '')

  if (!listingId || !['is_published', 'is_featured'].includes(field)) {
    throw new Error('Invalid listing update.')
  }

  if (!['true', 'false'].includes(rawValue)) {
    throw new Error('Invalid listing visibility value.')
  }

  const value = rawValue === 'true'

  const { supabase } = await requireAdminPermission('listings')
  const { error } = await supabase
    .from('listings')
    .update({ [field]: value })
    .eq('id', listingId)

  if (error) throw error
  await logAdminAction(supabase, `set_${field}_${value}`, 'listing', listingId)

  revalidatePath('/admin')
  revalidatePath('/admin/listings')
  revalidatePath(`/listings/${listingId}`)
  revalidatePath('/stays')
}

export async function sendListingMessage(
  _previousState: ListingMessageState,
  formData: FormData,
): Promise<ListingMessageState> {
  const listingId = String(formData.get('listingId') || '')
  const message = String(formData.get('message') || '').trim()

  if (!listingId || !message) {
    return {
      status: 'error',
      message: 'Please write a message before sending.',
    }
  }

  try {
    const { supabase } = await requireAdminPermission('listings')
    const { error } = await supabase.rpc('send_listing_admin_message', {
      target_listing_id: listingId,
      message_body: message,
    })

    if (error) {
      if (
        error.message.includes('Could not find the function') ||
        error.message.includes('send_listing_admin_message')
      ) {
        throw new Error(
          'Listing messaging is not installed in Supabase yet. Run the listing message SQL and try again.',
        )
      }

      throw error
    }

    revalidatePath('/admin/listings')
    revalidatePath(`/admin/listings/${listingId}`)
    revalidatePath('/host/dashboard/listings')
    revalidatePath(`/host/dashboard/listings/${listingId}`)

    return {
      status: 'success',
      message: 'Message sent to the host as JLM Collective.',
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to send the message.',
    }
  }
}
