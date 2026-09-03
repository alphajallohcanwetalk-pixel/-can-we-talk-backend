-- ============================================================
-- Can We Talk? (The Misfit Voice) — Database Schema
-- Target: Supabase (Postgres). Run this in the Supabase SQL Editor.
-- Supabase Auth already provides auth.users — we extend it with a profile table.
-- ============================================================

-- ---------- Profiles (extends Supabase auth.users) ----------
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null,
  is_author boolean default false,          -- true only for Alpha's account
  book_club_plan text,                      -- null | 'monthly' | 'annual'
  book_club_active boolean default false,
  stripe_customer_id text,
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever someone signs up
create function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------- Books ----------
create table books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  description text,
  cover_style text default 'cover-1',       -- for now: which gradient/cover to render
  cover_image_url text,                     -- real cover photo, once uploaded
  is_active boolean default true,
  reader_full_text text,                    -- real book text for the AJ Book Club reader
  created_at timestamptz default now()
);

create table book_formats (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books on delete cascade,
  format_name text not null,                -- 'Paperback' | 'Hardcover' | 'eBook' | 'Audiobook'
  price_cents integer not null,
  stock_count integer,                      -- null = digital / unlimited
  sort_order integer default 0
);

-- ---------- Essays ----------
create table essays (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  year integer not null,
  excerpt text not null,
  full_text text,
  published boolean default true,
  created_at timestamptz default now()
);

-- ---------- Comments & ratings (books + essays) ----------
create table comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  target_type text not null check (target_type in ('book','essay')),
  target_id uuid not null,
  rating integer check (rating between 1 and 5),
  body text not null,
  created_at timestamptz default now()
);

-- ---------- Orders (book purchases) ----------
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles,
  stripe_session_id text,
  status text default 'pending' check (status in ('pending','paid','shipped','refunded')),
  shipping_address text,
  total_cents integer not null,
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders on delete cascade,
  book_id uuid references books,
  format_name text,
  signed boolean default false,
  qty integer not null,
  unit_price_cents integer not null
);

-- ---------- Audiobook chapters ----------
create table audiobook_chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references books on delete cascade,
  title text not null,
  duration_seconds integer,
  price_cents integer not null,
  audio_url text,                           -- final narrated file (e.g. Supabase Storage / S3 URL)
  sort_order integer default 0
);

create table chapter_purchases (
  user_id uuid references profiles on delete cascade,
  chapter_id uuid references audiobook_chapters on delete cascade,
  purchased_at timestamptz default now(),
  primary key (user_id, chapter_id)
);

create table audiobook_bundle_purchases (
  user_id uuid references profiles on delete cascade,
  book_id uuid references books on delete cascade,
  purchased_at timestamptz default now(),
  primary key (user_id, book_id)
);

-- ---------- AJ Book Club ----------
create table book_club_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  plan text not null check (plan in ('monthly','annual')),
  stripe_subscription_id text,
  status text default 'active' check (status in ('active','cancelled','past_due')),
  started_at timestamptz default now(),
  current_period_end timestamptz
);

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table comments enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table book_club_subscriptions enable row level security;

-- Profiles: users can read/update their own row
create policy "Users read own profile" on profiles for select using (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- Comments: anyone can read; only the author can write their own; signed-in required to insert
create policy "Anyone can read comments" on comments for select using (true);
create policy "Users insert own comments" on comments for insert with check (auth.uid() = user_id);

-- Orders: users see only their own orders
create policy "Users read own orders" on orders for select using (auth.uid() = user_id);
create policy "Users read own order items" on order_items for select using (
  order_id in (select id from orders where user_id = auth.uid())
);

-- Book club: users see only their own subscription
create policy "Users read own subscription" on book_club_subscriptions for select using (auth.uid() = user_id);

-- Books/essays/chapters are public read, no RLS needed on those (writes go through the
-- server using the Supabase service role key, gated by the is_author check in middleware).
