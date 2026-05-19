'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminPermission } from '@/lib/admin'

export type RequestChangesState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export type ApplicationStatusState = {
  status: 'idle' | 'success' | 'error'
  message: string
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

    revalidatePath('/admin')
    revalidatePath(`/admin/applications/${applicationId}`)

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

  const { data: existingListing } = await supabase
    .from('listings')
    .select('id')
    .eq('application_id', applicationId)
    .maybeSingle()

  let listingId = existingListing?.id

  if (!listingId) {
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .insert({
        host_id: application.host_id,
        title: application.apartment_title,
        area: application.area,
        exact_address: application.exact_address,
        latitude: application.latitude,
        longitude: application.longitude,
        bedrooms: application.bedrooms || 0,
        bathrooms: application.bathrooms,
        max_guests: application.sleeps || 1,
        price_ils: application.price_ils,
        price_usd: application.price_usd,
        application_id: applicationId,
        amenities: application.amenities || [],
        description: application.description,
        booking_type: 'request',
        is_published: true,
      })
      .select('id')
      .single()

    if (listingError) throw listingError
    listingId = listing.id
  } else {
    const { error: listingUpdateError } = await supabase
      .from('listings')
      .update({
        title: application.apartment_title,
        area: application.area,
        exact_address: application.exact_address,
        latitude: application.latitude,
        longitude: application.longitude,
        bedrooms: application.bedrooms || 0,
        bathrooms: application.bathrooms,
        max_guests: application.sleeps || 1,
        price_ils: application.price_ils,
        price_usd: application.price_usd,
        amenities: application.amenities || [],
        description: application.description,
        application_id: applicationId,
        is_published: true,
      })
      .eq('id', listingId)

    if (listingUpdateError) throw listingUpdateError
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

  if (approvalError) throw approvalError

  revalidatePath('/admin')
  revalidatePath(`/admin/applications/${applicationId}`)
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

  if (error) throw error

  if (!data?.id) {
    throw new Error('No listing was updated. Check that this application still exists.')
  }

  revalidatePath('/admin')
  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${applicationId}`)
  revalidatePath('/host/dashboard')
  revalidatePath('/host/dashboard/listings')
}
