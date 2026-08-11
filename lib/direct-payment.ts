// Structured host payout (bank) details, stored inside the direct_payment_instructions
// JSON on host_payment_profiles alongside the deposit schedule. Replaces the old
// free-text "how to pay you" box so whoever pays the host has exactly what a transfer
// needs. Bank transfer only — one field set per destination region.

export type PayoutType = 'iban' | 'uk' | 'us' | 'zelle'

export type PayoutDetails = {
  type: PayoutType
  accountName: string
  // IBAN (Europe / Israel / international)
  iban?: string
  swift?: string
  bankName?: string
  accountAddress?: string
  // United Kingdom
  sortCode?: string
  // shared by UK + US
  accountNumber?: string
  // United States
  routingNumber?: string
  accountType?: 'checking' | 'savings'
  // Zelle (US) — the registered email or US phone number
  zelle?: string
}

// Parse a payout object off the parsed direct_payment_instructions JSON, or null if
// there isn't a valid one (legacy entries have no `payout`).
export function parsePayout(value: unknown): PayoutDetails | null {
  if (!value || typeof value !== 'object') return null
  const p = value as Record<string, unknown>
  if (p.type !== 'iban' && p.type !== 'uk' && p.type !== 'us' && p.type !== 'zelle') return null
  const str = (key: string): string | undefined =>
    typeof p[key] === 'string' && (p[key] as string).trim() !== '' ? (p[key] as string) : undefined
  const accountType = p.accountType === 'savings' ? 'savings' : p.accountType === 'checking' ? 'checking' : undefined
  return {
    type: p.type,
    accountName: str('accountName') ?? '',
    iban: str('iban'),
    swift: str('swift'),
    bankName: str('bankName'),
    accountAddress: str('accountAddress'),
    sortCode: str('sortCode'),
    accountNumber: str('accountNumber'),
    routingNumber: str('routingNumber'),
    accountType,
    zelle: str('zelle'),
  }
}

// A host's payout account now lives in host_payment_profiles.payout_details, but
// rows saved before migration 106 (or not yet backfilled) still carry it nested
// inside the direct_payment_instructions schedule JSON. Read the column first, fall
// back to the legacy nested payout, so every surface shows the same account.
export function resolveHostPayout(
  payoutDetails: unknown,
  directPaymentInstructions: string | null | undefined,
): PayoutDetails | null {
  const fromColumn = parsePayout(payoutDetails)
  if (fromColumn) return fromColumn
  if (!directPaymentInstructions) return null
  try {
    const parsed = JSON.parse(directPaymentInstructions)
    if (parsed && typeof parsed === 'object' && parsed.v === 1) {
      return parsePayout(parsed.payout)
    }
  } catch {
    // legacy free text — no structured payout
  }
  return null
}

// Ordered [label, value] rows for displaying a host's payout details (guest summary
// + email). Only includes the fields relevant to the chosen region, and only ones
// that are filled in.
export function formatPayoutRows(payout: PayoutDetails): [string, string][] {
  const rows: [string, string][] = []
  if (payout.accountName) rows.push(['Account name', payout.accountName])

  if (payout.type === 'iban') {
    if (payout.iban) rows.push(['IBAN', payout.iban])
    if (payout.swift) rows.push(['SWIFT / BIC', payout.swift])
    if (payout.bankName) rows.push(['Bank', payout.bankName])
    if (payout.accountAddress) rows.push(['Account address', payout.accountAddress])
  } else if (payout.type === 'uk') {
    if (payout.sortCode) rows.push(['Sort code', payout.sortCode])
    if (payout.accountNumber) rows.push(['Account number', payout.accountNumber])
  } else if (payout.type === 'us') {
    if (payout.routingNumber) rows.push(['Routing number', payout.routingNumber])
    if (payout.accountNumber) rows.push(['Account number', payout.accountNumber])
    if (payout.accountType) rows.push(['Account type', payout.accountType === 'savings' ? 'Savings' : 'Checking'])
    if (payout.bankName) rows.push(['Bank', payout.bankName])
  } else if (payout.type === 'zelle') {
    if (payout.zelle) rows.push(['Zelle', payout.zelle])
  }
  return rows
}
