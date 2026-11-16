// Check-in / check-out times and cancellation policy presets for a listing
// (columns added in supabase/migrations/118_listing_checkin_checkout_cancellation.sql).
// Plain TS with no imports so it runs in the host/admin editors, the listing page
// and `node --test` alike.
//
// NULL means "not set".
//
// Cancellation is set as "free cancellation until N days before check-in, then
// the host keeps the deposit / everything paid" (cancellation_free_days and
// cancellation_keep, migration 123). The older presets (cancellation_policy) are
// still read for listings that haven't been saved since, and migration 123
// copies them into the new columns.

export const CANCELLATION_POLICIES = ['flexible', 'moderate', 'strict', 'non_refundable'] as const

export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number]

export type CancellationPolicyPreset = {
  // Short name, e.g. "Flexible".
  label: string
  // One line for hosts choosing a policy in the editor.
  hostExplanation: string
  // The sentence guests see on the listing page.
  guestSentence: string
  // Short summary for the booking box ("Cancellation: <summary>").
  summary: string
}

export const CANCELLATION_POLICY_PRESETS: Record<CancellationPolicy, CancellationPolicyPreset> = {
  flexible: {
    label: 'Flexible',
    hostExplanation: 'Guests get a full refund if they cancel at least 24 hours before check-in.',
    guestSentence: 'Cancel at least 24 hours before check-in for a full refund.',
    summary: 'full refund up to 24 hours before check-in',
  },
  moderate: {
    label: 'Moderate',
    hostExplanation: 'Guests get a full refund if they cancel at least 5 days before check-in.',
    guestSentence: 'Cancel at least 5 days before check-in for a full refund.',
    summary: 'full refund up to 5 days before check-in',
  },
  strict: {
    label: 'Strict',
    hostExplanation: 'Guests get a 50% refund if they cancel at least 7 days before check-in, and nothing after that.',
    guestSentence: 'Cancel at least 7 days before check-in for a 50% refund. Later cancellations are not refunded.',
    summary: '50% refund up to 7 days before check-in',
  },
  non_refundable: {
    label: 'Non-refundable',
    hostExplanation: 'Guests get no refund if they cancel.',
    guestSentence: 'This booking is non-refundable. There is no refund if you cancel.',
    summary: 'non-refundable',
  },
}

// Editor label for the NULL choice.
export const CANCELLATION_AGREED_LABEL = 'Agreed with me per booking'
export const CANCELLATION_AGREED_HOST_EXPLANATION =
  'No fixed policy: you and the guest agree cancellation terms before they pay.'
// Listing page text when no preset is set.
export const CANCELLATION_AGREED_GUEST_SENTENCE = 'Cancellation terms are agreed with the host before you pay.'

// ---- Free-cancellation rule (migration 123) ----

export const CANCELLATION_KEEP_OPTIONS = ['deposit', 'all'] as const
export type CancellationKeep = (typeof CANCELLATION_KEEP_OPTIONS)[number]

// Choices in the editors. 0 = no free cancellation.
export const CANCELLATION_FREE_DAY_CHOICES = [1, 2, 3, 5, 7, 14, 21, 30, 0] as const
export const DEFAULT_CANCELLATION_FREE_DAYS = 14
export const DEFAULT_CANCELLATION_KEEP: CancellationKeep = 'deposit'

export function isCancellationKeep(value: unknown): value is CancellationKeep {
  return typeof value === 'string' && (CANCELLATION_KEEP_OPTIONS as readonly string[]).includes(value)
}

// Whole days 0-365, or null for blank/invalid.
export function parseFreeDays(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(Math.max(Math.trunc(n), 0), 365)
}

export function daysText(days: number): string {
  return days === 1 ? '1 day' : `${days} days`
}

// The rule as one or two sentences for guests, or null when no rule is set.
// `keep` 'deposit' only makes sense when the listing takes a deposit; pass
// hasDeposit=false to word it as "what you've paid".
export function cancellationRuleSentence(
  freeDays: number | null | undefined,
  keep: CancellationKeep | null | undefined,
  hasDeposit = true,
): string | null {
  if (freeDays == null) return null
  const what = keep === 'deposit' && hasDeposit ? 'the host keeps the deposit' : 'the host keeps what you have paid'
  if (freeDays === 0) return `There is no free cancellation. If you cancel, ${what}.`
  return `Free cancellation until ${daysText(freeDays)} before check-in. After that, ${what}.`
}

// The older preset as an equivalent rule, for listings saved before migration 123.
export function presetAsRule(policy: unknown): { freeDays: number; keep: CancellationKeep } | null {
  switch (policy) {
    case 'flexible':
      return { freeDays: 1, keep: 'all' }
    case 'moderate':
      return { freeDays: 5, keep: 'all' }
    case 'strict':
      return { freeDays: 7, keep: 'all' }
    case 'non_refundable':
      return { freeDays: 0, keep: 'all' }
    default:
      return null
  }
}

// What the listing page shows: the new rule if set, else the older preset's
// sentence, else null (no policy set).
export function guestCancellationText(terms: Partial<StayTerms> | null | undefined): string | null {
  if (!terms) return null
  const rule = cancellationRuleSentence(terms.cancellation_free_days, terms.cancellation_keep)
  if (rule) return rule
  return cancellationPreset(terms.cancellation_policy)?.guestSentence ?? null
}

// Short form for the booking box ("Cancellation: <summary>."), or null.
export function guestCancellationSummary(terms: Partial<StayTerms> | null | undefined): string | null {
  if (!terms) return null
  const days = terms.cancellation_free_days
  if (days != null) return days === 0 ? 'no free cancellation' : `free until ${daysText(days)} before check-in`
  return cancellationPreset(terms.cancellation_policy)?.summary ?? null
}

// Shown under a preset on the listing page.
export const DIRECT_PAYMENT_REFUND_NOTE =
  'If you pay the host directly (for example by bank transfer), any refund is arranged with the host.'

export function isCancellationPolicy(value: unknown): value is CancellationPolicy {
  return typeof value === 'string' && (CANCELLATION_POLICIES as readonly string[]).includes(value)
}

export function cancellationPreset(value: unknown): CancellationPolicyPreset | null {
  return isCancellationPolicy(value) ? CANCELLATION_POLICY_PRESETS[value] : null
}

// "15:00" / "15:00:00" (Postgres time) -> "3:00 pm". Returns null for blank or
// unreadable values so callers can simply skip the part.
export function formatStayTime(value: string | null | undefined): string | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value).trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  const suffix = hours < 12 ? 'am' : 'pm'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

// "15:00:00" -> "15:00", the value an <input type="time"> expects.
export function toTimeInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value).trim())
  if (!match) return ''
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

// Validates a submitted time ("HH:MM", optionally with seconds). Blank or
// invalid -> null.
export function parseStayTime(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${match[2]}`
}

// "Check-in from 3:00 pm · Check-out by 11:00 am", with only the parts that are
// set. Null when neither is set.
export function stayTimesLine(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): string | null {
  const parts: string[] = []
  const inText = formatStayTime(checkIn)
  const outText = formatStayTime(checkOut)
  if (inText) parts.push(`Check-in from ${inText}`)
  if (outText) parts.push(`Check-out by ${outText}`)
  return parts.length ? parts.join(' · ') : null
}

export type StayTerms = {
  check_in_time: string | null
  check_out_time: string | null
  // Older preset, read-only now: the editors leave it alone and the rule below wins.
  cancellation_policy: CancellationPolicy | null
  cancellation_policy_notes: string | null
  cancellation_free_days: number | null
  cancellation_keep: CancellationKeep | null
}

export const STAY_TERMS_COLUMNS = [
  'check_in_time',
  'check_out_time',
  'cancellation_policy',
  'cancellation_policy_notes',
  'cancellation_free_days',
  'cancellation_keep',
] as const

// Deposit schedule columns. listings has had them since migrations 086/108;
// host_applications gets them in migration 123 so the become-a-host wizard can
// ask for the deposit too. Approval copies them into the listing.
export const DEPOSIT_COLUMNS = [
  'deposit_type',
  'deposit_value',
  'deposit_due_days_before_checkin',
  'balance_due_days_before_checkin',
] as const

// Form field names used by components/stay-terms-fields.tsx.
export const STAY_TERMS_FIELDS = {
  marker: 'stayTermsShown',
  checkIn: 'checkInTime',
  checkOut: 'checkOutTime',
  notes: 'cancellationPolicyNotes',
  freeDays: 'cancellationFreeDays',
  keep: 'cancellationKeep',
} as const

// Normalises a row (from select('*') or similar) into StayTerms. Missing columns
// read as null.
export function readStayTerms(row: Record<string, unknown> | null | undefined): StayTerms {
  const notes = typeof row?.cancellation_policy_notes === 'string' ? row.cancellation_policy_notes.trim() : ''
  return {
    check_in_time: parseStayTime(row?.check_in_time),
    check_out_time: parseStayTime(row?.check_out_time),
    cancellation_policy: isCancellationPolicy(row?.cancellation_policy) ? row.cancellation_policy : null,
    cancellation_policy_notes: notes || null,
    cancellation_free_days: parseFreeDays(row?.cancellation_free_days),
    cancellation_keep: isCancellationKeep(row?.cancellation_keep) ? row.cancellation_keep : null,
  }
}

export function hasAnyStayTerms(terms: StayTerms): boolean {
  return Boolean(
    terms.check_in_time ||
      terms.check_out_time ||
      terms.cancellation_policy ||
      terms.cancellation_policy_notes ||
      terms.cancellation_free_days != null,
  )
}

type FormDataLike = { get(name: string): unknown }

// Reads the stay-terms fields from a submitted form. Returns null when the form
// did not show them (no marker field), so the caller leaves the columns alone.
// The older preset (cancellation_policy) is not part of the form any more, so it
// is left out and keeps whatever is stored; the rule takes priority when shown.
export type StayTermsFormValues = Omit<StayTerms, 'cancellation_policy'>

export function readStayTermsFromForm(formData: FormDataLike): StayTermsFormValues | null {
  if (formData.get(STAY_TERMS_FIELDS.marker) !== '1') return null
  const notesRaw = formData.get(STAY_TERMS_FIELDS.notes)
  const notes = typeof notesRaw === 'string' ? notesRaw.trim().slice(0, 2000) : ''
  const freeDays = parseFreeDays(formData.get(STAY_TERMS_FIELDS.freeDays))
  const keep = formData.get(STAY_TERMS_FIELDS.keep)
  return {
    check_in_time: parseStayTime(formData.get(STAY_TERMS_FIELDS.checkIn)),
    check_out_time: parseStayTime(formData.get(STAY_TERMS_FIELDS.checkOut)),
    cancellation_policy_notes: notes || null,
    cancellation_free_days: freeDays,
    cancellation_keep: freeDays == null ? null : isCancellationKeep(keep) ? keep : DEFAULT_CANCELLATION_KEEP,
  }
}

// True when a Supabase/PostgREST error means one of the columns does not exist
// yet (migration 118 not run): Postgres 42703 (undefined_column) or PostgREST
// PGRST204 (column not in schema cache).
export function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  return code === '42703' || code === 'PGRST204'
}

// Columns added by migration 123, dropped first when a write fails because
// that migration hasn't run yet.
const MIGRATION_123_COLUMNS = ['cancellation_free_days', 'cancellation_keep', ...DEPOSIT_COLUMNS] as const

function omitColumns<T extends Record<string, unknown>>(payload: T, columns: readonly string[]): T {
  const copy: Record<string, unknown> = { ...payload }
  for (const column of columns) delete copy[column]
  return copy as T
}

// A copy of `payload` without the stay-terms columns.
export function omitStayTerms<T extends Record<string, unknown>>(payload: T): T {
  return omitColumns(payload, STAY_TERMS_COLUMNS)
}

// Runs an insert/update with `payload`; if it fails only because the stay-terms
// columns don't exist yet, runs it again without them so everything else still
// saves. Returns the result of the last attempt.
export async function writeWithStayTermsFallback<T extends Record<string, unknown>, R extends { error: unknown }>(
  payload: T,
  write: (payload: T) => PromiseLike<R>,
): Promise<R> {
  const result = await write(payload)
  if (!isMissingColumnError(result.error)) return result
  if (MIGRATION_123_COLUMNS.some((column) => column in payload)) {
    console.warn('Cancellation/deposit columns are missing (run migration 123); saving without them.')
    const retry = await write(omitColumns(payload, MIGRATION_123_COLUMNS))
    if (!isMissingColumnError(retry.error)) return retry
  }
  const hasStayTerms = STAY_TERMS_COLUMNS.some((column) => column in payload)
  if (!hasStayTerms) return result
  console.warn('Stay terms columns are missing (run migration 118); saving without them.')
  return write(omitColumns(payload, [...STAY_TERMS_COLUMNS, ...DEPOSIT_COLUMNS]))
}

// Result of a tolerant read of the stay-terms columns. `available` is false when
// the columns don't exist yet (migration 118 or 123 not run).
export type StayTermsLoad = { available: boolean; terms: StayTerms }

export function stayTermsFromResult(result: {
  data: unknown
  error: unknown
}): StayTermsLoad {
  if (result.error) {
    if (!isMissingColumnError(result.error)) {
      console.error('Could not load stay terms', result.error)
    }
    // Never show empty fields on a failed read: saving them would wipe the terms.
    return { available: false, terms: readStayTerms(null) }
  }
  return { available: true, terms: readStayTerms(result.data as Record<string, unknown> | null) }
}
