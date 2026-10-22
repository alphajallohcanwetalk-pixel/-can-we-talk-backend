-- 017: a profile language is the reader's own choice, or empty when they never chose one.
-- Migration 016 gave every existing member 'en' as a default; the site then treated that as a choice
-- and switched French or Swahili phones back to English. Empty means: follow the phone's language.
-- Safe to run again.

alter table public.profiles alter column language drop not null;
alter table public.profiles alter column language drop default;
-- Members who existed before 016 never chose; members who signed up after it chose in the form.
update public.profiles set language = null
  where language = 'en' and created_at < '2026-10-22 00:00:00+03';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lang text := new.raw_user_meta_data->>'language';
begin
  if lang is not null and lang !~ '^[a-z]{2,3}$' then lang := null; end if;
  insert into public.profiles (id, full_name, email, language)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, lang);
  return new;
end;
$$;
