'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminPermission } from '@/lib/admin'
import type { AdminActionState } from '@/components/admin-confirm-action-form'
import { logAdminAction } from '@/lib/audit'
import { sendHostAdminUpdateEmail } from '@/lib/transactional-email'
import { toLegacyPrices } from '@/lib/fx'
import { isHostPriceCurrency } from '@/lib/currencies'
import {
  calculateShulDistances,
  saveShulDistances,
} from '@/lib/shul-distances'

export type RequestChangesState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

type AdminSupabase = Awaited<ReturnType<typeof requireAdminPermission>>['supabase']

// An error whose message is already plain enough to show the admin as-is.
// Anything else is logged and replaced with a generic message.
class AdminFacingError extends Error {}

function toFailure(error: unknown, fallback: string): AdminActionState {
  if (error instanceof AdminFacingError) return { status: 'error', message: error.message }
  console.error(fallback, error)
  return { status: 'error', message: fallback }
}

const applicationEditableFields = [
  'apartment_title',
  'area',
  'exact_address',
  'bedrooms',
  'bathrooms',
  'sleeps',
  'sleeping_setup',
  'price_ils',
  'price_usd',
  'price',
  'price_currency',
  'amenities',
  'kosher_kitchen_level',
  'shabbat_elevator',
  'physical_key_entry',
  'shabbat_clock',
  'sukkah_balcony',
  'near_synagogue',
  'walking_minutes_to_kotel',
  'description',
] as const

type ListingWritePayload = {
  host_id: string
  title: string
  area: string
  exact_address: string | null
  latitude: number | null
  longitude: number | null
  bedrooms: number
  bathrooms: number | null
  max_guests: number
  sleeping_setup?: string | null
  price_ils: number | null
  price_usd: number | null
  price?: number | null
  price_currency?: string | null
  amenities: string[]
  kosher_kitchen_level?: string | null
  shabbat_elevator?: boolean
  physical_key_entry?: boolean
  shabbat_clock?: boolean
  sukkah_balcony?: boolean
  near_synagogue?: boolean
  walking_minutes_to_kotel?: number | null
  description: string | null
  booking_type?: string
  is_published: boolean
  application_id?: string
}

type HostApplicationRecord = {
  id: string
  host_id: string
  apartment_title: string
  area: string
  exact_address: string | null
  latitude?: number | null
  longitude?: number | null
  bedrooms: number | null
  bathrooms: number | null
  sleeps: number | null
  sleeping_setup?: string | null
  price_ils: number | null
  price_usd: number | null
  price?: number | null
  price_currency?: string | null
  amenities: string[] | null
  kosher_kitchen_level?: string | null
  shabbat_elevator?: boolean | null
  physical_key_entry?: boolean | null
  shabbat_clock?: boolean | null
  sukkah_balcony?: boolean | null
  near_synagogue?: boolean | null
  walking_minutes_to_kotel?: number | null
  description: string | null
}

export async function requestApplicationChanges(
  _previousState: RequestChangesState,
  formData: FormData,
): Promise<RequestChangesState> {
  const applicationId = String(formData.get('applicationId') || '')
  const feedback = String(formData.get('feedback') || '').trim()
  const sections = formData.getAll('sections').map(String).filter(Boolean)

  if (!applicationId || !feedback) {
    return {
      status: 'error',
      message: 'Please add the changes needed before sending.',
    }
  }

  const { supabase } = await requireAdminPermission('applications')

  try {
    const { data: application, error: applicationError } = await supabase
      .from('host_applications')
      .select('id, host_id')
      .eq('id', applicationId)
      .single()

    if (applicationError) throw applicationError
    if (!application?.host_id) throw new AdminFacingError('This application no longer exists.')

    const updatePayload = {
      status: 'changes_requested',
      admin_feedback: feedback,
      admin_feedback_sections: sections,
      changes_requested_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('host_applications')
      .update(updatePayload)
      .eq('id', applicationId)

    if (updateError && isMissingColumnError(updateError, 'admin_feedback_sections')) {
      const { error: fallbackUpdateError } = await supabase
        .from('host_applications')
        .update({
          status: 'changes_requested',
          admin_feedback: feedback,
          changes_requested_at: new Date().toISOString(),
        })
        .eq('id', applicationId)

      if (fallbackUpdateError) throw fallbackUpdateError
    } else if (updateError) {
      throw updateError
    }

    await logAdminAction(
      supabase,
      'request_changes',
      'application',
      applicationId,
      sections.length ? sections.join(', ') : undefined,
    )
    await sendHostAdminUpdateEmail({
      supabase,
      hostId: application.host_id,
      subject: 'JLM Collective requested changes to your listing',
      intro: 'JLM Collective has reviewed your listing and requested a few changes before it can move forward.',
      ctaPath: `/host/dashboard/applications/${applicationId}`,
      ctaLabel: 'View requested changes',
    })

    revalidatePath('/admin')
    revalidatePath(`/admin/applications/${applicationId}`)
    revalidatePath('/host/dashboard')
    revalidatePath('/host/dashboard/listings')
    revalidatePath(`/host/dashboard/applications/${applicationId}`)

    return {
      status: 'success',
      message: 'Message sent to the host as JLM Collective.',
    }
  } catch (error) {
    return toFailure(error, 'The message could not be sent. Please try again.')
  }
}

export async function updateAdminApplicationDetails(formData: FormData) {
  const applicationId = String(formData.get('applicationId') || '')

  if (!applicationId) {
    throw new Error('Missing application id.')
  }

  const { supabase } = await requireAdminPermission('applications')
  const { data: application, error: applicationError } = await supabase
    .from('host_applications')
    .select('id, host_id')
    .eq('id', applicationId)
    .single()

  if (applicationError || !application) {
    throw applicationError || new Error('Application not found.')
  }

  const priceCurrencyRaw = String(formData.get('price_currency') || 'ILS')
  const priceCurrency = isHostPriceCurrency(priceCurrencyRaw) ? priceCurrencyRaw : 'ILS'
  const price = parseNullableNumber(formData.get('price'))
  const { price_ils: derivedIls, price_usd: derivedUsd } = await toLegacyPrices(price, priceCurrency)

  const update = {
    apartment_title: String(formData.get('apartment_title') || '').trim(),
    area: String(formData.get('area') || '').trim(),
    exact_address: String(formData.get('exact_address') || '').trim() || null,
    bedrooms: parseNullableNumber(formData.get('bedrooms')),
    bathrooms: parseNullableNumber(formData.get('bathrooms')),
    sleeps: parseNullableNumber(formData.get('sleeps')),
    sleeping_setup: String(formData.get('sleeping_setup') || '').trim() || null,
    price,
    price_currency: priceCurrency,
    price_ils: derivedIls,
    price_usd: derivedUsd,
    amenities: parseAmenities(formData.getAll('amenities')),
    description: String(formData.get('description') || '').trim() || null,
  }

  if (!update.apartment_title || !update.area) {
    throw new Error('Title and neighbourhood are required.')
  }

  const { error: updateError } = await supabase
    .from('host_applications')
    .update(update)
    .eq('id', applicationId)

  if (updateError) throw updateError

  const { data: linkedListing } = await supabase
    .from('listings')
    .select('id')
    .eq('application_id', applicationId)
    .maybeSingle()

  if (linkedListing?.id) {
    const { error: listingUpdateError } = await supabase
      .from('listings')
      .update({
        title: update.apartment_title,
        area: update.area,
        exact_address: update.exact_address,
        bedrooms: update.bedrooms || 0,
        bathrooms: update.bathrooms,
        max_guests: update.sleeps || 1,
        sleeping_setup: update.sleeping_setup,
        price: update.price,
        price_currency: update.price_currency,
        price_ils: update.price_ils,
        price_usd: update.price_usd,
        amenities: update.amenities,
        description: update.description,
      })
      .eq('id', linkedListing.id)

    if (listingUpdateError) throw listingUpdateError

    revalidatePath(`/listings/${linkedListing.id}`)
  }

  await logAdminAction(
    supabase,
    'edit_application_details',
    'application',
    applicationId,
    applicationEditableFields.join(', '),
  )

  await sendHostAdminUpdateEmail({
    supabase,
    hostId: application.host_id,
    subject: 'JLM Collective updated your listing details',
    intro: 'JLM Collective made an administrative update to your listing details. Please sign in to review the latest version.',
    ctaPath: `/host/dashboard/applications/${applicationId}`,
    ctaLabel: 'Review listing details',
  })

  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${applicationId}`)
  revalidatePath('/host/dashboard')
  revalidatePath('/host/dashboard/listings')
  revalidatePath(`/host/dashboard/applications/${applicationId}`)
}

export async function approveAndPublishApplication(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const applicationId = String(formData.get('applicationId') || '')

  if (!applicationId) {
    return { status: 'error', message: 'This button is missing the application. Please refresh the page and try again.' }
  }

  const { supabase } = await requireAdminPermission('applications')

  try {
    await approveApplication(supabase, applicationId)
  } catch (error) {
    return toFailure(error, 'Could not approve this application. Please try again.')
  }

  redirect('/admin/applications')
}

async function approveApplication(supabase: AdminSupabase, applicationId: string) {
  const { data: application, error: applicationError } = await supabase
    .from('host_applications')
    .select('*')
    .eq('id', applicationId)
    .maybeSingle()

  if (applicationError) throw applicationError
  if (!application) throw new AdminFacingError('This application no longer exists.')

  // Guard against a double click or a stale tab re-running the approval
  // (which would re-publish the listing and email the host again).
  if (application.status === 'approved') {
    throw new AdminFacingError('This application is already approved.')
  }

  const hostApplication = application as HostApplicationRecord
  if (!hostApplication.host_id) {
    throw new AdminFacingError('This application has no host account linked, so it cannot be approved.')
  }

  const { data: existingListing, error: existingListingError } = await supabase
    .from('listings')
    .select('id')
    .eq('application_id', applicationId)
    .maybeSingle()

  if (existingListingError && !isMissingColumnError(existingListingError, 'application_id')) {
    throw existingListingError
  }

  let listingId: string | null = existingListing?.id ?? null
  const listingPayload: ListingWritePayload = {
    host_id: hostApplication.host_id,
    title: hostApplication.apartment_title,
    area: hostApplication.area,
    exact_address: hostApplication.exact_address,
    latitude: hostApplication.latitude ?? null,
    longitude: hostApplication.longitude ?? null,
    bedrooms: hostApplication.bedrooms || 0,
    bathrooms: hostApplication.bathrooms,
    max_guests: hostApplication.sleeps || 1,
    sleeping_setup: hostApplication.sleeping_setup || null,
    price_ils: hostApplication.price_ils,
    price_usd: hostApplication.price_usd,
    price: hostApplication.price ?? null,
    price_currency: hostApplication.price_currency ?? null,
    amenities: hostApplication.amenities || [],
    kosher_kitchen_level: hostApplication.kosher_kitchen_level || null,
    shabbat_elevator: Boolean(hostApplication.shabbat_elevator),
    physical_key_entry: Boolean(hostApplication.physical_key_entry),
    shabbat_clock: Boolean(hostApplication.shabbat_clock),
    sukkah_balcony: Boolean(hostApplication.sukkah_balcony),
    near_synagogue: Boolean(hostApplication.near_synagogue),
    walking_minutes_to_kotel: hostApplication.walking_minutes_to_kotel ?? null,
    description: hostApplication.description,
    is_published: true,
  }

  if (!listingId) {
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .insert({
        ...listingPayload,
        application_id: applicationId,
        booking_type: 'request',
      })
      .select('id')
      .single()

    if (listingError && isMissingColumnError(listingError, 'application_id')) {
      const { data: fallbackListing, error: fallbackListingError } = await supabase
        .from('listings')
        .insert({
          ...listingPayload,
          booking_type: 'request',
        })
        .select('id')
        .single()

      if (fallbackListingError) throw fallbackListingError
      if (!fallbackListing?.id) throw new Error('Listing was not created.')
      listingId = fallbackListing.id
    } else {
      if (listingError) throw listingError
      if (!listing?.id) throw new Error('Listing was not created.')
      listingId = listing.id
    }
  } else {
    const { error: listingUpdateError } = await supabase
      .from('listings')
      .update({
        ...listingPayload,
        application_id: applicationId,
      })
      .eq('id', listingId)

    if (listingUpdateError && isMissingColumnError(listingUpdateError, 'application_id')) {
      const { error: fallbackListingUpdateError } = await supabase
        .from('listings')
        .update(listingPayload)
        .eq('id', listingId)

      if (fallbackListingUpdateError) throw fallbackListingUpdateError
    } else if (listingUpdateError) {
      throw listingUpdateError
    }
  }

  if (!listingId) {
    throw new Error('Listing was not created.')
  }

  if (
    hostApplication.latitude &&
    hostApplication.longitude &&
    hostApplication.area
  ) {
    try {
      const distances = await calculateShulDistances(
        listingId,
        hostApplication.latitude,
        hostApplication.longitude,
        hostApplication.area,
      )
      await saveShulDistances(
        supabase,
        listingId,
        distances,
      )
    } catch (error) {
      console.error(
        'Shul distance calculation failed — listing still approved:',
        error,
      )
    }
  }

  const { error: photoUpdateError } = await supabase
    .from('listing_photos')
    .update({ listing_id: listingId })
    .eq('application_id', applicationId)

  if (photoUpdateError) throw photoUpdateError

  // Approval does not touch id_verified or hosts.is_verified: the "Verified
  // host" badge means an admin has checked the host's ID, which is recorded
  // separately with "Mark ID as verified" (setApplicationIdVerified).
  const { error: approvalError } = await supabase
    .from('host_applications')
    .update({
      status: 'approved',
      verification_status: 'approved',
    })
    .eq('id', applicationId)

  if (approvalError && isMissingOptionalApplicationColumnError(approvalError)) {
    const { error: fallbackApprovalError } = await supabase
      .from('host_applications')
      .update({ status: 'approved' })
      .eq('id', applicationId)

    if (fallbackApprovalError) throw fallbackApprovalError
  } else if (approvalError) {
    throw approvalError
  }

  await logAdminAction(supabase, 'approve_application', 'application', applicationId)
  await sendHostAdminUpdateEmail({
    supabase,
    hostId: hostApplication.host_id,
    subject: 'Your JLM Collective listing has been approved',
    intro: 'Good news. Your stay has been approved and published on JLM Collective.',
    ctaPath: `/host/dashboard/applications/${applicationId}`,
    ctaLabel: 'View your listing status',
  })

  revalidatePath('/admin')
  revalidatePath(`/admin/applications/${applicationId}`)
  revalidatePath('/admin/applications')
  revalidatePath('/host/dashboard')
  revalidatePath('/host/dashboard/listings')
  revalidatePath(`/host/dashboard/applications/${applicationId}`)
  revalidatePath('/stays')
  revalidatePath('/')
  revalidatePath(`/listings/${listingId}`)
}

export async function rejectApplication(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const applicationId = String(formData.get('applicationId') || '')

  if (!applicationId) {
    return { status: 'error', message: 'This button is missing the application. Please refresh the page and try again.' }
  }

  try {
    await setApplicationStatus(applicationId, 'rejected')
  } catch (error) {
    return toFailure(error, 'Could not reject this application. Please try again.')
  }

  redirect('/admin/applications')
}

export async function unrejectApplication(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const applicationId = String(formData.get('applicationId') || '')

  if (!applicationId) {
    return { status: 'error', message: 'This button is missing the application. Please refresh the page and try again.' }
  }

  try {
    await setApplicationStatus(applicationId, 'in_review')
  } catch (error) {
    return toFailure(error, 'Could not reopen this application. Please try again.')
  }

  return { status: 'success', message: 'Application is back in review.' }
}

export async function markApplicationInReviewOnOpen(applicationId: string) {
  if (!applicationId) return

  const { supabase } = await requireAdminPermission('applications')

  const { data: current } = await supabase
    .from('host_applications')
    .select('status')
    .eq('id', applicationId)
    .maybeSingle()

  const status = current?.status
  // Only auto-transition a freshly submitted application; never override a
  // decision an admin has already made (in_review/approved/rejected/changes).
  if (!status || ['in_review', 'approved', 'rejected', 'changes_requested'].includes(status)) {
    return
  }

  const { error } = await supabase
    .from('host_applications')
    .update({ status: 'in_review', verification_status: 'pending' })
    .eq('id', applicationId)

  if (error && isMissingOptionalApplicationColumnError(error)) {
    await supabase.from('host_applications').update({ status: 'in_review' }).eq('id', applicationId)
  } else if (error) {
    // Non-fatal: opening the page should not hard-fail on an auto-transition.
    console.error('Auto in-review transition failed', error)
    return
  }

  await logAdminAction(supabase, 'set_status_in_review', 'application', applicationId)

  revalidatePath('/admin')
  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${applicationId}`)
}

export async function setApplicationIdVerified(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const applicationId = String(formData.get('applicationId') || '')
  const verified = String(formData.get('verified') || '') === 'true'

  if (!applicationId) {
    return { status: 'error', message: 'This button is missing the application. Please refresh the page and try again.' }
  }

  const { supabase } = await requireAdminPermission('applications')

  const { data, error } = await supabase
    .from('host_applications')
    .update({ id_verified: verified })
    .eq('id', applicationId)
    .select('id, host_id')
    .maybeSingle()

  if (error && isMissingColumnError(error, 'id_verified')) {
    console.error('id_verified column is missing on host_applications', error)
    return { status: 'error', message: 'ID verification is not set up yet. Ask your developer to add it.' }
  }
  if (error) return toFailure(error, 'Could not update ID verification. Please try again.')
  if (!data?.id) {
    return { status: 'error', message: 'The application was not changed. Please refresh the page and try again.' }
  }

  await logAdminAction(
    supabase,
    verified ? 'verify_id' : 'unverify_id',
    'application',
    applicationId,
  )

  // The public "Verified host" badge (hosts.is_verified) follows the ID check:
  // on when an ID is checked, off only when none of the host's applications
  // still has a checked ID.
  const hostId = (data as { host_id?: string | null }).host_id
  let hostMessage = ''
  if (hostId) {
    try {
      const hostVerified = verified || (await hostHasCheckedId(supabase, hostId))
      const { error: hostError } = await supabase
        .from('hosts')
        .update({ is_verified: hostVerified })
        .eq('id', hostId)
      if (hostError) throw hostError
      revalidatePath(`/hosts/${hostId}`)
      revalidatePath('/listings/[id]', 'page')
      revalidatePath('/admin/hosts')
      if (!verified && hostVerified) {
        hostMessage = ' The host keeps the Verified host badge because another of their applications has a checked ID.'
      }
    } catch (hostError) {
      console.error('Could not update the host verified badge', hostError)
      hostMessage = ' The Verified host badge could not be updated — set it from the host’s page in Admin → Users.'
    }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${applicationId}`)

  return {
    status: 'success',
    message: (verified ? 'ID marked as verified.' : 'ID marked as not verified.') + hostMessage,
  }
}

// Throws AdminFacingError when the application is already in the target state,
// so a repeat click or stale tab can't re-reject (and re-email) the host.
async function setApplicationStatus(
  applicationId: string,
  status: 'in_review' | 'rejected',
) {
  const { supabase } = await requireAdminPermission('applications')

  const { data: current, error: currentError } = await supabase
    .from('host_applications')
    .select('status')
    .eq('id', applicationId)
    .maybeSingle()

  if (currentError) throw currentError
  if (!current) throw new AdminFacingError('This application no longer exists.')
  if (current.status === status) {
    throw new AdminFacingError(
      status === 'rejected' ? 'This application is already rejected.' : 'This application is already in review.',
    )
  }
  const update =
    status === 'rejected'
      ? {
          status,
          verification_status: 'rejected',
          admin_feedback: null,
          changes_requested_at: null,
          rejected_at: new Date().toISOString(),
        }
      : {
          status,
          verification_status: 'pending',
          admin_feedback: null,
          changes_requested_at: null,
          rejected_at: null,
        }

  const { data, error } = await supabase
    .from('host_applications')
    .update(update)
    .eq('id', applicationId)
    .select('id')
    .maybeSingle()

  if (error && isMissingOptionalApplicationColumnError(error)) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('host_applications')
      .update({ status })
      .eq('id', applicationId)
      .select('id')
      .maybeSingle()

    if (fallbackError) throw fallbackError

    if (!fallbackData?.id) {
      throw new AdminFacingError('The application was not changed. Please refresh the page and try again.')
    }

    await logAdminAction(supabase, `set_status_${status}`, 'application', applicationId)
    await notifyHostOfApplicationStatus(supabase, applicationId, status)

    revalidatePath('/admin')
    revalidatePath('/admin/applications')
    revalidatePath(`/admin/applications/${applicationId}`)
    revalidatePath('/host/dashboard')
    revalidatePath('/host/dashboard/listings')
    revalidatePath(`/host/dashboard/applications/${applicationId}`)
    return
  }

  if (error) throw error

  if (!data?.id) {
    throw new AdminFacingError('The application was not changed. Please refresh the page and try again.')
  }

  await logAdminAction(supabase, `set_status_${status}`, 'application', applicationId)
  await notifyHostOfApplicationStatus(supabase, applicationId, status)

  revalidatePath('/admin')
  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${applicationId}`)
  revalidatePath('/host/dashboard')
  revalidatePath('/host/dashboard/listings')
  revalidatePath(`/host/dashboard/applications/${applicationId}`)
}

function isMissingColumnError(error: unknown, column: string) {
  const message = getErrorMessage(error).toLowerCase()
  return message.includes(column.toLowerCase()) && message.includes('column')
}

function parseNullableNumber(value: FormDataEntryValue | null) {
  const rawValue = String(value || '').trim()
  if (!rawValue) return null
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? parsed : null
}

function parseAmenities(value: FormDataEntryValue | FormDataEntryValue[] | null) {
  const values = Array.isArray(value) ? value : [value]

  return values
    .flatMap((item) => String(item || '').split(/\r?\n|,/))
    .map((item) => item.trim())
    .filter(Boolean)
}

async function notifyHostOfApplicationStatus(
  supabase: Awaited<ReturnType<typeof requireAdminPermission>>['supabase'],
  applicationId: string,
  status: 'in_review' | 'rejected',
) {
  const { data: application } = await supabase
    .from('host_applications')
    .select('id, host_id')
    .eq('id', applicationId)
    .maybeSingle()

  if (!application?.host_id) return

  await sendHostAdminUpdateEmail({
    supabase,
    hostId: application.host_id,
    subject:
      status === 'rejected'
        ? 'Update on your JLM Collective listing'
        : 'Your JLM Collective listing is now in review',
    intro:
      status === 'rejected'
        ? 'JLM Collective has updated your listing application. Please sign in to view the latest status.'
        : 'JLM Collective has started reviewing your submitted stay.',
    ctaPath: `/host/dashboard/applications/${applicationId}`,
    ctaLabel: 'View update',
  })
}

async function hostHasCheckedId(supabase: AdminSupabase, hostId: string) {
  const { data, error } = await supabase
    .from('host_applications')
    .select('id')
    .eq('host_id', hostId)
    .eq('id_verified', true)
    .limit(1)
  if (error) throw error
  return (data ?? []).length > 0
}

function isMissingOptionalApplicationColumnError(error: unknown) {
  return ['verification_status', 'id_verified', 'admin_feedback', 'changes_requested_at', 'rejected_at'].some(
    (column) => isMissingColumnError(error, column),
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' ? message : ''
  }
  return ''
}
