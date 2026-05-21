-- Full host application edit and structured admin review sections.
-- Safe to run more than once.

ALTER TABLE public.host_applications
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS show_full_name boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_doc_type text,
  ADD COLUMN IF NOT EXISTS id_doc_type text,
  ADD COLUMN IF NOT EXISTS admin_feedback_sections text[] NOT NULL DEFAULT ARRAY[]::text[];

INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-photos', 'listing-photos', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can add own application photos" ON public.listing_photos;
CREATE POLICY "Hosts can add own application photos"
ON public.listing_photos
FOR INSERT
TO authenticated
WITH CHECK (
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
);

DROP POLICY IF EXISTS "Hosts can delete own application photos" ON public.listing_photos;
CREATE POLICY "Hosts can delete own application photos"
ON public.listing_photos
FOR DELETE
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
);

DROP POLICY IF EXISTS "Authenticated users can upload listing photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload listing photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'listing-photos');

DROP POLICY IF EXISTS "Authenticated users can manage listing photos" ON storage.objects;
CREATE POLICY "Authenticated users can manage listing photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'listing-photos');

CREATE OR REPLACE FUNCTION public.update_current_host_application(
  application_uuid uuid,
  new_host_name text,
  new_display_name text,
  new_show_full_name boolean,
  new_email text,
  new_phone text,
  new_whatsapp_number text,
  new_host_type text,
  new_title text,
  new_area text,
  new_exact_address text,
  new_latitude double precision,
  new_longitude double precision,
  new_bedrooms integer,
  new_bathrooms numeric,
  new_sleeps integer,
  new_currency_preference text,
  new_price_ils integer,
  new_price_usd integer,
  new_amenities text[],
  new_description text,
  new_photo_link text,
  new_verification_doc_type text,
  new_id_doc_type text
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
  SET host_name = trim(new_host_name),
      display_name = trim(new_display_name),
      show_full_name = COALESCE(new_show_full_name, false),
      email = trim(new_email),
      phone = NULLIF(trim(COALESCE(new_phone, '')), ''),
      whatsapp_number = NULLIF(trim(COALESCE(new_whatsapp_number, '')), ''),
      host_type = trim(new_host_type),
      apartment_title = trim(new_title),
      area = trim(new_area),
      exact_address = trim(new_exact_address),
      latitude = new_latitude,
      longitude = new_longitude,
      bedrooms = new_bedrooms,
      bathrooms = new_bathrooms,
      sleeps = new_sleeps,
      currency_preference = trim(new_currency_preference),
      price_ils = new_price_ils,
      price_usd = new_price_usd,
      amenities = COALESCE(new_amenities, ARRAY[]::text[]),
      description = trim(new_description),
      photo_link = NULLIF(trim(COALESCE(new_photo_link, '')), ''),
      verification_doc_type = trim(new_verification_doc_type),
      id_doc_type = trim(new_id_doc_type),
      status = 'in_review',
      admin_feedback = NULL,
      admin_feedback_sections = ARRAY[]::text[],
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

GRANT EXECUTE ON FUNCTION public.update_current_host_application(
  uuid,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  integer,
  numeric,
  integer,
  text,
  integer,
  integer,
  text[],
  text,
  text,
  text,
  text
) TO authenticated;
