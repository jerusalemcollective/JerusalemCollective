'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { getPaymentRouteSettings } from '@/lib/platform-settings'

function toBoundedInt(value: FormDataEntryValue | null, min: number, max: number): number | null {
  if (value == null || String(value).trim() === '') return null
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

function toAmount(value: FormDataEntryValue | null): number | null {
  if (value == null || String(value).trim() === '') return null
  const n = Math.round(Number(value) * 100) / 100
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null
  return n
}

// The direct-payment schedule is entered as structured fields and stored as JSON
// in host_payment_profiles.direct_payment_instructions (a text column). Returns
// an empty string when nothing meaningful was filled, so the existing DB check
// still requires content when a host accepts direct payment.
function composeDirectPaymentInstructions(formData: FormData): string {
  const depositAmount = toAmount(formData.get('depositAmount'))
  const depositCurrency = String(formData.get('preferredCurrency') || '') || null
  const depositDueMode = String(formData.get('depositDueMode') || 'booking')
  const depositDueDays = depositDueMode === 'days' ? toBoundedInt(formData.get('depositDueDays'), 0, 365) : null
  const balanceDueDays = toBoundedInt(formData.get('balanceDueDays'), 0, 365)
  const method = String(formData.get('payMethod') || '').trim()

  const hasContent = depositAmount != null || balanceDueDays != null || method !== ''
  if (!hasContent) return ''

  return JSON.stringify({
    v: 1,
    depositAmount,
    depositCurrency,
    depositDueDays,
    balanceDueDays,
    method,
  })
}

export async function updateHostPaymentPreferences(formData: FormData) {
  const paymentRoutes = await getPaymentRouteSettings()
  const acceptsDirect = paymentRoutes.directPaymentsEnabled && formData.get('acceptsDirect') === 'on'
  const acceptsJlm = paymentRoutes.jlmPaymentsEnabled && formData.get('acceptsJlm') === 'on'
  const instructions = composeDirectPaymentInstructions(formData)
  const preferredCurrency = String(formData.get('preferredCurrency') || '')
  const payoutCurrencies = formData.getAll('payoutCurrencies').map(String)

  const { supabase } = await requireHostDashboardAccess()
  const { error } = await supabase.rpc('update_host_payment_preferences', {
    accepts_direct: acceptsDirect,
    instructions,
    currency_code: preferredCurrency,
    accepts_jlm: acceptsJlm,
    supported_currencies: payoutCurrencies,
  })

  revalidatePath('/host/dashboard/payments')

  if (error) {
    redirect('/host/dashboard/payments?saved=error')
  }

  redirect('/host/dashboard/payments?saved=1')
}

export async function updateBookingPayment(
  _prev: { status: string; message: string },
  formData: FormData,
): Promise<{ status: string; message: string }> {
  const bookingId = String(formData.get('bookingId') || '')
  const paymentStatus = String(formData.get('paymentStatus') || '')
  const paymentNotes = String(formData.get('paymentNotes') || '').trim()

  const validStatuses = [
    'unpaid',
    'deposit_received',
    'paid_in_full',
    'refunded',
  ]

  if (!bookingId || !validStatuses.includes(paymentStatus)) {
    return {
      status: 'error',
      message: 'Invalid payment update.',
    }
  }

  try {
    const { supabase, hostIds } = await requireHostDashboardAccess()

    const { error } = await supabase
      .from('bookings')
      .update({
        payment_status: paymentStatus,
        payment_notes: paymentNotes || null,
        payment_updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .in('host_id', hostIds)

    if (error) throw error

    revalidatePath('/host/dashboard/payments')

    return {
      status: 'success',
      message: 'Payment status updated.',
    }
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Could not update payment status.',
    }
  }
}
