-- 123_cancellation_rule_and_application_deposit.sql
--
-- 1. Cancellation becomes one rule the host sets: free cancellation until N days
--    before check-in, then the host keeps the deposit or everything paid so far.
--    It replaces the fixed presets (flexible / moderate / strict / non-refundable)
--    and the "agreed per booking" option. cancellation_policy stays for now so
--    older code and rows keep working; the editors write NULL there from now on.
--
-- 2. host_applications gets the deposit schedule columns listings already has
--    (086, 108), so the become-a-host wizard asks for the deposit and approval
--    copies it into the listing (approveAndPublishApplication).
--
-- 3. A host's currency lives on their profile (profiles.preferred_currency).
--    Hosts who already have listings get their profile currency set to the
--    currency of their most recent listing, so nothing changes for them.
--
-- The app tolerates this migration not having been run yet: writes retry
-- without the new columns (lib/stay-terms.ts writeWithStayTermsFallback).

alter table public.listings
  add column if not exists cancellation_free_days integer
    check (cancellation_free_days between 0 and 365),
  add column if not exists cancellation_keep text
    check (cancellation_keep in ('deposit', 'all'));

alter table public.host_applications
  add column if not exists cancellation_free_days integer
    check (cancellation_free_days between 0 and 365),
  add column if not exists cancellation_keep text
    check (cancellation_keep in ('deposit', 'all')),
  add column if not exists deposit_type text
    check (deposit_type in ('percent', 'fixed')),
  add column if not exists deposit_value numeric
    check (deposit_value > 0),
  add column if not exists deposit_due_days_before_checkin integer
    check (deposit_due_days_before_checkin between 0 and 365),
  add column if not exists balance_due_days_before_checkin integer
    check (balance_due_days_before_checkin between 0 and 365);

comment on column public.listings.cancellation_free_days is
  'Guests can cancel for free until this many days before check-in. 0 = no free cancellation. NULL = not set.';
comment on column public.listings.cancellation_keep is
  'After the free-cancellation window: deposit = host keeps the deposit, all = host keeps everything paid so far.';
comment on column public.host_applications.cancellation_free_days is
  'See listings.cancellation_free_days. Copied into the listing on approval.';
comment on column public.host_applications.cancellation_keep is
  'See listings.cancellation_keep. Copied into the listing on approval.';
comment on column public.host_applications.deposit_type is
  'See listings.deposit_type. Copied into the listing on approval. NULL = listing default.';

-- Existing presets as the equivalent rule. Strict (50% refund up to 7 days) has
-- no exact match; the closest is free until 7 days, then the host keeps what was paid.
update public.listings
set cancellation_free_days = case cancellation_policy
      when 'flexible' then 1
      when 'moderate' then 5
      when 'strict' then 7
      when 'non_refundable' then 0
    end,
    cancellation_keep = 'all'
where cancellation_free_days is null
  and cancellation_policy in ('flexible', 'moderate', 'strict', 'non_refundable');

update public.host_applications
set cancellation_free_days = case cancellation_policy
      when 'flexible' then 1
      when 'moderate' then 5
      when 'strict' then 7
      when 'non_refundable' then 0
    end,
    cancellation_keep = 'all'
where cancellation_free_days is null
  and cancellation_policy in ('flexible', 'moderate', 'strict', 'non_refundable');

-- Profile currency for hosts = currency of their most recent listing.
-- listings.host_id is either the hosts.id or the user id (see lib/host-dashboard).
update public.profiles p
set preferred_currency = src.currency
from (
  select distinct on (coalesce(h.user_id, l.host_id))
    coalesce(h.user_id, l.host_id) as profile_id,
    l.price_currency as currency
  from public.listings l
  left join public.hosts h on h.id = l.host_id
  where l.price_currency in ('ILS', 'USD', 'GBP', 'EUR', 'CAD', 'CHF', 'AUD')
  order by coalesce(h.user_id, l.host_id), l.created_at desc nulls last
) src
where p.id = src.profile_id;

notify pgrst, 'reload schema';
