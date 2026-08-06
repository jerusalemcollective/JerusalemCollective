-- 093_manual_booking_source.sql
--
-- Let the host/admin record an off-platform ("manual") booking on the calendar,
-- distinct from a plain date block. A manual booking blocks the dates like any
-- other unavailable range but is a separate source so the calendar can colour it
-- as a booking (green) with the guest's name, versus a grey "blocked" range.
--
-- bookings.user_id is NOT NULL (references a real profile), so a manual booking
-- for a non-registered guest is recorded as a listing_unavailable_ranges row,
-- not a bookings row.

alter table public.listing_unavailable_ranges
  drop constraint if exists listing_unavailable_ranges_source_check;

alter table public.listing_unavailable_ranges
  add constraint listing_unavailable_ranges_source_check
  check (source in ('manual', 'external_calendar', 'booking', 'manual_booking')) not valid;
