import type { SupabaseClient } from '@supabase/supabase-js'

type BlockedRange = {
  start: string
  end: string
}

type ListingHostRow = {
  host_id: string | null
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

export function parseICSBlocks(icsText: string): BlockedRange[] {
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

export async function syncExternalCalendar(
  supabase: SupabaseClient,
  listingId: string,
  calendarUrl: string,
): Promise<void> {
  try {
    const response = await fetch(calendarUrl, {
      headers: { 'User-Agent': 'JLM-Collective-CalSync/1.0' },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`Calendar fetch failed: ${response.status}`)
    }

    const [{ data: listing }, icsText] = await Promise.all([
      supabase.from('listings').select('host_id').eq('id', listingId).single(),
      response.text(),
    ])
    const hostId = (listing as ListingHostRow | null)?.host_id

    if (!hostId) {
      throw new Error('Listing host was not found.')
    }

    const blocks = parseICSBlocks(icsText)

    await supabase
      .from('listing_unavailable_ranges')
      .delete()
      .eq('listing_id', listingId)
      .eq('source', 'external_calendar')

    if (blocks.length > 0) {
      const rows = blocks.map((block) => ({
        listing_id: listingId,
        host_id: hostId,
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
      .eq('id', listingId)
  } catch (error) {
    console.error('Calendar sync failed for listing', listingId, error)
  }
}
