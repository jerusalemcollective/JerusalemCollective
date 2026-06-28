-- 065_booking_enquiry_dedup.sql
--
-- P2-B: prevent duplicate booking_requests from a rapid double-submit, and make
-- create_listing_enquiry() dedupe GRACEFULLY (reuse the existing request) instead
-- of raising a unique-violation error.
--
-- Run order matters: the index must exist before the function's ON CONFLICT runs.
-- Safe to run as-is, EXCEPT confirm there are no existing duplicates first:
--   select guest_id, listing_id, check_in, check_out, count(*)
--   from public.booking_requests
--   where check_in is not null and check_out is not null
--   group by 1,2,3,4 having count(*) > 1;
-- If that returns rows, delete the extras (keep earliest created_at) before running.

-- 1. Guard index (partial: only fully-dated requests are deduped).
create unique index if not exists booking_requests_no_dupe_idx
  on public.booking_requests (guest_id, listing_id, check_in, check_out)
  where check_in is not null and check_out is not null;

-- 2. Patched function (identical to 060 except the booking_requests insert).
create or replace function public.create_listing_enquiry(
  target_listing_id uuid,
  check_in_date date default null,
  check_out_date date default null,
  guest_count integer default 1,
  message_body text default null
)
returns table (
  request_id uuid,
  conversation_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  listing_record public.listings%rowtype;
  host_account_id uuid;
  conversation_record public.conversations%rowtype;
  request_record public.booking_requests%rowtype;
  clean_message text := nullif(trim(coalesce(message_body, '')), '');
  request_message text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if target_listing_id is null then
    raise exception 'Listing is required';
  end if;

  if coalesce(guest_count, 0) < 1 then
    raise exception 'Guest count must be at least 1';
  end if;

  if check_in_date is not null and check_out_date is not null and check_out_date <= check_in_date then
    raise exception 'Check-out must be after check-in';
  end if;

  select *
  into listing_record
  from public.listings
  where id = target_listing_id
    and is_published = true;

  if listing_record.id is null then
    raise exception 'Listing not available';
  end if;

  select coalesce(hosts.user_id, hosts.id)
  into host_account_id
  from public.hosts
  where hosts.id = listing_record.host_id
  limit 1;

  host_account_id := coalesce(host_account_id, listing_record.host_id);

  if host_account_id is null then
    raise exception 'Host not available';
  end if;

  insert into public.conversations (
    participant_1,
    participant_2,
    listing_id
  )
  values (
    current_user_id,
    host_account_id,
    target_listing_id
  )
  on conflict (participant_1, participant_2, listing_id)
  do update set updated_at = now()
  returning * into conversation_record;

  request_message := coalesce(clean_message, 'I would like to enquire about this stay.');

  if check_in_date is not null or check_out_date is not null then
    request_message := request_message
      || E'\n\nRequested dates: '
      || coalesce(check_in_date::text, 'not set')
      || ' to '
      || coalesce(check_out_date::text, 'not set');
  end if;

  request_message := request_message || E'\nGuests: ' || coalesce(guest_count, 1)::text;

  insert into public.messages (
    conversation_id,
    sender_id,
    content
  )
  values (
    conversation_record.id,
    current_user_id,
    request_message
  );

  insert into public.booking_requests (
    listing_id,
    host_id,
    guest_id,
    conversation_id,
    check_in,
    check_out,
    guests,
    message,
    status
  )
  values (
    target_listing_id,
    listing_record.host_id,
    current_user_id,
    conversation_record.id,
    check_in_date,
    check_out_date,
    coalesce(guest_count, 1),
    clean_message,
    'new'
  )
  on conflict (guest_id, listing_id, check_in, check_out)
    where check_in is not null and check_out is not null
  do nothing
  returning * into request_record;

  -- If an identical fully-dated request already existed, the insert above did
  -- nothing. Reuse the existing request so the caller still gets a request_id.
  if request_record.id is null then
    select *
    into request_record
    from public.booking_requests
    where guest_id = current_user_id
      and listing_id = target_listing_id
      and check_in = check_in_date
      and check_out = check_out_date
    order by created_at asc
    limit 1;
  end if;

  update public.conversations
  set updated_at = now()
  where id = conversation_record.id;

  return query
  select request_record.id, conversation_record.id;
end;
$$;

revoke all on function public.create_listing_enquiry(uuid, date, date, integer, text) from public;
grant execute on function public.create_listing_enquiry(uuid, date, date, integer, text) to authenticated;
