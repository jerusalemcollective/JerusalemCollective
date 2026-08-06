// Indexable landing pages for the highest-intent Jerusalem-stay searches
// (seasonal + kosher). Each renders unique copy + a filtered listing grid + FAQ
// at /stays/<slug>, so these queries can rank instead of bouncing to /stays.

export type StayCollection = {
  slug: string
  h1: string
  eyebrow: string
  metaTitle: string
  metaDescription: string
  intro: string[]
  // Optional server-side filter applied to the listing query.
  filter?: 'kosher' | 'sukkah'
  faqs: { q: string; a: string }[]
}

export const stayCollections: Record<string, StayCollection> = {
  pesach: {
    slug: 'pesach',
    eyebrow: 'Seasonal',
    h1: 'Pesach apartments in Jerusalem',
    metaTitle: 'Pesach Apartments in Jerusalem | JLM Collective',
    metaDescription:
      'Verified, personally reviewed apartments in Jerusalem for Pesach — kosher kitchens, walking distance to shuls and the Kotel. Book early.',
    intro: [
      'Spending Pesach in Jerusalem is one of the most sought-after times of the year, and the best apartments go months in advance. JLM Collective curates a hand-picked collection of stays across the city — Rechavia, the German Colony, Old Katamon, Nachlaot and more — each personally reviewed before we agree to represent it.',
      'Every listing shows its kosher-kitchen level, its walking time to the Kotel and nearby shuls, and practical details that matter over Yom Tov, from a Shabbat elevator to a balcony that can take a sukkah later in the year. Message the host directly, with no commitment, to confirm availability for your dates.',
      'Because Pesach demand is so concentrated, we recommend enquiring early — the apartments that suit a full family for the chag are the first to be taken.',
    ],
    faqs: [
      {
        q: 'When should I book a Pesach apartment in Jerusalem?',
        a: 'As early as you can. The larger, well-located apartments for Pesach are typically taken months ahead, so enquire as soon as your dates are set.',
      },
      {
        q: 'Are the kitchens kosher for Pesach?',
        a: 'Each listing shows its kosher-kitchen level. Kashering for Pesach is arranged with the host — message them to confirm exactly what is provided and what you should bring.',
      },
      {
        q: 'How close are the apartments to shuls and the Kotel?',
        a: 'Listings show an approximate walking time to the Kotel and to nearby shuls, so you can pick a stay within comfortable walking distance for the whole chag.',
      },
    ],
  },
  sukkot: {
    slug: 'sukkot',
    eyebrow: 'Seasonal',
    h1: 'Sukkot rentals in Jerusalem with a sukkah',
    metaTitle: 'Sukkot Apartments in Jerusalem (with a sukkah) | JLM Collective',
    metaDescription:
      'Curated Jerusalem apartments for Sukkot with a balcony or space suitable for a sukkah, kosher kitchens, and walking distance to shuls.',
    filter: 'sukkah',
    intro: [
      'Being in Jerusalem for Sukkot means eating and often sleeping in the sukkah, so a suitable balcony or outdoor space is everything. This collection features JLM Collective stays that have a balcony suitable for a sukkah, across the neighbourhoods families come back to year after year.',
      'Each apartment is personally reviewed and shows its kosher-kitchen level and its walking time to the Kotel and local shuls. Message the host to confirm the sukkah arrangement — whether one is provided or you are welcome to build — before you commit.',
      'Sukkot apartments with a proper sukkah space are limited and in high demand, so it is worth enquiring well ahead of the chag.',
    ],
    faqs: [
      {
        q: 'Do these apartments come with a sukkah?',
        a: 'This collection is filtered to stays with a balcony or space suitable for a sukkah. Whether a sukkah is already built or you are welcome to put one up varies by host — message them to confirm.',
      },
      {
        q: 'Are the apartments within walking distance of shuls?',
        a: 'Yes — every listing shows an approximate walking time to nearby shuls and to the Kotel so you can stay within comfortable walking distance for Yom Tov.',
      },
      {
        q: 'How far in advance should I book for Sukkot?',
        a: 'Sukkot stays with a good sukkah space are limited, so enquire as early as your dates allow.',
      },
    ],
  },
  'kosher-kitchen': {
    slug: 'kosher-kitchen',
    eyebrow: 'By feature',
    h1: 'Jerusalem apartments with a kosher kitchen',
    metaTitle: 'Jerusalem Apartments with a Kosher Kitchen | JLM Collective',
    metaDescription:
      'Verified Jerusalem short-term stays with kosher kitchens — kosher, glatt and Chalav Yisrael options — walking distance to shuls and the Kotel.',
    filter: 'kosher',
    intro: [
      'A kosher kitchen you can rely on is the difference between a relaxed stay and a stressful one. This collection features JLM Collective apartments with kosher kitchens across Jerusalem, from kosher to glatt and Chalav Yisrael, each personally reviewed before it goes live.',
      'Every listing shows its kosher-kitchen level clearly, along with its walking time to the Kotel and nearby shuls and the practical details that matter — a Shabbat elevator, a Shabbat clock, and more. Message the host directly to confirm exactly what the kitchen includes.',
      'Whether you are visiting for a simcha, a chag, or a longer stay, these are homes where you can cook and eat with confidence.',
    ],
    faqs: [
      {
        q: 'What kosher-kitchen levels are available?',
        a: 'Listings range from kosher to glatt kosher and Chalav Yisrael / Mehadrin. Each stay shows its level, and you can message the host to confirm the specifics.',
      },
      {
        q: 'Can I confirm the kitchen details before booking?',
        a: 'Yes — message the host for free with any questions about the kitchen, appliances, and what is provided, before you commit to anything.',
      },
      {
        q: 'Are the apartments close to shuls?',
        a: 'Each listing shows an approximate walking time to nearby shuls and the Kotel so you can choose one within comfortable walking distance.',
      },
    ],
  },
}

export function findStayCollection(slug: string): StayCollection | null {
  return stayCollections[slug] || null
}

export const stayCollectionSlugs = Object.keys(stayCollections)
