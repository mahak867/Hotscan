<div align="center">

# 🏎️ HotScan India
### India's First Hot Wheels AI Price Scanner

**Point your camera at any Hot Wheels → Get live Indian prices instantly. Free.**

[![Live App](https://img.shields.io/badge/🌐_Live_App-hotscan.in-e63946?style=for-the-badge)](https://hotscan.in)
[![Version](https://img.shields.io/badge/Version-5.0-ffd60a?style=for-the-badge)](https://github.com/mahak867/Hotscan)
[![Made in India](https://img.shields.io/badge/Made_in-India_🇮🇳-ff9933?style=for-the-badge)](https://hotscan.in)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge)](https://hotscan.in)
[![License](https://img.shields.io/badge/License-MIT-2dc653?style=for-the-badge)](LICENSE)

---

> *Every Indian Hot Wheels collector was guessing prices — overpaying at Hamleys,*
> *underselling on OLX, missing Treasure Hunts they couldn't identify.*
> **HotScan fixes all of that.**

</div>

---

## 🚀 What Is HotScan?

A **free Progressive Web App** — install it directly on your phone like a native app, no app store needed — that uses AI to instantly identify any Hot Wheels die-cast car and return **live Indian market prices** sourced from OLX, Instagram, Hamleys, Flipkart, and collector swap meets.

Built by a CSE student, for Indian collectors. First of its kind in India.

---

## ✨ Features

### 🔍 AI Scanner
| Feature | Detail |
|---|---|
| **Visual ID** | Llama 4 Maverick vision — exact name, series, year, color, tampo, wheel type |
| **Rarity Detection** | Automatically spots STH Spectraflame + Real Riders rubber |
| **Multi-Car Scan** | Upload shelf photo → AI identifies every car simultaneously |
| **Fake Detector** | Detects Chinese counterfeits common in Indian toy stores |
| **Barcode / Name Lookup** | Scan barcode number or type any car name |
| **Deal Checker** | Seller's asking price → AI verdict: Steal / Fair / Overpriced |
| **OLX Analyser** | Paste any OLX listing title → instant fair price verdict |

### 💰 Live Indian Pricing
| Source | Data |
|---|---|
| 🏬 India Retail | Hamleys · Flipkart · Amazon India |
| 🤝 India Collector | OLX · Instagram groups · Swap meets |
| 🇺🇸 US Market | Walmart · Target · eBay |
| 📈 Price Trend | Rising / Stable / Falling with reason |
| 👥 Community Prices | Real prices submitted by Indian collectors (cross-user via Supabase) |
| 📊 Price History | Real data when 3+ community reports exist; clearly-labelled estimated trend otherwise |

### 📦 Collection Manager
- Track your full Hot Wheels collection with live ₹ valuation
- Sort by rarity, value, date, A-Z · Filter by Common / TH / STH / Vintage / Error
- Cloud sync across all your devices via Supabase
- Export PDF Valuation Certificate
- Sparkline chart showing monthly additions

### 🏪 Marketplace
- In-app buy/sell listings with WhatsApp contact
- Auto-fill listing from last scan result
- City-based listings · AI-suggested pricing
- OLX and Instagram cross-posting links

### 🎯 Hunt Mode
- 2024–25 mainline checklist · TH + STH hunter guide
- Premium series · Vintage / Error guide
- Indian prices per car · Check off as you find them

### 🔔 Alerts & Community
- Price watchlist — OLX + Instagram direct search links
- Community price submissions — real crowdsourced prices shared across all users
- Referral system — invite friends, earn bonus scans

### 💬 WhatsApp Features
- Smart share card — rarity, trend arrows, full price breakdown
- WA listing generator — auto-fills sale post with car details, price, city
- Group broadcast format — optimized for Hot Wheels collector groups

---

## 🤖 AI Pipeline

```
📸 Photo  →  👁 Llama 4 Maverick (Vision)  →  💰 Llama 3.3 70B (Prices)  →  ✅ Result
                      ~4 seconds                        ~4 seconds             Full price card
```

All models run on **Groq Cloud** — fastest AI inference available.

---

## 📱 Install as App (No App Store Needed)

### Android (Chrome)
1. Open [hotscan.in](https://hotscan.in)
2. Tap **Install** banner at the bottom, or tap ⊕ in the address bar

### iPhone / iPad (Safari)
1. Open [hotscan.in](https://hotscan.in) in **Safari**
2. Tap **Share (⎙)** → **Add to Home Screen** → **Add**

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS ES Modules · Vite 6 build |
| PWA | Web App Manifest · Service Worker (cache-first, offline) |
| AI Vision | `meta-llama/llama-4-maverick-17b-128e-instruct` via Groq |
| AI Prices | `llama-3.3-70b-versatile` via Groq |
| Auth | Supabase Auth — Google OAuth + email/password |
| Database | Supabase PostgreSQL with Row Level Security |
| Payments | Razorpay ₹99/month + server-side webhook verification |
| Hosting | Vercel Edge Functions · hotscan.in |
| Analytics | Plausible (cookieless, GDPR-compliant) |

---

## 💸 Plans

| Plan | Price | Scans | Features |
|---|---|---|---|
| **Free** | ₹0 | 5/day | Scanner · Collection · Marketplace · Community |
| **Pro** | ₹99/month | Unlimited | All Free + Cloud sync · PDF export · Priority AI |
| **Developer** | Lifetime | Unlimited | All Pro features 👑 |

---

## ⭐ Rarity Guide

| Rarity | India Price | What to Look For |
|---|---|---|
| Common | ₹150–200 | Plastic wheels, mass produced |
| Uncommon | ₹200–500 | Slightly limited run |
| Rare | ₹500–1,500 | Older casting, limited series |
| 🔥 Treasure Hunt | ₹1,000–3,000 | Flame logo · 1 per case |
| 💎 Super Treasure Hunt | ₹3,000–15,000 | Spectraflame + Real Riders rubber |
| 🚨 Error Car | ₹5,000–50,000 | Factory mistake — extremely rare |
| 🏺 Vintage Redline | ₹3,000–20,000 | Pre-1977 · Red stripe on tires |

---

## 🔒 Security & Privacy

### API Key Protection
- **No keys in the browser.** Groq API keys live exclusively in Vercel environment variables.
- **Server-side proxy.** Every AI request goes through `/api/groq` (Vercel Edge Function).
- **Key pool rotation.** Up to 5 Groq keys rotate round-robin; on a 429 the proxy retries the next key instantly.
- **User-owned key (optional).** Power users can supply their own Groq key — stored in `localStorage` only, sent directly to Groq, never through our servers.

### Payment Security
- **Server-side webhook.** `/api/razorpay-webhook.js` verifies HMAC-SHA256 signature before granting Pro.
- **No client-side trust.** `profiles.is_pro` is only set via the Supabase `service_role` key — client manipulation has no lasting effect after next sign-in.

### Data Privacy
- No PII in AI prompts — only compressed car photo (≤512px JPEG) sent to Groq.
- All AI-generated strings pass through `escHtml()` before `innerHTML` (XSS prevention).
- Full details: [Privacy Policy](https://hotscan.in/privacy.html)

---

## 🏗️ Architecture

```
Hotscan/
├── src/
│   ├── config.js           # Constants, model names, hunt data
│   ├── state.js            # Shared mutable state
│   ├── groq.js             # Groq API calls (vision + text)
│   ├── scanner.js          # AI pipeline — identify / price / deal / fake / multi
│   ├── collection.js       # Collection CRUD + Supabase sync
│   ├── marketplace.js      # Peer-to-peer listings
│   ├── auth.js             # Supabase auth + Razorpay payments
│   ├── ui.js               # Navigation, alerts, share, hunt, profile
│   ├── main.js             # Entry point
│   └── style.css           # Full app styles
├── api/
│   ├── groq.js             # Edge Function — Groq proxy + rate limiting + key rotation
│   └── razorpay-webhook.js # Edge Function — server-side payment verification
├── extension/              # Chrome/Edge browser extension
├── index.html              # PWA app shell
├── landing.html            # Marketing page
├── sw.js                   # Service Worker
├── manifest.json           # PWA manifest
└── vercel.json             # Routing + cache headers
```

---

## 🔧 Local Development

```bash
git clone https://github.com/mahak867/Hotscan
cd Hotscan
npm ci
cp .env.example .env   # fill in your keys
npm run dev            # http://localhost:5173
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY_1` | ✅ | Groq key — [get free at console.groq.com](https://console.groq.com) |
| `GROQ_API_KEY_2…5` | Optional | Extra keys for round-robin rotation |
| `VITE_SUPA_URL` | ✅ | Supabase project URL |
| `VITE_SUPA_KEY` | ✅ | Supabase anon key |
| `VITE_RZP_KEY` | Optional | Razorpay publishable key |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | Webhook HMAC secret |
| `SUPABASE_SERVICE_KEY` | Optional | Service role key (webhook only) |

---

## 🗺️ Roadmap

- [ ] Push notifications for price drop alerts
- [ ] Camera barcode scan mode
- [ ] Collection sharing between users
- [ ] Android native app (Capacitor)
- [x] Installable PWA — iPhone & Android
- [x] Server-side Razorpay payment verification
- [x] Real community price history (Supabase)
- [x] Multi-car batch scan
- [x] Fake detector
- [x] In-app marketplace

---

<div align="center">

**Built with ❤️ for Indian Hot Wheels collectors**

🇮🇳 *No one built this for India. So we did.*

[⭐ Star this repo](https://github.com/mahak867/Hotscan) · [🐛 Report a bug](https://github.com/mahak867/Hotscan/issues) · [📧 Contact](mailto:mahakfahad07@gmail.com)

*HotScan India v5.0 · hotscan.in*

</div>
