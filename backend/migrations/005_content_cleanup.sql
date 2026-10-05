-- 005_content_cleanup.sql
--
-- Leaves exactly two books on the site:
--   Monopoly of Happiness          95ba6f6d-9cbc-49ac-ad6f-a00fdf8317cd
--   Mr. President, Can We Talk?    1f5366e9-a7c8-42e0-8fa7-3295352b5d5b
-- and removes all essays and audiobook chapters.
--
-- Two of the books being removed are referenced by real order history:
--
--   repositor                   f6453bc0  3 order items (one from a PAID order)
--   Mr. President (duplicate)   490e52f9  2 order items, 1 comment
--
-- order_items.book_id has no ON DELETE rule, so deleting those rows outright
-- would fail, and forcing it would destroy the record of what a customer paid
-- for. They are unpublished instead: `is_active = false` removes them from the
-- store and from every public API response, while the receipts stay intact.
-- Section B at the bottom is the full purge, if the test orders are disposable.

begin;

-- ---------------------------------------------------------------------------
-- A. Default: remove what is safe to remove, hide what has order history.
-- ---------------------------------------------------------------------------

-- A1. Unreferenced duplicate: nothing points at it, so it can go for good.
delete from public.book_formats where book_id = '41411b6a-2b5a-479a-87d8-edd7c01570a0';
delete from public.books        where id      = '41411b6a-2b5a-479a-87d8-edd7c01570a0';

-- A2. Books with order history: unpublish and withdraw every format from sale.
update public.books
   set is_active = false
 where id in ('f6453bc0-41cb-4e17-a4a6-daf5d1168603',   -- repositor
              '490e52f9-85c2-4c5d-afe7-95c14b923be7');  -- duplicate Mr. President

update public.book_formats
   set is_offered = false
 where book_id in ('f6453bc0-41cb-4e17-a4a6-daf5d1168603',
                   '490e52f9-85c2-4c5d-afe7-95c14b923be7');

-- A3. Comments attached to the withdrawn books. comments.target_id carries no
--     foreign key, so these would otherwise linger as orphans.
delete from public.comments
 where target_type = 'book'
   and target_id in ('41411b6a-2b5a-479a-87d8-edd7c01570a0',
                     'f6453bc0-41cb-4e17-a4a6-daf5d1168603',
                     '490e52f9-85c2-4c5d-afe7-95c14b923be7');

-- A4. All essays, and their comments.
delete from public.comments where target_type = 'essay';
delete from public.essays;

-- A5. All audiobook chapters, and anything bought against them.
--     chapter_purchases cascades from audiobook_chapters, but is cleared first
--     so the intent is explicit.
delete from public.chapter_purchases;
delete from public.audiobook_bundle_purchases;
delete from public.audiobook_chapters;

commit;

-- Expected after this runs:
--   select title, is_active from books order by title;
--     Monopoly of Happiness        | t
--     Mr. President, Can We Talk?  | t
--     Mr. President, Can We Talk?  | f   (duplicate, kept for order history)
--     repositor                    | f   (kept for order history)
--   essays, audiobook_chapters: 0 rows
--
-- Only the two active books are visible on the site; /api/books filters on
-- is_active, so the hidden pair never reaches a visitor.


-- ---------------------------------------------------------------------------
-- B. Optional full purge. Run ONLY if the 50 cent test orders can be discarded.
--    This deletes real order rows, including one marked paid in Stripe. Stripe
--    keeps its own record, but this database will no longer match it.
--    Uncomment deliberately.
-- ---------------------------------------------------------------------------
-- begin;
--   delete from public.order_items
--    where book_id in ('f6453bc0-41cb-4e17-a4a6-daf5d1168603',
--                      '490e52f9-85c2-4c5d-afe7-95c14b923be7');
--   -- Remove orders that are now empty.
--   delete from public.orders o
--    where not exists (select 1 from public.order_items i where i.order_id = o.id);
--   delete from public.book_formats
--    where book_id in ('f6453bc0-41cb-4e17-a4a6-daf5d1168603',
--                      '490e52f9-85c2-4c5d-afe7-95c14b923be7');
--   delete from public.books
--    where id in ('f6453bc0-41cb-4e17-a4a6-daf5d1168603',
--                 '490e52f9-85c2-4c5d-afe7-95c14b923be7');
-- commit;
