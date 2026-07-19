import type { SupabaseClient } from '@supabase/supabase-js'

// NOTE: The ICS parsing logic in this file is intentionally duplicated in
// supabase/functions/sync-external-calendars/index.ts (and vice versa).
// Edge Functions cannot import from lib/ so both must be kept in sync manually.
// If you fix a parsing bug here, apply the same fix to the other file.

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

    const icsText = await response.text()

    const blocks = parseICSBlocks(icsText)

    await supabase
      .from('listing_unavailable_ranges')
      .delete()
      .eq('listing_id', listingId)
      .eq('source', 'external_calendar')

    if (blocks.length > 0) {
      // host_id is NOT NULL on this table. Omitting it made every insert fail
      // on the constraint, so a sync would clear the old blocks and import
      // nothing. The sync-external-calendars Edge Function always set it; this
      // copy had drifted.
      const { data: listingRow } = await supabase
        .from('listings')
        .select('host_id')
        .eq('id', listingId)
        .maybeSingle<{ host_id: string | null }>()

      if (!listingRow?.host_id) {
        throw new Error(`Listing ${listingId} has no host_id; cannot import calendar blocks`)
      }

      const rows = blocks.map((block) => ({
        listing_id: listingId,
        host_id: listingRow.host_id,
        start_date: block.start,
        end_date: block.end,
        reason: 'External calendar',
        source: 'external_calendar',
      }))

      const { error: insertError } = await supabase
        .from('listing_unavailable_ranges')
        .insert(rows)

      if (insertError) {
        throw insertError
      }
    }

    await supabase
      .from('listings')
      .update({ calendar_last_synced_at: new Date().toISOString() })
      .eq('id', listingId)
  } catch (error) {
    console.error('Calendar sync failed for listing', listingId, error)
  }
}
