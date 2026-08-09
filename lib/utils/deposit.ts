// Client-side preview of the deposit / balance split shown BEFORE checkout, so a
// guest sees "pay X now, Y later" on the listing page instead of being surprised
// at Stripe.
//
// This is a deliberate re-derivation of the server RPC create_pending_booking_payment
// (supabase/migrations/092_deposit_commission_floor_and_due_clamp.sql:101-133). The
// split math lives only in SQL and can't be imported, so it is mirrored here in ONE
// place and locked down by deposit.test.mjs — if the two ever diverge, a guest is
// quoted a price they are not charged.
//
// Intentionally OMITTED: the server also floors the deposit up to the platform
// commission (greatest(deposit, 0.50, commission_amount), 092:124). Platform
// commission is 0 today and is not plumbed to the client. Before commission is ever
// enabled, plumb commission_amount in and add it to the clamp below, or the preview
// will under-state the deposit.

export type DepositPreviewInput = {
  bookingTotal: number
  depositType: string
  depositValue: number
  balanceDueDaysBeforeCheckin: number
  checkIn: Date
  today?: Date
}

export type DepositPreview = {
  depositAmount: number
  balanceAmount: number
  balanceDueDate: Date
  balanceStatus: 'due' | 'none'
}

// round(x, 2) — matches Postgres round(numeric, 2) (round half up) for the positive
// amounts we deal with. Prices are whole/2-dp and nights are integers, so totals are
// exact; this only absorbs sub-cent float noise on percentage splits.
const round2 = (value: number) => Math.round(value * 100) / 100

// Local-midnight copy of a date, so date-only comparisons never shift a day for a
// UTC+ guest (same reason lib/utils/date.ts formats with local components, not UTC).
function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function computeDepositPreview(input: DepositPreviewInput): DepositPreview {
  const total = round2(input.bookingTotal)

  // Host-set deposit: a fixed amount in the booking currency, or a percent of the
  // total (092:116-120). The listings columns are NOT NULL with defaults, so the
  // server's per-branch coalesce (fixed -> 0, percent -> 10) is inert here; the
  // value is always present.
  const rawDeposit =
    input.depositType === 'fixed'
      ? round2(input.depositValue)
      : round2(total * (input.depositValue / 100))

  // At least Stripe's ~0.50 floor, never more than the whole booking (092:124).
  const depositAmount = Math.min(Math.max(rawDeposit, 0.5), total)
  const balanceAmount = Math.max(round2(total - depositAmount), 0)

  // Balance due date, never in the past — clamped to today (092:132).
  const due = new Date(input.checkIn)
  due.setDate(due.getDate() - (input.balanceDueDaysBeforeCheckin || 0))
  const dueMidnight = localMidnight(due)
  const todayMidnight = localMidnight(input.today ?? new Date())
  const balanceDueDate =
    dueMidnight.getTime() >= todayMidnight.getTime() ? dueMidnight : todayMidnight

  return {
    depositAmount,
    balanceAmount,
    balanceDueDate,
    balanceStatus: balanceAmount > 0 ? 'due' : 'none',
  }
}
