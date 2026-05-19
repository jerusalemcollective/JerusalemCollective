'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminPermission } from '@/lib/admin'

export async function updateHostVerification(formData: FormData) {
  const hostId = String(formData.get('hostId') || '')
  const rawValue = String(formData.get('value') || '')

  if (!hostId) {
    throw new Error('Missing host id.')
  }

  if (!['true', 'false'].includes(rawValue)) {
    throw new Error('Invalid host verification value.')
  }

  const value = rawValue === 'true'

  const { supabase } = await requireAdminPermission('hosts')
  const { error } = await supabase
    .from('hosts')
    .update({ is_verified: value })
    .eq('id', hostId)

  if (error) throw error
  revalidatePath('/admin')
  revalidatePath('/admin/hosts')
  revalidatePath(`/hosts/${hostId}`)
}
