-- 088_balance_payment_flow.sql
--
-- On-site balance payment. After the deposit, the guest pays the remaining
-- balance THROUGH THE SITE (a separate Stripe Checkout) on the host's schedule.
-- These RPCs attach that second Checkout session to the booking_payment and,
-- once it settles, mark the balance paid + add it to the host payout.

alter table public.booking_payments
  add column if not exists balance_reminder_sent_at timestamptz;

comment on column public.booking_payments.balance_reminder_sent_at is
  'When the guest was last emailed a balance-due reminder (nulled/updated by the reminder job).';

-- Attach a balance Checkout session to a booking_payment the caller owns.
-- Guest-scoped, mirrors attach_checkout_session_to_payment (071).
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
    and balance_status = 'due'
    and balance_amount > 0
  returning * into payment_record;

  if payment_record.id is null then
    raise exception 'That balance could not be linked to a checkout session.';
  end if;

  return payment_record;
end;
$$;

-- Mark the balance paid when its Stripe session settles. Service-role only.
-- Idempotent: only acts while balance_status='due', so a retried/duplicate
-- webhook is a no-op. Commission was already taken from the deposit, so the
-- whole balance is added to the host payout.
create or replace function public.mark_balance_paid(
  p_session_id text
)
returns public.booking_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.booking_payments%rowtype;
begin
  update public.booking_payments
  set balance_status = 'paid',
      balance_paid_at = now(),
      host_payout_amount = coalesce(host_payout_amount, 0) + coalesce(balance_amount, 0),
      updated_at = now()
  where balance_checkout_session_id = p_session_id
    and balance_status = 'due'
  returning * into payment_record;

  -- payment_record.id is null when there was nothing to update (already paid or
  -- unknown session) — an idempotent no-op, not an error.
  return payment_record;
end;
$$;

revoke all on function public.attach_balance_checkout_session(uuid, text) from public;
grant execute on function public.attach_balance_checkout_session(uuid, text) to authenticated;

revoke all on function public.mark_balance_paid(text) from public;
grant execute on function public.mark_balance_paid(text) to service_role;
