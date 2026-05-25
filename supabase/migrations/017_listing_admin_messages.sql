-- Admin-to-host messages tied to live listings.

CREATE TABLE IF NOT EXISTS public.listing_admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS listing_admin_messages_listing_idx
  ON public.listing_admin_messages (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_admin_messages_host_idx
  ON public.listing_admin_messages (host_id, created_at DESC);

ALTER TABLE public.listing_admin_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can view own listing admin messages" ON public.listing_admin_messages;

CREATE POLICY "Hosts can view own listing admin messages"
ON public.listing_admin_messages
FOR SELECT
TO authenticated
USING (host_id = auth.uid());

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
