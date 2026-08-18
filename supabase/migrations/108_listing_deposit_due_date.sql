-- 108_listing_deposit_due_date.sql
--
-- Adds an optional "deposit due" date to the per-listing schedule so a DIRECT
-- (host-paid) booking's deposit can fall due a set number of days before check-in,
-- not only at booking. NULL keeps today's behaviour: the deposit is due at booking.
--
-- JLM/Stripe bookings always charge the deposit at booking (create_pending_booking_
-- payment is unchanged), so they ignore this column; it only governs direct bookings.
-- Idempotent / re-runnable; paste into the Supabase SQL editor as the owner role.

alter table public.listings
  add column if not exists deposit_due_days_before_checkin integer;

comment on column public.listings.deposit_due_days_before_checkin is
  'Direct bookings only: days before check-in the deposit is due. NULL = due at booking. JLM/Stripe bookings charge the deposit at booking regardless.';

-- Replace the deposit-settings RPC with a version that also takes the deposit-due
-- days. The new arg is defaulted so an old 4-arg call still resolves during the
-- paste-then-deploy window (drop the 4-arg first so the call is unambiguous).
drop function if exists public.update_listing_deposit_settings(uuid, text, numeric, integer);

create or replace function public.update_listing_deposit_settings(
  listing_uuid uuid,
  p_deposit_type text,
  p_deposit_value numeric,
  p_balance_due_days integer,
  p_deposit_due_days integer default null
)
returns public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  listing_record public.listings%rowtype;
begin
  if current_user_id is null then
    raise exception 'Please sign in.';
  end if;

  select * into listing_record from public.listings where id = listing_uuid;
  if listing_record.id is null then
    raise exception 'Listing not found.';
  end if;

  -- Ownership: the listing's host must belong to the caller.
  if not (
    listing_record.host_id = current_user_id
    or exists (
      select 1 from public.hosts h
      where h.id = listing_record.host_id and h.user_id = current_user_id
    )
  ) then
    raise exception 'You do not have permission to edit this listing.';
  end if;

  if p_deposit_type is null or p_deposit_type not in ('percent', 'fixed') then
    raise exception 'Deposit type must be percent or fixed.';
  end if;
  if p_deposit_value is null or p_deposit_value <= 0 then
    raise exception 'Deposit must be greater than zero.';
  end if;
  if p_deposit_type = 'percent' and p_deposit_value > 100 then
    raise exception 'A percentage deposit cannot be more than 100%%.';
  end if;
  if p_balance_due_days is null or p_balance_due_days < 0 or p_balance_due_days > 365 then
    raise exception 'Balance due days must be between 0 and 365.';
  end if;
  if p_deposit_due_days is not null and (p_deposit_due_days < 0 or p_deposit_due_days > 365) then
    raise exception 'Deposit due days must be between 0 and 365.';
  end if;

  update public.listings
  set deposit_type = p_deposit_type,
      deposit_value = round(p_deposit_value, 2),
      balance_due_days_before_checkin = p_balance_due_days,
      deposit_due_days_before_checkin = p_deposit_due_days
  where id = listing_uuid
  returning * into listing_record;

  return listing_record;
end;
$$;

revoke all on function public.update_listing_deposit_settings(uuid, text, numeric, integer, integer) from public;
grant execute on function public.update_listing_deposit_settings(uuid, text, numeric, integer, integer) to authenticated;

notify pgrst, 'reload schema';
