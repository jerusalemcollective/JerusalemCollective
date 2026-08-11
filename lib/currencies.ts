// The currencies a guest can pick as their preferred display currency.
// Formatting uses Intl (correct symbol + grouping per currency), so we only
// need the ISO code + a human name here for the autocomplete picker.

export type Currency = { code: string; name: string }

export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'ILS', name: 'Israeli New Shekel' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'EUR', name: 'Euro' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'ARS', name: 'Argentine Peso' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'RUB', name: 'Russian Ruble' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'HUF', name: 'Hungarian Forint' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'UAH', name: 'Ukrainian Hryvnia' },
  { code: 'CLP', name: 'Chilean Peso' },
]

const CURRENCY_CODES = new Set(CURRENCIES.map((currency) => currency.code))

export const DEFAULT_CURRENCY = 'USD'

export function isSupportedCurrency(code: string | null | undefined): code is string {
  return Boolean(code && CURRENCY_CODES.has(code))
}

export function normalizeCurrency(code: string | null | undefined): string {
  return isSupportedCurrency(code) ? code : DEFAULT_CURRENCY
}

export function currencyName(code: string): string {
  return CURRENCIES.find((currency) => currency.code === code)?.name || code
}

// Whole-number money formatting with the right symbol for the given currency.
export function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(rounded)
  } catch {
    return `${rounded.toLocaleString()} ${currency}`
  }
}
