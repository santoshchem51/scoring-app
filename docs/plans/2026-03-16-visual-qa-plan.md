# Visual QA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a visual-qa Playwright suite producing 139 screenshots + 28 video journey recordings covering every screen, theme, viewport, and workflow in PickleScore.

**Architecture:** Two Playwright projects (mobile Pixel 5 + desktop). Screenshot tests seed Firestore state and capture static screens. Video tests drive real UI interactions. Theme injection via `addInitScript` + localStorage before navigation.

**Tech Stack:** Playwright, SolidJS, Firebase Emulator, TypeScript

**Design Doc:** `docs/plans/2026-03-16-visual-qa-design.md`

---

## Phase 1: Infrastructure

### Task 1: Update playwright.config.ts

**Files:**
- Modify: `playwright.config.ts:19-47`

**Step 1: Update the emulator project to ignore visual-qa tests**

In `playwright.config.ts`, change line 22 from:
```typescript
      testIgnore: '**/smoke/**',
```
to:
```typescript
      testIgnore: ['**/smoke/**', '**/visual-qa/**'],
```

**Step 2: Replace the visual-qa project config**

Replace lines 28-38 with the updated visual-qa project plus the new desktop project:

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

**Step 3: Verify existing tests still work**

Run: `npx playwright test --project=emulator --grep @p0 --workers=1 -- e2e/journeys/casual-scorer/scoring-journeys.spec.ts`
Expected: P0 casual scorer tests pass, no visual-qa tests included.

**Step 4: Commit**

```bash
git add playwright.config.ts
git commit -m "config: update playwright for visual-qa projects"
```

---

### Task 2: Add new Firestore paths

**Files:**
- Modify: `e2e/helpers/firestore-paths.ts:6-19`

**Step 1: Add the 4 new path entries**

Add before the closing `} as const;` on line 19:

```typescript
  notifications: (userId: string) => `users/${userId}/notifications`,
  achievements: (userId: string) => `users/${userId}/achievements`,
  stats: (userId: string) => `users/${userId}/stats`,
  matchRefs: (userId: string) => `users/${userId}/matchRefs`,
```

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 3: Commit**

```bash
git add e2e/helpers/firestore-paths.ts
git commit -m "infra: add notification, achievement, stats, matchRef paths"
```

---

### Task 3: Create visual-qa helpers

**Files:**
- Create: `e2e/helpers/visual-qa.ts`
- Create: `e2e/journeys/visual-qa/` (directory)

**Step 1: Create the visual-qa directory**

```bash
mkdir -p e2e/journeys/visual-qa
```

**Step 2: Write the visual-qa helper file**

Create `e2e/helpers/visual-qa.ts`:

```typescript
import type { Page, TestInfo } from '@playwright/test';
import { captureScreen } from './screenshots';

// Duplicated from src/stores/settingsStore.ts — keep in sync
export type Theme = 'court-vision-gold' | 'classic' | 'ember';
export type DisplayMode = 'dark' | 'outdoor';

const SETTINGS_KEY = 'pickle-score-settings';

/**
 * Injects theme/displayMode into localStorage via addInitScript.
 * Must be called BEFORE page.goto() — runs before any app JS executes.
 * Note: addInitScript persists for the page lifetime, so subsequent
 * navigations will also use this theme. Use separate tests for different themes.
 */
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
  landscape: { width: 851, height: 393 },
} as const;

/**
 * Captures the current page at multiple viewports, resetting to portrait393 after.
 */
export async function captureAtViewports(
  page: Page,
  testInfo: TestInfo,
  baseName: string,
  viewports: Array<keyof typeof VIEWPORTS>,
) {
  for (const vp of viewports) {
    await page.setViewportSize(VIEWPORTS[vp]);
    await captureScreen(page, testInfo, `${baseName}-${vp}`);
  }
  await page.setViewportSize(VIEWPORTS.portrait393);
}

/**
 * Build a consistent screenshot name.
 * Pattern: {category}/{screen}-{state}-{viewport}-{theme}-{mode}
 */
export function screenshotName(
  category: string,
  screen: string,
  state: string,
  viewport: string,
  theme: string,
  mode: string,
) {
  return `${category}/${screen}-${state}-${viewport}-${theme}-${mode}`;
}

/**
 * Mock the PWA beforeinstallprompt event.
 * Call before page.goto(). Dispatches the event after page load.
 */
export async function mockPwaInstallPrompt(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const event = new Event('beforeinstallprompt');
        (event as any).prompt = () => Promise.resolve();
        (event as any).userChoice = Promise.resolve({ outcome: 'accepted' });
        window.dispatchEvent(event);
      }, 500);
    });
  });
}

/**
 * Mock a service worker update being available.
 * Call before page.goto().
 */
export async function mockPwaUpdateAvailable(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('sw-update-available'));
      }, 500);
    });
  });
}
```

**Step 3: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 4: Commit**

```bash
git add e2e/helpers/visual-qa.ts e2e/journeys/visual-qa
git commit -m "infra: add visual-qa helpers (theme, viewports, PWA mocks)"
```

---

### Task 4: Add new factories

**Files:**
- Modify: `e2e/helpers/factories.ts`

**Step 1: Add makeRsvp, makeNotification, makeAchievement factories**

Append after `makeSpectatorProjection` (after line 279):

```typescript

export function makeRsvp(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'test-user',
    displayName: 'Test Player',
    status: 'in',
    respondedAt: Date.now(),
    ...overrides,
  };
}

export function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: uid('notif'),
    type: 'tournament_update',
    title: 'Tournament Update',
    body: 'Pool play has started.',
    read: false,
    createdAt: Date.now(),
    targetRoute: null,
    ...overrides,
  };
}

export function makeAchievement(overrides: Record<string, unknown> = {}) {
  return {
    achievementId: 'first-match',
    label: 'First Match',
    description: 'Played your first match',
    icon: 'trophy',
    unlockedAt: Date.now(),
    triggerMatchId: null,
    ...overrides,
  };
}
```

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 3: Commit**

```bash
git add e2e/helpers/factories.ts
git commit -m "infra: add RSVP, notification, achievement factories"
```

---

### Task 5: Add new composite seeders

**Files:**
- Modify: `e2e/helpers/seeders.ts`

**Step 1: Add imports for new factories**

Update the factories import at the top of `seeders.ts` to include the new factories:

```typescript
import {
  uid,
  shareCode,
  makeTournament,
  makeTeam,
  makePool,
  makeBracketSlot,
  makePublicMatch,
  makeSpectatorProjection,
  makeScoreEvent,
  makeBuddyGroup,
  makeGameSession,
  makeUserProfile,
  makeStatsSummary,
  makeMatchRefSeed,
  makeRsvp,
  makeNotification,
  makeAchievement,
} from './factories';
```

**Step 2: Add new interface types**

Add after the existing interface definitions:

```typescript
export interface BetweenGamesOptions {
  tournamentId?: string;
  team1Name?: string;
  team2Name?: string;
  game1Score?: [number, number]; // [team1, team2] for completed game 1
}

export interface BetweenGamesSeed {
  matchId: string;
  tournamentId: string;
  shareCode: string;
}

export interface CompletedMatchOptions {
  tournamentId?: string;
  team1Name?: string;
  team2Name?: string;
  finalScore?: [number, number];
}

export interface CompletedMatchSeed {
  matchId: string;
  tournamentId: string;
  shareCode: string;
}

export interface CompletedTournamentOptions {
  teamCount?: number;
}

export interface CompletedTournamentSeed {
  tournamentId: string;
  tournament: ReturnType<typeof makeTournament>;
  teams: ReturnType<typeof makeTeam>[];
  shareCode: string;
  winnerId: string;
}

export interface SessionWithRsvpsOptions {
  rsvpCount?: number;
  groupOverrides?: Record<string, unknown>;
  sessionOverrides?: Record<string, unknown>;
}

export interface SessionWithRsvpsSeed extends GameSessionSeed {
  rsvps: Array<{ userId: string; status: string }>;
}

export interface ProfileWithHistoryOptions {
  matchCount?: number;
  achievementCount?: number;
}

export interface ProfileWithHistorySeed {
  profile: ReturnType<typeof makeUserProfile>;
  stats: ReturnType<typeof makeStatsSummary>;
  matchRefs: Array<{ id: string; data: Record<string, unknown> }>;
  achievements: ReturnType<typeof makeAchievement>[];
}
```

**Step 3: Add seedBetweenGamesMatch**

Append to the file:

```typescript
/**
 * Seeds a best-of-3 match where game 1 is complete, between-games state.
 */
export async function seedBetweenGamesMatch(
  userUid: string,
  opts: BetweenGamesOptions = {},
): Promise<BetweenGamesSeed> {
  const tournamentId = opts.tournamentId || uid('tournament');
  const sc = shareCode();
  const matchId = uid('match');
  const game1Score = opts.game1Score || [11, 7];

  const match = makePublicMatch(userUid, {
    id: matchId,
    team1Name: opts.team1Name || 'Team Alpha',
    team2Name: opts.team2Name || 'Team Beta',
    status: 'in-progress',
    config: {
      gameType: 'doubles',
      scoringMode: 'sideout',
      matchFormat: 'best-of-3',
      pointsToWin: 11,
    },
    games: [
      {
        gameNumber: 1,
        team1Score: game1Score[0],
        team2Score: game1Score[1],
        winningSide: game1Score[0] > game1Score[1] ? 1 : 2,
      },
    ],
    lastSnapshot: JSON.stringify({
      team1Score: 0,
      team2Score: 0,
      gameNumber: 2,
    }),
  });

  const projection = makeSpectatorProjection({
    publicTeam1Name: opts.team1Name || 'Team Alpha',
    publicTeam2Name: opts.team2Name || 'Team Beta',
    team1Score: 0,
    team2Score: 0,
    gameNumber: 2,
    team1Wins: game1Score[0] > game1Score[1] ? 1 : 0,
    team2Wins: game1Score[1] > game1Score[0] ? 1 : 0,
    status: 'in-progress',
    tournamentId,
    tournamentShareCode: sc,
  });

  await seedFirestoreDocAdmin(PATHS.matches, matchId, match);
  await seedFirestoreDocAdmin(
    PATHS.spectatorProjection(matchId),
    SPECTATOR_DOC_ID,
    projection,
  );

  return { matchId, tournamentId, shareCode: sc };
}
```

**Step 4: Add seedCompletedMatch**

```typescript
/**
 * Seeds a completed match with final score and projection.
 */
export async function seedCompletedMatch(
  userUid: string,
  opts: CompletedMatchOptions = {},
): Promise<CompletedMatchSeed> {
  const tournamentId = opts.tournamentId || uid('tournament');
  const sc = shareCode();
  const matchId = uid('match');
  const finalScore = opts.finalScore || [11, 5];

  const match = makePublicMatch(userUid, {
    id: matchId,
    team1Name: opts.team1Name || 'Team Alpha',
    team2Name: opts.team2Name || 'Team Beta',
    status: 'completed',
    team1Score: finalScore[0],
    team2Score: finalScore[1],
  });

  const winningSide = finalScore[0] > finalScore[1] ? 1 : 2;
  const projection = makeSpectatorProjection({
    publicTeam1Name: opts.team1Name || 'Team Alpha',
    publicTeam2Name: opts.team2Name || 'Team Beta',
    team1Score: finalScore[0],
    team2Score: finalScore[1],
    gameNumber: 1,
    status: 'completed',
    tournamentId,
    tournamentShareCode: sc,
  });

  await seedFirestoreDocAdmin(PATHS.matches, matchId, match);
  await seedFirestoreDocAdmin(
    PATHS.spectatorProjection(matchId),
    SPECTATOR_DOC_ID,
    projection,
  );

  return { matchId, tournamentId, shareCode: sc };
}
```

**Step 5: Add seedCompletedTournament**

```typescript
/**
 * Seeds a completed tournament with resolved bracket and winner.
 */
export async function seedCompletedTournament(
  userUid: string,
  opts: CompletedTournamentOptions = {},
): Promise<CompletedTournamentSeed> {
  const teamCount = opts.teamCount || 4;
  const tournament = makeTournament({
    organizerId: userUid,
    status: 'completed',
    format: 'single-elimination',
  });
  const sc = tournament.shareCode;

  await seedFirestoreDocAdmin(PATHS.tournaments, tournament.id, tournament);

  const teams: ReturnType<typeof makeTeam>[] = [];
  for (let i = 0; i < teamCount; i++) {
    const team = makeTeam({
      tournamentId: tournament.id,
      name: `Team ${String.fromCharCode(65 + i)}`,
      seed: i + 1,
    });
    teams.push(team);
    await seedFirestoreDocAdmin(PATHS.teams(tournament.id), team.id, team);
  }

  // Create bracket: semi-finals + final
  const semi1 = makeBracketSlot({
    tournamentId: tournament.id,
    round: 1,
    position: 1,
    team1Id: teams[0].id,
    team2Id: teams[1].id,
    winnerId: teams[0].id,
  });
  const semi2 = makeBracketSlot({
    tournamentId: tournament.id,
    round: 1,
    position: 2,
    team1Id: teams[2].id,
    team2Id: teams[3].id,
    winnerId: teams[2].id,
  });
  const final = makeBracketSlot({
    tournamentId: tournament.id,
    round: 2,
    position: 1,
    team1Id: teams[0].id,
    team2Id: teams[2].id,
    winnerId: teams[0].id,
  });

  semi1.nextSlotId = final.id;
  semi2.nextSlotId = final.id;

  await seedFirestoreDocAdmin(PATHS.bracket(tournament.id), semi1.id, semi1);
  await seedFirestoreDocAdmin(PATHS.bracket(tournament.id), semi2.id, semi2);
  await seedFirestoreDocAdmin(PATHS.bracket(tournament.id), final.id, final);

  return {
    tournamentId: tournament.id,
    tournament,
    teams,
    shareCode: sc,
    winnerId: teams[0].id,
  };
}
```

**Step 6: Add seedSessionWithRsvps**

```typescript
/**
 * Seeds a game session with multiple RSVPs in mixed states.
 */
export async function seedSessionWithRsvps(
  userUid: string,
  opts: SessionWithRsvpsOptions = {},
): Promise<SessionWithRsvpsSeed> {
  const rsvpCount = opts.rsvpCount || 4;
  const baseSeed = await seedGameSessionWithAccess(userUid, {
    groupOverrides: opts.groupOverrides,
    sessionOverrides: {
      spotsTotal: rsvpCount + 2,
      spotsConfirmed: 0,
      ...opts.sessionOverrides,
    },
  });

  const statuses = ['in', 'in', 'out', 'maybe'];
  const rsvps: Array<{ userId: string; status: string }> = [];

  for (let i = 0; i < rsvpCount; i++) {
    const rsvpUserId = uid('rsvp-user');
    const status = statuses[i % statuses.length];
    const rsvp = makeRsvp({
      userId: rsvpUserId,
      displayName: `Player ${i + 1}`,
      status,
    });
    await seedFirestoreDocAdmin(
      PATHS.rsvps(baseSeed.sessionId),
      rsvpUserId,
      rsvp,
    );
    rsvps.push({ userId: rsvpUserId, status });
  }

  return { ...baseSeed, rsvps };
}
```

**Step 7: Add seedProfileWithHistory**

```typescript
/**
 * Seeds a user profile with stats, match history, and achievements.
 */
export async function seedProfileWithHistory(
  userUid: string,
  opts: ProfileWithHistoryOptions = {},
): Promise<ProfileWithHistorySeed> {
  const matchCount = opts.matchCount || 5;
  const achievementCount = opts.achievementCount || 3;

  const profile = makeUserProfile({ email: `${userUid}@test.com` });
  const stats = makeStatsSummary({ totalMatches: matchCount, wins: matchCount - 1, losses: 1 });

  await seedFirestoreDocAdmin(PATHS.users, userUid, profile);
  await seedFirestoreDocAdmin(PATHS.stats(userUid), 'summary', stats);

  const matchRefs: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (let i = 0; i < matchCount; i++) {
    const ref = makeMatchRefSeed({
      ownerId: userUid,
      result: i === matchCount - 1 ? 'loss' : 'win',
      scores: i === matchCount - 1 ? '7-11' : '11-7',
      startedAt: Date.now() - (i + 1) * 86400000,
      completedAt: Date.now() - (i + 1) * 86400000 + 3600000,
    });
    await seedFirestoreDocAdmin(PATHS.matchRefs(userUid), ref.id, ref.data);
    matchRefs.push(ref);
  }

  const achievementTypes = [
    { achievementId: 'first-match', label: 'First Match', description: 'Played your first match', icon: 'trophy' },
    { achievementId: 'win-streak-3', label: 'On Fire', description: '3-game win streak', icon: 'flame' },
    { achievementId: 'tournament-winner', label: 'Champion', description: 'Won a tournament', icon: 'crown' },
  ];

  const achievements: ReturnType<typeof makeAchievement>[] = [];
  for (let i = 0; i < achievementCount; i++) {
    const ach = makeAchievement(achievementTypes[i % achievementTypes.length]);
    await seedFirestoreDocAdmin(PATHS.achievements(userUid), ach.achievementId, ach);
    achievements.push(ach);
  }

  return { profile, stats, matchRefs, achievements };
}
```

**Step 8: Add seedNotifications**

```typescript
/**
 * Seeds a batch of notifications for a user.
 */
export async function seedNotifications(
  userUid: string,
  count: number = 3,
): Promise<ReturnType<typeof makeNotification>[]> {
  const types = [
    { type: 'tournament_update', title: 'Pool Play Started', body: 'Your tournament has begun.' },
    { type: 'buddy_invite', title: 'Group Invite', body: 'Alex invited you to Pickle Pals.' },
    { type: 'match_result', title: 'Match Result', body: 'You won 11-7!' },
    { type: 'achievement', title: 'Achievement Unlocked', body: 'You earned First Match!' },
  ];

  const notifications: ReturnType<typeof makeNotification>[] = [];
  for (let i = 0; i < count; i++) {
    const notif = makeNotification({
      ...types[i % types.length],
      read: i >= 2,
      createdAt: Date.now() - i * 3600000,
    });
    await seedFirestoreDocAdmin(PATHS.notifications(userUid), notif.id, notif);
    notifications.push(notif);
  }

  return notifications;
}
```

**Step 9: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 10: Run existing tests to verify no regressions**

Run: `npx playwright test --project=emulator --grep @p0 --workers=1 -- e2e/journeys/casual-scorer/scoring-journeys.spec.ts`
Expected: Existing P0 tests still pass.

**Step 11: Commit**

```bash
git add e2e/helpers/seeders.ts
git commit -m "infra: add 6 new composite seeders for visual-qa"
```

---

## Phase 2: Screenshot Test Files

### Task 6: scoring-visual.spec.ts (~34 captures)

**Files:**
- Create: `e2e/journeys/visual-qa/scoring-visual.spec.ts`

**Step 1: Write the spec file**

```typescript
import { test, expect } from '../../fixtures';
import { getCurrentUserUid } from '../../helpers/emulator-auth';
import {
  seedSpectatorMatch,
  seedBetweenGamesMatch,
  seedCompletedMatch,
} from '../../helpers/seeders';
import { captureScreen } from '../../helpers/screenshots';
import {
  setTheme,
  captureAtViewports,
  screenshotName,
  VIEWPORTS,
} from '../../helpers/visual-qa';
import type { Theme, DisplayMode } from '../../helpers/visual-qa';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';

// Helper: generate tests for gold-dark + gold-outdoor
const DISPLAY_MODES: Array<[Theme, DisplayMode]> = [
  ['court-vision-gold', 'dark'],
  ['court-vision-gold', 'outdoor'],
];

test.describe('Visual QA: Scoring', () => {
  // --- Scoreboard: midgame, multi-viewport, both display modes ---
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`scoreboard midgame team1 serving — ${theme} ${mode}`, async ({
      authenticatedPage: page,
      testUserUid,
    }, testInfo) => {
      await setTheme(page, theme, mode);
      const { matchId } = await seedSpectatorMatch(testUserUid, {
        team1Score: 5,
        team2Score: 3,
      });
      await page.goto(`/score/${matchId}`);
      await expect(page.locator('[aria-label="Scoreboard"]')).toBeVisible({ timeout: 15000 });

      // Primary viewport
      await captureScreen(page, testInfo,
        screenshotName('scoring', 'scoreboard', 'midgame-t1serving', '393', 'gold', mode));

      // Additional viewports (only on dark mode to avoid explosion)
      if (mode === 'dark') {
        await page.setViewportSize(VIEWPORTS.portrait375);
        await captureScreen(page, testInfo,
          screenshotName('scoring', 'scoreboard', 'midgame-t1serving', '375', 'gold', mode));

        await page.setViewportSize(VIEWPORTS.landscape);
        await captureScreen(page, testInfo,
          screenshotName('scoring', 'scoreboard', 'midgame-t1serving', 'landscape', 'gold', mode));

        await page.setViewportSize(VIEWPORTS.portrait393);
      }
    });
  }

  // --- Scoreboard: team 2 serving ---
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`scoreboard midgame team2 serving — ${theme} ${mode}`, async ({
      authenticatedPage: page,
      testUserUid,
    }, testInfo) => {
      await setTheme(page, theme, mode);
      const { matchId } = await seedSpectatorMatch(testUserUid, {
        team1Score: 3,
        team2Score: 5,
      });
      await page.goto(`/score/${matchId}`);
      await expect(page.locator('[aria-label="Scoreboard"]')).toBeVisible({ timeout: 15000 });
      await captureScreen(page, testInfo,
        screenshotName('scoring', 'scoreboard', 'midgame-t2serving', '393', 'gold', mode));
    });
  }

  // --- Scoreboard: rally scoring (both buttons active) ---
  test('scoreboard rally scoring — gold dark', async ({
    authenticatedPage: page,
    testUserUid,
  }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');
    const { matchId } = await seedSpectatorMatch(testUserUid, {
      team1Score: 4,
      team2Score: 6,
      matchOverrides: {
        config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
      },
    });
    await page.goto(`/score/${matchId}`);
    await expect(page.locator('[aria-label="Scoreboard"]')).toBeVisible({ timeout: 15000 });
    await captureScreen(page, testInfo,
      screenshotName('scoring', 'scoreboard', 'rally', '393', 'gold', 'dark'));
  });

  // --- Scoreboard: singles mode (no server number) ---
  test('scoreboard singles — gold dark', async ({
    authenticatedPage: page,
    testUserUid,
  }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');
    const { matchId } = await seedSpectatorMatch(testUserUid, {
      team1Score: 7,
      team2Score: 4,
      matchOverrides: {
        config: { gameType: 'singles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
      },
    });
    await page.goto(`/score/${matchId}`);
    await expect(page.locator('[aria-label="Scoreboard"]')).toBeVisible({ timeout: 15000 });
    await captureScreen(page, testInfo,
      screenshotName('scoring', 'scoreboard', 'singles', '393', 'gold', 'dark'));
  });

  // --- Scoreboard: game point ---
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`scoreboard game point — ${theme} ${mode}`, async ({
      authenticatedPage: page,
      testUserUid,
    }, testInfo) => {
      await setTheme(page, theme, mode);
      const { matchId } = await seedSpectatorMatch(testUserUid, {
        team1Score: 10,
        team2Score: 7,
      });
      await page.goto(`/score/${matchId}`);
      await expect(page.locator('[aria-label="Scoreboard"]')).toBeVisible({ timeout: 15000 });
      await captureScreen(page, testInfo,
        screenshotName('scoring', 'scoreboard', 'gamepoint', '393', 'gold', mode));
    });
  }

  // --- Scoreboard: deuce ---
  test('scoreboard deuce — gold dark', async ({
    authenticatedPage: page,
    testUserUid,
  }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');
    const { matchId } = await seedSpectatorMatch(testUserUid, {
      team1Score: 10,
      team2Score: 10,
    });
    await page.goto(`/score/${matchId}`);
    await expect(page.locator('[aria-label="Scoreboard"]')).toBeVisible({ timeout: 15000 });
    await captureScreen(page, testInfo,
      screenshotName('scoring', 'scoreboard', 'deuce', '393', 'gold', 'dark'));
  });

  // --- Scoreboard: score call (sideout doubles) ---
  test('scoreboard score call — gold dark', async ({
    authenticatedPage: page,
    testUserUid,
  }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');
    const { matchId } = await seedSpectatorMatch(testUserUid, {
      team1Score: 3,
      team2Score: 5,
      matchOverrides: {
        config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
      },
    });
    await page.goto(`/score/${matchId}`);
    await expect(page.locator('[aria-label="Scoreboard"]')).toBeVisible({ timeout: 15000 });
    await captureScreen(page, testInfo,
      screenshotName('scoring', 'scoreboard', 'scorecall', '393', 'gold', 'dark'));
  });

  // --- Scoreboard: scorer team indicator ---
  test('scoreboard scorer indicator — gold dark', async ({
    authenticatedPage: page,
    testUserUid,
  }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');
    const { matchId } = await seedSpectatorMatch(testUserUid, {
      team1Score: 4,
      team2Score: 2,
    });
    await page.goto(`/score/${matchId}`);
    await expect(page.locator('[aria-label="Scoreboard"]')).toBeVisible({ timeout: 15000 });
    await captureScreen(page, testInfo,
      screenshotName('scoring', 'scoreboard', 'scorer-indicator', '393', 'gold', 'dark'));
  });

  // --- Scoreboard: multi-game series badge ---
  test('scoreboard series badge — gold dark', async ({
    authenticatedPage: page,
    testUserUid,
  }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');
    const { matchId } = await seedBetweenGamesMatch(testUserUid);
    await page.goto(`/score/${matchId}`);
    await expect(page.locator('[aria-label="Scoreboard"]')).toBeVisible({ timeout: 15000 });
    await captureScreen(page, testInfo,
      screenshotName('scoring', 'scoreboard', 'series-badge', '393', 'gold', 'dark'));
  });

  // --- Between-games overlay ---
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`between-games — ${theme} ${mode}`, async ({
      authenticatedPage: page,
      testUserUid,
    }, testInfo) => {
      await setTheme(page, theme, mode);
      const { matchId } = await seedBetweenGamesMatch(testUserUid);
      await page.goto(`/score/${matchId}`);
      await expect(page.getByText(/Game Complete/i)).toBeVisible({ timeout: 15000 });
      await captureScreen(page, testInfo,
        screenshotName('scoring', 'between-games', 'overlay', '393', 'gold', mode));

      if (mode === 'dark') {
        await page.setViewportSize(VIEWPORTS.landscape);
        await captureScreen(page, testInfo,
          screenshotName('scoring', 'between-games', 'overlay', 'landscape', 'gold', mode));
        await page.setViewportSize(VIEWPORTS.portrait393);
      }
    });
  }

  // --- Match over ---
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`match over — ${theme} ${mode}`, async ({
      authenticatedPage: page,
      testUserUid,
    }, testInfo) => {
      await setTheme(page, theme, mode);
      const { matchId } = await seedCompletedMatch(testUserUid);
      await page.goto(`/score/${matchId}`);
      await expect(page.getByText(/Match Over/i)).toBeVisible({ timeout: 15000 });
      await captureScreen(page, testInfo,
        screenshotName('scoring', 'match-over', 'winner', '393', 'gold', mode));

      if (mode === 'dark') {
        await page.setViewportSize(VIEWPORTS.landscape);
        await captureScreen(page, testInfo,
          screenshotName('scoring', 'match-over', 'winner', 'landscape', 'gold', mode));
        await page.setViewportSize(VIEWPORTS.portrait393);
      }
    });
  }

  // --- Loading state ---
  test('scoring loading — gold dark', async ({
    authenticatedPage: page,
  }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');
    await page.goto('/score/nonexistent-id-loading-test');
    // Capture while loading (before error)
    await captureScreen(page, testInfo,
      screenshotName('scoring', 'scoring', 'loading', '393', 'gold', 'dark'));
  });

  // --- Error state ---
  test('scoring error — gold dark', async ({
    authenticatedPage: page,
  }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');
    await page.goto('/score/nonexistent-match-id-12345');
    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 15000 });
    await captureScreen(page, testInfo,
      screenshotName('scoring', 'scoring', 'error', '393', 'gold', 'dark'));
  });

  // --- Game setup ---
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`game setup form — ${theme} ${mode}`, async ({
      authenticatedPage: page,
    }, testInfo) => {
      await setTheme(page, theme, mode);
      const setup = new GameSetupPage(page);
      await setup.goto();
      await setup.expectSetupVisible();
      await captureScreen(page, testInfo,
        screenshotName('scoring', 'game-setup', 'form', '393', 'gold', mode));

      if (mode === 'dark') {
        await page.setViewportSize(VIEWPORTS.portrait375);
        await captureScreen(page, testInfo,
          screenshotName('scoring', 'game-setup', 'form', '375', 'gold', mode));
        await page.setViewportSize(VIEWPORTS.portrait393);
      }
    });
  }

  // --- Game setup: role expanded + buddy picker ---
  test('game setup role expanded — gold dark', async ({
    authenticatedPage: page,
  }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');
    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.expandYourRole();
    await captureScreen(page, testInfo,
      screenshotName('scoring', 'game-setup', 'role-expanded', '393', 'gold', 'dark'));
  });

  // --- Match history: with matches ---
  for (const [theme, mode] of DISPLAY_MODES) {
    test(`match history — ${theme} ${mode}`, async ({
      authenticatedPage: page,
      testUserUid,
    }, testInfo) => {
      await setTheme(page, theme, mode);
      // Seed some match refs for the user
      const { makeMatchRefSeed } = await import('../../helpers/factories');
      const { seedFirestoreDocAdmin } = await import('../../helpers/emulator-auth');
      const { PATHS } = await import('../../helpers/firestore-paths');
      for (let i = 0; i < 3; i++) {
        const ref = makeMatchRefSeed({ ownerId: testUserUid });
        await seedFirestoreDocAdmin(PATHS.matchRefs(testUserUid), ref.id, ref.data);
      }
      await page.goto('/history');
      await expect(page.getByText(/11-7/)).toBeVisible({ timeout: 15000 });
      await captureScreen(page, testInfo,
        screenshotName('scoring', 'history', 'with-matches', '393', 'gold', mode));
    });
  }

  // --- Match history: empty ---
  test('match history empty — gold dark', async ({
    authenticatedPage: page,
  }, testInfo) => {
    await setTheme(page, 'court-vision-gold', 'dark');
    await page.goto('/history');
    await expect(page.getByText(/no matches/i)).toBeVisible({ timeout: 15000 });
    await captureScreen(page, testInfo,
      screenshotName('scoring', 'history', 'empty', '393', 'gold', 'dark'));
  });
});
```

**Step 2: Run the visual-qa spec to verify screenshots are produced**

Run: `npx playwright test --project=visual-qa -- e2e/journeys/visual-qa/scoring-visual.spec.ts --workers=1`
Expected: All tests pass. HTML report shows attached screenshots with correct names.

**Step 3: Commit**

```bash
git add e2e/journeys/visual-qa/scoring-visual.spec.ts
git commit -m "test: add scoring visual-qa screenshots (~34 captures)"
```

---

### Task 7: tournament-visual.spec.ts (~26 captures)

**Files:**
- Create: `e2e/journeys/visual-qa/tournament-visual.spec.ts`

**Step 1: Write the spec file**

Follow the same pattern as scoring-visual.spec.ts. Key tests:

- Tournament create form (393, 375) — navigate to `/tournaments/new`, capture form
- Tournament hub in each phase: use `seedRegistrationTournament`, `seedPoolPlayTournament`, `seedBracketTournament`, `seedCompletedTournament` — navigate to `/tournaments/${id}`, capture
- Pool table + bracket view — from pool-play and bracket seeds
- Discover page (browse, my tournaments, empty) — navigate to `/tournaments`
- Modals: ScoreEditModal, SaveTemplateModal, ShareTournamentModal — trigger via UI clicks after seeding

Each test follows: `setTheme → seed → goto → waitForVisible → captureScreen`.

**Step 2: Run and verify**

Run: `npx playwright test --project=visual-qa -- e2e/journeys/visual-qa/tournament-visual.spec.ts --workers=1`
Expected: All tests pass with screenshots attached.

**Step 3: Commit**

```bash
git add e2e/journeys/visual-qa/tournament-visual.spec.ts
git commit -m "test: add tournament visual-qa screenshots (~26 captures)"
```

---

### Task 8: social-visual.spec.ts (~24 captures)

**Files:**
- Create: `e2e/journeys/visual-qa/social-visual.spec.ts`

**Step 1: Write the spec file**

Key tests:
- Buddies list (with groups, empty) — `seedBuddyGroupWithMember` → `/buddies`
- Group detail (with sessions, empty) — `seedGameSessionWithAccess` → `/buddies/${groupId}`
- Create group form — `/buddies/new`
- Group invite page — `/g/${shareCode}`
- Session detail with RSVPs — `seedSessionWithRsvps` → `/session/${sessionId}`
- Create session form — `/buddies/${groupId}/session/new`
- Public session page — `/s/${shareCode}`
- Open play (with sessions, empty) — `/play`
- BuddyActionSheet, ShareSheet — trigger via UI after seeding
- Profile (stats, empty achievements) — `seedProfileWithHistory` → `/profile`
- Players (players tab, leaderboard, empty) — `/players`

**Step 2: Run and verify**

Run: `npx playwright test --project=visual-qa -- e2e/journeys/visual-qa/social-visual.spec.ts --workers=1`

**Step 3: Commit**

```bash
git add e2e/journeys/visual-qa/social-visual.spec.ts
git commit -m "test: add social visual-qa screenshots (~24 captures)"
```

---

### Task 9: chrome-visual.spec.ts (~24 captures)

**Files:**
- Create: `e2e/journeys/visual-qa/chrome-visual.spec.ts`

**Step 1: Write the spec file**

Key tests:
- Landing page (hero, features) — unauthenticated `page.goto('/')`, capture at 393 + desktop (desktop via separate project run)
- Settings page — `/settings` in dark + outdoor
- Bottom nav active states — navigate to different tabs, capture nav
- ConfirmDialog — start a game, try to navigate away, capture dialog
- NotificationPanel (with/empty) — `seedNotifications` → trigger bell icon
- IOSInstallSheet — `mockPwaInstallPrompt` → capture
- InstallPromptBanner — similar mock
- AchievementToast — seed achievement, trigger toast display
- 404 page — navigate to `/nonexistent`
- Public tournament (live-now, completed) — `seedPoolPlayTournament` → `/t/${shareCode}`
- Public match (live, play-by-play, stats, loading) — `seedSpectatorMatch` → `/t/${shareCode}/match/${matchId}`

**Step 2: Run and verify**

Run: `npx playwright test --project=visual-qa -- e2e/journeys/visual-qa/chrome-visual.spec.ts --workers=1`

Also run the desktop project:
Run: `npx playwright test --project=visual-qa-desktop --workers=1`

**Step 3: Commit**

```bash
git add e2e/journeys/visual-qa/chrome-visual.spec.ts
git commit -m "test: add chrome visual-qa screenshots (~24 captures)"
```

---

### Task 10: theme-variations.spec.ts (~20 captures)

**Files:**
- Create: `e2e/journeys/visual-qa/theme-variations.spec.ts`

**Step 1: Write the spec file**

Re-capture 10 key screens in Classic + Ember (dark mode only). Pattern:

```typescript
const ALT_THEMES: Array<[Theme, DisplayMode]> = [
  ['classic', 'dark'],
  ['ember', 'dark'],
];

for (const [theme, mode] of ALT_THEMES) {
  test(`scoreboard midgame — ${theme} ${mode}`, async ({
    authenticatedPage: page,
    testUserUid,
  }, testInfo) => {
    await setTheme(page, theme, mode);
    const { matchId } = await seedSpectatorMatch(testUserUid, { team1Score: 5, team2Score: 3 });
    await page.goto(`/score/${matchId}`);
    await expect(page.locator('[aria-label="Scoreboard"]')).toBeVisible({ timeout: 15000 });
    await captureScreen(page, testInfo,
      screenshotName('themes', 'scoreboard', 'midgame', '393', theme, mode));
  });

  // ... repeat for: between-games, match-over, game-setup, tournament-hub,
  //     settings, profile, landing, leaderboard, public-tournament
}
```

**Step 2: Run and verify**

Run: `npx playwright test --project=visual-qa -- e2e/journeys/visual-qa/theme-variations.spec.ts --workers=1`

**Step 3: Commit**

```bash
git add e2e/journeys/visual-qa/theme-variations.spec.ts
git commit -m "test: add theme variation screenshots (~20 captures)"
```

---

### Task 11: accessibility-visual.spec.ts (~11 captures)

**Files:**
- Create: `e2e/journeys/visual-qa/accessibility-visual.spec.ts`

**Step 1: Write the spec file**

Focus indicators captured by pressing Tab to focus elements:

```typescript
test('focus ring on score button — gold dark', async ({
  authenticatedPage: page,
  testUserUid,
}, testInfo) => {
  await setTheme(page, 'court-vision-gold', 'dark');
  const { matchId } = await seedSpectatorMatch(testUserUid, { team1Score: 3, team2Score: 2 });
  await page.goto(`/score/${matchId}`);
  await expect(page.locator('[aria-label="Scoreboard"]')).toBeVisible({ timeout: 15000 });

  // Tab to focus the score button
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await captureScreen(page, testInfo,
    screenshotName('accessibility', 'scoreboard', 'focus-ring', '393', 'gold', 'dark'));
});
```

Repeat for each theme (classic, ember), game setup, tournament hub, bottom nav, settings, modal, landing, RSVP button. Also capture similar team colors test.

**Step 2: Run and verify**

Run: `npx playwright test --project=visual-qa -- e2e/journeys/visual-qa/accessibility-visual.spec.ts --workers=1`

**Step 3: Commit**

```bash
git add e2e/journeys/visual-qa/accessibility-visual.spec.ts
git commit -m "test: add accessibility visual-qa screenshots (~11 captures)"
```

---

## Phase 3: Journey Videos

### Task 12: journeys-video.spec.ts (~28 video recordings)

**Files:**
- Create: `e2e/journeys/visual-qa/journeys-video.spec.ts`

**Step 1: Write the spec file**

This file uses `test.use({ video: 'on' })` to record video for every test.

```typescript
import { test, expect } from '../../fixtures';
import { getCurrentUserUid, signOut } from '../../helpers/emulator-auth';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { NavigationBar } from '../../pages/NavigationBar';
import { SettingsPage } from '../../pages/SettingsPage';
import {
  seedRegistrationTournament,
  seedPoolPlayTournament,
  seedBuddyGroupWithMember,
  seedGameSessionWithAccess,
  seedNotifications,
  seedProfileWithHistory,
} from '../../helpers/seeders';
import { setTheme, VIEWPORTS } from '../../helpers/visual-qa';

// Always-on video for all journey tests
test.use({ video: 'on' });

test.describe('Journey Videos', () => {
  // --- CASUAL SCORING JOURNEYS ---

  test('journey 1: quick rally game', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score a full game
    for (let i = 0; i < 11; i++) {
      await scoring.scorePoint('Team 1');
    }
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();
  });

  test('journey 2: sideout doubles game', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    await setup.goto();
    await setup.selectDoubles();
    await setup.selectSideoutScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score with sideouts to show server rotation
    for (let i = 0; i < 5; i++) {
      await scoring.scorePoint('Team 1');
      await scoring.triggerSideOut();
      await scoring.scorePoint('Team 2');
      await scoring.triggerSideOut();
    }
    // Team 1 finishes
    await scoring.scorePoint('Team 1');
    await scoring.expectMatchOver();
  });

  // --- Journey 3-8: Follow same pattern ---
  // 3: singles game (selectSingles → score → match-over)
  // 4: best-of-3 (score game 1 → between-games → game 2 → between-games → game 3)
  // 5: win-by-2/deuce (score to 10-10 → deuce → win at 12-10)
  // 6: undo + nav guards (score → undo → try leave → cancel → leave)
  // 7: custom names/colors + share (fillTeamName → score → match-over → share)
  // 8: landscape scoring (start portrait → setViewportSize(landscape) → score)

  // --- AUTH & ONBOARDING ---

  test('journey 9: first-time onboarding', async ({ authenticatedPage: page }) => {
    // Visit empty states
    await page.goto('/history');
    await expect(page.getByText(/no matches/i)).toBeVisible({ timeout: 15000 });
    await page.goto('/buddies');
    await page.goto('/tournaments');
    // Start first game
    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.quickGame();
  });

  // --- Journey 10: sign out + user switch ---
  // --- Journey 11: theme + display mode tour ---
  // --- Journey 12: settings defaults → game setup ---

  // --- TOURNAMENT JOURNEYS ---

  test('journey 15: full tournament lifecycle', async ({
    authenticatedPage: page,
    testUserUid,
  }) => {
    // Seed pool-play tournament with teams
    const seed = await seedPoolPlayTournament(testUserUid, {
      teamCount: 4,
    });
    await page.goto(`/tournaments/${seed.tournamentId}`);
    await expect(page.getByText(/Pool/i)).toBeVisible({ timeout: 15000 });

    // Score a pool match (navigate to first match if available)
    // ... interaction-driven flow continues
  });

  // --- Journeys 13, 14, 16-28: Follow similar patterns ---
  // Each seeds starting state, then drives UI through clicks.
  // See design doc Section 2 for complete journey descriptions.
});
```

**Note:** The full file will contain all 28 journeys. Each journey follows the pattern: seed starting state → navigate → interact through the full workflow. Playwright records video automatically via `test.use({ video: 'on' })`.

**Step 2: Run and verify videos are produced**

Run: `npx playwright test --project=visual-qa -- e2e/journeys/visual-qa/journeys-video.spec.ts --workers=1`
Expected: Tests pass. Check `test-results/visual-qa/` for `.webm` video files.

**Step 3: Open HTML report to review videos**

Run: `npx playwright show-report`
Expected: Each journey test has an attached video showing the full flow.

**Step 4: Commit**

```bash
git add e2e/journeys/visual-qa/journeys-video.spec.ts
git commit -m "test: add 28 journey video recordings for visual-qa"
```

---

## Phase 4: Final Verification

### Task 13: Full suite run + report review

**Step 1: Run the complete visual-qa suite**

```bash
npx playwright test --project=visual-qa --project=visual-qa-desktop --workers=4
```

Expected: All tests pass. ~11-16 minutes.

**Step 2: Open the HTML report**

```bash
npx playwright show-report
```

Expected: 139 screenshots with descriptive names organized by category. 28 video recordings showing full user journeys.

**Step 3: Verify existing tests are unaffected**

```bash
npx playwright test --project=emulator --grep "@p0|@p1|@p2" --workers=1
```

Expected: All 156 existing tests still pass. No visual-qa tests included.

**Step 4: Final commit**

```bash
git add -A
git commit -m "test: complete visual-qa suite — 139 screenshots + 28 videos"
```
