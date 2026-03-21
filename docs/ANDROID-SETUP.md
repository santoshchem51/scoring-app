# Android Development Setup

## google-services.json (Required)

1. Go to [Firebase Console](https://console.firebase.google.com/) → Project `picklescore-b0a71`
2. Click the gear icon → Project Settings → Your apps
3. Find the Android app (`co.picklescore.app`) — if not registered, click "Add app" and register it
4. Download `google-services.json`
5. Place it at `android/app/google-services.json`

This file is gitignored and must be set up locally by each developer.

## GitHub Secrets (Required for CI)

| Secret | Description |
|--------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Hosting deploy service account JSON |
| `KEYSTORE_BASE64` | Base64-encoded release keystore |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Signing key alias |
| `KEY_PASSWORD` | Signing key password |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Play Console API service account JSON |

## First Device Test

1. Download `google-services.json` (see above)
2. Run `npm run build:android` (builds web + syncs Capacitor)
3. Open in Android Studio: `npx cap open android`
4. Connect device or start emulator
5. Run from Android Studio
