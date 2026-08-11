-- Host-reported support cases + a direct "Contact JLM" chat.
--
-- 1. Widen case_type so hosts can report damage / rule breaks / non-payment /
--    no-shows, not just the guest-side dispute types.
-- 2. Add attachment_urls for damage evidence (object paths in case-photos).
-- 3. A SECURITY DEFINER create RPC so a host can file a case about their own
--    booking without a broad INSERT policy (hosts had SELECT-only before).
-- 4. A private case-photos storage bucket for damage evidence.
-- 5. A get-or-create RPC for the host <-> JLM (owner admin) support chat.

-- 1. Case types -------------------------------------------------------------
ALTER TABLE public.support_cases DROP CONSTRAINT IF EXISTS support_cases_case_type_check;
ALTER TABLE public.support_cases ADD CONSTRAINT support_cases_case_type_check
  CHECK (case_type IN (
    'dispute', 'refund_request', 'damage', 'cancellation', 'other',
    'broke_house_rules', 'didnt_pay', 'no_show'
  ));

-- 2. Attachments ------------------------------------------------------------
ALTER TABLE public.support_cases
  ADD COLUMN IF NOT EXISTS attachment_urls text[] NOT NULL DEFAULT '{}';

-- 3. Host-side create RPC ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_host_support_case(
  target_booking_id uuid,
  case_type_input text,
  reason_input text,
  details_input text,
  requested_amount_input numeric,
  currency_input text,
  attachment_urls_input text[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  b_listing_id uuid;
  b_host_id uuid;
  b_guest_id uuid;
  new_case_id uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF case_type_input NOT IN ('damage', 'broke_house_rules', 'didnt_pay', 'no_show', 'other') THEN
    RAISE EXCEPTION 'Invalid case type';
  END IF;

  IF reason_input IS NULL OR length(trim(reason_input)) = 0 THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  SELECT b.listing_id, b.host_id, b.user_id
    INTO b_listing_id, b_host_id, b_guest_id
  FROM public.bookings b
  WHERE b.id = target_booking_id;

  IF b_host_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- The caller must own the host the booking belongs to (covers split-identity
  -- hosts where hosts.id <> hosts.user_id).
  IF NOT EXISTS (
    SELECT 1 FROM public.hosts h
    WHERE h.id = b_host_id
      AND (h.id = caller OR h.user_id = caller)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this booking';
  END IF;

  INSERT INTO public.support_cases (
    booking_id, listing_id, guest_id, host_id, case_type, reason, details,
    requested_amount, currency, attachment_urls, created_by
  ) VALUES (
    target_booking_id, b_listing_id, b_guest_id, b_host_id,
    case_type_input, trim(reason_input), NULLIF(trim(details_input), ''),
    requested_amount_input, currency_input, COALESCE(attachment_urls_input, '{}'),
    caller
  )
  RETURNING id INTO new_case_id;

  RETURN new_case_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_host_support_case(uuid, text, text, text, numeric, text, text[]) TO authenticated;

-- 4. Damage-evidence bucket -------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-photos', 'case-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "case-photos owner insert" ON storage.objects;
DROP POLICY IF EXISTS "case-photos owner read" ON storage.objects;
DROP POLICY IF EXISTS "case-photos admin all" ON storage.objects;

CREATE POLICY "case-photos owner insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'case-photos' AND owner = auth.uid());

CREATE POLICY "case-photos owner read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'case-photos' AND owner = auth.uid());

CREATE POLICY "case-photos admin all" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'case-photos'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
)
WITH CHECK (
  bucket_id = 'case-photos'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 5. Host <-> JLM support chat ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_jlm_conversation()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  admin_id uuid;
  convo_id uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Prefer the owner admin; fall back to any admin.
  SELECT id INTO admin_id
  FROM public.profiles
  WHERE is_admin = true AND admin_role = 'owner'
  ORDER BY created_at
  LIMIT 1;

  IF admin_id IS NULL THEN
    SELECT id INTO admin_id
    FROM public.profiles
    WHERE is_admin = true
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No JLM admin is configured';
  END IF;

  IF admin_id = caller THEN
    RAISE EXCEPTION 'Admins use the admin inbox, not the JLM chat';
  END IF;

  SELECT id INTO convo_id
  FROM public.conversations
  WHERE participant_1 = caller AND participant_2 = admin_id AND listing_id IS NULL
  LIMIT 1;

  IF convo_id IS NULL THEN
    INSERT INTO public.conversations (participant_1, participant_2, listing_id)
    VALUES (caller, admin_id, NULL)
    RETURNING id INTO convo_id;
  END IF;

  RETURN convo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_jlm_conversation() TO authenticated;
