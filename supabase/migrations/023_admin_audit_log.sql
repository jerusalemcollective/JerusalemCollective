create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  performed_by uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  detail text,
  created_at timestamptz not null default now()
);

alter table admin_audit_log enable row level security;

drop policy if exists "Admins can read audit log" on admin_audit_log;

create policy "Admins can read audit log"
  on admin_audit_log for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );
