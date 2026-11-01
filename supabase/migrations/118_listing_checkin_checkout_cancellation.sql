-- 118_listing_checkin_checkout_cancellation.sql
--
-- Per-listing check-in time, check-out time and cancellation policy, set by the
-- host (listing editor / become-a-host) or an admin, and shown on the listing page.
-- host_applications is the copy table published into listings on approval
-- (approveAndPublishApplication in app/admin/application-actions.ts), so both get
-- the same columns, as in migration 045.
--
-- All columns are nullable. NULL means "not set". For cancellation_policy, NULL
-- means terms are agreed with the host per booking (the rule before this
-- migration). The presets' wording lives in lib/stay-terms.ts.
--
-- The app tolerates this migration not having been run: it reads these columns
-- separately and retries writes without them on 42703 / PGRST204.

alter table public.listings
  add column if not exists check_in_time time,
  add column if not exists check_out_time time,
  add column if not exists cancellation_policy text
    check (cancellation_policy in ('flexible', 'moderate', 'strict', 'non_refundable')),
  add column if not exists cancellation_policy_notes text;

alter table public.host_applications
  add column if not exists check_in_time time,
  add column if not exists check_out_time time,
  add column if not exists cancellation_policy text
    check (cancellation_policy in ('flexible', 'moderate', 'strict', 'non_refundable')),
  add column if not exists cancellation_policy_notes text;

comment on column public.listings.check_in_time is
  'Earliest check-in time (local Jerusalem time). NULL = not set.';
comment on column public.listings.check_out_time is
  'Latest check-out time (local Jerusalem time). NULL = not set.';
comment on column public.listings.cancellation_policy is
  'Cancellation preset: flexible (full refund up to 24h before check-in), moderate (full refund up to 5 days before), strict (50% refund up to 7 days before), non_refundable. NULL = agreed with the host per booking.';
comment on column public.listings.cancellation_policy_notes is
  'Optional host notes shown under the cancellation policy on the listing page.';

comment on column public.host_applications.check_in_time is
  'Earliest check-in time, copied into listings.check_in_time on approval. NULL = not set.';
comment on column public.host_applications.check_out_time is
  'Latest check-out time, copied into listings.check_out_time on approval. NULL = not set.';
comment on column public.host_applications.cancellation_policy is
  'Cancellation preset (see listings.cancellation_policy), copied into listings on approval. NULL = agreed with the host per booking.';
comment on column public.host_applications.cancellation_policy_notes is
  'Optional cancellation notes, copied into listings on approval.';

notify pgrst, 'reload schema';
