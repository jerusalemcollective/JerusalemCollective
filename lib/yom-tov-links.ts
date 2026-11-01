// Short nav labels for the seasonal + kosher collections (/stays/<slug>), kept
// separate from lib/stay-collections so client components (header) stay light.
export const YOM_TOV_LINKS = [
  { href: '/stays/pesach', label: 'Pesach' },
  { href: '/stays/sukkot', label: 'Sukkot' },
  { href: '/stays/kosher-kitchen', label: 'Kosher kitchen' },
] as const
