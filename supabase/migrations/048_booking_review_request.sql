alter table public.bookings
add column if not exists
  review_request_sent_at timestamptz;

comment on column
  public.bookings.review_request_sent_at
  is 'Set when review request email
  is sent. Prevents duplicate sends.';
