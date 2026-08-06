-- 093_preferred_dashboard.sql
-- Post-login dashboard chooser.
-- Host accounts (those with a submitted application or an owned listing) land on
-- a chooser screen after login: Host dashboard vs Guest dashboard. This column
-- remembers that choice when the user ticks "Remember this choice".
--   NULL    -> ask every login (default)
--   'host'  -> skip the chooser, go straight to /host/dashboard
--   'guest' -> skip the chooser, go straight to /account
-- Guests without a host application never see the chooser and never set this.
--
-- No new RLS policy is required: the existing "Users can update own profile"
-- policy (migration 001) already lets a user write their own profiles row, and
-- the SELECT policy already lets a user read it.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_dashboard text;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_dashboard_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_preferred_dashboard_check
  CHECK (preferred_dashboard IS NULL OR preferred_dashboard IN ('host', 'guest'));
