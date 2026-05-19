-- Repair pack for host application pages and admin application/listing actions.
-- Safe to run more than once.

ALTER TABLE public.host_applications
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS verification_doc_type text,
  ADD COLUMN IF NOT EXISTS id_doc_type text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS id_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_feedback text,
  ADD COLUMN IF NOT EXISTS changes_requested_at timestamptz;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.host_applications(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS listings_application_id_unique_idx
  ON public.listings (application_id)
  WHERE application_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.listing_admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS listing_admin_messages_listing_idx
  ON public.listing_admin_messages (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_admin_messages_host_idx
  ON public.listing_admin_messages (host_id, created_at DESC);

ALTER TABLE public.listing_admin_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can view own listing admin messages" ON public.listing_admin_messages;
DROP POLICY IF EXISTS "Admins can view listing admin messages" ON public.listing_admin_messages;

CREATE POLICY "Hosts can view own listing admin messages"
ON public.listing_admin_messages
FOR SELECT
TO authenticated
USING (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = listing_admin_messages.host_id
      AND hosts.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view listing admin messages"
ON public.listing_admin_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
);

CREATE OR REPLACE FUNCTION public.send_listing_admin_message(
  target_listing_id uuid,
  message_body text
)
RETURNS public.listing_admin_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  target_host_id uuid;
  created_message public.listing_admin_messages%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = current_user_id
      AND profiles.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF trim(COALESCE(message_body, '')) = '' THEN
    RAISE EXCEPTION 'Message body is required';
  END IF;

  SELECT listings.host_id
  INTO target_host_id
  FROM public.listings
  WHERE listings.id = target_listing_id;

  IF target_host_id IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  INSERT INTO public.listing_admin_messages (
    listing_id,
    host_id,
    body
  )
  VALUES (
    target_listing_id,
    target_host_id,
    trim(message_body)
  )
  RETURNING * INTO created_message;

  RETURN created_message;
END;
$$;

REVOKE ALL ON FUNCTION public.send_listing_admin_message(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_listing_admin_message(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Admins can view all host applications" ON public.host_applications;
DROP POLICY IF EXISTS "Admins can update all host applications" ON public.host_applications;
DROP POLICY IF EXISTS "Admins can create listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can update listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can update listing photos" ON public.listing_photos;

CREATE POLICY "Admins can view all host applications"
ON public.host_applications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can update all host applications"
ON public.host_applications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can create listings"
ON public.listings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can update listings"
ON public.listings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can update listing photos"
ON public.listing_photos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
  )
);
