-- 108_restore_booking_requests_read_policies.sql
--
-- The live database had its granular booking_requests SELECT policies (defined
-- in migrations 021/060) replaced by a single blanket-deny policy:
--   "No public read booking requests"  SELECT  to public  using (false)
-- That silently returned ZERO rows to every client read, so the host dashboard
-- Enquiries tab and the guest /account/enquiries page were always empty. Enquiry
-- emails and creation kept working because they use the service role / a
-- SECURITY DEFINER RPC, both of which bypass RLS.
--
-- This restores the per-role read policies so:
--   * a guest sees their own enquiries (guest_id = auth.uid())
--   * a host sees enquiries for their listings (host_id match, incl. split id)
--   * an admin sees all
-- anon still cannot read (no policy grants it), so nothing is exposed publicly.

alter table public.booking_requests enable row level security;

-- Remove the blanket deny that shadowed everything.
drop policy if exists "No public read booking requests" on public.booking_requests;

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
