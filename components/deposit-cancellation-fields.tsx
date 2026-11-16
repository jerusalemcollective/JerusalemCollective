'use client'

import { useState } from 'react'
import {
  CANCELLATION_FREE_DAY_CHOICES,
  DEFAULT_CANCELLATION_FREE_DAYS,
  DEFAULT_CANCELLATION_KEEP,
  STAY_TERMS_FIELDS,
  cancellationRuleSentence,
  daysText,
  isCancellationKeep,
  parseFreeDays,
  presetAsRule,
  type StayTerms,
} from '@/lib/stay-terms'

// One section for "how much the guest pays, when, and what happens if they
// cancel": the deposit schedule and the free-cancellation rule depend on each
// other, so hosts set them together. Used by the host listing editor (inside
// its form, uncontrolled), the become-a-host wizard (controlled) and the admin
// listing editor (showDeposit={false}: admins don't edit the host's deposit).
//
// Field names: depositType, depositValue, depositDueDays, balanceDueDays (read by
// saveHostListing) and the STAY_TERMS_FIELDS cancellation names (read by
// readStayTermsFromForm, which only reads them when StayTermsFields' marker is
// in the same form).

export type DepositCancellationDraft = {
  deposit_type: string // 'percent' | 'fixed'
  deposit_value: string
  deposit_due_days: string // '' = when the booking is confirmed
  balance_due_days: string // '0' = on the check-in day
  cancellation_free_days: string // '0' = no free cancellation
  cancellation_keep: string // 'deposit' | 'all'
  cancellation_policy_notes: string
}

export const DEFAULT_DEPOSIT_CANCELLATION: DepositCancellationDraft = {
  deposit_type: 'percent',
  deposit_value: '30',
  deposit_due_days: '',
  balance_due_days: '7',
  cancellation_free_days: String(DEFAULT_CANCELLATION_FREE_DAYS),
  cancellation_keep: DEFAULT_CANCELLATION_KEEP,
  cancellation_policy_notes: '',
}

// Starting values for the editors from a listing row and its stay terms. A
// listing still on an older preset shows that preset as the equivalent rule.
export function depositCancellationDraftFrom(
  listing: {
    deposit_type?: string | null
    deposit_value?: number | string | null
    deposit_due_days_before_checkin?: number | null
    balance_due_days_before_checkin?: number | null
  } | null,
  terms: Partial<StayTerms> | null,
): DepositCancellationDraft {
  const legacy = presetAsRule(terms?.cancellation_policy)
  const freeDays = terms?.cancellation_free_days ?? legacy?.freeDays ?? DEFAULT_CANCELLATION_FREE_DAYS
  const keep = terms?.cancellation_keep ?? legacy?.keep ?? DEFAULT_CANCELLATION_KEEP
  return {
    deposit_type: listing?.deposit_type === 'fixed' ? 'fixed' : 'percent',
    deposit_value: listing?.deposit_value == null ? DEFAULT_DEPOSIT_CANCELLATION.deposit_value : String(listing.deposit_value),
    deposit_due_days:
      listing?.deposit_due_days_before_checkin == null ? '' : String(listing.deposit_due_days_before_checkin),
    balance_due_days:
      listing?.balance_due_days_before_checkin == null
        ? DEFAULT_DEPOSIT_CANCELLATION.balance_due_days
        : String(listing.balance_due_days_before_checkin),
    cancellation_free_days: String(freeDays),
    cancellation_keep: keep,
    cancellation_policy_notes: terms?.cancellation_policy_notes || '',
  }
}

const DEPOSIT_DUE_CHOICES = ['', '1', '3', '7', '14', '30', '60']
const BALANCE_DUE_CHOICES = ['0', '1', '3', '7', '14', '30', '60']

// Adds the current value to a list of choices if a host saved something else.
function withCurrent(choices: readonly string[], current: string) {
  return choices.includes(current) ? choices : [...choices, current].sort((a, b) => Number(a) - Number(b))
}

function depositText(draft: DepositCancellationDraft, currency: string) {
  const value = Number(draft.deposit_value)
  if (!Number.isFinite(value) || value <= 0) return null
  return draft.deposit_type === 'fixed' ? `a ${formatAmount(value, currency)} deposit` : `a ${value}% deposit`
}

function formatAmount(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${value} ${currency}`
  }
}

// Plain-words summary of the whole section, as guests will read it.
export function depositCancellationSummary(
  draft: DepositCancellationDraft,
  options: { currency: string; showDeposit: boolean },
): string[] {
  const lines: string[] = []
  if (options.showDeposit) {
    const deposit = depositText(draft, options.currency)
    const depositWhen = draft.deposit_due_days === ''
      ? 'when the booking is confirmed'
      : `${daysText(Number(draft.deposit_due_days))} before check-in`
    const balanceDays = Number(draft.balance_due_days)
    const balanceWhen = !balanceDays ? 'on the check-in day' : `${daysText(balanceDays)} before check-in`
    if (deposit) lines.push(`Guests pay ${deposit} ${depositWhen}, and the rest ${balanceWhen}.`)
  }
  const rule = cancellationRuleSentence(
    parseFreeDays(draft.cancellation_free_days),
    isCancellationKeep(draft.cancellation_keep) ? draft.cancellation_keep : DEFAULT_CANCELLATION_KEEP,
  )
  if (rule) lines.push(rule)
  const notes = draft.cancellation_policy_notes.trim()
  if (notes) lines.push(notes)
  return lines
}

type Props = {
  // Uncontrolled (inside a <form>): initial values.
  initial?: DepositCancellationDraft
  // Controlled (wizard): pass both.
  value?: DepositCancellationDraft
  onChange?: (next: DepositCancellationDraft) => void
  // Currency the fixed deposit is in (the host's currency).
  currency: string
  showDeposit?: boolean
  // "you keep" for hosts, "the host keeps" for admins.
  audience?: 'host' | 'admin'
  // False when the cancellation columns don't exist yet: the cancellation part
  // is hidden so saving leaves those columns alone.
  cancellationAvailable?: boolean
  className?: string
}

const selectClass =
  'h-11 rounded-xl border border-stone-200 bg-[#F8F5F2] px-3 text-sm font-semibold text-stone-900 outline-none transition focus:border-[#c76f55]'
const inputClass =
  'mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#c76f55]'

export function DepositCancellationFields({
  initial,
  value,
  onChange,
  currency,
  showDeposit = true,
  audience = 'host',
  cancellationAvailable = true,
  className = 'mt-6 border-t border-stone-100 pt-6',
}: Props) {
  const controlled = Boolean(value && onChange)
  const [internal, setInternal] = useState<DepositCancellationDraft>(initial ?? DEFAULT_DEPOSIT_CANCELLATION)
  const draft = controlled ? (value as DepositCancellationDraft) : internal
  const [showNotes, setShowNotes] = useState(Boolean(draft.cancellation_policy_notes.trim()))

  function set<K extends keyof DepositCancellationDraft>(field: K, next: DepositCancellationDraft[K]) {
    const updated = { ...draft, [field]: next }
    if (controlled) onChange?.(updated)
    else setInternal(updated)
  }

  const keepYou = audience === 'admin' ? 'the host keeps' : 'you keep'
  const freeDays = draft.cancellation_free_days
  const summary = depositCancellationSummary(draft, { currency, showDeposit })

  return (
    <div className={className}>
      <h3 className="text-sm font-bold text-stone-950">{showDeposit ? 'Deposit and cancellation' : 'Cancellation'}</h3>
      <p className="mt-1 text-sm leading-6 text-stone-600">
        {showDeposit
          ? 'How much guests pay to book, when the rest is due, and what happens if they cancel.'
          : 'What happens if a guest cancels.'}
      </p>

      {showDeposit && (
        <div className="mt-4 space-y-4">
          <div>
            <span className="text-sm font-semibold text-stone-800">Deposit</span>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-stone-200 bg-[#F8F5F2] p-1" role="group" aria-label="Deposit type">
                {[
                  { v: 'percent', label: '% of the stay' },
                  { v: 'fixed', label: `Fixed amount (${currency})` },
                ].map((option) => (
                  <button
                    key={option.v}
                    type="button"
                    aria-pressed={draft.deposit_type === option.v}
                    onClick={() => set('deposit_type', option.v)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      draft.deposit_type === option.v ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <input type="hidden" name="depositType" value={draft.deposit_type} />
              <label className="flex items-center overflow-hidden rounded-xl border border-stone-200 bg-white focus-within:border-[#c76f55]">
                <span className="sr-only">{draft.deposit_type === 'percent' ? 'Deposit percent' : 'Deposit amount'}</span>
                <input
                  name="depositValue"
                  type="number"
                  min="1"
                  max={draft.deposit_type === 'percent' ? '100' : undefined}
                  step={draft.deposit_type === 'percent' ? '1' : '0.01'}
                  value={draft.deposit_value}
                  onChange={(event) => set('deposit_value', event.target.value)}
                  className="h-11 w-24 bg-transparent px-3 text-sm font-semibold text-stone-900 outline-none"
                />
                <span className="flex h-11 items-center border-l border-stone-200 bg-[#F8F5F2] px-3 text-sm font-semibold text-stone-500">
                  {draft.deposit_type === 'percent' ? '%' : currency}
                </span>
              </label>
            </div>
          </div>

          <SentenceRow label="The deposit is paid" htmlFor="deposit-due-days">
            <select
              id="deposit-due-days"
              name="depositDueDays"
              value={draft.deposit_due_days}
              onChange={(event) => set('deposit_due_days', event.target.value)}
              className={selectClass}
            >
              {withCurrent(DEPOSIT_DUE_CHOICES, draft.deposit_due_days).map((days) => (
                <option key={days || 'confirm'} value={days}>
                  {days === '' ? 'when the booking is confirmed' : `${daysText(Number(days))} before check-in`}
                </option>
              ))}
            </select>
          </SentenceRow>

          <SentenceRow label="The rest is paid" htmlFor="balance-due-days">
            <select
              id="balance-due-days"
              name="balanceDueDays"
              value={draft.balance_due_days}
              onChange={(event) => set('balance_due_days', event.target.value)}
              className={selectClass}
            >
              {withCurrent(BALANCE_DUE_CHOICES, draft.balance_due_days).map((days) => (
                <option key={days} value={days}>
                  {days === '0' ? 'on the check-in day' : `${daysText(Number(days))} before check-in`}
                </option>
              ))}
            </select>
          </SentenceRow>
        </div>
      )}

      {cancellationAvailable && (
        <div className="mt-4 space-y-4">
          <SentenceRow label="Free cancellation" htmlFor="cancellation-free-days">
            <select
              id="cancellation-free-days"
              name={STAY_TERMS_FIELDS.freeDays}
              value={freeDays}
              onChange={(event) => set('cancellation_free_days', event.target.value)}
              className={selectClass}
            >
              {withCurrent(CANCELLATION_FREE_DAY_CHOICES.map(String), freeDays).map((days) => (
                <option key={days} value={days}>
                  {days === '0' ? 'never' : `until ${daysText(Number(days))} before check-in`}
                </option>
              ))}
            </select>
            <span className="text-sm text-stone-700">{freeDays === '0' ? `and ${keepYou}` : `then ${keepYou}`}</span>
            <select
              aria-label="What is kept after a late cancellation"
              name={STAY_TERMS_FIELDS.keep}
              value={draft.cancellation_keep}
              onChange={(event) => set('cancellation_keep', event.target.value)}
              className={selectClass}
            >
              <option value="deposit">the deposit</option>
              <option value="all">everything paid so far</option>
            </select>
          </SentenceRow>

          {showNotes ? (
            <label className="block">
              <span className="text-sm font-semibold text-stone-800">Note for guests (optional)</span>
              <textarea
                name={STAY_TERMS_FIELDS.notes}
                rows={3}
                maxLength={2000}
                value={draft.cancellation_policy_notes}
                onChange={(event) => set('cancellation_policy_notes', event.target.value)}
                placeholder="e.g. Date changes are free if requested at least 14 days before arrival."
                dir="auto"
                className={`${inputClass} resize-y`}
              />
            </label>
          ) : (
            <>
              <input type="hidden" name={STAY_TERMS_FIELDS.notes} value={draft.cancellation_policy_notes} />
              <button
                type="button"
                onClick={() => setShowNotes(true)}
                className="text-sm font-semibold text-[#c76f55] hover:underline"
              >
                + Add a note for guests
              </button>
            </>
          )}
        </div>
      )}

      {summary.length > 0 && (
        <div className="mt-5 rounded-2xl bg-[#F8F5F2] p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">What guests see</p>
          <div className="mt-2 space-y-1 text-sm leading-6 text-stone-800">
            {summary.map((line) => (
              <p key={line} dir="auto">{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SentenceRow({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-stone-800">
        {label}
      </label>
      {children}
    </div>
  )
}
