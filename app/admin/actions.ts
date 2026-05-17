'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin'

export type AdminGrantState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export async function updateApplicationStatus(formData: FormData) {
  const applicationId = String(formData.get('applicationId') || '')
  const status = String(formData.get('status') || '')

  if (!applicationId || !['in_review', 'rejected'].includes(status)) {
    throw new Error('Invalid application update.')
  }

  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('host_applications')
    .update({ status })
    .eq('id', applicationId)

  if (error) throw error
  revalidatePath('/admin')
  revalidatePath(`/admin/applications/${applicationId}`)
}

export async function approveAndPublishApplication(formData: FormData) {
  const applicationId = String(formData.get('applicationId') || '')

  if (!applicationId) {
    throw new Error('Missing application id.')
  }

  const { supabase } = await requireAdmin()
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
    .eq('host_id', application.host_id)
    .eq('title', application.apartment_title)
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
      .update({ is_published: true })
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

export async function updateListingVisibility(formData: FormData) {
  const listingId = String(formData.get('listingId') || '')
  const field = String(formData.get('field') || '')
  const value = String(formData.get('value') || '') === 'true'

  if (!listingId || !['is_published', 'is_featured'].includes(field)) {
    throw new Error('Invalid listing update.')
  }

  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('listings')
    .update({ [field]: value })
    .eq('id', listingId)

  if (error) throw error
  revalidatePath('/admin')
  revalidatePath('/admin/listings')
  revalidatePath(`/listings/${listingId}`)
  revalidatePath('/stays')
}

export async function updateHostVerification(formData: FormData) {
  const hostId = String(formData.get('hostId') || '')
  const value = String(formData.get('value') || '') === 'true'

  if (!hostId) {
    throw new Error('Missing host id.')
  }

  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('hosts')
    .update({ is_verified: value })
    .eq('id', hostId)

  if (error) throw error
  revalidatePath('/admin')
  revalidatePath('/admin/hosts')
  revalidatePath(`/hosts/${hostId}`)
}

export async function updateReviewApproval(formData: FormData) {
  const reviewId = String(formData.get('reviewId') || '')
  const value = String(formData.get('value') || '') === 'true'

  if (!reviewId) {
    throw new Error('Missing review id.')
  }

  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from('reviews')
    .update({ is_approved: value })
    .eq('id', reviewId)

  if (error) throw error
  revalidatePath('/admin')
  revalidatePath('/admin/reviews')
}

export async function grantAdminByEmail(
  _previousState: AdminGrantState,
  formData: FormData,
): Promise<AdminGrantState> {
  const email = String(formData.get('email') || '').trim().toLowerCase()

  if (!email || !email.includes('@')) {
    return {
      status: 'error',
      message: 'Please enter a valid email address.',
    }
  }

  const { supabase } = await requireAdmin()
  const { error } = await supabase.rpc('grant_admin_by_email', {
    target_email: email,
  })

  if (error) {
    return {
      status: 'error',
      message: error.message,
    }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/admins')

  return {
    status: 'success',
    message: `${email} is now an admin.`,
  }
}
