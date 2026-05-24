alter table listings
add column if not exists
  american_comfort boolean
    default false,
add column if not exists
  central_ac boolean default false,
add column if not exists
  american_washer_dryer boolean
    default false,
add column if not exists
  american_mattress boolean
    default false,
add column if not exists
  powerful_water_heater boolean
    default false;

alter table host_applications
add column if not exists
  american_comfort boolean
    default false,
add column if not exists
  central_ac boolean default false,
add column if not exists
  american_washer_dryer boolean
    default false,
add column if not exists
  american_mattress boolean
    default false,
add column if not exists
  powerful_water_heater boolean
    default false;
