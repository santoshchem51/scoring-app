# Layer 11: App Store Distribution & Web Hosting — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship PickleScore to the Google Play Store via Capacitor, set up custom domain hosting, and add platform-aware install flows.

**Architecture:** Capacitor wraps the existing Vite-built PWA for Android. Firebase Hosting serves the web app at picklescore.co. A platform abstraction layer (`IS_NATIVE` constant) lets hooks use native plugins when available and fall back to web APIs. GitHub Actions handles web deploys and Android builds.

**Tech Stack:** Capacitor 6, @capacitor/haptics, @capacitor/app, @capacitor/share, @capacitor/status-bar, @capacitor/splash-screen, @capacitor/keyboard, @capacitor-community/keep-awake, @capacitor/network, GitHub Actions, Firebase Hosting

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

Create `public/og-image.png` — a 1200x630 branded graphic. For now, use a placeholder (can be a copy of `pwa-512x512.png` or generate one later). The important thing is the file exists so the meta tag doesn't 404.

**Step 3: Commit**

```bash
git add index.html public/og-image.png
git commit -m "chore: update OG meta tags for custom domain"
```

---

### Task 4: Initialize Capacitor

**Files:**
- Create: `capacitor.config.ts`
- Modify: `package.json` (new scripts + dependencies)
- Generated: `android/` directory

**Step 1: Install Capacitor core**

```bash
npm install @capacitor/core
npm install -D @capacitor/cli
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
      backgroundColor: '#0A0908',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'none', // Prevent WebView resize on keyboard show
    },
  },
};

export default config;
```

**Step 4: Add Android platform**

```bash
npm run build
npx cap add android
```

**Step 5: Update Vite config base path**

In `vite.config.ts`, add `base: './'` to the returned config object (top level, alongside `server`, `plugins`, etc.):

```typescript
export default defineConfig(({ mode }) => ({
  base: './',
  server: { ... },
  // ... rest unchanged
}));
```

**Step 6: Add build scripts to package.json**

Add to `scripts`:

```json
"build:android": "npm run build && npx cap sync android",
"cap:open": "npx cap open android"
```

**Step 7: Update .gitignore**

Add to `.gitignore`:

```
# Capacitor
android/app/build/
android/.gradle/
*.keystore
```

Do NOT gitignore the `android/` directory itself — it should be committed.

**Step 8: Commit**

```bash
git add capacitor.config.ts package.json package-lock.json vite.config.ts .gitignore android/
git commit -m "feat: initialize Capacitor for Android"
```

---

### Task 5: Install Capacitor plugins

**Files:**
- Modify: `package.json` (new dependencies)
- Modify: `capacitor.config.ts` (plugin configs)

**Step 1: Install all plugins**

```bash
npm install @capacitor/app @capacitor/haptics @capacitor/share @capacitor/status-bar @capacitor/splash-screen @capacitor/keyboard @capacitor/network
npm install @capacitor-community/keep-awake
```

**Step 2: Sync with Android**

```bash
npx cap sync android
```

**Step 3: Commit**

```bash
git add package.json package-lock.json android/
git commit -m "feat: install Capacitor plugins (haptics, share, status-bar, splash, keyboard, network, keep-awake)"
```

---

## Wave B: Platform Abstraction & Hook Upgrades

### Task 6: Create platform abstraction module

**Files:**
- Create: `src/shared/platform/platform.ts`
- Test: `src/shared/platform/__tests__/platform.test.ts`

**Step 1: Write the failing test**

```typescript
// src/shared/platform/__tests__/platform.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock @capacitor/core before importing platform
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  },
}));

describe('platform', () => {
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

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/platform/__tests__/platform.test.ts`

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

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/platform/__tests__/platform.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/platform/
git commit -m "feat: add platform abstraction module (IS_NATIVE, PLATFORM)"
```

---

### Task 7: Upgrade useHaptics with Capacitor plugin

**Files:**
- Modify: `src/shared/hooks/useHaptics.ts`
- Modify: `src/shared/hooks/__tests__/useHaptics.test.ts` (if exists, else create)

**Step 1: Write the failing test**

```typescript
// src/shared/hooks/__tests__/useHaptics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock platform as native
vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

// Mock Capacitor Haptics plugin
const mockImpact = vi.fn().mockResolvedValue(undefined);
const mockNotification = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: mockImpact, notification: mockNotification },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS' },
}));

// Mock settings
vi.mock('../../../stores/settingsStore', () => ({
  settings: () => ({ hapticFeedback: true }),
}));

describe('useHaptics (native)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls Capacitor Haptics.impact for light vibration', () => {
    const { useHaptics } = require('../useHaptics');
    const { light } = useHaptics();
    light();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('calls Capacitor Haptics.impact for medium vibration', () => {
    const { useHaptics } = require('../useHaptics');
    const { medium } = useHaptics();
    medium();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'MEDIUM' });
  });

  it('calls Capacitor Haptics.impact for heavy vibration', () => {
    const { useHaptics } = require('../useHaptics');
    const { heavy } = useHaptics();
    heavy();
    expect(mockImpact).toHaveBeenCalledWith({ style: 'HEAVY' });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/hooks/__tests__/useHaptics.test.ts`

Expected: FAIL — current useHaptics doesn't import Capacitor

**Step 3: Write implementation**

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
  const double = () => IS_NATIVE ? vibrateNative(ImpactStyle.Medium) : vibrateWeb([15, 50, 15]);

  return { light, medium, heavy, double };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/hooks/__tests__/useHaptics.test.ts`

Expected: PASS

**Step 5: Run all tests to check for regressions**

Run: `npx vitest run`

Expected: All passing

**Step 6: Commit**

```bash
git add src/shared/hooks/useHaptics.ts src/shared/hooks/__tests__/useHaptics.test.ts
git commit -m "feat: upgrade useHaptics with Capacitor native plugin"
```

---

### Task 8: Upgrade useWakeLock with Capacitor plugin

**Files:**
- Modify: `src/shared/hooks/useWakeLock.ts`
- Create: `src/shared/hooks/__tests__/useWakeLock.test.ts`

**Step 1: Write the failing test**

```typescript
// src/shared/hooks/__tests__/useWakeLock.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

const mockKeepAwake = vi.fn().mockResolvedValue(undefined);
const mockAllowSleep = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: { keepAwake: mockKeepAwake, allowSleep: mockAllowSleep },
}));

// Mock solid-js onCleanup
vi.mock('solid-js', () => ({ onCleanup: vi.fn() }));

describe('useWakeLock (native)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

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

### Task 9: Upgrade shareScoreCard with Capacitor Share plugin

**Files:**
- Modify: `src/shared/utils/shareScoreCard.ts`
- Create: `src/shared/utils/__tests__/shareScoreCard.test.ts`

**Step 1: Write the failing test**

```typescript
// src/shared/utils/__tests__/shareScoreCard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

const mockShare = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/share', () => ({
  Share: { share: mockShare },
}));

vi.mock('../renderScoreCard', () => ({
  renderScoreCard: () => ({
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['test'], { type: 'image/png' })),
    toDataURL: () => 'data:image/png;base64,test',
  }),
}));

describe('shareScoreCard (native)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('uses Capacitor Share plugin on native platform', async () => {
    const { shareScoreCard } = await import('../shareScoreCard');
    const result = await shareScoreCard({ id: 'test-123' } as any);
    expect(mockShare).toHaveBeenCalled();
    expect(result).toBe('shared');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/utils/__tests__/shareScoreCard.test.ts`

Expected: FAIL

**Step 3: Write implementation**

Replace `src/shared/utils/shareScoreCard.ts`:

```typescript
import type { Match } from '../../data/types';
import { renderScoreCard } from './renderScoreCard';
import { IS_NATIVE } from '../platform/platform';
import { Share } from '@capacitor/share';

export async function shareScoreCard(match: Match): Promise<'shared' | 'copied' | 'downloaded' | 'failed'> {
  const canvas = renderScoreCard(match);

  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
    });

    const file = new File([blob], `picklescore-${match.id.slice(0, 8)}.png`, { type: 'image/png' });

    // Native: use Capacitor Share with data URI
    if (IS_NATIVE) {
      const dataUrl = canvas.toDataURL('image/png');
      await Share.share({
        title: 'PickleScore Result',
        text: 'Check out my pickleball score!',
        url: dataUrl,
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

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/utils/__tests__/shareScoreCard.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/utils/shareScoreCard.ts src/shared/utils/__tests__/shareScoreCard.test.ts
git commit -m "feat: upgrade shareScoreCard with Capacitor Share plugin"
```

---

### Task 10: Add Android back button + app lifecycle handling

**Files:**
- Create: `src/shared/platform/appLifecycle.ts`
- Create: `src/shared/platform/__tests__/appLifecycle.test.ts`
- Modify: `src/app/App.tsx` (add onMount call)

**Step 1: Write the failing test**

```typescript
// src/shared/platform/__tests__/appLifecycle.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));

const listeners: Record<string, Function> = {};
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((event: string, cb: Function) => { listeners[event] = cb; }),
    removeAllListeners: vi.fn(),
    exitApp: vi.fn(),
  },
}));

describe('appLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

let _initialized = false;

export function initAppLifecycle(): void {
  if (!IS_NATIVE || _initialized) return;
  _initialized = true;

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  App.addListener('appStateChange', ({ isActive }) => {
    // Dispatch custom event so hooks can react without importing this module
    window.dispatchEvent(new CustomEvent('app-state-change', { detail: { isActive } }));
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/platform/__tests__/appLifecycle.test.ts`

Expected: PASS

**Step 5: Wire into App.tsx**

In `src/app/App.tsx`, add import and call in `onMount`:

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

**Step 1: Add splash screen hide**

In `src/app/App.tsx`, add import:

```typescript
import { SplashScreen } from '@capacitor/splash-screen';
import { IS_NATIVE } from '../shared/platform/platform';
```

Inside the existing `onMount`, add after `initAppLifecycle()`:

```typescript
if (IS_NATIVE) {
  SplashScreen.hide().catch(() => {});
}
```

**Step 2: Run all tests**

Run: `npx vitest run`

Expected: All passing (SplashScreen import resolves to web stub)

**Step 3: Commit**

```bash
git add src/app/App.tsx
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
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: true, PLATFORM: 'android' }));
vi.mock('../swUpdateStore', () => ({ swUpdateVisible: () => false }));

describe('installPromptStore (native)', () => {
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

**Step 1: Write the failing test**

```typescript
// src/shared/components/__tests__/AppInstallCTA.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';

vi.mock('../../platform/platform', () => ({ IS_NATIVE: false, PLATFORM: 'web' }));
vi.mock('../../pwa/installPromptStore', () => ({
  isInstalled: () => false,
  iosInstallSupported: () => false,
  showInstallBanner: () => false,
  triggerInstallPrompt: vi.fn(),
}));

describe('AppInstallCTA', () => {
  it('renders Play Store badge for Android mobile web', async () => {
    // Mock Android UA
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36',
      configurable: true,
    });

    const { AppInstallCTA } = await import('../AppInstallCTA');
    const { queryByText } = render(() => <AppInstallCTA />);
    expect(queryByText('Get it on Google Play')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/components/__tests__/AppInstallCTA.test.tsx`

Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/shared/components/AppInstallCTA.tsx
import { Show, type Component } from 'solid-js';
import { IS_NATIVE } from '../platform/platform';
import { isInstalled } from '../pwa/installPromptStore';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=co.picklescore.app&utm_source=picklescore_web&utm_medium=landing_page&utm_campaign=install_cta';

const isAndroid = () => /Android/i.test(navigator.userAgent);
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAlreadyInstalled = () =>
  (navigator as any).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

export const AppInstallCTA: Component = () => {
  // Hide when: running native, already installed as PWA
  if (IS_NATIVE || isAlreadyInstalled()) return null;
  if (isInstalled()) return null;

  return (
    <>
      <Show when={isAndroid()}>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-5 py-3 bg-primary text-surface font-semibold rounded-xl active:scale-95 transition-transform"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302-2.593-2.302 2.593-2.302zM5.864 2.658L16.8 9.001l-2.302 2.302L5.864 2.658z"/></svg>
          Get it on Google Play
        </a>
      </Show>
      <Show when={isIOS()}>
        <button
          class="inline-flex items-center gap-2 px-5 py-3 bg-primary text-surface font-semibold rounded-xl active:scale-95 transition-transform"
          onClick={() => {
            // Trigger existing iOS install sheet
            window.dispatchEvent(new CustomEvent('show-ios-install'));
          }}
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7-7 7 7"/></svg>
          Install PickleScore
        </button>
      </Show>
    </>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/components/__tests__/AppInstallCTA.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/components/AppInstallCTA.tsx src/shared/components/__tests__/AppInstallCTA.test.tsx
git commit -m "feat: add platform-detected install CTA component"
```

---

### Task 14: Add "Share PickleScore" to settings page

**Files:**
- Modify: `src/features/settings/SettingsPage.tsx` (add share button)

**Step 1: Read the current SettingsPage**

Read `src/features/settings/SettingsPage.tsx` to understand the structure before modifying.

**Step 2: Add Share PickleScore button**

Add a new section near the bottom of the settings page (before any "About" or version section):

```tsx
import { Share } from '@capacitor/share';
import { IS_NATIVE } from '../../shared/platform/platform';
```

Add a share handler:

```tsx
const handleShareApp = async () => {
  const shareData = {
    title: 'PickleScore',
    text: 'Score your pickleball games with PickleScore!',
    url: 'https://picklescore.co',
  };

  if (IS_NATIVE) {
    await Share.share(shareData).catch(() => {});
    return;
  }

  if (navigator.share) {
    await navigator.share(shareData).catch(() => {});
    return;
  }

  // Fallback: copy to clipboard
  await navigator.clipboard.writeText('Score your pickleball games with PickleScore! https://picklescore.co');
  // Show toast feedback (use existing toast mechanism)
};
```

Add a button in the settings UI:

```tsx
<button
  onClick={handleShareApp}
  class="w-full flex items-center gap-3 p-3 bg-surface-light rounded-xl active:scale-[0.98] transition-transform"
>
  <Share2 size={20} class="text-primary" />
  <span class="font-medium text-on-surface">Share PickleScore</span>
</button>
```

**Step 3: Run all tests**

Run: `npx vitest run`

Expected: All passing

**Step 4: Commit**

```bash
git add src/features/settings/SettingsPage.tsx
git commit -m "feat: add Share PickleScore button to settings page"
```

---

### Task 15: Add printable QR code sheet

**Files:**
- Create: `src/shared/utils/generateQRSheet.ts`
- Create: `src/shared/utils/__tests__/generateQRSheet.test.ts`

**Step 1: Write the failing test**

```typescript
// src/shared/utils/__tests__/generateQRSheet.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,test') },
}));

describe('generateQRSheet', () => {
  it('generates a QR data URL for the given URL', async () => {
    const { generateQRDataUrl } = await import('../generateQRSheet');
    const result = await generateQRDataUrl('https://picklescore.co');
    expect(result).toContain('data:image/png');
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

  // Create a canvas with both QR codes side by side
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

  // Load and draw QR images
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
        uses: FirebaseExtended/action-hosting-deploy@v0
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

      - name: Write version to gradle.properties
        run: |
          echo "APP_VERSION_NAME=${{ steps.version.outputs.version }}" > android/app/gradle.properties
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
        uses: r0adkll/upload-google-play@v1
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
- Modify: `src/app/router.tsx` (add route)

**Step 1: Create privacy policy component**

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
          <p>Your data is retained as long as your account exists. You can delete your account and all associated data at any time from Settings → Delete Account. This permanently removes your profile, match history, statistics, and leaderboard entries.</p>
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

**Step 2: Add route**

In `src/app/router.tsx`, add:

```typescript
const PrivacyPolicy = lazy(() => import('../features/legal/PrivacyPolicy'));
```

Add route before the catch-all:

```tsx
<Route path="/privacy" component={PrivacyPolicy} />
```

**Step 3: Commit**

```bash
git add src/features/legal/PrivacyPolicy.tsx src/app/router.tsx
git commit -m "feat: add privacy policy page at /privacy"
```

---

### Task 19: Add account deletion flow

**Files:**
- Create: `src/features/settings/DeleteAccountButton.tsx`
- Create: `src/features/settings/__tests__/DeleteAccountButton.test.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`

**Step 1: Write the failing test**

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

    // Initially no confirmation
    expect(queryByText('This cannot be undone')).toBeNull();

    // Click delete
    fireEvent.click(getByText('Delete Account'));

    // Confirmation appears
    expect(queryByText('This cannot be undone')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/settings/__tests__/DeleteAccountButton.test.tsx`

Expected: FAIL

**Step 3: Write implementation**

```tsx
// src/features/settings/DeleteAccountButton.tsx
import { createSignal, Show, type Component } from 'solid-js';
import { auth, firestore } from '../../data/firebase/config';
import { deleteUser } from 'firebase/auth';
import { deleteDoc, doc, collection, getDocs, writeBatch } from 'firebase/firestore';

export const DeleteAccountButton: Component = () => {
  const [confirming, setConfirming] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setDeleting(true);
    try {
      // Delete user's Firestore data
      const uid = user.uid;
      const batch = writeBatch(firestore);

      // Delete user document
      batch.delete(doc(firestore, 'users', uid));

      // Delete user's public tier doc
      batch.delete(doc(firestore, 'users', uid, 'public', 'tier'));

      // Delete leaderboard entry
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
      await deleteUser(user);

      // Redirect to landing page
      window.location.href = '/';
    } catch (err) {
      console.error('Account deletion failed:', err);
      setDeleting(false);
      setConfirming(false);
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
          <div class="flex gap-3">
            <button
              onClick={() => setConfirming(false)}
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

Import and add `<DeleteAccountButton />` at the bottom of the settings page (only shown when authenticated).

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

**Step 2: Generate Android assets**

```bash
npx @capacitor/assets generate --android
```

This uses the existing `public/pwa-512x512.png` as the source and generates all required Android icon densities and splash screen assets.

**Step 3: Verify adaptive icon safe zone**

Open `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` and visually confirm the logo has sufficient padding (not clipped at edges).

**Step 4: Sync**

```bash
npx cap sync android
```

**Step 5: Commit**

```bash
git add android/ package.json package-lock.json
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

**Step 2: Create default gradle.properties**

Create `android/app/gradle.properties`:

```properties
APP_VERSION_NAME=0.0.0
APP_VERSION_CODE=1
```

**Step 3: Commit**

```bash
git add android/app/build.gradle android/app/gradle.properties
git commit -m "chore: configure gradle.properties versioning for CI"
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

**Step 3: Verify Android project**

```bash
cd android && ./gradlew assembleDebug && cd ..
```

Expected: BUILD SUCCESSFUL

**Step 4: Run all tests**

```bash
npx vitest run
```

Expected: All passing

**Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "chore: verify Android build completes successfully"
```

---

## Manual Steps (Not Automated)

These steps require manual action in external services and cannot be scripted:

### M1: Register domains
- Buy `picklescore.co` and `picklescoreapp.com` at Cloudflare Registrar
- Buy `picklescoring.app` at Porkbun/Namecheap, point NS to Cloudflare

### M2: Configure Cloudflare DNS
- Add `picklescore.co` CNAME to Firebase (grey cloud / DNS-only)
- Add `www.picklescore.co` CNAME
- Add Redirect Rules for the other two domains
- Add cache bypass rule for `/.well-known/*`

### M3: Configure Firebase Hosting custom domain
- Firebase Console → Hosting → Add `picklescore.co`
- Add TXT verification → wait for SSL provisioning
- Repeat for `www.picklescore.co`

### M4: Update Firebase Auth
- Firebase Console → Auth → Settings → add `picklescore.co` to authorized domains
- Google Cloud Console → OAuth → add origins and redirect URIs

### M5: Enroll in Apple Developer Program ($99/yr)
- For future iOS app if needed

### M6: Configure Play Store listing
- Play Console → Create app → fill Data Safety form
- Add privacy policy URL: `https://picklescore.co/privacy`
- Add account deletion URL: `https://picklescore.co/settings`
- Upload screenshots, feature graphic, app icon
- Set content rating (IARC questionnaire)
- Set target audience: 13+

### M7: Configure GitHub Secrets
- `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `FIREBASE_SERVICE_ACCOUNT`

### M8: Update assetlinks.json
- After enrolling in Play App Signing, get Google's signing cert SHA-256
- Replace placeholder in `public/.well-known/assetlinks.json`

---

## Summary

| Wave | Tasks | Focus |
|------|-------|-------|
| A (Foundation) | 1-5 | firebase.json security, assetlinks, OG tags, Capacitor init, plugins |
| B (Platform) | 6-11 | Platform abstraction, hook upgrades, back button, splash screen |
| C (Install Flow) | 12-15 | Smart install prompts, CTA component, share app, QR sheet |
| D (CI/CD) | 16-17 | Web deploy + Android release workflows |
| E (Store Prep) | 18-21 | Privacy policy, account deletion, icons, versioning |
| Integration | 22 | Full Android build verification |
| Manual | M1-M8 | Domains, DNS, Firebase, Play Store, secrets |

**Total: 22 automated tasks + 8 manual steps**
