alter table public.listings
add column if not exists external_calendar_url text,
add column if not exists calendar_last_synced_at timestamptz;

alter table public.listing_unavailable_ranges
add column if not exists source text default 'manual';

create index if not exists listing_unavailable_ranges_external_source_idx
  on public.listing_unavailable_ranges (listing_id, source);
