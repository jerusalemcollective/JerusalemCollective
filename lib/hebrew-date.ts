const hebrewDayFormatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  day: 'numeric',
})

const hebrewShortFormatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  day: 'numeric',
  month: 'short',
})

const hebrewMonthYearFormatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  month: 'short',
  year: 'numeric',
})

const hebrewDatePartsFormatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Intl's Hebrew month transliterations don't match the spellings commonly used
// here (e.g. it emits "Heshvan" for what is usually written "Cheshvan"). Remap the
// month names to the preferred spellings wherever a month is shown.
const HEBREW_MONTH_SPELLING_FIXES: [RegExp, string][] = [
  [/\bHeshvan\b/g, 'Cheshvan'],
]

function fixHebrewMonthSpelling(text: string) {
  return HEBREW_MONTH_SPELLING_FIXES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text)
}

export function formatHebrewDay(date: Date) {
  return toHebrewDayLetters(Number(hebrewDayFormatter.format(date)))
}

export function formatHebrewShortDate(date: Date) {
  return fixHebrewMonthSpelling(hebrewShortFormatter.format(date))
}

export function formatHebrewMonthSpan(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)

  const start = getHebrewMonthYearParts(firstDay)
  const end = getHebrewMonthYearParts(lastDay)

  if (start.month === end.month && start.year === end.year) {
    return `${start.month} ${start.year}`
  }

  if (start.year === end.year) {
    return `${start.month}-${end.month} ${start.year}`
  }

  return `${start.month} ${start.year}-${end.month} ${end.year}`
}

function getHebrewMonthYearParts(date: Date) {
  const parts = hebrewMonthYearFormatter.formatToParts(date)

  return {
    month: fixHebrewMonthSpelling(parts.find((part) => part.type === 'month')?.value || ''),
    year: parts.find((part) => part.type === 'year')?.value || '',
  }
}

export function getJewishHoliday(date: Date) {
  const { day, month } = getHebrewDateParts(date)

  if (month === 'Tishri' && [1, 2].includes(day)) return 'Rosh Hashanah'
  if (month === 'Tishri' && day === 10) return 'Yom Kippur'
  if (month === 'Tishri' && day >= 15 && day <= 21) return 'Sukkot'
  if (month === 'Nisan' && day >= 15 && day <= 22) return 'Pesach'
  if (month === 'Sivan' && [6, 7].includes(day)) return 'Shavuot'
  if ((month === 'Adar' || month === 'Adar II') && day === 14) return 'Purim'
  if (isChanukah(date)) return 'Chanukah'

  return null
}

function getHebrewDateParts(date: Date) {
  const parts = hebrewDatePartsFormatter.formatToParts(date)

  return {
    day: Number(parts.find((part) => part.type === 'day')?.value || 0),
    month: parts.find((part) => part.type === 'month')?.value || '',
    year: parts.find((part) => part.type === 'year')?.value || '',
  }
}

function isChanukah(date: Date) {
  const current = getHebrewDateParts(date)

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(date)
    candidate.setDate(candidate.getDate() - offset)
    const parts = getHebrewDateParts(candidate)

    if (
      parts.year === current.year &&
      parts.month === 'Kislev' &&
      parts.day === 25
    ) {
      return true
    }
  }

  return false
}

function toHebrewDayLetters(day: number) {
  const letters = [
    '',
    'א',
    'ב',
    'ג',
    'ד',
    'ה',
    'ו',
    'ז',
    'ח',
    'ט',
    'י',
    'יא',
    'יב',
    'יג',
    'יד',
    'טו',
    'טז',
    'יז',
    'יח',
    'יט',
    'כ',
    'כא',
    'כב',
    'כג',
    'כד',
    'כה',
    'כו',
    'כז',
    'כח',
    'כט',
    'ל',
  ]

  return letters[day] || String(day)
}
