const hebrewDayFormatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
  day: 'numeric',
})

export function formatHebrewDay(date: Date) {
  return hebrewDayFormatter.format(date)
}
