alter table profiles
add column if not exists about_me text,
add column if not exists visiting_from text,
add column if not exists visit_reason text;

comment on column profiles.about_me is
  'Optional guest profile context visible to hosts during enquiries.';
comment on column profiles.visiting_from is
  'Optional guest location context visible to hosts during enquiries.';
comment on column profiles.visit_reason is
  'Optional reason for visit visible to hosts during enquiries.';
