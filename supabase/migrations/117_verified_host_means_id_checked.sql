-- 117_verified_host_means_id_checked.sql
--
-- "Verified host" must mean an admin has checked the host's ID.
--
-- Until now hosts.is_verified (the public "Verified host" badge) and
-- host_applications.id_verified were switched on automatically whenever an
-- admin approved an application (approveAndPublishApplication), and migrations
-- 035/036 back-filled is_verified = true for every host with an approved
-- application. The app no longer does that: approval leaves both flags alone,
-- and "Mark ID as verified" (setApplicationIdVerified) is the only thing that
-- turns them on. This migration repairs the data and locks the flags down.
--
-- What it does:
--   1. Resets host_applications.id_verified to false unless the latest ID
--      action an admin recorded on that application in admin_audit_log is
--      'verify_id' (the alternatives are 'unverify_id'; both are written by
--      setApplicationIdVerified with target_type 'application' and
--      target_id = the application id). Only admins can write to the audit log
--      (072), so a row there means an admin did it. Other actions (approval,
--      edits) don't count as an ID check.
--   2. Recomputes hosts.is_verified: true when one of the host's applications
--      has a checked ID, unless a later manual toggle on /admin/users
--      ('set_verified_true' / 'set_verified_false', target_type 'host',
--      target_id = hosts.id, written by updateHostVerification) says
--      otherwise; a host with only a manual toggle follows its latest toggle.
--   3. Adds triggers so only admins, or the service role / SQL editor (where
--      auth.uid() is null), can change either flag. Anyone else's change is
--      quietly ignored (the old value is kept; new rows start unverified) so a
--      host saving their own profile or application can't set them, and can't
--      fail because of them.
--
-- IMPORTANT: the audit log never recorded anything before migration 072 (every
-- insert was rejected by RLS). IDs that were checked before 072 have no
-- 'verify_id' row, so they WILL be reset here and need re-verifying: open each
-- application in /admin/applications and press "Mark ID as verified" again.
--
-- The app works whether or not this migration has run.
--
-- Preview (run before applying; read-only) — who loses / keeps the badge:
--
--   with latest_id_action as (
--     select distinct on (target_id) target_id, action
--     from public.admin_audit_log
--     where target_type = 'application' and action in ('verify_id', 'unverify_id')
--     order by target_id, created_at desc
--   )
--   select ha.id as application_id, ha.host_id, ha.apartment_title,
--          coalesce(l.action = 'verify_id', false) as keeps_id_verified
--   from public.host_applications ha
--   left join latest_id_action l on l.target_id = ha.id::text
--   where ha.id_verified = true
--   order by keeps_id_verified, ha.apartment_title;
--
--   -- Hosts showing the badge today, and whether any of their applications has
--   -- a recorded ID check or a manual toggle (step 2 decides between them):
--   select h.id, coalesce(h.display_name, h.name) as host,
--          exists (
--            select 1 from public.host_applications ha
--            join public.admin_audit_log log
--              on log.target_type = 'application' and log.action = 'verify_id'
--             and log.target_id = ha.id::text
--            where ha.host_id = h.id
--          ) as has_recorded_id_check,
--          exists (
--            select 1 from public.admin_audit_log log
--            where log.target_type = 'host' and log.target_id = h.id::text
--              and log.action in ('set_verified_true', 'set_verified_false')
--          ) as has_manual_toggle
--   from public.hosts h
--   where h.is_verified = true
--   order by host;

-- ---------------------------------------------------------------------------
-- 1. host_applications.id_verified — keep it only where an admin's latest ID
--    action on the application is 'verify_id'.
-- ---------------------------------------------------------------------------
with latest_id_action as (
  select distinct on (target_id) target_id, action
  from public.admin_audit_log
  where target_type = 'application'
    and action in ('verify_id', 'unverify_id')
  order by target_id, created_at desc
)
update public.host_applications ha
set id_verified = false
where ha.id_verified = true
  and not exists (
    select 1
    from latest_id_action l
    where l.target_id = ha.id::text
      and l.action = 'verify_id'
  );

-- ---------------------------------------------------------------------------
-- 2. hosts.is_verified — from checked applications, or the latest manual
--    Verify toggle on /admin/users when that is more recent.
-- ---------------------------------------------------------------------------
with latest_id_check as (
  -- When each host's (still-valid) ID check was last recorded.
  select ha.host_id, max(log.created_at) as checked_at
  from public.host_applications ha
  join public.admin_audit_log log
    on log.target_type = 'application'
   and log.action = 'verify_id'
   and log.target_id = ha.id::text
  where ha.id_verified = true
  group by ha.host_id
),
latest_toggle as (
  select distinct on (target_id) target_id, action, created_at
  from public.admin_audit_log
  where target_type = 'host'
    and action in ('set_verified_true', 'set_verified_false')
  order by target_id, created_at desc
),
computed as (
  select
    h.id,
    case
      when t.target_id is not null
           and (c.checked_at is null or t.created_at > c.checked_at)
        then t.action = 'set_verified_true'
      else c.host_id is not null
    end as is_verified
  from public.hosts h
  left join latest_id_check c on c.host_id = h.id
  left join latest_toggle t on t.target_id = h.id::text
)
update public.hosts h
set is_verified = computed.is_verified
from computed
where computed.id = h.id
  and h.is_verified is distinct from computed.is_verified;

-- ---------------------------------------------------------------------------
-- 3. Only admins or the service role may change either flag.
-- ---------------------------------------------------------------------------
create or replace function public.can_set_verification_flags()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is null
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    );
$$;

revoke all on function public.can_set_verification_flags() from public;
grant execute on function public.can_set_verification_flags() to authenticated, service_role;

create or replace function public.guard_host_is_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can_set_verification_flags() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_verified := false;
  else
    new.is_verified := old.is_verified;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_host_is_verified on public.hosts;
create trigger guard_host_is_verified
before insert or update of is_verified on public.hosts
for each row execute function public.guard_host_is_verified();

create or replace function public.guard_application_id_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can_set_verification_flags() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.id_verified := false;
  else
    new.id_verified := old.id_verified;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_application_id_verified on public.host_applications;
create trigger guard_application_id_verified
before insert or update of id_verified on public.host_applications
for each row execute function public.guard_application_id_verified();
