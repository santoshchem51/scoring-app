# Visual QA P0+P1 Fixes — Implementation Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 7 visual QA issues (3 P0, 4 P1) identified during pre-launch screenshot review.

**Architecture:** Pure UI/CSS fixes and test data corrections. No new components, no data model changes. Landscape fixes follow the existing pattern in ScoringPage.tsx. Test data fixes correct field name mismatches in E2E seeders.

**Tech Stack:** SolidJS, Tailwind CSS, Playwright E2E, Firebase emulators

---

## Specialist Review Fixes Applied (v2)

From 4 specialist reviews (SolidJS/CSS, Codebase Fit, E2E Testing, Security):

1. **BLOCKER:** `makeNotification` factory now includes all required `AppNotification` fields (`userId`, `category`, `payload`, `expiresAt`)
2. **BLOCKER:** Added `achievements.spec.ts:1047` inline `body` → `message` fix to Task 4
3. **BLOCKER:** Task 3 now uses deterministic `toBeVisible()` assertions instead of headed-mode observation
4. **BLOCKER:** Task 4 now includes assertion that notification message text renders
5. **WARNING fixed:** Removed `classList` serving-team from betweenGames overlay (semantically meaningless)
6. **WARNING fixed:** Extracted `handleShare` function in Task 2 to avoid 7-line duplication
7. **WARNING fixed:** Task 7 now adds `min-w-0` to OptionCard children as overflow safety net
8. **WARNING fixed:** Added targeted `--grep` smoke checks per task instead of full suite
9. **WARNING accepted:** DRY landscape overlay duplication — file follow-up task after merge, don't block this PR
10. **WARNING accepted:** Task 6 double padding (~176px) follows existing `GameSetupPage` convention

---

## Task 1: Landscape layout for betweenGames state

**Files:**
- Modify: `src/features/scoring/ScoringPage.tsx:445-459`

**Step 1: Add landscape variant for betweenGames**

Replace the `betweenGames` Match block (lines 445-459) with a landscape-aware version. Follow the same pattern as the existing `serving` landscape layout (lines 384-442). Note: no `classList` for serving-team (semantically meaningless in betweenGames — review fix #5).

```tsx
<Match when={stateName() === 'betweenGames'}>
  <Show
    when={isLandscape()}
    fallback={
      <div class="flex flex-col items-center gap-4 px-4">
        <p class="text-2xl font-bold text-score">Game Complete!</p>
        <p class="text-on-surface-muted">
          Games: {ctx().gamesWon[0]} - {ctx().gamesWon[1]}
        </p>
        <button
          type="button"
          onClick={() => startNextGame()}
          class="w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
        >
          Start Next Game
        </button>
      </div>
    }
  >
    <div
      class="fixed inset-0 bg-surface z-40 flex ambient-bg"
      style={{
        "--team1-color-rgb": hexToRgb(t1Color()),
        "--team2-color-rgb": hexToRgb(t2Color()),
      } as import('solid-js').JSX.CSSProperties}
    >
      {/* Left side: Scoreboard */}
      <div class="flex-1 flex flex-col justify-center">
        <div class="flex items-center justify-center gap-4 px-4 mb-4">
          <span class="text-sm text-on-surface-muted">
            Game {ctx().gameNumber}
          </span>
          <span class="text-xs text-on-surface-muted px-2 py-1 bg-surface-light rounded-full">
            {ctx().gamesWon[0]} - {ctx().gamesWon[1]}
          </span>
        </div>
        <Scoreboard
          team1Name={props.match.team1Name}
          team2Name={props.match.team2Name}
          team1Score={ctx().team1Score}
          team2Score={ctx().team2Score}
          servingTeam={ctx().servingTeam}
          serverNumber={ctx().serverNumber}
          scoringMode={props.match.config.scoringMode}
          gameType={props.match.config.gameType}
          pointsToWin={props.match.config.pointsToWin}
          team1Color={props.match.team1Color}
          team2Color={props.match.team2Color}
        />
      </div>
      {/* Right side: Game complete actions */}
      <div class="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <p class="text-2xl font-bold text-score">Game Complete!</p>
        <p class="text-on-surface-muted">
          Games: {ctx().gamesWon[0]} - {ctx().gamesWon[1]}
        </p>
        <button
          type="button"
          onClick={() => startNextGame()}
          class="w-full max-w-xs bg-primary text-surface font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
        >
          Start Next Game
        </button>
      </div>
    </div>
  </Show>
</Match>
```

**Step 2: Run unit tests**

Run: `npx vitest run`
Expected: All 1,652 tests pass (no regressions — this is a template change only)

**Step 3: Smoke check landscape**

```bash
npx playwright test --project=visual-qa "scoring-visual" --grep "10.*between-games" --workers=1
```

Expected: 2 tests pass (dark + outdoor). Open report to verify "Start Next Game" button is visible in landscape screenshot.

**Step 4: Commit**

```bash
git add src/features/scoring/ScoringPage.tsx
git commit -m "fix: add landscape layout for betweenGames state"
```

---

## Task 2: Landscape layout for matchOver state + extract handleShare

**Files:**
- Modify: `src/features/scoring/ScoringPage.tsx:461-493`

**Step 1: Extract handleShare function**

Add this function inside `ScoringView`, before the `return` statement (around line 285), to avoid duplicating 7 lines of share logic between portrait and landscape (review fix #6):

```tsx
const handleShare = async () => {
  const freshMatch = await matchRepository.getById(props.match.id);
  if (!freshMatch) return;
  const completedMatch = { ...freshMatch, team1Color: props.match.team1Color, team2Color: props.match.team2Color };
  const result = await shareScoreCard(completedMatch);
  setShareStatus(result === 'shared' ? 'Shared!' : result === 'copied' ? 'Copied to clipboard!' : result === 'downloaded' ? 'Downloaded!' : 'Share failed');
  setTimeout(() => setShareStatus(null), 2000);
};
```

**Step 2: Replace matchOver with landscape-aware version**

Replace the `matchOver` Match block (lines 461-493) using `handleShare`:

```tsx
<Match when={stateName() === 'matchOver'}>
  <Show
    when={isLandscape()}
    fallback={
      <div class="flex flex-col items-center gap-4 px-4">
        <p class="text-2xl font-bold text-score">Match Over!</p>
        <p class="text-lg text-on-surface">
          {winnerName()} wins!
        </p>
        <p class="text-on-surface-muted">
          Final: {ctx().gamesWon[0]} - {ctx().gamesWon[1]}
        </p>
        <button
          type="button"
          onClick={saveAndFinish}
          class="w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
        >
          Save & Finish
        </button>
        <button
          type="button"
          onClick={handleShare}
          class="w-full bg-surface-lighter text-on-surface font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <Share2 size={20} aria-hidden="true" />
          {shareStatus() ?? 'Share Score Card'}
        </button>
      </div>
    }
  >
    <div
      class="fixed inset-0 bg-surface z-40 flex ambient-bg"
      style={{
        "--team1-color-rgb": hexToRgb(t1Color()),
        "--team2-color-rgb": hexToRgb(t2Color()),
      } as import('solid-js').JSX.CSSProperties}
    >
      {/* Left side: Scoreboard */}
      <div class="flex-1 flex flex-col justify-center">
        <Scoreboard
          team1Name={props.match.team1Name}
          team2Name={props.match.team2Name}
          team1Score={ctx().team1Score}
          team2Score={ctx().team2Score}
          servingTeam={ctx().servingTeam}
          serverNumber={ctx().serverNumber}
          scoringMode={props.match.config.scoringMode}
          gameType={props.match.config.gameType}
          pointsToWin={props.match.config.pointsToWin}
          team1Color={props.match.team1Color}
          team2Color={props.match.team2Color}
        />
      </div>
      {/* Right side: Match over actions */}
      <div class="flex-1 flex flex-col items-center justify-center gap-4 px-6">
        <p class="text-2xl font-bold text-score">Match Over!</p>
        <p class="text-lg text-on-surface">
          {winnerName()} wins!
        </p>
        <p class="text-on-surface-muted">
          Final: {ctx().gamesWon[0]} - {ctx().gamesWon[1]}
        </p>
        <button
          type="button"
          onClick={saveAndFinish}
          class="w-full max-w-xs bg-primary text-surface font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
        >
          Save & Finish
        </button>
        <button
          type="button"
          onClick={handleShare}
          class="w-full max-w-xs bg-surface-lighter text-on-surface font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <Share2 size={20} aria-hidden="true" />
          {shareStatus() ?? 'Share Score Card'}
        </button>
      </div>
    </div>
  </Show>
</Match>
```

**Step 3: Run unit tests**

Run: `npx vitest run`
Expected: All 1,652 tests pass

**Step 4: Smoke check landscape**

```bash
npx playwright test --project=visual-qa "scoring-visual" --grep "11.*match-over" --workers=1
```

Expected: 2 tests pass. Verify "Save & Finish" button visible in landscape screenshot.

**Step 5: Commit**

```bash
git add src/features/scoring/ScoringPage.tsx
git commit -m "fix: add landscape layout for matchOver state, extract handleShare"
```

---

## Task 3: Fix spectator scoreboard visibility (P0-3)

**Files:**
- Modify: `e2e/journeys/visual-qa/chrome-visual.spec.ts:354-371`
- Possibly modify: `src/features/tournaments/PublicMatchPage.tsx` (if data binding issue found)

**Step 1: Add deterministic assertion to spectator test**

In `chrome-visual.spec.ts`, for test 14 (lines 354-371), replace the `waitForTimeout(3000)` with explicit visibility assertions (review fix #3):

After `await page.goto(...)`, change:
```typescript
await page.waitForTimeout(3000);
```
to:
```typescript
await expect(page.getByText('Sarah M.')).toBeVisible({ timeout: 10000 });
await expect(page.getByText('Mike T.')).toBeVisible({ timeout: 10000 });
```

Do the same for tests 15 (line 387), 16 (line 414), and 17 (line ~430) — replace `waitForTimeout(3000)` with assertions for both team names.

**Step 2: Run the specific test**

```bash
npx playwright test --project=visual-qa-desktop "chrome-visual" --grep "14.*live scoreboard.*dark" --workers=1
```

If it **passes**: the data loads correctly, both teams render — the original issue was a timing problem (screenshot taken before data loaded). The assertion fix prevents this permanently.

If it **fails with timeout**: there's a real data binding issue. Investigate `PublicMatchPage.tsx` line 120 for missing `team2Name`/`team2Score` props. Check `useSpectatorProjection` and `extractLiveScore` for data gaps.

**Step 3: Commit**

```bash
git add e2e/journeys/visual-qa/chrome-visual.spec.ts
git commit -m "fix: add deterministic team visibility assertions to spectator tests"
```

---

## Task 4: Fix notification seeder (P1-1)

**Files:**
- Modify: `e2e/helpers/factories.ts:291-302`
- Modify: `e2e/helpers/seeders.ts:778-782`
- Modify: `e2e/journeys/player/achievements.spec.ts:1047` (inline seeder)

**Step 1: Fix makeNotification factory with all required fields**

In `e2e/helpers/factories.ts`, replace the `makeNotification` function (review fix #1 — add all `AppNotification` required fields):

```typescript
export function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: uid('notif'),
    userId: 'test-user',
    category: 'tournament',
    type: 'tournament_update',
    message: 'Pool play has started.',
    payload: {},
    read: false,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}
```

**Step 2: Fix seedNotifications type data**

In `e2e/helpers/seeders.ts`, change `body` to `message` in the types array (lines 778-782):

```typescript
const types = [
  { type: 'tournament_update', category: 'tournament', message: 'Your tournament has begun.' },
  { type: 'buddy_invite', category: 'buddy', message: 'Alex invited you to Pickle Pals.' },
  { type: 'match_result', category: 'tournament', message: 'You won 11-7!' },
  { type: 'achievement', category: 'tournament', message: 'You earned First Match!' },
];
```

**Step 3: Fix inline seeder in achievements.spec.ts**

In `e2e/journeys/player/achievements.spec.ts` around line 1047, change `body` to `message` (review fix #2):

Find: `body: 'Test notification body ${i + 1}'` (or similar)
Replace with: `message: 'Test notification body ${i + 1}'`

**Step 4: Add assertion to notification visual-qa test**

In `e2e/journeys/visual-qa/chrome-visual.spec.ts`, in test 6 (notification panel, around line 163), add an assertion after clicking the bell and waiting (review fix #4):

```typescript
await expect(page.getByText('Your tournament has begun.')).toBeVisible({ timeout: 5000 });
```

**Step 5: Smoke check notification test**

```bash
npx playwright test --project=visual-qa "chrome-visual" --grep "6.*notification.*with" --workers=1
```

Expected: Pass. Open report to verify notification messages are visible.

**Step 6: Commit**

```bash
git add e2e/helpers/factories.ts e2e/helpers/seeders.ts e2e/journeys/player/achievements.spec.ts e2e/journeys/visual-qa/chrome-visual.spec.ts
git commit -m "fix: complete notification seeder with all AppNotification fields, body→message"
```

---

## Task 5: Fix PWA install banner mutual exclusion (P1-2)

**Files:**
- Modify: `src/shared/pwa/InstallPromptBanner.tsx:62`

**Step 1: Add mutual exclusion guard**

In `InstallPromptBanner.tsx`, change line 62 from:

```tsx
<Show when={!isInstalled() && iosInstallSupported()}>
```

to:

```tsx
<Show when={!isInstalled() && iosInstallSupported() && !showInstallBanner()}>
```

This is a defensive guard. In production, `showInstallBanner()` and `iosInstallSupported()` are mutually exclusive by browser platform. But in test environments (or future hybrid browsers), this prevents both from rendering simultaneously.

**Step 2: Run unit tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/shared/pwa/InstallPromptBanner.tsx
git commit -m "fix: prevent iOS and Chrome install banners from rendering simultaneously"
```

---

## Task 6: Fix pool-play hub bottom nav clipping (P1-3)

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx:744`

**Step 1: Add bottom padding**

Change line 744 from:

```tsx
<div class="p-4 space-y-6">
```

to:

```tsx
<div class="p-4 pb-20 space-y-6">
```

Note: `PageLayout` already has `pb-24` on the `<main>` scroll container. Adding `pb-20` to the inner div follows the existing convention in `GameSetupPage` (`p-4 pb-24`). The total scroll-bottom space is generous but consistent with codebase patterns.

**Step 2: Smoke check**

```bash
npx playwright test --project=visual-qa "tournament-visual" --grep "4.*pool-play" --workers=1
```

Expected: 2 tests pass. Verify last match row not clipped in screenshot.

**Step 3: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "fix: add bottom padding to tournament dashboard to clear fixed nav"
```

---

## Task 7: Fix game setup form overflow at 375px (P1-6)

**Files:**
- Modify: `src/features/scoring/GameSetupPage.tsx:221,231`

**Step 1: Reduce grid gap and add overflow safety**

Change both `grid grid-cols-3 gap-3` instances (lines 221 and 231) to `grid grid-cols-3 gap-2`. Also add `min-w-0` to each grid container to prevent intrinsic min-width overflow (review fix #7):

Line 221:
```tsx
<div class="grid grid-cols-3 gap-2 min-w-0">
```

Line 231:
```tsx
<div class="grid grid-cols-3 gap-2 min-w-0">
```

The gap reduction saves 8px total per row. `min-w-0` allows grid children to shrink below their content's intrinsic min-width, preventing overflow at 375px.

**Step 2: Smoke check at 375px**

```bash
npx playwright test --project=visual-qa "scoring-visual" --grep "14.*full form" --workers=1
```

Expected: 2 tests pass. Verify form fits without overflow at 375px.

**Step 3: Commit**

```bash
git add src/features/scoring/GameSetupPage.tsx
git commit -m "fix: reduce game setup option grid gap and add min-w-0 for 375px viewport"
```

---

## Task 8: Update findings doc and run full verification

**Files:**
- Modify: `docs/plans/2026-03-20-visual-qa-findings.md`

**Step 1: Update findings doc**

Add a "Resolution" line to each fixed issue and reclassify P1-4/P1-5:
- P0-1/2: "Fixed — landscape layout added for betweenGames and matchOver states"
- P0-3: "Fixed — deterministic visibility assertions replace brittle timeouts"
- P1-1: "Fixed — notification seeder uses correct `message` field with all required AppNotification fields"
- P1-2: "Fixed — mutual exclusion guard prevents dual install banners"
- P1-3: "Fixed — added pb-20 bottom padding to tournament dashboard"
- P1-4: "Reclassified — 50% opacity backdrop is standard modal behavior, not a bug"
- P1-5: "Reclassified — Buddies tab correctly hidden for unauthenticated users"
- P1-6: "Fixed — reduced grid gap + min-w-0 overflow safety"

**Step 2: Run full unit test suite**

Run: `npx vitest run`
Expected: All 1,652 tests pass

**Step 3: Run full visual-qa suite**

Ensure Firebase emulators and Vite dev server are running, then:

```bash
npx playwright test --project=visual-qa --project=visual-qa-desktop --workers=1
```

Expected: 140+ tests pass. Open the Playwright report and visually verify:
- Landscape screenshots show buttons visible (Tasks 1-2)
- Spectator scoreboard shows both teams (Task 3)
- Notification panel shows message text (Task 4)
- Only one install banner renders (Task 5)
- Pool-play hub last match not clipped (Task 6)
- Game setup form fits at 375px (Task 7)

**Step 4: Commit findings update**

```bash
git add docs/plans/2026-03-20-visual-qa-findings.md
git commit -m "docs: update findings with resolutions and reclassifications"
```

---

## Follow-up (after merge)

- **DRY refactor:** Extract shared `LandscapeOverlay` wrapper from the 3 landscape overlays in ScoringPage.tsx to eliminate ~60 lines of duplication. Separate PR.
