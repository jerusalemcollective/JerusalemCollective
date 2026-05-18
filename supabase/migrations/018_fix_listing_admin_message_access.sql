-- Fix admin-to-host listing message visibility.
-- listing_admin_messages.host_id stores public.hosts.id, while auth.uid() is the signed-in user's id.

DROP POLICY IF EXISTS "Hosts can view own listing admin messages" ON public.listing_admin_messages;
DROP POLICY IF EXISTS "Admins can view listing admin messages" ON public.listing_admin_messages;

CREATE POLICY "Hosts can view own listing admin messages"
ON public.listing_admin_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
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
