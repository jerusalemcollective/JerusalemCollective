import { ImageResponse } from 'next/og'

// Edge runtime + the built-in font: the canonical, dependency-free way to
// generate an Open Graph card. Output is PNG, which every scraper (WhatsApp,
// Facebook, iMessage, X) renders reliably — unlike the .webp logo we used to
// fall back to, which many of them silently drop.
export const runtime = 'edge'

const CREAM = '#F8F5F2'
const INK = '#252525'
const TERRACOTTA = '#c76f55'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = (searchParams.get('title') || 'Curated short-term stays in Jerusalem')
    .slice(0, 110)
  const eyebrow = (searchParams.get('eyebrow') || 'JLM Collective').slice(0, 48)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: CREAM,
          padding: '76px 84px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Eyebrow: terracotta dot + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 22,
              backgroundColor: TERRACOTTA,
              marginRight: 20,
            }}
          />
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: INK,
            }}
          >
            {eyebrow}
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            fontSize: 74,
            lineHeight: 1.08,
            fontWeight: 800,
            color: INK,
            maxWidth: 960,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>

        {/* Footer: accent bar + domain */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 96,
              height: 8,
              borderRadius: 8,
              backgroundColor: TERRACOTTA,
              marginRight: 28,
            }}
          />
          <div style={{ fontSize: 28, fontWeight: 600, color: TERRACOTTA }}>
            jlmcollective.co
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Scrapers fetch this once and cache; let the CDN hold it too.
        'cache-control': 'public, max-age=86400, s-maxage=604800, immutable',
      },
    },
  )
}
