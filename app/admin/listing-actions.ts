'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminPermission } from '@/lib/admin'
import { logAdminAction } from '@/lib/audit'
import { sendListingHostAdminUpdateEmail } from '@/lib/transactional-email'
import type { AdminActionState } from '@/components/admin-confirm-action-form'

export type ListingMessageState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

// Internal review marker for the JLM team. It never changes what guests see —
// visibility is is_published (Hide / Show) and archived_at (Archive / Restore).
// 'live' is a legacy value from before the split; it reads as Ready.
type ListingReviewStatus = 'needs_work' | 'ready_for_launch'

const listingReviewStatuses: ListingReviewStatus[] = ['needs_work', 'ready_for_launch']

// Paths that show listing data. The homepage is cached for 5 minutes, so it is
// included on every change or it keeps showing hidden/deleted listings.
function revalidateListingPaths(listingId?: string) {
  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/admin/listings')
  revalidatePath('/stays')
  if (listingId) {
    revalidatePath(`/admin/listings/${listingId}`)
    revalidatePath(`/listings/${listingId}`)
  }
}

// Plain message for the admin; the technical detail goes to the server log.
function failure(message: string, error?: unknown): AdminActionState {
  if (error) console.error(message, error)
  return { status: 'error', message }
}

const NOT_SAVED_PERMISSION =
  'The listing was not changed. Please refresh and try again. If it keeps happening, ask your developer to check admin permissions on listings.'

export async function updateListingVisibility(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const listingId = String(formData.get('listingId') || '')
  const field = String(formData.get('field') || '')
  const rawValue = String(formData.get('value') || '')

  if (!listingId || !['is_published', 'is_featured'].includes(field) || !['true', 'false'].includes(rawValue)) {
    return failure('This update is missing details. Please refresh the page and try again.')
  }

  const value = rawValue === 'true'

  const { supabase } = await requireAdminPermission('listings')
  const { data: listing, error: readError } = await supabase
    .from('listings')
    .select('id, archived_at')
    .eq('id', listingId)
    .maybeSingle()

  if (readError) return failure('Could not load this listing. Please try again.', readError)
  if (!listing) return failure('This listing no longer exists.')

  if (field === 'is_published' && value && listing.archived_at) {
    return failure('This listing is archived. Restore it first, then show it on the site.')
  }

  const { data: updated, error } = await supabase
    .from('listings')
    .update({ [field]: value })
    .eq('id', listingId)
    .select('id')

  if (error) return failure('Could not update this listing. Please try again.', error)

  // A row-level-security block returns no error, it simply updates nothing.
  // Without this check the admin UI reports success while nothing changed.
  if (!updated || updated.length === 0) {
    return failure(NOT_SAVED_PERMISSION, `RLS blocked ${field} update on listing ${listingId}`)
  }

  await logAdminAction(supabase, `set_${field}_${value}`, 'listing', listingId)

  // Featuring is an internal display choice, so the host is only told when the
  // listing is hidden from or shown on the site.
  if (field === 'is_published') {
    await sendListingHostAdminUpdateEmail({
      supabase,
      listingId,
      subject: value ? 'Your listing is now on JLM Collective' : 'Your listing has been hidden on JLM Collective',
      intro: value
        ? 'JLM Collective has made your listing visible on the site. Guests can now find and book it.'
        : 'JLM Collective has hidden your listing from the site for now. Guests cannot see or book it until it is shown again.',
      ctaPath: `/host/dashboard/listings/${listingId}`,
      ctaLabel: 'View your listing',
    })
  }

  revalidateListingPaths(listingId)

  const message =
    field === 'is_published'
      ? value ? 'Listing is now showing on the site.' : 'Listing is now hidden from the site.'
      : value ? 'Listing featured.' : 'Listing no longer featured.'
  return { status: 'success', message }
}

// Host-facing fields of the admin edit form, with the label used in the host's
// "what changed" email. Featured and the review marker are internal, so they are
// deliberately not listed.
const HOST_VISIBLE_FIELDS = {
  title: 'Title',
  area: 'Neighbourhood',
  exact_address: 'Address',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  max_guests: 'Max guests',
  sleeping_setup: 'Sleeping setup',
  price_ils: 'Price (ILS)',
  price_usd: 'Price (USD)',
  booking_type: 'Booking type',
  online_payment_enabled: 'Online payment',
  amenities: 'Amenities',
  description: 'Description',
} as const

type HostVisibleField = keyof typeof HOST_VISIBLE_FIELDS

export async function updateAdminListingDetails(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
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
  const isFeatured = formData.get('isFeatured') === 'on'
  const adminStatus = String(formData.get('adminStatus') || 'needs_work')

  if (!listingId) return failure('This form is missing the listing. Please refresh the page and try again.')
  if (!title || !area) return failure('Please fill in the title and neighbourhood.')
  if (!['request', 'enquiry', 'instant'].includes(bookingType)) return failure('Please choose a booking type.')
  if (!isListingReviewStatus(adminStatus)) return failure('Please choose a review status.')

  const { supabase } = await requireAdminPermission('listings')

  // Read the current values first so the host email can list only what changed.
  const { data: before, error: readError } = await supabase
    .from('listings')
    .select(Object.keys(HOST_VISIBLE_FIELDS).join(', '))
    .eq('id', listingId)
    .maybeSingle()

  if (readError) return failure('Could not load this listing. Please try again.', readError)
  if (!before) return failure('This listing no longer exists.')

  const hostVisibleUpdate: Record<HostVisibleField, unknown> = {
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
  }

  const { data: updated, error } = await supabase
    .from('listings')
    .update({
      ...hostVisibleUpdate,
      is_featured: isFeatured,
      admin_status: adminStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .select('id')

  if (error) return failure('Could not save these edits. Please check the details and try again.', error)
  if (!updated || updated.length === 0) {
    return failure(NOT_SAVED_PERMISSION, `RLS blocked details update on listing ${listingId}`)
  }

  const beforeValues = before as unknown as Record<HostVisibleField, unknown>
  const changedLabels = (Object.keys(HOST_VISIBLE_FIELDS) as HostVisibleField[])
    .filter((field) => !sameValue(beforeValues[field], hostVisibleUpdate[field]))
    .map((field) => HOST_VISIBLE_FIELDS[field])

  await logAdminAction(
    supabase,
    'edit_listing_details',
    'listing',
    listingId,
    changedLabels.length ? changedLabels.join(', ') : undefined,
  )

  if (changedLabels.length) {
    await sendListingHostAdminUpdateEmail({
      supabase,
      listingId,
      subject: 'JLM Collective updated your listing details',
      intro: `JLM Collective updated your listing "${title}". Changed: ${formatList(changedLabels)}. Please sign in to review the latest version.`,
      ctaPath: `/host/dashboard/listings/${listingId}`,
      ctaLabel: 'Review listing details',
    })
  }

  revalidateListingPaths(listingId)
  redirect(`/admin/listings/${listingId}?saved=1`)
}

// Delete refuses (and touches nothing) when the listing has any booking
// history. Photos are removed only after the listing row is gone, so a refused
// or failed delete never leaves a listing without its photos.
export async function deleteListing(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const listingId = String(formData.get('listingId') || '')

  if (!listingId) return failure('This button is missing the listing. Please refresh the page and try again.')

  const { supabase } = await requireAdminPermission('listings')

  // booking_requests cascade on delete, so they must be checked explicitly.
  // Reviews are kept as guest history too.
  const historyChecks = [
    { table: 'bookings', label: 'bookings' },
    { table: 'booking_requests', label: 'booking requests' },
    { table: 'reviews', label: 'reviews' },
  ]

  for (const check of historyChecks) {
    const { count, error } = await supabase
      .from(check.table)
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId)

    if (error) {
      return failure(`Could not check this listing's ${check.label}, so nothing was deleted. Please try again.`, error)
    }

    if ((count || 0) > 0) {
      return failure(
        `This listing has ${count} ${check.label}, so it can't be deleted. Use Archive or Hide from site instead - both keep its history.`,
      )
    }
  }

  const { data: photos, error: photoReadError } = await supabase
    .from('listing_photos')
    .select('id, photo_url, storage_path')
    .eq('listing_id', listingId)

  if (photoReadError) {
    return failure('Could not load the listing photos, so nothing was deleted. Please try again.', photoReadError)
  }

  const photoRows = (photos || []) as { id: string; photo_url: string | null; storage_path: string | null }[]
  const photoIds = photoRows.map((photo) => photo.id)

  // Detach the photos first so the photo foreign key can't block the delete,
  // whatever its ON DELETE rule. This is undone below if the delete fails.
  if (photoIds.length) {
    const { error: detachError } = await supabase
      .from('listing_photos')
      .update({ listing_id: null })
      .in('id', photoIds)

    if (detachError) {
      return failure('Could not prepare the listing photos, so nothing was deleted. Please try again.', detachError)
    }
  }

  // Calendar blocks, admin messages and wishlist entries cascade with the row.
  const { data: deleted, error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)
    .select('id')

  if (error || !deleted || deleted.length === 0) {
    if (photoIds.length) {
      const { error: reattachError } = await supabase
        .from('listing_photos')
        .update({ listing_id: listingId })
        .in('id', photoIds)
      if (reattachError) console.error('Could not re-attach photos after a failed delete', listingId, reattachError)
    }

    return error
      ? failure('This listing could not be deleted because other records still use it. Archive it or hide it instead.', error)
      : failure(
          'Nothing was deleted - your admin account is not allowed to delete listings. Ask your developer to check the listings delete permission.',
          `RLS blocked delete of listing ${listingId}`,
        )
  }

  // The listing is gone; now remove its photo files and rows. A failure here
  // only leaves orphaned files, so it is logged rather than shown.
  const storagePaths = photoRows
    .map((photo) => photo.storage_path || storagePathFromPublicUrl(photo.photo_url))
    .filter((path): path is string => Boolean(path))

  if (storagePaths.length) {
    const { error: storageError } = await supabase.storage.from('listing-photos').remove(storagePaths)
    if (storageError) console.error('Could not remove photo files for deleted listing', listingId, storageError)
  }

  if (photoIds.length) {
    const { error: photoDeleteError } = await supabase.from('listing_photos').delete().in('id', photoIds)
    if (photoDeleteError) console.error('Could not remove photo rows for deleted listing', listingId, photoDeleteError)
  }

  await logAdminAction(supabase, 'delete_listing', 'listing', listingId)

  revalidateListingPaths(listingId)
  redirect('/admin/listings')
}

export async function archiveListing(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const listingId = String(formData.get('listingId') || '')
  const restore = String(formData.get('restore') || '') === 'true'

  if (!listingId) return failure('This button is missing the listing. Please refresh the page and try again.')

  const { supabase } = await requireAdminPermission('listings')

  // Archiving also unpublishes, so every public query (which all filter on
  // is_published) hides the listing without needing to know about archiving.
  // Restoring leaves it hidden so it can be checked before showing it again.
  const { data, error } = await supabase
    .from('listings')
    .update(
      restore
        ? { archived_at: null }
        : { archived_at: new Date().toISOString(), is_published: false },
    )
    .eq('id', listingId)
    .select('id')

  if (error) return failure(`Could not ${restore ? 'restore' : 'archive'} this listing. Please try again.`, error)
  if (!data || data.length === 0) {
    return failure(NOT_SAVED_PERMISSION, `RLS blocked archive change on listing ${listingId}`)
  }

  await logAdminAction(
    supabase,
    restore ? 'restore_listing' : 'archive_listing',
    'listing',
    listingId,
  )

  revalidateListingPaths(listingId)

  return {
    status: 'success',
    message: restore
      ? 'Listing restored. It is still hidden - show it on the site when ready.'
      : 'Listing archived and removed from the site.',
  }
}

export async function createAdminListing(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
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

  if (!hostId || !title || !area) return failure('Please choose a host and fill in the title and area.')
  if (!['request', 'enquiry', 'instant'].includes(bookingType)) return failure('Please choose a booking type.')

  const { supabase } = await requireAdminPermission('listings')
  const { data: host, error: hostError } = await supabase
    .from('hosts')
    .select('id, listing_blocked')
    .eq('id', hostId)
    .maybeSingle()

  if (hostError) return failure('Could not check this host. Please try again.', hostError)
  if (!host) return failure('That host could not be found. Please choose another host.')
  if (host.listing_blocked) return failure('This host is blocked from creating listings.')

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
      admin_status: isPublished ? 'ready_for_launch' : 'needs_work',
    })
    .select('id')
    .single()

  if (error || !listing?.id) {
    return failure('Could not create the listing. Please check the details and try again.', error)
  }

  await logAdminAction(supabase, 'create_listing', 'listing', listing.id)

  revalidateListingPaths(listing.id)
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

  const { supabase } = await requireAdminPermission('listings')

  try {
    const { error } = await supabase.rpc('send_listing_admin_message', {
      target_listing_id: listingId,
      message_body: message,
    })

    if (error) {
      if (
        error.message.includes('Could not find the function') ||
        error.message.includes('send_listing_admin_message')
      ) {
        console.error('Listing messaging RPC is missing', error)
        return {
          status: 'error',
          message: 'Messaging is not set up yet. Ask your developer to install listing messages.',
        }
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
    console.error('Unable to send listing message', error)
    return {
      status: 'error',
      message: 'The message could not be sent. Please try again.',
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

function isListingReviewStatus(value: string): value is ListingReviewStatus {
  return listingReviewStatuses.includes(value as ListingReviewStatus)
}

// Compare a stored value with a submitted one, treating null/'' alike, numbers
// stored as strings (numeric columns) alike, null/false alike for switches, and
// amenities regardless of order.
function sameValue(before: unknown, after: unknown) {
  const normalise = (value: unknown): string => {
    if (Array.isArray(value)) return JSON.stringify(value.map(String).sort())
    if (typeof value === 'boolean') return value ? 'true' : ''
    if (value === null || value === undefined || value === '') return ''
    if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)))) {
      return String(Number(value))
    }
    return String(value)
  }
  return normalise(before) === normalise(after)
}

function formatList(items: string[]) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// Older photo rows have no storage_path; recover it from the public URL.
function storagePathFromPublicUrl(url: string | null) {
  if (!url) return null
  const marker = '/storage/v1/object/public/listing-photos/'
  const index = url.indexOf(marker)
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length).split('?')[0])
}
