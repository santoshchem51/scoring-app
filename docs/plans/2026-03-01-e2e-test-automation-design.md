# PickleScore E2E Test Automation Design

> **Date**: 2026-03-01
> **Status**: Approved
> **Goal**: Automate the full manual test plan (~120 test cases) with a scalable, redesign-resilient Playwright + Page Object Model architecture.

---

## Approach

**Incremental POM with lazy migration**: Build POM architecture upfront, write all new tests using it, migrate existing 11 spec files only when touching that feature area.

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Test runner** | Playwright (existing) | Already configured with Pixel 5 emulation, Firebase emulator support |
| **Page Object Model** | Yes, 6 POMs to start | Redesign resilience — selectors change in one place |
| **Selector strategy** | `getByRole` primary | Matches existing codebase (zero `data-testid` in app). Accessibility-first. |
| **Backend** | Firebase emulators (primary) + staging smoke (secondary) | Fast, deterministic emulator tests; 8-10 smoke tests against staging |
| **Test isolation** | Per-test unique IDs + global setup wipe | Prevents parallel worker collisions. No `clearEmulators()` in `beforeAll`. |
| **Device APIs** | Mock where feasible, mark manual-only otherwise | Wake lock, speech synthesis mockable. Haptics, PWA install manual-only. |

---

## Directory Structure

```
e2e/
├── fixtures.ts                     # test.extend() — authenticatedPage, testUserEmail
├── global-setup.ts                 # One-time clearEmulators() before entire suite
│
├── helpers/
│   ├── emulator-auth.ts            # EXISTING (fix waitForTimeout → deterministic wait)
│   ├── factories.ts                # makeTournament(), makeBuddyGroup(), etc.
│   └── device-mocks.ts             # Mock navigator APIs (vibration, wakeLock, speech)
│
├── pages/                          # Page Objects (6 to start, add as 3+ tests share selectors)
│   ├── GameSetupPage.ts            # New game, game modes, quick game
│   ├── ScoringPage.ts              # Live scoring, undo, side out, match over
│   ├── NavigationBar.ts            # Bottom nav + top nav (shared)
│   ├── PlayersPage.ts              # Player CRUD
│   ├── TournamentBrowsePage.ts     # Browse, search, filter
│   └── BuddiesPage.ts             # Groups list, create, sessions
│
├── scoring/
│   ├── match-setup.spec.ts         # Manual plan 1.1
│   ├── live-scoring.spec.ts        # Manual plan 1.2
│   ├── device-features.spec.ts     # Manual plan 1.3
│   └── match-completion.spec.ts    # Manual plan 1.4
│
├── history/
│   └── match-history.spec.ts       # Manual plan 2.1
│
├── players/
│   └── player-management.spec.ts   # Manual plan 3.1
│
├── tournaments/
│   ├── creation.spec.ts            # Manual plan 4.1
│   ├── registration.spec.ts        # Manual plan 4.2-4.6
│   ├── discovery.spec.ts           # Manual plan 4.7
│   ├── dashboard.spec.ts           # Manual plan 4.8
│   ├── pool-play.spec.ts           # Manual plan 4.9
│   └── bracket.spec.ts             # Manual plan 4.10
│
├── buddies/
│   ├── auth-guards.spec.ts         # Existing
│   ├── group-management.spec.ts    # Manual plan 5.1
│   ├── sessions.spec.ts            # Manual plan 5.2
│   └── notifications.spec.ts       # Manual plan 5.3
│
├── auth/
│   ├── sign-in.spec.ts             # Manual plan 6.1
│   ├── cloud-sync.spec.ts          # Manual plan 6.2
│   └── offline.spec.ts             # Manual plan 6.3
│
├── pwa/
│   └── display-modes.spec.ts       # Manual plan 8.3
│
├── integration/
│   ├── tournament-scoring-stats.spec.ts   # Manual plan 9.1
│   ├── buddy-session-scoring.spec.ts      # Manual plan 9.2
│   └── auth-data-continuity.spec.ts       # Manual plan 9.3
│
├── edge-cases/
│   ├── empty-states.spec.ts        # Manual plan 10.2
│   ├── form-validation.spec.ts     # Manual plan 10.3
│   └── rapid-tapping.spec.ts       # Manual plan 10.4
│
└── smoke/
    └── staging-smoke.spec.ts       # 8-10 tests against staging
```

---

## Page Object Model Design

### Principles

1. **No `BasePage`** — Playwright's `page` is the base page. Wrapping `goto()` and `screenshot()` adds zero value.
2. **Composition, not inheritance** — Page objects take `Page` in constructor.
3. **User-intent naming** — Methods named `scorePoint()`, `createGroup()`, not `clickScoreButton()`, `fillNameInput()`.
4. **`getByRole` primary** — Matches existing codebase convention (zero `data-testid` attributes in app).
5. **Getters for locators** — Lazy evaluation, no stale element risk.
6. **Add POM only when 3+ tests share selectors** — No speculative page objects.

### Example: ScoringPage

```typescript
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class ScoringPage {
  constructor(private page: Page) {}

  get team1ScoreBtn() { return this.page.getByRole('button', { name: /Score point for Team 1/ }); }
  get team2ScoreBtn() { return this.page.getByRole('button', { name: /Score point for Team 2/ }); }
  get undoBtn()       { return this.page.getByRole('button', { name: /Undo/i }); }
  get sideOutBtn()    { return this.page.getByRole('button', { name: /Side out/i }); }

  async scorePoint(team: 'Team 1' | 'Team 2') {
    const btn = team === 'Team 1' ? this.team1ScoreBtn : this.team2ScoreBtn;
    await btn.click();
  }

  async undoLastAction() { await this.undoBtn.click(); }
  async triggerSideOut() { await this.sideOutBtn.click(); }

  async expectScore(scoreText: string) {
    await expect(this.page.getByText(scoreText)).toBeVisible();
  }

  async expectMatchOver() {
    await expect(this.page.getByText('Match Over')).toBeVisible();
  }
}
```

---

## Fixtures

### Single `fixtures.ts` with `test.extend()`

```typescript
import { test as base, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/emulator-auth';
import { randomUUID } from 'crypto';

type Fixtures = {
  authenticatedPage: Page;
  testUserEmail: string;
};

export const test = base.extend<Fixtures>({
  testUserEmail: async ({}, use) => {
    await use(`e2e-${randomUUID().slice(0, 8)}@test.com`);
  },
  authenticatedPage: async ({ page, testUserEmail }, use) => {
    await page.goto('/');
    await page.waitForFunction(
      () => (window as any).__TEST_FIREBASE__,
      { timeout: 10000 }
    );
    await signInAsTestUser(page, { email: testUserEmail });
    await page.waitForFunction(
      () => (window as any).__TEST_FIREBASE__.auth.currentUser !== null,
      { timeout: 10000 }
    );
    await use(page);
  },
});

export { expect };
```

---

## Test Data Management

### Factory functions with unique IDs

```typescript
// e2e/helpers/factories.ts
import { randomUUID } from 'crypto';

function uid(prefix: string) { return `${prefix}-${randomUUID().slice(0, 8)}`; }
function shareCode() { return `E2E${randomUUID().slice(0, 5).toUpperCase()}`; }

export function makeTournament(overrides: Record<string, unknown> = {}) {
  const id = uid('tournament');
  return {
    id,
    name: `Tournament ${id.slice(-4)}`,
    shareCode: shareCode(),
    format: 'round-robin',
    status: 'registration',
    location: 'Test Court',
    pointsToWin: 11,
    organizerId: 'test-organizer',
    createdAt: new Date().toISOString(),
    isListed: true,
    isPublic: true,
    ...overrides,
  };
}

export function makeBuddyGroup(overrides: Record<string, unknown> = {}) {
  const id = uid('group');
  return {
    id,
    name: `Group ${id.slice(-4)}`,
    shareCode: shareCode(),
    visibility: 'private',
    createdBy: 'test-user',
    ...overrides,
  };
}

export function makeGameSession(overrides: Record<string, unknown> = {}) {
  const id = uid('session');
  return {
    id,
    title: `Session ${id.slice(-4)}`,
    shareCode: shareCode(),
    date: new Date().toISOString(),
    location: 'Test Location',
    maxSpots: 8,
    ...overrides,
  };
}
```

### Isolation strategy

- **Global setup**: `clearEmulators()` once before entire suite
- **Per-test**: Each test creates its own data with unique IDs via factories
- **No per-test cleanup**: Unique IDs mean no collisions, no cleanup needed

---

## Playwright Config Changes

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html']],
  globalSetup: require.resolve('./e2e/global-setup'),
  expect: { timeout: 10000 },
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'emulator',
      testIgnore: '**/smoke/**',
      use: {
        ...devices['Pixel 5'],
        baseURL: 'http://localhost:5199',
      },
    },
    {
      name: 'staging-smoke',
      testDir: './e2e/smoke',
      use: {
        ...devices['Pixel 5'],
        baseURL: process.env.STAGING_URL || 'https://picklescore.web.app',
      },
    },
  ],
  webServer: [
    {
      command: 'firebase emulators:start --only auth,firestore',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'npx vite --port 5199',
      url: 'http://localhost:5199',
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
```

---

## Flakiness Fixes (apply during migration)

| Current Pattern | Problem | Fix |
|----------------|---------|-----|
| `waitForLoadState('networkidle')` | Firebase WebSocket never goes idle | Wait for specific content or `__TEST_FIREBASE__` |
| `waitForTimeout(1000)` in emulator-auth | Fixed delay, flaky on slow CI | `waitForFunction(() => auth.currentUser !== null)` |
| `dispatchEvent('click')` in players.spec | Hides z-index bug | Fix app z-index, use real `.click()` |
| Per-assertion `{ timeout: 15000 }` | Masks real issues | Global `expect: { timeout: 10000 }` |

---

## Test Coverage Mapping

| Manual Plan Section | Spec File | Tests | Status |
|---|---|---|---|
| 1.1 Match Setup | `scoring/match-setup.spec.ts` | 5 | Automate |
| 1.2 Live Scoring | `scoring/live-scoring.spec.ts` | 11 | Automate (swipe = mock touch) |
| 1.3 Device Features | `scoring/device-features.spec.ts` | 11 | 4 mockable, 7 manual-only |
| 1.4 Match Completion | `scoring/match-completion.spec.ts` | 5 | Automate |
| 2.1 Match History | `history/match-history.spec.ts` | 5 | Automate |
| 3.1 Players | `players/player-management.spec.ts` | 5 | Automate |
| 4.1 Tournament Creation | `tournaments/creation.spec.ts` | 7 | Automate |
| 4.2-4.6 Registration | `tournaments/registration.spec.ts` | 18 | Automate |
| 4.7 Discovery | `tournaments/discovery.spec.ts` | 5 | Exists (migrate to POM) |
| 4.8 Dashboard | `tournaments/dashboard.spec.ts` | 10 | Automate |
| 4.9 Pool Play | `tournaments/pool-play.spec.ts` | 4 | Automate |
| 4.10 Bracket | `tournaments/bracket.spec.ts` | 4 | Automate |
| 5.1 Groups | `buddies/group-management.spec.ts` | 8 | Automate |
| 5.2 Sessions | `buddies/sessions.spec.ts` | 7 | Automate |
| 5.3 Notifications | `buddies/notifications.spec.ts` | 5 | Automate |
| 6.1 Sign-In | `auth/sign-in.spec.ts` | 5 | Partial (no real OAuth) |
| 6.2 Cloud Sync | `auth/cloud-sync.spec.ts` | 5 | Automate |
| 6.3 Offline | `auth/offline.spec.ts` | 5 | Automate |
| 7.x Firestore Rules | Existing `test/rules/` | N/A | Already covered by rules unit tests |
| 8.1-8.2 PWA/Responsive | N/A | N/A | Manual-only |
| 8.3 Display Modes | `pwa/display-modes.spec.ts` | 3 | Automate |
| 9.1 Tournament->Scoring->Stats | `integration/tournament-scoring-stats.spec.ts` | 3 | Automate |
| 9.2 Buddy->Session->Scoring | `integration/buddy-session-scoring.spec.ts` | 3 | Automate |
| 9.3 Auth->Data Continuity | `integration/auth-data-continuity.spec.ts` | 3 | Automate |
| 10.1 Network Failures | Deferred | N/A | Complex to simulate reliably |
| 10.2 Empty States | `edge-cases/empty-states.spec.ts` | 5 | Automate |
| 10.3 Form Validation | `edge-cases/form-validation.spec.ts` | 5 | Automate |
| 10.4 Concurrent Usage | `edge-cases/rapid-tapping.spec.ts` | 3 | Automate (rapid clicks only) |
| 11. Performance | N/A | N/A | Manual / Lighthouse CI |
| Staging Smoke | `smoke/staging-smoke.spec.ts` | 8 | Automate |

**Total: ~162 tests** (~145 automatable, ~17 manual-only)

---

## Staging Smoke Suite (8-10 tests)

Runs against real staging deployment. No emulator helpers.

| Test | What it validates |
|------|------------------|
| Landing page loads | App bundle deployed correctly |
| Bottom nav renders all tabs | Routing works |
| New Game -> Quick Game -> Score a point | Core scoring engine works |
| Tournament browse page loads | Firestore connection works |
| Search filter works | Client-side logic with real data |
| Sign in with Google (if test account) | Auth integration |
| PWA manifest registers | Service worker deployed |
| Offline scoring works | Service worker caching |

---

## Manual-Only Items (cannot reliably automate)

- Haptic feedback (real hardware)
- PWA "Add to Home Screen" prompt (OS-level)
- iOS Safari home screen behavior
- App icon rendering on home screen
- Sunlight readability of outdoor mode
- Memory leak detection (30+ min sessions)
- Two organizers on different devices simultaneously
- Real Google OAuth popup flow

---

## Migration Strategy

1. **Phase 1: Infrastructure** — Create `fixtures.ts`, `global-setup.ts`, `factories.ts`, update `playwright.config.ts`
2. **Phase 2: Page Objects** — Build the 6 initial POMs
3. **Phase 3: New tests** — Write all gap tests using POMs and fixtures
4. **Phase 4: Migrate existing** — Update old spec files to use POMs/fixtures when touching that feature

Each phase is independently shippable and reversible.

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-01 | Initial design with specialist reviews | Claude + Santosh |
