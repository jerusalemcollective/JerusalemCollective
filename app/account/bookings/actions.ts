'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function cancelBooking(
  bookingId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!bookingId) {
    return { ok: false, error: 'We couldn’t find that booking. Please refresh the page and try again.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Please sign in again to cancel this booking.' }
  }

  // cancel_guest_booking is SECURITY DEFINER and verifies ownership against
  // auth.uid(), so we don't need elevated access here.
  const { error } = await supabase.rpc('cancel_guest_booking', {
    booking_uuid: bookingId,
  })

  if (error) {
    console.error('cancel_guest_booking failed', error)
    return {
      ok: false,
      error: 'We couldn’t cancel this booking. Please try again, or email info@jlmcollective.co and we’ll help.',
    }
  }

  revalidatePath('/account/bookings')
  return { ok: true }
}
