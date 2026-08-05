-- 083_profiles_phone_privacy.sql
--
-- Audit security. The profiles SELECT policy admits a conversation partner to
-- the whole row, including `phone`. RLS can't restrict columns, so mirror the
-- hosts email lockdown (074): revoke table-level SELECT from `authenticated`
-- and re-grant every column EXCEPT phone. A user reads their OWN phone via a
-- SECURITY DEFINER function; admins read it via list_platform_people (definer,
-- unaffected by grants). anon has no profiles access and is untouched.
--
-- Safe: verified no policy references profiles.phone and no code does a
-- select('*') on profiles, so only the two own/admin phone reads change (both
-- rerouted in the accompanying code).

revoke select on public.profiles from authenticated;

do $$
declare
  col record;
begin
  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name <> 'phone'
  loop
    execute format('grant select (%I) on public.profiles to authenticated', col.column_name);
  end loop;
end
$$;

create or replace function public.get_my_profile_contact()
returns table (profile_id uuid, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.phone
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile_contact() from public;
grant execute on function public.get_my_profile_contact() to authenticated;
