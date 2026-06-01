alter table public.listings
  add column if not exists sleeping_setup text;

alter table public.host_applications
  add column if not exists sleeping_setup text;

create or replace function public.update_current_host_listing(
  listing_uuid uuid,
  new_title text,
  new_area text,
  new_bedrooms integer,
  new_bathrooms numeric,
  new_max_guests integer,
  new_price_ils numeric,
  new_price_usd numeric,
  new_booking_type text,
  new_amenities text[],
  new_sleeping_setup text,
  new_description text
)
returns public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_host_id uuid;
  updated_listing public.listings%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select hosts.id
  into current_host_id
  from public.hosts
  where hosts.id = current_user_id
     or hosts.user_id = current_user_id
  order by case when hosts.id = current_user_id then 0 else 1 end
  limit 1;

  if new_booking_type not in ('request', 'enquiry', 'instant') then
    raise exception 'Invalid booking type';
  end if;

  if trim(coalesce(new_title, '')) = '' or trim(coalesce(new_area, '')) = '' then
    raise exception 'Title and area are required';
  end if;

  if coalesce(new_bedrooms, 0) < 0 or coalesce(new_max_guests, 0) < 1 then
    raise exception 'Bedrooms and guest capacity are invalid';
  end if;

  update public.listings
  set title = trim(new_title),
      area = trim(new_area),
      bedrooms = new_bedrooms,
      bathrooms = new_bathrooms,
      max_guests = new_max_guests,
      price_ils = new_price_ils,
      price_usd = new_price_usd,
      booking_type = new_booking_type,
      amenities = coalesce(new_amenities, array[]::text[]),
      sleeping_setup = nullif(trim(coalesce(new_sleeping_setup, '')), ''),
      description = nullif(trim(coalesce(new_description, '')), ''),
      updated_at = now()
  where id = listing_uuid
    and host_id in (coalesce(current_host_id, current_user_id), current_user_id)
  returning * into updated_listing;

  if updated_listing.id is null then
    raise exception 'Listing not found';
  end if;

  return updated_listing;
end;
$$;

create or replace function public.update_current_host_application(
  application_uuid uuid,
  new_title text,
  new_area text,
  new_exact_address text,
  new_latitude double precision,
  new_longitude double precision,
  new_bedrooms integer,
  new_bathrooms numeric,
  new_sleeps integer,
  new_price_ils integer,
  new_price_usd integer,
  new_amenities text[],
  new_sleeping_setup text,
  new_description text
)
returns public.host_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_host_id uuid;
  updated_application public.host_applications%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select hosts.id
  into current_host_id
  from public.hosts
  where hosts.id = current_user_id
     or hosts.user_id = current_user_id
  order by case when hosts.id = current_user_id then 0 else 1 end
  limit 1;

  update public.host_applications
  set apartment_title = trim(new_title),
      area = trim(new_area),
      exact_address = trim(new_exact_address),
      latitude = new_latitude,
      longitude = new_longitude,
      bedrooms = new_bedrooms,
      bathrooms = new_bathrooms,
      sleeps = new_sleeps,
      price_ils = new_price_ils,
      price_usd = new_price_usd,
      amenities = coalesce(new_amenities, array[]::text[]),
      sleeping_setup = nullif(trim(coalesce(new_sleeping_setup, '')), ''),
      description = trim(new_description),
      status = 'in_review',
      admin_feedback = null,
      changes_requested_at = null
  where id = application_uuid
    and host_id in (coalesce(current_host_id, current_user_id), current_user_id)
    and status in ('new', 'in_review', 'changes_requested', 'rejected')
  returning * into updated_application;

  if updated_application.id is null then
    raise exception 'Application not found or cannot be edited';
  end if;

  return updated_application;
end;
$$;

grant execute on function public.update_current_host_listing(
  uuid,
  text,
  text,
  integer,
  numeric,
  integer,
  numeric,
  numeric,
  text,
  text[],
  text,
  text
) to authenticated;

grant execute on function public.update_current_host_application(
  uuid,
  text,
  text,
  text,
  double precision,
  double precision,
  integer,
  numeric,
  integer,
  integer,
  integer,
  text[],
  text,
  text
) to authenticated;
