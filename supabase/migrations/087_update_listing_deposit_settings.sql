-- 087_update_listing_deposit_settings.sql
--
-- Lets a host set the per-listing deposit + payment schedule from the dashboard.
-- SECURITY DEFINER with an explicit ownership check (direct host_id match OR the
-- split-identity hosts.user_id bridge), and full input validation mirroring the
-- CHECK constraints in 086. Kept as a focused RPC so it does not have to thread
-- through the large listing edit form / its RPCs.

create or replace function public.update_listing_deposit_settings(
  listing_uuid uuid,
  p_deposit_type text,
  p_deposit_value numeric,
  p_balance_due_days integer
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

  update public.listings
  set deposit_type = p_deposit_type,
      deposit_value = round(p_deposit_value, 2),
      balance_due_days_before_checkin = p_balance_due_days
  where id = listing_uuid
  returning * into listing_record;

  return listing_record;
end;
$$;

revoke all on function public.update_listing_deposit_settings(uuid, text, numeric, integer) from public;
grant execute on function public.update_listing_deposit_settings(uuid, text, numeric, integer) to authenticated;
