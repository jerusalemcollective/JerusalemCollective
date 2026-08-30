-- 112_kosher_kitchen_level_from_amenity.sql
--
-- Kosher is now a single level dropdown (kosher_kitchen_level) instead of a
-- "Kosher kitchen" amenity + a separate level. Preserve existing listings that
-- flagged the old amenity: give them a level (default 'kosher' — the array can't
-- tell us Mehadrin), then drop the retired amenity from every array so it doesn't
-- linger as an untracked value.

update public.listings
set kosher_kitchen_level = 'kosher'
where 'Kosher kitchen' = any(amenities)
  and (kosher_kitchen_level is null or kosher_kitchen_level = '');

update public.listings
set amenities = array_remove(amenities, 'Kosher kitchen')
where 'Kosher kitchen' = any(amenities);

-- Same for pending applications, so an approval carries the level through.
update public.host_applications
set kosher_kitchen_level = 'kosher'
where 'Kosher kitchen' = any(amenities)
  and (kosher_kitchen_level is null or kosher_kitchen_level = '');

update public.host_applications
set amenities = array_remove(amenities, 'Kosher kitchen')
where 'Kosher kitchen' = any(amenities);
