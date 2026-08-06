-- 094_drop_preferred_dashboard.sql
-- Reverts 093. The post-login dashboard chooser no longer remembers a choice
-- (it always asks), so profiles.preferred_dashboard and its check constraint are
-- unused. Safe to run whether or not 093 was ever applied.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_preferred_dashboard_check;
ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_dashboard;
