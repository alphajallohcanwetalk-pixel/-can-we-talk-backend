-- 008_rls_policy_performance.sql
--
-- Silences Supabase's "auth_rls_initplan" performance advisor.
--
-- A policy written as `auth.uid() = user_id` re-evaluates auth.uid() once per
-- row. Wrapping it as `(select auth.uid()) = user_id` lets Postgres hoist it
-- into an InitPlan and evaluate it once per query. On a large orders table the
-- difference is the whole scan.
--
-- These four tables currently have no grants for anon or authenticated at all
-- (migration 004 revoked them), so the policies are not on any hot path today.
-- They are fixed so the advisor is clean and so the policies are correct if the
-- anon key is ever used directly from the browser.
--
-- Safe to run more than once.

begin;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders"
  on public.orders for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own order items" on public.order_items;
create policy "Users read own order items"
  on public.order_items for select
  using (order_id in (select id from public.orders where user_id = (select auth.uid())));

drop policy if exists "Users read own subscription" on public.book_club_subscriptions;
create policy "Users read own subscription"
  on public.book_club_subscriptions for select
  using ((select auth.uid()) = user_id);

-- Same treatment for the storage policies, which run per object listed.
drop policy if exists "Authors can upload cover images" on storage.objects;
create policy "Authors can upload cover images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and exists (
    select 1 from public.profiles
     where profiles.id = (select auth.uid()) and profiles.is_author = true));

drop policy if exists "Authors can update cover images" on storage.objects;
create policy "Authors can update cover images"
  on storage.objects for update to authenticated
  using (bucket_id = 'covers' and exists (
    select 1 from public.profiles
     where profiles.id = (select auth.uid()) and profiles.is_author = true));

drop policy if exists "Authors can delete cover images" on storage.objects;
create policy "Authors can delete cover images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and exists (
    select 1 from public.profiles
     where profiles.id = (select auth.uid()) and profiles.is_author = true));

drop policy if exists "Authors can upload media" on storage.objects;
create policy "Authors can upload media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and exists (
    select 1 from public.profiles
     where profiles.id = (select auth.uid()) and profiles.is_author = true));

drop policy if exists "Authors can update media" on storage.objects;
create policy "Authors can update media"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and exists (
    select 1 from public.profiles
     where profiles.id = (select auth.uid()) and profiles.is_author = true));

drop policy if exists "Authors can delete media" on storage.objects;
create policy "Authors can delete media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and exists (
    select 1 from public.profiles
     where profiles.id = (select auth.uid()) and profiles.is_author = true));

commit;
