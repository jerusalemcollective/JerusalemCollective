-- 119_allow_mehadrin_kitchen.sql
--
-- The host listing editor offers kosher_kitchen_level = 'mehadrin', but the check
-- constraints added with the column in migrations 044/045 (inline column checks,
-- so Postgres named them <table>_kosher_kitchen_level_check) did not allow it, so
-- saving "Mehadrin" failed. Recreate both constraints with 'mehadrin' added and
-- every earlier value kept.

alter table public.listings
  drop constraint if exists listings_kosher_kitchen_level_check;

alter table public.listings
  add constraint listings_kosher_kitchen_level_check
  check (kosher_kitchen_level in (
    'not_kosher',
    'kosher_friendly',
    'kosher',
    'glatt_kosher',
    'chalav_yisrael',
    'mehadrin'
  ));

alter table public.host_applications
  drop constraint if exists host_applications_kosher_kitchen_level_check;

alter table public.host_applications
  add constraint host_applications_kosher_kitchen_level_check
  check (kosher_kitchen_level in (
    'not_kosher',
    'kosher_friendly',
    'kosher',
    'glatt_kosher',
    'chalav_yisrael',
    'mehadrin'
  ));

notify pgrst, 'reload schema';
