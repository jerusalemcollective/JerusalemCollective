-- 075_performance_indexes_and_read_at.sql
--
-- Additive and zero-risk (nothing dropped or destructively altered).
--
-- 1. Indexes on the hottest query filters (audit H7). These joins/filters run on
--    every listing card render and on the host dashboard; unindexed they are
--    sequential scans that get slow as the tables grow.
-- 2. messages.read_at — migration 043 (never applied to prod) was meant to add
--    this. The inbox already writes read_at (with a fallback), so once the
--    column exists, read-receipt timestamps persist (audit M12).

create index if not exists listings_published_featured_idx
  on public.listings (is_published, is_featured);

create index if not exists listings_published_area_idx
  on public.listings (is_published, area);

create index if not exists listing_photos_listing_id_idx
  on public.listing_photos (listing_id);

create index if not exists reviews_listing_id_idx
  on public.reviews (listing_id);

create index if not exists bookings_host_id_idx
  on public.bookings (host_id);

create index if not exists bookings_user_listing_idx
  on public.bookings (user_id, listing_id);

alter table public.messages
  add column if not exists read_at timestamptz;
