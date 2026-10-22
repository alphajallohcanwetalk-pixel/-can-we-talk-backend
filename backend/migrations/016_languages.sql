-- 016: languages. Run once in the Supabase SQL editor (or through the pooler); safe to run again.
-- 1. Each reader's language, chosen at sign up and changeable any time.
-- 2. Sign up copies the language from the sign up form (user metadata) into the profile.
-- 3. content_translations: Alpha's content (essays, books, gallery) in other languages.

alter table public.profiles add column if not exists language text not null default 'en';
do $$ begin
  alter table public.profiles add constraint profiles_language_code check (language ~ '^[a-z]{2,3}$');
exception when duplicate_object then null; end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lang text := coalesce(new.raw_user_meta_data->>'language', 'en');
begin
  if lang !~ '^[a-z]{2,3}$' then lang := 'en'; end if;
  insert into public.profiles (id, full_name, email, language)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, lang);
  return new;
end;
$$;

create table if not exists public.content_translations (
  kind text not null check (kind in ('essay', 'book', 'gallery', 'media')),
  item_id text not null,
  field text not null,
  lang text not null check (lang ~ '^[a-z]{2,3}$'),
  text text not null,
  source_hash text not null,
  status text not null default 'machine' check (status in ('machine', 'reviewed', 'bna')),
  updated_at timestamptz not null default now(),
  primary key (kind, item_id, field, lang)
);

-- Readable by anyone (it is published content); written only by the API with the service role.
alter table public.content_translations enable row level security;
drop policy if exists "Translations are public" on public.content_translations;
create policy "Translations are public" on public.content_translations for select using (true);
revoke insert, update, delete on public.content_translations from anon, authenticated;
grant select on public.content_translations to anon, authenticated;
