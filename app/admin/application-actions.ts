'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdminPermission } from '@/lib/admin'
import { logAdminAction } from '@/lib/audit'
import { sendHostAdminUpdateEmail } from '@/lib/transactional-email'
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/lib/constants'
import {
  calculateShulDistances,
  saveShulDistances,
} from '@/lib/shul-distances'

export type RequestChangesState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export type ApplicationStatusState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

const applicationEditableFields = [
  'apartment_title',
  'area',
  'exact_address',
  'bedrooms',
  'bathrooms',
  'sleeps',
  'price_ils',
  'price_usd',
  'amenities',
  'kosher_kitchen_level',
  'shabbat_elevator',
  'physical_key_entry',
  'shabbat_clock',
  'sukkah_balcony',
  'near_synagogue',
  'walking_minutes_to_kotel',
  'central_ac',
  'american_washer_dryer',
  'american_mattress',
  'powerful_water_heater',
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
  price_ils: number | null
  price_usd: number | null
  amenities: string[]
  kosher_kitchen_level?: string | null
  shabbat_elevator?: boolean
  physical_key_entry?: boolean
  shabbat_clock?: boolean
  sukkah_balcony?: boolean
  near_synagogue?: boolean
  walking_minutes_to_kotel?: number | null
  central_ac?: boolean
  american_washer_dryer?: boolean
  american_mattress?: boolean
  powerful_water_heater?: boolean
  american_comfort?: boolean
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
  price_ils: number | null
  price_usd: number | null
  amenities: string[] | null
  kosher_kitchen_level?: string | null
  shabbat_elevator?: boolean | null
  physical_key_entry?: boolean | null
  shabbat_clock?: boolean | null
  sukkah_balcony?: boolean | null
  near_synagogue?: boolean | null
  walking_minutes_to_kotel?: number | null
  central_ac?: boolean | null
  american_washer_dryer?: boolean | null
  american_mattress?: boolean | null
  powerful_water_heater?: boolean | null
  description: string | null
}

export async function updateApplicationStatusWithFeedback(
  _previousState: ApplicationStatusState,
  formData: FormData,
): Promise<ApplicationStatusState> {
  const applicationId = String(formData.get('applicationId') || '')
  const status = String(formData.get('status') || '')

  if (!applicationId || !isApplicationReviewStatus(status)) {
    return {
      status: 'error',
      message: 'This application update is missing required details.',
    }
  }

  try {
    await setApplicationStatus(applicationId, status)

    return {
      status: 'success',
      message: status === 'rejected' ? 'Application rejected.' : 'Application marked in review.',
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to update this application.',
    }
  }
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

  try {
    const { supabase } = await requireAdminPermission('applications')
    const { data: application, error: applicationError } = await supabase
      .from('host_applications')
      .select('id, host_id')
      .eq('id', applicationId)
      .single()

    if (applicationError || !application?.host_id) {
      throw applicationError || new Error('Application not found.')
    }

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
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : JSON.stringify(error) || 'Unable to send the message.',
    }
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

  const update = {
    apartment_title: String(formData.get('apartment_title') || '').trim(),
    area: String(formData.get('area') || '').trim(),
    exact_address: String(formData.get('exact_address') || '').trim() || null,
    bedrooms: parseNullableNumber(formData.get('bedrooms')),
    bathrooms: parseNullableNumber(formData.get('bathrooms')),
    sleeps: parseNullableNumber(formData.get('sleeps')),
    price_ils: parseNullableNumber(formData.get('price_ils')),
    price_usd: parseNullableNumber(formData.get('price_usd')),
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

export async function approveAndPublishApplication(formData: FormData) {
  const applicationId = String(formData.get('applicationId') || '')

  if (!applicationId) {
    throw new Error('Missing application id.')
  }

  const { supabase } = await requireAdminPermission('applications')
  const { data: application, error: applicationError } = await supabase
    .from('host_applications')
    .select('*')
    .eq('id', applicationId)
    .single()

  if (applicationError || !application) {
    throw applicationError || new Error('Application not found.')
  }

  const hostApplication = application as HostApplicationRecord
  if (!hostApplication.host_id) {
    throw new Error('This application is missing a host id.')
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
    price_ils: hostApplication.price_ils,
    price_usd: hostApplication.price_usd,
    amenities: hostApplication.amenities || [],
    kosher_kitchen_level: hostApplication.kosher_kitchen_level || null,
    shabbat_elevator: Boolean(hostApplication.shabbat_elevator),
    physical_key_entry: Boolean(hostApplication.physical_key_entry),
    shabbat_clock: Boolean(hostApplication.shabbat_clock),
    sukkah_balcony: Boolean(hostApplication.sukkah_balcony),
    near_synagogue: Boolean(hostApplication.near_synagogue),
    walking_minutes_to_kotel: hostApplication.walking_minutes_to_kotel ?? null,
    central_ac: Boolean(hostApplication.central_ac),
    american_washer_dryer: Boolean(hostApplication.american_washer_dryer),
    american_mattress: Boolean(hostApplication.american_mattress),
    powerful_water_heater: Boolean(hostApplication.powerful_water_heater),
    american_comfort:
      Boolean(hostApplication.central_ac) &&
      Boolean(hostApplication.american_washer_dryer) &&
      Boolean(hostApplication.american_mattress) &&
      Boolean(hostApplication.powerful_water_heater),
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

  const { error: approvalError } = await supabase
    .from('host_applications')
    .update({
      status: 'approved',
      verification_status: 'approved',
      id_verified: true,
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

  const { error: hostVerificationError } = await supabase
    .from('hosts')
    .update({ is_verified: true })
    .eq('id', hostApplication.host_id)

  if (hostVerificationError) throw hostVerificationError

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
  revalidatePath(`/listings/${listingId}`)
  redirect('/admin/applications')
}

export async function rejectApplicationAndReturn(formData: FormData) {
  const applicationId = String(formData.get('applicationId') || '')

  if (!applicationId) {
    throw new Error('Missing application id.')
  }

  await setApplicationStatus(applicationId, 'rejected')
  redirect('/admin/applications')
}

export async function unrejectApplicationAndReturn(formData: FormData) {
  const applicationId = String(formData.get('applicationId') || '')

  if (!applicationId) {
    throw new Error('Missing application id.')
  }

  await setApplicationStatus(applicationId, 'in_review')
  redirect(`/admin/applications/${applicationId}`)
}

function isApplicationReviewStatus(status: string): status is Extract<ApplicationStatus, 'in_review' | 'rejected'> {
  return (APPLICATION_STATUSES as readonly string[]).includes(status) &&
    (status === 'in_review' || status === 'rejected')
}

async function setApplicationStatus(
  applicationId: string,
  status: 'in_review' | 'rejected',
) {
  const { supabase } = await requireAdminPermission('applications')
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
      throw new Error('No application was updated. Check that this application still exists.')
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
    throw new Error('No application was updated. Check that this application still exists.')
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
