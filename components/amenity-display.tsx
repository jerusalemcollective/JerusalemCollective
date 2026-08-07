import { CheckCircle2 } from 'lucide-react'
import { STAY_AMENITY_GROUPS } from '@/lib/stay-amenities'

export function AmenityDisplay({ amenities }: { amenities: string[] }) {
  const selectedSet = new Set(amenities)
  const visibleGroups = STAY_AMENITY_GROUPS
    .map((group) => ({
      ...group,
      amenities: group.amenities.filter((amenity) => selectedSet.has(amenity)),
    }))
    .filter((group) => group.amenities.length > 0)

  if (visibleGroups.length === 0) return null

  return (
    <div className="space-y-4">
      {visibleGroups.map((group) => (
        <section key={group.title} className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-stone-950">{group.title}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.amenities.map((amenity) => (
              <div
                key={amenity}
                className="flex min-h-12 items-center gap-3 rounded-2xl bg-[#F8F5F2] px-4 py-3 text-sm font-semibold text-stone-700"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#c76f55]" />
                <span>{amenity}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
