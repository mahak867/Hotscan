<div align="center">

<img src="https://img.shields.io/badge/HotScan-India-e63946?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHRleHQgeT0iMjAiIGZvbnQtc2l6ZT0iMjAiPvCfkqU8L3RleHQ+PC9zdmc+" alt="HotScan India">

# 🚗 HotScan India

### India's First Hot Wheels Scanner

**Scan any Hot Wheels car → Get live Indian market prices instantly**

[![Live App](https://img.shields.io/badge/Live%20App-mahak867.github.io%2FHotscan-e63946?style=flat-square)](https://mahak867.github.io/Hotscan)
[![Version](https://img.shields.io/badge/Version-2.0-ffd60a?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-2dc653?style=flat-square)](#)
[![Made for India](https://img.shields.io/badge/Made%20for-India%20🇮🇳-4cc9f0?style=flat-square)](#)

<br>

> **No one has built this for India. Until now.**
>
> Every Indian Hot Wheels collector has been guessing prices —
> overpaying at Hamleys, underselling on OLX, missing Treasure Hunts
> because they didn't know what they were looking at.
> HotScan fixes that.

</div>

---

## 📱 What It Does

Point your phone camera at any Hot Wheels car and in seconds get:

| Feature | Details |
|---------|---------|
| 🔍 **Car Identification** | Name, series, casting year, color, tampo, wheel type |
| ⭐ **Rarity Rating** | Common → Super Treasure Hunt → Error Car |
| 🇮🇳 **Live Indian Prices** | Retail (Hamleys/Flipkart) + Collector (OLX/Instagram) in ₹ |
| 🇺🇸 **US Market Prices** | Retail + eBay collector price in $ |
| 📈 **Price Trend** | Rising / Stable / Falling with reason |
| 🔴 **Live Listings** | Real current listings from Indian sellers |
| 📊 **Market Insight** | India-specific demand, availability, collector trends |
| 💰 **Investment Potential** | Low → Very High with specific reasoning |
| 💸 **Where to Sell** | Best platforms for Indian sellers |

---

## ⚡ How It Works

HotScan uses a **2-step AI pipeline** for accuracy + live data:

```
📸 Your photo
    │
    ▼
👁  Step 1 — Llama 4 Maverick (Vision AI)
    Identifies the exact car, rarity, condition
    │
    ▼
🔍  Step 2 — Groq Compound AI (Web Search)
    Searches OLX, Amazon India, Instagram, eBay
    for LIVE current prices
    │
    ▼  (fallback if Compound unavailable)
🧠  Step 2b — Kimi K2 (Smartest text model on Groq)
    Deep market knowledge for Indian collector pricing
    │
    ▼
✅  Result with live Indian prices in ~10-15 seconds
```

---

## 🚀 Getting Started

### On iPhone (Recommended)

1. Open [mahak867.github.io/Hotscan](https://mahak867.github.io/Hotscan) in **Safari**
2. Tap **Share** → **"Add to Home Screen"**
3. Get a free API key at [console.groq.com](https://console.groq.com)
4. Enter your key in the app → Start scanning!

### On Android

1. Open [mahak867.github.io/Hotscan](https://mahak867.github.io/Hotscan) in **Chrome**
2. Tap **⋮** → **"Add to Home Screen"**
3. Same setup as above

### On Desktop

Just open the link — works in any browser.

---

## 🤖 AI Models Used

| Step | Model | Purpose |
|------|-------|---------|
| Vision | `meta-llama/llama-4-maverick-17b-128e-instruct` | See and identify the car |
| Live Search | `groq/compound-beta` | Search web for live Indian prices |
| Price Analysis | `moonshotai/kimi-k2-instruct` | Deep Indian market knowledge (fallback) |

All models run on **Groq** — the fastest AI inference platform.
Free tier is more than enough for personal use.

---

## 📲 Features

### 🔍 Scan
- Camera + gallery support
- Auto image compression for fast scans
- Step-by-step pipeline progress indicator
- Estimated time display
- Live listings from Indian sellers

### 🗂 Collection
- Track all your Hot Wheels
- Total collection value in ₹
- Sort by value, rarity, name, date
- Filter by rarity type
- **Export Valuation Certificate** (for insurance)

### 🔔 Deal Alerts
- Watchlist for cars you want
- Direct OLX + Instagram search links per car
- Quick access to Treasure Hunt listings

### 🕐 History
- Last 50 scans with timestamps
- Prices stored for reference

### ⚙️ More
- Indian store links (Amazon, Flipkart, Hamleys, Maido)
- Indian collector community (Instagram, OLX)
- Full rarity guide with Indian price ranges
- WhatsApp share card for collector groups

---

## ⭐ Rarity Guide

| Rarity | India Price | What to Look For |
|--------|------------|------------------|
| Common | ₹150–200 | Any toy store, mass produced |
| Uncommon | ₹200–500 | Slightly harder to find |
| Rare | ₹500–1,500 | Limited run or old casting |
| Treasure Hunt | ₹1,000–3,000 | Flame logo, 1 per case |
| **Super Treasure Hunt** | ₹3,000–15,000 | Real Riders + Spectraflame paint |
| Error Car | ₹5,000–50,000 | Factory mistake, extremely collectible |

---

## 🔒 Privacy

- Your Groq API key is stored **only on your device** (localStorage)
- Photos are sent directly to Groq's API for analysis only
- No user accounts, no tracking, no data collection
- No backend server — fully client-side

---

## 🛣 Roadmap

- [ ] Barcode scanning for sealed blister cards
- [ ] Price history charts (track how value changes over time)
- [ ] Community price submissions (crowdsourced Indian prices)
- [ ] Offline mode with cached car database
- [ ] Collection sharing between users
- [ ] OLX price alert notifications

---

## 🤝 Contributing

PRs welcome! If you're an Indian Hot Wheels collector:

- Found a price inaccuracy? Open an issue
- Want to add a feature? Fork and PR
- Know the Indian collector market well? Help improve the AI prompts

---

## 📄 License

MIT — Free to use, fork, and build on.

---

<div align="center">

**Built with ❤️ for Indian Hot Wheels collectors**

🇮🇳 *No one built this for India. So we did.*

[⭐ Star this repo](https://github.com/mahak867/Hotscan) · [🐛 Report a bug](https://github.com/mahak867/Hotscan/issues) · [💡 Request a feature](https://github.com/mahak867/Hotscan/issues)

</div>
