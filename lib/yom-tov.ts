import { HDate, months } from '@hebcal/core'
import { findStayCollection } from '@/lib/stay-collections'

// Homepage "Yom Tov & kosher stays" tiles: the seasonal collections ordered so
// the next chag (or one in progress) comes first, with the kosher-kitchen
// collection always last. Server-side only; dates use Jerusalem's calendar day.

type ChagDefinition = {
  slug: string
  title: string
  blurb: string
  hebrewWord: string
  month: number
  startDay: number
  // Last day (inclusive) on the Israel schedule — while it lasts the chag counts
  // as "in progress" and stays first.
  endDay: number
}

const CHAGIM: ChagDefinition[] = [
  {
    slug: 'pesach',
    title: 'Pesach',
    blurb: 'Family apartments near shuls and the Kotel.',
    hebrewWord: 'פסח',
    month: months.NISAN,
    startDay: 15,
    endDay: 21,
  },
  {
    slug: 'sukkot',
    title: 'Sukkot',
    blurb: 'Stays with a balcony that takes a sukkah.',
    hebrewWord: 'סוכות',
    month: months.TISHREI,
    startDay: 15,
    endDay: 22,
  },
]

export type YomTovTile = {
  slug: string
  href: string
  title: string
  blurb: string
  hebrewWord: string
  // Null for the year-round kosher tile.
  timing: string | null
  civilDate: string | null
  hebrewDate: string | null
}

function jerusalemToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return new Date(get('year'), get('month') - 1, get('day'))
}

function describeTiming(daysUntil: number) {
  if (daysUntil <= 0) return 'On now'
  if (daysUntil === 1) return 'Tomorrow'
  if (daysUntil < 14) return `In ${daysUntil} days`
  if (daysUntil < 45) return `In ${Math.round(daysUntil / 7)} weeks`
  const monthsUntil = Math.round(daysUntil / 30.44)
  return `In ${monthsUntil} month${monthsUntil === 1 ? '' : 's'}`
}

const civilFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function getYomTovTiles(today: Date = jerusalemToday()): YomTovTile[] {
  const todayHd = new HDate(today)
  const year = todayHd.getFullYear()

  const seasonal = CHAGIM.map((chag) => {
    // The next occurrence that hasn't ended yet: this Hebrew year's, or next year's.
    const start =
      [year, year + 1]
        .map((hyear) => new HDate(chag.startDay, chag.month, hyear))
        .find((candidate) => {
          const end = new HDate(chag.endDay, chag.month, candidate.getFullYear())
          return end.deltaDays(todayHd) >= 0
        }) ?? new HDate(chag.startDay, chag.month, year + 1)
    const daysUntil = start.deltaDays(todayHd)

    return {
      daysUntil,
      tile: {
        slug: chag.slug,
        href: `/stays/${chag.slug}`,
        title: chag.title,
        blurb: chag.blurb,
        hebrewWord: chag.hebrewWord,
        timing: describeTiming(daysUntil),
        civilDate: civilFormatter.format(start.greg()),
        hebrewDate: `${start.getDate()} ${start.getMonthName()} ${start.getFullYear()}`,
      } satisfies YomTovTile,
    }
  })
    .filter(({ tile }) => findStayCollection(tile.slug))
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .map(({ tile }) => tile)

  const kosher: YomTovTile[] = findStayCollection('kosher-kitchen')
    ? [
        {
          slug: 'kosher-kitchen',
          href: '/stays/kosher-kitchen',
          title: 'Kosher kitchen',
          blurb: 'Kosher, glatt and Chalav Yisrael kitchens.',
          hebrewWord: 'כשר',
          timing: null,
          civilDate: null,
          hebrewDate: null,
        },
      ]
    : []

  return [...seasonal, ...kosher]
}
