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
-- Serves the fullCloudSync query: filter on user_id, order by added_at desc.
-- idx_collection_user_name can satisfy the filter but not the sort, so every
-- sync was paying for a sort.
create index if not exists idx_collection_user_added on collection(user_id, added_at desc);

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

-- ── 12. get_email_by_username — the username-login RPC the client calls,
-- which was never actually created here. Every username-based sign-in
-- attempt was failing at this exact call, before it could even check
-- whether the username existed — hence the generic "No account found"
-- error on every attempt, valid usernames included.
--
-- SECURITY DEFINER is required here: a plain client-side SELECT against
-- profiles is blocked by the profiles_select_own RLS policy (auth.uid() =
-- id), which is correct for normal reads but means an anonymous, pre-login
-- visitor can never look up ANY row that way — including their own username
-- during login, since they have no session yet. This function narrowly
-- bypasses that, on purpose, returning ONLY the matching email string and
-- nothing else about the account.
create or replace function get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from profiles where username = p_username limit 1
$$;

-- Must be callable by anon — this runs during login, before authentication
grant execute on function get_email_by_username(text) to anon, authenticated;

-- ── 13. Profile pictures ───────────────────────────────────────────────
-- avatar_url holds a public Storage URL, not base64. Avatars render in the
-- header on every page, so inlining them would bloat every profile read.
alter table profiles add column if not exists avatar_url text;

-- Dedicated bucket rather than reusing car-images: different lifecycle
-- (one per user, overwritten) and different access rules.
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- Avatars are world-readable (they appear next to marketplace listings),
-- but a user may only write to a path prefixed with their own user id.
-- storage.foldername(name) returns the path segments, so [1] is the folder.
do $$ begin
  create policy "avatars_public_read" on storage.objects
    for select using (bucket_id = 'avatars');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "avatars_own_insert" on storage.objects
    for insert with check (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "avatars_own_update" on storage.objects
    for update using (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "avatars_own_delete" on storage.objects
    for delete using (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then null; end $$;

-- profiles_update_safe (section 4 above) already restricts profile updates to
-- the owner and freezes is_pro/is_developer, so avatar_url needs no extra policy.

-- ── 14. Seller reputation (marketplace) ────────────────────────────────
-- One rating per buyer per seller, 1-5 stars with an optional written review.
create table if not exists seller_ratings (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid references auth.users(id) on delete cascade not null,
  rater_id   uuid references auth.users(id) on delete cascade not null,
  listing_id uuid references listings(id)   on delete set null,
  stars      smallint not null check (stars between 1 and 5),
  review     text check (review is null or length(review) <= 500),
  created_at timestamptz not null default now(),
  -- Stops one account inflating a seller by rating repeatedly. Re-rating
  -- updates the existing row instead (upsert on this constraint).
  unique (seller_id, rater_id),
  -- Self-rating is the most obvious way to game a reputation system.
  check (seller_id <> rater_id)
);
alter table seller_ratings enable row level security;

-- Ratings are public: the whole point is that buyers can see them.
do $$ begin
  create policy "seller_ratings_select" on seller_ratings for select using (true);
exception when duplicate_object then null; end $$;

-- You may only write a rating authored by yourself.
do $$ begin
  create policy "seller_ratings_insert" on seller_ratings
    for insert with check (auth.uid() = rater_id and auth.uid() <> seller_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "seller_ratings_update" on seller_ratings
    for update using (auth.uid() = rater_id) with check (auth.uid() = rater_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "seller_ratings_delete" on seller_ratings
    for delete using (auth.uid() = rater_id);
exception when duplicate_object then null; end $$;

create index if not exists idx_seller_ratings_seller on seller_ratings(seller_id);

-- Aggregated reputation, safe to expose publicly: counts and averages only,
-- no rater identities.
create or replace view seller_stats as
  select
    l.seller_id,
    max(l.seller_name)                                as seller_name,
    count(distinct l.id)                              as listing_count,
    min(l.listed_at)                                  as selling_since,
    coalesce(round(avg(r.stars)::numeric, 1), 0)      as avg_stars,
    count(distinct r.id)                              as rating_count
  from listings l
  left join seller_ratings r on r.seller_id = l.seller_id
  group by l.seller_id;

grant select on seller_stats to anon, authenticated;

-- public_listings must expose seller_id so the client can join reputation and
-- open a seller profile. seller_id is an opaque uuid, not contact information -
-- seller_phone stays excluded exactly as before.
--
-- Must DROP, not CREATE OR REPLACE: replace cannot insert a column in the
-- middle of an existing view, it reads that as renaming seller_name to
-- seller_id and fails with 42P16. Dropping a view touches no table data.
drop view if exists public_listings;
create view public_listings as
  select
    id, seller_id, seller_name, name, rarity, condition,
    price, city, notes, image_thumb, is_active, listed_at
  from listings
  where is_active = true;

grant select on public_listings to anon, authenticated;

-- ── 15. car-images bucket ──────────────────────────────────────────────
-- uploadImageToStorage() has always written to this bucket, but nothing ever
-- created it. Every upload failed, and saveToCloud then discarded the photo,
-- which is why collection cars render as emoji placeholders.
insert into storage.buckets (id, name, public)
  values ('car-images', 'car-images', true)
  on conflict (id) do nothing;

do $$ begin
  create policy "car_images_public_read" on storage.objects
    for select using (bucket_id = 'car-images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "car_images_own_insert" on storage.objects
    for insert with check (
      bucket_id = 'car-images'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "car_images_own_update" on storage.objects
    for update using (
      bucket_id = 'car-images'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "car_images_own_delete" on storage.objects
    for delete using (
      bucket_id = 'car-images'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
exception when duplicate_object then null; end $$;

-- ── 16. Remove SECURITY DEFINER from the marketplace views ─────────────
-- Supabase's linter flags public_listings and seller_stats as CRITICAL: a view
-- without security_invoker runs with its creator's rights and bypasses RLS on
-- the tables underneath.
--
-- Simply flipping the flag would break both views, because listings only has an
-- own-rows SELECT policy — anonymous visitors would see an empty marketplace.
-- The reason the views existed at all was that Postgres has no column-level
-- RLS, so a view was used to hide seller_phone.
--
-- Postgres does, however, have column-level GRANTs. Rows are handled by RLS and
-- columns by privileges, which together do the job honestly and let both views
-- run as the caller.

-- Rows: anyone may read an active listing.
do $$ begin
  create policy "listings_select_active" on listings
    for select using (is_active = true);
exception when duplicate_object then null; end $$;

-- Columns: seller_phone is not selectable by anyone, through the view or by
-- querying the table directly. Buyers get it via get_listing_contact() below.
revoke select on listings from anon, authenticated;
grant select (
  id, seller_id, seller_name, name, rarity, condition,
  price, city, notes, image_thumb, is_active, listed_at
) on listings to anon, authenticated;

-- Both views now run with the caller's own permissions.
alter view public_listings set (security_invoker = on);
alter view seller_stats   set (security_invoker = on);

-- ── 17. Contact-seller RPC ─────────────────────────────────────────────
-- The client reads listing.seller_phone to build the WhatsApp link, but
-- public_listings has never returned that column, so the Contact button has
-- always failed with "Seller has not shared a contact number".
--
-- SECURITY DEFINER is correct here in a way it was not for the views: this is a
-- narrow function that returns exactly one field, for one active listing, only
-- to a signed-in caller. Requiring sign-in means phone numbers cannot be
-- harvested anonymously.
create or replace function get_listing_contact(p_listing_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select l.seller_phone
  from listings l
  where l.id = p_listing_id
    and l.is_active = true
    and auth.uid() is not null
$$;

revoke execute on function get_listing_contact(uuid) from anon;
grant execute on function get_listing_contact(uuid) to authenticated;

-- ── 18. Close RLS loopholes ────────────────────────────────────────────

-- scan_logs was world-readable: `select using (true)` let any signed-in user
-- read every other user's id and full scan timestamps. Insert was equally open,
-- so scans could be attributed to someone else.
drop policy if exists "scan_logs_select" on scan_logs;
drop policy if exists "scan_logs_insert" on scan_logs;
do $$ begin
  create policy "scan_logs_select_own" on scan_logs
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  -- user_id IS NULL is a guest scan, which nobody can later claim.
  create policy "scan_logs_insert_own" on scan_logs
    for insert with check (user_id is null or auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- referrals: `insert with check (true)` let anyone POST arbitrary rows and farm
-- referral rewards. A referral may now only be recorded for yourself.
drop policy if exists "referrals_insert" on referrals;
do $$ begin
  create policy "referrals_insert_self" on referrals
    for insert with check (auth.uid() = referred_user_id);
exception when duplicate_object then null; end $$;

-- community_prices: this is the dataset the whole price guide depends on, so it
-- is the most valuable thing to poison. Previously any authenticated user could
-- submit unlimited prices for any car under any user_id — letting a seller
-- inflate the "community verified" price on a casting they are about to list.
-- Submissions are now attributable and rate limited.
drop policy if exists "community_prices_insert" on community_prices;
do $$ begin
  create policy "community_prices_insert_own" on community_prices
    for insert with check (
      auth.uid() is not null
      and auth.uid() = user_id
      and (
        select count(*) from community_prices c
        where c.user_id = auth.uid()
          and c.created_at > now() - interval '1 hour'
      ) < 10
    );
exception when duplicate_object then null; end $$;

-- events: anonymous inserts allowed unlimited spam into a moderation queue.
drop policy if exists "events_insert" on events;
do $$ begin
  create policy "events_insert_auth" on events
    for insert with check (auth.uid() is not null and auth.uid() = submitted_by);
exception when duplicate_object then null; end $$;

-- ── 19. Gate seller ratings behind a real interaction ──────────────────
-- Ratings previously required nothing but an account: a competitor could sink a
-- rival's score, and a seller could have friends inflate theirs. A rating now
-- requires having actually requested that seller's contact details.

create table if not exists listing_contacts (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid references listings(id)     on delete cascade,
  buyer_id     uuid references auth.users(id)   on delete cascade not null,
  seller_id    uuid references auth.users(id)   on delete cascade not null,
  contacted_at timestamptz not null default now(),
  unique (buyer_id, listing_id)
);
alter table listing_contacts enable row level security;

-- Buyers see their own contact history; sellers see who asked about their cars.
do $$ begin
  create policy "listing_contacts_select" on listing_contacts
    for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
exception when duplicate_object then null; end $$;

create index if not exists idx_listing_contacts_pair
  on listing_contacts(buyer_id, seller_id);

-- Rows are written only by get_listing_contact() below, never by the client.
revoke insert, update, delete on listing_contacts from anon, authenticated;

drop policy if exists "seller_ratings_insert" on seller_ratings;
do $$ begin
  create policy "seller_ratings_insert_after_contact" on seller_ratings
    for insert with check (
      auth.uid() = rater_id
      and auth.uid() <> seller_id
      and exists (
        select 1 from listing_contacts lc
        where lc.buyer_id  = auth.uid()
          and lc.seller_id = seller_ratings.seller_id
      )
    );
exception when duplicate_object then null; end $$;

-- get_listing_contact now records the interaction as well as returning the
-- number, which is what makes the rating gate above enforceable.
create or replace function get_listing_contact(p_listing_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone  text;
  v_seller uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select l.seller_phone, l.seller_id into v_phone, v_seller
  from listings l
  where l.id = p_listing_id and l.is_active = true;

  if v_seller is null or v_seller = auth.uid() then
    return v_phone;   -- own listing, or nothing found
  end if;

  insert into listing_contacts (listing_id, buyer_id, seller_id)
  values (p_listing_id, auth.uid(), v_seller)
  on conflict (buyer_id, listing_id) do nothing;

  return v_phone;
end;
$$;

revoke execute on function get_listing_contact(uuid) from anon;
grant execute on function get_listing_contact(uuid) to authenticated;

-- ── 20. Earned seller standing ─────────────────────────────────────────
-- Seller status is accrued from activity, never self-declared: a badge a user
-- can tick is worth nothing as a trust signal, which is the whole problem with
-- a "I am a seller" profile toggle.

-- markListingSold() only set is_active = false, which is indistinguishable from
-- quietly delisting. Completed sales need their own marker to be countable.
alter table listings add column if not exists sold_at timestamptz;

drop view if exists seller_stats;
create view seller_stats as
  select
    l.seller_id,
    max(l.seller_name)                                       as seller_name,
    count(distinct l.id) filter (where l.is_active)          as listing_count,
    count(distinct l.id) filter (where l.sold_at is not null) as sales_count,
    min(l.listed_at)                                         as selling_since,
    coalesce(round(avg(r.stars)::numeric, 1), 0)             as avg_stars,
    count(distinct r.id)                                     as rating_count,
    -- Verified Seller is earned, and every input costs something to fake:
    -- completed sales, ratings from buyers who actually made contact, and a
    -- score high enough that the ratings are good rather than merely present.
    (
      count(distinct l.id) filter (where l.sold_at is not null) >= 3
      and count(distinct r.id) >= 3
      and coalesce(avg(r.stars), 0) >= 4.0
    )                                                        as is_verified_seller
  from listings l
  left join seller_ratings r on r.seller_id = l.seller_id
  group by l.seller_id;

alter view seller_stats set (security_invoker = on);
grant select on seller_stats to anon, authenticated;
