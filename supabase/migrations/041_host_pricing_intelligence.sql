create or replace function public.get_listing_price_comparison(
  target_listing_id uuid
)
returns table (
  listing_id uuid,
  comparable_count integer,
  median_price_usd numeric,
  low_price_usd numeric,
  high_price_usd numeric,
  percent_difference_usd numeric,
  median_price_ils numeric,
  low_price_ils numeric,
  high_price_ils numeric,
  percent_difference_ils numeric,
  price_position text,
  recommendation text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_listing public.listings%rowtype;
  comparison_count integer := 0;
  usd_median numeric;
  usd_low numeric;
  usd_high numeric;
  ils_median numeric;
  ils_low numeric;
  ils_high numeric;
  usd_difference numeric;
  ils_difference numeric;
  preferred_difference numeric;
  computed_price_position text := 'not_enough_data';
  price_recommendation text := 'Not enough similar listings yet for a reliable comparison.';
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into target_listing
  from public.listings
  where id = target_listing_id;

  if target_listing.id is null then
    raise exception 'Listing not found';
  end if;

  if not (
    target_listing.host_id = current_user_id
    or exists (
      select 1
      from public.hosts
      where hosts.id = target_listing.host_id
        and hosts.user_id = current_user_id
    )
    or exists (
      select 1
      from public.profiles
      where profiles.id = current_user_id
        and profiles.is_admin = true
    )
  ) then
    raise exception 'Not allowed';
  end if;

  with comparable as (
    select price_usd, price_ils
    from public.listings
    where id <> target_listing.id
      and is_published = true
      and area = target_listing.area
      and (
        target_listing.bedrooms is null
        or bedrooms is null
        or abs(coalesce(bedrooms, 0) - coalesce(target_listing.bedrooms, 0)) <= 1
      )
      and (
        target_listing.max_guests is null
        or max_guests is null
        or abs(coalesce(max_guests, 0) - coalesce(target_listing.max_guests, 0)) <= 2
      )
      and (
        price_usd is not null
        or price_ils is not null
      )
  )
  select
    count(*)::integer,
    percentile_cont(0.5) within group (order by price_usd) filter (where price_usd is not null),
    min(price_usd) filter (where price_usd is not null),
    max(price_usd) filter (where price_usd is not null),
    percentile_cont(0.5) within group (order by price_ils) filter (where price_ils is not null),
    min(price_ils) filter (where price_ils is not null),
    max(price_ils) filter (where price_ils is not null)
  into
    comparison_count,
    usd_median,
    usd_low,
    usd_high,
    ils_median,
    ils_low,
    ils_high
  from comparable;

  if target_listing.price_usd is not null and usd_median is not null and usd_median > 0 then
    usd_difference := round(((target_listing.price_usd - usd_median) / usd_median) * 100, 1);
    preferred_difference := usd_difference;
  end if;

  if target_listing.price_ils is not null and ils_median is not null and ils_median > 0 then
    ils_difference := round(((target_listing.price_ils - ils_median) / ils_median) * 100, 1);
    preferred_difference := coalesce(preferred_difference, ils_difference);
  end if;

  if comparison_count >= 3 and preferred_difference is not null then
    if preferred_difference >= 12 then
      computed_price_position := 'above_market';
      price_recommendation := 'Your rate is positioned above similar stays in this neighbourhood. This can work if your photos, amenities, and guest experience clearly justify the premium.';
    elsif preferred_difference <= -12 then
      computed_price_position := 'below_market';
      price_recommendation := 'Your rate is positioned below similar stays. If enquiries are healthy, you may be able to test a modest increase.';
    else
      computed_price_position := 'in_line';
      price_recommendation := 'Your rate is broadly in line with similar stays in this neighbourhood.';
    end if;
  end if;

  return query
  select
    target_listing.id,
    comparison_count,
    usd_median,
    usd_low,
    usd_high,
    usd_difference,
    ils_median,
    ils_low,
    ils_high,
    ils_difference,
    computed_price_position,
    price_recommendation;
end;
$$;

revoke all on function public.get_listing_price_comparison(uuid) from public;
grant execute on function public.get_listing_price_comparison(uuid) to authenticated;
