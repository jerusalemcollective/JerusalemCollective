alter table public.booking_requests
add column if not exists host_notified_at timestamptz;

comment on column public.booking_requests.host_notified_at is
  'Set when the host notification email is sent. Prevents duplicate notifications.';
