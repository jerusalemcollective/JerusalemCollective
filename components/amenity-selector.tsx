import { Check } from 'lucide-react'
import { STAY_AMENITY_GROUPS } from '@/lib/stay-amenities'

type AmenitySelectorProps = {
  selectedAmenities?: string[]
  defaultSelectedAmenities?: string[]
  name?: string
  onToggle?: (amenity: string) => void
}

export function AmenitySelector({
  selectedAmenities,
  defaultSelectedAmenities = [],
  name = 'amenities',
  onToggle,
}: AmenitySelectorProps) {
  const selected = selectedAmenities ?? defaultSelectedAmenities
  const selectedSet = new Set(selected)
  const knownAmenities = new Set<string>(STAY_AMENITY_GROUPS.flatMap((group) => group.amenities))
  const customAmenities = selected.filter((amenity) => !knownAmenities.has(amenity)).join(', ')

  return (
    <div className="space-y-5">
      {STAY_AMENITY_GROUPS.map((group) => (
        <section key={group.title} className="rounded-3xl border border-stone-200 bg-white p-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h3 className="text-sm font-bold text-stone-950">{group.title}</h3>
            <span className="shrink-0 rounded-full bg-[#F8F5F2] px-3 py-1 text-xs font-bold text-stone-500">
              {group.amenities.filter((amenity) => selectedSet.has(amenity)).length}/{group.amenities.length}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.amenities.map((amenity) =>
              onToggle ? (
                <button
                  key={amenity}
                  type="button"
                  aria-pressed={selectedSet.has(amenity)}
                  onClick={() => onToggle(amenity)}
                  className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    selectedSet.has(amenity)
                      ? 'border-[#c76f55] bg-[#fff4ef] text-[#9e4f39] shadow-sm'
                      : 'border-stone-200 bg-[#F8F5F2] text-stone-700 hover:border-stone-300 hover:bg-white'
                  }`}
                >
                  <span>{amenity}</span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                      selectedSet.has(amenity)
                        ? 'border-[#c76f55] bg-[#c76f55] text-white'
                        : 'border-stone-300 bg-white text-transparent'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              ) : (
                <label key={amenity} className="group cursor-pointer">
                  <input
                    type="checkbox"
                    name={name}
                    value={amenity}
                    defaultChecked={selectedSet.has(amenity)}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-[#F8F5F2] px-4 py-3 text-left text-sm font-semibold text-stone-700 transition peer-checked:border-[#c76f55] peer-checked:bg-[#fff4ef] peer-checked:text-[#9e4f39] peer-checked:[&_.amenity-check]:border-[#c76f55] peer-checked:[&_.amenity-check]:bg-[#c76f55] peer-checked:[&_.amenity-check]:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#c76f55]/30 group-hover:border-stone-300 group-hover:bg-white">
                    <span>{amenity}</span>
                    <span className="amenity-check flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white text-transparent transition">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </label>
              ),
            )}
          </div>
        </section>
      ))}

      {!onToggle && (
        <section className="rounded-3xl border border-stone-200 bg-white p-4">
          <h3 className="text-sm font-bold text-stone-950">Other amenities</h3>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            Add anything not listed above, separated by commas.
          </p>
          <input
            type="text"
            name={name}
            defaultValue={customAmenities}
            placeholder="e.g. Rooftop terrace, Nespresso machine, Piano"
            className="mt-3 w-full rounded-2xl border border-stone-200 bg-[#F8F5F2] px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-[#c76f55]"
          />
        </section>
      )}
    </div>
  )
}
