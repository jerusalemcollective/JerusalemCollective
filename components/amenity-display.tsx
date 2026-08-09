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
    <div className="space-y-6">
      {visibleGroups.map((group) => (
        <div key={group.title}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500">{group.title}</h3>
          <div className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {group.amenities.map((amenity) => (
              <div key={amenity} className="flex items-center gap-2.5 text-sm text-stone-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#c76f55]" />
                <span>{amenity}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
