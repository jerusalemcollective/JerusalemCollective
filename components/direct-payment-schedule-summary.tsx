import { formatDateDisplay } from '@/lib/utils/date'
import { formatPayoutRows, type PayoutDetails } from '@/lib/direct-payment'
import { computeDepositPreview } from '@/lib/utils/deposit'
import { PayoutCopyRows } from '@/components/payout-copy-rows'

type Props = {
  // Per-listing schedule (same source JLM bookings use).
  depositType: string | null
  depositValue: number | null
  balanceDueDays: number | null
  depositDueDays: number | null
  nightlyUsd: number | null
  nightlyIls: number | null
  checkIn: string | null
  checkOut: string | null
  // Host-level payout account (from host_payment_profiles.payout_details).
  payout?: PayoutDetails | null
}

function money(currency: string, amount: number): string {
  const symbol = currency === 'USD' ? '$' : currency === 'ILS' ? '₪' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : ''
  const formatted = amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`
}

function minusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

// YYYY-MM-DD from a Date's LOCAL components (computeDepositPreview returns
// local-midnight dates; toISOString would shift a day for UTC+ timezones).
function isoLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function DirectPaymentScheduleSummary({
  depositType,
  depositValue,
  balanceDueDays,
  depositDueDays,
  nightlyUsd,
  nightlyIls,
  checkIn,
  checkOut,
  payout = null,
}: Props) {
  const payoutRows = payout ? formatPayoutRows(payout) : []

  // Deposit/balance from the per-listing schedule, computed the same way as the JLM
  // deposit (computeDepositPreview mirrors create_pending_booking_payment).
  const nightly = nightlyUsd != null ? nightlyUsd : nightlyIls != null ? nightlyIls : null
  const currency = nightlyUsd != null ? 'USD' : 'ILS'
  const nights =
    checkIn && checkOut
      ? Math.round(
          (new Date(`${checkOut}T12:00:00`).getTime() - new Date(`${checkIn}T12:00:00`).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0

  let deposit: number | null = null
  let balance = 0
  let balanceDueLabel: string | null = null
  if (nightly != null && nights > 0 && checkIn && depositValue != null) {
    const preview = computeDepositPreview({
      bookingTotal: nightly * nights,
      depositType: depositType || 'percent',
      depositValue,
      balanceDueDaysBeforeCheckin: balanceDueDays ?? 0,
      checkIn: new Date(`${checkIn}T12:00:00`),
    })
    deposit = preview.depositAmount
    balance = preview.balanceAmount
    balanceDueLabel = formatDateDisplay(isoLocal(preview.balanceDueDate))
  }

  const depositDueLabel =
    depositDueDays != null && checkIn
      ? `due by ${formatDateDisplay(minusDays(checkIn, depositDueDays))}`
      : 'due to secure your booking'

  if (deposit == null && payoutRows.length === 0) return null

  return (
    <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <p className="text-xs font-bold uppercase tracking-wide text-[#c76f55]">Pay the host directly</p>
      <div className="mt-2 space-y-1.5 text-sm text-stone-700">
        {deposit != null && (
          <>
            <div className="flex flex-wrap justify-between gap-x-4">
              <span className="text-stone-500">Deposit</span>
              <span className="font-medium">
                {money(currency, deposit)} — {depositDueLabel}
              </span>
            </div>
            {balance > 0 && (
              <div className="flex flex-wrap justify-between gap-x-4">
                <span className="text-stone-500">Balance</span>
                <span className="font-medium">
                  {money(currency, balance)}
                  {balanceDueLabel ? ` — due by ${balanceDueLabel}` : ''}
                </span>
              </div>
            )}
          </>
        )}
        {payoutRows.length > 0 && (
          <div className={deposit != null ? 'border-t border-stone-100 pt-2' : ''}>
            <span className="text-stone-500">How to pay — tap any detail to copy</span>
            <PayoutCopyRows rows={payoutRows} />
          </div>
        )}
      </div>
    </div>
  )
}
