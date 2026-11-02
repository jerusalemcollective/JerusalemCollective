'use client'

import { Check } from 'lucide-react'
import { KOSHER_LEVEL_OPTIONS, normalizeKosherLevel } from '@/lib/kosher'

// The "Shabbos & Jewish stay" amenities, drawn with the same tiles as the
// other amenity groups. Every control is a real form input with a name, so it
// works inside a server-action form (pass only `values`) or with React state
// (also pass `onChange`).

export type ShabbosValues = {
  kosherKitchenLevel: string
  walkingMinutesToKotel: string
  shabbatElevator: boolean
  shabbatClock: boolean
  nearSynagogue: boolean
  sukkahBalcony: boolean
  physicalKeyEntry: boolean
  amenities: string[]
}

type FlagKey = 'shabbatElevator' | 'shabbatClock' | 'nearSynagogue' | 'sukkahBalcony' | 'physicalKeyEntry'

const FLAGS: { key: FlagKey; label: string }[] = [
  { key: 'shabbatElevator', label: 'Shabbos elevator' },
  { key: 'shabbatClock', label: 'Shabbos clock or light timer' },
  { key: 'nearSynagogue', label: 'Shul within 5 minutes walk' },
  { key: 'sukkahBalcony', label: 'Balcony for a sukkah' },
  { key: 'physicalKeyEntry', label: 'Physical key (no keypad or smart lock)' },
]

const SHABBOS_AMENITIES = ['Hot plate', 'Hot water urn', 'In eruv']

type ShabbosAmenitiesProps = {
  values: ShabbosValues
  onChange?: {
    kosherKitchenLevel: (value: string) => void
    walkingMinutesToKotel: (value: string) => void
    flag: (key: FlagKey, checked: boolean) => void
    toggleAmenity: (amenity: string) => void
  }
}

const tileClass =
  'flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-[#F8F5F2] px-4 py-3 text-left text-sm font-semibold text-stone-700 transition peer-checked:border-[#c76f55] peer-checked:bg-[#fff4ef] peer-checked:text-[#9e4f39] peer-checked:shadow-sm peer-checked:[&_.amenity-check]:border-[#c76f55] peer-checked:[&_.amenity-check]:bg-[#c76f55] peer-checked:[&_.amenity-check]:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#c76f55]/30 group-hover:border-stone-300 group-hover:bg-white'

function TileMark() {
  return (
    <span className="amenity-check flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white text-transparent transition">
      <Check className="h-3.5 w-3.5" />
    </span>
  )
}

export function ShabbosAmenities({ values, onChange }: ShabbosAmenitiesProps) {
  const controlled = Boolean(onChange)
  const kosher = normalizeKosherLevel(values.kosherKitchenLevel) || 'not_kosher'
  const selectedCount =
    FLAGS.filter((flag) => values[flag.key]).length +
    SHABBOS_AMENITIES.filter((amenity) => values.amenities.includes(amenity)).length

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h3 className="text-sm font-bold text-stone-950">Shabbos &amp; Jewish stay</h3>
        <span className="shrink-0 rounded-full bg-[#F8F5F2] px-3 py-1 text-xs font-bold text-stone-500">
          {selectedCount}/{FLAGS.length + SHABBOS_AMENITIES.length}
        </span>
      </div>

      <p className="mb-2 text-xs font-semibold text-stone-500">Kosher kitchen</p>
      <div role="radiogroup" aria-label="Kosher kitchen" className="mb-4 grid gap-2 sm:grid-cols-3">
        {KOSHER_LEVEL_OPTIONS.map((option) => (
          <label key={option.value} className="group cursor-pointer">
            <input
              type="radio"
              name="kosherKitchenLevel"
              value={option.value}
              className="peer sr-only"
              {...(controlled
                ? {
                    checked: kosher === option.value,
                    onChange: () => onChange?.kosherKitchenLevel(option.value),
                  }
                : { defaultChecked: kosher === option.value })}
            />
            <span className={tileClass}>
              <span>{option.label}</span>
              <TileMark />
            </span>
          </label>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FLAGS.map((flag) => (
          <label key={flag.key} className="group cursor-pointer">
            <input
              type="checkbox"
              name={flag.key}
              className="peer sr-only"
              {...(controlled
                ? {
                    checked: values[flag.key],
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                      onChange?.flag(flag.key, event.target.checked),
                  }
                : { defaultChecked: values[flag.key] })}
            />
            <span className={tileClass}>
              <span>{flag.label}</span>
              <TileMark />
            </span>
          </label>
        ))}

        {SHABBOS_AMENITIES.map((amenity) => (
          <label key={amenity} className="group cursor-pointer">
            <input
              type="checkbox"
              name="amenities"
              value={amenity}
              className="peer sr-only"
              {...(controlled
                ? {
                    checked: values.amenities.includes(amenity),
                    onChange: () => onChange?.toggleAmenity(amenity),
                  }
                : { defaultChecked: values.amenities.includes(amenity) })}
            />
            <span className={tileClass}>
              <span>{amenity}</span>
              <TileMark />
            </span>
          </label>
        ))}

        <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-[#F8F5F2] px-4 py-2 text-sm font-semibold text-stone-700">
          <span>Walk to the Kotel</span>
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              name="walkingMinutesToKotel"
              placeholder="—"
              aria-label="Walking minutes to the Kotel"
              className="w-16 rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-center text-sm font-semibold text-stone-900 outline-none focus:border-[#c76f55]"
              {...(controlled
                ? {
                    value: values.walkingMinutesToKotel,
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                      onChange?.walkingMinutesToKotel(event.target.value),
                  }
                : { defaultValue: values.walkingMinutesToKotel })}
            />
            <span className="text-xs text-stone-500">min</span>
          </span>
        </label>
      </div>
    </section>
  )
}
