-- 074_hosts_pii_lockdown.sql
--
-- CRITICAL fix. Migration 066 hid hosts.email from the anonymous role but left
-- the `authenticated` role with full table-level SELECT and a `USING (true)`
-- read policy, so ANY logged-in user could read every host's `email` and
-- `calendar_token`. The calendar_token unlocks /api/host-calendar/[token],
-- which exposes guest names, exact stay addresses, and dates.
--
-- This removes exactly `email` and `calendar_token` from `authenticated`,
-- leaving every other column readable (so cross-table RLS policies that match
-- on hosts.id / hosts.user_id, and the app's public host reads, are unaffected
-- -- those predicates never reference these two columns). A host reads its OWN
-- email/token through a SECURITY DEFINER function; admin and the email sender
-- read via the service role (which bypasses column grants).
--
-- NOTE: the base `hosts` table and its policies still live in the unnumbered
-- supabase/host-profile-trigger.sql. Committing them as a numbered migration is
-- a tracked follow-up (audit H1) so a rebuild-from-migrations can't reopen this.

-- To restrict specific columns for a role that holds table-level SELECT, the
-- table grant must be revoked and re-granted per column (same shape as 066).
revoke select on public.hosts from authenticated;

-- Defensive: mirror 066's per-column revoke for the token on the shared role.
revoke select (calendar_token) on public.hosts from public;

-- Grant authenticated SELECT on every current column EXCEPT the two sensitive
-- ones. Done dynamically so it adapts to the live schema and cannot miss a
-- column (repo != live DB), and so a future column is not silently exposed.
do $$
declare
  col record;
begin
  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hosts'
      and column_name not in ('email', 'calendar_token')
  loop
    execute format('grant select (%I) on public.hosts to authenticated', col.column_name);
  end loop;
end
$$;

-- A host reads its own email + calendar_token here (column grants are role-wide
-- and cannot be scoped to the owner's row).
create or replace function public.get_my_host_contact()
returns table (
  host_id uuid,
  email text,
  calendar_token text
)
language sql
stable
security definer
set search_path = public
as $$
  select h.id, h.email, h.calendar_token
  from public.hosts h
  where h.id = auth.uid() or h.user_id = auth.uid()
  order by case when h.id = auth.uid() then 0 else 1 end
  limit 1;
$$;

revoke all on function public.get_my_host_contact() from public;
grant execute on function public.get_my_host_contact() to authenticated;
