import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the Turbopack workspace root — this project sits in a nested folder
  // layout that otherwise makes Turbopack infer the wrong root. Resolves to the
  // project directory (what Vercel uses anyway), so it's deploy-neutral.
  turbopack: {
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
  compress: true,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/(.*)\\.(webp|png|jpg|jpeg|svg|ico|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  experimental: {
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
  },
}

export default nextConfig
