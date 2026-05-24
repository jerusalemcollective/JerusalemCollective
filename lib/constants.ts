export const ADMIN_ROLES = [
  'owner',
  'operations',
  'support',
  'content',
  'analyst',
  'none',
] as const

export type AdminRole =
  typeof ADMIN_ROLES[number]

export const SUPPORT_CASE_STATUSES = [
  'open',
  'under_review',
  'waiting_on_guest',
  'waiting_on_host',
  'resolved',
  'closed',
] as const

export type SupportCaseStatus =
  typeof SUPPORT_CASE_STATUSES[number]

export const APPLICATION_STATUSES = [
  'new',
  'in_review',
  'changes_requested',
  'approved',
  'rejected',
] as const

export type ApplicationStatus =
  typeof APPLICATION_STATUSES[number]

export const BOOKING_REQUEST_STATUSES = [
  'new',
  'host_replied',
  'accepted',
  'declined',
  'closed',
] as const

export type BookingRequestStatus =
  typeof BOOKING_REQUEST_STATUSES[number]

export type ShulCoordinates = {
  name: string
  lat: number
  lng: number
  neighbourhoods: string[]
}

export const SHUL_COORDINATES: ShulCoordinates[] = [
  {
    name: 'Gur (Yirmiyahu)',
    lat: 31.7927,
    lng: 35.2108,
    neighbourhoods: [
      'Romema',
      'Geula',
      'Mekor Baruch',
      'Gush 80',
    ],
  },
  {
    name: 'Belz',
    lat: 31.7971,
    lng: 35.2073,
    neighbourhoods: [
      'Romema',
      'Kiryat Belz',
      'Givat Shaul',
      'Sorotzkin',
      'Mattersdorf',
    ],
  },
  {
    name: 'Yeshivas Mir',
    lat: 31.7885,
    lng: 35.2239,
    neighbourhoods: [
      'Beit Yisrael',
      'Geula',
      'Mekor Baruch',
      'Sanhedria',
      'Ramat Eshkol',
    ],
  },
  {
    name: 'Boyan',
    lat: 31.7883,
    lng: 35.2128,
    neighbourhoods: [
      'Geula',
      'Mekor Baruch',
      'Romema',
      'Gush 80',
    ],
  },
  {
    name: 'Kotel',
    lat: 31.7767,
    lng: 35.2345,
    neighbourhoods: [
      'Old City',
      'Yemin Moshe',
      'Rechavia',
      'German Colony',
      'Katamon',
      'Baka',
    ],
  },
  {
    name: 'Beit Knesset HaGadol',
    lat: 31.7758,
    lng: 35.2169,
    neighbourhoods: [
      'Rechavia',
      'Shaarei Chesed',
    ],
  },
  {
    name: 'Beit Knesset HaGra',
    lat: 31.77748,
    lng: 35.2115,
    neighbourhoods: [
      'Rechavia',
      'Shaarei Chesed',
    ],
  },
]

export function getShulsForNeighbourhood(
  area: string,
): ShulCoordinates[] {
  return SHUL_COORDINATES.filter((shul) =>
    shul.neighbourhoods.includes(area),
  )
}
