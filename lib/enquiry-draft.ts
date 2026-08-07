// Per-listing enquiry draft persisted in sessionStorage so it survives the
// full-navigation login / OAuth round trip, then auto-clears on tab close.
// Personal free-text (message, name) must never go in the URL - hence storage.

export type EnquiryDraft = {
  message: string
  senderName: string
  checkIn: string | null // YYYY-MM-DD (as produced by formatDateISO)
  checkOut: string | null
  guests: number
  intent: 'message' | 'request'
  quickQuestion: boolean
}

const keyFor = (listingId: string): string => `enquiry-draft:${listingId}`

export function saveEnquiryDraft(listingId: string, draft: EnquiryDraft): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(keyFor(listingId), JSON.stringify(draft))
  } catch {
    // Best-effort: private mode / quota can throw. A lost draft is acceptable;
    // a crashed send flow is not.
  }
}

export function loadEnquiryDraft(listingId: string): EnquiryDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(keyFor(listingId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<EnquiryDraft>
    if (typeof parsed.message !== 'string') return null
    return {
      message: parsed.message,
      senderName: typeof parsed.senderName === 'string' ? parsed.senderName : '',
      checkIn: typeof parsed.checkIn === 'string' ? parsed.checkIn : null,
      checkOut: typeof parsed.checkOut === 'string' ? parsed.checkOut : null,
      guests:
        typeof parsed.guests === 'number' && Number.isFinite(parsed.guests)
          ? parsed.guests
          : 1,
      intent: parsed.intent === 'request' ? 'request' : 'message',
      quickQuestion: parsed.quickQuestion === true,
    }
  } catch {
    return null
  }
}

export function clearEnquiryDraft(listingId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(keyFor(listingId))
  } catch {
    // ignore
  }
}
