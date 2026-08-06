-- 090_balance_attach_allow_retry.sql
--
-- Fix a regression introduced by 089: the `balance_checkout_session_id is null`
-- guard on attach_balance_checkout_session permanently blocked a guest from
-- retrying a balance payment after abandoning or expiring the first checkout
-- (nothing ever clears the stored session id), so the balance became
-- uncollectable online.
--
-- That guard is NOT needed for safety: cross-booking session reuse is already
-- prevented by the unique index booking_payments_balance_session_uniq (one
-- session id can bind to at most one row) and by mark_balance_paid, which
-- settles only the row whose id + session + amount + currency all match. Allow
-- the guest to overwrite their OWN row's pending balance session so retry works;
-- if they later pay a stale/abandoned session, mark_balance_paid no longer
-- matches it and the webhook escalates it to manual review rather than losing it.

create or replace function public.attach_balance_checkout_session(
  payment_uuid uuid,
  checkout_session_id text
)
returns public.booking_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  payment_record public.booking_payments%rowtype;
begin
  if current_user_id is null then
    raise exception 'Please sign in.';
  end if;
  if coalesce(trim(checkout_session_id), '') = '' then
    raise exception 'A checkout session id is required.';
  end if;

  update public.booking_payments
  set balance_checkout_session_id = checkout_session_id,
      updated_at = now()
  where id = payment_uuid
    and guest_id = current_user_id
    and status = 'paid'          -- deposit settled + booking finalised
    and balance_status = 'due'
    and balance_amount > 0
  returning * into payment_record;

  if payment_record.id is null then
    raise exception 'That balance could not be linked to a checkout session.';
  end if;

  return payment_record;
end;
$$;
