# HotScan India — Chrome Extension

Identify any Hot Wheels car by name or barcode number, get Indian market prices and investment ratings — without leaving your browser tab.

## Install (Developer Mode)

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `extension/` folder
5. The HotScan icon will appear in your toolbar

## First-time setup

On first click, you'll be asked for a free **Groq API key**:

1. Go to [console.groq.com](https://console.groq.com) (free, takes 2 minutes)
2. Create an API key (starts with `gsk_`)
3. Paste it into the extension popup

Your key is stored **locally in Chrome only** — never sent to our servers.

## Features

- 🔍 **Search by name** — type any Hot Wheels car name
- 🔢 **Search by barcode** — paste the barcode number from the card back
- 🇮🇳 **Indian market prices** in ₹ (retail + collector)
- 🇺🇸 **US prices** for comparison
- 📈 **Investment rating** — Low / Medium / High / Very High
- 💬 **WhatsApp share** — opens native WhatsApp with car details pre-filled
- 💸 **List for Sale** — opens HotScan Marketplace to list your car

## Publishing to the Chrome Web Store

When ready to publish:

1. Zip the contents of this `extension/` folder
2. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay the one-time $5 developer fee (if not already done)
4. Upload the zip and fill in the store listing

The extension is already Manifest V3 compliant and ready for submission.
