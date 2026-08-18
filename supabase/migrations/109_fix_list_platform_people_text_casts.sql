-- 109_fix_list_platform_people_text_casts.sql
--
-- Fixes 42804 "Returned type character varying(255) does not match expected type
-- text in column 2" thrown by list_platform_people. auth.users.email is varchar(255)
-- (and the hosts table, created in the Supabase UI, uses varchar too), but the
-- function's RETURNS TABLE declares email/full_name/host_name/host_type as text.
-- Postgres rejects the row-type mismatch, so /admin/guests and /admin/hosts (both
-- call this function) error out.
--
-- Recreate the function identically to 079, but cast every text-typed column to
-- ::text so the returned types match the declared ones. Idempotent / re-runnable;
-- paste into the Supabase SQL editor as the owner role.

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
    users.email::text,
    profiles.full_name::text,
    profiles.phone::text,
    profiles.avatar_url::text,
    -- A real host: explicitly flagged, or has a listing / application.
    coalesce(profiles.is_host, false)
      or exists (select 1 from public.listings l where l.host_id = hosts.id)
      or exists (select 1 from public.host_applications a where a.host_id = hosts.id),
    coalesce(profiles.is_admin, false),
    profiles.admin_role::text,
    -- Only surface host_id for actual hosts, so /admin/hosts isn't everyone.
    case
      when coalesce(profiles.is_host, false)
        or exists (select 1 from public.listings l where l.host_id = hosts.id)
        or exists (select 1 from public.host_applications a where a.host_id = hosts.id)
      then hosts.id
      else null
    end,
    hosts.name::text,
    hosts.host_type::text,
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
