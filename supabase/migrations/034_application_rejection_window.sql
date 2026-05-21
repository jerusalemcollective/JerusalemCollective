alter table public.host_applications
add column if not exists rejected_at timestamptz;

update public.host_applications
set rejected_at = now()
where status = 'rejected'
  and rejected_at is null;

create index if not exists host_applications_rejected_at_idx
on public.host_applications (rejected_at);
