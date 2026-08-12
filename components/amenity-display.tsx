import { CheckCircle2 } from 'lucide-react'
import { STAY_AMENITY_GROUPS } from '@/lib/stay-amenities'

// extraComfort folds the listing's boolean "American comfort" features
// (central AC, American washer/dryer, etc.) into the Everyday comfort group, so
// they aren't shown as a separate near-duplicate section.
export function AmenityDisplay({
  amenities,
  extraComfort = [],
}: {
  amenities: string[]
  extraComfort?: string[]
}) {
  const selectedSet = new Set(amenities)
  const visibleGroups = STAY_AMENITY_GROUPS
    .map((group) => {
      const items: string[] = group.amenities.filter((amenity) => selectedSet.has(amenity))
      if (group.title === 'Everyday comfort') {
        for (const extra of extraComfort) {
          if (!items.includes(extra)) items.push(extra)
        }
      }
      return { ...group, amenities: items }
    })
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
