-- 012_essay_progress.sql
--
-- Essays are now read in the same reader as books, so they need the same saved
-- position. A separate table rather than widening reading_progress, because
-- that one is keyed on book_id with a foreign key and a composite primary key;
-- making it polymorphic would mean dropping and rebuilding both.
--
-- Safe to run more than once.

begin;

create table if not exists public.essay_progress (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  essay_id    uuid not null references public.essays(id) on delete cascade,
  page        integer not null default 0,
  char_offset integer not null default 0,
  pages_total integer,
  updated_at  timestamptz not null default now(),
  primary key (user_id, essay_id)
);

create index if not exists essay_progress_user_idx
  on public.essay_progress (user_id, updated_at desc);

alter table public.essay_progress enable row level security;
revoke all on public.essay_progress from anon, authenticated;
grant all on public.essay_progress to service_role;

commit;

-- Verify:
--   select count(*) from public.essay_progress;
