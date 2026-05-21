alter table listings
add column if not exists welcome_message text,
add column if not exists house_rules text,
add column if not exists check_in_instructions text;

comment on column listings.welcome_message is
  'Sent automatically when a booking is confirmed.';
comment on column listings.house_rules is
  'Displayed to guests before enquiring.';
comment on column listings.check_in_instructions is
  'Shared with the guest once a booking is confirmed.';
