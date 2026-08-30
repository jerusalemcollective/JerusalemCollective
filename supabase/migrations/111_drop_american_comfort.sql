-- 111_drop_american_comfort.sql
--
-- The "American comfort" feature (central AC, full-size American washer/dryer,
-- American mattresses, powerful boiler + the derived american_comfort flag) has
-- been retired — it was redundant with the standard Everyday-comfort amenities.
-- The application code no longer reads or writes these columns; drop them.

alter table public.listings
  drop column if exists american_comfort,
  drop column if exists central_ac,
  drop column if exists american_washer_dryer,
  drop column if exists american_mattress,
  drop column if exists powerful_water_heater;

alter table public.host_applications
  drop column if exists american_comfort,
  drop column if exists central_ac,
  drop column if exists american_washer_dryer,
  drop column if exists american_mattress,
  drop column if exists powerful_water_heater;
