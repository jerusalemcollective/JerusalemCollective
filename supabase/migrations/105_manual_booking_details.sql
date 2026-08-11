-- Manual (off-platform) bookings can record the same guest details a
-- self-booking captures — not just a name. Manual bookings are stored as
-- listing_unavailable_ranges rows (source='manual_booking'), so these columns
-- live there. All nullable, so existing rows and plain date-blocks are
-- unaffected.

alter table public.listing_unavailable_ranges
  add column if not exists guest_name text,
  add column if not exists guest_count integer,
  add column if not exists guest_email text,
  add column if not exists guest_phone text,
  add column if not exists notes text;
