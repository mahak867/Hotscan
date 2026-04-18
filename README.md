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
[![Version](https://img.shields.io/badge/Version-8.1-ffd60a?style=for-the-badge)](https://github.com/mahak867/Hotscan)
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
| Frontend | Vanilla HTML/CSS/JS — single file PWA, zero build step |
| PWA | Web App Manifest · Service Worker (cache-first, offline support) |
| AI Vision | `meta-llama/llama-4-scout-17b-16e-instruct` via Groq |
| AI Prices | `moonshotai/kimi-k2-instruct` via Groq |
| Auth | Supabase Auth — Google OAuth + email/password |
| Database | Supabase PostgreSQL |
| Payments | Razorpay (₹99/month Pro) |
| Hosting | GitHub Pages + hotscan.in domain |

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

## 🤝 Contributing

PRs welcome. Single file — no build step needed.

```bash
git clone https://github.com/mahak867/Hotscan
# Open index.html in browser — done
```

---

<div align="center">

**Built with ❤️ for Indian Hot Wheels collectors**

🇮🇳 *No one built this for India. So we did.*

[⭐ Star this repo](https://github.com/mahak867/Hotscan) · [🐛 Report a bug](https://github.com/mahak867/Hotscan/issues) · [💬 WhatsApp Support](https://api.whatsapp.com/send?phone=919999999999)

*HotScan India v8.1 · hotscan.in*

</div>
