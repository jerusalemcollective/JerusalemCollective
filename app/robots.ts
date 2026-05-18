import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account/',
        '/admin/',
        '/auth/',
        '/forgot-password',
        '/host/dashboard/',
        '/host/login',
        '/host/register',
        '/login',
        '/register',
        '/saved',
        '/update-password',
      ],
    },
    sitemap: 'https://jlmcollective.co/sitemap.xml',
    host: 'https://jlmcollective.co',
  }
}
