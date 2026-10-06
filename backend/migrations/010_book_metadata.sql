-- 010_book_metadata.sql
--
-- The bibliographic fields a book site is expected to carry. Readers look for
-- them before buying, and search engines use them to recognise the page as a
-- book rather than a generic product.
--
-- All nullable: an author should be able to publish a book before the ISBN has
-- been assigned, and fill the rest in later.
--
-- Safe to run more than once.

begin;

alter table public.books add column if not exists isbn            text;
alter table public.books add column if not exists publisher       text;
alter table public.books add column if not exists published_date  date;
alter table public.books add column if not exists page_count      integer;
alter table public.books add column if not exists language        text default 'English';
alter table public.books add column if not exists genre           text;
alter table public.books add column if not exists edition         text;

-- An ISBN is 10 or 13 digits, optionally with hyphens or a trailing X on the
-- 10 digit form. Stored however the author typed it; this only rejects input
-- that cannot be an ISBN at all.
alter table public.books drop constraint if exists books_isbn_shape;
alter table public.books add constraint books_isbn_shape
  check (isbn is null or isbn = '' or isbn ~ '^[0-9Xx][0-9Xx -]{8,30}$');

alter table public.books drop constraint if exists books_page_count_positive;
alter table public.books add constraint books_page_count_positive
  check (page_count is null or page_count > 0);

-- Looking a book up by ISBN should not scan the table.
create unique index if not exists books_isbn_uidx
  on public.books (isbn)
  where isbn is not null and isbn <> '';

commit;

-- Verify:
--   select title, isbn, publisher, published_date, page_count, language, genre
--     from public.books order by title;
