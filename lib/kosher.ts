// The three kosher kitchen levels hosts can choose. Older listings may still
// hold retired values; normalizeKosherLevel maps them onto these three.
export const KOSHER_LEVEL_OPTIONS = [
  { value: 'not_kosher', label: 'Not kosher' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'mehadrin', label: 'Kosher mehadrin' },
] as const

export type KosherLevel = (typeof KOSHER_LEVEL_OPTIONS)[number]['value']

const RETIRED_LEVELS: Record<string, KosherLevel> = {
  kosher_friendly: 'not_kosher',
  glatt_kosher: 'mehadrin',
  chalav_yisrael: 'mehadrin',
}

export function normalizeKosherLevel(value: string | null | undefined): KosherLevel | '' {
  if (!value) return ''
  if (KOSHER_LEVEL_OPTIONS.some((option) => option.value === value)) return value as KosherLevel
  return RETIRED_LEVELS[value] || ''
}

export function kosherLevelLabel(value: string | null | undefined) {
  const level = normalizeKosherLevel(value)
  return KOSHER_LEVEL_OPTIONS.find((option) => option.value === level)?.label || ''
}
