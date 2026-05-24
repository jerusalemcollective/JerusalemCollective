alter table hosts
add column if not exists notify_new_enquiry_email boolean default true,
add column if not exists notify_new_enquiry_sms boolean default false,
add column if not exists notify_booking_confirmed_email boolean default true,
add column if not exists notify_messages_email boolean default true;

comment on column hosts.notify_new_enquiry_email is
  'Send email when a new enquiry arrives.';
