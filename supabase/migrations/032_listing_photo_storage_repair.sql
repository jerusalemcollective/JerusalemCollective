insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'listing-photos',
  'listing-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Authenticated users can upload listing photos" on storage.objects;

create policy "Authenticated users can upload listing photos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'listing-photos');

drop policy if exists "Authenticated users can update listing photos" on storage.objects;

create policy "Authenticated users can update listing photos"
on storage.objects
for update
to authenticated
using (bucket_id = 'listing-photos')
with check (bucket_id = 'listing-photos');

drop policy if exists "Authenticated users can manage listing photos" on storage.objects;

create policy "Authenticated users can manage listing photos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'listing-photos');
