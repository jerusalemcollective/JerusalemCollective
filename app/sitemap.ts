import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

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

  try {
    const supabase = await createClient()
    const [{ data: listings }, { data: hosts }] = await Promise.all([
      supabase
        .from('listings')
        .select('id, updated_at')
        .eq('is_published', true),
      supabase
        .from('hosts')
        .select('id, updated_at')
        .eq('is_verified', true),
    ])

    const listingPages: MetadataRoute.Sitemap = (listings || []).map((listing) => ({
      url: `${siteUrl}/listings/${listing.id}`,
      lastModified: listing.updated_at ? new Date(listing.updated_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

    const hostPages: MetadataRoute.Sitemap = (hosts || []).map((host) => ({
      url: `${siteUrl}/hosts/${host.id}`,
      lastModified: host.updated_at ? new Date(host.updated_at) : new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    }))

    return [...staticPages, ...listingPages, ...hostPages]
  } catch {
    return staticPages
  }
}
