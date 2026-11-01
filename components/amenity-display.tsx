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
import { STAY_AMENITIES, STAY_AMENITY_GROUPS } from '@/lib/stay-amenities'

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

// Every amenity we already show somewhere (grouped list, or dedicated sections
// such as the Shabbos ones). Anything else was typed by the host.
const KNOWN_AMENITIES = new Set<string>(STAY_AMENITIES)

// Amenities the host typed into "Other amenities". Older listings saved them as
// one comma-separated item, so split those too, and drop duplicates.
function getOtherAmenities(amenities: string[], hidden: Set<string>) {
  const seen = new Set<string>()
  const others: string[] = []
  for (const value of amenities) {
    if (KNOWN_AMENITIES.has(value)) continue
    for (const part of value.split(',')) {
      const amenity = part.trim()
      const key = amenity.toLowerCase()
      if (!amenity || KNOWN_AMENITIES.has(amenity) || hidden.has(key) || seen.has(key)) continue
      seen.add(key)
      others.push(amenity)
    }
  }
  return others
}

// `hide` lists amenities shown elsewhere on the page (e.g. the Shabbos list),
// matched case-insensitively, so nothing appears twice.
export function getVisibleAmenityGroups(amenities: string[], hide: readonly string[] = []) {
  const hidden = new Set(hide.map((amenity) => amenity.trim().toLowerCase()))
  const selectedSet = new Set(amenities)
  const otherAmenities = getOtherAmenities(amenities, hidden)
  return [
    ...STAY_AMENITY_GROUPS.map((group) => ({
      title: group.title as string,
      amenities: (group.amenities as readonly string[]).filter(
        (amenity) => selectedSet.has(amenity) && !hidden.has(amenity.toLowerCase()),
      ),
    })),
    { title: 'Other amenities', amenities: otherAmenities },
  ].filter((group) => group.amenities.length > 0)
}

export function AmenityDisplay({ amenities, hide = [] }: { amenities: string[]; hide?: readonly string[] }) {
  const visibleGroups = getVisibleAmenityGroups(amenities, hide)

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
