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
}

const EMPTY: Parsed = {
  depositAmount: '',
  depositDueMode: 'booking',
  depositDueDays: '',
  balanceDueDays: '',
}

// The deposit schedule (only) is stored as JSON in
// host_payment_profiles.direct_payment_instructions. The payout account no longer
// lives here — it moved to its own column (see PayoutAccountFields + migration 106).
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
      }
    }
  } catch {
    // not JSON — legacy free text carried no schedule
  }
  return EMPTY
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-semibold text-stone-800">{children}</span>
}

export function DirectPaymentScheduleFields({ defaultValue, currency }: Props) {
  const initial = parseInitial(defaultValue)
  const [depositDueMode, setDepositDueMode] = useState<'booking' | 'days'>(initial.depositDueMode)

  return (
    <div>
      <p className="text-sm font-semibold text-stone-800">Deposit schedule</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>Deposit amount ({currency})</FieldLabel>
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
          <FieldLabel>Deposit due</FieldLabel>
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
          <FieldLabel>Deposit due before arrival (days)</FieldLabel>
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
        <FieldLabel>Rest of payment due before arrival (days)</FieldLabel>
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
    </div>
  )
}
