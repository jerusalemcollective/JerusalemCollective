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
