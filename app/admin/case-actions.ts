'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminPermission } from '@/lib/admin'
import { logAdminAction } from '@/lib/audit'

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
    !['open', 'under_review', 'waiting_on_guest', 'waiting_on_host', 'resolved', 'closed'].includes(status)
  ) {
    return {
      status: 'error',
      message: 'Please choose a valid case status.',
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
        resolved_at: ['resolved', 'closed'].includes(status) ? new Date().toISOString() : null,
      })
      .eq('id', caseId)

    if (error) throw error

    await logAdminAction(supabase, `set_status_${status}`, 'case', caseId)

    revalidatePath('/admin')
    revalidatePath('/admin/cases')

    return {
      status: 'success',
      message: 'Case updated.',
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to update the case.',
    }
  }
}
