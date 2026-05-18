-- Make host-facing access work whether a host id equals auth.uid() or is linked through hosts.user_id.

DROP POLICY IF EXISTS "Hosts can view own applications" ON public.host_applications;
CREATE POLICY "Hosts can view own applications"
ON public.host_applications
FOR SELECT
TO authenticated
USING (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = host_applications.host_id
      AND hosts.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Hosts can view own listings" ON public.listings;
CREATE POLICY "Hosts can view own listings"
ON public.listings
FOR SELECT
TO authenticated
USING (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = listings.host_id
      AND hosts.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Hosts can view own listing photos" ON public.listing_photos;
CREATE POLICY "Hosts can view own listing photos"
ON public.listing_photos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.host_applications
    WHERE host_applications.id = listing_photos.application_id
      AND (
        host_applications.host_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.hosts
          WHERE hosts.id = host_applications.host_id
            AND hosts.user_id = auth.uid()
        )
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.listings
    WHERE listings.id = listing_photos.listing_id
      AND (
        listings.host_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.hosts
          WHERE hosts.id = listings.host_id
            AND hosts.user_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "Hosts can view own unavailable ranges" ON public.listing_unavailable_ranges;
CREATE POLICY "Hosts can view own unavailable ranges"
ON public.listing_unavailable_ranges
FOR SELECT
TO authenticated
USING (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = listing_unavailable_ranges.host_id
      AND hosts.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Hosts can insert own unavailable ranges" ON public.listing_unavailable_ranges;
CREATE POLICY "Hosts can insert own unavailable ranges"
ON public.listing_unavailable_ranges
FOR INSERT
TO authenticated
WITH CHECK (
  (
    host_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.hosts
      WHERE hosts.id = listing_unavailable_ranges.host_id
        AND hosts.user_id = auth.uid()
    )
  )
  AND EXISTS (
    SELECT 1
    FROM public.listings
    WHERE listings.id = listing_unavailable_ranges.listing_id
      AND listings.host_id = listing_unavailable_ranges.host_id
  )
);

DROP POLICY IF EXISTS "Hosts can delete own unavailable ranges" ON public.listing_unavailable_ranges;
CREATE POLICY "Hosts can delete own unavailable ranges"
ON public.listing_unavailable_ranges
FOR DELETE
TO authenticated
USING (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = listing_unavailable_ranges.host_id
      AND hosts.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Hosts can view own payment profile" ON public.host_payment_profiles;
CREATE POLICY "Hosts can view own payment profile"
ON public.host_payment_profiles
FOR SELECT
TO authenticated
USING (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = host_payment_profiles.host_id
      AND hosts.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Hosts can insert own payment profile" ON public.host_payment_profiles;
CREATE POLICY "Hosts can insert own payment profile"
ON public.host_payment_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = host_payment_profiles.host_id
      AND hosts.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Hosts can update own payment profile" ON public.host_payment_profiles;
CREATE POLICY "Hosts can update own payment profile"
ON public.host_payment_profiles
FOR UPDATE
TO authenticated
USING (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = host_payment_profiles.host_id
      AND hosts.user_id = auth.uid()
  )
)
WITH CHECK (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = host_payment_profiles.host_id
      AND hosts.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Hosts can view own booking payments" ON public.booking_payments;
CREATE POLICY "Hosts can view own booking payments"
ON public.booking_payments
FOR SELECT
TO authenticated
USING (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = booking_payments.host_id
      AND hosts.user_id = auth.uid()
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
  current_user_id uuid := auth.uid();
  current_host_id uuid;
  updated_listing public.listings%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT hosts.id
  INTO current_host_id
  FROM public.hosts
  WHERE hosts.id = current_user_id
     OR hosts.user_id = current_user_id
  ORDER BY CASE WHEN hosts.id = current_user_id THEN 0 ELSE 1 END
  LIMIT 1;

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
    AND host_id IN (COALESCE(current_host_id, current_user_id), current_user_id)
  RETURNING * INTO updated_listing;

  IF updated_listing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  RETURN updated_listing;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_current_host_application(
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
  new_description text
)
RETURNS public.host_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_host_id uuid;
  updated_application public.host_applications%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT hosts.id
  INTO current_host_id
  FROM public.hosts
  WHERE hosts.id = current_user_id
     OR hosts.user_id = current_user_id
  ORDER BY CASE WHEN hosts.id = current_user_id THEN 0 ELSE 1 END
  LIMIT 1;

  UPDATE public.host_applications
  SET apartment_title = trim(new_title),
      area = trim(new_area),
      exact_address = trim(new_exact_address),
      latitude = new_latitude,
      longitude = new_longitude,
      bedrooms = new_bedrooms,
      bathrooms = new_bathrooms,
      sleeps = new_sleeps,
      price_ils = new_price_ils,
      price_usd = new_price_usd,
      amenities = COALESCE(new_amenities, ARRAY[]::text[]),
      description = trim(new_description),
      status = 'in_review',
      admin_feedback = NULL,
      changes_requested_at = NULL
  WHERE id = application_uuid
    AND host_id IN (COALESCE(current_host_id, current_user_id), current_user_id)
    AND status IN ('new', 'in_review', 'changes_requested', 'rejected')
  RETURNING * INTO updated_application;

  IF updated_application.id IS NULL THEN
    RAISE EXCEPTION 'Application not found or cannot be edited';
  END IF;

  RETURN updated_application;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_host_payment_preferences(
  accepts_direct boolean,
  instructions text,
  currency_code text
)
RETURNS public.host_payment_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_host_id uuid;
  updated_profile public.host_payment_profiles%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT hosts.id
  INTO current_host_id
  FROM public.hosts
  WHERE hosts.id = current_user_id
     OR hosts.user_id = current_user_id
  ORDER BY CASE WHEN hosts.id = current_user_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF current_host_id IS NULL THEN
    RAISE EXCEPTION 'Host profile not found';
  END IF;

  IF accepts_direct AND trim(COALESCE(instructions, '')) = '' THEN
    RAISE EXCEPTION 'Direct payment instructions are required';
  END IF;

  INSERT INTO public.host_payment_profiles (
    host_id,
    accepts_direct_payment,
    direct_payment_instructions,
    preferred_currency
  )
  VALUES (
    current_host_id,
    accepts_direct,
    NULLIF(trim(COALESCE(instructions, '')), ''),
    NULLIF(upper(trim(COALESCE(currency_code, ''))), '')
  )
  ON CONFLICT (host_id) DO UPDATE
  SET accepts_direct_payment = EXCLUDED.accepts_direct_payment,
      direct_payment_instructions = EXCLUDED.direct_payment_instructions,
      preferred_currency = EXCLUDED.preferred_currency,
      updated_at = now()
  RETURNING * INTO updated_profile;

  RETURN updated_profile;
END;
$$;

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

GRANT EXECUTE ON FUNCTION public.update_current_host_application(
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
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_host_payment_preferences(boolean, text, text) TO authenticated;
