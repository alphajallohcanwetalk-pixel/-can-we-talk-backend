-- 009_comment_moderation.sql
--
-- Readers post public comments and ratings, so the site needs a way to report
-- and remove them. Google Play's user-generated content policy requires both,
-- and it is basic hygiene for any site that lets strangers publish text.
--
-- Safe to run more than once.

begin;

-- Hidden rather than deleted, so the author can reverse a mistake and so a
-- removed comment does not silently change a book's average rating history.
alter table public.comments add column if not exists is_hidden boolean default false;
alter table public.comments add column if not exists hidden_at timestamptz;

create index if not exists comments_visible_idx
  on public.comments (target_type, target_id)
  where is_hidden is not true;

create table if not exists public.comment_reports (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  reason      text not null check (reason in ('spam','abuse','off_topic','other')),
  note        text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- One report per person per comment. Without this, a single reader could file
-- the same report repeatedly and make a comment look far worse than it is.
create unique index if not exists comment_reports_unique_reporter
  on public.comment_reports (comment_id, user_id)
  where user_id is not null;

create index if not exists comment_reports_open_idx
  on public.comment_reports (created_at desc)
  where resolved_at is null;

-- Locked down like every other table: RLS on, no policies, service role only.
alter table public.comment_reports enable row level security;
revoke all on public.comment_reports from anon, authenticated;
grant all on public.comment_reports to service_role;

commit;

-- Verify:
--   select count(*) from public.comment_reports;
--   select is_hidden from public.comments limit 1;
