alter table bookings
add column if not exists payment_status text
  default 'unpaid'
  check (payment_status in (
    'unpaid',
    'deposit_received',
    'paid_in_full',
    'refunded'
  )),
add column if not exists payment_notes text,
add column if not exists payment_updated_at timestamptz;

comment on column bookings.payment_status is
  'Off-platform payment tracking for hosts.';
