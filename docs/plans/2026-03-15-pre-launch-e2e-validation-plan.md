# Pre-Launch E2E Validation Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 179 new Playwright E2E tests across 6 personas + cross-cutting concerns, plus screenshot infrastructure, to validate all PickleScore workflows before public launch.

**Architecture:** Persona-based test journeys in `e2e/journeys/` alongside existing `e2e/` regression specs. New page objects and helpers extend existing infrastructure. Two-tier Playwright projects (regression + visual-qa) for screenshot capture.

**Tech Stack:** Playwright, Firebase emulators, TypeScript, existing fixtures/helpers/page-objects

---

## Wave Structure

| Wave | Focus | Tests | Priority |
|------|-------|-------|----------|
| 1 | Infrastructure (config, helpers, page objects) | 0 | Foundation |
| 2 | Casual Scorer P0 | 8 | P0 |
| 3 | Staff P0 (biggest gap) | 9 | P0 |
| 4 | Buddy P0 | 6 | P0 |
| 5 | Organizer P0 | 7 | P0 |
| 6 | Player P0 + Cross-Cutting P0 | 7 | P0 |
| 7 | Spectator P0 | 7 | P0 |
| 8 | Casual Scorer + Player P1 | ~20 | P1 |
| 9 | Organizer + Staff P1 | ~22 | P1 |
| 10 | Buddy + Spectator P1 | ~37 | P1 |
| 11 | Cross-Cutting P1 + All P2 | ~56 | P1/P2 |

**Execution:** Each wave is a commit. P0 waves (1-7) are the pre-launch gate. P1/P2 waves can follow post-launch if needed.

---

### Task 1: Playwright Config — Add visual-qa project

**Files:**
- Modify: `playwright.config.ts`

**Step 1: Update config to add visual-qa project and screenshot settings**

```typescript
// In the existing defineConfig, update the use block and projects array:

// Add to the shared `use` block:
use: {
  ...devices['Pixel 5'],
  baseURL: 'http://localhost:5199',
  screenshot: 'only-on-failure',
  trace: 'retain-on-failure',
},

// Replace the existing projects array with:
projects: [
  {
    name: 'emulator',
    testIgnore: ['**/smoke/**'],
    use: {
      screenshot: 'only-on-failure',
      trace: 'retain-on-failure',
    },
  },
  {
    name: 'visual-qa',
    testIgnore: ['**/smoke/**'],
    use: {
      screenshot: 'on',
      trace: 'on',
      video: 'retain-on-first-retry',
    },
  },
  {
    name: 'staging-smoke',
    testMatch: '**/smoke/**',
    use: {
      ...devices['Pixel 5'],
      baseURL: process.env.STAGING_URL ?? 'https://picklescore.web.app',
    },
  },
],
```

**Step 2: Run existing tests to confirm no regression**

Run: `npx playwright test --project=emulator --workers=1 e2e/scoring/match-setup.spec.ts`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "chore: add visual-qa project and screenshot config to Playwright"
```

---

### Task 2: Screenshot Helper

**Files:**
- Create: `e2e/helpers/screenshots.ts`

**Step 1: Create the screenshot helper with dual-mode support**

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

**Step 2: Commit**

```bash
git add e2e/helpers/screenshots.ts
git commit -m "feat: add dual-mode screenshot helper for E2E tests"
```

---

### Task 3: ScoringPage POM — Add missing methods

**Files:**
- Modify: `e2e/pages/ScoringPage.ts`

**Step 1: Add the missing methods to ScoringPage**

Add these methods to the existing ScoringPage class:

```typescript
// Add after existing action methods:

async startNextGame() {
  await this.page.getByRole('button', { name: /start (next )?game/i }).click();
}

async getMatchIdFromUrl(): Promise<string> {
  const url = this.page.url();
  const match = url.match(/\/score\/(.+)$/);
  if (!match) throw new Error(`Could not extract match ID from URL: ${url}`);
  return match[1];
}

// Add after existing assertion methods:

async expectBetweenGames(gamesWon?: string) {
  await expect(this.page.getByText(/game complete/i)).toBeVisible({ timeout: 10000 });
  await expect(this.page.getByRole('button', { name: /start (next )?game/i })).toBeVisible();
  if (gamesWon) {
    await expect(this.page.getByText(gamesWon)).toBeVisible();
  }
}

async expectServingIndicator(team: 'Team 1' | 'Team 2') {
  await expect(
    this.page.getByTestId(`serving-indicator-${team === 'Team 1' ? '1' : '2'}`),
  ).toBeVisible();
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
Expected: All existing scoring tests PASS (new methods are additive)

**Step 3: Commit**

```bash
git add e2e/pages/ScoringPage.ts
git commit -m "feat: add startNextGame, expectBetweenGames, and serving indicator to ScoringPage POM"
```

---

### Task 4: SettingsPage POM

**Files:**
- Create: `e2e/pages/SettingsPage.ts`

**Step 1: Create the SettingsPage page object**

```typescript
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class SettingsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings');
    await expect(this.page.getByText('Settings')).toBeVisible({ timeout: 10000 });
  }

  async selectDisplayMode(mode: 'dark' | 'outdoor') {
    await this.page.getByLabel(mode, { exact: false }).click();
  }

  async selectDefaultScoringMode(mode: 'sideout' | 'rally') {
    await this.page.getByLabel(mode, { exact: false }).click();
  }

  async selectDefaultPointsToWin(points: 11 | 15 | 21) {
    await this.page.getByLabel(`${points}`, { exact: false }).click();
  }

  async selectDefaultMatchFormat(format: '1 Game' | 'Best of 3' | 'Best of 5') {
    await this.page.getByLabel(format, { exact: false }).click();
  }

  async expectAllSections() {
    await expect(this.page.getByText('Display')).toBeVisible();
    await expect(this.page.getByText('Sound')).toBeVisible();
  }
}
```

**Step 2: Commit**

```bash
git add e2e/pages/SettingsPage.ts
git commit -m "feat: add SettingsPage page object for E2E tests"
```

---

### Task 5: Create journey directory structure

**Files:**
- Create directories: `e2e/journeys/casual-scorer/`, `e2e/journeys/player/`, `e2e/journeys/organizer/`, `e2e/journeys/buddy/`, `e2e/journeys/spectator/`, `e2e/journeys/staff/`, `e2e/journeys/cross-cutting/`

**Step 1: Create directory structure**

```bash
mkdir -p e2e/journeys/{casual-scorer,player,organizer,buddy,spectator,staff,cross-cutting}
```

**Step 2: Commit**

```bash
git add -A e2e/journeys/
git commit -m "chore: create journey test directory structure"
```

---

### Task 6: Casual Scorer P0 — Landing page + Best-of-3 + Server rotation

**Files:**
- Create: `e2e/journeys/casual-scorer/scoring-journeys.spec.ts`

**Step 1: Write CS-1, CS-3, CS-4 tests**

```typescript
import { test, expect } from '../../fixtures';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { NavigationBar } from '../../pages/NavigationBar';

test.describe('Casual Scorer Journeys', () => {
  let setup: GameSetupPage;
  let scoring: ScoringPage;
  let nav: NavigationBar;

  test.beforeEach(async ({ page }) => {
    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);
    nav = new NavigationBar(page);
  });

  test('CS-1: landing page Start Scoring navigates to game setup', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/start scoring/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: /start scoring/i }).click();
    await setup.expectSetupVisible();
  });

  test('CS-3: best-of-3 plays through game boundary', async ({ page }) => {
    await setup.goto();
    await setup.fillTeamName(1, 'Eagles');
    await setup.fillTeamName(2, 'Hawks');
    await setup.selectRallyScoring();
    await setup.selectBestOf(3);
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Win game 1 for Team 1 (11-0 rally)
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectBetweenGames();

    // Start game 2
    await scoring.startNextGame();
    await scoring.expectScore('0 - 0');
    await scoring.expectGameNumber(2);

    // Win game 2 for Team 1 (11-0 rally) -> match over
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver('Eagles');
  });

  test('CS-4: doubles sideout server rotation and first-serve rule', async ({ page }) => {
    await setup.goto();
    await setup.fillTeamName(1, 'Alpha');
    await setup.fillTeamName(2, 'Beta');
    await setup.selectDoubles();
    await setup.selectSideoutScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Doubles sideout starts with Server 2 (one-serve rule)
    // Score a point for serving team
    await scoring.scorePoint('Team 1');
    await scoring.expectScore('1 - 0');

    // Side out should switch to Team 2
    await scoring.triggerSideOut();
    // Team 2 now serving — Team 1 button should be disabled in sideout
    await scoring.expectTeam1Disabled();
    await scoring.expectTeam2Enabled();
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test --project=emulator e2e/journeys/casual-scorer/scoring-journeys.spec.ts`
Expected: All 3 tests PASS

**Step 3: Commit**

```bash
git add e2e/journeys/casual-scorer/scoring-journeys.spec.ts
git commit -m "test(e2e): add casual scorer P0 journeys — landing page, best-of-3, server rotation"
```

---

### Task 7: Casual Scorer P0 — Match resume + Offline mid-match + Undo boundaries

**Files:**
- Create: `e2e/journeys/casual-scorer/offline-resume.spec.ts`

**Step 1: Write CS-7, CS-8, CS-9 tests**

```typescript
import { test, expect } from '../../fixtures';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';

test.describe('Casual Scorer: Offline & Resume', () => {
  let setup: GameSetupPage;
  let scoring: ScoringPage;

  test.beforeEach(async ({ page }) => {
    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);
  });

  test('CS-7: match resume after refresh restores full snapshot', async ({ page }) => {
    await setup.goto();
    await setup.fillTeamName(1, 'Aces');
    await setup.fillTeamName(2, 'Kings');
    await setup.selectRallyScoring();
    await setup.startGame();

    // Score to a non-trivial state
    await scoring.scorePoints('Team 1', 7);
    await scoring.scorePoints('Team 2', 4);
    await scoring.expectScore('7 - 4');

    // Get match URL, reload page
    const matchId = await scoring.getMatchIdFromUrl();
    await page.reload();

    // Wait for resume
    await scoring.expectOnScoringScreen();
    await scoring.expectScore('7 - 4');
  });

  test('CS-8: go offline mid-match, continue scoring', async ({ page, context }) => {
    await setup.goto();
    await setup.fillTeamName(1, 'Net');
    await setup.fillTeamName(2, 'Court');
    await setup.selectRallyScoring();
    await setup.startGame();

    // Score 3 points online
    await scoring.scorePoints('Team 1', 3);
    await scoring.expectScore('3 - 0');

    // Go offline
    await context.setOffline(true);

    // Score 3 more points offline
    await scoring.scorePoints('Team 1', 3);
    await scoring.expectScore('6 - 0');

    // Go back online
    await context.setOffline(false);

    // Verify state persisted
    await page.reload();
    await scoring.expectOnScoringScreen();
    await scoring.expectScore('6 - 0');
  });

  test('CS-9: undo sequences and boundary behavior', async ({ page }) => {
    await setup.goto();
    await setup.fillTeamName(1, 'Uno');
    await setup.fillTeamName(2, 'Dos');
    await setup.selectRallyScoring();
    await setup.startGame();

    // Score and undo
    await scoring.scorePoint('Team 1');
    await scoring.expectScore('1 - 0');
    await scoring.undoLastAction();
    await scoring.expectScore('0 - 0');

    // Multiple undos
    await scoring.scorePoints('Team 1', 3);
    await scoring.expectScore('3 - 0');
    await scoring.undoLastAction();
    await scoring.undoLastAction();
    await scoring.expectScore('1 - 0');
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test --project=emulator e2e/journeys/casual-scorer/offline-resume.spec.ts`
Expected: All 3 tests PASS

**Step 3: Commit**

```bash
git add e2e/journeys/casual-scorer/offline-resume.spec.ts
git commit -m "test(e2e): add casual scorer P0 — match resume, offline mid-match, undo boundaries"
```

---

### Task 8: Casual Scorer P0 — History + Rally scoring validation

**Files:**
- Modify: `e2e/journeys/casual-scorer/scoring-journeys.spec.ts`

**Step 1: Add CS-2 (quick game -> history) and CS-6 (rally win-by-2) tests**

Append to the existing describe block:

```typescript
  test('CS-2: quick game to completion appears in history', async ({ page }) => {
    await setup.goto();
    await setup.quickGame();
    await scoring.expectOnScoringScreen();

    // Score to completion (11-0 in sideout — serving team scores all)
    for (let i = 0; i < 11; i++) {
      await scoring.scorePoint('Team 1');
    }
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    // Verify in history
    await nav.goToHistory();
    await expect(page.getByText('11')).toBeVisible({ timeout: 10000 });
  });

  test('CS-16: match history persists across reload', async ({ page }) => {
    await setup.goto();
    await setup.quickGame();
    await scoring.expectOnScoringScreen();

    for (let i = 0; i < 11; i++) {
      await scoring.scorePoint('Team 1');
    }
    await scoring.saveAndFinish();

    await nav.goToHistory();
    await expect(page.getByText('11')).toBeVisible({ timeout: 10000 });

    await page.reload();
    await expect(page.getByText('11')).toBeVisible({ timeout: 10000 });
  });
```

**Step 2: Run all casual scorer tests**

Run: `npx playwright test --project=emulator e2e/journeys/casual-scorer/`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add e2e/journeys/casual-scorer/
git commit -m "test(e2e): add casual scorer P0 — quick game history, history persistence"
```

---

### Task 9: Staff P0 — Scorekeeper permission tests

**Files:**
- Create: `e2e/journeys/staff/scorekeeper.spec.ts`

**Step 1: Write S1, S2, S3, S5 tests**

```typescript
import { test, expect } from '../../fixtures';
import {
  signInAsTestUser,
  seedFirestoreDocAdmin,
  getCurrentUserUid,
} from '../../helpers/emulator-auth';
import { makeTournament, makeTeam, makePool, uid } from '../../helpers/factories';

test.describe('Staff: Scorekeeper', () => {
  const tournamentId = uid('tournament');
  const matchId = uid('match');
  const poolId = uid('pool');
  const team1Id = uid('team');
  const team2Id = uid('team');

  async function seedScorekeeperTournament(page: any, userUid: string) {
    const tournament = makeTournament({
      organizerId: uid('organizer'),
      status: 'pool-play',
      format: 'round-robin',
      staff: { [userUid]: 'scorekeeper' },
      staffUids: [userUid],
    });
    await seedFirestoreDocAdmin('tournaments', tournamentId, tournament);
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team1Id, makeTeam({ name: 'Eagles' }));
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/teams`, team2Id, makeTeam({ name: 'Hawks' }));
    await seedFirestoreDocAdmin(`tournaments/${tournamentId}/pools`, poolId, makePool({
      teams: [team1Id, team2Id],
      schedule: [{ matchId, team1Id, team2Id, status: 'pending' }],
    }));
  }

  test('S1: scorekeeper sees ScorekeeperMatchList', async ({ authenticatedPage: page }) => {
    const userUid = await getCurrentUserUid(page);
    await seedScorekeeperTournament(page, userUid);
    await page.goto(`/tournaments/${tournamentId}`);

    await expect(page.getByText(/matches to score/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Eagles')).toBeVisible();
    await expect(page.getByText('Hawks')).toBeVisible();
  });

  test('S3: scorekeeper does NOT see admin UI', async ({ authenticatedPage: page }) => {
    const userUid = await getCurrentUserUid(page);
    await seedScorekeeperTournament(page, userUid);
    await page.goto(`/tournaments/${tournamentId}`);

    await expect(page.getByText(/matches to score/i)).toBeVisible({ timeout: 15000 });
    // Negative assertions — admin features hidden
    await expect(page.getByText(/^Staff$/)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /add staff/i })).not.toBeVisible();
    await expect(page.getByText(/organizer controls/i)).not.toBeVisible();
    await expect(page.getByText(/quick add/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /export csv/i })).not.toBeVisible();
  });

  test('S5: scorekeeper sees ActivityLog', async ({ authenticatedPage: page }) => {
    const userUid = await getCurrentUserUid(page);
    await seedScorekeeperTournament(page, userUid);
    // Seed an audit entry
    await seedFirestoreDocAdmin(
      `tournaments/${tournamentId}/auditLog`,
      uid('audit'),
      { action: 'status_change', details: { from: 'registration', to: 'pool-play' }, actorId: uid('org'), createdAt: new Date().toISOString() },
    );
    await page.goto(`/tournaments/${tournamentId}`);

    await expect(page.getByText(/activity log/i)).toBeVisible({ timeout: 15000 });
  });

  test('S20: non-staff user sees none of the staff UI', async ({ authenticatedPage: page }) => {
    // Seed tournament without current user as staff
    const tournament = makeTournament({
      organizerId: uid('other-organizer'),
      status: 'pool-play',
      format: 'round-robin',
      staff: {},
      staffUids: [],
    });
    await seedFirestoreDocAdmin('tournaments', tournamentId + '-nostaf', tournament);
    await page.goto(`/tournaments/${tournamentId}-nostaf`);

    // Wait for page to load
    await expect(page.getByText(/pool play/i).or(page.getByText(/tournament/i))).toBeVisible({ timeout: 15000 });
    // Staff features hidden
    await expect(page.getByText(/matches to score/i)).not.toBeVisible();
    await expect(page.getByText(/^Staff$/)).not.toBeVisible();
    await expect(page.getByText(/disputes/i)).not.toBeVisible();
    await expect(page.getByText(/activity log/i)).not.toBeVisible();
  });
});
```

**Step 2: Run tests**

Run: `npx playwright test --project=emulator e2e/journeys/staff/scorekeeper.spec.ts`
Expected: All 4 tests PASS

**Step 3: Commit**

```bash
git add e2e/journeys/staff/scorekeeper.spec.ts
git commit -m "test(e2e): add staff P0 — scorekeeper permission tests"
```

---

### Task 10: Staff P0 — Moderator + Admin + End-to-end scoring

**Files:**
- Create: `e2e/journeys/staff/moderator-admin.spec.ts`

**Step 1: Write S7, S8, S12, S16 tests**

These follow the same seeding pattern as Task 9 but with moderator/admin roles and dispute/staff manager assertions. The S16 test (scorekeeper scores a pool match end-to-end) is the most complex — it navigates from dashboard to scoring page, scores 11 points, saves, and verifies the match no longer appears in the unscored list.

**Note for implementer:** Use the same `seedScorekeeperTournament` pattern from Task 9. For S7/S8, change the role to `moderator` and seed a dispute document. For S12, use `admin` role and seed 3 staff members. For S16, use the ScoringPage POM after clicking the Score button.

**Step 2: Run tests**

Run: `npx playwright test --project=emulator e2e/journeys/staff/`
Expected: All staff tests PASS

**Step 3: Commit**

```bash
git add e2e/journeys/staff/
git commit -m "test(e2e): add staff P0 — moderator, admin, end-to-end scoring"
```

---

### Task 11: Buddy P0 — Group detail + Invite join + RSVP reverse delta

**Files:**
- Create: `e2e/journeys/buddy/group-journeys.spec.ts`

**Step 1: Write tests 4, 5, 11**

```typescript
import { test, expect } from '../../fixtures';
import {
  seedFirestoreDocAdmin,
  getCurrentUserUid,
} from '../../helpers/emulator-auth';
import { makeBuddyGroup, makeGameSession, uid, shareCode } from '../../helpers/factories';

test.describe('Buddy: Group Journeys', () => {
  test('group detail shows header, members, sessions', async ({ authenticatedPage: page }) => {
    const userUid = await getCurrentUserUid(page);
    const groupId = uid('group');
    const group = makeBuddyGroup({ name: 'Tuesday Crew', description: 'Weekly pickup', defaultLocation: 'City Park' });
    await seedFirestoreDocAdmin('buddyGroups', groupId, group);
    await seedFirestoreDocAdmin(`buddyGroups/${groupId}/members`, userUid, {
      userId: userUid,
      role: 'admin',
      joinedAt: new Date().toISOString(),
    });

    await page.goto(`/buddies/${groupId}`);
    await expect(page.getByText('Tuesday Crew')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('City Park')).toBeVisible();
  });

  test('join group via invite link', async ({ authenticatedPage: page }) => {
    const groupId = uid('group');
    const code = shareCode();
    const group = makeBuddyGroup({ name: 'Open Group', shareCode: code, visibility: 'private' });
    await seedFirestoreDocAdmin('buddyGroups', groupId, group);

    await page.goto(`/g/${code}`);
    await expect(page.getByText('Open Group')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /join/i }).click();

    // Should navigate to group detail after joining
    await expect(page.getByText('Open Group')).toBeVisible({ timeout: 15000 });
  });
});
```

**Step 2: Run and commit**

Run: `npx playwright test --project=emulator e2e/journeys/buddy/group-journeys.spec.ts`

```bash
git add e2e/journeys/buddy/group-journeys.spec.ts
git commit -m "test(e2e): add buddy P0 — group detail, invite join"
```

---

### Task 12: Buddy P0 — Voting session + Open Play

**Files:**
- Create: `e2e/journeys/buddy/session-voting.spec.ts`
- Create: `e2e/journeys/buddy/open-play.spec.ts`

**Step 1: Write voting session creation + confirmation tests**

The voting session test should:
1. Create a group, navigate to session creation
2. Switch to "Find a Time" RSVP style
3. Fill 2 time slots with dates/times
4. Create session
5. Vote on a slot, verify vote count
6. As creator, confirm the slot
7. Verify session status changes to "confirmed"

**Step 2: Write Open Play functional test**

Seed an open session, navigate to `/play`, verify the session card appears with title, date, spots.

**Step 3: Run and commit**

```bash
git add e2e/journeys/buddy/
git commit -m "test(e2e): add buddy P0 — voting session workflow, open play"
```

---

### Task 13: Organizer P0 — Full lifecycle + Advance + Min-player guard

**Files:**
- Create: `e2e/journeys/organizer/lifecycle.spec.ts`

**Step 1: Write DASH-11, DASH-12, DASH-14 tests**

DASH-11 (pool-bracket full lifecycle) is the largest single test:
1. Create pool-bracket tournament
2. Advance: setup -> registration
3. Seed 4 registrations
4. Advance: registration -> pool-play
5. Verify pools display
6. Seed scored pool matches
7. Advance: pool-play -> bracket
8. Verify bracket displays
9. Seed bracket final result
10. Advance: bracket -> completed
11. Verify champion shown

DASH-12 validates the advance button works for completion.

DASH-14 seeds a tournament with 0 registrations, attempts advance, verifies it's blocked.

**Step 2: Run and commit**

```bash
git add e2e/journeys/organizer/lifecycle.spec.ts
git commit -m "test(e2e): add organizer P0 — full lifecycle, advance, min-player guard"
```

---

### Task 14: Organizer P0 — Approval queue + Max cap + Rescore + Auth guard

**Files:**
- Create: `e2e/journeys/organizer/registration-admin.spec.ts`

**Step 1: Write REG-09, REG-12, INT-03, AUTH-04 tests**

REG-09 (approval queue) requires two browser contexts:
1. Context A: organizer creates approval-mode tournament
2. Context B: player registers (pending)
3. Context A: sees pending registration, clicks Approve
4. Verify status changes to confirmed

REG-12: Seed tournament with maxPlayers=4 and 4 confirmed registrations. New player attempts join -> blocked.

INT-03: Seed scored pool match, organizer edits score via ScoreEditModal, verify standings recalculate.

AUTH-04: Authenticate as non-organizer, navigate to someone else's tournament dashboard, verify no Organizer Controls visible.

**Step 2: Run and commit**

```bash
git add e2e/journeys/organizer/registration-admin.spec.ts
git commit -m "test(e2e): add organizer P0 — approval queue, max cap, rescore, auth guard"
```

---

### Task 15: Player P0 + Cross-Cutting P0

**Files:**
- Create: `e2e/journeys/player/achievements.spec.ts`
- Create: `e2e/journeys/player/tournament-view.spec.ts`
- Create: `e2e/journeys/cross-cutting/sync.spec.ts`

**Step 1: Write PL-4, PL-10, PL-14, PL-31 tests**

PL-4: Navigate to /t/:shareCode, verify tournament info loads.
PL-10: Seed pool standings, verify all columns (team, W, L, PF, PA, Diff).
PL-14: Complete first match as authenticated user, verify AchievementToast appears.
PL-31: Cross-feature chain — score tournament match -> achievement unlocks -> notification appears.

**Step 2: Write C1, C2, C3 tests**

C1: Inject network error mock, complete match, verify retry button in settings.
C2: Score match while signed out, sign in, verify match appears in Firestore.
C3: Complete 2 matches while signed out, sign in, verify both in Firestore.

**Step 3: Run and commit**

```bash
git add e2e/journeys/player/ e2e/journeys/cross-cutting/
git commit -m "test(e2e): add player P0 + cross-cutting P0 — achievements, sync recovery"
```

---

### Task 16: Spectator P0 — Tournament phases + Scoreboard + Play-by-play + Mobile

**Files:**
- Create: `e2e/journeys/spectator/hub-phases.spec.ts`
- Create: `e2e/journeys/spectator/match-detail.spec.ts`
- Create: `e2e/journeys/spectator/mobile-viewport.spec.ts`

**Step 1: Write tests 6-9 (hub in 4 phases)**

Seed tournaments in each status (registration, pool-play, bracket, completed) with the appropriate subcollections. Navigate to /t/:code for each and verify the correct UI renders.

**Step 2: Write test 24 (scoreboard full data) and 33 (play-by-play events)**

Seed a match with score data and score events. Navigate to match detail. Verify scoreboard shows names, scores, game count. Switch to play-by-play tab and verify events render.

**Step 3: Write tests 59-60 (mobile viewport)**

```typescript
test.describe('Spectator: Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('hub renders on 375px without horizontal overflow', async ({ page }) => {
    // Seed tournament...
    await page.goto(`/t/${code}`);
    await expect(page.getByText(tournamentName)).toBeVisible({ timeout: 15000 });

    // Verify no horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
```

**Step 4: Run and commit**

```bash
git add e2e/journeys/spectator/
git commit -m "test(e2e): add spectator P0 — tournament phases, scoreboard, play-by-play, mobile"
```

---

### Task 17: P0 Verification Gate

**Files:** None (verification only)

**Step 1: Run the full P0 suite**

```bash
npx playwright test --project=emulator e2e/journeys/ --workers=4
```

Expected: All P0 journey tests PASS.

**Step 2: Run existing regression tests to confirm no breakage**

```bash
npx playwright test --project=emulator --workers=4
```

Expected: All existing + new tests PASS.

**Step 3: Run visual QA pass**

```bash
npx playwright test --project=visual-qa e2e/journeys/ --workers=2
npx playwright show-report
```

Review HTML report with screenshots.

---

### Tasks 18-28: P1 Tests (Waves 8-10)

Each P1 wave follows the same pattern: write spec file, run, commit. Grouped by persona:

**Task 18:** Casual Scorer P1 — CS-5, CS-10, CS-11, CS-12, CS-13, CS-14, CS-15, CS-17, CS-18
**Task 19:** Player P1 — PL-1 through PL-3 (smart tab), PL-5 (deep link), PL-8/PL-9 (tournament stats)
**Task 20:** Player P1 — PL-17/PL-18 (leaderboard), PL-22/PL-23 (notifications), PL-25 (sync resume)
**Task 21:** Organizer P1 — CRE-10 through CRE-13, DASH-13, DASH-15
**Task 22:** Organizer P1 — REG-10/REG-11/REG-13, POOL-04, INT-04, ADM-14 through ADM-16
**Task 23:** Staff P1 — S4, S6, S9 through S11, S13 through S15, S17
**Task 24:** Buddy P1 — RSVP transitions (29-30), day-of boundaries (38-39), share feedback (33-34)
**Task 25:** Buddy P1 — Creator controls (45-46), session fills (43-44), notifications (49), validation (46-48)
**Task 26:** Spectator P1 — Match card navigation, UP NEXT, real-time new match, FINAL badge, doubles layout
**Task 27:** Spectator P1 — Play-by-play (auto-scroll, touch pause, jump-to-live), stats tab, loading skeletons
**Task 28:** Cross-Cutting P1 — C8 (settings defaults), C10 (rapid nav), C11 (no stale data)

### Tasks 29-32: P2 Tests (Wave 11)

**Task 29:** All P2 casual scorer + player tests
**Task 30:** All P2 organizer + staff tests
**Task 31:** All P2 buddy + spectator tests
**Task 32:** All P2 cross-cutting tests

---

### Task 33: Final Verification + Screenshot Capture

**Step 1: Run full suite**

```bash
npx playwright test --project=emulator --workers=4
```

Expected: ALL tests pass (existing + new).

**Step 2: Run visual QA with all screenshots**

```bash
npx playwright test --project=visual-qa --workers=2
npx playwright show-report
```

Review all ~60-70 screenshots in HTML report.

**Step 3: Final commit**

```bash
git commit --allow-empty -m "chore: pre-launch E2E validation suite complete — all personas validated"
```

---

## Execution Notes

- **Each task is independent within its wave** — can be parallelized with subagents
- **P0 tasks (1-17) are the pre-launch gate** — must all pass before go-live
- **Page object methods may need adjustment** based on actual DOM structure — check selectors against real rendered HTML
- **Factory seeding** may need field adjustments — verify required fields match Firestore security rules
- **Two-context tests** (REG-09 approval queue) use `browser.newContext()` for second user
- **Always run tests in a subagent** to keep main context clean
