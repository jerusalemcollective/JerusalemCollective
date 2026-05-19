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
