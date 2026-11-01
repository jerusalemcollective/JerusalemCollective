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

// kosher_kitchen_level values that count as a kosher kitchen for the
// 'kosher' collection filter. 'mehadrin' is what the host editor saves today
// (allowed by migration 119); the others are older values.
export const KOSHER_COLLECTION_LEVELS = ['kosher', 'mehadrin', 'glatt_kosher', 'chalav_yisrael']

export const stayCollections: Record<string, StayCollection> = {
  pesach: {
    slug: 'pesach',
    eyebrow: 'Seasonal',
    h1: 'Pesach apartments in Jerusalem',
    metaTitle: 'Pesach Apartments in Jerusalem | JLM Collective',
    metaDescription:
      'Pesach apartments in Jerusalem, each one checked by our team. See the kosher kitchen level and the walk to shuls and the Kotel. Best booked early.',
    intro: [
      'Pesach is one of the busiest times of year in Jerusalem, and the best apartments are often taken months ahead. We have family stays across the city, in Rechavia, the German Colony, Old Katamon, Nachlaot and more. We look at every one ourselves before it goes on the site.',
      'Each listing shows its kosher kitchen level, the walk to the Kotel and nearby shuls, and the small things that matter over Yom Tov, like a Shabbos elevator. You can message the host to check your dates. Asking doesn\'t commit you to anything.',
      'Because so many families come for Pesach, it\'s worth asking early. The apartments that fit a whole family for the chag go first.',
    ],
    faqs: [
      {
        q: 'When should I book a Pesach apartment in Jerusalem?',
        a: 'As early as you can. The bigger apartments in good spots are usually taken months ahead, so get in touch as soon as you know your dates.',
      },
      {
        q: 'Are the kitchens kosher for Pesach?',
        a: 'Each listing shows its kosher kitchen level. Kashering for Pesach is arranged with the host, so message them to check what\'s provided and what to bring.',
      },
      {
        q: 'How close are the apartments to shuls and the Kotel?',
        a: 'Listings show roughly how long it takes to walk to the Kotel and to nearby shuls. That way you can choose somewhere that\'s an easy walk for the whole chag.',
      },
    ],
  },
  sukkot: {
    slug: 'sukkot',
    eyebrow: 'Seasonal',
    h1: 'Sukkot rentals in Jerusalem with a sukkah',
    metaTitle: 'Sukkot Apartments in Jerusalem (with a sukkah) | JLM Collective',
    metaDescription:
      'Jerusalem apartments for Sukkot with a balcony or space for a sukkah. See the kosher kitchen level and the walk to nearby shuls.',
    filter: 'sukkah',
    intro: [
      'In Jerusalem for Sukkot, you\'ll eat and often sleep in the sukkah, so the right balcony or outdoor space really matters. These stays all have a balcony that can take a sukkah, in the neighbourhoods families come back to year after year.',
      'We look at every apartment ourselves. Each one shows its kosher kitchen level and the walk to the Kotel and local shuls. Before you book, message the host to check the sukkah plan: is one already up, or can you build your own?',
      'There aren\'t many apartments with a proper sukkah space, and lots of families want them. It\'s worth asking well before the chag.',
    ],
    faqs: [
      {
        q: 'Do these apartments come with a sukkah?',
        a: 'Every stay here has a balcony or space that can take a sukkah. Some hosts put one up for you and others are happy for you to build your own, so message the host to check.',
      },
      {
        q: 'Are the apartments within walking distance of shuls?',
        a: 'Yes. Each listing shows roughly how long it takes to walk to nearby shuls and the Kotel, so you can stay within an easy walk for Yom Tov.',
      },
      {
        q: 'How far in advance should I book for Sukkot?',
        a: 'Stays with a good sukkah space are limited, so get in touch as early as your dates allow.',
      },
    ],
  },
  'kosher-kitchen': {
    slug: 'kosher-kitchen',
    eyebrow: 'By feature',
    h1: 'Jerusalem apartments with a kosher kitchen',
    metaTitle: 'Jerusalem Apartments with a Kosher Kitchen | JLM Collective',
    metaDescription:
      'Jerusalem short-term stays with a kosher or kosher mehadrin kitchen, within walking distance of shuls and the Kotel.',
    filter: 'kosher',
    intro: [
      'A kosher kitchen you can trust makes a stay so much easier. These Jerusalem apartments all have one, kosher or kosher mehadrin. We look at each one ourselves before it goes live.',
      'Every listing shows its kosher kitchen level, the walk to the Kotel and nearby shuls, and helpful extras like a Shabbos elevator or Shabbos clock. Message the host to check exactly what the kitchen has.',
      'Whether you\'re coming for a simcha, a chag or a longer stay, these are homes where you can cook and eat with peace of mind.',
    ],
    faqs: [
      {
        q: 'What kosher-kitchen levels are available?',
        a: 'Each stay is either kosher or kosher mehadrin, and the listing shows which. You can message the host to check the details.',
      },
      {
        q: 'Can I confirm the kitchen details before booking?',
        a: 'Yes. Message the host with any questions about the kitchen, the appliances and what\'s provided. It\'s free, and it doesn\'t commit you to anything.',
      },
      {
        q: 'Are the apartments close to shuls?',
        a: 'Each listing shows roughly how long it takes to walk to nearby shuls and the Kotel, so you can pick one that\'s an easy walk.',
      },
    ],
  },
}

export function findStayCollection(slug: string): StayCollection | null {
  return stayCollections[slug] || null
}

export const stayCollectionSlugs = Object.keys(stayCollections)
