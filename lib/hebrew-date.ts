const hebrewDayFormatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  day: 'numeric',
})

const hebrewShortFormatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  day: 'numeric',
  month: 'short',
})

export function formatHebrewDay(date: Date) {
  return hebrewDayFormatter.format(date)
}

export function formatHebrewShortDate(date: Date) {
  return hebrewShortFormatter.format(date)
}
