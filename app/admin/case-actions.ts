'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminPermission } from '@/lib/admin'
import { logAdminAction } from '@/lib/audit'
import { SUPPORT_CASE_STATUSES } from '@/lib/constants'

export type SupportCaseState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export async function updateSupportCase(
  _previousState: SupportCaseState,
  formData: FormData,
): Promise<SupportCaseState> {
  const caseId = String(formData.get('caseId') || '')
  const status = String(formData.get('status') || '')
  const resolutionNotes = String(formData.get('resolutionNotes') || '').trim()
  const approvedRefundAmount = Number(formData.get('approvedRefundAmount') || 0)

  if (
    !caseId ||
    !(SUPPORT_CASE_STATUSES as readonly string[]).includes(status)
  ) {
    return {
      status: 'error',
      message: 'Please choose a valid report status.',
    }
  }

  try {
    const { supabase } = await requireAdminPermission('cases')
    const { error } = await supabase
      .from('support_cases')
      .update({
        status,
        resolution_notes: resolutionNotes || null,
        approved_refund_amount: Number.isFinite(approvedRefundAmount) ? approvedRefundAmount : 0,
        resolved_at: status === 'resolved' || status === 'closed' ? new Date().toISOString() : null,
      })
      .eq('id', caseId)

    if (error) throw error

    await logAdminAction(supabase, `set_status_${status}`, 'case', caseId)

    revalidatePath('/admin')
    revalidatePath('/admin/cases')

    return {
      status: 'success',
      message: 'Report updated.',
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to update the report.',
    }
  }
}
