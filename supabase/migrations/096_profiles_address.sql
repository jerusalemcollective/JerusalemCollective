-- Account-holder address on the shared profile (serves both guest and host sides).
--
-- profiles PII is column-locked (migration 083): table-level SELECT was revoked
-- from `authenticated` and re-granted per column EXCEPT phone, with the owner
-- reading their own phone through a SECURITY DEFINER function. A home address is
-- at least as sensitive, so we follow the same pattern: the newly added column
-- has no SELECT grant (private by default), and the owner reads their own
-- address through the definer below. Writes still go through the existing
-- own-row UPDATE policy (083 only touched SELECT).

alter table public.profiles
  add column if not exists address text;

create or replace function public.get_my_profile_address()
returns table (profile_id uuid, address text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.address
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_my_profile_address() from public;
grant execute on function public.get_my_profile_address() to authenticated;
