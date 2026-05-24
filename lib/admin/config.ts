import { ADMIN_ROLES, type AdminRole } from '@/lib/constants'

const ADMIN_ROLE_SET: ReadonlySet<string> = new Set(ADMIN_ROLES)

export { ADMIN_ROLES, type AdminRole }

export function isAdminRole(value: string): value is AdminRole {
  return ADMIN_ROLE_SET.has(value)
}

export function normalizeAdminRole(value: string | null | undefined, fallback: AdminRole = 'none'): AdminRole {
  return value && isAdminRole(value) ? value : fallback
}
