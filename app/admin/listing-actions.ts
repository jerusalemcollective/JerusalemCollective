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

type ListingAdminStatus = 'needs_work' | 'ready_for_launch' | 'live'

const listingAdminStatuses: ListingAdminStatus[] = [
  'needs_work',
  'ready_for_launch',
  'live',
]

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
  const { data: updated, error } = await supabase
    .from('listings')
    .update({ [field]: value })
    .eq('id', listingId)
    .select('id')

  if (error) throw error

  // A row-level-security block returns no error, it simply updates nothing.
  // Without this check the admin UI reports success while nothing changed.
  if (!updated || updated.length === 0) {
    throw new Error(
      'The listing was not updated. Your admin account may not have permission to change listings — check the admin update policy on the listings table.',
    )
  }

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

export async function updateAdminListingStatus(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')
  const status = String(formData.get('adminStatus') || '')

  if (!listingId || !isListingAdminStatus(status)) {
    throw new Error('Invalid listing status update.')
  }

  const update =
    status === 'live'
      ? { admin_status: status, is_published: true }
      : { admin_status: status }

  const { supabase } = await requireAdminPermission('listings')
  const { error } = await supabase
    .from('listings')
    .update(update)
    .eq('id', listingId)

  if (error) throw error

  await logAdminAction(supabase, `set_listing_admin_status_${status}`, 'listing', listingId)

  revalidatePath('/admin')
  revalidatePath('/admin/listings')
  revalidatePath('/admin/readiness')
  revalidatePath(`/admin/listings/${listingId}`)
  revalidatePath(`/listings/${listingId}`)
  revalidatePath('/stays')
}

export async function updateAdminListingDetails(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')
  const title = String(formData.get('title') || '').trim()
  const area = String(formData.get('area') || '').trim()
  const exactAddress = String(formData.get('exactAddress') || '').trim()
  const bedrooms = parseNumber(formData.get('bedrooms'), 0)
  const bathrooms = parseOptionalNumber(formData.get('bathrooms'))
  const maxGuests = parseNumber(formData.get('maxGuests'), 1)
  const sleepingSetup = String(formData.get('sleepingSetup') || '').trim()
  const priceIls = parseOptionalNumber(formData.get('priceIls'))
  const priceUsd = parseOptionalNumber(formData.get('priceUsd'))
  const bookingType = String(formData.get('bookingType') || 'request')
  const onlinePaymentEnabled = formData.get('onlinePaymentEnabled') === 'on'
  const amenities = formData.getAll('amenities').map(String).filter(Boolean)
  const description = String(formData.get('description') || '').trim()
  const isPublished = formData.get('isPublished') === 'on'
  const isFeatured = formData.get('isFeatured') === 'on'
  const adminStatus = String(formData.get('adminStatus') || 'needs_work')

  if (!listingId || !title || !area) {
    throw new Error('Listing id, title, and area are required.')
  }

  if (!['request', 'enquiry', 'instant'].includes(bookingType)) {
    throw new Error('Invalid booking type.')
  }

  if (!isListingAdminStatus(adminStatus)) {
    throw new Error('Invalid launch status.')
  }

  const finalPublished = adminStatus === 'live' ? true : isPublished

  const { supabase } = await requireAdminPermission('listings')
  const { error } = await supabase
    .from('listings')
    .update({
      title,
      area,
      exact_address: exactAddress || null,
      bedrooms,
      bathrooms,
      max_guests: maxGuests,
      sleeping_setup: sleepingSetup || null,
      price_ils: priceIls,
      price_usd: priceUsd,
      booking_type: bookingType,
      online_payment_enabled: onlinePaymentEnabled,
      amenities,
      description: description || null,
      is_published: finalPublished,
      is_featured: isFeatured,
      admin_status: adminStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)

  if (error) throw error

  await logAdminAction(supabase, 'edit_listing_details', 'listing', listingId)
  await sendListingHostAdminUpdateEmail({
    supabase,
    listingId,
    subject: 'JLM Collective updated your listing details',
    intro: 'JLM Collective made an administrative update to your listing details. Please sign in to review the latest version.',
    ctaPath: `/host/dashboard/listings/${listingId}`,
    ctaLabel: 'Review listing details',
  })

  revalidatePath('/admin')
  revalidatePath('/admin/listings')
  revalidatePath('/admin/readiness')
  revalidatePath(`/admin/listings/${listingId}`)
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

  const { data: deleted, error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)
    .select('id')

  if (error) {
    throw new Error(
      `This listing could not be deleted, most likely because bookings, enquiries or reviews still reference it. Archive it instead to take it off the site while keeping its history. (${error.message})`,
    )
  }

  if (!deleted || deleted.length === 0) {
    throw new Error(
      'Nothing was deleted. Your admin account does not have delete permission on listings — run migration 068, which adds the missing policy.',
    )
  }

  await logAdminAction(supabase, 'delete_listing', 'listing', listingId)

  revalidatePath('/admin')
  revalidatePath('/admin/listings')
  revalidatePath(`/listings/${listingId}`)
  revalidatePath('/stays')
  redirect('/admin/listings')
}

export async function archiveListing(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')
  const restore = String(formData.get('restore') || '') === 'true'

  if (!listingId) {
    throw new Error('Missing listing id.')
  }

  const { supabase } = await requireAdminPermission('listings')

  // Archiving also unpublishes, so every public query (which all filter on
  // is_published) hides the listing without needing to know about archiving.
  const { data, error } = await supabase
    .from('listings')
    .update(
      restore
        ? { archived_at: null }
        : { archived_at: new Date().toISOString(), is_published: false },
    )
    .eq('id', listingId)
    .select('id')

  if (error) throw error

  if (!data || data.length === 0) {
    throw new Error(
      'The listing was not changed. Check that your admin account has update permission on listings.',
    )
  }

  await logAdminAction(
    supabase,
    restore ? 'restore_listing' : 'archive_listing',
    'listing',
    listingId,
  )

  revalidatePath('/admin')
  revalidatePath('/admin/listings')
  revalidatePath(`/admin/listings/${listingId}`)
  revalidatePath(`/listings/${listingId}`)
  revalidatePath('/stays')
}

export async function createAdminListing(formData: FormData) {
  const hostId = String(formData.get('hostId') || '')
  const title = String(formData.get('title') || '').trim()
  const area = String(formData.get('area') || '').trim()
  const exactAddress = String(formData.get('exactAddress') || '').trim()
  const bedrooms = parseNumber(formData.get('bedrooms'), 0)
  const bathrooms = parseOptionalNumber(formData.get('bathrooms'))
  const maxGuests = parseNumber(formData.get('maxGuests'), 1)
  const sleepingSetup = String(formData.get('sleepingSetup') || '').trim()
  const priceIls = parseOptionalNumber(formData.get('priceIls'))
  const priceUsd = parseOptionalNumber(formData.get('priceUsd'))
  const bookingType = String(formData.get('bookingType') || 'request')
  const onlinePaymentEnabled = formData.get('onlinePaymentEnabled') === 'on'
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
      sleeping_setup: sleepingSetup || null,
      price_ils: priceIls,
      price_usd: priceUsd,
      booking_type: bookingType,
      online_payment_enabled: onlinePaymentEnabled,
      amenities: [],
      description: description || null,
      is_published: isPublished,
      is_featured: false,
      admin_status: isPublished ? 'live' : 'needs_work',
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

function isListingAdminStatus(value: string): value is ListingAdminStatus {
  return listingAdminStatuses.includes(value as ListingAdminStatus)
}
