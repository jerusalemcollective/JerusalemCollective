export const ADMIN_ROLES = ['owner', 'operations', 'support', 'content', 'analyst', 'none'] as const

export type AdminRole = typeof ADMIN_ROLES[number]

const ADMIN_ROLE_SET: ReadonlySet<string> = new Set(ADMIN_ROLES)

export function isAdminRole(value: string): value is AdminRole {
  return ADMIN_ROLE_SET.has(value)
}

export function normalizeAdminRole(value: string | null | undefined, fallback: AdminRole = 'none'): AdminRole {
  return value && isAdminRole(value) ? value : fallback
}
