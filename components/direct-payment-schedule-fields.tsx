'use client'

import { useState } from 'react'

type Props = {
  defaultValue: string | null | undefined
  currency: string
}

const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'

type Parsed = {
  depositAmount: string
  depositDueMode: 'booking' | 'days'
  depositDueDays: string
  balanceDueDays: string
  method: string
}

const EMPTY: Parsed = {
  depositAmount: '',
  depositDueMode: 'booking',
  depositDueDays: '',
  balanceDueDays: '',
  method: '',
}

// Values are stored as JSON in host_payment_profiles.direct_payment_instructions.
// Anything that doesn't parse as our shape is treated as legacy free text and
// shown in the "How to pay" box so nothing a host already wrote is lost.
function parseInitial(value: string | null | undefined): Parsed {
  if (!value) return EMPTY
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && parsed.v === 1) {
      return {
        depositAmount: parsed.depositAmount != null ? String(parsed.depositAmount) : '',
        depositDueMode: parsed.depositDueDays != null ? 'days' : 'booking',
        depositDueDays: parsed.depositDueDays != null ? String(parsed.depositDueDays) : '',
        balanceDueDays: parsed.balanceDueDays != null ? String(parsed.balanceDueDays) : '',
        method: typeof parsed.method === 'string' ? parsed.method : '',
      }
    }
  } catch {
    // not JSON — fall through to legacy handling
  }
  return { ...EMPTY, method: value }
}

export function DirectPaymentScheduleFields({ defaultValue, currency }: Props) {
  const initial = parseInitial(defaultValue)
  const [depositDueMode, setDepositDueMode] = useState<'booking' | 'days'>(initial.depositDueMode)

  return (
    <div>
      <p className="text-sm font-semibold text-stone-800">Direct payment schedule</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-stone-800">Deposit amount ({currency})</span>
          <input
            name="depositAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={initial.depositAmount}
            placeholder="500"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-stone-800">Deposit due</span>
          <select
            name="depositDueMode"
            value={depositDueMode}
            onChange={(event) => setDepositDueMode(event.target.value === 'days' ? 'days' : 'booking')}
            className={inputClass}
          >
            <option value="booking">When the booking is confirmed</option>
            <option value="days">A set number of days before arrival</option>
          </select>
        </label>
      </div>

      {depositDueMode === 'days' && (
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-stone-800">Deposit due before arrival (days)</span>
          <input
            name="depositDueDays"
            type="number"
            min="0"
            max="365"
            step="1"
            defaultValue={initial.depositDueDays}
            placeholder="60"
            className={inputClass}
          />
        </label>
      )}

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-stone-800">Rest of payment due before arrival (days)</span>
        <input
          name="balanceDueDays"
          type="number"
          min="0"
          max="365"
          step="1"
          defaultValue={initial.balanceDueDays}
          placeholder="30"
          className={inputClass}
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-stone-800">How to pay you ({currency})</span>
        <textarea
          name="payMethod"
          rows={4}
          defaultValue={initial.method}
          placeholder="e.g. Bank transfer to Bank Leumi, acct 12345 (IBAN …); or Bit to 05x-xxx-xxxx; or PayPal name@email.com"
          className={`${inputClass} resize-y`}
        />
      </label>
    </div>
  )
}
