import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type ListingRow = {
  id: string
  host_id: string | null
  external_calendar_url: string | null
}

type BlockedRange = {
  start: string
  end: string
}

function parseICSDate(value: string): string {
  const clean = value.replace(/T.*$/, '').trim()
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }
  return clean
}

function unfoldICS(icsText: string) {
  return icsText.replace(/\r?\n[ \t]/g, '')
}

function parseICSBlocks(icsText: string): BlockedRange[] {
  const blocks: BlockedRange[] = []
  const events = unfoldICS(icsText).split('BEGIN:VEVENT')

  for (const event of events.slice(1)) {
    const startMatch = event.match(/DTSTART[^:]*:(\S+)/)
    const endMatch = event.match(/DTEND[^:]*:(\S+)/)
    const statusMatch = event.match(/STATUS:(\w+)/)

    if (statusMatch?.[1] === 'CANCELLED') continue

    if (startMatch?.[1] && endMatch?.[1]) {
      blocks.push({
        start: parseICSDate(startMatch[1]),
        end: parseICSDate(endMatch[1]),
      })
    }
  }

  return blocks
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase environment variables' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: listings } = await supabase
    .from('listings')
    .select('id, host_id, external_calendar_url')
    .eq('is_published', true)
    .not('external_calendar_url', 'is', null)

  let synced = 0

  for (const listing of (listings || []) as ListingRow[]) {
    if (!listing.external_calendar_url || !listing.host_id) continue

    try {
      const response = await fetch(listing.external_calendar_url, {
        headers: { 'User-Agent': 'JLM-Collective-CalSync/1.0' },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        throw new Error(`Calendar fetch failed: ${response.status}`)
      }

      const icsText = await response.text()
      const blocks = parseICSBlocks(icsText)

      await supabase
        .from('listing_unavailable_ranges')
        .delete()
        .eq('listing_id', listing.id)
        .eq('source', 'external_calendar')

      if (blocks.length > 0) {
        const rows = blocks.map((block) => ({
          listing_id: listing.id,
          host_id: listing.host_id,
          start_date: block.start,
          end_date: block.end,
          reason: 'External calendar',
          source: 'external_calendar',
        }))

        await supabase.from('listing_unavailable_ranges').insert(rows)
      }

      await supabase
        .from('listings')
        .update({ calendar_last_synced_at: new Date().toISOString() })
        .eq('id', listing.id)

      synced += 1
    } catch (error) {
      console.error('Sync failed for', listing.id, error)
    }
  }

  return new Response(JSON.stringify({ synced }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
