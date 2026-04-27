-- HotScan India — Supabase Migration
-- Paste this entire file into: Supabase Dashboard -> SQL Editor -> Run

-- 1. scan_logs
create table if not exists scan_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  scanned_at timestamptz not null default now()
);
alter table scan_logs enable row level security;
create policy "scan_logs_insert" on scan_logs for insert with check (true);
create policy "scan_logs_select" on scan_logs for select using (true);
create index if not exists idx_scan_logs_at on scan_logs(scanned_at);

-- 2. referrals
create table if not exists referrals (
  id               uuid primary key default gen_random_uuid(),
  referrer_code    text not null,
  referred_user_id uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);
alter table referrals enable row level security;
create policy "referrals_insert" on referrals for insert with check (true);
create policy "referrals_select" on referrals for select using (true);
create index if not exists idx_referrals_code on referrals(referrer_code);

-- 3. community_prices
create table if not exists community_prices (
  id         uuid primary key default gen_random_uuid(),
  car_name   text not null,
  price_inr  integer not null,
  platform   text,
  user_name  text,
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table community_prices enable row level security;
create policy "community_prices_insert" on community_prices for insert with check (true);
create policy "community_prices_select" on community_prices for select using (true);
create index if not exists idx_community_prices_car on community_prices(car_name);

-- 4. events
create table if not exists events (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  location     text not null,
  date         date not null,
  submitted_by uuid references auth.users(id) on delete set null,
  approved     boolean default false,
  created_at   timestamptz not null default now()
);
alter table events enable row level security;
create policy "events_insert" on events for insert with check (true);
create policy "events_select" on events for select using (approved = true or auth.uid() = submitted_by);

-- 5. profiles — add missing columns (safe to run even if table exists)
alter table profiles add column if not exists whatsapp_phone text;
alter table profiles add column if not exists olx_username text;
alter table profiles add column if not exists display_name text;
alter table profiles add column if not exists is_pro boolean default false;
alter table profiles add column if not exists is_developer boolean default false;
alter table profiles add column if not exists pro_since timestamptz;
alter table profiles add column if not exists razorpay_payment_id text;

-- ── 6. Critical missing policies — run these in Supabase SQL Editor
-- Without the UPDATE policy, profile saves (WA number, OLX, username) silently fail

-- Profiles: allow users to update their own row
do $$ begin
  create policy "profiles_update" on profiles
    for update using (auth.uid() = id) with check (auth.uid() = id);
exception when duplicate_object then null;
end $$;

-- Profiles: allow users to insert their own row (for new users)
do $$ begin
  create policy "profiles_insert" on profiles
    for insert with check (auth.uid() = id);
exception when duplicate_object then null;
end $$;

-- Profiles: allow users to read their own row
do $$ begin
  create policy "profiles_select" on profiles
    for select using (auth.uid() = id);
exception when duplicate_object then null;
end $$;

-- Collection: prevent exact duplicates per user+name
-- (stops same car being uploaded multiple times on repeated syncs)
create unique index if not exists idx_collection_user_name
  on collection(user_id, lower(name));

-- Collection: RLS policies
alter table collection enable row level security;
do $$ begin
  create policy "collection_select" on collection for select using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "collection_insert" on collection for insert with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "collection_update" on collection for update using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "collection_delete" on collection for delete using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
