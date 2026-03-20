# Visual QA Findings — Pre-Launch Review

> **Date:** 2026-03-20
> **Branch:** `feature/pre-launch-e2e-validation`
> **Suite:** 142 visual-qa tests (136 passed, 4 failed timeout, 2 skipped)
> **Reviewed by:** 4 parallel specialist agents examining all screenshot attachments in the Playwright HTML report

---

## Summary

| Severity | Count | Action |
|----------|-------|--------|
| P0 — Critical | 3 | Fix before launch |
| P1 — Major | 6 | Should fix before launch |
| P2 — Minor | 7 | Fix post-launch ok |
| Cosmetic | 7 | Low priority |
| Test coverage gaps | 7 | Fix tests to get actual coverage |

---

## P0 — Critical (fix before launch)

### P0-1: Landscape — scoring buttons completely below fold

- **Source:** `scoring-visual.spec.ts` tests 1, 10, 11 (landscape captures)
- **What:** In landscape orientation (851×393), the +1 TEAM 1, +1 TEAM 2, SIDE OUT, and Undo Last buttons are entirely hidden below the viewport. Only the scoreboard display and bottom nav are visible. The app is effectively unusable for scoring in landscape without scrolling.
- **Impact:** Users holding phones horizontally cannot score points.
- **Recommendation:** Landscape-optimized layout — place scoring buttons side-by-side with the scoreboard, or make the scoreboard more compact to fit buttons in viewport.
- **Resolution:** Fixed — landscape layout added for betweenGames and matchOver states (commits `020e73b`, `26e4d69`)

### P0-2: Landscape — game-over and between-games actions hidden

- **Source:** `scoring-visual.spec.ts` tests 10, 11 (landscape captures)
- **What:** The "Game Complete!" / "Start Next Game" overlay and "Match Over!" / "Save & Finish" content are entirely below the fold in landscape mode. Users see the scoreboard and confetti but cannot see or interact with completion actions without scrolling.
- **Impact:** Users may be stuck not knowing what to do after a game ends in landscape.
- **Note:** This is the same root cause as P0-1 — landscape viewport height is insufficient for stacked layout.
- **Resolution:** Fixed — same commits as P0-1

### P0-3: Spectator scoreboard missing second team

- **Source:** `chrome-visual.spec.ts` — Spectator views (play-by-play tab)
- **What:** The spectator match scoreboard card only displays one team name and score. The second team is completely absent from the visible scoreboard area. The card also has excessive blank white space above the "LIVE" badge, suggesting a layout/rendering issue.
- **Impact:** Spectators cannot see both teams' scores, defeating the purpose of the live scoreboard view.
- **Resolution:** Fixed — replaced brittle `waitForTimeout(3000)` with deterministic `toBeVisible()` assertions for both team names. Root cause was timing: screenshot captured before Firestore data loaded (commit `d8276d3`)

---

## P1 — Major (should fix before launch)

### P1-1: Notification panel — empty message bodies

- **Source:** `chrome-visual.spec.ts` — Dialogs and overlays (test 6)
- **What:** The notification panel shows 4 notifications with timestamps ("just now", "1h ago", "2h ago", "3h ago") but the actual notification message text appears missing or invisible. Only timestamps are visible.
- **Impact:** Users cannot read what the notifications say — panel is functionally useless.
- **Resolution:** Fixed — test data bug: seeder used `body` field but `NotificationRow` reads `message`. Fixed factory with all `AppNotification` required fields + added visibility assertion (commit `06f73af`)

### P1-2: PWA install banner — duplicate action row

- **Source:** `chrome-visual.spec.ts` — PWA states (test 9)
- **What:** The PWA install prompt banner shows two identical rows of "Not now / Don't ask again" actions below the "Install PickleScore" card.
- **Impact:** Confusing UX with redundant dismissal options.
- **Resolution:** Fixed — added `!showInstallBanner()` guard to iOS section to prevent both rendering simultaneously (commit `aa9f481`)

### P1-3: Bottom nav clipping content on pool-play hub

- **Source:** `tournament-visual.spec.ts` — test "4 pool-play phase — court-vision-gold dark"
- **What:** The bottom navigation bar partially obscures the last match entry ("Bravo vs Charlie / Pool A R4"). The "Score" button for that row is cut off by the nav bar. No visual indicator that more content exists below the fold.
- **Impact:** Organizers may miss the last match in the list. Needs scroll padding or `padding-bottom` equal to nav bar height.
- **Resolution:** Fixed — added `pb-20` bottom padding to tournament dashboard inner div (commit `69af0ba`)

### P1-4: Save Template modal missing proper backdrop

- **Source:** `tournament-visual.spec.ts` — test "14 save template modal — gold dark"
- **What:** The Save as Template modal renders with visible page content bleeding through behind/around it. The modal overlay/backdrop does not fully cover the background — "Add Player" area, "Join Tournament" button, and "Matches to Score" section are visible behind the modal.
- **Impact:** Visually noisy and potentially confusing. Modal should have a full-screen scrim.
- **Resolution:** Reclassified — 50% opacity backdrop (`bg-black/50`) is standard modal behavior, not a bug. The modal correctly has `fixed inset-0 z-50` with backdrop.

### P1-5: Bottom nav "Buddies" tab missing in some views

- **Source:** `scoring-visual.spec.ts` (outdoor theme), `chrome-visual.spec.ts` (404 page, bottom nav test)
- **What:** The bottom navigation bar shows only 4 items (New, History, Players, Tourneys) with "Buddies" clipped or missing. In equivalent dark theme screenshots, all 5 items are present. Observed in outdoor theme and on the 404 page.
- **Impact:** Users cannot navigate to Buddies in affected views. Likely a viewport width issue where the 5th tab overflows.
- **Resolution:** Reclassified — Buddies tab is correctly conditional on `user()` authentication. Screenshots showing 4 tabs were from unauthenticated views. Not a bug.

### P1-6: Game setup form overflow at 375px

- **Source:** `scoring-visual.spec.ts` — test "14 full form — 375px"
- **What:** The "POINTS TO WIN" pill buttons are partially clipped, and the "MATCH FORMAT" section bleeds behind/below the "Start Game" button and bottom nav. Form content overlaps with fixed-position elements.
- **Impact:** On smaller phones (iPhone SE class, 375px), the game setup form has layout overlap that reduces readability.
- **Resolution:** Fixed — reduced grid gap from `gap-3` to `gap-2` and added `min-w-0` overflow safety net (commit `ec26d78`)

---

## P2 — Minor (fix post-launch ok)

### P2-1: Pool standings table text very small at 375px

- **Source:** `tournament-visual.spec.ts` — test "7 pool table with standings"
- **What:** Column headers (W, L, PF, PA, +/-) and data values are very dense and compact at 375px. Legible but on the edge of readability.

### P2-2: "Advance to Completed" button text wraps to two lines

- **Source:** `tournament-visual.spec.ts` — tests "4 pool-play phase" and "5 bracket phase"
- **What:** The "Advance to Completed" CTA button wraps to two lines. A shorter label like "Complete Tournament" would be more scannable.

### P2-3: Completed tournament still shows "Matches to Score" section

- **Source:** `tournament-visual.spec.ts` — test "6 completed results"
- **What:** The completed tournament hub shows "Matches to Score" with "No matches waiting to be scored." This section is irrelevant for a completed tournament and should be hidden.

### P2-4: Bracket detail cramped at 375px

- **Source:** `tournament-visual.spec.ts` — test "8 bracket in progress"
- **What:** The bracket tree at 375px is functional but cramped. "Score Match" buttons are narrow. Bracket lines connecting matchups are barely visible in dark theme.

### P2-5: Profile "Doubles 0.1" stat display

- **Source:** `social-visual.spec.ts` — test "14 profile stats + achievements"
- **What:** Profile stats show "Doubles 0.1" which is unclear. Should be "0" or a formatted percentage.

### P2-6: Session title/date day-of-week mismatch

- **Source:** `social-visual.spec.ts` — test "7 session detail with RSVPs"
- **What:** Session titled "Saturday Morning Play" shows "Friday, March 20" — day-of-week doesn't match the title. Data seeding issue.

### P2-7: "Who's Playing (4)" heading with 0 confirmed RSVPs

- **Source:** `social-visual.spec.ts` — test "7 session detail with RSVPs"
- **What:** Shows "0 of 8 confirmed" but heading says "Who's Playing (4)". All 4 players have "Out" status. Heading "Who's Playing" is misleading — consider "RSVPs (4)".

---

## Cosmetic Issues

### C-1: Confetti overlapping UI text

- **Source:** `scoring-visual.spec.ts` — tests 9, 10, 11
- **What:** Confetti particles occasionally overlap "Undo Last" text and bottom nav labels. Transient and expected — no action needed unless users report readability concerns.

### C-2: "Undo Last" button slightly clipped at viewport bottom

- **Source:** `scoring-visual.spec.ts` — test 8 (scorer indicator)
- **What:** "Undo Last" text slightly clipped at bottom of 393px viewport.

### C-3: Status badge styling inconsistency across tournament phases

- **Source:** `tournament-visual.spec.ts` — all hub phase tests
- **What:** "Setup" uses red-brown background, "Registration Open" uses golden, "Pool Play" uses greenish. May be intentional color coding but is not documented.

### C-4: Share button placement shifts between phases

- **Source:** `tournament-visual.spec.ts` — hub tests
- **What:** "Share" appears as standalone text on setup, bordered button on later phases.

### C-5: Share modal shows localhost URL

- **Source:** `tournament-visual.spec.ts` — test "13 share tournament modal"
- **What:** Share link shows `http://localhost:5199/t/...`. Expected in test — will be correct in production.

### C-6: Outdoor theme dark margin bands on sides

- **Source:** `social-visual.spec.ts` — outdoor theme tests
- **What:** Light content area doesn't extend to viewport edges, leaving dark bands on left/right margins. Likely not visible on actual mobile devices.

### C-7: Empty profile shows raw test email instead of display name

- **Source:** `social-visual.spec.ts` — test "15 profile empty"
- **What:** Shows `e2e-e9327b0b@test.com` without display name. Expected for fresh account but could prompt user to set a name.

---

## Test Coverage Gaps

These are not UI bugs but tests that fail to capture the UI state they claim to validate. The visual QA suite should be fixed so these screens get actual coverage.

### TG-1: Score Edit modal never opens

- **Source:** `tournament-visual.spec.ts` — test "15 score edit modal"
- **What:** Test has a conditional that falls through if the edit button can't be clicked. Screenshot shows pool standings with "Edit" button visible but the ScoreEditModal itself is never opened. Zero visual coverage for this component.

### TG-2: iOS install sheet not rendering in test environment

- **Source:** `chrome-visual.spec.ts` — test "8 ios install sheet"
- **What:** Test skips when iOS detection fails. Screenshot shows landing page without any install sheet overlay. No coverage.

### TG-3: Loading spinner test captures error state instead

- **Source:** `scoring-visual.spec.ts` — test "12 loading state"
- **What:** Navigates to nonexistent match and waits 1000ms — loading resolves to "Match not found" error before screenshot. The actual loading/skeleton state is never captured.

### TG-4: Buddy action sheet test triggers wrong overlay

- **Source:** `social-visual.spec.ts` — test "12 buddy action sheet"
- **What:** Test finds and clicks the user avatar/profile button instead of a buddy-specific action trigger. Screenshot shows account dropdown (Profile/Settings/Sign out) instead of buddy action sheet.

### TG-5: Share sheet test doesn't trigger overlay

- **Source:** `social-visual.spec.ts` — test "13 share sheet buddy"
- **What:** Share button selector mismatch — screenshot shows group detail page without any share overlay visible.

### TG-6: Buddies list "with groups" identical to empty state

- **Source:** `social-visual.spec.ts` — tests 1 vs 2
- **What:** Both tests produce the exact same screenshot hash. The "with groups" test seeds data via `seedBuddyGroupWithMember()` but the UI shows "No groups yet / Create Your First Group". Seeder data not propagating before screenshot — likely needs longer wait or explicit Firestore query wait.

### TG-7: Open play "browse" vs "empty" produce identical screenshots

- **Source:** `social-visual.spec.ts` — tests 10 vs 11
- **What:** Same screenshot hash for both. Either test isolation issue (data leaking between tests) or the "browse" seeder is not creating visible sessions.

---

## Positive Findings

- **Theme consistency:** All 3 themes (Court Vision Gold, Classic, Ember) render correctly and consistently across views
- **Focus rings:** Visible and properly themed across all 3 themes
- **Outdoor mode contrast:** Adequate contrast with darker text on light backgrounds
- **Color accessibility:** Similar team colors are distinguishable via separate card backgrounds and colored borders
- **Portrait layouts (393px):** Solid across all screens — no critical issues at primary viewport
- **Dialog design:** Clean with proper button contrast (Cancel dark, Leave gold)
- **Overall polish:** The app looks professional and cohesive in portrait mode across themes

---

## Recommended Fix Order

1. **P0-1 + P0-2:** Landscape layout (single root cause — stacked layout overflows short viewport)
2. **P0-3:** Spectator scoreboard missing team
3. **P1-1:** Notification panel empty bodies
4. **P1-2:** PWA install banner duplicate row
5. **P1-4:** Save Template modal backdrop
6. **P1-5:** Bottom nav 5th tab overflow
7. **P1-3:** Pool hub scroll padding
8. **P1-6:** Game setup 375px overflow
9. **TG-1 through TG-7:** Test fixes for coverage gaps
10. **P2 and Cosmetic:** Address in polish pass
