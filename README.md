# HotScan India

**Point your camera at a Hot Wheels car. Get its Indian market price in seconds.**

[hotscan.in](https://www.hotscan.in) · Progressive Web App · Android · iOS

India has one of the fastest-growing Hot Wheels collector communities in the world and
no price reference built for it. Collectors price cars off US eBay comparables that do
not reflect Indian retail or resale, and counterfeits circulate freely on local resale
platforms. HotScan closes both gaps: identify the casting, price it in rupees, and
flag likely fakes before money changes hands.

---

## Features

| Feature | Description |
|---|---|
| **Photo scan** | Identify casting, series, year, rarity, colour and wheel type from one photo |
| **Batch scan** | Up to five photos in one pass, each car attributed to its source image |
| **Indian pricing** | Retail and collector ranges in INR rather than converted USD comparables |
| **Fake detector** | Authenticity check driven by base markings, with an explicit no-verdict path |
| **Deal check** | Enter an asking price and get a verdict on whether it is fair |
| **Collection** | Cloud-synced, with live valuation, rarity breakdown and value history |
| **Marketplace** | Listings with seller reputation, ratings and gated contact details |

## Stack

- **Frontend** — vanilla JavaScript (ES modules) built with Vite. No framework and no
  runtime dependency beyond Sentry; ships as a single ~207 KB gzipped bundle.
- **Backend** — Vercel serverless functions in `api/`. Groq is proxied server-side so
  keys never reach the client. The proxy round-robins a key pool, enforces per-IP
  limits, and records scans for quota enforcement.
- **Data** — Supabase (Postgres, Auth, Storage) with row-level security throughout.
- **Vision** — Groq, `qwen/qwen3.6-27b`.
- **Native** — Capacitor wraps the same build for Android and iOS.
- **Monitoring** — Sentry for errors, Plausible for analytics.

## Repository layout

```
api/                      Serverless functions (Groq proxy, prices, Razorpay webhook)
src/
  scanner.js              Vision calls; all four scan modes
  collection.js           Collection state, cloud sync, valuation
  marketplace.js          Listings and seller reputation
  auth.js                 Supabase auth, profiles, avatars
  ui.js                   Page rendering and navigation
android/  ios/            Capacitor native shells
extension/                Chrome extension (separate from the web build)
tests/                    Playwright smoke and model-health tests
supabase_migration.sql    Database schema and policies
```

## Running locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and add Supabase and Groq credentials. The app runs
without them, but scanning and cloud sync stay disabled.

```bash
npm run build         # production build
npm test              # Playwright smoke tests
npm run cap:android   # build and open in Android Studio
```

## Database

`supabase_migration.sql` is the schema of record.

> **Do not run the file end to end against a live database.** Section 8 contains
> `drop table if exists listings`, which is safe only on first setup and destroys
> marketplace data on any re-run. Apply new sections individually.

Sections are numbered and additive. Everything from section 6 onward is idempotent and
safe to re-apply.

## Architecture notes

**Scanning is bound by tokens, not requests.** The vision model's ceiling is tokens per
minute. A batch pays the system prompt once instead of once per photo, which is why
multi-photo scans go out as a single request. `max_tokens` is *reserved* against that
ceiling rather than billed on actual output, so it is held flat rather than scaled with
batch size, and batches use smaller images than single scans because vision cost scales
with image area. A `413` triggers a split-and-retry; a `429` does not, because waiting
cannot fix a request that is simply too large.

**Collection sync omits image data by default.** Thumbnails are fetched on the first
sync of a session and backfilled per row afterwards, so the periodic poll does not
re-download the entire collection.

**Marketplace views run as the caller.** Rows are governed by RLS and columns by
grants, so `seller_phone` is unreadable both through the view and by direct query.
Buyers obtain it through a `SECURITY DEFINER` RPC that requires authentication.

## Known limitations

These are stated plainly because they affect how the product behaves today.

- **Free-tier vision quota is the binding constraint on scale.** At 8,000 tokens per
  minute shared across all users, roughly four scans per minute are possible in total.
  A paid tier is required before meaningful traffic.
- **Prices are AI estimates**, labelled as such in the app. Community-submitted sale
  prices are collected but not yet used to correct them.
- **The fake detector is an opinion, not an authentication.** It declines to return a
  confident verdict unless the car's base is in frame.

## Licence

All rights reserved. No licence is currently granted for reuse or redistribution.
