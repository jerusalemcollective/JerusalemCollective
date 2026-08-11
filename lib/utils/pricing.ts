// Client-side preview of the booking total shown BEFORE checkout, so a guest
// sees the price (including any extra-guest surcharge) on the listing page
// instead of being surprised at Stripe.
//
// This is a deliberate re-derivation of the server RPC create_pending_booking_payment
// (supabase/migrations/105_extra_guest_fee.sql). The nightly/total math lives in SQL
// and can't be imported, so it is mirrored here in ONE place and locked down by
// pricing.test.mjs — if the two ever diverge, a guest is quoted a price they are
// not charged.

// round(x, 2) — matches Postgres round(numeric, 2) for the positive amounts here.
const round2 = (value: number) => Math.round(value * 100) / 100

// extra_guests = max(0, guests - included). A null included_guests (legacy row)
// falls back to max_guests, then to the guest count itself — either way, zero
// extra guests, matching the server's coalesce chain.
export function computeExtraGuests(
  guests: number,
  includedGuests: number | null | undefined,
  maxGuests: number | null | undefined,
): number {
  const included = includedGuests ?? maxGuests ?? guests
  return Math.max(guests - included, 0)
}

export type BookingTotalInput = {
  nightlyPrice: number
  nights: number
  extraGuests: number
  extraGuestFee: number
}

// nightly = price + extra_guests * fee;  total = round(nightly * nights, 2)
export function computeBookingTotal({
  nightlyPrice,
  nights,
  extraGuests,
  extraGuestFee,
}: BookingTotalInput): number {
  const nightly = nightlyPrice + Math.max(extraGuests, 0) * Math.max(extraGuestFee, 0)
  return round2(nightly * Math.max(nights, 0))
}
