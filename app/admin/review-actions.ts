'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminPermission } from '@/lib/admin'

export async function updateReviewApproval(formData: FormData) {
  const reviewId = String(formData.get('reviewId') || '')
  const value = String(formData.get('value') || '') === 'true'

  if (!reviewId) {
    throw new Error('Missing review id.')
  }

  const { supabase } = await requireAdminPermission('reviews')
  const { error } = await supabase
    .from('reviews')
    .update({ is_approved: value })
    .eq('id', reviewId)

  if (error) throw error
  revalidatePath('/admin')
  revalidatePath('/admin/reviews')
}
