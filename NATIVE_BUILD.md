# HotScan — Native App Build Guide

HotScan supports **three install paths from one codebase**:

| Path | How users get it |
|------|-----------------|
| PWA (browser) | Visit `hotscan.in` → browser install prompt |
| Android app | Google Play Store |
| iOS app | Apple App Store |

The PWA path (`manifest.json` / `sw.js`) is unchanged. Capacitor wraps the same
web build into native shells for the app stores.

---

## Prerequisites

| Tool | Required for |
|------|-------------|
| Node.js ≥ 18 | Both platforms |
| Android Studio (latest) | Android only |
| macOS + Xcode ≥ 15 | iOS only |
| Apple Developer account ($99/yr) | iOS App Store submission only |

---

## One-time setup (already done)

The following have already been committed to the repo:
- `capacitor.config.ts` — app ID `in.hotscan.app`, points to `dist/`
- `android/` — Android Studio project skeleton
- `ios/` — Xcode project skeleton

Install dependencies once after cloning:
```bash
npm install
```

For iOS, install CocoaPods (macOS only):
```bash
sudo gem install cocoapods
cd ios/App && pod install
```

---

## Daily development workflow

```bash
# 1. Make your web changes in src/
# 2. Build + sync to both native projects
npm run cap:sync
```

`cap:sync` runs `npm run build` (Vite → `dist/`) then `npx cap sync`
(copies `dist/` into both `android/` and `ios/`).

---

## Android — Google Play Store

### Open in Android Studio
```bash
npm run cap:android   # builds, syncs, then opens Android Studio
```

### Generate a release build
1. In Android Studio → **Build → Generate Signed Bundle / APK**
2. Choose **Android App Bundle (.aab)**
3. Create or use an existing keystore (keep it safe — never commit it)
4. Build type: **release**
5. The `.aab` file will be in `android/app/release/`

### Submit to Play Store
1. Go to [play.google.com/console](https://play.google.com/console)
2. Create a new app → fill in listing details
3. **Production → Releases → Create release** → upload the `.aab`
4. Privacy policy URL: `https://hotscan.in/privacy.html`
5. App icon: use `icon-512.png` (Play Store requires 512 × 512 PNG)

### App icon densities
Android Studio can generate all required launcher icon densities from
`icon-512.png` via **File → New → Image Asset**.

---

## iOS — Apple App Store

> Requires macOS with Xcode and an Apple Developer account.

### Open in Xcode
```bash
npm run cap:ios   # builds, syncs, then opens Xcode
```

### Configure signing
1. In Xcode → select the **App** target → **Signing & Capabilities**
2. Set **Team** to your Apple Developer account
3. Bundle Identifier: `in.hotscan.app`

### Add PrivacyInfo.xcprivacy (required by Apple)
Apple requires a privacy manifest for apps using WKWebView. A template is at
`ios/App/App/PrivacyInfo.xcprivacy` — update it to list any APIs your app uses
(camera for scanning, network access, etc.).

### Archive & upload
1. Xcode → **Product → Archive**
2. In the Organizer, click **Distribute App → App Store Connect → Upload**
3. In [App Store Connect](https://appstoreconnect.apple.com), complete the
   listing and submit for review
4. Privacy policy URL: `https://hotscan.in/privacy.html`

---

## App ID reference

| Field | Value |
|-------|-------|
| Capacitor App ID | `in.hotscan.app` |
| Android package name | `in.hotscan.app` |
| iOS bundle ID | `in.hotscan.app` |
| App name | HotScan India |
| Web dir | `dist/` |
