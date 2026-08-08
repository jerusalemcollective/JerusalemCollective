-- 103_listing_min_nights.sql
--
-- Per-listing minimum-night stays. Hosts set a minimum on any listing; guests
-- cannot book or request a stay shorter than it. Adds:
--   (a) listings.min_nights (default 1 = no minimum, matching today's behaviour),
--   (b) update_listing_min_nights RPC (focused, ownership-checked — mirrors 087),
--   (c) a booking_requests INSERT trigger so the request-to-book path is
--       server-enforced without re-creating the create_listing_enquiry RPC.
-- The instant "Book now" path is enforced in app/api/book-now before the money
-- RPC runs. Host manual bookings / calendar blocks are NOT restricted.

alter table public.listings
  add column if not exists min_nights integer not null default 1;

comment on column public.listings.min_nights is
  'Minimum number of nights a guest must book/request. 1 = no minimum.';

alter table public.listings drop constraint if exists listings_min_nights_check;
alter table public.listings
  add constraint listings_min_nights_check check (min_nights >= 1 and min_nights <= 365);

-- ---------------------------------------------------------------------------
-- Host setter: focused, ownership-checked RPC (same shape as 087's deposit RPC).
-- ---------------------------------------------------------------------------
create or replace function public.update_listing_min_nights(
  listing_uuid uuid,
  p_min_nights integer
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

  -- Ownership: the listing's host must belong to the caller (direct match or the
  -- split-identity hosts.user_id bridge).
  if not (
    listing_record.host_id = current_user_id
    or exists (
      select 1 from public.hosts h
      where h.id = listing_record.host_id and h.user_id = current_user_id
    )
  ) then
    raise exception 'You do not have permission to edit this listing.';
  end if;

  if p_min_nights is null or p_min_nights < 1 or p_min_nights > 365 then
    raise exception 'Minimum nights must be between 1 and 365.';
  end if;

  update public.listings
  set min_nights = p_min_nights
  where id = listing_uuid
  returning * into listing_record;

  return listing_record;
end;
$$;

revoke all on function public.update_listing_min_nights(uuid, integer) from public;
grant execute on function public.update_listing_min_nights(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Request-path server guard: reject a booking request shorter than the
-- listing's minimum. INSERT-only, so it never touches existing requests or the
-- host accept/edit flow; open-ended enquiries (no dates) are unaffected.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_booking_request_min_nights()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_min integer;
begin
  if new.check_in is not null and new.check_out is not null then
    select min_nights into listing_min from public.listings where id = new.listing_id;
    if listing_min is not null and (new.check_out - new.check_in) < listing_min then
      raise exception 'This stay requires a minimum of % nights.', listing_min;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists booking_request_min_nights on public.booking_requests;
create trigger booking_request_min_nights
before insert on public.booking_requests
for each row
execute function public.enforce_booking_request_min_nights();
