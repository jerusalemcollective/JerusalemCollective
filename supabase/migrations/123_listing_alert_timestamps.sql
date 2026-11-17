-- 123_listing_alert_timestamps.sql
--
-- Keeps the "host changed their listing" emails to listings@jlmcollective.co
-- from flooding the inbox:
--   * at most one "changed details" email per listing every 15 minutes
--     (changes made in between are kept in edit_alert_pending and included
--     in the next email), and
--   * at most one "changed photos" email per listing every hour.
--
-- A separate table, not new listings columns: published listings are readable
-- column-by-column through the public API, and this is internal bookkeeping.
-- RLS is on with no policies, so only the server (service role) can use it.
--
-- Idempotent: safe to run more than once. Until it has been run the app still
-- sends the emails, rate-limited per server instance only (best effort).

create table if not exists public.listing_alert_state (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  edit_alert_sent_at timestamptz,
  edit_alert_pending jsonb,
  photos_alert_sent_at timestamptz
);

alter table public.listing_alert_state enable row level security;

revoke all on table public.listing_alert_state from anon, authenticated;
grant select, insert, update, delete on table public.listing_alert_state to service_role;
