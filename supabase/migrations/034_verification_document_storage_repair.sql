insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'verification-docs',
  'verification-docs',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Authenticated users can upload verification documents" on storage.objects;

create policy "Authenticated users can upload verification documents"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'verification-docs');

drop policy if exists "Authenticated users can update verification documents" on storage.objects;

create policy "Authenticated users can update verification documents"
on storage.objects
for update
to authenticated
using (bucket_id = 'verification-docs')
with check (bucket_id = 'verification-docs');

drop policy if exists "Authenticated users can delete verification documents" on storage.objects;

create policy "Authenticated users can delete verification documents"
on storage.objects
for delete
to authenticated
using (bucket_id = 'verification-docs');

drop policy if exists "Admins can read verification documents" on storage.objects;

create policy "Admins can read verification documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'verification-docs'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);
