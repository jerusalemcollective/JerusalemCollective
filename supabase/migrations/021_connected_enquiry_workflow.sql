-- Connected guest enquiry, host inbox, and admin work queue.

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  host_id uuid REFERENCES public.hosts(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  check_in date,
  check_out date,
  guests integer NOT NULL DEFAULT 1,
  message text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS host_id uuid REFERENCES public.hosts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS check_in date,
  ADD COLUMN IF NOT EXISTS check_out date,
  ADD COLUMN IF NOT EXISTS guests integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_status_check;

ALTER TABLE public.booking_requests
  ADD CONSTRAINT booking_requests_status_check
  CHECK (status IN ('new', 'host_replied', 'accepted', 'declined', 'closed'));

ALTER TABLE public.booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_guests_check;

ALTER TABLE public.booking_requests
  ADD CONSTRAINT booking_requests_guests_check CHECK (guests >= 1);

CREATE INDEX IF NOT EXISTS booking_requests_conversation_idx
  ON public.booking_requests (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS booking_requests_host_status_idx
  ON public.booking_requests (host_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS booking_requests_guest_status_idx
  ON public.booking_requests (guest_id, status, created_at DESC);

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guests can view own booking requests" ON public.booking_requests;
CREATE POLICY "Guests can view own booking requests"
ON public.booking_requests
FOR SELECT
TO authenticated
USING (guest_id = auth.uid());

DROP POLICY IF EXISTS "Hosts can view own booking requests" ON public.booking_requests;
CREATE POLICY "Hosts can view own booking requests"
ON public.booking_requests
FOR SELECT
TO authenticated
USING (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = booking_requests.host_id
      AND hosts.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can view all booking requests" ON public.booking_requests;
CREATE POLICY "Admins can view all booking requests"
ON public.booking_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
  )
);

DROP POLICY IF EXISTS "Guests can create own booking requests" ON public.booking_requests;
CREATE POLICY "Guests can create own booking requests"
ON public.booking_requests
FOR INSERT
TO authenticated
WITH CHECK (guest_id = auth.uid());

DROP POLICY IF EXISTS "Hosts and admins can update booking request status" ON public.booking_requests;
CREATE POLICY "Hosts and admins can update booking request status"
ON public.booking_requests
FOR UPDATE
TO authenticated
USING (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = booking_requests.host_id
      AND hosts.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
  )
)
WITH CHECK (
  host_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.hosts
    WHERE hosts.id = booking_requests.host_id
      AND hosts.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
  )
);

DROP TRIGGER IF EXISTS update_booking_requests_updated_at ON public.booking_requests;
CREATE TRIGGER update_booking_requests_updated_at
  BEFORE UPDATE ON public.booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_listing_enquiry(
  target_listing_id uuid,
  check_in_date date DEFAULT NULL,
  check_out_date date DEFAULT NULL,
  guest_count integer DEFAULT 1,
  message_body text DEFAULT NULL
)
RETURNS TABLE (
  request_id uuid,
  conversation_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  listing_record public.listings%ROWTYPE;
  host_account_id uuid;
  conversation_record public.conversations%ROWTYPE;
  request_record public.booking_requests%ROWTYPE;
  clean_message text := NULLIF(trim(COALESCE(message_body, '')), '');
  request_message text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_listing_id IS NULL THEN
    RAISE EXCEPTION 'Listing is required';
  END IF;

  IF COALESCE(guest_count, 0) < 1 THEN
    RAISE EXCEPTION 'Guest count must be at least 1';
  END IF;

  IF check_in_date IS NOT NULL AND check_out_date IS NOT NULL AND check_out_date <= check_in_date THEN
    RAISE EXCEPTION 'Check-out must be after check-in';
  END IF;

  SELECT *
  INTO listing_record
  FROM public.listings
  WHERE id = target_listing_id
    AND is_published = TRUE;

  IF listing_record.id IS NULL THEN
    RAISE EXCEPTION 'Listing not available';
  END IF;

  SELECT COALESCE(hosts.user_id, hosts.id)
  INTO host_account_id
  FROM public.hosts
  WHERE hosts.id = listing_record.host_id
  LIMIT 1;

  host_account_id := COALESCE(host_account_id, listing_record.host_id);

  IF host_account_id IS NULL THEN
    RAISE EXCEPTION 'Host not available';
  END IF;

  INSERT INTO public.conversations (
    participant_1,
    participant_2,
    listing_id
  )
  VALUES (
    current_user_id,
    host_account_id,
    target_listing_id
  )
  ON CONFLICT (participant_1, participant_2, listing_id)
  DO UPDATE SET updated_at = now()
  RETURNING * INTO conversation_record;

  request_message := COALESCE(clean_message, 'I would like to enquire about this stay.');

  IF check_in_date IS NOT NULL OR check_out_date IS NOT NULL THEN
    request_message := request_message
      || E'\n\nRequested dates: '
      || COALESCE(check_in_date::text, 'not set')
      || ' to '
      || COALESCE(check_out_date::text, 'not set');
  END IF;

  request_message := request_message || E'\nGuests: ' || COALESCE(guest_count, 1)::text;

  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    content
  )
  VALUES (
    conversation_record.id,
    current_user_id,
    request_message
  );

  INSERT INTO public.booking_requests (
    listing_id,
    host_id,
    guest_id,
    conversation_id,
    check_in,
    check_out,
    guests,
    message,
    status
  )
  VALUES (
    target_listing_id,
    listing_record.host_id,
    current_user_id,
    conversation_record.id,
    check_in_date,
    check_out_date,
    COALESCE(guest_count, 1),
    clean_message,
    'new'
  )
  RETURNING * INTO request_record;

  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = conversation_record.id;

  RETURN QUERY
  SELECT request_record.id, conversation_record.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_booking_request_status(
  request_uuid uuid,
  new_status text
)
RETURNS public.booking_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  updated_request public.booking_requests%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF new_status NOT IN ('host_replied', 'accepted', 'declined', 'closed') THEN
    RAISE EXCEPTION 'Invalid request status';
  END IF;

  UPDATE public.booking_requests
  SET status = new_status,
      updated_at = now()
  WHERE id = request_uuid
    AND (
      host_id = current_user_id
      OR EXISTS (
        SELECT 1
        FROM public.hosts
        WHERE hosts.id = booking_requests.host_id
          AND hosts.user_id = current_user_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = current_user_id
          AND profiles.is_admin = TRUE
      )
    )
  RETURNING * INTO updated_request;

  IF updated_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  RETURN updated_request;
END;
$$;

REVOKE ALL ON FUNCTION public.create_listing_enquiry(uuid, date, date, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_booking_request_status(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_listing_enquiry(uuid, date, date, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_booking_request_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_has_admin_permission(required_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.current_user_admin_role()
    WHEN 'owner' THEN TRUE
    WHEN 'operations' THEN required_permission IN (
      'overview',
      'applications',
      'listings',
      'hosts',
      'guests',
      'reviews',
      'analytics',
      'messages'
    )
    WHEN 'support' THEN required_permission IN (
      'overview',
      'hosts',
      'guests',
      'cases',
      'messages'
    )
    WHEN 'content' THEN required_permission IN (
      'overview',
      'applications',
      'listings',
      'reviews',
      'analytics'
    )
    WHEN 'analyst' THEN required_permission IN (
      'overview',
      'analytics',
      'hosts',
      'guests'
    )
    ELSE FALSE
  END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_has_admin_permission(text) TO authenticated;
