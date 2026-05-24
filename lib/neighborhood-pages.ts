import { allNeighborhoods } from '@/lib/neighborhoods'

export function slugifyNeighborhood(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/\u2019/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function findNeighborhoodBySlug(slug: string): string | null {
  return allNeighborhoods.find((name) => slugifyNeighborhood(name) === slug) || null
}

export const neighborhoodDescriptions: Record<string, string> = {
  Rechavia: '',
  'German Colony': '',
  Katamon: '',
  Baka: '',
  'Old City': '',
  'Yemin Moshe': '',
  Talpiot: '',
  Ramot: '',
  'Ramat Eshkol': '',
  'Givat Shaul': '',
}
