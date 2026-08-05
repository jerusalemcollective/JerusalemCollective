-- 079_admin_people_accurate_host_flag.sql
--
-- Audit data-integrity. The signup trigger (host-profile-trigger.sql) creates a
-- hosts row for EVERY new auth user, so list_platform_people's
-- "is_host = ... OR hosts.id IS NOT NULL" was true for everyone. Effect:
-- /admin/guests (filters !is_host) showed nobody, and /admin/hosts (filters
-- host_id) showed everyone. Recompute is_host from REAL host signals -- an
-- explicit profiles.is_host flag, or an actual listing/application -- and only
-- return host_id for those. Recreate the function (070's version) with just
-- these two expressions changed; the shape is unchanged.
--
-- Deeper root cause (auto-creating a hosts row for non-hosts) is a separate,
-- riskier follow-up (it touches the unnumbered signup trigger). This fixes the
-- admin-facing symptom safely.

create or replace function public.list_platform_people()
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  is_host boolean,
  is_admin boolean,
  admin_role text,
  host_id uuid,
  host_name text,
  host_type text,
  host_is_verified boolean,
  listing_count bigint,
  application_count bigint,
  booking_count bigint,
  saved_count bigint,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.current_user_has_admin_permission('guests') then
    raise exception 'Admin permission required';
  end if;

  return query
  select
    users.id,
    users.email,
    profiles.full_name,
    profiles.phone,
    profiles.avatar_url,
    -- A real host: explicitly flagged, or has a listing / application.
    coalesce(profiles.is_host, false)
      or exists (select 1 from public.listings l where l.host_id = hosts.id)
      or exists (select 1 from public.host_applications a where a.host_id = hosts.id),
    coalesce(profiles.is_admin, false),
    profiles.admin_role,
    -- Only surface host_id for actual hosts, so /admin/hosts isn't everyone.
    case
      when coalesce(profiles.is_host, false)
        or exists (select 1 from public.listings l where l.host_id = hosts.id)
        or exists (select 1 from public.host_applications a where a.host_id = hosts.id)
      then hosts.id
      else null
    end,
    hosts.name,
    hosts.host_type,
    hosts.is_verified,
    (
      select count(*)
      from public.listings
      where listings.host_id = hosts.id
    ) as listing_count,
    (
      select count(*)
      from public.host_applications
      where host_applications.host_id = hosts.id
    ) as application_count,
    (
      select count(*)
      from public.bookings
      where bookings.user_id = users.id
    ) as booking_count,
    (
      select count(*)
      from public.saved_listings
      where saved_listings.user_id = users.id
    ) as saved_count,
    users.created_at,
    users.last_sign_in_at
  from auth.users as users
  left join public.profiles as profiles
    on profiles.id = users.id
  left join public.hosts as hosts
    on hosts.user_id = users.id
       or hosts.id = users.id
  order by users.created_at desc;
end;
$$;

revoke all on function public.list_platform_people() from public;
grant execute on function public.list_platform_people() to authenticated;
