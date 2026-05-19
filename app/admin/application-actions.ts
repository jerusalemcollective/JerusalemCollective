'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminPermission } from '@/lib/admin'
import { logAdminAction } from '@/lib/audit'

export type RequestChangesState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export type ApplicationStatusState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

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
      message: status === 'rejected' ? 'Listing rejected.' : 'Listing marked in review.',
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to update this listing.',
    }
  }
}

export async function requestApplicationChanges(
  _previousState: RequestChangesState,
  formData: FormData,
): Promise<RequestChangesState> {
  const applicationId = String(formData.get('applicationId') || '')
  const feedback = String(formData.get('feedback') || '').trim()

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

    const { error: updateError } = await supabase
      .from('host_applications')
      .update({
        status: 'changes_requested',
        admin_feedback: feedback,
        changes_requested_at: new Date().toISOString(),
      })
      .eq('id', applicationId)

    if (updateError) throw updateError

    await logAdminAction(supabase, 'request_changes', 'application', applicationId)

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

  await logAdminAction(supabase, 'approve_application', 'application', applicationId)

  revalidatePath('/admin')
  revalidatePath(`/admin/applications/${applicationId}`)
  revalidatePath('/admin/applications')
  revalidatePath('/host/dashboard')
  revalidatePath('/host/dashboard/listings')
  revalidatePath(`/host/dashboard/applications/${applicationId}`)
  revalidatePath('/stays')
  revalidatePath(`/listings/${listingId}`)
}

function isApplicationReviewStatus(status: string): status is 'in_review' | 'rejected' {
  return ['in_review', 'rejected'].includes(status)
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
        }
      : {
          status,
          verification_status: 'pending',
          admin_feedback: null,
          changes_requested_at: null,
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
      throw new Error('No listing was updated. Check that this application still exists.')
    }

    await logAdminAction(supabase, `set_status_${status}`, 'application', applicationId)

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
    throw new Error('No listing was updated. Check that this application still exists.')
  }

  await logAdminAction(supabase, `set_status_${status}`, 'application', applicationId)

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

function isMissingOptionalApplicationColumnError(error: unknown) {
  return ['verification_status', 'id_verified', 'admin_feedback', 'changes_requested_at'].some(
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
