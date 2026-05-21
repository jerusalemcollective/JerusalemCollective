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
