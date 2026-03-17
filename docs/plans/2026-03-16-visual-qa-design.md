# Visual QA Playwright Project — Design Document

**Date:** 2026-03-16
**Branch:** `feature/pre-launch-e2e-validation`
**Status:** Approved

## Goal

Pre-launch visual validation of every screen, state, and workflow in PickleScore. Produces a comprehensive catalog of **139 screenshots + 28 video journey recordings** covering all themes, display modes, viewports, and user personas.

---

## Section 1: Config & Infrastructure

### Playwright Config

Two projects — mobile (Pixel 5) and desktop (landing page only):

```typescript
{
  name: 'visual-qa',
  testDir: './e2e/journeys/visual-qa',
  outputDir: './test-results/visual-qa',
  timeout: 60_000,
  retries: 0,
  use: {
    ...devices['Pixel 5'],
    baseURL: 'http://localhost:5199',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-first-retry',
    actionTimeout: 15_000,
  },
},
{
  name: 'visual-qa-desktop',
  testDir: './e2e/journeys/visual-qa',
  testMatch: '**/chrome-visual.spec.ts',
  outputDir: './test-results/visual-qa-desktop',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-first-retry',
    actionTimeout: 15_000,
  },
},
```

Also add `testIgnore: ['**/visual-qa/**']` to the emulator project.

### Theme Helper (`e2e/helpers/visual-qa.ts`)

Uses `addInitScript()` so localStorage is set before SolidJS module initialization. Types duplicated (cannot import from `src/` in e2e context due to SolidJS + `verbatimModuleSyntax`).

```typescript
import type { Page, TestInfo } from '@playwright/test';
import { captureScreen } from './screenshots';

// Duplicated from src/stores/settingsStore.ts — keep in sync
type Theme = 'court-vision-gold' | 'classic' | 'ember';
type DisplayMode = 'dark' | 'outdoor';

const SETTINGS_KEY = 'pickle-score-settings';

export async function setTheme(page: Page, theme: Theme, displayMode: DisplayMode) {
  await page.addInitScript(([key, t, m]) => {
    const raw = localStorage.getItem(key);
    const settings = raw ? JSON.parse(raw) : {};
    settings.theme = t;
    settings.displayMode = m;
    localStorage.setItem(key, JSON.stringify(settings));
  }, [SETTINGS_KEY, theme, displayMode]);
}

export const VIEWPORTS = {
  portrait393: { width: 393, height: 851 },
  portrait375: { width: 375, height: 667 },
  landscape:   { width: 851, height: 393 },
} as const;

export async function captureAtViewports(
  page: Page, testInfo: TestInfo, baseName: string,
  viewports: Array<keyof typeof VIEWPORTS>,
) {
  for (const vp of viewports) {
    await page.setViewportSize(VIEWPORTS[vp]);
    await captureScreen(page, testInfo, `${baseName}-${vp}`);
  }
  await page.setViewportSize(VIEWPORTS.portrait393);
}

export function screenshotName(
  category: string, screen: string, state: string,
  viewport: string, theme: string, mode: string,
) {
  return `${category}/${screen}-${state}-${viewport}-${theme}-${mode}`;
}
```

### Screenshot Naming Convention

Pattern: `{category}/{screen}-{state}-{viewport}-{theme}-{mode}`

Examples:
- `scoring/scoreboard-midgame-393-gold-dark`
- `tournament/hub-registration-393-gold-outdoor`
- `themes/scoreboard-midgame-393-classic-dark`

The `/` creates subfolder labels in the HTML report (attach mode). On disk, artifacts land flat in `test-results/visual-qa/`. When migrating to compare mode post-launch, `/` creates real subdirectories.

### Test File Structure

```
e2e/journeys/visual-qa/
├── scoring-visual.spec.ts
├── tournament-visual.spec.ts
├── social-visual.spec.ts
├── chrome-visual.spec.ts
├── theme-variations.spec.ts
├── accessibility-visual.spec.ts
└── journeys-video.spec.ts
```

### Test Pattern

Each screenshot test: set theme via `addInitScript` → seed data → `page.goto()` → capture at viewports.
Each video journey: seed starting state → drive UI through clicks → Playwright records video automatically.

Separate tests per display mode (since `addInitScript` persists for page lifetime):

```typescript
for (const [theme, mode] of [['court-vision-gold', 'dark'], ['court-vision-gold', 'outdoor']] as const) {
  test(`scoreboard midgame — ${theme} ${mode}`, async ({ authenticatedPage, testInfo }) => {
    const page = authenticatedPage;
    await setTheme(page, theme, mode);
    // seed + navigate + capture
  });
}
```

### Run Commands

```bash
npx playwright test --project=visual-qa                              # mobile screenshots + videos
npx playwright test --project=visual-qa-desktop                      # desktop landing page
npx playwright test --project=visual-qa --project=visual-qa-desktop  # both
```

---

## Section 2: Capture Matrix

### scoring-visual.spec.ts (~34 captures)

| # | Screen | State | Viewports | Themes |
|---|--------|-------|-----------|--------|
| 1 | Scoreboard | Midgame, sideout doubles, team 1 serving | 393, 375, landscape | gold-dark, gold-outdoor |
| 2 | Scoreboard | Midgame, sideout doubles, team 2 serving | 393 | gold-dark, gold-outdoor |
| 3 | Scoreboard | Rally scoring (both buttons active, no side-out) | 393 | gold-dark |
| 4 | Scoreboard | Singles mode (no server number badge) | 393 | gold-dark |
| 5 | Scoreboard | Game point (pulsing label) | 393 | gold-dark, gold-outdoor |
| 6 | Scoreboard | Deuce | 393 | gold-dark |
| 7 | Scoreboard | Score call display (sideout doubles) | 393 | gold-dark |
| 8 | Scoreboard | Scorer team indicator ("You're on Team X") | 393 | gold-dark |
| 9 | Scoreboard | Multi-game series badge ("Games: 1-0") | 393 | gold-dark |
| 10 | Between-games | Game complete overlay | 393, landscape | gold-dark, gold-outdoor |
| 11 | Match-over | Winner announcement + share score card | 393, landscape | gold-dark, gold-outdoor |
| 12 | Scoring | Loading state | 393 | gold-dark |
| 13 | Scoring | Error state (match not found) | 393 | gold-dark |
| 14 | Game setup | Full form | 393, 375 | gold-dark, gold-outdoor |
| 15 | Game setup | Role expanded + buddy picker | 393 | gold-dark |
| 16 | Match history | With matches | 393 | gold-dark, gold-outdoor |
| 17 | Match history | Empty state | 393 | gold-dark |

### tournament-visual.spec.ts (~26 captures)

| # | Screen | State | Viewports | Themes |
|---|--------|-------|-----------|--------|
| 1 | Tournament create | Full form | 393, 375 | gold-dark |
| 2 | Tournament hub | Setup phase (organizer) | 393 | gold-dark |
| 3 | Tournament hub | Registration phase | 393 | gold-dark, gold-outdoor |
| 4 | Tournament hub | Pool-play phase | 393 | gold-dark, gold-outdoor |
| 5 | Tournament hub | Bracket phase | 393 | gold-dark, gold-outdoor |
| 6 | Tournament hub | Completed + results | 393 | gold-dark, gold-outdoor |
| 7 | Pool table | With standings | 393, 375 | gold-dark |
| 8 | Bracket view | In progress | 393, 375 | gold-dark |
| 9 | Bracket view | Completed (winner) | 393 | gold-dark |
| 10 | Discover | Browse tab | 393 | gold-dark, gold-outdoor |
| 11 | Discover | My tournaments tab | 393 | gold-dark |
| 12 | Discover | Empty state | 393 | gold-dark |
| 13 | ScoreEditModal | Edit match result | 393 | gold-dark |
| 14 | SaveTemplateModal | Save template form | 393 | gold-dark |
| 15 | ShareTournamentModal | Share link | 393 | gold-dark |

### social-visual.spec.ts (~24 captures)

| # | Screen | State | Viewports | Themes |
|---|--------|-------|-----------|--------|
| 1 | Buddies list | With groups | 393 | gold-dark, gold-outdoor |
| 2 | Buddies list | Empty state | 393 | gold-dark |
| 3 | Group detail | With sessions + members | 393 | gold-dark, gold-outdoor |
| 4 | Group detail | No sessions (empty) | 393 | gold-dark |
| 5 | Create group | Form | 393 | gold-dark |
| 6 | Group invite | Public join page | 393 | gold-dark |
| 7 | Session detail | RSVP buttons + spots tracker | 393 | gold-dark, gold-outdoor |
| 8 | Create session | Form | 393 | gold-dark |
| 9 | Public session | Share link page | 393 | gold-dark |
| 10 | Open play | Browse sessions | 393 | gold-dark, gold-outdoor |
| 11 | Open play | Empty state | 393 | gold-dark |
| 12 | BuddyActionSheet | Select buddies | 393 | gold-dark |
| 13 | ShareSheet (buddy) | Share group/session | 393 | gold-dark |
| 14 | Profile | Stats + achievements | 393 | gold-dark, gold-outdoor |
| 15 | Profile | Empty achievements | 393 | gold-dark |
| 16 | Players | Players tab | 393 | gold-dark, gold-outdoor |
| 17 | Players | Leaderboard tab | 393 | gold-dark |
| 18 | Players | Empty state | 393 | gold-dark |
| 19 | Leaderboard | Empty state | 393 | gold-dark |

### chrome-visual.spec.ts (~24 captures)

| # | Screen | State | Viewports | Themes |
|---|--------|-------|-----------|--------|
| 1 | Landing page | Hero section | 393, desktop* | gold-dark |
| 2 | Landing page | Features section | 393 | gold-dark |
| 3 | Settings | All sections | 393 | gold-dark, gold-outdoor |
| 4 | Bottom nav | Active states | 393 | gold-dark |
| 5 | ConfirmDialog | Leave game | 393 | gold-dark |
| 6 | NotificationPanel | With notifications | 393 | gold-dark |
| 7 | NotificationPanel | Empty | 393 | gold-dark |
| 8 | IOSInstallSheet | Install prompt | 393 | gold-dark |
| 9 | InstallPromptBanner | First-run banner | 393 | gold-dark |
| 10 | AchievementToast | Achievement unlocked | 393 | gold-dark |
| 11 | 404 page | Not found | 393 | gold-dark |
| 12 | Public tournament | Spectator hub (live-now section) | 393 | gold-dark, gold-outdoor |
| 13 | Public tournament | Completed results | 393 | gold-dark |
| 14 | Public match | Live scoreboard | 393 | gold-dark, gold-outdoor |
| 15 | Public match | Play-by-play tab | 393 | gold-dark |
| 16 | Public match | Stats tab | 393 | gold-dark |
| 17 | Public match | Loading skeleton | 393 | gold-dark |

*Desktop captures run via `visual-qa-desktop` project

### theme-variations.spec.ts (~20 captures)

Key screens re-captured in Classic and Ember (dark mode only):

| # | Screen | Classic | Ember |
|---|--------|---------|-------|
| 1 | Scoreboard midgame (team colors, ambient bg) | yes | yes |
| 2 | Between-games overlay | yes | yes |
| 3 | Match-over | yes | yes |
| 4 | Game setup | yes | yes |
| 5 | Tournament hub (pool-play) | yes | yes |
| 6 | Settings page (theme swatches) | yes | yes |
| 7 | Profile | yes | yes |
| 8 | Landing page hero | yes | yes |
| 9 | Leaderboard/podium | yes | yes |
| 10 | Public tournament (spectator) | yes | yes |

### accessibility-visual.spec.ts (~11 captures)

| # | Screen | State | Theme |
|---|--------|-------|-------|
| 1 | Scoreboard | Focus ring on score button | gold-dark |
| 2 | Scoreboard | Focus ring on score button | classic-dark |
| 3 | Scoreboard | Focus ring on score button | ember-dark |
| 4 | Game setup | Focus ring on start button | gold-dark |
| 5 | Tournament hub | Focus ring on tab | gold-dark |
| 6 | Bottom nav | Focus ring on nav item | gold-dark |
| 7 | Scoreboard | Similar team colors (close hues) | gold-dark |
| 8 | Settings | Focus ring on toggle | gold-dark |
| 9 | Modal | Focus ring on confirm button | gold-dark |
| 10 | Landing page | Focus ring on CTA | gold-dark |
| 11 | Session RSVP | Focus ring on RSVP button | gold-dark |

### journeys-video.spec.ts (~28 video recordings)

Uses `test.use({ video: 'on' })` per-file override.

**Casual Scoring (8 videos)**

| # | Journey | Key Steps | ~Duration |
|---|---------|-----------|-----------|
| 1 | Quick rally game (full) | Setup → quick game → score points → game point → match-over → save → verify in history | 20s |
| 2 | Sideout doubles game | Setup doubles sideout → sideout → server rotation → score call → match-over | 25s |
| 3 | Singles game | Setup singles → scoring (no server number) → match-over | 15s |
| 4 | Best-of-3 multi-game | Game 1 → between-games → game 2 → between-games → game 3 → match-over | 30s |
| 5 | Win-by-2 / deuce | Rally 11pt → tie at 10-10 → game point appears/disappears → win at 12-10 | 20s |
| 6 | Undo + navigation guards | Score 5 points → undo twice → try to leave → cancel dialog → leave → return | 15s |
| 7 | Custom names, colors + share score card | Setup with custom teams/colors → play → match-over → share score card | 20s |
| 8 | Landscape scoring | Start portrait → rotate landscape → score in side-by-side layout → between-games → match-over | 15s |

**Auth & Onboarding (2 videos)**

| # | Journey | Key Steps | ~Duration |
|---|---------|-----------|-----------|
| 9 | First-time user onboarding | Landing page → sign in → empty states tour → start first game | 20s |
| 10 | Sign out + user switch | Sign out → verify cleared → sign in as different user → verify isolation | 15s |

**Settings & Preferences (2 videos)**

| # | Journey | Key Steps | ~Duration |
|---|---------|-----------|-----------|
| 11 | Theme + display mode tour | Settings → switch each theme → switch outdoor → navigate to scoreboard → verify | 20s |
| 12 | Settings defaults → game setup | Change defaults → game setup → verify pre-selected → quick game uses them | 15s |

**Tournament Organizer (4 videos)**

| # | Journey | Key Steps | ~Duration |
|---|---------|-----------|-----------|
| 13 | Create tournament + registration | Create form → set format → create → add players → view registration count | 25s |
| 14 | Approval queue + staff management | Approve/reject registrations → add scorekeeper → assign roles | 20s |
| 15 | Full tournament lifecycle | Advance to pools → score matches → standings → advance bracket → score bracket → complete | 35s |
| 16 | Score edit + dispute resolution | Edit completed match → flag dispute → review → resolve → activity log | 20s |

**Tournament Participant (2 videos)**

| # | Journey | Key Steps | ~Duration |
|---|---------|-----------|-----------|
| 17 | Discover + register | Browse tournaments → view details → register → view "My Tournaments" | 15s |
| 18 | Approval-mode registration | View tournament → "Ask to Join" → submit request → pending status | 10s |

**Spectator (2 videos)**

| # | Journey | Key Steps | ~Duration |
|---|---------|-----------|-----------|
| 19 | Live tournament spectating | Public tournament → live-now → tap match → live scoreboard → play-by-play | 20s |
| 20 | Completed tournament viewing | Public link → completed results → bracket with winner → match detail | 15s |

**Buddies & Sessions (3 videos)**

| # | Journey | Key Steps | ~Duration |
|---|---------|-----------|-----------|
| 21 | Create group + invite flow | Create group → share invite → friend opens /g/:code → joins | 20s |
| 22 | Session lifecycle | Create session → RSVP in/maybe/out → spots tracker → session fills → share → public view | 20s |
| 23 | Open play browse + join | Browse sessions → view details → RSVP | 10s |

**Profile & Stats (1 video)**

| # | Journey | Key Steps | ~Duration |
|---|---------|-----------|-----------|
| 24 | Profile + achievements + leaderboard | View profile → tier badge → recent matches → achievements → leaderboard | 15s |

**Cross-Cutting (3 videos)**

| # | Journey | Key Steps | ~Duration |
|---|---------|-----------|-----------|
| 25 | Offline scoring + sync | Go offline → score full game → save → go online → verify sync | 20s |
| 26 | Local-to-cloud sync on first sign-in | Play match unsigned → sign in → watch matches push to cloud | 15s |
| 27 | Notification panel flow | View bell badge → open panel → read → mark all read → navigate from notification | 10s |

**PWA (1 video)**

| # | Journey | Key Steps | ~Duration |
|---|---------|-----------|-----------|
| 28 | PWA install + update toast | Install prompt → install → SW update toast → update now → reload | 10s |

---

## Section 3: Test Helpers & Data Seeding

### New Helpers (`e2e/helpers/visual-qa.ts`)

- `setTheme(page, theme, displayMode)` — addInitScript-based localStorage injection
- `captureAtViewports(page, testInfo, baseName, viewports)` — multi-viewport capture + reset
- `screenshotName(category, screen, state, viewport, theme, mode)` — consistent naming
- `mockPwaInstallPrompt(page)` — mock `beforeinstallprompt` via addInitScript
- `mockPwaUpdateAvailable(page)` — mock service worker update state

### New Factories (`e2e/helpers/factories.ts`)

- `makeRsvp(overrides)` — RSVP doc (status: in/out/maybe)
- `makeNotification(overrides)` — notification doc (type, title, body, read, createdAt)
- `makeAchievement(overrides)` — achievement doc (achievementId, unlockedAt, triggerMatchId)

### New Firestore Paths (`e2e/helpers/firestore-paths.ts`)

- `notifications(userId)` → `users/{userId}/notifications`
- `achievements(userId)` → `users/{userId}/achievements`
- `stats(userId)` → `users/{userId}/stats`
- `matchRefs(userId)` → `users/{userId}/matchRefs`

### New Composite Seeders (`e2e/helpers/seeders.ts`)

- `seedBetweenGamesMatch` — best-of-3 match, game 1 complete, game 2 pending
- `seedCompletedMatch` — match with `status: 'completed'` + projection
- `seedCompletedTournament` — tournament with resolved bracket, final standings, winner
- `seedSessionWithRsvps` — game session with N RSVP docs in mixed states
- `seedProfileWithHistory` — profile + stats + match refs + achievements
- `seedNotifications` — batch-seed N notification docs

### Seeding Strategy

- **Screenshot tests** seed exact Firestore state, navigate, capture. No UI interaction.
- **Video journey tests** seed starting state only, then drive UI through real clicks/interactions.

---

## Section 4: Summary

### Deliverables

| Metric | Value |
|--------|-------|
| Screenshots | 139 |
| Video recordings | 28 |
| Test files | 7 |
| Playwright projects | 2 (mobile + desktop) |
| New seeders | 6 |
| New factories | 3 |
| New helpers | 5 |

### Coverage

- **3 themes** × **2 display modes** (gold dark+outdoor for all, Classic+Ember for key screens)
- **4 viewports** (393px, 375px, landscape, desktop)
- **7 personas** (casual scorer, organizer, participant, spectator, buddy, staff, cross-cutting)
- **28 end-to-end workflow videos**

### Estimated Run Profile

- ~11-16 minutes with workers=4
- ~170-310 MB disk per run
- Traces + auto-screenshots only on failures

### Post-Launch Migration

Migrate ~15 critical screens from `attach` to `compare` mode (`toHaveScreenshot`) with baselines committed to git once UI stabilizes.

### Design Decisions Log

| Decision | Rationale |
|----------|-----------|
| `addInitScript` over `evaluate` for theme | SolidJS signal reads localStorage at module init, not reactively |
| Separate `visual-qa-desktop` project | Can't change `deviceScaleFactor` mid-test; Pixel 5 DPR=2.625 wrong for desktop |
| `screenshot: 'only-on-failure'` | Manual `captureScreen` already captures everything; auto-screenshots duplicate |
| `trace: 'retain-on-failure'` | Full traces cost 250-900 MB/run; only needed for debugging failures |
| `video: 'on'` only in journeys-video | Screenshot tests produce 2-3s static clips; not useful. Journey videos show real flows |
| Duplicated `Theme` type in e2e | Can't import from `src/` in e2e context (SolidJS + verbatimModuleSyntax) |
| `testIgnore: ['**/visual-qa/**']` on emulator | Prevents emulator project from running visual-qa tests |
| Screenshots seed state, videos drive UI | Screenshots need deterministic state; videos need authentic interaction recordings |
