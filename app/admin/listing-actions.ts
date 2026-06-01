'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminPermission } from '@/lib/admin'
import { logAdminAction } from '@/lib/audit'
import { sendListingHostAdminUpdateEmail } from '@/lib/transactional-email'

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
  await sendListingHostAdminUpdateEmail({
    supabase,
    listingId,
    subject: 'JLM Collective updated your listing',
    intro: `JLM Collective updated your listing ${field === 'is_published' ? 'publication status' : 'featured status'}. Please sign in to view the latest status.`,
    ctaPath: `/host/dashboard/listings/${listingId}`,
    ctaLabel: 'View listing update',
  })

  revalidatePath('/admin')
  revalidatePath('/admin/listings')
  revalidatePath(`/listings/${listingId}`)
  revalidatePath('/stays')
}

export async function deleteListing(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')

  if (!listingId) {
    throw new Error('Missing listing id.')
  }

  const { supabase } = await requireAdminPermission('listings')
  const { error: photoError } = await supabase
    .from('listing_photos')
    .delete()
    .eq('listing_id', listingId)

  if (photoError) throw photoError

  await supabase
    .from('listing_unavailable_ranges')
    .delete()
    .eq('listing_id', listingId)

  await supabase
    .from('listing_admin_messages')
    .delete()
    .eq('listing_id', listingId)

  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)

  if (error) throw error

  await logAdminAction(supabase, 'delete_listing', 'listing', listingId)

  revalidatePath('/admin')
  revalidatePath('/admin/listings')
  revalidatePath(`/listings/${listingId}`)
  revalidatePath('/stays')
  redirect('/admin/listings')
}

export async function createAdminListing(formData: FormData) {
  const hostId = String(formData.get('hostId') || '')
  const title = String(formData.get('title') || '').trim()
  const area = String(formData.get('area') || '').trim()
  const exactAddress = String(formData.get('exactAddress') || '').trim()
  const bedrooms = parseNumber(formData.get('bedrooms'), 0)
  const bathrooms = parseOptionalNumber(formData.get('bathrooms'))
  const maxGuests = parseNumber(formData.get('maxGuests'), 1)
  const priceIls = parseOptionalNumber(formData.get('priceIls'))
  const priceUsd = parseOptionalNumber(formData.get('priceUsd'))
  const bookingType = String(formData.get('bookingType') || 'request')
  const description = String(formData.get('description') || '').trim()
  const isPublished = formData.get('isPublished') === 'on'

  if (!hostId || !title || !area) {
    throw new Error('Host, title, and area are required.')
  }

  if (!['request', 'enquiry', 'instant'].includes(bookingType)) {
    throw new Error('Invalid booking type.')
  }

  const { supabase } = await requireAdminPermission('listings')
  const { data: host, error: hostError } = await supabase
    .from('hosts')
    .select('id, listing_blocked')
    .eq('id', hostId)
    .single()

  if (hostError || !host) {
    throw hostError || new Error('Host not found.')
  }

  if (host.listing_blocked) {
    throw new Error('This host is blocked from creating listings.')
  }

  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      host_id: hostId,
      title,
      area,
      exact_address: exactAddress || null,
      bedrooms,
      bathrooms,
      max_guests: maxGuests,
      price_ils: priceIls,
      price_usd: priceUsd,
      booking_type: bookingType,
      amenities: [],
      description: description || null,
      is_published: isPublished,
      is_featured: false,
    })
    .select('id')
    .single()

  if (error) throw error
  if (!listing?.id) throw new Error('Listing was not created.')

  await logAdminAction(supabase, 'create_listing', 'listing', listing.id)

  revalidatePath('/admin')
  revalidatePath('/admin/listings')
  revalidatePath('/stays')
  redirect(`/admin/listings/${listing.id}`)
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

    await sendListingHostAdminUpdateEmail({
      supabase,
      listingId,
      subject: 'New message from JLM Collective about your listing',
      intro: 'JLM Collective sent you an update about your listing. Please sign in to your host dashboard to view the message and make any needed changes.',
      ctaPath: `/host/dashboard/listings/${listingId}`,
      ctaLabel: 'View message',
    })

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

function parseNumber(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(String(value || '').trim())
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const rawValue = String(value || '').trim()
  if (!rawValue) return null
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? parsed : null
}
