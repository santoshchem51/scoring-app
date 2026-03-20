# P2 / Cosmetic / Test Gap Fixes — Design

> **Date:** 2026-03-20
> **Branch:** `feature/pre-launch-e2e-validation`
> **Scope:** 21 items (7 P2 + 7 cosmetic + 7 test coverage gaps)
> **Reviewed by:** 4 specialist agents (SolidJS/CSS, codebase fit, E2E testing, UX/a11y)

---

## P2 Fixes (7 items)

### P2-1: Pool standings table at 375px

**File:** `src/features/tournaments/components/PoolTable.tsx:22-51`

- Reduce Team column padding `px-4` → `px-2`, add `max-w-[8rem] truncate` for long names
- Add `tabular-nums` on all numeric cells for tighter alignment
- Narrow `#` column to `w-6 px-1`
- Keep all stat columns (W, L, PF, PA, +/-) — don't remove data

### P2-2: "Advance to Completed" button wraps

**File:** `TournamentDashboardPage.tsx:784-788`, `constants.ts`

- Create `shortStatusLabels` map for button context: `{ 'pool-play': 'Pools', bracket: 'Bracket', completed: 'Complete' }`
- Render as "Complete Tournament" / "Start Pools" etc. instead of "Advance to Completed"
- Add `whitespace-nowrap` + `min-w-0 overflow-hidden text-ellipsis` as safety net

### P2-3: Completed tournament shows "Matches to Score"

**File:** `TournamentDashboardPage.tsx:875-883`

- Status check must wrap BOTH branches (scorekeeper role OR hasMinRole):
  ```tsx
  <Show when={live.tournament()?.status !== 'completed' &&
              live.tournament()?.status !== 'cancelled' &&
              (role() === 'scorekeeper' || ...)}>
  ```

### P2-4: Bracket cramped at 375px

**File:** `src/features/tournaments/components/BracketView.tsx:39-56`

- Keep `w-48` (192px minimum for team name + score)
- Reduce `gap-6` → `gap-4`
- Add scroll-hint fade gradient on right edge of `overflow-x-auto` wrapper
- Add `role="region"` + `aria-label="Tournament bracket"` + `tabindex="0"` for a11y

### P2-5: Profile "Doubles 0.1" display

**File:** `src/features/profile/components/StatsOverview.tsx:28-34`

- Root cause: "0-1" looks like "0.1" at `text-xs` size (hyphen ≈ decimal point)
- Change format to `{wins}W – {losses}L` (en-dash separator with W/L labels)
- Zero-state: if `matches === 0`, show "—" instead of "0W – 0L"

### P2-6: Session title/date mismatch

**File:** `e2e/journeys/visual-qa/social-visual.spec.ts:143-150`, seeder factories

- Compute next Saturday: `nextSat.setDate(nextSat.getDate() + ((6 - nextSat.getDay() + 7) % 7 || 7))`
- Use as `scheduledDate` in the "Saturday Morning Play" seeder

### P2-7: "Who's Playing" heading misleading

**Files:** `SessionDetailPage.tsx:560-563`, `PublicSessionPage.tsx:258-259`

- Keep "Who's Playing" — natural language for casual pickleball audience
- Fix count: change `({rsvps().length})` to `({confirmedCount()} of {rsvps().length})`

---

## Cosmetic Fixes (7 items)

### C-1: Confetti overlapping UI text

**File:** `src/shared/hooks/useCelebration.ts:33-39, 85-87`

- Add `zIndex: 30` to all three `confetti()` calls (game win line 33, both match win calls at 85 and 87)
- canvas-confetti defaults to z-index 100; noise texture overlay is z-index 9999
- Belt-and-suspenders: ensure confetti canvas has `pointer-events: none`

### C-2: "Undo Last" clipped at viewport bottom

**File:** `src/features/scoring/components/ScoreControls.tsx:68-77`

- Use `pb-[calc(env(safe-area-inset-bottom,0px)+64px)]` instead of blunt `pb-20`
- BottomNav IS shown on scoring pages (confirmed: `showBottomNav = pathname !== '/'`)

### C-3: Status badge contrast audit

**File:** `src/features/tournaments/constants.ts:11-19`

- Audit every badge color against background in all 9 theme/mode combinations (3 themes × 3 modes)
- WCAG targets: 4.5:1 for normal text, 3:1 for UI components
- Outdoor mode highest risk — warm high-brightness backgrounds
- Adjust specific theme/mode variants that fail, not the global map
- Add documentation comment explaining color rationale

### C-4: Share button layout stability

**File:** `TournamentDashboardPage.tsx:773-790`

- When Advance button is hidden (completed phase), preserve its space to prevent Share button shift
- Use `visibility: hidden` or same-size placeholder instead of conditional unmounting
- Prevents mis-taps from layout shifts (WCAG 3.2.2)

### C-5: Share modal localhost URL

**Files:** `ShareTournamentModal.tsx:25-27`, `SessionDetailPage.tsx:445-456`

- Add `VITE_PUBLIC_URL` env var
- `const baseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin`
- Fallback is correct for both dev (localhost) and production (real domain)

### C-6: Outdoor theme dark margin bands

**Files:** `src/styles.css`, `index.html`

- Add `body { background-color: var(--color-surface); }` to styles.css
- Add inline `style="background-color: #0f1118"` to `<body>` in index.html (prevents flash-of-white)
- CSS variable is reactive — theme hook updates cascade automatically

### C-7: Empty profile shows raw email

**File:** `src/features/profile/components/ProfileHeader.tsx:56-63`

- When `displayName` is empty: show email as primary identifier, add tappable "Set your display name" link → `/settings`
- When `displayName` exists: show name as primary, email as secondary (current behavior)
- Add `aria-label="Set your display name"` for screen readers

---

## Test Coverage Gaps (7 items)

### TG-1: Score Edit Modal never opens

**File:** `e2e/journeys/visual-qa/tournament-visual.spec.ts:337-371`

- Root cause: `handleEditPoolMatch` reads from Dexie (IndexedDB), not Firestore. Seeder only writes Firestore.
- Fix: After seeding tournament + navigating, inject completed match into Dexie via `page.evaluate()` with `games` array
- Remove skip/fallback path — test must deterministically open ScoreEditModal

### TG-2: iOS install sheet not rendering

**File:** `e2e/journeys/visual-qa/chrome-visual.spec.ts:200-230`

- `addInitScript` UA override is correct approach for `detectIOSSafari()`
- Also override `navigator.standalone` → `false`
- Change selector to `getByText('Tap the share button')` (actual component text)
- Verify `InstallPromptBanner` is mounted on target page

### TG-3: Loading spinner captures error state

**File:** `e2e/journeys/visual-qa/scoring-visual.spec.ts:322-336`

- Root cause: Dexie resolves near-instantly, `page.route()` can't intercept IndexedDB
- Fix: `addInitScript` to monkey-patch `IDBObjectStore.prototype.get` with 3s delay for `matches` table
- Navigate with `waitUntil: 'commit'`, assert `getByText('Loading match...')` visible
- Fallback: if IDB interception proves too brittle, annotate as low-value (plain text, not rich skeleton)

### TG-4: Buddy action sheet triggers wrong overlay

**File:** `e2e/journeys/visual-qa/social-visual.spec.ts:231-262`

- Root cause: BuddyActionSheet is on GameSetupPage (`/new`), not GroupDetailPage
- Fix: Navigate to `/new`, seed group with second member, expand buddy picker, click member avatar
- Need helper to add second member to seeder

### TG-5: Share sheet doesn't trigger overlay

**File:** `e2e/journeys/visual-qa/social-visual.spec.ts:264-287`

- Root cause: No share sheet overlay exists — it's clipboard copy with "Copied!" feedback
- Fix: Use `page.locator('button[title="Copy share link"]')`, assert `getByText('Copied!')`
- Rename screenshot to `share-link-copied`
- Add `aria-label="Copy share link"` to the button in source for a11y + testability

### TG-6: Buddies list seeder not propagating

**File:** `e2e/journeys/visual-qa/social-visual.spec.ts:27-61`, `e2e/helpers/seeders.ts:442-465`

- Root cause: Member doc missing `userId` field. `useBuddyGroups` queries `where('userId', '==', uid)` but seeder doesn't set it.
- Fix: Add `userId: userUid` to member doc in `seedBuddyGroupWithMember`
- Replace `waitForTimeout(2000)` with `expect(page.getByText('Pickle Pals')).toBeVisible({ timeout: 15000 })`

### TG-7: Open play browse vs empty identical

**File:** `e2e/journeys/visual-qa/social-visual.spec.ts:197-229`, `e2e/helpers/seeders.ts:474-513`

- Root cause: Seeder may not set `scheduledDate` or `spotsConfirmed` for query/display
- Fix: Ensure seeder sets `scheduledDate: Date.now() + 86400000` and `spotsConfirmed: 2`
- Replace `waitForTimeout(2000)` with `expect(page.getByText('Community Play')).toBeVisible({ timeout: 15000 })`

---

## Validation Strategy

Each fix gets **3-layer verification:**

1. **Targeted test** — run the specific visual QA test that caught the issue, capture before/after
2. **Unit regression** — `npx vitest run` to confirm no regressions
3. **Full visual QA sweep** — at the end, run complete suite (visual-qa + visual-qa-desktop + visual-qa-videos)

For test gap fixes: verification means the test produces a screenshot showing the **intended UI state** — not a skip annotation, not an error state, not a duplicate of another test.
