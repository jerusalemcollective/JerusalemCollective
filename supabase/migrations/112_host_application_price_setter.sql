-- 112_host_application_price_setter.sql
--
-- host_applications has no "hosts can update own" RLS policy — edits go through
-- SECURITY DEFINER RPCs. This small ownership-checked setter lets a host save the
-- single price + currency on their own pending application (the main edit RPC
-- only handles the legacy price_ils/price_usd columns).

create or replace function public.update_host_application_price(
  application_uuid uuid,
  new_price numeric,
  new_price_currency text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  app_host uuid;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;
  if new_price_currency is not null
     and new_price_currency not in ('ILS','USD','GBP','EUR','CAD','CHF','AUD') then
    raise exception 'Unsupported currency';
  end if;

  select host_id into app_host from public.host_applications where id = application_uuid;
  if app_host is null then
    raise exception 'Application not found';
  end if;
  if not exists (
    select 1 from public.hosts h
    where h.id = app_host and (h.id = caller or h.user_id = caller)
  ) then
    raise exception 'Not authorized for this application';
  end if;

  update public.host_applications
  set price = new_price, price_currency = new_price_currency
  where id = application_uuid;
end;
$$;

revoke all on function public.update_host_application_price(uuid, numeric, text) from public;
grant execute on function public.update_host_application_price(uuid, numeric, text) to authenticated;
