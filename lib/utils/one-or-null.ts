// Supabase embeds a to-one relationship as either the row object or a
// single-element array, depending on how the FK is resolved. Normalise both (and
// null/undefined/empty) to "the row, or null" in one place, instead of repeating
// `Array.isArray(x) ? x[0] ?? null : x ?? null` at every join site.
export function oneOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}
