'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireHostDashboardAccess } from '@/lib/host-dashboard'
import { getPaymentRouteSettings } from '@/lib/platform-settings'

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

export async function updateHostPaymentPreferences(formData: FormData) {
  const paymentRoutes = await getPaymentRouteSettings()
  const acceptsDirect = paymentRoutes.directPaymentsEnabled && formData.get('acceptsDirect') === 'on'
  const acceptsJlm = paymentRoutes.jlmPaymentsEnabled && formData.get('acceptsJlm') === 'on'
  const preferredCurrency = String(formData.get('preferredCurrency') || '')
  const payoutCurrencies = formData.getAll('payoutCurrencies').map(String)
  const payoutMethod = String(formData.get('payoutMethod') || '')
  const payout = composePayout(formData)

  const { supabase, hostIds } = await requireHostDashboardAccess()

  // The deposit/balance schedule now lives per-listing (listings.deposit_* columns),
  // edited in the listing editor. This page no longer edits the legacy host-level
  // schedule, so preserve whatever is stored rather than wiping it on save.
  const { data: existingProfile } = await supabase
    .from('host_payment_profiles')
    .select('direct_payment_instructions')
    .in('host_id', hostIds)
    .limit(1)
    .maybeSingle<{ direct_payment_instructions: string | null }>()
  const instructions = existingProfile?.direct_payment_instructions ?? ''

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
