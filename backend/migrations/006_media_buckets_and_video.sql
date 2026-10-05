-- 006_media_buckets_and_video.sql
--
-- Adds the storage and columns the author needs to publish rich media:
--   * a PRIVATE bucket for narration audio (paid content, served by signed URL)
--   * a PUBLIC bucket for video files and other large public media
--   * video links on books and essays
--
-- Narration audio must not live in `covers`: that bucket is public, so anyone
-- with the URL could stream a chapter without buying it. Audio goes in a private
-- bucket and is handed out as a short-lived signed URL, only after the purchase
-- check in /api/audiobook/chapters/:id/stream passes.
--
-- Safe to run more than once.

begin;

-- ---------------------------------------------------------------------------
-- 1. Buckets
-- ---------------------------------------------------------------------------

-- Private: narration audio. No public read, no client-side policies at all.
-- Uploads happen through a signed upload URL minted by the API for the author,
-- and playback through a signed download URL, so the browser never needs rights
-- of its own here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audiobook', 'audiobook', false, 524288000,   -- 500 MB per file
        array['audio/mpeg','audio/mp3','audio/mp4','audio/m4a','audio/x-m4a','audio/aac','audio/ogg','audio/wav','audio/webm'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public: promotional video and other public media. Readable by anyone,
-- writable only by the author.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 524288000,            -- 500 MB per file
        array['video/mp4','video/webm','video/ogg','video/quicktime','image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Storage policies for the public media bucket.
--    Same shape as the hardened cover policies: world readable, author writable.
-- ---------------------------------------------------------------------------
drop policy if exists "Public media is readable"        on storage.objects;
drop policy if exists "Authors can upload media"        on storage.objects;
drop policy if exists "Authors can update media"        on storage.objects;
drop policy if exists "Authors can delete media"        on storage.objects;

create policy "Public media is readable"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "Authors can upload media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_author = true));

create policy "Authors can update media"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_author = true));

create policy "Authors can delete media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_author = true));

-- No policies are created for the `audiobook` bucket on purpose. Only the
-- service role reaches it, and it bypasses RLS.

-- ---------------------------------------------------------------------------
-- 3. Video links on books and essays.
--    Each entry is {"type":"embed"|"file","url":"...","title":"..."} so a
--    YouTube link and an uploaded mp4 can sit in the same list.
-- ---------------------------------------------------------------------------
alter table public.books  add column if not exists video_urls jsonb default '[]'::jsonb;
alter table public.essays add column if not exists video_urls jsonb default '[]'::jsonb;

-- Audio chapters get a storage path alongside the legacy public url, so the
-- stream endpoint knows to sign it rather than hand it out directly.
alter table public.audiobook_chapters add column if not exists audio_path text;
alter table public.audiobook_chapters add column if not exists preview_seconds integer default 0;

-- Essays gain the same reading affordances books already have.
alter table public.essays add column if not exists reading_minutes integer;

commit;
