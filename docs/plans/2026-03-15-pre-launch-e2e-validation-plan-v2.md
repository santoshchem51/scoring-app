# Pre-Launch E2E Validation Suite Implementation Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 179 new Playwright E2E tests across 6 personas + cross-cutting concerns, plus screenshot infrastructure, to validate all PickleScore workflows before public launch.

**Architecture:** Persona-based test journeys in `e2e/journeys/` alongside existing `e2e/` regression specs. New page objects and helpers extend existing infrastructure. Two-tier Playwright projects (regression + visual-qa) for screenshot capture.

**Tech Stack:** Playwright, Firebase emulators, TypeScript, existing fixtures/helpers/page-objects

---

## Specialist Review Fixes Applied (v2)

This revision addresses all blockers and high-priority issues from 4 specialist reviews:

1. **Export `uid()` and `shareCode()`** from factories.ts (Task 0)
2. **Score buttons use dynamic team names** — tests use default "Team 1"/"Team 2" names OR refactor POM
3. **Add `data-testid` attributes** to Scoreboard.tsx and ScoringPage.tsx for serving indicator and score call
4. **Fix `makePool` field name** from `teams` to `teamIds`
5. **Fix scoring loops** — sideout mode only allows serving team to score
6. **Per-test ID generation** — move `uid()` calls into test body, not describe scope
7. **Split oversized tasks** — Tasks 10, 13, 14, 15, 16 are now 2-3 smaller tasks each
8. **Add multi-user fixture** for 2-context tests (REG-09)
9. **Add missing P0 tests** — CS-6 (rally win-by-2), RSVP Out→In
10. **Add `captureScreen()` calls** to key journey tests
11. **Strengthen CS-7 assertions** — verify all snapshot fields
12. **Override `makeTournament` config** for pool-play tournaments

---

## Wave Structure

| Wave | Focus | Tasks | Priority |
|------|-------|-------|----------|
| 1 | Infrastructure | Tasks 0-5 | Foundation |
| 2 | Casual Scorer P0 | Tasks 6-9 | P0 |
| 3 | Staff P0 | Tasks 10-12 | P0 |
| 4 | Buddy P0 | Tasks 13-15 | P0 |
| 5 | Organizer P0 | Tasks 16-19 | P0 |
| 6 | Player P0 + Cross-Cutting P0 | Tasks 20-22 | P0 |
| 7 | Spectator P0 | Tasks 23-25 | P0 |
| 8-11 | P1/P2 | Tasks 26-38 | P1/P2 |

**Execution:** Each task is a commit. P0 tasks (0-25) are the pre-launch gate.

---

### Task 0: Export factory helpers + fix pool field name

**Files:**
- Modify: `e2e/helpers/factories.ts`

**Step 1: Add `export` keyword to `uid` and `shareCode` functions**

In `e2e/helpers/factories.ts`, find:
```typescript
function uid(prefix: string): string {
```
Change to:
```typescript
export function uid(prefix: string): string {
```

Find:
```typescript
function shareCode(): string {
```
Change to:
```typescript
export function shareCode(): string {
```

**Step 2: Verify existing tests still compile**

Run: `npx tsc --noEmit --project tsconfig.json` (or `npx playwright test --list e2e/scoring/match-setup.spec.ts`)
Expected: No compile errors

**Step 3: Commit**

```bash
git add e2e/helpers/factories.ts
git commit -m "chore: export uid and shareCode helpers from factories"
```

---

### Task 1: Add data-testid attributes to scoring components

**Files:**
- Modify: `src/features/scoring/components/Scoreboard.tsx`
- Modify: `src/features/scoring/ScoringPage.tsx`

**Step 1: Add serving indicator testid to Scoreboard.tsx**

Find the serving indicator element (the "Serving" / "Server N" span) within each team's panel. Add a `data-testid`:

```tsx
// For team 1's serving indicator:
<span data-testid="serving-indicator-1" class="...">Serving</span>
// For team 2's:
<span data-testid="serving-indicator-2" class="...">Serving</span>
```

**Step 2: Add score call testid to ScoringPage.tsx**

Find the score call display section (the div with the 3-number format like "0-0-2"). Add:

```tsx
<div data-testid="score-call" class="text-center py-3 mx-4 ...">
```

**Step 3: Run existing tests to confirm no regression**

Run: `npx playwright test --project=emulator e2e/scoring/ --workers=2`
Expected: All existing scoring tests PASS

**Step 4: Commit**

```bash
git add src/features/scoring/components/Scoreboard.tsx src/features/scoring/ScoringPage.tsx
git commit -m "chore: add data-testid attributes for serving indicator and score call"
```

---

### Task 2: Playwright Config — Add visual-qa project

**Files:**
- Modify: `playwright.config.ts`

**Step 1: Add visual-qa project and screenshot settings**

Add to the shared `use` block:
```typescript
screenshot: 'only-on-failure',
trace: 'retain-on-failure',
```

Add a new project entry between `emulator` and `staging-smoke`:
```typescript
{
  name: 'visual-qa',
  testIgnore: ['**/smoke/**'],
  use: {
    screenshot: 'on',
    trace: 'on',
    video: 'retain-on-first-retry',
  },
},
```

**Step 2: Verify existing tests pass**

Run: `npx playwright test --project=emulator e2e/scoring/match-setup.spec.ts --workers=1`
Expected: PASS

**Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "chore: add visual-qa project and screenshot config to Playwright"
```

---

### Task 3: Screenshot helper + multi-user fixture

**Files:**
- Create: `e2e/helpers/screenshots.ts`
- Modify: `e2e/fixtures.ts`

**Step 1: Create screenshot helper**

```typescript
import type { Page, Locator, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';

type ScreenshotMode = 'attach' | 'compare';

export async function captureScreen(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options?: {
    fullPage?: boolean;
    locator?: Locator;
    mode?: ScreenshotMode;
    threshold?: number;
  },
) {
  const target = options?.locator ?? page;
  const mode = options?.mode ?? 'attach';

  if (mode === 'compare') {
    await expect(target).toHaveScreenshot(`${name}.png`, {
      fullPage: options?.fullPage ?? false,
      animations: 'disabled',
      maxDiffPixelRatio: options?.threshold ?? 0.01,
    });
  } else {
    await testInfo.attach(name, {
      body: await (options?.locator
        ? options.locator.screenshot({ animations: 'disabled' })
        : page.screenshot({
            fullPage: options?.fullPage ?? false,
            animations: 'disabled',
          })),
      contentType: 'image/png',
    });
  }
}
```

**Step 2: Add `secondUser` fixture to fixtures.ts for 2-context tests**

Add to the existing fixtures:
```typescript
// Add this fixture for tests requiring two authenticated users (e.g., REG-09)
secondAuthenticatedPage: async ({ browser }, use) => {
  const context = await browser.newContext({ ...devices['Pixel 5'] });
  const page = await context.newPage();
  await page.goto('http://localhost:5199');
  await signInAsTestUser(page, {
    email: `e2e-second-${crypto.randomUUID()}@test.com`,
    displayName: 'Second User',
  });
  await use(page);
  await context.close();
},
```

**Step 3: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add e2e/helpers/screenshots.ts e2e/fixtures.ts
git commit -m "feat: add screenshot helper and multi-user fixture"
```

---

### Task 4: ScoringPage POM — Add missing methods

**Files:**
- Modify: `e2e/pages/ScoringPage.ts`

**Step 1: Add methods**

```typescript
async startNextGame() {
  await this.page.getByRole('button', { name: /start (next )?game/i }).click();
}

async getMatchIdFromUrl(): Promise<string> {
  const url = this.page.url();
  const match = url.match(/\/score\/(.+)$/);
  if (!match) throw new Error(`Could not extract match ID from URL: ${url}`);
  return match[1];
}

async expectBetweenGames(gamesWon?: string) {
  await expect(this.page.getByText(/game complete/i)).toBeVisible({ timeout: 10000 });
  await expect(this.page.getByRole('button', { name: /start (next )?game/i })).toBeVisible();
  if (gamesWon) {
    await expect(this.page.getByText(gamesWon)).toBeVisible();
  }
}

async expectServingIndicator(team: 1 | 2) {
  await expect(this.page.getByTestId(`serving-indicator-${team}`)).toBeVisible();
}

async expectGameNumber(n: number) {
  await expect(this.page.getByText(`Game ${n}`)).toBeVisible();
}

async expectScoreCall(call: string) {
  await expect(this.page.getByTestId('score-call')).toContainText(call);
}
```

**Step 2: Verify existing tests still pass**

Run: `npx playwright test --project=emulator e2e/scoring/ --workers=2`
Expected: PASS (new methods are additive)

**Step 3: Commit**

```bash
git add e2e/pages/ScoringPage.ts
git commit -m "feat: add startNextGame, expectBetweenGames, serving indicator to ScoringPage POM"
```

---

### Task 5: SettingsPage POM

**Files:**
- Create: `e2e/pages/SettingsPage.ts`

**Step 1: Create page object** (same as original plan Task 4)

**Step 2: Verify with tsc**: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add e2e/pages/SettingsPage.ts
git commit -m "feat: add SettingsPage page object"
```

---

### Task 6: Casual Scorer P0 — Landing page + Best-of-3

**Files:**
- Create: `e2e/journeys/casual-scorer/scoring-journeys.spec.ts`

**IMPORTANT:** Use default team names ("Team 1"/"Team 2") for all tests that use the ScoringPage POM's scorePoint() method, since the POM's button selectors are hardcoded to these names.

**Step 1: Write CS-1 and CS-3**

```typescript
import { test, expect } from '../../fixtures';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { captureScreen } from '../../helpers/screenshots';

test.describe('Casual Scorer: Core Journeys', () => {
  let setup: GameSetupPage;
  let scoring: ScoringPage;

  test.beforeEach(async ({ page }) => {
    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);
  });

  test('CS-1: landing page Start Scoring navigates to game setup', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/start scoring/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: /start scoring/i }).click();
    await setup.expectSetupVisible();
  });

  test('CS-3: best-of-3 plays through game boundary', async ({ page }, testInfo) => {
    await setup.goto();
    // Use default team names so POM selectors work
    await setup.selectRallyScoring();
    await setup.selectBestOf(3);
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Win game 1 (rally mode: either team can score)
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectBetweenGames();
    await captureScreen(page, testInfo, 'scoring-betweengames-game1complete');

    // Start game 2
    await scoring.startNextGame();
    await scoring.expectScore('0 - 0');

    // Win game 2 -> match over
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await captureScreen(page, testInfo, 'scoring-matchover-bestof3');
  });
});
```

**Step 2: Run**

Run: `npx playwright test --project=emulator e2e/journeys/casual-scorer/scoring-journeys.spec.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add e2e/journeys/casual-scorer/scoring-journeys.spec.ts
git commit -m "test(e2e): add CS-1 landing page and CS-3 best-of-3 journeys"
```

---

### Task 7: Casual Scorer P0 — Sideout server rotation + Rally win-by-2

**Files:**
- Modify: `e2e/journeys/casual-scorer/scoring-journeys.spec.ts`

**Step 1: Add CS-4 (doubles sideout) and CS-6 (rally win-by-2)**

```typescript
  test('CS-4: doubles sideout serving restrictions', async ({ page }) => {
    await setup.goto();
    await setup.selectDoubles();
    await setup.selectSideoutScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // In sideout, only serving team can score
    // At start, Team 1 serves (but doubles starts with Server 2 one-serve rule)
    await scoring.expectTeam1Enabled();
    await scoring.expectTeam2Disabled();

    // Score a point for serving team
    await scoring.scorePoint('Team 1');
    await scoring.expectScore('1 - 0');

    // Side out — now Team 2 serves
    await scoring.triggerSideOut();
    await scoring.expectTeam1Disabled();
    await scoring.expectTeam2Enabled();
  });

  test('CS-6: rally scoring win-by-2 enforced', async ({ page }) => {
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score to 10-10
    for (let i = 0; i < 10; i++) {
      await scoring.scorePoint('Team 1');
      await scoring.scorePoint('Team 2');
    }
    await scoring.expectScore('10 - 10');

    // At 10-10, score one more for Team 1 -> 11-10, not a win (need win by 2)
    await scoring.scorePoint('Team 1');
    await scoring.expectScore('11 - 10');
    // Game should NOT be over
    await expect(scoring.team1ScoreBtn).toBeVisible();

    // Score for Team 1 again -> 12-10, win by 2
    await scoring.scorePoint('Team 1');
    await scoring.expectMatchOver();
  });
```

**Step 2: Run and commit**

```bash
git add e2e/journeys/casual-scorer/scoring-journeys.spec.ts
git commit -m "test(e2e): add CS-4 sideout rotation and CS-6 rally win-by-2"
```

---

### Task 8: Casual Scorer P0 — Resume + Offline + Undo

**Files:**
- Create: `e2e/journeys/casual-scorer/offline-resume.spec.ts`

**Step 1: Write CS-7 (resume with full snapshot verification), CS-8 (offline), CS-9 (undo)**

For CS-7, verify ALL snapshot fields after reload:
```typescript
  test('CS-7: match resume restores full snapshot', async ({ page }) => {
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.selectBestOf(3);
    await setup.startGame();

    // Score to 7-4 in game 1
    for (let i = 0; i < 7; i++) await scoring.scorePoint('Team 1');
    for (let i = 0; i < 4; i++) await scoring.scorePoint('Team 2');
    await scoring.expectScore('7 - 4');

    // Reload page
    await page.reload();
    await scoring.expectOnScoringScreen();

    // Verify score restored
    await scoring.expectScore('7 - 4');
    // Verify still in game (not between games or match over)
    await expect(scoring.team1ScoreBtn).toBeVisible();
  });
```

For CS-8 (offline) and CS-9 (undo) — same as original plan but with default team names.

**Step 2: Run and commit**

```bash
git add e2e/journeys/casual-scorer/offline-resume.spec.ts
git commit -m "test(e2e): add CS-7 resume, CS-8 offline, CS-9 undo journeys"
```

---

### Task 9: Casual Scorer P0 — Quick Game + History

**Files:**
- Modify: `e2e/journeys/casual-scorer/scoring-journeys.spec.ts`

**IMPORTANT:** `quickGame()` defaults to sideout scoring. In sideout, only the serving team can score. Use the scoring flow from existing `match-completion.spec.ts` which scores 11 points correctly in sideout mode.

**Step 1: Write CS-2 and CS-16**

```typescript
  test('CS-2: quick game to completion appears in history', async ({ page }) => {
    await setup.goto();
    await setup.quickGame();
    await scoring.expectOnScoringScreen();

    // In sideout, only serving team can score — score 11 for Team 1
    // Team 1 serves first; each successful point keeps serve
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    // Navigate to history
    const nav = new NavigationBar(page);
    await nav.goToHistory();
    await expect(page.locator('[data-testid="history-list"], [class*="history"]')
      .getByText('11')).toBeVisible({ timeout: 10000 });
  });
```

**Step 2: Run and commit**

```bash
git add e2e/journeys/casual-scorer/
git commit -m "test(e2e): add CS-2 quick game and CS-16 history persistence"
```

---

### Tasks 10-12: Staff P0 (3 tasks instead of 2)

**Task 10:** Scorekeeper sees match list + does NOT see admin UI (S1, S3, S5, S20)
- **FIX:** Generate fresh IDs inside each test, not at describe scope
- **FIX:** Override `makeTournament` config: `config: { poolCount: 2, poolSize: 4, ... }`
- **FIX:** Use `teamIds` not `teams` in `makePool()`

**Task 11:** Moderator sees Edit Score + Dispute Panel (S7, S8)
- Seed with `staff: { [userUid]: 'moderator' }` and a dispute document

**Task 12:** Admin sees StaffManager + Scorekeeper scores e2e (S12, S16)
- S16: Navigate from dashboard Score button → scoring page → score 11 points → save → verify match removed from unscored list

---

### Tasks 13-15: Buddy P0 (3 tasks)

**Task 13:** Group detail + Join via invite (tests 4, 5)
**Task 14:** RSVP Out→In reverse delta (the MISSING P0 test) + cancelled session guard
**Task 15:** Voting session creation + vote + confirm + Open Play

---

### Tasks 16-19: Organizer P0 (4 tasks instead of 2)

**Task 16:** DASH-11 — Pool-bracket full lifecycle (ONE task for this complex test)
**Task 17:** DASH-12 (advance to completed) + DASH-14 (blocked with insufficient players)
**Task 18:** REG-09 — Approval queue using `secondAuthenticatedPage` fixture
**Task 19:** REG-12 (max cap) + INT-03 (rescore) + AUTH-04 (non-organizer guard)

---

### Tasks 20-22: Player P0 + Cross-Cutting P0 (3 tasks)

**Task 20:** PL-4 (share code view) + PL-10 (pool standings columns)
**Task 21:** PL-14 (achievement toast) + PL-31 (cross-feature chain)
**Task 22:** C1 (sync retry) + C2 (awaitingAuth resume) + C3 (local push on sign-in)

---

### Tasks 23-25: Spectator P0 (3 tasks)

**Task 23:** Hub in all 4 tournament phases (registration, pool-play, bracket, completed)
**Task 24:** Scoreboard full data + Play-by-play events render
**Task 25:** Mobile viewport — hub at 375px AND match detail at 375px (both, not just hub)

---

### Task 26: P0 Verification Gate

**Step 1:** Run full journey suite: `npx playwright test --project=emulator e2e/journeys/ --workers=4`
**Step 2:** Run all tests (existing + new): `npx playwright test --project=emulator --workers=4`
**Step 3:** Type check: `npx tsc --noEmit`
**Step 4:** Visual QA: `npx playwright test --project=visual-qa e2e/journeys/ --workers=2 && npx playwright show-report`

---

### Tasks 27-38: P1/P2 Tests

> **NOTE FOR IMPLEMENTER:** These tasks are listed at high level. Before implementing each task, expand it to full detail following the P0 task template: exact file paths, complete test code, run commands, expected output, and commit message. Reference the design doc for the full test specification for each ID.

**Task 27:** Casual Scorer P1 — CS-5, CS-10, CS-11, CS-12, CS-13, CS-14, CS-15, CS-17, CS-18
**Task 28:** Player P1 — PL-1/2/3 (smart tab), PL-5 (deep link), PL-6 (reg blocked), PL-8/9 (tournament stats)
**Task 29:** Player P1 — PL-11 (bracket), PL-12 (tier badge), PL-17/18 (leaderboard), PL-22/23 (notifications)
**Task 30:** Player P1 — PL-25 (sync resume), PL-32 (offline->sync->stats)
**Task 31:** Organizer P1 — CRE-10 through CRE-13, DASH-13, DASH-15
**Task 32:** Organizer P1 — REG-10/11/13, POOL-04, INT-04, ADM-14/15/16
**Task 33:** Staff P1 — S4, S6, S9-11, S13-15, S17
**Task 34:** Buddy P1 — RSVP transitions, day-of boundaries, share feedback, session fills
**Task 35:** Buddy P1 — Creator controls, validation, notifications
**Task 36:** Spectator P1 — All 16 P1 tests from design
**Task 37:** Cross-Cutting P1 — C4 (cloud pull multi-context), C8 (settings defaults), C10 (rapid nav), C11 (stale data)
**Task 38:** All P2 tests across all personas

---

## Key Conventions for All Tasks

### Seeding Pattern
```typescript
// ALWAYS generate IDs inside test body or beforeEach, NEVER at describe scope
test('example', async ({ authenticatedPage: page }) => {
  const tournamentId = uid('tournament');
  const teamId = uid('team');
  // ... seed and test
});
```

### Team Name Convention
Use default "Team 1" / "Team 2" names in tests that score via the ScoringPage POM. Only use custom names in tests that DON'T score (e.g., verifying names display on scoreboard).

### Sideout vs Rally Scoring
- **Sideout:** Only serving team's button is enabled. Side-out switches serve.
- **Rally:** Both buttons always enabled. Either team scores any time.
- `quickGame()` defaults to **sideout** — plan scoring loops accordingly.

### Pool Tournament Config Override
When seeding pool-play tournaments, ALWAYS override the config:
```typescript
makeTournament({
  status: 'pool-play',
  format: 'round-robin',
  config: { poolCount: 2, teamsPerPool: 4, gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
  // ...
});
```

### Negative Assertions
Always wait for a positive element FIRST, then check negative assertions:
```typescript
// GOOD: wait for page to load, then check missing elements
await expect(page.getByText(/matches to score/i)).toBeVisible({ timeout: 15000 });
await expect(page.getByText(/organizer controls/i)).not.toBeVisible();

// BAD: negative assertion before page finishes loading
await expect(page.getByText(/organizer controls/i)).not.toBeVisible(); // passes vacuously
```

### Screenshot Captures
Add `captureScreen()` calls at key visual states in journey tests:
```typescript
await captureScreen(page, testInfo, 'scoring-scoreboard-midgame', {
  locator: page.getByTestId('scoreboard'),
});
```
