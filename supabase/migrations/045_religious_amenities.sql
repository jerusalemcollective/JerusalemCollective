alter table listings
add column if not exists
  shabbat_elevator boolean default false,
add column if not exists
  physical_key_entry boolean default false,
add column if not exists
  shabbat_clock boolean default false,
add column if not exists
  kosher_kitchen_level text
    check (kosher_kitchen_level in (
      'not_kosher',
      'kosher_friendly',
      'kosher',
      'glatt_kosher',
      'chalav_yisrael'
    )),
add column if not exists
  walking_minutes_to_kotel integer,
add column if not exists
  near_synagogue boolean default false,
add column if not exists
  sukkah_balcony boolean default false;

alter table host_applications
add column if not exists
  shabbat_elevator boolean default false,
add column if not exists
  physical_key_entry boolean default false,
add column if not exists
  shabbat_clock boolean default false,
add column if not exists
  kosher_kitchen_level text
    check (kosher_kitchen_level in (
      'not_kosher',
      'kosher_friendly',
      'kosher',
      'glatt_kosher',
      'chalav_yisrael'
    )),
add column if not exists
  walking_minutes_to_kotel integer,
add column if not exists
  near_synagogue boolean default false,
add column if not exists
  sukkah_balcony boolean default false;

comment on column
  listings.kosher_kitchen_level is
  'Kashrut level of the kitchen as verified by the host.';

comment on column
  listings.walking_minutes_to_kotel is
  'Approximate walking minutes to the Kotel / Jaffa Gate. Set manually by host or calculated from coordinates.';
