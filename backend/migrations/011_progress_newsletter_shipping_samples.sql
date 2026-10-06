-- 011_progress_newsletter_shipping_samples.sql
--
-- Four additions:
--   * reading progress, so the reader reopens where it was left
--   * a newsletter list separate from paying Book Club members
--   * shipping priced by destination instead of one flat rate
--   * free sample reading, so a book can be tried before it is bought
--
-- Safe to run more than once.

begin;

-- ---------------------------------------------------------------------------
-- 1. Reading progress
--    One row per reader per book. The page number is meaningless on its own,
--    because pagination depends on screen size and font size, so the character
--    offset is stored alongside it and used to restore the position on a
--    different device.
-- ---------------------------------------------------------------------------
create table if not exists public.reading_progress (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  page        integer not null default 0,
  char_offset integer not null default 0,
  pages_total integer,
  updated_at  timestamptz not null default now(),
  primary key (user_id, book_id)
);

create index if not exists reading_progress_user_idx on public.reading_progress (user_id, updated_at desc);

alter table public.reading_progress enable row level security;
revoke all on public.reading_progress from anon, authenticated;
grant all on public.reading_progress to service_role;

-- ---------------------------------------------------------------------------
-- 2. Newsletter
--    Deliberately separate from profiles. Someone can follow the writing
--    without ever creating an account, and a paying Book Club member has not
--    necessarily agreed to marketing email.
--    Double opt in: a subscriber is not mailed until confirmed_at is set.
-- ---------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  full_name      text,
  token          text not null default encode(gen_random_bytes(24), 'hex'),
  confirmed_at   timestamptz,
  unsubscribed_at timestamptz,
  source         text default 'website',
  created_at     timestamptz not null default now()
);

-- One row per address, case insensitively.
create unique index if not exists newsletter_email_uidx
  on public.newsletter_subscribers (lower(email));
create unique index if not exists newsletter_token_uidx
  on public.newsletter_subscribers (token);
create index if not exists newsletter_active_idx
  on public.newsletter_subscribers (confirmed_at)
  where confirmed_at is not null and unsubscribed_at is null;

alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon, authenticated;
grant all on public.newsletter_subscribers to service_role;

-- ---------------------------------------------------------------------------
-- 3. Shipping by destination
--    A flat rate cannot survive posting a hardback from Freetown to London.
--    Rates are per country, with a fallback row so an unlisted destination
--    still gets a price rather than shipping free by accident.
-- ---------------------------------------------------------------------------
create table if not exists public.shipping_rates (
  id            uuid primary key default gen_random_uuid(),
  country_code  text not null,            -- ISO 3166 alpha 2, or 'ZZ' for the fallback
  country_name  text not null,
  price_cents   integer not null check (price_cents >= 0),
  free_over_cents integer,                -- order total above which postage is free
  sort_order    integer not null default 0,
  is_active     boolean not null default true
);

create unique index if not exists shipping_rates_country_uidx
  on public.shipping_rates (upper(country_code));

alter table public.shipping_rates enable row level security;
revoke all on public.shipping_rates from anon, authenticated;
grant all on public.shipping_rates to service_role;

-- Starting rates. Edit these in the dashboard; they are a sensible default,
-- not a quote. The fallback must exist or unlisted countries ship free.
insert into public.shipping_rates (country_code, country_name, price_cents, free_over_cents, sort_order)
values ('SL', 'Sierra Leone',   300,  5000, 1),
       ('KE', 'Kenya',          800,  8000, 2),
       ('NG', 'Nigeria',       1200, 12000, 3),
       ('GH', 'Ghana',         1200, 12000, 4),
       ('ZA', 'South Africa',  1500, 15000, 5),
       ('GB', 'United Kingdom',1800, 20000, 6),
       ('US', 'United States', 2000, 20000, 7),
       ('CA', 'Canada',        2000, 20000, 8),
       ('ZZ', 'Everywhere else',2500, 25000, 99)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. Free samples
--    How much of a book an unentitled reader may read. Zero means no sample.
--    Stored as characters rather than pages because pagination is a property
--    of the reader's screen, not of the book.
-- ---------------------------------------------------------------------------
alter table public.books add column if not exists sample_chars integer not null default 0;
alter table public.books drop constraint if exists books_sample_chars_sane;
alter table public.books add constraint books_sample_chars_sane
  check (sample_chars >= 0 and sample_chars <= 200000);

commit;

-- Verify:
--   select country_code, country_name, price_cents from public.shipping_rates order by sort_order;
--   select title, sample_chars from public.books;
--   select count(*) from public.reading_progress;
--   select count(*) from public.newsletter_subscribers;
