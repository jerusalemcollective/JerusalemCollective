import type { SupabaseClient } from '@supabase/supabase-js'

export async function logAdminAction(
  supabase: SupabaseClient,
  action: string,
  targetType: string,
  targetId: string,
  detail?: string,
) {
  const { error } = await supabase.from('admin_audit_log').insert({
    action,
    target_type: targetType,
    target_id: targetId,
    detail: detail || null,
  })

  if (error) {
    console.error('Unable to write admin audit log entry', error)
  }
}

// ---------------------------------------------------------------------------
// Plain-English labels for the audit log page.
// Every action string passed to logAdminAction() should appear here. Keys are
// `${targetType}:${action}` because some actions (set_status_*) are shared.
// ---------------------------------------------------------------------------

export const AUDIT_TARGET_TYPE_LABELS: Record<string, string> = {
  listing: 'Listings',
  application: 'Applications',
  host: 'Hosts',
  case: 'Disputes & refunds',
  review: 'Reviews',
  user: 'Admin access',
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Listings
  'listing:create_listing': 'Created listing',
  'listing:edit_listing_details': 'Edited listing details',
  'listing:set_is_published_true': 'Showed listing on site',
  'listing:set_is_published_false': 'Hid listing from site',
  'listing:set_is_featured_true': 'Featured listing',
  'listing:set_is_featured_false': 'Removed listing from featured',
  'listing:set_listing_admin_status_needs_work': 'Marked listing as needing work',
  'listing:set_listing_admin_status_ready_for_launch': 'Marked listing as ready to launch',
  'listing:set_listing_admin_status_live': 'Made listing live',
  'listing:archive_listing': 'Archived listing',
  'listing:restore_listing': 'Restored listing',
  'listing:delete_listing': 'Deleted listing',
  // Host applications
  'application:approve_application': 'Approved application',
  'application:request_changes': 'Asked host for changes',
  'application:edit_application_details': 'Edited application',
  'application:set_status_in_review': 'Marked application as in review',
  'application:set_status_rejected': 'Rejected application',
  'application:verify_id': 'Marked ID as verified',
  'application:unverify_id': 'Marked ID as not verified',
  // Hosts
  'host:set_verified_true': 'Verified host',
  'host:set_verified_false': 'Removed host verification',
  'host:block_host_from_listing': 'Blocked host from listing',
  'host:unblock_host_from_listing': 'Allowed host to list again',
  'host:set_host_commission_override': 'Set custom commission for host',
  'host:clear_host_commission_override': 'Removed custom commission for host',
  // Disputes & refunds
  'case:set_status_open': 'Reopened dispute',
  'case:set_status_under_review': 'Marked dispute as under review',
  'case:set_status_waiting_on_guest': 'Marked dispute as waiting on guest',
  'case:set_status_waiting_on_host': 'Marked dispute as waiting on host',
  'case:set_status_resolved': 'Resolved dispute',
  'case:set_status_closed': 'Closed dispute',
  // Reviews
  'review:set_approved_true': 'Approved review',
  'review:set_approved_false': 'Hid review',
  // Admin access
  'user:grant_admin_role': 'Changed admin access',
}

export function auditActionKey(targetType: string, action: string) {
  return `${targetType}:${action}`
}

export function describeAuditAction(targetType: string, action: string) {
  const label = AUDIT_ACTION_LABELS[auditActionKey(targetType, action)]
  if (label) return label
  // Unknown action: make the raw string readable rather than hiding it.
  const words = action.replaceAll('_', ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Unknown action'
}
