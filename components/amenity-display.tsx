import {
  Baby,
  Car,
  CheckCircle2,
  Coffee,
  CookingPot,
  CupSoda,
  Flame,
  MapPin,
  Microwave,
  Snowflake,
  Trees,
  Users,
  UtensilsCrossed,
  WashingMachine,
  Wifi,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { STAY_AMENITY_GROUPS } from '@/lib/stay-amenities'

// A specific icon per amenity so the list reads at a glance. Anything without a
// natural icon (towels, iron, elevator, balcony, dishwasher…) falls back to a
// terracotta check so nothing ever renders blank.
const AMENITY_ICONS: Record<string, LucideIcon> = {
  WiFi: Wifi,
  'Air conditioning': Snowflake,
  Heating: Flame,
  Washer: WashingMachine,
  Dryer: Wind,
  Parking: Car,
  Garden: Trees,
  'Kosher kitchen': UtensilsCrossed,
  Oven: CookingPot,
  Microwave: Microwave,
  'Coffee maker': Coffee,
  'Hot plate': CookingPot,
  'Hot water urn': CupSoda,
  'In eruv': MapPin,
  'Family friendly': Users,
  Crib: Baby,
  'High chair': Baby,
}

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
    <div className="space-y-5">
      {visibleGroups.map((group) => (
        <div key={group.title}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500">{group.title}</h3>
          <div className="mt-2.5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {group.amenities.map((amenity) => {
              const Icon = AMENITY_ICONS[amenity] || CheckCircle2
              return (
                <div key={amenity} className="flex items-center gap-2.5 text-sm text-stone-800">
                  <Icon className="h-[18px] w-[18px] shrink-0 text-[#c76f55]" />
                  <span>{amenity}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
