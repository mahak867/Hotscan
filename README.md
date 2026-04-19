<div align="center">

```
██╗  ██╗ ██████╗ ████████╗███████╗ ██████╗ █████╗ ███╗   ██╗
██║  ██║██╔═══██╗╚══██╔══╝██╔════╝██╔════╝██╔══██╗████╗  ██║
███████║██║   ██║   ██║   ███████╗██║     ███████║██╔██╗ ██║
██╔══██║██║   ██║   ██║   ╚════██║██║     ██╔══██║██║╚██╗██║
██║  ██║╚██████╔╝   ██║   ███████║╚██████╗██║  ██║██║ ╚████║
╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝
```

# 🔥 HotScan India
### India's First & Only Hot Wheels AI Price Scanner

**Point your camera at any Hot Wheels → Get live Indian prices instantly. Free.**

[![Live App](https://img.shields.io/badge/🌐_Live_App-hotscan.in-e63946?style=for-the-badge)](https://www.hotscan.in)
[![Version](https://img.shields.io/badge/Version-8.2-ffd60a?style=for-the-badge)](https://github.com/mahak867/Hotscan)
[![Made in India](https://img.shields.io/badge/Made_in-India_🇮🇳-ff9933?style=for-the-badge)](https://www.hotscan.in)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge)](https://www.hotscan.in)
[![License](https://img.shields.io/badge/License-MIT-2dc653?style=for-the-badge)](LICENSE)

---

> *Every Indian Hot Wheels collector was guessing prices — overpaying at Hamleys,*
> *underselling on OLX, missing Treasure Hunts they couldn't identify.*
> **HotScan fixes all of that.**

</div>

---

## 🚀 What Is HotScan?

A **free Progressive Web App** — install it directly on your phone like a native app, no app store needed — that uses AI to instantly identify any Hot Wheels car and fetch **live Indian market prices** from OLX, Instagram, Hamleys, Flipkart and collector swap meets.

---

## ✨ Features

### 🔍 AI Scanner
| Feature | Detail |
|---|---|
| **Visual ID** | Llama 4 Scout vision — exact car name, series, year, color, tampo, wheel type |
| **Rarity Detection** | Spots Super Treasure Hunt Spectraflame + Real Riders automatically |
| **Multi-Car Scan** | Upload shelf photo → AI identifies every car simultaneously |
| **Fake Detector** | Detects Chinese counterfeits common in Indian toy stores |
| **Barcode Lookup** | Scan barcode number or type car name |
| **Deal Checker** | Seller's price → AI says Steal / Fair / Overpriced |
| **OLX Analyser** | Paste any OLX listing title → instant fair price verdict |

### 💰 Live Indian Pricing
| Source | Data |
|---|---|
| 🏬 India Retail | Hamleys · Flipkart · Amazon India |
| 🤝 India Collector | OLX · Instagram groups · Swap meets |
| 🇺🇸 US Market | Walmart · Target · eBay |
| 📈 Price Trend | Rising / Stable / Falling with reason |
| 👥 Community Prices | Real prices from Indian collectors |

### 💬 WhatsApp Features
- **Smart Share** — formatted card: rarity, trend arrows, full price breakdown, hashtags
- **WA Listing Generator** — auto-fills sale post with car details, price, condition, city
- **Group Broadcast** — short format optimized for WhatsApp collector groups
- **WhatsApp Support** — direct message for help

### 📦 Collection Manager
- Track full Hot Wheels collection with auto-valuation in ₹
- Sort by rarity, value, date, A-Z
- Filter by Common / TH / STH / Vintage / Error
- Export PDF Valuation Certificate
- Cloud sync across devices via Supabase

### 🏆 Community
- **Indian Collector Leaderboard** — ranked by community price submissions
- **Community price submissions** — crowdsourced real prices
- **Deal Alerts watchlist** — OLX + Instagram search links
- **Marketplace** — buy/sell listings in-app

### 📊 Portfolio Tracker
- Collection value breakdown: STH/TH vs Vintage vs Rare vs Common
- Visual bar chart with ₹ amounts and percentages

### 🎯 Hunt Mode
- Mainline 2024 checklist · TH + STH guide · Premium series · Vintage guide
- Indian prices per car · Check off as you find them

---

## 🤖 AI Pipeline

```
📸 Photo  →  👁 Llama 4 Scout (Vision)  →  💰 Kimi K2 (Indian Market)  →  ✅ Result
                  ~4 seconds                      ~6 seconds              Full price card
```

All models on **Groq** — fastest AI inference. Free tier is plenty for personal use.

---

## 📱 Install as App (No App Store Needed)

HotScan is a fully installable **Progressive Web App (PWA)**. It sits on your home screen, opens full-screen with no browser bar, and works offline for cached pages — just like a native app.

### Android (Chrome / Samsung Internet)
1. Open [hotscan.in](https://www.hotscan.in)
2. An **"Install HotScan"** banner automatically appears at the bottom of the screen
3. Tap **Install** → the app is added to your home screen instantly

> Chrome also shows an install icon (⊕) in the address bar.

### iPhone / iPad (Safari)
1. Open [hotscan.in](https://www.hotscan.in) in **Safari**
2. An instruction sheet slides up after a few seconds — or follow these steps manually:
   - Tap the **Share button** (⎙) at the bottom of Safari
   - Scroll down and tap **"Add to Home Screen"**
   - Tap **"Add"** — done! 🎉

> iOS requires Safari specifically. Chrome/Firefox on iOS won't show the install option.

### What you get after installing
- 🏠 Home screen icon with the HotScan logo
- 📱 Full-screen experience (no browser chrome)
- ⚡ Faster load times (assets cached by service worker)
- 🔔 Deal alert push notifications (coming soon)
- 📲 Long-press shortcuts: **Scan a Car** · **My Collection**

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS ES modules — Vite 6 build (`src/`) |
| PWA | Web App Manifest · Service Worker (cache-first, offline support) |
| AI Vision | `meta-llama/llama-4-scout-17b-16e-instruct` via Groq |
| AI Prices | `moonshotai/kimi-k2-instruct` via Groq |
| Auth | Supabase Auth — Google OAuth + email/password |
| Database | Supabase PostgreSQL |
| Payments | Razorpay (₹99/month Pro) |
| Hosting | Vercel · hotscan.in domain |

---

## ⭐ Rarity Guide

| Rarity | India Price | What to Look For |
|---|---|---|
| Common | ₹150–200 | Plastic 5-spoke wheels, mass produced |
| Uncommon | ₹200–500 | Slightly limited run |
| Rare | ₹500–1,500 | Older casting, limited series |
| 🔥 Treasure Hunt | ₹1,000–3,000 | Flame logo on card · 1 per case |
| 💎 Super Treasure Hunt | ₹3,000–15,000 | Spectraflame paint + Real Riders rubber |
| 🚨 Error Car | ₹5,000–50,000 | Factory mistake — extremely rare |
| 🏺 Vintage Redline | ₹3,000–20,000 | Pre-1977 · Red stripe on tires |

---

## 💸 Plans

| Plan | Price | Features |
|---|---|---|
| **Free** | ₹0 | 5 scans/day · Collection tracker · Community |
| **Pro** | ₹99/month | Unlimited scans · Cloud sync · PDF export · Priority AI |
| **Developer** | Lifetime | All Pro features 👑 |

---

## 🗺️ Roadmap

- [ ] Push notifications for price alerts
- [ ] Barcode camera scan mode
- [ ] Collection sharing between users
- [ ] OLX listing auto-draft
- [x] Installable PWA on iPhone & Android (v8.1)

---

## 🔒 Security & Privacy

### API Key Protection
- **No keys in the browser.** Groq API keys are stored exclusively in Vercel environment variables and are never shipped to the client.
- **Server-side proxy.** Every AI request goes through `/api/groq` — a Vercel Edge Function — which injects the key before forwarding to Groq. The raw key is never visible in browser network traffic.
- **User-owned key (optional).** Power users can supply their own Groq key in *Settings → Personal API Key*. It is stored only in `localStorage` on their device and sent directly to Groq — it never passes through our servers.
- **Supabase anon key** is intentionally public (by Supabase design). It is scoped to Row-Level Security policies so each user can only read/write their own rows.

### Rate Limiting & Abuse Prevention
- **Per-IP rate limit** in the `/api/groq` edge proxy: **10 requests / IP / 60 s** before any Groq call is made.
- **Key pool rotation.** Up to 5 Groq keys rotate round-robin; on a `429` the proxy immediately retries the next key.
- **Free scan quota.** Free users get **5 scans / day** (checked against `localStorage`). Pro status is verified server-side via `profiles.is_pro` in Supabase.
- **CORS allowlist.** The API proxy rejects any origin not in the explicit allowlist (`hotscan.in`, Vercel preview URLs).

### Data Privacy
- **No PII in AI prompts.** Only the compressed car photo (resized to ≤512 px JPEG) is sent to Groq. No user email, ID, or location is included.
- **Analytics.** HotScan uses [Plausible](https://plausible.io) — cookieless, GDPR-compliant, no cross-site tracking.
- Full details: [Privacy Policy →](https://hotscan.in/privacy.html)

### XSS Prevention
- All AI-generated strings rendered via `innerHTML` pass through `escHtml()` (HTML-encodes `& < > " '`).
- User inputs pass through `sanitize()` (strips `< > " '`, max 500 chars) before any database write.

---

## 🏗️ Repository Architecture

The repo is split into three independent sub-parts that share a single root `package.json` for the main PWA:

```
Hotscan/
├── src/              # Vite-compiled PWA source (Vanilla JS ES modules)
│   ├── config.js     # App constants & env var bridge
│   ├── state.js      # Shared mutable state
│   ├── groq.js       # Groq AI SDK calls (vision + text)
│   ├── scanner.js    # AI pipeline — identify / price / deal / fake
│   ├── collection.js # Collection CRUD + Supabase cloud sync
│   ├── marketplace.js# Peer-to-peer listings
│   ├── auth.js       # Supabase auth + Razorpay payments
│   ├── ui.js         # UI layer — navigation, alerts, share, hunt
│   └── main.js       # Entry point (wires modules, exposes window.*)
├── api/
│   └── groq.js       # Vercel Edge Function — Groq API proxy with rate-limiting
├── extension/        # Chrome/Edge browser extension (standalone, no build step)
│   ├── manifest.json
│   ├── popup.html / popup.js / popup.css
│   └── background.js
├── index.html        # PWA main app shell
├── landing.html      # Marketing landing page
├── sign-in.html      # Auth page
├── vite.config.js    # Vite build config (output → dist/)
├── vercel.json       # Vercel routing + headers config
└── manifest.json     # PWA web-app manifest
```

**Build commands per sub-part:**

| Part | Build command |
|---|---|
| PWA (main app) | `npm run build` → `dist/` |
| Edge API | No build — deployed as-is by Vercel from `api/` |
| Browser extension | No build — load `extension/` as unpacked extension |

---

## 🔧 Local Development Setup

### Prerequisites

- **Node.js 20+** (`node -v` to check)
- A free [Groq API key](https://console.groq.com) (for AI features)
- A [Supabase](https://supabase.com) project (for auth + collection sync)

### Quick start

```bash
git clone https://github.com/mahak867/Hotscan
cd Hotscan
npm ci                # install exact versions from package-lock.json

cp .env.example .env  # create your local env file — see section below
# edit .env and fill in your keys

npm run dev           # dev server with HMR at http://localhost:5173
npm run build         # production build → dist/
npm run preview       # preview the production build locally
```

---

## 🔑 Environment Variables

All runtime secrets are injected via environment variables — **never hardcoded**.  
A full template is in [`.env.example`](.env.example).

### For local development

```bash
cp .env.example .env
```

Then edit `.env`:

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY_1` | ✅ | Groq API key for AI inference. Get one free at [console.groq.com](https://console.groq.com) |
| `GROQ_API_KEY_2` … `_5` | Optional | Additional Groq keys — rotated round-robin to spread quota |
| `VITE_SUPA_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPA_KEY` | ✅ | Supabase **anon** (public) key — safe to expose, protected by RLS |
| `VITE_RZP_KEY` | Optional | Razorpay **publishable** key for payments |

> **Note:** `GROQ_API_KEY_*` variables are read server-side by the Vercel Edge Function at `api/groq.js` and are **never** shipped to the browser.  
> `VITE_*` variables are baked into the client bundle at build time — only use them for intentionally public/publishable keys.

### For Vercel deployment

Add the same variables in **Vercel Dashboard → Project → Settings → Environment Variables**.  
`VITE_*` variables must be set for **both** Production and Preview environments.

---

## 🚀 Deployment

### Vercel (recommended — live at [hotscan.in](https://www.hotscan.in))

1. Fork / import the repo in [Vercel](https://vercel.com/new)
2. Vercel auto-detects Vite — no framework override needed
3. Add all environment variables listed above in **Settings → Environment Variables**
4. Click **Deploy** — Vercel runs `npm run build` and serves `dist/`
5. The `api/` folder is automatically deployed as Vercel Edge Functions
6. Point your custom domain in **Settings → Domains**

> `vercel.json` already configures SPA routing rewrites and correct headers for the PWA manifest and service worker.

### Browser Extension (Chrome / Edge)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `extension/` folder
4. The HotScan extension icon appears in your toolbar

---

## 🤝 Contributing

```bash
git clone https://github.com/mahak867/Hotscan
npm ci
cp .env.example .env   # fill in your keys
npm run dev            # dev server with HMR at http://localhost:5173
npm run build          # production build → dist/
npm run preview        # preview the production build
```

### Module map

| Module | Responsibility |
|---|---|
| `src/config.js` | App constants, AI model names, hunt data |
| `src/state.js` | Shared mutable application state |
| `src/utils.js` | Pure helpers — `compress`, `escHtml`, `showToast`, `rcls`, etc. |
| `src/groq.js` | Groq API calls — vision + text |
| `src/auth.js` | Supabase auth, Google OAuth, Razorpay |
| `src/scanner.js` | AI car identification, deal/fake/barcode/multi scan |
| `src/collection.js` | Collection CRUD + Supabase cloud sync |
| `src/marketplace.js` | Peer-to-peer listing features |
| `src/ui.js` | Navigation, alerts, share, hunt, referrals, pro modal, profile |
| `src/main.js` | Entry point — wires all modules, exposes `window.*` for HTML handlers |

---

<div align="center">

**Built with ❤️ for Indian Hot Wheels collectors**

🇮🇳 *No one built this for India. So we did.*

[⭐ Star this repo](https://github.com/mahak867/Hotscan) · [🐛 Report a bug](https://github.com/mahak867/Hotscan/issues) · [💬 WhatsApp Support](https://api.whatsapp.com/send?phone=919999999999)

*HotScan India v8.2 · hotscan.in*

</div>
