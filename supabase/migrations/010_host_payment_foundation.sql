-- Airbnb-style payment foundation: platform checkout, simple host payouts, optional direct-to-host payment.

CREATE TABLE IF NOT EXISTS public.host_payment_profiles (
  host_id uuid PRIMARY KEY REFERENCES public.hosts(id) ON DELETE CASCADE,
  stripe_account_id text,
  payout_setup_status text NOT NULL DEFAULT 'not_started'
    CHECK (payout_setup_status IN ('not_started', 'pending', 'ready', 'restricted')),
  stripe_charges_enabled boolean NOT NULL DEFAULT false,
  stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  accepts_direct_payment boolean NOT NULL DEFAULT false,
  direct_payment_instructions text,
  preferred_currency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_mode text NOT NULL CHECK (payment_mode IN ('platform_checkout', 'direct_to_host')),
  payment_method text,
  currency text NOT NULL,
  amount numeric(10,2) NOT NULL,
  platform_fee_amount numeric(10,2) NOT NULL DEFAULT 0,
  processor_fee_amount numeric(10,2) NOT NULL DEFAULT 0,
  host_payout_amount numeric(10,2) NOT NULL,
  fee_payer text NOT NULL DEFAULT 'host'
    CHECK (fee_payer IN ('host', 'platform', 'guest')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'requires_action', 'processing', 'paid', 'failed', 'cancelled')),
  stripe_payment_intent_id text,
  stripe_charge_id text,
  direct_payment_reference text,
  proof_url text,
  paid_at timestamptz,
  payout_status text NOT NULL DEFAULT 'not_ready'
    CHECK (payout_status IN ('not_ready', 'ready', 'scheduled', 'paid', 'cancelled')),
  payout_released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_payments_host_id_idx
  ON public.booking_payments (host_id, created_at DESC);

CREATE INDEX IF NOT EXISTS booking_payments_guest_id_idx
  ON public.booking_payments (guest_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.calculate_host_payout_amount(
  gross_amount numeric,
  platform_fee numeric DEFAULT 0,
  processor_fee numeric DEFAULT 0,
  paid_by text DEFAULT 'host'
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN paid_by = 'host' THEN greatest(COALESCE(gross_amount, 0) - COALESCE(platform_fee, 0) - COALESCE(processor_fee, 0), 0)
    WHEN paid_by IN ('platform', 'guest') THEN greatest(COALESCE(gross_amount, 0) - COALESCE(platform_fee, 0), 0)
    ELSE greatest(COALESCE(gross_amount, 0) - COALESCE(platform_fee, 0), 0)
  END;
$$;

ALTER TABLE public.host_payment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can view own payment profile" ON public.host_payment_profiles;
DROP POLICY IF EXISTS "Hosts can update own payment profile" ON public.host_payment_profiles;
DROP POLICY IF EXISTS "Hosts can insert own payment profile" ON public.host_payment_profiles;
DROP POLICY IF EXISTS "Hosts can view own booking payments" ON public.booking_payments;
DROP POLICY IF EXISTS "Guests can view own booking payments" ON public.booking_payments;

CREATE POLICY "Hosts can view own payment profile"
ON public.host_payment_profiles
FOR SELECT
TO authenticated
USING (host_id = auth.uid());

CREATE POLICY "Hosts can insert own payment profile"
ON public.host_payment_profiles
FOR INSERT
TO authenticated
WITH CHECK (host_id = auth.uid());

CREATE POLICY "Hosts can update own payment profile"
ON public.host_payment_profiles
FOR UPDATE
TO authenticated
USING (host_id = auth.uid())
WITH CHECK (host_id = auth.uid());

CREATE POLICY "Hosts can view own booking payments"
ON public.booking_payments
FOR SELECT
TO authenticated
USING (host_id = auth.uid());

CREATE POLICY "Guests can view own booking payments"
ON public.booking_payments
FOR SELECT
TO authenticated
USING (guest_id = auth.uid());

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
  updated_profile public.host_payment_profiles%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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
    current_user_id,
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

REVOKE ALL ON FUNCTION public.update_host_payment_preferences(boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_host_payment_preferences(boolean, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.calculate_host_payout_amount(numeric, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_host_payout_amount(numeric, numeric, numeric, text) TO authenticated;
