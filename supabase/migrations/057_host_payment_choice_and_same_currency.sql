alter table public.host_payment_profiles
  add column if not exists accepts_jlm_payment boolean not null default false,
  add column if not exists same_currency_payout boolean not null default true,
  add column if not exists payout_currencies text[] not null default array[]::text[];

alter table public.listings
  add column if not exists online_payment_enabled boolean not null default false;

alter table public.booking_payments
  add column if not exists host_payout_currency text,
  add column if not exists fx_rate_used numeric;

create or replace function public.update_host_payment_preferences(
  accepts_direct boolean,
  instructions text,
  currency_code text,
  accepts_jlm boolean,
  supported_currencies text[]
)
returns public.host_payment_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_host_id uuid;
  cleaned_currencies text[];
  updated_profile public.host_payment_profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select hosts.id
  into current_host_id
  from public.hosts
  where hosts.id = current_user_id
     or hosts.user_id = current_user_id
  order by case when hosts.id = current_user_id then 0 else 1 end
  limit 1;

  if current_host_id is null then
    raise exception 'Host profile not found';
  end if;

  if accepts_direct and trim(coalesce(instructions, '')) = '' then
    raise exception 'Direct payment instructions are required';
  end if;

  select coalesce(array_agg(distinct currency), array[]::text[])
  into cleaned_currencies
  from (
    select upper(trim(unnest(coalesce(supported_currencies, array[]::text[])))) as currency
  ) normalized
  where currency in ('GBP', 'USD', 'EUR', 'ILS');

  insert into public.host_payment_profiles (
    host_id,
    accepts_direct_payment,
    direct_payment_instructions,
    preferred_currency,
    accepts_jlm_payment,
    same_currency_payout,
    payout_currencies
  )
  values (
    current_host_id,
    accepts_direct,
    nullif(trim(coalesce(instructions, '')), ''),
    nullif(upper(trim(coalesce(currency_code, ''))), ''),
    accepts_jlm,
    true,
    cleaned_currencies
  )
  on conflict (host_id) do update
  set accepts_direct_payment = excluded.accepts_direct_payment,
      direct_payment_instructions = excluded.direct_payment_instructions,
      preferred_currency = excluded.preferred_currency,
      accepts_jlm_payment = excluded.accepts_jlm_payment,
      same_currency_payout = true,
      payout_currencies = excluded.payout_currencies,
      updated_at = now()
  returning * into updated_profile;

  return updated_profile;
end;
$$;

grant execute on function public.update_host_payment_preferences(
  boolean,
  text,
  text,
  boolean,
  text[]
) to authenticated;
