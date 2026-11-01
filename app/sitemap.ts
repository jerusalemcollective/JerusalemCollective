import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { allNeighborhoods } from '@/lib/neighborhoods'
import { slugifyNeighborhood, neighborhoodDescriptions } from '@/lib/neighborhood-pages'
import { stayCollectionSlugs } from '@/lib/stay-collections'

const siteUrl = 'https://jlmcollective.co'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/stays`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...stayCollectionSlugs.map((slug) => ({
      url: `${siteUrl}/stays/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.75,
    })),
    {
      url: `${siteUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/neighbourhoods`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/how-it-works`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${siteUrl}/services`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${siteUrl}/services/catering`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/services/cleaning`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/map`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/become-a-host`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/trust-and-safety`,
      lastModified: new Date('2026-05-15'),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: new Date('2026-05-18'),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: new Date('2026-05-15'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
  // Only list neighbourhood pages with editorial content OR live inventory —
  // empty ones are thin pages that waste crawl budget.
  const neighborhoodEntry = (name: string): MetadataRoute.Sitemap[number] => ({
    url: `${siteUrl}/neighbourhoods/${slugifyNeighborhood(name)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  })

  try {
    const supabase = await createClient()
    const { data: listings } = await supabase
      .from('listings')
      .select('id, area, host_id, updated_at')
      .eq('is_published', true)

    const areasWithListings = new Set((listings || []).map((listing) => listing.area))
    const neighborhoodPages: MetadataRoute.Sitemap = allNeighborhoods
      .filter((name) => Boolean(neighborhoodDescriptions[name]) || areasWithListings.has(name))
      .map(neighborhoodEntry)

    const listingPages: MetadataRoute.Sitemap = (listings || []).map((listing) => ({
      url: `${siteUrl}/listings/${listing.id}`,
      lastModified: listing.updated_at ? new Date(listing.updated_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    // Every host with a published stay has a public profile worth indexing —
    // not only ID-verified ones. lastModified is their most recent stay update.
    const hostLastModified = new Map<string, Date>()
    for (const listing of listings || []) {
      if (!listing.host_id) continue
      const updated = listing.updated_at ? new Date(listing.updated_at) : new Date()
      const current = hostLastModified.get(listing.host_id)
      if (!current || updated > current) hostLastModified.set(listing.host_id, updated)
    }
    const hostPages: MetadataRoute.Sitemap = Array.from(hostLastModified, ([hostId, lastModified]) => ({
      url: `${siteUrl}/hosts/${hostId}`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    }))

    return [...staticPages, ...neighborhoodPages, ...listingPages, ...hostPages]
  } catch {
    const neighborhoodPages: MetadataRoute.Sitemap = allNeighborhoods
      .filter((name) => Boolean(neighborhoodDescriptions[name]))
      .map(neighborhoodEntry)
    return [...staticPages, ...neighborhoodPages]
  }
}
