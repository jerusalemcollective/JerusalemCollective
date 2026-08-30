-- 113_host_application_american_comfort.sql
--
-- The "American comfort" feature added these flags to the become-a-host form,
-- the listing schema, and the approval copy — but the columns were never added
-- to host_applications, so submitting a new listing failed with PGRST204
-- ("Could not find the 'american_mattress' column of 'host_applications'").
--
-- Add the individual flags (american_comfort itself stays derived — it's
-- computed from these when an application is approved into a listing).

alter table public.host_applications
  add column if not exists central_ac boolean not null default false,
  add column if not exists american_washer_dryer boolean not null default false,
  add column if not exists american_mattress boolean not null default false,
  add column if not exists powerful_water_heater boolean not null default false;
