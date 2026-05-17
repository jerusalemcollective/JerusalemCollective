-- Let hosts securely view only their own applications, live listings, and photos.

ALTER TABLE public.host_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can view own applications" ON public.host_applications;
DROP POLICY IF EXISTS "Hosts can view own listings" ON public.listings;
DROP POLICY IF EXISTS "Hosts can view own listing photos" ON public.listing_photos;

CREATE POLICY "Hosts can view own applications"
ON public.host_applications
FOR SELECT
TO authenticated
USING (host_id = auth.uid());

CREATE POLICY "Hosts can view own listings"
ON public.listings
FOR SELECT
TO authenticated
USING (host_id = auth.uid());

CREATE POLICY "Hosts can view own listing photos"
ON public.listing_photos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.host_applications
    WHERE host_applications.id = listing_photos.application_id
      AND host_applications.host_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.listings
    WHERE listings.id = listing_photos.listing_id
      AND listings.host_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.update_current_host_listing(
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
  new_description text
)
RETURNS public.listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_listing public.listings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF new_booking_type NOT IN ('request', 'enquiry', 'instant') THEN
    RAISE EXCEPTION 'Invalid booking type';
  END IF;

  IF trim(COALESCE(new_title, '')) = '' OR trim(COALESCE(new_area, '')) = '' THEN
    RAISE EXCEPTION 'Title and area are required';
  END IF;

  IF COALESCE(new_bedrooms, 0) < 0 OR COALESCE(new_max_guests, 0) < 1 THEN
    RAISE EXCEPTION 'Bedrooms and guest capacity are invalid';
  END IF;

  UPDATE public.listings
  SET title = trim(new_title),
      area = trim(new_area),
      bedrooms = new_bedrooms,
      bathrooms = new_bathrooms,
      max_guests = new_max_guests,
      price_ils = new_price_ils,
      price_usd = new_price_usd,
      booking_type = new_booking_type,
      amenities = COALESCE(new_amenities, ARRAY[]::text[]),
      description = NULLIF(trim(COALESCE(new_description, '')), ''),
      updated_at = now()
  WHERE id = listing_uuid
    AND host_id = auth.uid()
  RETURNING * INTO updated_listing;

  IF updated_listing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  RETURN updated_listing;
END;
$$;

REVOKE ALL ON FUNCTION public.update_current_host_listing(
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
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_current_host_listing(
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
  text
) TO authenticated;
