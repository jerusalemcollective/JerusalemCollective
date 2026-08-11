import { formatDateDisplay } from '@/lib/utils/date'
import { parsePayout, formatPayoutRows, type PayoutDetails } from '@/lib/direct-payment'

type Props = {
  instructions: string | null
  checkIn: string | null
  // Host-level payout account (from host_payment_profiles.payout_details). Wins over
  // any legacy payout nested in the instructions JSON.
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

export function DirectPaymentScheduleSummary({ instructions, checkIn, payout = null }: Props) {
  let schedule:
    | {
        depositAmount: number | null
        depositCurrency: string | null
        depositDueDays: number | null
        balanceDueDays: number | null
        method: string
        payout: PayoutDetails | null
      }
    | null = null

  if (instructions) {
    try {
      const parsed = JSON.parse(instructions)
      if (parsed && typeof parsed === 'object' && parsed.v === 1) {
        schedule = {
          depositAmount: typeof parsed.depositAmount === 'number' ? parsed.depositAmount : null,
          depositCurrency: typeof parsed.depositCurrency === 'string' ? parsed.depositCurrency : null,
          depositDueDays: typeof parsed.depositDueDays === 'number' ? parsed.depositDueDays : null,
          balanceDueDays: typeof parsed.balanceDueDays === 'number' ? parsed.balanceDueDays : null,
          method: typeof parsed.method === 'string' ? parsed.method : '',
          payout: parsePayout(parsed.payout),
        }
      }
    } catch {
      // legacy free-text instructions
    }
  }

  const resolvedPayout = payout ?? schedule?.payout ?? null
  const payoutRows = resolvedPayout ? formatPayoutRows(resolvedPayout) : []

  // Legacy free text with no structured schedule or payout: show it as-is.
  if (!schedule && payoutRows.length === 0) {
    if (!instructions) return null
    return (
      <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <p className="text-xs font-bold uppercase tracking-wide text-[#c76f55]">How to pay the host</p>
        <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{instructions}</p>
      </div>
    )
  }

  const currency = schedule?.depositCurrency || 'USD'
  const depositDue = checkIn && schedule?.depositDueDays != null ? minusDays(checkIn, schedule.depositDueDays) : null
  const balanceDue = checkIn && schedule?.balanceDueDays != null ? minusDays(checkIn, schedule.balanceDueDays) : null
  const dividerClass = schedule != null ? 'border-t border-stone-100 pt-2' : ''

  return (
    <div className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <p className="text-xs font-bold uppercase tracking-wide text-[#c76f55]">Pay the host directly</p>
      <div className="mt-2 space-y-1.5 text-sm text-stone-700">
        {schedule != null && (
          <>
            {schedule.depositAmount != null && (
              <div className="flex flex-wrap justify-between gap-x-4">
                <span className="text-stone-500">Deposit</span>
                <span className="font-medium">
                  {money(currency, schedule.depositAmount)}
                  {depositDue ? ` — due by ${formatDateDisplay(depositDue)}` : ' — due when you book'}
                </span>
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-x-4">
              <span className="text-stone-500">Rest of payment</span>
              <span className="font-medium">
                the remaining balance{balanceDue ? ` — due by ${formatDateDisplay(balanceDue)}` : ''}
              </span>
            </div>
          </>
        )}
        {payoutRows.length > 0 ? (
          <div className={dividerClass}>
            <span className="text-stone-500">How to pay</span>
            <div className="mt-1 space-y-0.5">
              {payoutRows.map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-x-4">
                  <span className="text-stone-500">{label}</span>
                  <span className="font-medium text-stone-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          schedule?.method && (
            <div className={dividerClass}>
              <span className="text-stone-500">How to pay</span>
              <p className="mt-0.5 whitespace-pre-line text-stone-700">{schedule.method}</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
