'use client'

import { useState } from 'react'
import { type PayoutDetails, type PayoutType } from '@/lib/direct-payment'

// The host's payout account (bank / Zelle). Region-adaptive fields; every name=
// attribute is read verbatim by composePayout in the payments action, so keep them
// stable. Used wherever a host needs a "pay me here" account — manual JLM payout
// and/or guest-direct.
const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'

const REGIONS: { value: PayoutType; label: string }[] = [
  { value: 'iban', label: 'International (IBAN)' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'us', label: 'United States' },
  { value: 'zelle', label: 'Zelle' },
]

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-semibold text-stone-800">{children}</span>
}

export function PayoutAccountFields({
  payoutDefault,
  legacyMethod,
}: {
  payoutDefault: PayoutDetails | null
  legacyMethod?: string | null
}) {
  const p = payoutDefault
  const [payoutType, setPayoutType] = useState<PayoutType>(p?.type ?? 'iban')
  const showLegacy = Boolean(legacyMethod) && !payoutDefault

  return (
    <div>
      {showLegacy && (
        <div className="mt-2 rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600 ring-1 ring-stone-200">
          <span className="font-semibold text-stone-700">Your current details:</span> {legacyMethod}
          <p className="mt-1 text-stone-500">Enter your bank details below to replace this.</p>
          <input type="hidden" name="legacyMethod" value={legacyMethod ?? ''} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {REGIONS.map((region) => {
          const active = payoutType === region.value
          return (
            <button
              key={region.value}
              type="button"
              onClick={() => setPayoutType(region.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-[#c76f55] text-white'
                  : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {region.label}
            </button>
          )
        })}
      </div>
      <input type="hidden" name="payoutType" value={payoutType} />

      <label className="mt-4 block">
        <FieldLabel>Account holder name</FieldLabel>
        <input
          name="payoutAccountName"
          defaultValue={p?.accountName ?? ''}
          placeholder="As it appears on the account"
          className={inputClass}
        />
      </label>

      {payoutType === 'iban' && (
        <>
          <label className="mt-4 block">
            <FieldLabel>IBAN</FieldLabel>
            <input name="payoutIban" defaultValue={p?.iban ?? ''} placeholder="IL00 0000 0000 0000 0000 000" className={inputClass} />
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>SWIFT / BIC <span className="font-normal text-stone-500">(if your bank needs it)</span></FieldLabel>
              <input name="payoutSwift" defaultValue={p?.swift ?? ''} placeholder="POALILIT" className={inputClass} />
            </label>
            <label className="block">
              <FieldLabel>Bank name</FieldLabel>
              <input name="payoutBankName" defaultValue={p?.bankName ?? ''} placeholder="Bank Leumi" className={inputClass} />
            </label>
          </div>
          <label className="mt-4 block">
            <FieldLabel>Account holder address</FieldLabel>
            <input name="payoutAccountAddress" defaultValue={p?.accountAddress ?? ''} placeholder="Street, city, country" className={inputClass} />
          </label>
        </>
      )}

      {payoutType === 'uk' && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Sort code</FieldLabel>
            <input
              name="payoutSortCode"
              defaultValue={p?.sortCode ?? ''}
              placeholder="12-34-56"
              inputMode="numeric"
              pattern="\d{2}-?\d{2}-?\d{2}"
              title="6 digits, e.g. 12-34-56"
              className={inputClass}
            />
          </label>
          <label className="block">
            <FieldLabel>Account number</FieldLabel>
            <input
              name="payoutAccountNumber"
              defaultValue={p?.accountNumber ?? ''}
              placeholder="12345678"
              inputMode="numeric"
              pattern="\d{6,8}"
              title="8 digits"
              className={inputClass}
            />
          </label>
        </div>
      )}

      {payoutType === 'us' && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Routing number (ABA)</FieldLabel>
              <input
                name="payoutRoutingNumber"
                defaultValue={p?.routingNumber ?? ''}
                placeholder="021000021"
                inputMode="numeric"
                pattern="\d{9}"
                title="9 digits"
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel>Account number</FieldLabel>
              <input name="payoutAccountNumber" defaultValue={p?.accountNumber ?? ''} placeholder="000123456789" inputMode="numeric" className={inputClass} />
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Account type</FieldLabel>
              <select name="payoutAccountType" defaultValue={p?.accountType ?? 'checking'} className={inputClass}>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </label>
            <label className="block">
              <FieldLabel>Bank name</FieldLabel>
              <input name="payoutBankName" defaultValue={p?.bankName ?? ''} placeholder="Chase" className={inputClass} />
            </label>
          </div>
        </>
      )}

      {payoutType === 'zelle' && (
        <label className="mt-4 block">
          <FieldLabel>Zelle email or US phone</FieldLabel>
          <input
            name="payoutZelle"
            defaultValue={p?.zelle ?? ''}
            placeholder="name@email.com or +1 555 123 4567"
            className={inputClass}
          />
        </label>
      )}
    </div>
  )
}
