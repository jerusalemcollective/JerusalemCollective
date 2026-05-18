export type AdminRole = 'owner' | 'operations' | 'support' | 'content' | 'analyst'

export type AdminPermission =
  | 'overview'
  | 'applications'
  | 'listings'
  | 'hosts'
  | 'guests'
  | 'reviews'
  | 'analytics'
  | 'cases'
  | 'messages'
  | 'admins'

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  owner: 'Owner',
  operations: 'Operations',
  support: 'Support',
  content: 'Content',
  analyst: 'Analyst',
}

export const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  owner: 'Full access, including adding and removing admins.',
  operations: 'Manages applications, listings, hosts, guests, reviews, and analytics.',
  support: 'Handles hosts, guests, support cases, and messages.',
  content: 'Reviews applications, listings, reviews, and performance.',
  analyst: 'Views analytics, hosts, and guests without changing admin settings.',
}

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  owner: [
    'overview',
    'applications',
    'listings',
    'hosts',
    'guests',
    'reviews',
    'analytics',
    'cases',
    'messages',
    'admins',
  ],
  operations: ['overview', 'applications', 'listings', 'hosts', 'guests', 'reviews', 'analytics'],
  support: ['overview', 'hosts', 'guests', 'cases', 'messages'],
  content: ['overview', 'applications', 'listings', 'reviews', 'analytics'],
  analyst: ['overview', 'analytics', 'hosts', 'guests'],
}

export function canAdminRole(role: AdminRole | null | undefined, permission: AdminPermission) {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) || false
}

export function describeAdminRole(role: string | null | undefined) {
  if (!role) return 'No admin access'
  return ADMIN_ROLE_LABELS[role as AdminRole] || role
}
