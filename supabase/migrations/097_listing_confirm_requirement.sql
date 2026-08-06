-- 097_listing_confirm_requirement.sql
--
-- Per-listing rule for what confirms a booking when a host accepts a request:
--   'on_accept' (default) -> accepting the request confirms the booking and
--                            blocks the calendar immediately (today's behaviour).
--   'deposit'             -> accepting marks the booking as awaiting a deposit
--                            (status stays 'pending', calendar NOT blocked); the
--                            host confirms it later by marking the deposit received.
-- Used by the request-accept flow (see the update to update_booking_request_status).

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS confirm_requirement text NOT NULL DEFAULT 'on_accept';

ALTER TABLE listings
  DROP CONSTRAINT IF EXISTS listings_confirm_requirement_check;

ALTER TABLE listings
  ADD CONSTRAINT listings_confirm_requirement_check
  CHECK (confirm_requirement IN ('on_accept', 'deposit'));
