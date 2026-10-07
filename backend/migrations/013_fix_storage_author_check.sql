-- 013_fix_storage_author_check.sql
--
-- Fixes: "Cover upload failed: permission denied for table profiles"
--
-- Migration 004 revoked every table grant from anon and authenticated, which
-- was right: the browser never queries tables directly, everything goes through
-- the API on the service role.
--
-- But the storage policies kept from 004 check authorship like this:
--
--     exists (select 1 from public.profiles
--              where profiles.id = auth.uid() and profiles.is_author = true)
--
-- That SELECT runs as `authenticated`, which no longer has the grant, so
-- Postgres refuses before the upload is even attempted. Cover and author photo
-- uploads have been failing since 004 was applied.
--
-- The fix is not to hand the grant back. A SECURITY DEFINER function answers
-- the one question the policy needs, runs as its owner so no table grant is
-- required, and returns a boolean rather than exposing any row. authenticated
-- gets permission to ask "am I the author", and nothing else.
--
-- Safe to run more than once.

begin;

create or replace function public.current_user_is_author()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles
     where profiles.id = (select auth.uid())
       and profiles.is_author = true
  );
$$;

revoke all on function public.current_user_is_author() from public, anon;
grant execute on function public.current_user_is_author() to authenticated, service_role;

-- Rebuild the storage policies on top of it.
drop policy if exists "Authors can upload cover images" on storage.objects;
create policy "Authors can upload cover images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and public.current_user_is_author());

drop policy if exists "Authors can update cover images" on storage.objects;
create policy "Authors can update cover images"
  on storage.objects for update to authenticated
  using (bucket_id = 'covers' and public.current_user_is_author());

drop policy if exists "Authors can delete cover images" on storage.objects;
create policy "Authors can delete cover images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and public.current_user_is_author());

drop policy if exists "Authors can upload media" on storage.objects;
create policy "Authors can upload media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.current_user_is_author());

drop policy if exists "Authors can update media" on storage.objects;
create policy "Authors can update media"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.current_user_is_author());

drop policy if exists "Authors can delete media" on storage.objects;
create policy "Authors can delete media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.current_user_is_author());

commit;

-- Verify, signed in as the author, that a cover upload now succeeds.
-- The function must answer true for the author and false for everyone else:
--   select public.current_user_is_author();
