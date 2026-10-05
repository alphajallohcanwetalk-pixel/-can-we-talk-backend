-- 004_rls_and_grants_hardening.sql
--
-- Closes the gap found in the production audit: the public anon key could read
-- and write several tables directly, bypassing the API entirely.
--
-- Context: the frontend never queries tables with the anon key. It uses the anon
-- key only for Supabase Auth and for cover-image uploads to Storage. Every piece
-- of data reaches the browser through the backend, which uses the service role.
-- service_role has BYPASSRLS, so none of this affects the API.
--
-- Safe to run more than once.

begin;

-- ---------------------------------------------------------------------------
-- 1. RLS on every public table.
--    These three were left unprotected, so anon could select, insert, update
--    and delete at will. chapter_purchases is the worst case: a visitor could
--    grant themselves paid audiobook chapters for free.
-- ---------------------------------------------------------------------------
alter table public.essays                     enable row level security;
alter table public.chapter_purchases          enable row level security;
alter table public.audiobook_bundle_purchases enable row level security;

-- Already enabled, repeated so this file alone describes the end state.
alter table public.books                   enable row level security;
alter table public.book_formats            enable row level security;
alter table public.audiobook_chapters      enable row level security;
alter table public.book_club_subscriptions enable row level security;
alter table public.comments                enable row level security;
alter table public.media_coverage          enable row level security;
alter table public.order_items             enable row level security;
alter table public.orders                  enable row level security;
alter table public.profiles                enable row level security;
alter table public.site_settings           enable row level security;

-- No policies are added for the three tables above. With RLS on and no policy,
-- anon and authenticated are denied, which is what we want: they are reached
-- only through the backend.

-- ---------------------------------------------------------------------------
-- 2. Take table privileges away from the public keys.
--    RLS is the fence; these grants were the gate left open next to it. Even
--    with RLS on, a stray future policy plus INSERT/UPDATE/TRUNCATE rights is
--    a hole waiting to happen.
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Stop handing the same rights to every table created from now on. Without
-- this, the next `create table` silently reopens the hole.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- The API role keeps everything it needs.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- 3. Pin the search_path on the SECURITY DEFINER trigger.
--    A definer function with a mutable search_path can be steered into running
--    an attacker's function with owner privileges.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Storage: cover uploads are for the author only.
--    Permissive policies are OR'd together, so the "Authenticated users can..."
--    policies overrode the author-only ones. Any reader who signed up could
--    overwrite or delete every cover image on the site.
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can upload covers" on storage.objects;
drop policy if exists "Authenticated users can update covers" on storage.objects;
drop policy if exists "Authenticated users can delete covers" on storage.objects;

-- Duplicate of "Public cover images are readable"; one public read policy is enough.
drop policy if exists "Anyone can view covers" on storage.objects;

-- Enforce at the bucket what the browser was only checking politely.
update storage.buckets
   set file_size_limit = 10485760,  -- 10 MB, matches the client-side check
       allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id = 'covers';

-- ---------------------------------------------------------------------------
-- 5. Indexes for every foreign key, plus the comment lookup.
--    Without these, each join and each cascading delete is a sequential scan.
-- ---------------------------------------------------------------------------
create index if not exists book_formats_book_id_idx               on public.book_formats (book_id);
create index if not exists audiobook_chapters_book_id_idx         on public.audiobook_chapters (book_id);
create index if not exists media_coverage_book_id_idx             on public.media_coverage (book_id);
create index if not exists orders_user_id_idx                     on public.orders (user_id);
create index if not exists order_items_order_id_idx               on public.order_items (order_id);
create index if not exists order_items_book_id_idx                on public.order_items (book_id);
create index if not exists comments_target_idx                    on public.comments (target_type, target_id);
create index if not exists comments_user_id_idx                   on public.comments (user_id);
create index if not exists book_club_subscriptions_user_id_idx    on public.book_club_subscriptions (user_id);
create index if not exists chapter_purchases_chapter_id_idx       on public.chapter_purchases (chapter_id);
create index if not exists audiobook_bundle_purchases_book_id_idx on public.audiobook_bundle_purchases (book_id);
create index if not exists essays_published_year_idx              on public.essays (published, year desc);
create index if not exists books_active_created_idx               on public.books (is_active, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. One format name per book.
--    Checkout looks a format up with .single(); a duplicate row would make the
--    lookup throw and the whole purchase fail. Verified clean before adding.
-- ---------------------------------------------------------------------------
create unique index if not exists book_formats_book_format_uidx
  on public.book_formats (book_id, format_name);

commit;
