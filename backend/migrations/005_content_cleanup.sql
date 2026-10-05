-- 005_content_cleanup.sql
--
-- Full purge of test and duplicate content. Leaves exactly two books:
--   Monopoly of Happiness         95ba6f6d-9cbc-49ac-ad6f-a00fdf8317cd
--   Mr. President, Can We Talk?   1f5366e9-a7c8-42e0-8fa7-3295352b5d5b
--
-- Verified before writing this file:
--   * All 8 orders belong to the author's or the developer's own accounts.
--     There is not a single real customer order, so clearing them loses no
--     revenue history. The one marked 'paid' is a 50 cent test of "repositor".
--   * 4 of the 5 comments are orphans: they point at book
--     8a2ae386-e95c-4df6-a390-dc7b62549be8, which no longer exists, and are
--     four copies of the same test string.
--   * The 5th comment is a genuine review that was left on the DUPLICATE
--     Mr. President row. It is moved to the surviving book rather than
--     deleted, so a real reader's words are not thrown away.
--
-- Safe to run more than once.

begin;

-- ---------------------------------------------------------------------------
-- 1. Rescue the one real review before its book row disappears.
-- ---------------------------------------------------------------------------
update public.comments
   set target_id = '1f5366e9-a7c8-42e0-8fa7-3295352b5d5b'
 where target_type = 'book'
   and target_id = '490e52f9-85c2-4c5d-afe7-95c14b923be7';

-- ---------------------------------------------------------------------------
-- 2. Comments: drop every orphan (a target_id with no surviving book or essay)
--    and every essay comment. comments.target_id carries no foreign key, so
--    orphans are invisible to the database and have to be matched by hand.
-- ---------------------------------------------------------------------------
delete from public.comments where target_type = 'essay';

delete from public.comments c
 where c.target_type = 'book'
   and not exists (select 1 from public.books b where b.id = c.target_id);

-- ---------------------------------------------------------------------------
-- 3. Orders. Every row is internal test traffic, so the table is cleared and
--    the store starts from zero. order_items cascades from orders, but is
--    cleared first so the intent is explicit rather than implied.
-- ---------------------------------------------------------------------------
delete from public.order_items;
delete from public.orders;

-- ---------------------------------------------------------------------------
-- 4. Audiobook content and anything purchased against it.
-- ---------------------------------------------------------------------------
delete from public.chapter_purchases;
delete from public.audiobook_bundle_purchases;
delete from public.audiobook_chapters;

-- ---------------------------------------------------------------------------
-- 5. Essays.
-- ---------------------------------------------------------------------------
delete from public.essays;

-- ---------------------------------------------------------------------------
-- 6. Books. Nothing references them now, so "repositor" and both duplicate
--    Mr. President rows can be deleted outright rather than just unpublished.
--    Written as "everything except the two keepers" so any other stray row
--    goes too.
-- ---------------------------------------------------------------------------
delete from public.media_coverage
 where book_id is not null
   and book_id not in ('95ba6f6d-9cbc-49ac-ad6f-a00fdf8317cd',
                       '1f5366e9-a7c8-42e0-8fa7-3295352b5d5b');

delete from public.book_formats
 where book_id not in ('95ba6f6d-9cbc-49ac-ad6f-a00fdf8317cd',
                       '1f5366e9-a7c8-42e0-8fa7-3295352b5d5b');

delete from public.books
 where id not in ('95ba6f6d-9cbc-49ac-ad6f-a00fdf8317cd',
                  '1f5366e9-a7c8-42e0-8fa7-3295352b5d5b');

-- ---------------------------------------------------------------------------
-- 7. Subscriptions: clear any test membership and the flags that mirror it.
-- ---------------------------------------------------------------------------
delete from public.book_club_subscriptions;
update public.profiles
   set book_club_active = false,
       book_club_plan = null
 where book_club_active is true or book_club_plan is not null;

-- ---------------------------------------------------------------------------
-- 8. Make sure the two survivors are live and on sale.
-- ---------------------------------------------------------------------------
update public.books set is_active = true
 where id in ('95ba6f6d-9cbc-49ac-ad6f-a00fdf8317cd',
              '1f5366e9-a7c8-42e0-8fa7-3295352b5d5b');

update public.book_formats set is_offered = true
 where book_id in ('95ba6f6d-9cbc-49ac-ad6f-a00fdf8317cd',
                   '1f5366e9-a7c8-42e0-8fa7-3295352b5d5b');

commit;

-- Verify afterwards:
--   select title, is_active from public.books order by title;
--     Monopoly of Happiness        | t
--     Mr. President, Can We Talk?  | t
--   select count(*) from public.orders;              -- 0
--   select count(*) from public.essays;              -- 0
--   select count(*) from public.audiobook_chapters;  -- 0
--   select count(*) from public.comments;            -- 1, on Mr. President
--
-- Note: cover images for the deleted books are still sitting in the `covers`
-- storage bucket. Removing a row here does not remove the file. Clear the
-- unused ones from Storage in the Supabase dashboard; nothing links to them.
