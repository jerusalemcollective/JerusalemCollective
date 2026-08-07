-- 102_stripe_connect_phase1.sql
-- Phase 1 of self-serve Stripe Connect (Express). NO money moves here: hosts
-- create/continue an Express account and we reflect Stripe's readiness flags.
-- host_payment_profiles already carries stripe_account_id, payout_setup_status,
-- stripe_charges_enabled, stripe_payouts_enabled (migration 010) with the
-- split-identity RLS bridge (020). This migration only (a) adds a details flag +
-- a connect timestamp, (b) makes stripe_account_id unique so account.updated maps
-- to exactly one host, and (c) freezes the Stripe-controlled columns against
-- direct end-user writes. Idempotent; safe to run as-is.

alter table public.host_payment_profiles
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_connect_updated_at timestamptz;

-- One Stripe account maps to at most one host row. Partial: rows are NULL before
-- onboarding and NULLs must not collide.
create unique index if not exists host_payment_profiles_stripe_account_id_key
  on public.host_payment_profiles (stripe_account_id)
  where stripe_account_id is not null;

-- Freeze Stripe-controlled columns for authenticated (end-user) writes. RLS (020)
-- lets a host update/insert their own row, which would otherwise let them set
-- stripe_account_id/flags from the browser and hijack another host's onboarding.
-- Only the service role (auth.uid() IS NULL: webhook + onboarding route) may set
-- them. The host preference RPC never touches these columns, so it is unaffected.
create or replace function public.prevent_host_stripe_columns_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new; -- service role: onboarding route + webhook
  end if;

  if tg_op = 'INSERT' then
    if new.stripe_account_id is not null
       or new.stripe_charges_enabled is distinct from false
       or new.stripe_payouts_enabled is distinct from false
       or new.stripe_details_submitted is distinct from false
       or new.payout_setup_status is distinct from 'not_started' then
      raise exception 'Stripe account status is managed by JLM Collective and cannot be set directly';
    end if;
    return new;
  end if;

  if new.stripe_account_id is distinct from old.stripe_account_id
     or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
     or new.stripe_payouts_enabled is distinct from old.stripe_payouts_enabled
     or new.payout_setup_status is distinct from old.payout_setup_status
     or new.stripe_details_submitted is distinct from old.stripe_details_submitted then
    raise exception 'Stripe account status is managed by JLM Collective and cannot be edited directly';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_host_stripe_columns on public.host_payment_profiles;
create trigger protect_host_stripe_columns
before insert or update on public.host_payment_profiles
for each row
execute function public.prevent_host_stripe_columns_change();
