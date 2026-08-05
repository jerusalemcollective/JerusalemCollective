-- 080_unavailable_ranges_source_check.sql
--
-- Audit data-integrity (low). listing_unavailable_ranges.source is a free-text
-- column but only three values are meaningful ('manual', 'external_calendar',
-- 'booking'), and cancel_guest_booking / the finalize functions key off
-- source = 'booking'. A typo'd source would silently break calendar cleanup.
-- Add a CHECK. NOT VALID so it enforces new rows without failing on any
-- unexpected existing value (safe on live data); validate later if desired.

alter table public.listing_unavailable_ranges
  drop constraint if exists listing_unavailable_ranges_source_check;

alter table public.listing_unavailable_ranges
  add constraint listing_unavailable_ranges_source_check
  check (source in ('manual', 'external_calendar', 'booking')) not valid;
