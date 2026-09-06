-- 110_fix_list_admin_users_text_casts.sql
--
-- Same 42804 "character varying(255) does not match expected type text" bug that
-- 109 fixed for list_platform_people, but in list_admin_users (called by
-- /admin/admins). auth.users.email is varchar(255) and profiles.full_name /
-- admin_role are varchar, while the function's RETURNS TABLE declares them text,
-- so Postgres rejects the row-type mismatch and /admin/admins errors out.
--
-- Recreate identically to 019 but cast every text-typed column to ::text.
-- Idempotent / re-runnable; paste into the Supabase SQL editor as the owner role.
--
-- DROP first: the live function's declared return type differs, and CREATE OR
-- REPLACE cannot change a function's return type (Postgres 42P13).
drop function if exists public.list_admin_users();

create or replace function public.list_admin_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  admin_role text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.current_user_has_admin_permission('overview') then
    raise exception 'Only admins can list admins';
  end if;

  return query
  select
    profiles.id,
    users.email::text,
    profiles.full_name::text,
    profiles.admin_role::text,
    users.created_at,
    users.last_sign_in_at
  from public.profiles as profiles
  left join auth.users as users
    on users.id = profiles.id
  where profiles.is_admin = true
  order by
    case profiles.admin_role
      when 'owner' then 1
      when 'operations' then 2
      when 'support' then 3
      when 'content' then 4
      when 'analyst' then 5
      else 9
    end,
    lower(users.email::text);
end;
$$;

revoke all on function public.list_admin_users() from public;
grant execute on function public.list_admin_users() to authenticated;
