# Layer 11: App Store Distribution & Web Hosting — Design

## Overview

Get PickleScore into users' hands via custom domain, Google Play Store (Android), and enhanced install flows. iOS remains PWA-only for now — the existing iOS install sheet guides Safari users through "Add to Home Screen."

### Scope

1. **Custom domain & web hosting** — picklescore.co as primary, with redirects
2. **Android app** — Capacitor wrapper → Play Store
3. **Enhanced landing page** — platform-detected install CTAs, QR codes for court-side sharing
4. **CI/CD pipeline** — GitHub Actions for web deploys + Android builds

### Out of Scope

- iOS App Store (deferred — add later if user demand warrants it)
- Push notifications (Layer 12+)
- Monetization / IAP (Layer 12)
- SEO optimization (separate priority after Layer 11)

---

## Section 1: Custom Domain & Web Hosting

### Architecture

```
picklescore.co (primary)       → Firebase Hosting (Cloudflare DNS-only mode)
www.picklescore.co             → 301 → picklescore.co (Firebase custom domain)
picklescoring.app              → 301 → picklescore.co (Cloudflare Redirect Rule)
picklescoreapp.com             → 301 → picklescore.co (Cloudflare Redirect Rule)
```

### Domain Registration

| Domain | Registrar | Reason |
|--------|-----------|--------|
| picklescore.co | Cloudflare | At-cost pricing, `.co` supported |
| picklescoreapp.com | Cloudflare | At-cost pricing, `.com` supported |
| picklescoring.app | Porkbun or Namecheap | Cloudflare doesn't support `.app` TLD — point nameservers to Cloudflare for unified DNS |

### DNS & Hosting

- **DNS**: Cloudflare free tier — **DNS-only mode (grey cloud)**, no proxy
- **Why no proxy**: Firebase Hosting already has a global CDN. Cloudflare proxy mode breaks Firebase SSL provisioning (ACME challenge interception) and creates double-CDN cache invalidation issues
- **Apex domain**: CNAME record to Firebase (Cloudflare flattens automatically) — do NOT use A records, Firebase IPs can change
- **www handling**: Add `www.picklescore.co` as second Firebase custom domain, redirect to apex

### Firebase Custom Domain Setup

1. Firebase Console → Hosting → Add custom domain `picklescore.co`
2. Add TXT verification record to Cloudflare DNS
3. Add CNAME record pointing to Firebase hosting (Cloudflare flattens at apex)
4. Wait for Firebase to auto-provision SSL (Let's Encrypt)
5. Repeat for `www.picklescore.co` (redirect to apex)

### Redirect Domains

- Use **Cloudflare Redirect Rules** (not deprecated Page Rules)
- Rule 1: `picklescoring.app/*` → 301 → `https://picklescore.co/$1`
- Rule 2: `picklescoreapp.com/*` → 301 → `https://picklescore.co/$1`
- Handle both bare domain and `www` for each

### Firebase Auth Updates (Blocker)

- Firebase Console → Auth → Settings → Authorized Domains: add `picklescore.co`
- Google Cloud Console → OAuth 2.0 Client:
  - Authorized JavaScript Origins: add `https://picklescore.co`
  - Authorized Redirect URIs: add `https://picklescore.co/__/auth/handler`

### Security Headers (add to firebase.json)

```json
{ "key": "Strict-Transport-Security", "value": "max-age=86400; includeSubDomains" },
{ "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
{ "key": "Permissions-Policy", "value": "camera=(), microphone=(), payment=()" }
```

- HSTS starts at 1 day, scale to `max-age=31536000; includeSubDomains; preload` after confirming everything works
- Omit `geolocation=()` from Permissions-Policy — needed for future tournament discovery

### CSP Updates

Add reCAPTCHA directives for App Check:

- `script-src`: add `https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`
- `connect-src`: add `https://www.google.com/recaptcha/`
- `frame-src`: add `https://www.google.com/recaptcha/`

### Prepare for Android App

- Add `public/.well-known/assetlinks.json` (scaffold with placeholder fingerprint)
- Add Cloudflare Cache Rule: bypass cache for `/.well-known/*`

### Cache Strategy

- Keep existing `firebase.json` cache headers (1-year immutable for hashed assets, no-cache for SW/manifest)
- No Cloudflare CDN layer (DNS-only mode) — Firebase CDN handles caching

---

## Section 2: Android App (Capacitor)

### Capacitor Setup

- **Bundle ID**: `co.picklescore.app` (reversed primary domain)
- `@capacitor/core` + `@capacitor/cli`
- `npx cap init PickleScore co.picklescore.app --web-dir dist`
- `npx cap add android`
- **Min SDK: API 26 (Android 8.0)** — covers 99%+ of active devices, required for proper haptic patterns
- **Target SDK: API 35** (current Play Store requirement)

### Plugin Strategy

| Plugin | Priority | Reason |
|--------|----------|--------|
| `@capacitor/app` | Critical | Back button handling, app lifecycle, badge |
| `@capacitor/haptics` | High | Native vibration patterns (replaces navigator.vibrate) |
| `@capacitor/share` | High | Native share sheet |
| `@capacitor/status-bar` | High | Dynamic theme colors per page |
| `@capacitor/splash-screen` | High | Native launch experience, call `hide()` after root mount |
| `@capacitor/keyboard` | High | Prevents WebView resize jumps during input |
| `@capacitor-community/keep-awake` | Medium | More reliable than navigator.wakeLock |
| `@capacitor/network` | Medium | Reliable offline detection in WebView |
| `@capacitor/geolocation` | Deferred | Future tournament discovery |
| `@capacitor/push-notifications` | Deferred | Future |

### Platform Abstraction Layer

Create `src/shared/platform/platform.ts`:

```typescript
import { Capacitor } from '@capacitor/core';

// Evaluate ONCE at module load — this never changes at runtime
// Use as a constant, NOT a function (SolidJS reactivity safety)
export const IS_NATIVE = Capacitor.isNativePlatform();
export const PLATFORM = Capacitor.getPlatform(); // 'android' | 'web'
```

Each existing hook gets an `IS_NATIVE` branch — native path uses Capacitor plugin, web path keeps existing web API unchanged. Import plugins at top level (Capacitor provides web stubs automatically).

### Update Strategy: Bundle Locally

- **Bundle `dist/` inside the APK** (Capacitor's default behavior)
- Do NOT use `server.url` — violates Google Play's remote code execution policy
- Web updates require Play Store re-submission (2-4 hour review for updates)
- Build script: `"build:android": "vite build && npx cap sync android"`
- Vite config: set `base: './'` for local asset loading, or use `@capacitor/vite-plugin`

### Android Back Button

```typescript
// In root App component onMount
import { App as CapApp } from '@capacitor/app';

onMount(() => {
  if (!IS_NATIVE) return;

  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (activeGame) { showExitConfirmDialog(); return; }
    if (canGoBack) { window.history.back(); }
    else { CapApp.exitApp(); }
  });

  CapApp.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) { pauseVoice(); releaseWakeLock(); }
    else { resumeIfNeeded(); }
  });

  onCleanup(() => CapApp.removeAllListeners());
});
```

### App Icons & Splash Screen

- Generate all densities via `npx @capacitor/assets generate --android`
- Source: existing `pwa-512x512.png` (ensure foreground has 66dp safe zone padding for adaptive icons)
- **Splash screen**: `#1e1e2e` background + PickleScore logo
  - Call `SplashScreen.hide()` in root `onMount` after initial data is ready (not at app start)
  - Dark mode: define both light/dark `windowSplashScreenBackground` in `styles.xml`

### Deep Linking (App Links)

- `public/.well-known/assetlinks.json` with release keystore SHA-256 fingerprint
- **Important**: If using Play App Signing, use Google's app signing certificate SHA-256 from Play Console, NOT your upload keystore fingerprint
- `android:autoVerify="true"` in intent filter
- Tournament share links open in-app when installed

### Smart Install Prompt

| Condition | Action |
|-----------|--------|
| `IS_NATIVE` (Capacitor) | Hide all install prompts |
| `isAlreadyInstalled` (standalone mode) | Hide install CTA |
| Android mobile web | Show Play Store link |
| iOS mobile web | Show PWA install guide (existing iOS install sheet) |
| Desktop web | Keep existing PWA install prompt |

### Play Store Submission Requirements

**Blockers to resolve before submission:**

| Item | Action |
|------|--------|
| Data Safety form | Map all Firebase SDK data (Auth fields, Analytics events, Firestore content) |
| Account deletion | Implement in-app "Delete Account" flow + set deletion URL in Play Console |
| Privacy policy | Host at `picklescore.co/privacy` — cover Firebase data, deletion rights, Google as service provider |
| Release SHA-1 | Register release keystore SHA-1 in Firebase Console for Google Sign-In |
| Feature graphic | Create 1024x500 asset |
| Google Sign-In button | Must follow Google's identity branding guidelines |

**Store listing:**

- App name: PickleScore
- Short description (80 chars): "Score pickleball games, run tournaments, track stats & compete on leaderboards"
- Screenshots: scoring screen, tournament bracket, leaderboard, spectator view (realistic data)
- Content rating: Everyone (declare "Users Interact" interactive element)
- Target audience: 13+
- Developer account: Personal (migrate to organization before Layer 12 monetization)

---

## Section 3: Enhanced Landing Page & Smart Install Flow

### Platform Detection

```typescript
const isAndroid = /Android/i.test(navigator.userAgent);
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAlreadyInstalled = window.navigator.standalone === true
  || window.matchMedia('(display-mode: standalone)').matches;
```

### Install CTA Logic

| Condition | Action |
|-----------|--------|
| `IS_NATIVE` (Capacitor) | Hide all install prompts |
| `isAlreadyInstalled` | Hide install CTA |
| Android mobile web | "Get it on Google Play" badge with UTM tracking |
| iOS mobile web | "Install PickleScore" button (⬆ icon) → existing iOS install sheet |
| Desktop | Keep existing PWA install prompt |

### Play Store URL (with attribution)

```
https://play.google.com/store/apps/details?id=co.picklescore.app
  &utm_source=picklescore_web&utm_medium=landing_page&utm_campaign=install_cta
```

### Open Graph Meta Tags (add to index.html)

```html
<meta property="og:title" content="PickleScore — Pickleball Scoring App" />
<meta property="og:description" content="Score live pickleball games, run tournaments, and compete on leaderboards." />
<meta property="og:image" content="https://picklescore.co/og-image.png" />
<meta property="og:url" content="https://picklescore.co" />
```

- Create `og-image.png` (1200x630) — branded graphic with app screenshot
- Ensures link previews work in iMessage, WhatsApp, Twitter, Slack

### QR Code for Court-Side Sharing

- QR code on landing page linking to `picklescore.co`
- **Printable QR sheet** (PDF) accessible from settings page:
  - High-contrast black-on-white, minimum 2" x 2" print size
  - Short URL text below QR (`picklescore.co`) as fallback for outdoor scanning
  - Two QR codes: one for Play Store (Android), one for web (iOS)
- Reuse existing QR generation from `ShareTournamentModal`

### "Share PickleScore" Feature

- Add to settings page
- Uses `@capacitor/share` (native) or `navigator.share()` (web)
- Fallback: copy to clipboard + "Link copied!" toast
- Share text: "Score your pickleball games with PickleScore! https://picklescore.co"

### In-App Store Badge (Android web users only)

- Bottom banner, dismissible, reuses existing tiered dismiss logic
- Never shown to: native app users, standalone PWA users, iOS users, desktop users

---

## Section 4: CI/CD Pipeline (GitHub Actions)

### Workflow Structure

```
.github/workflows/
├── web-deploy.yml        # Every push to main → Firebase Hosting
├── android-release.yml   # Manual trigger → Play Store
```

### web-deploy.yml

```yaml
concurrency:
  group: web-deploy-${{ github.ref }}
  cancel-in-progress: true

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx vitest --run        # abort if tests fail
      - run: npx tsc --noEmit        # abort if type errors
      - run: npm run build
      - run: node -e "..." # validate assetlinks.json content
      - uses: FirebaseExtended/action-hosting-deploy@v0
```

### android-release.yml

```yaml
concurrency:
  group: android-release
  cancel-in-progress: false

on:
  workflow_dispatch:
    inputs:
      track:
        description: 'Play Store track'
        required: true
        default: 'internal'
        type: choice
        options: [internal, beta, production]

permissions:
  contents: read

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '17', cache: gradle }

      # Tests first — abort before expensive Gradle if broken
      - run: npm ci
      - run: npx vitest --run
      - run: npx tsc --noEmit

      # Version: run_number for versionCode (always increasing, no collision)
      - name: Write version
        run: |
          VERSION=$(node -p "require('./package.json').version")
          echo "APP_VERSION_NAME=$VERSION" > android/app/gradle.properties
          echo "APP_VERSION_CODE=${{ github.run_number }}" >> android/app/gradle.properties

      # Build
      - run: npm run build
      - run: npx cap sync android

      # Sign
      - name: Decode keystore
        run: echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 --decode > /tmp/release.keystore

      - name: Build signed AAB
        working-directory: android
        run: ./gradlew bundleRelease
            -Pandroid.injected.signing.store.file=/tmp/release.keystore
            -Pandroid.injected.signing.store.password=${{ secrets.KEYSTORE_PASSWORD }}
            -Pandroid.injected.signing.key.alias=${{ secrets.KEY_ALIAS }}
            -Pandroid.injected.signing.key.password=${{ secrets.KEY_PASSWORD }}

      # Upload
      - uses: r0adkll/upload-google-play@<pinned-sha>
        with:
          serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON }}
          packageName: co.picklescore.app
          releaseFiles: android/app/build/outputs/bundle/release/app-release.aab
          track: ${{ github.event.inputs.track }}
          status: completed

      - uses: actions/upload-artifact@v4
        with:
          name: android-aab-${{ github.run_number }}
          path: android/app/build/outputs/bundle/release/app-release.aab
          retention-days: 30

      - name: Cleanup keystore
        if: always()
        run: rm -f /tmp/release.keystore
```

### Secrets Required

```
KEYSTORE_BASE64                     # base64-encoded release keystore
KEYSTORE_PASSWORD                   # keystore password
KEY_ALIAS                           # signing key alias
KEY_PASSWORD                        # signing key password
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON    # Play Console API service account
FIREBASE_SERVICE_ACCOUNT            # Firebase Hosting deploy
```

### Play App Signing Note

- Google re-signs AABs with their own key before distribution
- `assetlinks.json` must use **Google's app signing certificate SHA-256** (from Play Console → App signing), NOT your upload keystore fingerprint
- This is the #1 misconfiguration for App Links / deep linking

---

## Specialist Reviews Summary

| Section | Specialists | Initial Score | Issues Fixed |
|---------|-------------|---------------|-------------|
| Domain & Hosting | DNS/Hosting, Security | 6.5, 6.5 | Cloudflare proxy mode, Page Rules deprecation, .app registrar, Firebase Auth domains, HSTS, CSP, Referrer-Policy |
| Android App | Capacitor Architecture, Play Store Compliance | 6.5, 6.5 | server.url policy violation, back button, keyboard plugin, IS_NATIVE constant, min SDK, splash timing, Data Safety form, account deletion, privacy policy |
| Landing Page | Landing Page & Conversion | 6.5 | isAlreadyInstalled check, UTM tracking, Open Graph tags, Web Share fallback, IS_NATIVE guard |
| CI/CD Pipeline | GitHub Actions & Mobile CI/CD | 6.5 | Version code formula, gradle.properties, keystore cleanup, test step, SHA-pinned actions, concurrency guards |

## Decision Log

| Decision | Choice | Why |
|----------|--------|-----|
| Wrapping approach | Capacitor (Android only) | Need native plugins (haptics, share, geolocation); iOS deferred as PWA |
| Primary domain | picklescore.co | Exact brand match, memorable, available |
| DNS/CDN | Cloudflare DNS-only (no proxy) | Firebase CDN is sufficient; proxy breaks SSL provisioning |
| Update strategy | Bundle locally in APK | server.url violates Play Store remote code policy |
| Min SDK | API 26 (Android 8.0) | 99%+ coverage, required for VibrationEffect haptics |
| Version code | github.run_number | Always increasing, no semver collision risk |
| Install prompt | Smart detection | IS_NATIVE hides all; Android web → Play Store; iOS web → PWA guide |
| iOS strategy | PWA-only | Saves $99/yr, no Apple review, no macOS CI runner; add later if needed |
| CI/CD | GitHub Actions (web + Android) | Already using GitHub; no iOS means no macOS runner needed |
