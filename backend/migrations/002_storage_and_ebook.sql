-- Run after 001_production_security.sql.
-- Covers are public for site display, but only author accounts may write them.

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public cover images are readable') then
    create policy "Public cover images are readable" on storage.objects for select to public using (bucket_id = 'covers');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authors can upload cover images') then
    create policy "Authors can upload cover images" on storage.objects for insert to authenticated
      with check (bucket_id = 'covers' and exists (select 1 from public.profiles where id = auth.uid() and is_author = true));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authors can update cover images') then
    create policy "Authors can update cover images" on storage.objects for update to authenticated
      using (bucket_id = 'covers' and exists (select 1 from public.profiles where id = auth.uid() and is_author = true));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authors can delete cover images') then
    create policy "Authors can delete cover images" on storage.objects for delete to authenticated
      using (bucket_id = 'covers' and exists (select 1 from public.profiles where id = auth.uid() and is_author = true));
  end if;
end
$$;
