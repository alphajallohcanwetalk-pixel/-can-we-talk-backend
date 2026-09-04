-- Run once in Supabase SQL Editor before enabling production writes.
-- The service-role backend remains the only writer for authorization and entitlements.

drop policy if exists "Users update own profile" on profiles;
alter table profiles add column if not exists updated_at timestamptz default now();

alter table orders add column if not exists customer_name text;
alter table orders add column if not exists customer_phone text;
alter table books add column if not exists back_cover_url text;
alter table books add column if not exists gallery_urls jsonb;
alter table essays add column if not exists cover_image_url text;
alter table essays add column if not exists is_offered boolean default false;

create unique index if not exists book_club_subscriptions_stripe_id_idx
  on book_club_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists orders_stripe_session_id_idx
  on orders (stripe_session_id)
  where stripe_session_id is not null;

alter table audiobook_chapters enable row level security;
alter table books enable row level security;
alter table book_formats enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audiobook_chapters' and policyname = 'Anyone can read chapter metadata') then
    create policy "Anyone can read chapter metadata" on audiobook_chapters for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'books' and policyname = 'Anyone can read active books') then
    create policy "Anyone can read active books" on books for select using (is_active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'book_formats' and policyname = 'Anyone can read book formats') then
    create policy "Anyone can read book formats" on book_formats for select using (true);
  end if;
end
$$;
