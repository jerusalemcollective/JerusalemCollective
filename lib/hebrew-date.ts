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

export function formatHebrewDay(date: Date) {
  return hebrewDayFormatter.format(date)
}

export function formatHebrewShortDate(date: Date) {
  return hebrewShortFormatter.format(date)
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
    month: parts.find((part) => part.type === 'month')?.value || '',
    year: parts.find((part) => part.type === 'year')?.value || '',
  }
}
