create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade,
  host_id uuid references public.hosts(id) on delete set null,
  guest_id uuid references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  check_in date,
  check_out date,
  guests integer not null default 1,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booking_requests
  add column if not exists listing_id uuid references public.listings(id) on delete cascade,
  add column if not exists host_id uuid references public.hosts(id) on delete set null,
  add column if not exists guest_id uuid references public.profiles(id) on delete cascade,
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists check_in date,
  add column if not exists check_out date,
  add column if not exists guests integer not null default 1,
  add column if not exists message text,
  add column if not exists status text not null default 'new',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.booking_requests
  drop constraint if exists booking_requests_status_check;

alter table public.booking_requests
  add constraint booking_requests_status_check
  check (status in ('new', 'host_replied', 'accepted', 'declined', 'closed'));

alter table public.booking_requests
  drop constraint if exists booking_requests_guests_check;

alter table public.booking_requests
  add constraint booking_requests_guests_check check (guests >= 1);

create index if not exists booking_requests_conversation_idx
  on public.booking_requests (conversation_id, created_at desc);

create index if not exists booking_requests_host_status_idx
  on public.booking_requests (host_id, status, created_at desc);

create index if not exists booking_requests_guest_status_idx
  on public.booking_requests (guest_id, status, created_at desc);

alter table public.booking_requests enable row level security;

drop policy if exists "Guests can view own booking requests" on public.booking_requests;
create policy "Guests can view own booking requests"
on public.booking_requests
for select
to authenticated
using (guest_id = auth.uid());

drop policy if exists "Hosts can view own booking requests" on public.booking_requests;
create policy "Hosts can view own booking requests"
on public.booking_requests
for select
to authenticated
using (
  host_id = auth.uid()
  or exists (
    select 1
    from public.hosts
    where hosts.id = booking_requests.host_id
      and hosts.user_id = auth.uid()
  )
);

drop policy if exists "Admins can view all booking requests" on public.booking_requests;
create policy "Admins can view all booking requests"
on public.booking_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Guests can create own booking requests" on public.booking_requests;
create policy "Guests can create own booking requests"
on public.booking_requests
for insert
to authenticated
with check (guest_id = auth.uid());

drop policy if exists "Hosts and admins can update booking request status" on public.booking_requests;
create policy "Hosts and admins can update booking request status"
on public.booking_requests
for update
to authenticated
using (
  host_id = auth.uid()
  or exists (
    select 1
    from public.hosts
    where hosts.id = booking_requests.host_id
      and hosts.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  host_id = auth.uid()
  or exists (
    select 1
    from public.hosts
    where hosts.id = booking_requests.host_id
      and hosts.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

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
  returning * into request_record;

  update public.conversations
  set updated_at = now()
  where id = conversation_record.id;

  return query
  select request_record.id, conversation_record.id;
end;
$$;

revoke all on function public.create_listing_enquiry(uuid, date, date, integer, text) from public;
grant execute on function public.create_listing_enquiry(uuid, date, date, integer, text) to authenticated;
