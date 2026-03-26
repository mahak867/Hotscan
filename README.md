# 🚗 HotScan India

**India's first Hot Wheels scanner and price guide.**

Scan any Hot Wheels die-cast car with your phone camera and instantly get:
- 🔍 **Car identification** — name, series, casting year, color, tampo
- ⭐ **Rarity rating** — Common to Super Treasure Hunt
- 🇮🇳 **Indian market prices** — retail and collector prices in INR
- 🇺🇸 **US market prices** — retail and eBay collector prices in USD
- 📈 **Investment potential** — Low to Very High rating
- 💸 **Where to sell in India** — OLX, Instagram groups, Maido, etc.
- 📊 **India market insight** — demand, availability, price trends

## How it works

HotScan uses Llama 4 Vision (via Groq API) to visually identify Hot Wheels cars and provide expert-level market data specific to the Indian collector market.

## Setup

1. Open `index.html` in Safari on iPhone
2. Tap Share → Add to Home Screen
3. Get a free Groq API key at [console.groq.com](https://console.groq.com)
4. Enter your key in the app
5. Start scanning!

## Tech Stack

- Pure HTML/CSS/JavaScript — no framework, no build step
- Groq API — Llama 4 Scout 17B vision model
- PWA — works offline after first load, installable on iPhone/Android
- localStorage — API key stored locally on device only

## Privacy

- Your Groq API key is stored only on your device
- Photos are sent directly to Groq API for analysis only
- No data is stored on any server
- No account required

## Roadmap

- [ ] Scan history — keep track of your collection
- [ ] Price alerts — get notified when prices change
- [ ] Collection value tracker
- [ ] Barcode scanning for sealed cars
- [ ] India collector community directory

## Contributing

PRs welcome! If you're an Indian Hot Wheels collector and want to improve the price data or add features, open an issue.

## License

MIT — free to use, fork, and build on.

---

Built for Indian Hot Wheels collectors 🇮🇳
