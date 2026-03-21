# Visual QA P0+P1 Fixes — Design

> **Date:** 2026-03-20
> **Branch:** `feature/pre-launch-e2e-validation`
> **Findings doc:** `docs/plans/2026-03-20-visual-qa-findings.md`

---

## Scope

Fix the 3 P0 and 6 P1 issues identified during visual QA review. After investigation, 2 P1 issues are reclassified (not bugs), leaving 7 actual fixes.

## Fixes

### P0-1 & P0-2: Landscape betweenGames and matchOver states

**File:** `src/features/scoring/ScoringPage.tsx` (lines 445-493)

**Problem:** The `serving` state has a landscape-optimized layout (fixed overlay, side-by-side scoreboard + controls). The `betweenGames` and `matchOver` states have no landscape variant — they stack vertically below the scoreboard, pushing "Start Next Game" and "Save & Finish" buttons off-screen.

**Fix:** Wrap both states in `isLandscape()` checks using the same pattern as the existing `serving` landscape code (lines 384-442):

- `fixed inset-0 z-40 flex` container
- Left `flex-1`: compact scoreboard with game/match info
- Right `flex-1`: completion actions (title, score summary, CTA buttons)
- Both sides vertically centered with `justify-center`

### P0-3: Spectator scoreboard missing second team

**File:** Parent of `SpectatorScoreboard.tsx` — likely `PublicMatchPage` or `LiveScoreCard`

**Problem:** `SpectatorScoreboard` renders both teams correctly (lines 139-197). The bug is in the data layer — the parent doesn't pass team2 data. Likely the spectator projection or `lastSnapshot` is missing team2 fields.

**Fix:** Investigate `PublicMatchPage` to find where team2 data is dropped. Fix the data binding so both team names and scores are passed to `SpectatorScoreboard`.

### P1-1: Notification panel empty message bodies (test data bug)

**File:** `e2e/helpers/seeders.ts` (line 787), `e2e/helpers/factories.ts` (line 291)

**Problem:** The `seedNotifications()` seeder creates notifications with `title`/`body` fields, but `NotificationRow` renders `props.notification.message`. The `AppNotification` type has `message: string` — no `body` field. Seeded data never sets `message`, so notifications render with empty text.

**Fix:** Update `makeNotification()` factory and `seedNotifications()` to set `message` field instead of `body`.

### P1-2: PWA install banner duplicate action row (test setup bug)

**File:** `e2e/journeys/visual-qa/chrome-visual.spec.ts` and/or `src/shared/pwa/InstallPromptBanner.tsx`

**Problem:** The Chrome install banner (lines 20-58) and iOS instructions (lines 62-68) can render simultaneously when both `showInstallBanner()` and `iosInstallSupported()` are true. The test mocks both conditions, creating the appearance of duplicate action rows.

**Fix:** Add mutual exclusion — the iOS section should check `!showInstallBanner()` so only one banner type renders at a time. This is a real code fix (not just test), since on a real iOS device with Chrome, both could theoretically render.

### P1-3: Pool-play hub content clipping by bottom nav

**File:** `src/features/tournaments/TournamentDashboardPage.tsx` (line 744)

**Problem:** The inner content div uses `p-4 space-y-6` without bottom padding. `PageLayout` provides `pb-24` on the main scroll container, but the last match row in the pool schedule sits right at the boundary and gets clipped by the fixed bottom nav.

**Fix:** Add `pb-20` to the inner content div: `p-4 pb-20 space-y-6`. This gives extra clearance beyond what PageLayout provides.

### P1-6: Game setup form overflow at 375px

**File:** `src/features/scoring/GameSetupPage.tsx` (line 221)

**Problem:** `grid grid-cols-3 gap-3` for "Points to Win" pills doesn't scale well at 375px. With `p-4` padding (32px removed), only 343px available for 3 columns + 2 gaps (24px) = 106px per pill — functional but the overall form overflows when combined with other elements.

**Fix:** Reduce gap from `gap-3` to `gap-2` for the points-to-win grid, and verify the form doesn't overflow at 375px.

## Reclassified (not bugs)

### P1-4: Save Template modal backdrop → False positive

The modal has `bg-black/50` backdrop (line 35 of SaveTemplateModal.tsx). 50% opacity showing background content slightly is standard modal behavior, not a bug. No fix needed.

### P1-5: Bottom nav Buddies tab missing → Correct behavior

The 5th tab (Buddies) is conditional on `user()` (line 68 of BottomNav.tsx). When not authenticated, it correctly doesn't show. The visual-qa tests showing 4 tabs were testing unauthenticated views. No fix needed.

## Testing Plan

No new test files. The existing visual-qa suite (142 tests) is the verification:

1. `npx vitest run` — 1,652 unit tests still pass (no regressions)
2. `npx playwright test --project=visual-qa --project=visual-qa-desktop --workers=1` — full visual-qa passes
3. Open Playwright report and visually confirm previously-broken screens now render correctly

The visual-qa screenshots that originally caught these bugs serve as the verification. Screenshot captures will show:
- P0-1/2: Buttons visible in landscape captures
- P0-3: Both teams visible in spectator scoreboard
- P1-1: Notification text visible in panel
- P1-2: Single install banner (not doubled)
- P1-3: Last pool match not clipped
- P1-6: Game setup form fits at 375px
