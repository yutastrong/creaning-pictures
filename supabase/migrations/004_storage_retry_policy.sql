drop policy if exists "staff can update own field photos" on storage.objects;
create policy "staff can update own field photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'field-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'field-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
