'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminPermission } from '@/lib/admin'
import { logAdminAction } from '@/lib/audit'
import { isAdminRole } from '@/lib/admin/config'

export type AdminGrantState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export async function grantAdminByEmail(
  _previousState: AdminGrantState,
  formData: FormData,
): Promise<AdminGrantState> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const role = String(formData.get('role') || 'operations').trim()

  if (!email || !email.includes('@')) {
    return {
      status: 'error',
      message: 'Please enter a valid email address.',
    }
  }

  if (!isAdminRole(role)) {
    return {
      status: 'error',
      message: 'Please choose a valid admin role.',
    }
  }

  const { supabase } = await requireAdminPermission('admins')
  const { data, error } = await supabase.rpc('set_admin_role_by_email', {
    target_email: email,
    target_role: role === 'none' ? '' : role,
  })

  if (error) {
    return {
      status: 'error',
      message: error.message,
    }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/admins')

  const assignedRole = data?.[0]?.admin_role
  await logAdminAction(supabase, 'grant_admin_role', 'user', email, role)

  return {
    status: 'success',
    message: assignedRole
      ? `${email} is now ${assignedRole}.`
      : `${email} no longer has admin access.`,
  }
}
