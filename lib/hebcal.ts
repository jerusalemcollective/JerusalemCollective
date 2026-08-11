import { HDate, getSedra, getHolidaysOnDate, type Sedra } from '@hebcal/core'

// Jerusalem — use the Israel schedule (one-day yom tov, Israeli parsha cycle).
const IL = true

// Building a Sedra scans the whole Hebrew year, so cache one per year.
const sedraCache = new Map<number, Sedra>()
function sedraForYear(hyear: number): Sedra {
  const cached = sedraCache.get(hyear)
  if (cached) return cached
  const sedra = getSedra(hyear, IL)
  sedraCache.set(hyear, sedra)
  return sedra
}

export type DayJudaica = {
  holiday: string | null
  parsha: string | null
}

// Holiday name + weekly parsha (Israel schedule) for a Gregorian day, from the
// accurate @hebcal/core calendar. Holidays cover yom tov, chol hamoed, rosh
// chodesh and fasts; the parsha shows on Shabbat when a chag doesn't displace it.
export function getDayJudaica(date: Date): DayJudaica {
  const hd = new HDate(date)

  let holiday: string | null = null
  const events = getHolidaysOnDate(hd, IL)
  if (events && events.length > 0) {
    // Drop the trailing Hebrew year hebcal appends to some names (e.g.
    // "Rosh Hashana 5787" → "Rosh Hashana").
    holiday = events[0].render('en').replace(/\s+5\d{3}$/, '')
  }

  let parsha: string | null = null
  if (date.getDay() === 6) {
    const result = sedraForYear(hd.getFullYear()).lookup(hd)
    if (!result.chag && result.parsha.length > 0) {
      parsha = result.parsha.join('–')
    }
  }

  return { holiday, parsha }
}
