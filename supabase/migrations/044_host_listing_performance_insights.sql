create or replace function public.get_listing_performance_insights(
  target_listing_id uuid,
  lookback_days integer default 30
)
returns table (
  listing_id uuid,
  views integer,
  saves integer,
  enquiries integer,
  booking_requests integer,
  accepted_requests integer,
  enquiry_rate numeric,
  request_acceptance_rate numeric,
  avg_response_hours numeric,
  demand_signal text,
  recommendation text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_listing public.listings%rowtype;
  host_user_id uuid;
  start_at timestamptz := now() - make_interval(days => greatest(coalesce(lookback_days, 30), 1));
  view_count integer := 0;
  save_count integer := 0;
  enquiry_count integer := 0;
  request_count integer := 0;
  accepted_count integer := 0;
  lead_count integer := 0;
  enquiry_rate_value numeric;
  acceptance_rate_value numeric;
  response_hours_value numeric;
  signal text := 'building_data';
  insight text := 'Keep your listing complete and respond quickly while we collect more guest activity.';
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

  select hosts.user_id
  into host_user_id
  from public.hosts
  where hosts.id = target_listing.host_id
  limit 1;

  if not (
    target_listing.host_id = current_user_id
    or host_user_id = current_user_id
    or exists (
      select 1
      from public.profiles
      where profiles.id = current_user_id
        and profiles.is_admin = true
    )
  ) then
    raise exception 'Not allowed';
  end if;

  select
    count(*) filter (where event_type = 'view')::integer,
    count(*) filter (where event_type = 'save')::integer,
    count(*) filter (where event_type = 'enquiry')::integer
  into view_count, save_count, enquiry_count
  from public.listing_engagement_events
  where listing_id = target_listing.id
    and created_at >= start_at;

  select
    count(*)::integer,
    count(*) filter (where status = 'accepted')::integer
  into request_count, accepted_count
  from public.booking_requests
  where listing_id = target_listing.id
    and created_at >= start_at;

  lead_count := enquiry_count + request_count;

  if view_count > 0 then
    enquiry_rate_value := round((lead_count::numeric / view_count::numeric) * 100, 1);
  end if;

  if request_count > 0 then
    acceptance_rate_value := round((accepted_count::numeric / request_count::numeric) * 100, 1);
  end if;

  select round(avg(extract(epoch from (first_host_reply.created_at - requests.created_at)) / 3600)::numeric, 1)
  into response_hours_value
  from public.booking_requests as requests
  left join lateral (
    select messages.created_at
    from public.messages
    where messages.conversation_id = requests.conversation_id
      and messages.created_at > requests.created_at
      and messages.sender_id in (
        target_listing.host_id,
        coalesce(host_user_id, target_listing.host_id)
      )
    order by messages.created_at asc
    limit 1
  ) as first_host_reply on true
  where requests.listing_id = target_listing.id
    and requests.created_at >= start_at
    and first_host_reply.created_at is not null;

  if view_count < 10 and lead_count = 0 then
    signal := 'building_data';
    insight := 'There is not enough recent traffic yet. Keep photos strong and share the listing to build early demand.';
  elsif view_count >= 20 and lead_count = 0 then
    signal := 'low_conversion';
    insight := 'Guests are viewing this listing but not enquiring. Review the first photo, nightly price, and opening description.';
  elsif enquiry_rate_value is not null and enquiry_rate_value >= 8 then
    signal := 'strong_demand';
    insight := 'Guest demand is strong. Keep response times sharp and consider whether your rate still reflects the value of the stay.';
  elsif response_hours_value is not null and response_hours_value > 12 then
    signal := 'slow_response';
    insight := 'Guests are engaging, but replies are taking time. Faster replies can improve booking conversion.';
  elsif lead_count > 0 then
    signal := 'steady_interest';
    insight := 'This listing is getting guest interest. Watch which enquiries turn into accepted bookings before changing price.';
  end if;

  return query
  select
    target_listing.id,
    view_count,
    save_count,
    enquiry_count,
    request_count,
    accepted_count,
    enquiry_rate_value,
    acceptance_rate_value,
    response_hours_value,
    signal,
    insight;
end;
$$;

revoke all on function public.get_listing_performance_insights(uuid, integer) from public;
grant execute on function public.get_listing_performance_insights(uuid, integer) to authenticated;
