-- 120_protect_exact_address.sql
--
-- PRIVACY FIX: listings.exact_address is readable by anyone.
--
-- "Public can view published listings" (036) lets the anon role SELECT every
-- column of a published listing, and the anon key ships in the website. So
-- anyone could read every listing's street address straight from the API
-- (GET /rest/v1/listings?select=exact_address), even though no page shows it.
-- Column privileges cannot fix this: the site selects '*' on listings, and a
-- revoked column makes '*' fail for that role.
--
-- What this migration does:
--   1. Creates public.listing_private_details (one row per listing) holding
--      the exact address, with RLS:
--        SELECT: the listing's host, admins, and guests with a confirmed or
--                completed booking on that listing (until 14 days after
--                check-out, so the guest can find the flat and use the
--                calendar file).
--        INSERT/UPDATE/DELETE: the listing's host and admins only.
--   2. Copies every existing listings.exact_address into it.
--   3. Adds a trigger on listings: any exact_address written to listings
--      (by code that is still deployed, or by hand in the SQL editor) is moved
--      into listing_private_details and NULL is stored on listings.
--   4. Sets listings.exact_address to NULL everywhere.
--
-- After this runs, the public API returns NULL for listings.exact_address.
-- The column itself stays, so code that still reads or writes it keeps
-- running (a write lands in the private table via the trigger).
--
-- ---------------------------------------------------------------------------
-- ORDER TO RUN (the owner pastes SQL by hand; code deploys separately)
-- ---------------------------------------------------------------------------
--   Step 1. Deploy the code that reads/writes listing_private_details.
--           Until this migration runs, that code sees "table does not exist"
--           and falls back to listings.exact_address, so nothing breaks.
--   Step 2. Paste and run THIS file (120) in the Supabase SQL editor.
--           The address is hidden from the public the moment it commits.
--   Step 3. Optional, any time later and only after Step 1 is live:
--           121_drop_listings_exact_address.sql removes the empty column.
--
--   Running 120 BEFORE the code deploy is also safe, and closes the leak
--   sooner. In that window the old code just sees no address: the admin
--   listing editor shows an empty address box (saving it does NOT wipe the
--   stored address; the trigger ignores NULL), and calendar files show the
--   neighbourhood instead of the street. If the deploy will be delayed, run
--   120 first.
--
-- Safe to run more than once.
--
-- ---------------------------------------------------------------------------
-- NOT DONE HERE, proposed for later: precise latitude / longitude
-- ---------------------------------------------------------------------------
-- listings.latitude / longitude are just as readable through the anon key
-- and pin the building to a few metres. The public pages now round them to
-- about 500 m before sending them to the browser, but the API still returns
-- the precise values. A follow-up could move them the same way:
--   alter table public.listing_private_details
--     add column latitude double precision,
--     add column longitude double precision;
--   -- copy them in, then store a rounded copy on listings:
--   update public.listings
--   set latitude  = round((latitude  / 0.005)::numeric) * 0.005,
--       longitude = round((longitude / 0.005)::numeric) * 0.005;
-- Server-side distance work (shul distances, lib/shul-distances.ts) would
-- then read the precise values from listing_private_details with an admin
-- or service-role client. Not done now because shul distances are computed
-- from the application's coordinates at approval time and the listing page
-- map would need checking first.

begin;

-- ---------------------------------------------------------------------------
-- 1. The private table
-- ---------------------------------------------------------------------------

create table if not exists public.listing_private_details (
  -- DEFERRABLE so the BEFORE INSERT trigger on listings (step 3) can write
  -- the private row in the same statement that creates the listing; the
  -- foreign key is checked at commit, when the listing row exists.
  listing_id uuid primary key
    references public.listings (id) on delete cascade
    deferrable initially deferred,
  exact_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.listing_private_details is
  'Listing details that must not be public (exact street address). Readable by the host, admins and guests with a confirmed booking; writable by the host and admins. Never add a public SELECT policy here.';

alter table public.listing_private_details enable row level security;

-- No anon access at all; RLS below decides which signed-in users see a row.
revoke all on public.listing_private_details from anon;
grant select, insert, update, delete on public.listing_private_details to authenticated;

-- Who may manage (write) a listing's private details: its host or an admin.
-- SECURITY DEFINER so the check does not depend on the caller's RLS on
-- listings/hosts/profiles. Ownership expression matches 020/069.
create or replace function public.can_manage_listing_private_details(target_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.is_admin = true
      )
      or exists (
        select 1
        from public.listings
        where listings.id = target_listing_id
          and (
            listings.host_id = auth.uid()
            or exists (
              select 1
              from public.hosts
              where hosts.id = listings.host_id
                and hosts.user_id = auth.uid()
            )
          )
      )
    );
$$;

-- Who may read: managers, plus a guest with a confirmed/completed booking on
-- the listing whose stay has not ended more than 14 days ago.
create or replace function public.can_read_listing_private_details(target_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_listing_private_details(target_listing_id)
    or (
      auth.uid() is not null
      and exists (
        select 1
        from public.bookings
        where bookings.listing_id = target_listing_id
          and bookings.user_id = auth.uid()
          and bookings.status in ('confirmed', 'completed')
          and (bookings.check_out is null or bookings.check_out >= current_date - 14)
      )
    );
$$;

revoke all on function public.can_manage_listing_private_details(uuid) from public, anon;
revoke all on function public.can_read_listing_private_details(uuid) from public, anon;
grant execute on function public.can_manage_listing_private_details(uuid) to authenticated;
grant execute on function public.can_read_listing_private_details(uuid) to authenticated;

drop policy if exists "Hosts, admins and booked guests can read listing private details" on public.listing_private_details;
create policy "Hosts, admins and booked guests can read listing private details"
on public.listing_private_details
for select
to authenticated
using (public.can_read_listing_private_details(listing_id));

drop policy if exists "Hosts and admins can add listing private details" on public.listing_private_details;
create policy "Hosts and admins can add listing private details"
on public.listing_private_details
for insert
to authenticated
with check (public.can_manage_listing_private_details(listing_id));

drop policy if exists "Hosts and admins can update listing private details" on public.listing_private_details;
create policy "Hosts and admins can update listing private details"
on public.listing_private_details
for update
to authenticated
using (public.can_manage_listing_private_details(listing_id))
with check (public.can_manage_listing_private_details(listing_id));

drop policy if exists "Hosts and admins can delete listing private details" on public.listing_private_details;
create policy "Hosts and admins can delete listing private details"
on public.listing_private_details
for delete
to authenticated
using (public.can_manage_listing_private_details(listing_id));

create or replace function public.touch_listing_private_details_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists listing_private_details_touch_updated_at on public.listing_private_details;
create trigger listing_private_details_touch_updated_at
before update on public.listing_private_details
for each row
execute function public.touch_listing_private_details_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Copy the existing addresses
-- ---------------------------------------------------------------------------
-- Existing private rows win (re-running this file never overwrites an
-- address that was edited after the first run).

insert into public.listing_private_details (listing_id, exact_address)
select listings.id, trim(listings.exact_address)
from public.listings
where nullif(trim(listings.exact_address), '') is not null
on conflict (listing_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Keep listings.exact_address empty from now on
-- ---------------------------------------------------------------------------
-- Fires only when a statement actually sets exact_address. A non-empty value
-- is moved into the private table; NULL or '' is ignored, so old code that
-- saves an empty box (because it can no longer read the address) does not
-- erase the stored one. Clearing an address is done on
-- listing_private_details directly (the new code does that).
--
-- SECURITY DEFINER: the trigger only runs for rows the caller was already
-- allowed to insert/update on listings (host or admin), so writing the
-- matching private row on their behalf grants nothing new.

create or replace function public.listings_move_exact_address_private()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.exact_address is not null then
    if nullif(trim(new.exact_address), '') is not null then
      insert into public.listing_private_details (listing_id, exact_address)
      values (new.id, trim(new.exact_address))
      on conflict (listing_id) do update
        set exact_address = excluded.exact_address;
    end if;
    new.exact_address := null;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_move_exact_address_private on public.listings;
create trigger listings_move_exact_address_private
before insert or update of exact_address on public.listings
for each row
execute function public.listings_move_exact_address_private();

-- ---------------------------------------------------------------------------
-- 4. Hide the addresses now
-- ---------------------------------------------------------------------------

update public.listings
set exact_address = null
where exact_address is not null;

comment on column public.listings.exact_address is
  'DEPRECATED, always NULL. The exact address lives in listing_private_details (see 120). Drop with 121 once the new code is deployed.';

commit;

-- Check after running (both should be 0 / match):
--   select count(*) from public.listings where exact_address is not null;      -- expect 0
--   select count(*) from public.listing_private_details where exact_address is not null;
