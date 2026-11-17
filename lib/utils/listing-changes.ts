// Works out, in plain words, what a host changed on a listing, for the JLM
// team's "host changed their listing" email. Pure (no I/O) so it can be tested
// with `node --test lib/utils/listing-changes.test.mjs`.

export type ListingRow = Record<string, unknown>

// A set of changes: the changed field groups (keys of CHANGE_GROUPS, in that
// order) and, when the price changed, its old and new nightly price.
export type ListingChangeSet = {
  fields: string[]
  price?: { from: string; to: string }
}

// Each group is one plain-words label covering one or more listings columns.
// Legacy price_ils / price_usd and the *_ils / *_usd extra-guest fees are left
// out on purpose: they are re-converted with today's exchange rate on every
// save, so they "change" even when the host changed nothing.
const CHANGE_GROUPS: { key: string; label: string; columns: string[] }[] = [
  { key: 'title', label: 'title', columns: ['title'] },
  { key: 'area', label: 'area', columns: ['area'] },
  { key: 'bedrooms', label: 'number of bedrooms', columns: ['bedrooms'] },
  { key: 'bathrooms', label: 'number of bathrooms', columns: ['bathrooms'] },
  { key: 'guests', label: 'number of guests', columns: ['max_guests'] },
  { key: 'sleeping_setup', label: 'sleeping setup', columns: ['sleeping_setup'] },
  { key: 'price', label: 'price', columns: [] },
  { key: 'extra_guests', label: 'extra-guest pricing', columns: ['included_guests', 'extra_guest_fee'] },
  { key: 'booking_type', label: 'booking type', columns: ['booking_type'] },
  { key: 'online_payment', label: 'online payment setting', columns: ['online_payment_enabled'] },
  {
    key: 'deposit',
    label: 'deposit and payment schedule',
    columns: ['deposit_type', 'deposit_value', 'balance_due_days_before_checkin', 'deposit_due_days_before_checkin'],
  },
  { key: 'min_nights', label: 'minimum stay', columns: ['min_nights'] },
  { key: 'amenities', label: 'amenities', columns: ['amenities'] },
  { key: 'description', label: 'description', columns: ['description'] },
  { key: 'house_rules', label: 'house rules', columns: ['house_rules'] },
  { key: 'welcome_message', label: 'welcome message', columns: ['welcome_message'] },
  { key: 'check_in_instructions', label: 'check-in instructions', columns: ['check_in_instructions'] },
  { key: 'stay_times', label: 'check-in and check-out times', columns: ['check_in_time', 'check_out_time'] },
  { key: 'cancellation', label: 'cancellation policy', columns: ['cancellation_policy', 'cancellation_policy_notes'] },
  { key: 'kosher', label: 'kosher kitchen level', columns: ['kosher_kitchen_level'] },
  { key: 'kotel', label: 'walking time to the Kotel', columns: ['walking_minutes_to_kotel'] },
  {
    key: 'shabbat',
    label: 'Shabbat features',
    columns: ['shabbat_elevator', 'physical_key_entry', 'shabbat_clock', 'sukkah_balcony', 'near_synagogue'],
  },
]

const GROUP_ORDER = CHANGE_GROUPS.map((group) => group.key)

// Blank, null and false all mean "not set"; text is trimmed; numbers compare as
// numbers; lists ignore order and letter case.
function normalize(value: unknown): string {
  if (value === null || value === undefined || value === false) return ''
  if (value === true) return 'true'
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join('\n')
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  const text = String(value).trim()
  if (text !== '' && /^-?\d+(\.\d+)?$/.test(text)) return String(Number(text))
  // Postgres returns times as "15:00:00"; the form may send "15:00".
  if (/^\d{2}:\d{2}:00$/.test(text)) return text.slice(0, 5)
  return text
}

function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(rounded)
  } catch {
    return `${rounded.toLocaleString()} ${currency}`
  }
}

// The nightly price as the host set it: price + price_currency, falling back to
// the legacy shekel / dollar columns for listings that predate them.
export function nightlyPriceLabel(row: ListingRow | null | undefined): string {
  if (!row) return ''
  const amount = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }
  const price = amount(row.price)
  if (price !== null) return formatMoney(price, String(row.price_currency || 'ILS'))
  const ils = amount(row.price_ils)
  if (ils !== null) return formatMoney(ils, 'ILS')
  const usd = amount(row.price_usd)
  if (usd !== null) return formatMoney(usd, 'USD')
  return ''
}

export function diffListing(before: ListingRow, after: ListingRow): ListingChangeSet {
  const fields: string[] = []
  let price: ListingChangeSet['price']
  for (const group of CHANGE_GROUPS) {
    if (group.key === 'price') {
      const from = nightlyPriceLabel(before)
      const to = nightlyPriceLabel(after)
      if (from !== to) {
        fields.push('price')
        price = { from: from || 'no price', to: to || 'no price' }
      }
      continue
    }
    // A column missing from either row (e.g. a migration not run) is skipped.
    const changed = group.columns.some(
      (column) => column in before && column in after && normalize(before[column]) !== normalize(after[column]),
    )
    if (changed) fields.push(group.key)
  }
  return price ? { fields, price } : { fields }
}

// Combines an earlier set with a later one: every field from both, and the
// price from its first old value to its last new value (dropped if it ended
// where it started).
export function mergeChangeSets(
  earlier: ListingChangeSet | null | undefined,
  later: ListingChangeSet,
): ListingChangeSet {
  if (!earlier || !Array.isArray(earlier.fields)) return later
  const keys = new Set([...earlier.fields, ...later.fields].filter((key) => GROUP_ORDER.includes(key)))
  let price: ListingChangeSet['price']
  if (earlier.price || later.price) {
    const from = earlier.price?.from ?? later.price?.from ?? ''
    const to = later.price?.to ?? earlier.price?.to ?? ''
    if (from !== to) price = { from, to }
  }
  if (!price) keys.delete('price')
  const fields = GROUP_ORDER.filter((key) => keys.has(key))
  return price ? { fields, price } : { fields }
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

function labelFor(key: string): string {
  return CHANGE_GROUPS.find((group) => group.key === key)?.label || key
}

// "the price and description", or for many fields "6 things"; used in the
// subject line.
export function shortChangePhrase(changes: ListingChangeSet): string {
  if (changes.fields.length > 4) return `${changes.fields.length} things`
  return `the ${joinWords(changes.fields.map(labelFor))}`
}

// "the price (₪500 → ₪550) and description"; used in the email body.
export function fullChangePhrase(changes: ListingChangeSet): string {
  const words = changes.fields.map((key) =>
    key === 'price' && changes.price ? `price (${changes.price.from} → ${changes.price.to})` : labelFor(key),
  )
  return `the ${joinWords(words)}`
}
