'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function cancelBooking(
  bookingId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!bookingId) {
    return { ok: false, error: 'Missing booking.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You need to be signed in.' }
  }

  // cancel_guest_booking is SECURITY DEFINER and verifies ownership against
  // auth.uid(), so we don't need elevated access here.
  const { error } = await supabase.rpc('cancel_guest_booking', {
    booking_uuid: bookingId,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/account/bookings')
  return { ok: true }
}
