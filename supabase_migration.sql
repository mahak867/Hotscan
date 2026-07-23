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

-- ── 7. listings table (marketplace) — CRITICAL: missing, causes stuck loader
create table if not exists listings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  rarity      text,
  condition   text,
  price_inr   integer not null,
  city        text,
  phone       text,
  notes       text,
  image_thumb text,
  is_active   boolean default true,
  listed_at   timestamptz default now()
);
alter table listings enable row level security;
do $$ begin
  create policy "listings_select" on listings for select using (is_active = true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "listings_insert" on listings for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "listings_update" on listings for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "listings_delete" on listings for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists idx_listings_active on listings(is_active, listed_at desc);

-- ── 8. Fix listings table columns to match actual code
-- Drop and recreate with correct column names (run this if table was just created)
drop table if exists listings;
create table listings (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid references auth.users(id) on delete cascade not null,
  seller_name  text,
  seller_phone text,
  name         text not null,
  rarity       text,
  condition    text,
  price        integer not null,
  city         text,
  notes        text,
  image_thumb  text,
  is_active    boolean default true,
  listed_at    timestamptz default now()
);
alter table listings enable row level security;
create policy "listings_select" on listings for select using (is_active = true);
create policy "listings_insert" on listings for insert with check (auth.uid() = seller_id);
create policy "listings_update" on listings for update using (auth.uid() = seller_id);
create policy "listings_delete" on listings for delete using (auth.uid() = seller_id);
create index if not exists idx_listings_active on listings(is_active, listed_at desc);

-- ── 9. collection table — used heavily but never in migration
create table if not exists collection (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade not null,
  name                text not null,
  series              text,
  casting_year        text,
  rarity              text,
  color               text,
  tampo               text,
  wheel_type          text,
  india_retail_inr    text,
  india_collector_inr text,
  us_retail_usd       text,
  us_collector_usd    text,
  investment          text,
  investment_reason   text,
  fun_fact            text,
  india_insight       text,
  image_thumb         text,
  added_at            timestamptz default now()
);
alter table collection enable row level security;
do $$ begin create policy "collection_select" on collection for select using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "collection_insert" on collection for insert with check (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "collection_update" on collection for update using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
do $$ begin create policy "collection_delete" on collection for delete using (auth.uid() = user_id); exception when duplicate_object then null; end $$;
create unique index if not exists idx_collection_user_name on collection(user_id, lower(name));

-- ── 10. Fix username login — profiles SELECT policy too restrictive
-- Current policy: auth.uid() = id (can't query when not logged in)
-- Need: anyone can look up email by username (for login flow only)
drop policy if exists "prof_sel" on profiles;
create policy "prof_sel_own" on profiles
  for select using (auth.uid() = id);
create policy "prof_sel_username_lookup" on profiles
  for select using (true);  -- Allow public read for username→email login lookup
-- Note: profiles only contains email + username + display_name — no sensitive data

-- ── SAFE VERSION — wraps all policies in do $$ begin...exception blocks
do $$ begin drop policy if exists "prof_sel_public" on profiles; exception when others then null; end $$;
do $$ begin create policy "prof_sel_public" on profiles for select using (true); exception when duplicate_object then null; end $$;


-- ════════════════════════════════════════════════════════════════════
-- SECURITY HARDENING PATCH — run after all previous migrations
-- Fixes: open insert policies, profile data exposure, is_pro bypass
-- ════════════════════════════════════════════════════════════════════

-- ── 1. scan_logs: lock down insert to authenticated users only ──────
-- Old policy: with check (true) — anyone (anon) could insert fake rows
-- with any user_id, poisoning scan analytics.
drop policy if exists "scan_logs_insert" on scan_logs;
create policy "scan_logs_insert" on scan_logs
  for insert with check (auth.uid() = user_id OR user_id IS NULL);

-- ── 2. referrals: prevent fake referral injection ──────────────────
-- Old policy: with check (true) — anyone could create referrals pointing
-- to any referrer_code + referred_user_id, gaming the referral system.
drop policy if exists "referrals_insert" on referrals;
create policy "referrals_insert" on referrals
  for insert with check (auth.uid() = referred_user_id);

-- ── 3. profiles: restrict SELECT to own row only ───────────────────
-- Old policy: using (true) — entire profiles table (phone, display_name,
-- OLX username) was readable by any anon visitor or any signed-in user.
-- Username lookup for login uses auth.users directly, not profiles.
drop policy if exists "prof_sel_public" on profiles;
drop policy if exists "prof_sel_username_lookup" on profiles;
drop policy if exists "prof_sel_own" on profiles;
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

-- ── 4. profiles UPDATE: block client from self-granting is_pro ─────
-- Old policy allowed any logged-in user to PATCH their own is_pro=true
-- using the anon key from the browser console. is_pro is now immutable
-- by the client — only the webhook (service role key) can set it.
-- The WITH CHECK ensures the submitted row cannot change is_pro or
-- is_developer from their current server-side values.
drop policy if exists "profiles_update" on profiles;
create policy "profiles_update_safe" on profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    AND is_pro       = (SELECT is_pro       FROM profiles WHERE id = auth.uid())
    AND is_developer = (SELECT is_developer FROM profiles WHERE id = auth.uid())
  );

-- ── 5. listings: stop exposing seller phone to all visitors ────────
-- Old policy: using (is_active = true) returned ALL columns including
-- seller_phone to every anonymous visitor. Phone is now only returned
-- to the seller themselves; buyers see a masked row without the number.
-- The contact-seller flow calls a separate RPC that validates the buyer.
drop policy if exists "listings_select" on listings;

-- Sellers can see all their own listings (inc. phone)
create policy "listings_select_own" on listings
  for select using (auth.uid() = seller_id);

-- Public can see active listings but NOT seller_phone
-- (Supabase doesn't support column-level select policies — use a view instead)
create or replace view public_listings as
  select
    id, seller_name, name, rarity, condition,
    price, city, notes, image_thumb, is_active, listed_at
  from listings
  where is_active = true;

-- Grant anon read on the view only
grant select on public_listings to anon, authenticated;

-- ── 6. community_prices: require auth to submit prices ─────────────
-- Old policy allowed anon price submissions, enabling spam.
drop policy if exists "community_prices_insert" on community_prices;
create policy "community_prices_insert" on community_prices
  for insert with check (auth.uid() IS NOT NULL);

-- ── 11. scan_logs cleanup — table grows unbounded (guest rows allowed with
-- user_id IS NULL, no insert rate limit). Run periodically, or schedule with
-- pg_cron if your plan supports it (Database → Extensions → pg_cron).
-- Keeps 35 days of history, which is more than the daily-limit check needs.
delete from scan_logs where scanned_at < now() - interval '35 days';

-- Optional, only if pg_cron is available on your plan:
-- select cron.schedule('scan_logs_cleanup', '0 3 * * *',
--   $$delete from scan_logs where scanned_at < now() - interval '35 days'$$);
