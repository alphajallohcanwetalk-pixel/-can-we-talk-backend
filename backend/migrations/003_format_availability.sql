-- Run once in Supabase for existing production databases.
-- New format rows should be offered by default; authors can hide them from sale.

alter table book_formats add column if not exists is_offered boolean default true;
update book_formats set is_offered = true where is_offered is null;
