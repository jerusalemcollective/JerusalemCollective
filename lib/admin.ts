import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  canAdminRole,
  describeAdminRole,
  type AdminPermission,
  type AdminRole,
} from '@/lib/admin-permissions'
import { normalizeAdminRole } from '@/lib/admin/config'

export type { AdminPermission, AdminRole }
export { describeAdminRole }

export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/admin')
  }

  const { data: profileWithRole, error: roleError } = await supabase
    .from('profiles')
    .select('id, is_admin, admin_role')
    .eq('id', user.id)
    .single()

  const { data: legacyProfile } = roleError
    ? await supabase
        .from('profiles')
        .select('id, is_admin')
        .eq('id', user.id)
        .single()
    : { data: null }

  const profile = profileWithRole || legacyProfile

  if (!profile?.is_admin) {
    redirect('/')
  }

  const adminRole =
    'admin_role' in profile && profile.admin_role
      ? normalizeAdminRole(profile.admin_role, 'owner')
      : 'owner'

  return {
    supabase,
    user,
    adminRole,
  }
}

export async function requireAdminPermission(permission: AdminPermission) {
  const admin = await requireAdmin()
  const { data: allowed, error } = await admin.supabase.rpc(
    'current_user_has_admin_permission',
    { required_permission: permission },
  )

  if (error) {
    if (!canAdminRole(admin.adminRole, permission)) {
      redirect('/admin')
    }

    return admin
  }

  if (!allowed && admin.adminRole !== 'owner') {
    redirect('/admin')
  }

  return admin
}
