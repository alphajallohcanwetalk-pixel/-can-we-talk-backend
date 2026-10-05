-- 007_developer_role_and_error_log.sql
--
-- Adds a developer role and a server-side error log so failures can be read
-- from the dashboard instead of only from Render's log tail.
--
-- The role is a flag on the profile, checked server side on every /api/dev
-- request. No password or email is ever hardcoded in the application: the
-- developer signs in through normal Supabase Auth and the API looks the flag
-- up. That way revoking access is a single UPDATE, and nothing sensitive ships
-- in the frontend bundle.
--
-- Safe to run more than once.

begin;

-- ---------------------------------------------------------------------------
-- 1. The role flag.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists is_developer boolean default false;

-- Grant it to the developer account. Matched by email so the UUID does not
-- have to be pasted in; harmless if the account does not exist yet.
update public.profiles
   set is_developer = true
 where lower(email) = 'omondialvie5@gmail.com';

-- ---------------------------------------------------------------------------
-- 2. Error log.
--    Deliberately stores no request bodies, headers or tokens: a crash report
--    that quietly captures a customer's address or a bearer token turns a
--    debugging aid into a second data breach. Message, path and stack only.
-- ---------------------------------------------------------------------------
create table if not exists public.app_error_logs (
  id           uuid primary key default gen_random_uuid(),
  occurred_at  timestamptz not null default now(),
  level        text not null default 'error' check (level in ('error','warn','info')),
  source       text,                     -- 'api' | 'webhook' | 'client'
  message      text not null,
  stack        text,
  path         text,
  method       text,
  status       integer,
  request_id   text,
  user_id      uuid references public.profiles(id) on delete set null,
  user_agent   text,
  context      jsonb default '{}'::jsonb
);

create index if not exists app_error_logs_occurred_idx on public.app_error_logs (occurred_at desc);
create index if not exists app_error_logs_level_idx    on public.app_error_logs (level, occurred_at desc);

-- Locked down the same way as every other table: RLS on, no policies, so only
-- the service role (which bypasses RLS) can read or write it.
alter table public.app_error_logs enable row level security;

revoke all on public.app_error_logs from anon, authenticated;
grant all on public.app_error_logs to service_role;

-- ---------------------------------------------------------------------------
-- 3. Keep the log from growing without bound.
--    Called opportunistically by the API; also safe to run by hand.
-- ---------------------------------------------------------------------------
create or replace function public.prune_error_logs(keep_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.app_error_logs
   where occurred_at < now() - make_interval(days => keep_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_error_logs(integer) from anon, authenticated;
grant execute on function public.prune_error_logs(integer) to service_role;

commit;

-- Verify:
--   select email, is_author, is_developer from public.profiles order by email;
--   select count(*) from public.app_error_logs;
