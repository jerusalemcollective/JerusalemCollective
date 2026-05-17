'use server'

import { revalidatePath } from 'next/cache'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'

export async function updateHostPaymentPreferences(formData: FormData) {
  const acceptsDirect = formData.get('acceptsDirect') === 'on'
  const instructions = String(formData.get('instructions') || '')
  const preferredCurrency = String(formData.get('preferredCurrency') || '')

  const { supabase } = await requireHostDashboardAccess()
  const { error } = await supabase.rpc('update_host_payment_preferences', {
    accepts_direct: acceptsDirect,
    instructions,
    currency_code: preferredCurrency,
  })

  if (error) {
    throw error
  }

  revalidatePath('/host/dashboard/payments')
}
