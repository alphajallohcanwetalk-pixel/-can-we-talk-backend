-- 015_messages_and_gallery_v2.sql
-- Run once in the Supabase SQL editor (safe to run again).
--
-- 1. contact_messages: every message sent from the Contact page (speaking requests, press,
--    orders, questions) is kept, emailed to Alpha, and shown in his dashboard with
--    read / replied status and a reply box. Before this, the form saved nothing.
-- 2. gallery_items v2: photos, videos and documents (newspaper articles, letters), each
--    optionally linked to a book or an essay, with an optional title, several pages for
--    a document, and a choice of whether a photo joins the gallery slideshow.

-- ---------------------------------------------------------------------------
-- 1. Contact messages
-- ---------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) between 3 and 200),
  reason      text check (reason is null or char_length(reason) <= 80),
  message     text not null check (char_length(message) between 1 and 5000),
  status      text not null default 'new' check (status in ('new', 'read', 'replied')),
  reply       text check (reply is null or char_length(reply) <= 5000),
  emailed     boolean not null default false,
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  replied_at  timestamptz
);
create index if not exists contact_messages_status_idx on public.contact_messages (status, created_at desc);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
grant select, insert, update, delete on public.contact_messages to service_role;

-- ---------------------------------------------------------------------------
-- 2. Gallery v2
-- ---------------------------------------------------------------------------
alter table public.gallery_items add column if not exists book_id uuid references public.books(id) on delete set null;
alter table public.gallery_items add column if not exists essay_id uuid references public.essays(id) on delete set null;
-- Extra pages of a document (newspaper or letter), in order. image_url stays the first page.
alter table public.gallery_items add column if not exists pages text[] not null default '{}';
-- A PDF of the document, when one was uploaded instead of (or as well as) images.
alter table public.gallery_items add column if not exists file_url text;
alter table public.gallery_items add column if not exists in_slideshow boolean not null default true;

-- A title is no longer required: the author can upload without typing anything.
alter table public.gallery_items alter column title drop not null;
alter table public.gallery_items drop constraint if exists gallery_items_title_check;
alter table public.gallery_items add constraint gallery_items_title_check check (title is null or char_length(title) <= 300);

-- New kind: document (newspaper article, letter, certificate).
alter table public.gallery_items drop constraint if exists gallery_items_media_type_check;
alter table public.gallery_items add constraint gallery_items_media_type_check check (media_type in ('photo', 'video', 'link', 'document'));

create index if not exists gallery_items_book_idx on public.gallery_items (book_id) where book_id is not null;
create index if not exists gallery_items_essay_idx on public.gallery_items (essay_id) where essay_id is not null;
