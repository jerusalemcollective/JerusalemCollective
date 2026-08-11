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

// Reads the structured payout (bank) fields for the chosen region. Returns null if
// the host filled nothing, so a host who hasn't entered bank details yet doesn't get
// an empty payout object. Server-side we store what's given (no hard rejection); the
// form nudges format client-side.
function composePayout(formData: FormData) {
  const type = String(formData.get('payoutType') || '')
  if (type !== 'iban' && type !== 'uk' && type !== 'us' && type !== 'zelle') return null
  const s = (key: string) => String(formData.get(key) || '').trim()
  const accountName = s('payoutAccountName')

  if (type === 'iban') {
    const iban = s('payoutIban')
    if (!accountName && !iban) return null
    return {
      type,
      accountName,
      iban,
      swift: s('payoutSwift'),
      bankName: s('payoutBankName'),
      accountAddress: s('payoutAccountAddress'),
    }
  }
  if (type === 'uk') {
    const sortCode = s('payoutSortCode')
    const accountNumber = s('payoutAccountNumber')
    if (!accountName && !sortCode && !accountNumber) return null
    return { type, accountName, sortCode, accountNumber }
  }
  if (type === 'zelle') {
    const zelle = s('payoutZelle')
    if (!accountName && !zelle) return null
    return { type, accountName, zelle }
  }
  // us
  const routingNumber = s('payoutRoutingNumber')
  const accountNumber = s('payoutAccountNumber')
  if (!accountName && !routingNumber && !accountNumber) return null
  return {
    type,
    accountName,
    routingNumber,
    accountNumber,
    accountType: formData.get('payoutAccountType') === 'savings' ? 'savings' : 'checking',
    bankName: s('payoutBankName'),
  }
}

// The direct-payment DEPOSIT SCHEDULE is stored as JSON in
// host_payment_profiles.direct_payment_instructions (a text column). The payout
// account no longer lives here — it goes to the payout_details column (see
// composePayout + migration 106). Returns an empty string when no schedule was set.
function composeDirectPaymentInstructions(formData: FormData): string {
  const depositAmount = toAmount(formData.get('depositAmount'))
  const depositCurrency = String(formData.get('preferredCurrency') || '') || null
  const depositDueMode = String(formData.get('depositDueMode') || 'booking')
  const depositDueDays = depositDueMode === 'days' ? toBoundedInt(formData.get('depositDueDays'), 0, 365) : null
  const balanceDueDays = toBoundedInt(formData.get('balanceDueDays'), 0, 365)

  const hasContent = depositAmount != null || balanceDueDays != null
  if (!hasContent) return ''

  return JSON.stringify({
    v: 1,
    depositAmount,
    depositCurrency,
    depositDueDays,
    balanceDueDays,
  })
}

export async function updateHostPaymentPreferences(formData: FormData) {
  const paymentRoutes = await getPaymentRouteSettings()
  const acceptsDirect = paymentRoutes.directPaymentsEnabled && formData.get('acceptsDirect') === 'on'
  const acceptsJlm = paymentRoutes.jlmPaymentsEnabled && formData.get('acceptsJlm') === 'on'
  const instructions = composeDirectPaymentInstructions(formData)
  const preferredCurrency = String(formData.get('preferredCurrency') || '')
  const payoutCurrencies = formData.getAll('payoutCurrencies').map(String)
  const payoutMethod = String(formData.get('payoutMethod') || '')
  const payout = composePayout(formData)

  const { supabase } = await requireHostDashboardAccess()
  const { error } = await supabase.rpc('update_host_payment_preferences', {
    accepts_direct: acceptsDirect,
    instructions,
    currency_code: preferredCurrency,
    accepts_jlm: acceptsJlm,
    supported_currencies: payoutCurrencies,
    payout_method_in: payoutMethod,
    payout_details_in: payout,
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
