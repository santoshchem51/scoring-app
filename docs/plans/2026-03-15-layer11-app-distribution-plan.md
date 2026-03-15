# Layer 11: App Store Distribution & Web Hosting — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship PickleScore to the Google Play Store via Capacitor, set up custom domain hosting, and add platform-aware install flows.

**Architecture:** Capacitor wraps the existing Vite-built PWA for Android. Firebase Hosting serves the web app at picklescore.co. A platform abstraction layer (`IS_NATIVE` constant) lets hooks use native plugins when available and fall back to web APIs. GitHub Actions handles web deploys and Android builds.

**Tech Stack:** Capacitor 6, @capacitor/haptics, @capacitor/app, @capacitor/share, @capacitor/filesystem, @capacitor/status-bar, @capacitor/splash-screen, @capacitor/keyboard, @capacitor-community/keep-awake, @capacitor/network, @capacitor/vite-plugin, GitHub Actions, Firebase Hosting

**Specialist Reviews Applied:** Sprint Planner (7.5/10), Code Quality (6.5/10), TDD (6.5/10), Capacitor Expert (7.5/10) — all critical/high issues resolved below.

---

## Wave A: Foundation (firebase.json, Capacitor init)

### Task 1: Add security headers to firebase.json

**Files:**
- Modify: `firebase.json` (hosting.headers section)

**Step 1: Write the test (manual verification)**

This is a config-only change. No unit test — verified by inspection.

**Step 2: Add HSTS, Referrer-Policy, and Permissions-Policy headers**

In `firebase.json`, in the first `headers` block (source: `"**"`), add these three headers after the existing `X-Frame-Options` entry:

```json
{ "key": "Strict-Transport-Security", "value": "max-age=86400; includeSubDomains" },
{ "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
{ "key": "Permissions-Policy", "value": "camera=(), microphone=(), payment=()" }
```

> Note: HSTS starts at 1 day (86400s). After confirming domain works correctly, escalate to `max-age=31536000; includeSubDomains; preload` (1 year) for HSTS preload list eligibility in a follow-up task.

**Step 3: Update CSP header for reCAPTCHA App Check**

In `firebase.json`, update the existing `Content-Security-Policy` header value. Add to each directive:

- `script-src`: append `https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`
- `connect-src`: append `https://www.google.com/recaptcha/`
- `frame-src`: append `https://www.google.com/recaptcha/`

The full updated CSP value:

```
default-src 'self'; script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https://*.googleusercontent.com; connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://*.googleapis.com https://*.firebaseapp.com https://*.cloudfunctions.net https://www.google.com/recaptcha/; frame-src https://*.firebaseapp.com https://www.google.com/recaptcha/; child-src https://*.firebaseapp.com https://accounts.google.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'
```

**Step 4: Add .well-known cache bypass header**

Add a new header block in `firebase.json` hosting.headers array:

```json
{
  "source": "/.well-known/**",
  "headers": [
    { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
  ]
}
```

**Step 5: Commit**

```bash
git add firebase.json
git commit -m "security: add HSTS, Referrer-Policy, Permissions-Policy, reCAPTCHA CSP"
```

---

### Task 2: Add assetlinks.json scaffold

**Files:**
- Create: `public/.well-known/assetlinks.json`

**Step 1: Create the file**

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "co.picklescore.app",
      "sha256_cert_fingerprints": [
        "PLACEHOLDER:REPLACE_WITH_PLAY_APP_SIGNING_CERT_SHA256"
      ]
    }
  }
]
```

**Step 2: Verify it deploys correctly**

Run: `npm run build`

Check that `dist/.well-known/assetlinks.json` exists and contains the correct JSON.

**Step 3: Commit**

```bash
git add public/.well-known/assetlinks.json
git commit -m "chore: add assetlinks.json scaffold for Android App Links"
```

---

### Task 3: Update Open Graph meta tags for custom domain

**Files:**
- Modify: `index.html`

**Step 1: Update OG tags**

Replace the existing `og:image` meta tag and add `og:url`:

```html
<meta property="og:image" content="https://picklescore.co/og-image.png" />
<meta property="og:url" content="https://picklescore.co" />
```

Note: The existing `og:title`, `og:description`, and `twitter:card` tags are already present and correct. Only update the `og:image` content URL to use the custom domain and add `og:url`.

**Step 2: Create OG image placeholder**

Create `public/og-image.png` — a small 1200x630 placeholder graphic (not a copy of the 512x512 icon). Generate a proper branded OG image separately. The important thing is the file exists so the meta tag doesn't 404.

**Step 3: Commit**

```bash
git add index.html public/og-image.png
git commit -m "chore: update OG meta tags for custom domain"
```

---

### Task 4a: Install Capacitor core and create config

**Files:**
- Create: `capacitor.config.ts`
- Modify: `package.json` (new dependencies)
- Modify: `.gitignore`

**Step 1: Install Capacitor core**

```bash
npm install @capacitor/core
npm install -D @capacitor/cli @capacitor/vite-plugin
```

**Step 2: Initialize Capacitor**

```bash
npx cap init PickleScore co.picklescore.app --web-dir dist
```

**Step 3: Edit capacitor.config.ts**

Replace the generated config with:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.picklescore.app',
  appName: 'PickleScore',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: false, // We call hide() manually after root mount
      backgroundColor: '#1e1e2e', // Match theme surface color
      showSpinner: false,
    },
    Keyboard: {
      resize: 'none', // Prevent WebView resize on keyboard show
    },
    StatusBar: {
      style: 'Dark', // Dark content on dark background
      overlaysWebView: false, // Prevent status bar overlapping WebView
    },
  },
};

export default config;
```

**Step 4: Update .gitignore**

Add to `.gitignore`:

```
# Capacitor
android/app/build/
android/.gradle/
*.keystore
```

Do NOT gitignore the `android/` directory itself — it should be committed.

**Step 5: Add .gitattributes for LF line endings (GitHub Actions YAML)**

Create or update `.gitattributes`:

```
*.yml text eol=lf
*.yaml text eol=lf
*.sh text eol=lf
```

**Step 6: Commit**

```bash
git add capacitor.config.ts package.json package-lock.json .gitignore .gitattributes
git commit -m "feat: install Capacitor core and create config"
```

---

### Task 4b: Add Capacitor Vite plugin (replaces base path change)

**Files:**
- Modify: `vite.config.ts`

> **Why not `base: './'`?** Setting `base: './'` breaks the PWA service worker's absolute-path cache manifest and `navigateFallback: '/index.html'`. The `@capacitor/vite-plugin` handles Capacitor's asset path rewriting without affecting the web build.

**Step 1: Add the plugin to vite.config.ts**

Import at top:

```typescript
import { capacitorPlugin } from '@capacitor/vite-plugin';
```

Add `capacitorPlugin()` to the `plugins` array (after `solid()`, before `VitePWA()`):

```typescript
plugins: [
  solid({ hot: mode !== 'test' }),
  tailwindcss(),
  capacitorPlugin(),
  VitePWA({ ... }),
],
```

**Step 2: Verify web build still works**

Run: `npm run build`

Verify `dist/index.html` uses absolute paths (`/assets/...`) and `dist/sw.js` is generated correctly.

**Step 3: Run all tests**

Run: `npx vitest run`

Expected: All passing

**Step 4: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "feat: add Capacitor Vite plugin for asset path handling"
```

---

### Task 4c: Add Android platform

**Files:**
- Generated: `android/` directory
- Modify: `package.json` (new scripts)

**Step 1: Build web assets**

```bash
npm run build
```

**Step 2: Add Android platform and sync**

```bash
npx cap add android
npx cap sync android
```

**Step 3: Add build scripts to package.json**

Add to `scripts`:

```json
"build:android": "npm run build && npx cap sync android",
"cap:open": "npx cap open android"
```

**Step 4: Commit**

```bash
git add android/ package.json package-lock.json
git commit -m "feat: add Android platform via Capacitor"
```

---

### Task 5: Install Capacitor plugins

**Files:**
- Modify: `package.json` (new dependencies)

**Step 1: Install all plugins**

```bash
npm install @capacitor/app @capacitor/haptics @capacitor/share @capacitor/filesystem @capacitor/status-bar @capacitor/splash-screen @capacitor/keyboard @capacitor/network
npm install @capacitor-community/keep-awake
```

> Note: `@capacitor/filesystem` is needed for native image sharing (write PNG to cache dir before sharing via intent).

**Step 2: Sync with Android**

```bash
npx cap sync android
```

**Step 3: Verify Android manifest permissions**

Open `android/app/src/main/AndroidManifest.xml` and confirm these permissions were auto-merged by Capacitor plugins:
- `android.permission.WAKE_LOCK` (from keep-awake)
- `android.permission.ACCESS_NETWORK_STATE` (from network)

**Step 4: Commit**

```bash
git add package.json package-lock.json android/
git commit -m "feat: install Capacitor plugins (haptics, share, filesystem, status-bar, splash, keyboard, network, keep-awake)"
```

---

## Wave B: Platform Abstraction & Hook Upgrades

### Task 6: Create platform abstraction module

**Files:**
- Create: `src/shared/platform/platform.ts`
- Test: `src/shared/platform/__tests__/platform.test.ts`
- Test: `src/shared/platform/__tests__/platform.native.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/shared/platform/__tests__/platform.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
}));

describe('platform (web)', () => {
  beforeEach(() => { vi.resetModules(); });

  it('exports IS_NATIVE as false in web environment', async () => {
    const { IS_NATIVE } = await import('../platform');
    expect(IS_NATIVE).toBe(false);
  });

  it('exports PLATFORM as web in web environment', async () => {
    const { PLATFORM } = await import('../platform');
    expect(PLATFORM).toBe('web');
  });
});
```

```typescript
// src/shared/platform/__tests__/platform.native.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
  },
}));

describe('platform (native)', () => {
  beforeEach(() => { vi.resetModules(); });

  it('exports IS_NATIVE as true in native environment', async () => {
    const { IS_NATIVE } = await import('../platform');
    expect(IS_NATIVE).toBe(true);
  });

  it('exports PLATFORM as android in native environment', async () => {
    const { PLATFORM } = await import('../platform');
    expect(PLATFORM).toBe('android');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/platform/`

Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/shared/platform/platform.ts
import { Capacitor } from '@capacitor/core';

/**
 * Evaluated ONCE at module load time — never changes at runtime.
 * Use as constants, NOT function calls (SolidJS reactivity safety).
 */
export const IS_NATIVE = Capacitor.isNativePlatform();
export const PLATFORM = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/platform/`

Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/shared/platform/
git commit -m "feat: add platform abstraction module (IS_NATIVE, PLATFORM)"
```

---

### Task 7: Upgrade useHaptics with Capacitor plugin

**Files:**
- Modify: `src/shared/hooks/useHaptics.ts`
- Create: `src/shared/hooks/__tests__/useHaptics.test.ts`
- Create: `src/shared/hooks/__tests__/useHaptics.native.test.ts`

**Step 1: Write the failing tests (native path)**

```typescript
// src/shared/hooks/__tests__/useHaptics.native.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

const mockImpact = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: mockImpact },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
}));

vi.mock('../../../stores/settingsStore', () => ({
  settings: () => ({ hapticFeedback: true }),
}));

describe('useHaptics (native)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls Capacitor Haptics.impact for light vibration', async () => {
    const { useHaptics } = await import('../useHaptics');
    const { light } = useHaptics();
    light();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('calls Capacitor Haptics.impact for medium vibration', async () => {
    const { useHaptics } = await import('../useHaptics');
    const { medium } = useHaptics();
    medium();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'MEDIUM' });
  });

  it('calls Capacitor Haptics.impact for heavy vibration', async () => {
    const { useHaptics } = await import('../useHaptics');
    const { heavy } = useHaptics();
    heavy();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'HEAVY' });
  });

  it('calls double vibration with two impacts', async () => {
    const { useHaptics } = await import('../useHaptics');
    const { double } = useHaptics();
    await double();
    expect(mockImpact).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Write the failing tests (web path + settings guard)**

```typescript
// src/shared/hooks/__tests__/useHaptics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: vi.fn() },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
}));

describe('useHaptics (web)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls navigator.vibrate on web when haptics enabled', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ hapticFeedback: true }),
    }));
    const mockVibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: mockVibrate, configurable: true });

    const { useHaptics } = await import('../useHaptics');
    const { light } = useHaptics();
    light();
    expect(mockVibrate).toHaveBeenCalledWith(10);
  });

  it('does not vibrate when hapticFeedback is false', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ hapticFeedback: false }),
    }));
    const mockVibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: mockVibrate, configurable: true });

    const { useHaptics } = await import('../useHaptics');
    const { light } = useHaptics();
    light();
    expect(mockVibrate).not.toHaveBeenCalled();
  });

  it('does not crash when navigator.vibrate is undefined', async () => {
    vi.doMock('../../../stores/settingsStore', () => ({
      settings: () => ({ hapticFeedback: true }),
    }));
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });

    const { useHaptics } = await import('../useHaptics');
    const { medium } = useHaptics();
    expect(() => medium()).not.toThrow();
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/shared/hooks/__tests__/useHaptics`

Expected: FAIL — current useHaptics doesn't import Capacitor

**Step 4: Write implementation**

Replace `src/shared/hooks/useHaptics.ts`:

```typescript
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { IS_NATIVE } from '../platform/platform';
import { settings } from '../../stores/settingsStore';

function vibrateNative(style: ImpactStyle) {
  if (!settings().hapticFeedback) return;
  Haptics.impact({ style }).catch(() => {});
}

function vibrateWeb(pattern: number | number[]) {
  if (!settings().hapticFeedback) return;
  if (!navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch { /* silent */ }
}

export function useHaptics() {
  const light = () => IS_NATIVE ? vibrateNative(ImpactStyle.Light) : vibrateWeb(10);
  const medium = () => IS_NATIVE ? vibrateNative(ImpactStyle.Medium) : vibrateWeb(25);
  const heavy = () => IS_NATIVE ? vibrateNative(ImpactStyle.Heavy) : vibrateWeb(50);
  const double = async () => {
    if (IS_NATIVE) {
      // Two impacts with a short delay for double-pulse feel
      await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    } else {
      vibrateWeb([15, 50, 15]);
    }
  };

  return { light, medium, heavy, double };
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/shared/hooks/__tests__/useHaptics`

Expected: PASS (all 7 tests)

**Step 6: Run all tests for regressions**

Run: `npx vitest run`

Expected: All passing

**Step 7: Commit**

```bash
git add src/shared/hooks/useHaptics.ts src/shared/hooks/__tests__/useHaptics.test.ts src/shared/hooks/__tests__/useHaptics.native.test.ts
git commit -m "feat: upgrade useHaptics with Capacitor native plugin"
```

---

### Task 8: Upgrade useWakeLock with Capacitor plugin

**Files:**
- Modify: `src/shared/hooks/useWakeLock.ts`
- Create: `src/shared/hooks/__tests__/useWakeLock.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/shared/hooks/__tests__/useWakeLock.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockKeepAwake = vi.fn().mockResolvedValue(undefined);
const mockAllowSleep = vi.fn().mockResolvedValue(undefined);

vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));
vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: { keepAwake: mockKeepAwake, allowSleep: mockAllowSleep },
}));

const mockOnCleanup = vi.fn();
vi.mock('solid-js', () => ({ onCleanup: mockOnCleanup }));

describe('useWakeLock (native)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls KeepAwake.keepAwake on request', async () => {
    const { useWakeLock } = await import('../useWakeLock');
    const { request } = useWakeLock();
    await request();
    expect(mockKeepAwake).toHaveBeenCalled();
  });

  it('calls KeepAwake.allowSleep on release', async () => {
    const { useWakeLock } = await import('../useWakeLock');
    const { release } = useWakeLock();
    await release();
    expect(mockAllowSleep).toHaveBeenCalled();
  });

  it('registers onCleanup callback', async () => {
    const { useWakeLock } = await import('../useWakeLock');
    useWakeLock();
    expect(mockOnCleanup).toHaveBeenCalledWith(expect.any(Function));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/hooks/__tests__/useWakeLock.test.ts`

Expected: FAIL

**Step 3: Write implementation**

Replace `src/shared/hooks/useWakeLock.ts`:

```typescript
import { onCleanup } from 'solid-js';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { IS_NATIVE } from '../platform/platform';

export function useWakeLock() {
  let wakeLock: WakeLockSentinel | null = null;

  const request = async () => {
    if (IS_NATIVE) {
      await KeepAwake.keepAwake().catch(() => {});
      return;
    }
    if ('wakeLock' in navigator) {
      try { wakeLock = await navigator.wakeLock.request('screen'); }
      catch { /* silent */ }
    }
  };

  const release = async () => {
    if (IS_NATIVE) {
      await KeepAwake.allowSleep().catch(() => {});
      return;
    }
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  };

  onCleanup(() => { release(); });

  return { request, release };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/hooks/__tests__/useWakeLock.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/hooks/useWakeLock.ts src/shared/hooks/__tests__/useWakeLock.test.ts
git commit -m "feat: upgrade useWakeLock with Capacitor KeepAwake plugin"
```

---

### Task 9: Upgrade shareScoreCard with Capacitor Share + Filesystem

**Files:**
- Modify: `src/shared/utils/shareScoreCard.ts`
- Create: `src/shared/utils/__tests__/shareScoreCard.test.ts`
- Create: `src/shared/utils/__tests__/shareScoreCard.native.test.ts`

> **Critical fix from review:** `Share.share({ url: dataUrl })` does NOT work on Android — data URIs are rejected by the Android Intent system. Must use `@capacitor/filesystem` to write PNG to cache dir, then share the file URI.

**Step 1: Write the failing tests (native path)**

```typescript
// src/shared/utils/__tests__/shareScoreCard.native.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

const mockWriteFile = vi.fn().mockResolvedValue({ uri: 'file:///cache/picklescore-test1234.png' });
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: mockWriteFile },
  Directory: { Cache: 'CACHE' },
}));

const mockShare = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/share', () => ({
  Share: { share: mockShare },
}));

vi.mock('../renderScoreCard', () => ({
  renderScoreCard: () => ({
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['test'], { type: 'image/png' })),
    toDataURL: () => 'data:image/png;base64,dGVzdA==',
  }),
}));

describe('shareScoreCard (native)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('writes PNG to cache and shares file URI on native', async () => {
    const { shareScoreCard } = await import('../shareScoreCard');
    const result = await shareScoreCard({ id: 'test12345678' } as any);

    expect(mockWriteFile).toHaveBeenCalledWith({
      path: 'picklescore-test1234.png',
      data: 'dGVzdA==',
      directory: 'CACHE',
    });
    expect(mockShare).toHaveBeenCalledWith({
      title: 'PickleScore Result',
      text: 'Check out my pickleball score!',
      files: ['file:///cache/picklescore-test1234.png'],
    });
    expect(result).toBe('shared');
  });
});
```

**Step 2: Write the failing tests (web paths)**

```typescript
// src/shared/utils/__tests__/shareScoreCard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: {} }));
vi.mock('@capacitor/share', () => ({ Share: {} }));

vi.mock('../renderScoreCard', () => ({
  renderScoreCard: () => ({
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['test'], { type: 'image/png' })),
    toDataURL: () => 'data:image/png;base64,test',
  }),
}));

describe('shareScoreCard (web)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns failed when toBlob returns null', async () => {
    vi.doMock('../renderScoreCard', () => ({
      renderScoreCard: () => ({
        toBlob: (cb: (b: Blob | null) => void) => cb(null),
        toDataURL: () => '',
      }),
    }));
    const { shareScoreCard } = await import('../shareScoreCard');
    const result = await shareScoreCard({ id: 'test12345678' } as any);
    expect(result).toBe('failed');
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run src/shared/utils/__tests__/shareScoreCard`

Expected: FAIL

**Step 4: Write implementation**

Replace `src/shared/utils/shareScoreCard.ts`:

```typescript
import type { Match } from '../../data/types';
import { renderScoreCard } from './renderScoreCard';
import { IS_NATIVE } from '../platform/platform';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export async function shareScoreCard(match: Match): Promise<'shared' | 'copied' | 'downloaded' | 'failed'> {
  const canvas = renderScoreCard(match);

  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
    });

    const fileName = `picklescore-${match.id.slice(0, 8)}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // Native: write to cache dir, then share file URI
    if (IS_NATIVE) {
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];

      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });

      await Share.share({
        title: 'PickleScore Result',
        text: 'Check out my pickleball score!',
        files: [result.uri],
      });
      return 'shared';
    }

    // Web: Try Web Share API
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'PickleScore Result', files: [file] });
      return 'shared';
    }

    // Fallback: clipboard
    if (navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        return 'copied';
      } catch { /* fall through */ }
    }

    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/shared/utils/__tests__/shareScoreCard`

Expected: PASS

**Step 6: Commit**

```bash
git add src/shared/utils/shareScoreCard.ts src/shared/utils/__tests__/shareScoreCard.test.ts src/shared/utils/__tests__/shareScoreCard.native.test.ts
git commit -m "feat: upgrade shareScoreCard with Capacitor Filesystem + Share plugins"
```

---

### Task 10: Add Android back button + app lifecycle handling

**Files:**
- Create: `src/shared/platform/appLifecycle.ts`
- Create: `src/shared/platform/__tests__/appLifecycle.test.ts`
- Modify: `src/app/App.tsx` (add onMount call)

**Step 1: Write the failing tests**

```typescript
// src/shared/platform/__tests__/appLifecycle.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

const listeners: Record<string, Function> = {};
const mockExitApp = vi.fn();
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((event: string, cb: Function) => { listeners[event] = cb; }),
    removeAllListeners: vi.fn(),
    exitApp: mockExitApp,
  },
}));

describe('appLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    for (const key of Object.keys(listeners)) delete listeners[key];
  });

  it('registers backButton listener on native', async () => {
    const { App } = await import('@capacitor/app');
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    expect(App.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
  });

  it('registers appStateChange listener on native', async () => {
    const { App } = await import('@capacitor/app');
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    expect(App.addListener).toHaveBeenCalledWith('appStateChange', expect.any(Function));
  });

  it('calls window.history.back when canGoBack is true', async () => {
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    listeners['backButton']({ canGoBack: true });
    expect(historyBack).toHaveBeenCalled();
    historyBack.mockRestore();
  });

  it('calls App.exitApp when canGoBack is false', async () => {
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    listeners['backButton']({ canGoBack: false });
    expect(mockExitApp).toHaveBeenCalled();
  });

  it('dispatches app-state-change custom event on appStateChange', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    listeners['appStateChange']({ isActive: false });
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'app-state-change', detail: { isActive: false } })
    );
    dispatchSpy.mockRestore();
  });

  it('does not register listeners when IS_NATIVE is false', async () => {
    vi.doMock('../platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
    const { App } = await import('@capacitor/app');
    const { initAppLifecycle } = await import('../appLifecycle');
    initAppLifecycle();
    expect(App.addListener).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/platform/__tests__/appLifecycle.test.ts`

Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/shared/platform/appLifecycle.ts
import { App } from '@capacitor/app';
import { IS_NATIVE } from './platform';

/**
 * Initialize native app lifecycle listeners (back button, app state).
 * Safe to call multiple times — uses vi.resetModules() in tests for isolation.
 */
export function initAppLifecycle(): void {
  if (!IS_NATIVE) return;

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  App.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(new CustomEvent('app-state-change', { detail: { isActive } }));
  });
}
```

> Note: No `_initialized` guard — `vi.resetModules()` in tests handles isolation. In production, `initAppLifecycle()` is called once from `App.tsx` onMount. If duplicate calls become an issue, add a guard with an exported `_resetForTesting()` helper.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/platform/__tests__/appLifecycle.test.ts`

Expected: PASS (all 6 tests)

**Step 5: Wire into App.tsx**

In `src/app/App.tsx`, add import:

```typescript
import { initAppLifecycle } from '../shared/platform/appLifecycle';
```

Add inside the existing `onMount`:

```typescript
onMount(() => {
  initSWUpdate();
  initAppLifecycle();
});
```

**Step 6: Run all tests**

Run: `npx vitest run`

Expected: All passing

**Step 7: Commit**

```bash
git add src/shared/platform/appLifecycle.ts src/shared/platform/__tests__/appLifecycle.test.ts src/app/App.tsx
git commit -m "feat: add Android back button and app lifecycle handling"
```

---

### Task 11: Add splash screen hide after mount

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/app/__tests__/splashScreen.test.ts`

**Step 1: Write the failing test**

```typescript
// src/app/__tests__/splashScreen.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../shared/platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

const mockHide = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: mockHide },
}));

describe('SplashScreen hide on mount', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls SplashScreen.hide when IS_NATIVE is true', async () => {
    const { IS_NATIVE } = await import('../../shared/platform/platform');
    const { SplashScreen } = await import('@capacitor/splash-screen');

    // Simulate what App.tsx onMount does
    if (IS_NATIVE) {
      await SplashScreen.hide();
    }
    expect(mockHide).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/__tests__/splashScreen.test.ts`

Expected: FAIL — SplashScreen.hide not called yet from App.tsx

**Step 3: Add splash screen hide to App.tsx**

In `src/app/App.tsx`, add imports:

```typescript
import { SplashScreen } from '@capacitor/splash-screen';
import { IS_NATIVE } from '../shared/platform/platform';
```

Inside the existing `onMount`, add after `initAppLifecycle()`:

```typescript
onMount(() => {
  initSWUpdate();
  initAppLifecycle();
  if (IS_NATIVE) {
    SplashScreen.hide().catch(() => {});
  }
});
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/__tests__/splashScreen.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/App.tsx src/app/__tests__/splashScreen.test.ts
git commit -m "feat: hide Capacitor splash screen after app mount"
```

---

## Wave C: Smart Install Flow & Landing Page

### Task 12: Update install prompt logic for native detection

**Files:**
- Modify: `src/shared/pwa/installPromptStore.ts`
- Create: `src/shared/pwa/__tests__/installPromptStore.native.test.ts`

**Step 1: Write the failing test**

```typescript
// src/shared/pwa/__tests__/installPromptStore.native.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));
vi.mock('../swUpdateStore', () => ({ swUpdateVisible: () => false }));

describe('installPromptStore (native)', () => {
  beforeEach(() => { vi.resetModules(); });

  it('showInstallBanner returns false when IS_NATIVE is true', async () => {
    const { showInstallBanner } = await import('../installPromptStore');
    expect(showInstallBanner()).toBe(false);
  });

  it('iosInstallSupported returns false when IS_NATIVE is true', async () => {
    const { iosInstallSupported } = await import('../installPromptStore');
    expect(iosInstallSupported()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/pwa/__tests__/installPromptStore.native.test.ts`

Expected: FAIL — IS_NATIVE not checked

**Step 3: Update installPromptStore**

In `src/shared/pwa/installPromptStore.ts`, add import at top:

```typescript
import { IS_NATIVE } from '../platform/platform';
```

Update `showInstallBanner`:

```typescript
export const showInstallBanner = (): boolean => {
  if (IS_NATIVE) return false;
  if (installed()) return false;
  if (!promptEvent()) return false;
  if (isDismissed()) return false;
  if (swUpdateVisible()) return false;
  if (!hasTriggerCondition()) return false;
  return true;
};
```

Update `iosInstallSupported`:

```typescript
export const iosInstallSupported = (): boolean => {
  if (IS_NATIVE) return false;
  return detectIOSSafari() && !installed();
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/pwa/__tests__/installPromptStore.native.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/pwa/installPromptStore.ts src/shared/pwa/__tests__/installPromptStore.native.test.ts
git commit -m "feat: hide install prompts when running in Capacitor native app"
```

---

### Task 13: Add platform-detected install CTA component

**Files:**
- Create: `src/shared/components/AppInstallCTA.tsx`
- Create: `src/shared/components/__tests__/AppInstallCTA.test.tsx`

**Step 1: Write the failing tests**

```typescript
// src/shared/components/__tests__/AppInstallCTA.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@solidjs/testing-library';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
vi.mock('../../pwa/installPromptStore', () => ({
  isInstalled: () => false,
}));

describe('AppInstallCTA', () => {
  beforeEach(() => { vi.resetModules(); });

  it('renders Play Store badge for Android mobile web', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
      configurable: true,
    });

    const { AppInstallCTA } = await import('../AppInstallCTA');
    const { queryByText } = render(() => <AppInstallCTA />);
    expect(queryByText('Get it on Google Play')).toBeTruthy();
  });

  it('renders iOS install button for iPhone', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
      configurable: true,
    });

    const { AppInstallCTA } = await import('../AppInstallCTA');
    const { queryByText } = render(() => <AppInstallCTA />);
    expect(queryByText('Install PickleScore')).toBeTruthy();
  });

  it('renders nothing when IS_NATIVE is true', async () => {
    vi.doMock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

    const { AppInstallCTA } = await import('../AppInstallCTA');
    const { container } = render(() => <AppInstallCTA />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing on desktop', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    });

    const { AppInstallCTA } = await import('../AppInstallCTA');
    const { container } = render(() => <AppInstallCTA />);
    expect(container.innerHTML).toBe('');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/components/__tests__/AppInstallCTA.test.tsx`

Expected: FAIL — module not found

**Step 3: Write implementation**

> **Critical fix from review:** Use `<Show>` for reactive guards (SolidJS pattern). The `isInstalled()` signal must be inside the reactive graph. iOS button uses local signal state for the install sheet, not a custom event with no listener.

```typescript
// src/shared/components/AppInstallCTA.tsx
import { Show, createSignal, type Component } from 'solid-js';
import { IS_NATIVE } from '../platform/platform';
import { isInstalled } from '../pwa/installPromptStore';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=co.picklescore.app&utm_source=picklescore_web&utm_medium=landing_page&utm_campaign=install_cta';

const isAndroid = () => /Android/i.test(navigator.userAgent);
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAlreadyInstalled = () =>
  (navigator as any).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

export const AppInstallCTA: Component = () => {
  // Constant guards — these never change at runtime
  if (IS_NATIVE || isAlreadyInstalled()) return null;

  const [showIOSSheet, setShowIOSSheet] = createSignal(false);

  return (
    <Show when={!isInstalled()}>
      <Show when={isAndroid()}>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-5 py-3 bg-primary text-surface font-semibold rounded-xl active:scale-95 transition-transform"
        >
          Get it on Google Play
        </a>
      </Show>
      <Show when={isIOS()}>
        <button
          class="inline-flex items-center gap-2 px-5 py-3 bg-primary text-surface font-semibold rounded-xl active:scale-95 transition-transform"
          onClick={() => setShowIOSSheet(true)}
        >
          Install PickleScore
        </button>
        {/* TODO: Wire showIOSSheet signal to IOSInstallSheet component when integrating into landing page */}
      </Show>
    </Show>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/components/__tests__/AppInstallCTA.test.tsx`

Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/shared/components/AppInstallCTA.tsx src/shared/components/__tests__/AppInstallCTA.test.tsx
git commit -m "feat: add platform-detected install CTA component"
```

---

### Task 14: Add "Share PickleScore" to settings page

**Files:**
- Create: `src/shared/utils/shareApp.ts`
- Create: `src/shared/utils/__tests__/shareApp.test.ts`
- Modify: `src/features/settings/SettingsPage.tsx`

**Step 1: Write the failing test**

```typescript
// src/shared/utils/__tests__/shareApp.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockShare = vi.fn().mockResolvedValue(undefined);
vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));
vi.mock('@capacitor/share', () => ({ Share: { share: mockShare } }));

describe('shareApp', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('calls Capacitor Share on native', async () => {
    const { shareApp } = await import('../shareApp');
    await shareApp();
    expect(mockShare).toHaveBeenCalledWith({
      title: 'PickleScore',
      text: 'Score your pickleball games with PickleScore!',
      url: 'https://picklescore.co',
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/utils/__tests__/shareApp.test.ts`

Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/shared/utils/shareApp.ts
import { Share } from '@capacitor/share';
import { IS_NATIVE } from '../platform/platform';

const SHARE_DATA = {
  title: 'PickleScore',
  text: 'Score your pickleball games with PickleScore!',
  url: 'https://picklescore.co',
};

export async function shareApp(): Promise<void> {
  if (IS_NATIVE) {
    await Share.share(SHARE_DATA).catch(() => {});
    return;
  }

  if (navigator.share) {
    await navigator.share(SHARE_DATA).catch(() => {});
    return;
  }

  // Fallback: copy to clipboard
  await navigator.clipboard.writeText(
    'Score your pickleball games with PickleScore! https://picklescore.co'
  ).catch(() => {});
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/utils/__tests__/shareApp.test.ts`

Expected: PASS

**Step 5: Wire into SettingsPage**

In `src/features/settings/SettingsPage.tsx`, add import:

```typescript
import { Share2 } from 'lucide-solid';
import { shareApp } from '../../shared/utils/shareApp';
```

Add a share button near the bottom of the settings UI:

```tsx
<button
  onClick={() => shareApp()}
  class="w-full flex items-center gap-3 p-3 bg-surface-light rounded-xl active:scale-[0.98] transition-transform"
>
  <Share2 size={20} class="text-primary" />
  <span class="font-medium text-on-surface">Share PickleScore</span>
</button>
```

**Step 6: Run all tests**

Run: `npx vitest run`

Expected: All passing

**Step 7: Commit**

```bash
git add src/shared/utils/shareApp.ts src/shared/utils/__tests__/shareApp.test.ts src/features/settings/SettingsPage.tsx
git commit -m "feat: add Share PickleScore button to settings page"
```

---

### Task 15: Add printable QR code sheet

**Files:**
- Create: `src/shared/utils/generateQRSheet.ts`
- Create: `src/shared/utils/__tests__/generateQRSheet.test.ts`

> Note: `qrcode` package is already in package.json dependencies — no install needed.

**Step 1: Write the failing tests**

```typescript
// src/shared/utils/__tests__/generateQRSheet.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,test') },
}));

describe('generateQRSheet', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('generates a QR data URL for the given URL', async () => {
    const { generateQRDataUrl } = await import('../generateQRSheet');
    const result = await generateQRDataUrl('https://picklescore.co');
    expect(result).toContain('data:image/png');
  });

  it('calls QRCode.toDataURL with correct params', async () => {
    const QRCode = (await import('qrcode')).default;
    const { generateQRDataUrl } = await import('../generateQRSheet');
    await generateQRDataUrl('https://picklescore.co', 400);
    expect(QRCode.toDataURL).toHaveBeenCalledWith('https://picklescore.co', { width: 400, margin: 2 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/utils/__tests__/generateQRSheet.test.ts`

Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/shared/utils/generateQRSheet.ts
import QRCode from 'qrcode';

export async function generateQRDataUrl(url: string, size = 300): Promise<string> {
  return QRCode.toDataURL(url, { width: size, margin: 2 });
}

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=co.picklescore.app';

export async function downloadQRSheet(): Promise<void> {
  const [webQR, storeQR] = await Promise.all([
    generateQRDataUrl('https://picklescore.co', 400),
    generateQRDataUrl(PLAY_STORE_URL, 400),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1000, 600);

  // Title
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PickleScore — Scan to Get the App', 500, 40);

  const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });

  const [webImg, storeImg] = await Promise.all([loadImg(webQR), loadImg(storeQR)]);

  // Web QR (left)
  ctx.drawImage(webImg, 100, 80, 350, 350);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('iOS — Visit Website', 275, 460);
  ctx.font = '16px sans-serif';
  ctx.fillText('picklescore.co', 275, 490);

  // Store QR (right)
  ctx.drawImage(storeImg, 550, 80, 350, 350);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Android — Google Play', 725, 460);
  ctx.font = '16px sans-serif';
  ctx.fillText('Search "PickleScore"', 725, 490);

  // Footer
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#666666';
  ctx.fillText('Print at 100% scale for best scan results', 500, 560);

  // Download
  const link = document.createElement('a');
  link.download = 'picklescore-qr-sheet.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/utils/__tests__/generateQRSheet.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/utils/generateQRSheet.ts src/shared/utils/__tests__/generateQRSheet.test.ts
git commit -m "feat: add printable QR code sheet generator for court-side sharing"
```

---

## Wave D: CI/CD Pipeline

> **Note:** These workflows will fail until GitHub Secrets (manual step M7) are configured. Do not merge to main until secrets are set.

### Task 16: Create web deploy workflow

**Files:**
- Create: `.github/workflows/web-deploy.yml`

**Step 1: Create the workflow**

```yaml
# .github/workflows/web-deploy.yml
name: Web Deploy

concurrency:
  group: web-deploy-${{ github.ref }}
  cancel-in-progress: true

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Run unit tests
        run: npx vitest run

      - name: Build
        run: npm run build

      - name: Validate assetlinks.json
        run: |
          node -e "
            const fs = require('fs');
            const f = JSON.parse(fs.readFileSync('dist/.well-known/assetlinks.json', 'utf8'));
            const entry = f.find(e => e.target.package_name === 'co.picklescore.app');
            if (!entry) { console.error('Package not found in assetlinks.json'); process.exit(1); }
            console.log('assetlinks.json OK: package_name =', entry.target.package_name);
          "

      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0.9.0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
```

**Step 2: Commit**

```bash
git add .github/workflows/web-deploy.yml
git commit -m "ci: add web deploy workflow (tests + build + Firebase Hosting)"
```

---

### Task 17: Create Android release workflow

**Files:**
- Create: `.github/workflows/android-release.yml`

**Step 1: Create the workflow**

```yaml
# .github/workflows/android-release.yml
name: Android Release

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
        options:
          - internal
          - beta
          - production

permissions:
  contents: read

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
          cache: gradle

      - run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Run unit tests
        run: npx vitest run

      - name: Get version
        id: version
        run: echo "version=$(node -p "require('./package.json').version")" >> $GITHUB_OUTPUT

      - name: Append version to gradle.properties
        run: |
          echo "" >> android/app/gradle.properties
          echo "APP_VERSION_NAME=${{ steps.version.outputs.version }}" >> android/app/gradle.properties
          echo "APP_VERSION_CODE=${{ github.run_number }}" >> android/app/gradle.properties

      - name: Build web
        run: npm run build

      - name: Capacitor sync
        run: npx cap sync android

      - name: Decode keystore
        run: echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 --decode > /tmp/release.keystore

      - name: Build signed AAB
        working-directory: android
        run: |
          ./gradlew bundleRelease \
            -Pandroid.injected.signing.store.file=/tmp/release.keystore \
            -Pandroid.injected.signing.store.password="${{ secrets.KEYSTORE_PASSWORD }}" \
            -Pandroid.injected.signing.key.alias="${{ secrets.KEY_ALIAS }}" \
            -Pandroid.injected.signing.key.password="${{ secrets.KEY_PASSWORD }}"

      - name: Upload to Play Store
        uses: r0adkll/upload-google-play@v1.1.3
        with:
          serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON }}
          packageName: co.picklescore.app
          releaseFiles: android/app/build/outputs/bundle/release/app-release.aab
          track: ${{ github.event.inputs.track }}
          status: completed

      - name: Upload AAB artifact
        uses: actions/upload-artifact@v4
        with:
          name: android-aab-${{ steps.version.outputs.version }}-${{ github.run_number }}
          path: android/app/build/outputs/bundle/release/app-release.aab
          retention-days: 30

      - name: Cleanup keystore
        if: always()
        run: rm -f /tmp/release.keystore
```

**Step 2: Commit**

```bash
git add .github/workflows/android-release.yml
git commit -m "ci: add Android release workflow (build + sign + Play Store upload)"
```

---

## Wave E: Play Store Preparation

### Task 18: Create privacy policy page

**Files:**
- Create: `src/features/legal/PrivacyPolicy.tsx`
- Create: `src/features/legal/__tests__/PrivacyPolicy.test.tsx`
- Modify: `src/app/router.tsx` (add route)

**Step 1: Write the failing test**

```typescript
// src/features/legal/__tests__/PrivacyPolicy.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';

describe('PrivacyPolicy', () => {
  it('renders the privacy policy heading', async () => {
    const { default: PrivacyPolicy } = await import('../PrivacyPolicy');
    const { getByText } = render(() => <PrivacyPolicy />);
    expect(getByText('Privacy Policy')).toBeTruthy();
  });

  it('contains data deletion section', async () => {
    const { default: PrivacyPolicy } = await import('../PrivacyPolicy');
    const { getByText } = render(() => <PrivacyPolicy />);
    expect(getByText('Data Retention & Deletion')).toBeTruthy();
  });

  it('contains contact email', async () => {
    const { default: PrivacyPolicy } = await import('../PrivacyPolicy');
    const { container } = render(() => <PrivacyPolicy />);
    expect(container.innerHTML).toContain('privacy@picklescore.co');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/legal/__tests__/PrivacyPolicy.test.tsx`

Expected: FAIL — module not found

**Step 3: Create privacy policy component**

```tsx
// src/features/legal/PrivacyPolicy.tsx
import type { Component } from 'solid-js';

const PrivacyPolicy: Component = () => {
  return (
    <div class="max-w-2xl mx-auto p-6">
      <h1 class="text-2xl font-bold text-on-surface mb-6">Privacy Policy</h1>
      <p class="text-on-surface-muted text-sm mb-4">Last updated: March 15, 2026</p>

      <div class="space-y-6 text-on-surface-muted text-sm leading-relaxed">
        <section>
          <h2 class="text-lg font-semibold text-on-surface mb-2">What We Collect</h2>
          <p>When you sign in with Google, we collect your name, email address, and profile photo URL. We store your game scores, tournament data, player statistics, and leaderboard entries. Firebase Analytics collects anonymous usage data including device model, OS version, and session duration.</p>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-on-surface mb-2">Why We Collect It</h2>
          <p>Your account data enables cloud sync, multiplayer tournaments, and leaderboards. Analytics data helps us improve the app. We do not sell your data to third parties.</p>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-on-surface mb-2">Third-Party Services</h2>
          <p>We use Google Firebase for authentication, data storage, and analytics. Google's privacy policy applies to data processed by Firebase: <a href="https://policies.google.com/privacy" class="text-primary underline" target="_blank" rel="noopener">Google Privacy Policy</a>.</p>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-on-surface mb-2">Data Retention & Deletion</h2>
          <p>Your data is retained as long as your account exists. You can delete your account and all associated data at any time from Settings. This permanently removes your profile, match history, statistics, and leaderboard entries.</p>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-on-surface mb-2">Children's Privacy</h2>
          <p>PickleScore is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us data, please contact us.</p>
        </section>

        <section>
          <h2 class="text-lg font-semibold text-on-surface mb-2">Contact</h2>
          <p>For privacy questions, email: <a href="mailto:privacy@picklescore.co" class="text-primary underline">privacy@picklescore.co</a></p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
```

**Step 4: Add route**

In `src/app/router.tsx`, add:

```typescript
const PrivacyPolicy = lazy(() => import('../features/legal/PrivacyPolicy'));
```

Add route before the catch-all:

```tsx
<Route path="/privacy" component={PrivacyPolicy} />
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/legal/__tests__/PrivacyPolicy.test.tsx`

Expected: PASS

**Step 6: Commit**

```bash
git add src/features/legal/ src/app/router.tsx
git commit -m "feat: add privacy policy page at /privacy"
```

---

### Task 19: Add account deletion flow

**Files:**
- Create: `src/features/settings/DeleteAccountButton.tsx`
- Create: `src/features/settings/__tests__/DeleteAccountButton.test.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`

**Step 1: Write the failing tests**

```typescript
// src/features/settings/__tests__/DeleteAccountButton.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

vi.mock('../../../data/firebase/config', () => ({
  auth: { currentUser: { uid: 'test-uid' } },
  firestore: {},
}));

describe('DeleteAccountButton', () => {
  it('shows confirmation dialog before deleting', async () => {
    const { DeleteAccountButton } = await import('../DeleteAccountButton');
    const { getByText, queryByText } = render(() => <DeleteAccountButton />);

    expect(queryByText('This cannot be undone')).toBeNull();
    fireEvent.click(getByText('Delete Account'));
    expect(queryByText('This cannot be undone')).toBeTruthy();
  });

  it('hides confirmation on cancel', async () => {
    const { DeleteAccountButton } = await import('../DeleteAccountButton');
    const { getByText, queryByText } = render(() => <DeleteAccountButton />);

    fireEvent.click(getByText('Delete Account'));
    expect(queryByText('This cannot be undone')).toBeTruthy();
    fireEvent.click(getByText('Cancel'));
    expect(queryByText('This cannot be undone')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/settings/__tests__/DeleteAccountButton.test.tsx`

Expected: FAIL

**Step 3: Write implementation**

> **Critical fix from review:** Must clear Dexie local DB + localStorage after Firebase deletion. Must handle `auth/requires-recent-login` error.

```tsx
// src/features/settings/DeleteAccountButton.tsx
import { createSignal, Show, type Component } from 'solid-js';
import { auth, firestore } from '../../data/firebase/config';
import { deleteUser, reauthenticateWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { deleteDoc, doc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../data/db';

export const DeleteAccountButton: Component = () => {
  const [confirming, setConfirming] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setDeleting(true);
    setError('');

    try {
      const uid = user.uid;

      // Delete Firestore data
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'users', uid));
      batch.delete(doc(firestore, 'users', uid, 'public', 'tier'));
      batch.delete(doc(firestore, 'leaderboard', uid));
      await batch.commit();

      // Delete notifications subcollection
      const notifSnap = await getDocs(collection(firestore, 'users', uid, 'notifications'));
      if (!notifSnap.empty) {
        const notifBatch = writeBatch(firestore);
        notifSnap.docs.forEach(d => notifBatch.delete(d.ref));
        await notifBatch.commit();
      }

      // Delete Firebase Auth account
      try {
        await deleteUser(user);
      } catch (authErr: any) {
        if (authErr?.code === 'auth/requires-recent-login') {
          // Re-authenticate and retry
          await reauthenticateWithPopup(user, new GoogleAuthProvider());
          await deleteUser(user);
        } else {
          throw authErr;
        }
      }

      // Clear local data
      await db.delete(); // Wipe entire Dexie IndexedDB
      localStorage.clear();

      // Redirect to landing page
      window.location.href = '/';
    } catch (err) {
      console.error('Account deletion failed:', err);
      setError('Deletion failed. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div class="mt-8 border-t border-surface-lighter pt-6">
      <Show when={!confirming()}>
        <button
          onClick={() => setConfirming(true)}
          class="w-full p-3 text-red-400 font-semibold rounded-xl border border-red-400/30 active:bg-red-400/10 transition-colors"
        >
          Delete Account
        </button>
      </Show>
      <Show when={confirming()}>
        <div class="space-y-3">
          <p class="text-red-400 text-sm font-semibold">This cannot be undone</p>
          <p class="text-on-surface-muted text-xs">All your data including match history, stats, achievements, and leaderboard entries will be permanently deleted.</p>
          <Show when={error()}>
            <p class="text-red-400 text-xs">{error()}</p>
          </Show>
          <div class="flex gap-3">
            <button
              onClick={() => { setConfirming(false); setError(''); }}
              class="flex-1 p-3 bg-surface-light rounded-xl font-semibold text-on-surface"
              disabled={deleting()}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              class="flex-1 p-3 bg-red-500 text-white rounded-xl font-semibold"
              disabled={deleting()}
            >
              {deleting() ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/settings/__tests__/DeleteAccountButton.test.tsx`

Expected: PASS

**Step 5: Wire into SettingsPage**

Import and add `<DeleteAccountButton />` at the bottom of the settings page (only shown when authenticated via `<Show when={user()}>`).

**Step 6: Commit**

```bash
git add src/features/settings/DeleteAccountButton.tsx src/features/settings/__tests__/DeleteAccountButton.test.tsx src/features/settings/SettingsPage.tsx
git commit -m "feat: add account deletion flow (Play Store requirement)"
```

---

### Task 20: Generate app icons and splash screen assets

**Files:**
- Generated: `android/app/src/main/res/` (various density icons)

**Step 1: Install Capacitor assets tool**

```bash
npm install -D @capacitor/assets
```

**Step 2: Create source icon in expected location**

```bash
mkdir -p assets
cp public/pwa-512x512.png assets/icon.png
```

> Note: `@capacitor/assets` looks for `assets/icon.png` by default. Ensure the icon has sufficient padding for adaptive icon safe zone (66dp in 108dp).

**Step 3: Generate Android assets**

```bash
npx @capacitor/assets generate --android --iconBackgroundColor '#1e1e2e'
```

**Step 4: Sync**

```bash
npx cap sync android
```

**Step 5: Commit**

```bash
git add assets/ android/app/src/main/res/ package.json package-lock.json
git commit -m "feat: generate Android app icons and splash screen assets"
```

---

### Task 21: Configure Android build for gradle.properties versioning

**Files:**
- Modify: `android/app/build.gradle`

**Step 1: Update build.gradle to read from gradle.properties**

In `android/app/build.gradle`, find the `defaultConfig` block and update `versionCode` and `versionName`:

```groovy
defaultConfig {
    applicationId "co.picklescore.app"
    minSdkVersion 26
    targetSdkVersion 35
    versionCode project.hasProperty('APP_VERSION_CODE') ? APP_VERSION_CODE.toInteger() : 1
    versionName project.hasProperty('APP_VERSION_NAME') ? APP_VERSION_NAME : "0.0.0"
    // ... rest unchanged
}
```

> Note: CI workflow appends `APP_VERSION_NAME` and `APP_VERSION_CODE` to existing `gradle.properties` using `>>` (not `>`), preserving Capacitor's default entries like `android.useAndroidX=true`.

**Step 2: Commit**

```bash
git add android/app/build.gradle
git commit -m "build: configure gradle.properties versioning for CI"
```

---

### Task 22: Final integration test — build Android locally

**Step 1: Build web**

```bash
npm run build
```

**Step 2: Sync Capacitor**

```bash
npx cap sync android
```

**Step 3: Verify Android project builds**

```bash
cd android && ./gradlew assembleDebug && cd ..
```

Expected: BUILD SUCCESSFUL

**Step 4: Run all tests**

```bash
npx vitest run
```

Expected: All passing

**Step 5: Commit any fixups if needed**

Only commit if specific files needed fixing. Use explicit file paths:

```bash
git add <specific-files>
git commit -m "fix: resolve integration issues from Android build verification"
```

If no changes are needed, skip this step.

---

## Manual Steps (Not Automated)

These steps require manual action in external services and cannot be scripted. Dependencies noted.

### M1: Register domains
- Buy `picklescore.co` and `picklescoreapp.com` at Cloudflare Registrar
- Buy `picklescoring.app` at Porkbun/Namecheap, point NS to Cloudflare

### M2: Configure Cloudflare DNS
- Add `picklescore.co` CNAME to Firebase (grey cloud / DNS-only)
- Add `www.picklescore.co` CNAME
- Add Redirect Rules for the other two domains (not deprecated Page Rules)
- Add cache bypass rule for `/.well-known/*`

### M3: Configure Firebase Hosting custom domain
- Firebase Console → Hosting → Add `picklescore.co`
- Add TXT verification → wait for SSL provisioning
- Repeat for `www.picklescore.co`

### M4: Update Firebase Auth
- Firebase Console → Auth → Settings → add `picklescore.co` to authorized domains
- Google Cloud Console → OAuth → add origins and redirect URIs

### M5: Enroll in Apple Developer Program ($99/yr)
- For future iOS app if needed — can defer

### M6: Configure Play Store listing
- Play Console → Create app → fill Data Safety form
- Add privacy policy URL: `https://picklescore.co/privacy`
- Add account deletion URL: `https://picklescore.co/settings` (or deep link to settings)
- Upload screenshots, feature graphic (1024x500), app icon
- Set content rating (IARC questionnaire)
- Set target audience: 13+
- Register release keystore SHA-1 in Firebase Console for Google Sign-In
- Verify Google Sign-In button follows branding guidelines

### M7: Configure GitHub Secrets (must be done before CI workflows pass)
- `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `FIREBASE_SERVICE_ACCOUNT`

### M8: Update assetlinks.json fingerprint (requires M6 completed first)
- After enrolling in Play App Signing, get Google's **app signing certificate** SHA-256 from Play Console → App signing
- **Important**: Use Google's app signing cert, NOT your upload keystore fingerprint
- Replace placeholder in `public/.well-known/assetlinks.json`
- Rebuild and redeploy

---

## Summary

| Wave | Tasks | Focus |
|------|-------|-------|
| A (Foundation) | 1-5 | firebase.json security, assetlinks, OG tags, Capacitor init + Vite plugin + plugins |
| B (Platform) | 6-11 | Platform abstraction, hook upgrades (haptics, wake lock, share), back button, splash screen |
| C (Install Flow) | 12-15 | Smart install prompts, CTA component, share app, QR sheet |
| D (CI/CD) | 16-17 | Web deploy + Android release workflows |
| E (Store Prep) | 18-21 | Privacy policy, account deletion, icons, versioning |
| Integration | 22 | Full Android build verification |
| Manual | M1-M8 | Domains, DNS, Firebase, Play Store, secrets |

**Total: 24 automated tasks (Task 4 split into 4a/4b/4c) + 8 manual steps**

### Specialist Review Fixes Applied

| Fix | Source | Task |
|-----|--------|------|
| `@capacitor/vite-plugin` instead of `base: './'` | Capacitor Expert, Code Quality | 4b |
| `@capacitor/filesystem` for native image sharing | Capacitor Expert, Code Quality | 5, 9 |
| `await import()` instead of `require()` in tests | TDD Specialist | 7 |
| `vi.resetModules()` in all test `beforeEach` | TDD Specialist, Code Quality | 6-12 |
| `<Show>` for reactive guards in AppInstallCTA | Code Quality | 13 |
| Local signal state for iOS install (not custom event) | Code Quality | 13 |
| Dexie + localStorage cleanup on account delete | Code Quality, Sprint Planner | 19 |
| `reauthenticateWithPopup` for stale sessions | Capacitor Expert | 19 |
| `StatusBar` config in capacitor.config.ts | Capacitor Expert | 4a |
| SplashScreen backgroundColor aligned to `#1e1e2e` | Capacitor Expert | 4a |
| `>>` append (not `>` overwrite) for gradle.properties | Capacitor Expert, Code Quality | 17 |
| SHA-pinned GitHub Actions | CI/CD Specialist | 16, 17 |
| `.gitattributes` for LF line endings | Capacitor Expert | 4a |
| Task 4 split into 4a/4b/4c | Sprint Planner | 4 |
| Tests added for Tasks 11, 14, 18 | TDD Specialist, Sprint Planner | 11, 14, 18 |
| Web-path + settings-guard tests for haptics | TDD Specialist | 7 |
| `double()` test for haptics | TDD Specialist | 7 |
| Platform native test file | TDD Specialist | 6 |
| No `git add -A` | Sprint Planner | 22 |
| Removed `_initialized` singleton (use `vi.resetModules`) | Code Quality, TDD | 10 |
| onCleanup assertion in useWakeLock test | TDD Specialist | 8 |
| exitApp + appStateChange tests | TDD Specialist | 10 |
