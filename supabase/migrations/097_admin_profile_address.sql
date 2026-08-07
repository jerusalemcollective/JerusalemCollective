-- Admins can read an applicant's account-holder address for KYC review.
--
-- profiles.address is private (migration 096): no SELECT grant, and the
-- owner-only definer get_my_profile_address() returns only the caller's own.
-- This admin-gated definer returns any user's address so the application review
-- screen can show it. Gated on current_user_is_admin() (migration 006).

create or replace function public.get_profile_address_for_admin(target_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result text;
begin
  if not public.current_user_is_admin() then
    raise exception 'Admin permission required';
  end if;

  select p.address into result
  from public.profiles p
  where p.id = target_user_id;

  return result;
end;
$$;

revoke all on function public.get_profile_address_for_admin(uuid) from public;
grant execute on function public.get_profile_address_for_admin(uuid) to authenticated;
