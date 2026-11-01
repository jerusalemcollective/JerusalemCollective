// Check-in / check-out times and cancellation policy presets for a listing
// (columns added in supabase/migrations/118_listing_checkin_checkout_cancellation.sql).
// Plain TS with no imports so it runs in the host/admin editors, the listing page
// and `node --test` alike.
//
// NULL means "not set". For cancellation_policy, NULL keeps today's rule: terms
// are agreed with the host for each booking.

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
  cancellation_policy: CancellationPolicy | null
  cancellation_policy_notes: string | null
}

export const STAY_TERMS_COLUMNS = [
  'check_in_time',
  'check_out_time',
  'cancellation_policy',
  'cancellation_policy_notes',
] as const

// Form field names used by components/stay-terms-fields.tsx.
export const STAY_TERMS_FIELDS = {
  marker: 'stayTermsShown',
  checkIn: 'checkInTime',
  checkOut: 'checkOutTime',
  policy: 'cancellationPolicy',
  notes: 'cancellationPolicyNotes',
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
  }
}

export function hasAnyStayTerms(terms: StayTerms): boolean {
  return Boolean(
    terms.check_in_time || terms.check_out_time || terms.cancellation_policy || terms.cancellation_policy_notes,
  )
}

type FormDataLike = { get(name: string): unknown }

// Reads the stay-terms fields from a submitted form. Returns null when the form
// did not show them (no marker field), so the caller leaves the columns alone.
export function readStayTermsFromForm(formData: FormDataLike): StayTerms | null {
  if (formData.get(STAY_TERMS_FIELDS.marker) !== '1') return null
  const policy = formData.get(STAY_TERMS_FIELDS.policy)
  const notesRaw = formData.get(STAY_TERMS_FIELDS.notes)
  const notes = typeof notesRaw === 'string' ? notesRaw.trim().slice(0, 2000) : ''
  return {
    check_in_time: parseStayTime(formData.get(STAY_TERMS_FIELDS.checkIn)),
    check_out_time: parseStayTime(formData.get(STAY_TERMS_FIELDS.checkOut)),
    cancellation_policy: isCancellationPolicy(policy) ? policy : null,
    cancellation_policy_notes: notes || null,
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

// A copy of `payload` without the stay-terms columns.
export function omitStayTerms<T extends Record<string, unknown>>(payload: T): T {
  const copy: Record<string, unknown> = { ...payload }
  for (const column of STAY_TERMS_COLUMNS) delete copy[column]
  return copy as T
}

// Runs an insert/update with `payload`; if it fails only because the stay-terms
// columns don't exist yet, runs it again without them so everything else still
// saves. Returns the result of the last attempt.
export async function writeWithStayTermsFallback<T extends Record<string, unknown>, R extends { error: unknown }>(
  payload: T,
  write: (payload: T) => PromiseLike<R>,
): Promise<R> {
  const result = await write(payload)
  const hasStayTerms = STAY_TERMS_COLUMNS.some((column) => column in payload)
  if (!hasStayTerms || !isMissingColumnError(result.error)) return result
  console.warn('Stay terms columns are missing (run migration 118); saving without them.')
  return write(omitStayTerms(payload))
}

// Result of a tolerant read of the stay-terms columns. `available` is false when
// the columns don't exist yet (migration 118 not run).
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
