'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin'

export type UpdateCommissionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export async function updateCommissionSetting(
  _previousState: UpdateCommissionState,
  formData: FormData,
): Promise<UpdateCommissionState> {
  const { supabase, adminRole } = await requireAdmin()

  if (adminRole !== 'owner') {
    return {
      status: 'error',
      message: 'Only owner admins can update platform settings.',
    }
  }

  const rawValue = String(formData.get('commissionPercent') || '').trim()
  const commissionPercent = Number(rawValue)

  if (!Number.isFinite(commissionPercent) || commissionPercent < 0) {
    return {
      status: 'error',
      message: 'Commission must be 0 or higher.',
    }
  }

  const normalizedValue = String(commissionPercent)
  const { error } = await supabase
    .from('platform_settings')
    .update({
      value: normalizedValue,
      updated_at: new Date().toISOString(),
    })
    .eq('key', 'commission_percent')

  if (error) {
    return {
      status: 'error',
      message: error.message,
    }
  }

  revalidatePath('/admin/settings')

  return {
    status: 'success',
    message: `Commission updated to ${normalizedValue}%. New bookings will use this rate.`,
  }
}

export async function updateServicesVisibilitySetting(formData: FormData) {
  const { supabase, adminRole } = await requireAdmin()

  if (adminRole !== 'owner') {
    return
  }

  const enabled = formData.get('servicesBarEnabled') === 'on'
  await supabase
    .from('platform_settings')
    .update({
      value: enabled ? 'true' : 'false',
      updated_at: new Date().toISOString(),
    })
    .eq('key', 'services_bar_enabled')

  revalidatePath('/admin/settings')
  revalidatePath('/', 'layout')
  revalidatePath('/services')
}

export async function updatePaymentRouteSettings(formData: FormData) {
  const { supabase, adminRole } = await requireAdmin()

  if (adminRole !== 'owner') {
    return
  }

  const jlmPaymentsEnabled = formData.get('jlmPaymentsEnabled') === 'on'
  const directPaymentsEnabled = formData.get('directPaymentsEnabled') === 'on'
  const updatedAt = new Date().toISOString()

  const updates = [
    {
      key: 'jlm_payments_enabled',
      value: jlmPaymentsEnabled ? 'true' : 'false',
      description:
        'Controls whether hosts can enable JLM-collected online payments and whether guests can use Book now.',
      updated_at: updatedAt,
    },
    {
      key: 'direct_payments_enabled',
      value: directPaymentsEnabled ? 'true' : 'false',
      description:
        'Controls whether hosts can offer direct-to-host payment instructions.',
      updated_at: updatedAt,
    },
  ]

  // The result was previously discarded entirely, so an RLS rejection was
  // thrown away and the UI revalidated as if the toggle had saved.
  const { error } = await supabase
    .from('platform_settings')
    .upsert(updates, { onConflict: 'key' })

  if (error) {
    throw error
  }

  revalidatePath('/admin/settings')
  revalidatePath('/admin/readiness')
  revalidatePath('/admin/payments')
  revalidatePath('/host/dashboard/payments')
  revalidatePath('/', 'layout')
}
