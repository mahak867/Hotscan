-- HotScan India — Supabase Migration
-- Run these in Supabase Dashboard → SQL Editor

-- ── 1. scan_logs — powers the real scan counter on the landing page
create table if not exists scan_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  scanned_at  timestamptz not null default now()
);

-- Allow anonymous inserts (guest scans count too)
alter table scan_logs enable row level security;
create policy "Anyone can log a scan"
  on scan_logs for insert
  with check (true);

-- Allow reading count (for landing page counter)
create policy "Anyone can count scans"
  on scan_logs for select
  using (true);

-- Index for fast count queries
create index if not exists idx_scan_logs_scanned_at on scan_logs(scanned_at);

-- ── 2. referrals — powers cross-device referral tracking
create table if not exists referrals (
  id                uuid primary key default gen_random_uuid(),
  referrer_code     text not null,
  referred_user_id  uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

alter table referrals enable row level security;
create policy "Anyone can insert a referral"
  on referrals for insert
  with check (true);

create policy "Users can read their own referrals"
  on referrals for select
  using (true);

create index if not exists idx_referrals_code on referrals(referrer_code);

-- ── 3. Make sure community_prices table exists
create table if not exists community_prices (
  id          uuid primary key default gen_random_uuid(),
  car_name    text not null,
  price_inr   integer not null,
  platform    text,
  user_name   text,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table community_prices enable row level security;
create policy "Anyone can submit a price"
  on community_prices for insert
  with check (true);
create policy "Anyone can read community prices"
  on community_prices for select
  using (true);

create index if not exists idx_community_prices_car on community_prices(car_name);

-- ── 4. Make sure events table exists
create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  location      text not null,
  date          date not null,
  submitted_by  uuid references auth.users(id) on delete set null,
  approved      boolean default false,
  created_at    timestamptz not null default now()
);

alter table events enable row level security;
create policy "Anyone can submit an event"
  on events for insert
  with check (true);
create policy "Anyone can read approved events"
  on events for select
  using (approved = true or auth.uid() = submitted_by);

-- ── 5. Profiles table — add missing columns if they don't exist
-- Run these individually if the profiles table already exists:
alter table profiles add column if not exists whatsapp_phone text;
alter table profiles add column if not exists olx_username text;
alter table profiles add column if not exists display_name text;
alter table profiles add column if not exists username text unique;
alter table profiles add column if not exists is_pro boolean default false;
alter table profiles add column if not exists is_developer boolean default false;
alter table profiles add column if not exists pro_since timestamptz;
alter table profiles add column if not exists razorpay_payment_id text;

-- If profiles table doesn't exist yet, create it:
create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text,
  display_name        text,
  username            text unique,
  whatsapp_phone      text,
  olx_username        text,
  is_pro              boolean default false,
  is_developer        boolean default false,
  pro_since           timestamptz,
  razorpay_payment_id text,
  created_at          timestamptz default now()
);

alter table profiles enable row level security;
create policy if not exists "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy if not exists "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy if not exists "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
