-- 014_audio_essays_gallery_push.sql
--
-- Adds three things the author asked for:
--   * audio essays: an essay can carry a narration file people listen to
--   * a gallery of events, articles and media coverage, with photos and videos
--   * app notifications: devices that agreed to be told about new publications
--
-- Every table here is read and written only through the API on the service
-- role, the same as the rest of the schema since 004. RLS is on and no policy
-- is granted to anon or authenticated, so the browser cannot touch them
-- directly.
--
-- Safe to run more than once.

begin;

-- ---------------------------------------------------------------------------
-- 1. Audio essays
-- ---------------------------------------------------------------------------
alter table public.essays add column if not exists audio_url text;
alter table public.essays add column if not exists audio_seconds integer;

-- Essay narration is free to hear, like the essay itself, so it lives in the
-- public media bucket. Allow audio there, plus GIF for event photos.
update storage.buckets
   set allowed_mime_types = array[
     'video/mp4','video/webm','video/ogg','video/quicktime',
     'image/jpeg','image/png','image/webp','image/gif',
     'audio/mpeg','audio/mp3','audio/mp4','audio/m4a','audio/x-m4a','audio/aac','audio/ogg','audio/wav','audio/webm'
   ]
 where id = 'media';

-- Storage policies for the media bucket, rebuilt on the definer function from
-- 013 so they do not need a grant on profiles.
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

-- ---------------------------------------------------------------------------
-- 2. Gallery: events attended, articles written, media coverage
-- ---------------------------------------------------------------------------
create table if not exists public.gallery_items (
  id          uuid primary key default gen_random_uuid(),
  section     text not null default 'event'
              check (section in ('event', 'article', 'media')),
  media_type  text not null default 'photo'
              check (media_type in ('photo', 'video', 'link')),
  title       text not null check (char_length(title) between 1 and 300),
  caption     text check (caption is null or char_length(caption) <= 2000),
  outlet      text check (outlet is null or char_length(outlet) <= 200),
  image_url   text,
  video_url   text,
  link_url    text,
  event_date  date,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists gallery_items_section_idx on public.gallery_items (section, event_date desc nulls last, created_at desc);

alter table public.gallery_items enable row level security;
revoke all on public.gallery_items from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. App notifications (Web Push)
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

commit;
