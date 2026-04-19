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
[![CI](https://github.com/mahak867/Hotscan/actions/workflows/ci.yml/badge.svg)](https://github.com/mahak867/Hotscan/actions/workflows/ci.yml)

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

## 🏗️ Architecture

HotScan is a **three-part project** in one repo:

| Part | Path | Description |
|---|---|---|
| **Web App (PWA)** | `src/`, `index.html`, `*.html` | Vanilla JS + Vite 6. All app logic lives in `src/`. Vite bundles it to `dist/` for production. |
| **API Proxy** | `api/groq.js` | Vercel Edge Function — proxies Groq AI requests server-side so API keys are never exposed to the browser. |
| **Browser Extension** | `extension/` | Chrome/Edge extension (Manifest V3) that adds a HotScan shortcut to any page. Standalone; uses its own `manifest.json`. |

### Single-command build (web app)
```bash
npm run build   # → dist/
```

### Deploy (Vercel)
1. Push to `main` — Vercel auto-deploys from the repo root.
2. `api/groq.js` is auto-detected as a Vercel Edge Function.
3. Add your Groq keys in **Vercel → Settings → Environment Variables** (see `.env.example`).

---

## 🔑 Environment Variables

The web app's static code has **no server-side secrets** — the Supabase anon key and Razorpay publishable key in `src/config.js` are intentionally public client-side credentials.

The only secrets required are the **Groq API keys** used by the Vercel Edge Function:

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY_1` | ✅ | Primary Groq key (`gsk_...`) — get free at [console.groq.com](https://console.groq.com) |
| `GROQ_API_KEY_2` – `GROQ_API_KEY_5` | Optional | Additional keys for round-robin rotation / rate-limit resilience |

Copy `.env.example` to `.env` for local reference only. **Never commit `.env` to git.**

For local development the app runs without Groq keys (the AI features will show a "key not configured" message); all other features work via Supabase.

---

## 🤝 Contributing

```bash
git clone https://github.com/mahak867/Hotscan
npm install
npm run dev      # dev server with HMR at localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the production build
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
