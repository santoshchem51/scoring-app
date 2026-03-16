# Pre-Launch E2E Validation Suite Design

**Date:** 2026-03-15
**Status:** Approved
**Goal:** Comprehensive Playwright + Firebase emulator E2E test suite validating all user workflows before first public launch. Doubles as ongoing regression suite for every deploy.

---

## Problem

PickleScore has ~190 existing E2E tests (47 spec files) with strong coverage of core scoring and tournament algorithms, but significant gaps in:
- UI component behavior (only ~42% of components have unit tests)
- Full user journey validation across all personas
- Staff role permission boundaries (zero tests)
- Voting workflow for buddy sessions (zero tests)
- Spectator experience across tournament phases
- Mobile viewport and theme-specific visual validation

## Approach: Persona-Based Test Matrix

Organize E2E tests by user persona journey. Each persona gets a dedicated test suite covering their complete lifecycle. Map existing tests against the matrix, then fill every gap.

## Structure

```
e2e/
  journeys/
    casual-scorer/     -- Offline-first scoring without an account
    player/            -- Tournament participant + stats + achievements
    organizer/         -- Tournament creation -> completion lifecycle
    buddy/             -- Groups, sessions, RSVP, day-of, open play
    spectator/         -- Public tournament + live match viewing
    staff/             -- Scorekeeper/moderator/admin tournament ops
  cross-cutting/       -- Auth, sync, notifications, PWA, settings
  regression/          -- Existing 47 specs (untouched)
  pre-launch/          -- Aggregate smoke gate
```

---

## Section 1: Personas

| Persona | Description | Auth Required? |
|---------|-------------|----------------|
| Casual Scorer | Opens app, scores pickup games, views history | No |
| Player | Joins tournaments, tracks stats, earns badges, checks leaderboard | Yes |
| Organizer | Creates/manages tournaments, handles registrations, staff, disputes | Yes |
| Buddy | Creates groups, schedules sessions, RSVPs, day-of status, open play | Yes |
| Spectator | Views live matches, tournament standings via public share links | No |
| Staff | Scores tournament matches, views activity log, resolves disputes | Yes |

---

## Section 2: Casual Scorer Journey (20 tests)

| # | Workflow | Priority | New? |
|---|----------|----------|------|
| CS-1 | Landing page -> "Start Scoring" -> game setup | P0 | NEW |
| CS-2 | Quick Game -> score to completion -> save -> appears in history | P0 | Exists (validate) |
| CS-3 | Best-of-3: play game 1 -> "Game Complete!" -> Start Next Game -> play game 2 -> match over | P0 | NEW |
| CS-4 | Doubles sideout: full server rotation (S2 first-serve rule -> S1->S2->other team) + score call display | P0 | NEW |
| CS-5 | Singles sideout: serve alternates, no server number | P1 | NEW |
| CS-6 | Rally scoring: both teams score, serve switches to scoring team, win-by-2 | P0 | Exists (strengthen) |
| CS-7 | Match resume after refresh: verify ALL snapshot fields (score, serving, server#, game#, gamesWon) | P0 | NEW |
| CS-8 | Go offline mid-match -> continue scoring -> all points saved locally | P0 | NEW |
| CS-9 | Undo sequences: single, multi, at game boundary (disabled), after resume | P0 | Partially exists (extend) |
| CS-10 | Navigation guard: confirm leave + cancel stay paths | P1 | Partially exists (extend) |
| CS-11 | Scorer role: "I'm Playing" with team indicator + "Scoring for Others" hides indicator | P1 | Partially exists (extend) |
| CS-12 | Landscape mode: side-by-side layout renders, scoring still works | P1 | NEW |
| CS-13 | Share score card from match-over screen | P1 | NEW |
| CS-14 | Settings defaults carry to game setup (change rally/15pts -> Quick Game uses them) | P1 | NEW |
| CS-15 | Team names + colors carry through to scoreboard | P1 | Partially exists (extend) |
| CS-16 | Match history: multiple matches in reverse chronological order, persistence across reload | P0 | Exists (validate) |
| CS-17 | Empty states: history, players pages with correct messaging + CTAs | P1 | Exists (validate) |
| CS-18 | Game point indicator: shows at 10-9 (11pt), NOT at 10-10, shows at 14-13 (15pt) | P1 | Exists (strengthen) |
| CS-19 | Invalid match ID -> error state | P2 | NEW |
| CS-20 | Player CRUD: add player, delete with confirmation, empty name validation | P2 | NEW |

**Page object updates needed:** ScoringPage (add startNextGame(), expectBetweenGames(), expectServingIndicator(), getMatchIdFromUrl()), new SettingsPage POM.

---

## Section 3: Player Persona Journey (35 tests)

**P0 -- Must have (4):**
- PL-4: View tournament via share code (/t/:code)
- PL-10: Pool standings display (all columns verified)
- PL-14: Achievement toast on unlock (first match triggers "First Rally")
- PL-31: Cross-feature: tournament match -> achievement -> notification chain

**P1 -- High value (15):**
- PL-1/2/3: Smart tab defaulting (invitation, registration, My Tournaments content)
- PL-5: Share code deep link -> sign in -> register
- PL-6: Registration blocked on non-registration status
- PL-8/9: MyMatchesSection + MyStatsCard in tournaments
- PL-11: Bracket progression display
- PL-12: Profile tier badge with confidence dots
- PL-17/18: Leaderboard with seeded podium data + current user highlight
- PL-22: Notification tap navigates to actionUrl
- PL-23: Tournament invite notification + registration flow
- PL-25: awaitingAuth sync jobs resume on re-auth
- PL-32: Offline -> online -> sync -> stats chain

**P2 -- Nice to have (16):**
- Profile public/private toggle, achievement progress tracking, Comeback Kid achievement
- Leaderboard 30-day timeframe, Friends scope with data
- Bell badge 9+ cap, notification types (tournament, stats)
- Tournament status real-time update, network error during registration
- Multiple tournament registrations, profile photo fallback, history ordering

---

## Section 4: Organizer Persona Journey (27 new tests)

**P0 -- Must have (7):**
- DASH-11: Pool-bracket full lifecycle (setup -> reg -> pool -> bracket -> completed)
- DASH-12: Advance to "Completed" via button
- DASH-14: Advance blocked with insufficient players
- REG-09: Organizer approves pending registration (2-context test)
- REG-12: Max player cap enforced
- INT-03: Rescore completed pool match, standings recalculate
- AUTH-04: Non-organizer cannot see Organizer Controls

**P1 -- High value (14):**
- Template pre-fill, unlisted tournament, Auto-Pair, share modal
- Bracket pause, odd-team bye handling, batch approve, decline registration
- Add staff through UI, role-based visibility, dispute Edit Scores path
- Share code happy path, multi-round bracket journey

**P2 (6):** Max players on create, past date validation, cancel mid-match, activity log integration, template limits

---

## Section 5: Buddy Persona Journey (37 new tests, 59 total)

**P0 -- Must have (6 new):**
- Group detail page: header, members, sessions
- Join group via invite link (full journey)
- RSVP Out -> In (reverse delta, spots increment)
- Create voting session ("Find a Time")
- Voting: vote on slots -> creator confirms -> status=confirmed
- Open Play lists open sessions

**P1 -- High value (21):**
- All RSVP transitions (Maybe->In, In->Maybe), cancelled session guard
- Day-of status boundaries (hidden if not confirmed, hidden if not "In")
- "Can't make it" dropout notification, session fills -> "Full" badge
- Creator "Open to community" toggle, non-creator restrictions
- Group/session share feedback, session pre-fills from group defaults
- Group name validation, voting validation, FAB navigation
- session_proposed notification fires

**P2 (10):** Public page edge cases, completed session guard, deadline guard, past sessions collapsible, auto-open toggle, unauthenticated invite flow, multi-user notifications

**New spec files:** group-detail.spec.ts, group-invite.spec.ts, sessions-voting.spec.ts, open-play.spec.ts

---

## Section 6: Spectator Persona Journey (39 new tests, 58 total)

**P0 -- Must have (7 new):**
- Hub renders correctly in ALL 4 tournament phases (registration, pool-play, bracket, completed)
- Scoreboard shows full data (names, scores, game#, wins)
- Play-by-play events render with timestamps
- Mobile viewport: hub + match detail on 375px (no overflow)

**P1 -- High value (16):**
- Match card click navigates, UP NEXT section, new match appearing real-time
- FINAL badge, doubles layout, loading skeleton, "Jump to live" pill
- Auto-scroll, touch pauses scroll, momentum bar
- Tournament name in nav, match-tournament mismatch error
- Score announcer aria-live, long team name truncation

**P2 (16):** Score flash, serving indicator, retained FINAL 2-min lifecycle, run-of-play, streak highlight, point distribution, abandoned badge, small viewport font scaling, segmented control keyboard nav

---

## Section 7: Staff Persona Journey (20 new tests)

**P0 -- Must have (9):**
- S1: Scorekeeper sees ScorekeeperMatchList
- S2: Scorekeeper taps Score -> navigates to scoring page
- S3: Scorekeeper does NOT see admin UI (negative permission test)
- S5: Scorekeeper sees ActivityLog
- S7: Moderator sees Edit Score button
- S8: Moderator sees DisputePanel with open dispute
- S12: Admin staff sees StaffManager with role badges
- S16: Scorekeeper scores pool match end-to-end
- S20: Non-staff user sees none of the staff UI

**P1 (8):** Scorekeeper empty state, moderator dismisses dispute, moderator no StaffManager, moderator sees all features, admin sees organizer controls, admin advances status, bracket scoring, non-creator restrictions

**P2 (3):** ScoreEditModal validation, bracket safety check, activity log records real actions

---

## Section 8: Cross-Cutting (14 new tests)

**P0 -- Must have (3):**
- C1: Sync retry button appears after failed sync + recovery works
- C2: awaitingAuth jobs resume after re-authentication
- C3: Local matches pushed to cloud on first sign-in

**P1 (4):** Default scoring settings propagation, rapid navigation stress test, sign out/in different user no stale data, cloud matches pulled on sign-in (multi-context)

**P2 (7):** Sync indicator active state, tournament/stats notification types, voice settings, invalid group share code, offline tournament cache, keep screen awake persistence

---

## Section 9: Screenshot Strategy

### Two-Tier Approach

| | Regression Run | Visual QA Run |
|---|---|---|
| Screenshots | ~30 targeted + auto on failure | ~60-70 comprehensive |
| Config | screenshot: 'only-on-failure' | screenshot: 'on' |
| Traces | trace: 'retain-on-failure' | trace: 'on' |
| Video | Off | retain-on-first-retry |
| Animations | disabled | allow |

### Implementation

- **Helper:** `captureScreen(page, testInfo, name, options?)` with dual-mode support (attach now, compare post-launch)
- **Naming:** `{flow}-{screen}-{state}` convention enforced in helper
- **Element-level (~70%)** for components, full-page (~30%) for layout verification
- **Playwright projects:** `emulator` (regression), `visual-qa` (pre-launch), `staging-smoke`

### Capture Matrix (~60-70 for Visual QA)

| Category | Count | Viewports | Themes/Modes |
|----------|-------|-----------|-------------|
| Scoreboard (scoring) | 6 | Portrait 393, 375, Landscape 851x393 | Gold Dark + Gold Outdoor |
| Scoreboard (spectator) | 3 | Portrait 393, 375 | Gold Dark |
| Between-games overlay | 2 | Portrait 393 | Gold Dark + Gold Outdoor |
| Match over screen | 2 | Portrait 393 | Gold Dark |
| Tournament hub (4 phases) | 4 | Portrait 393 | Gold Dark |
| Pool table + Bracket | 3 | Portrait 393 | Gold Dark |
| Buddy session detail | 3 | Portrait 393 | Gold Dark |
| Profile + leaderboard | 3 | Portrait 393 | Gold Dark |
| Modals/sheets | 3 | Portrait 393, 375 | Gold Dark |
| Empty states | 4 | Portrait 393 | Gold Dark |
| Landing page | 2 | Portrait 393, Desktop 1440x900 | Gold Dark |
| Settings | 1 | Portrait 393 | Gold Dark |
| Focus indicators | 3 | Portrait 393 | One per theme |
| Theme subset (Classic + Ember) | 10 | Portrait 393 | Per theme |
| Similar team colors | 1 | Portrait 393 | Gold Dark |

### Post-Launch

Migrate ~15 critical screens from `attach` to `compare` mode (toHaveScreenshot) once UI stabilizes. Baselines committed to git.

---

## Grand Total

| Persona | Existing | New | Total |
|---------|----------|-----|-------|
| Casual Scorer | ~15 | 20 | 35 |
| Player | ~30 | 22 | 52 |
| Organizer | 48 | 27 | 75 |
| Buddy | 22 | 37 | 59 |
| Spectator | 19 | 39 | 58 |
| Staff | 0 | 20 | 20 |
| Cross-Cutting | ~55 | 14 | 69 |
| **Total** | **~189** | **179** | **~368** |

## Key Infrastructure Needed

1. **Page object updates:** ScoringPage (startNextGame, expectBetweenGames, expectServingIndicator, getMatchIdFromUrl), new SettingsPage POM
2. **New factories:** None (existing factories sufficient)
3. **Screenshot helper:** e2e/helpers/screenshots.ts (dual-mode, naming enforcement)
4. **Playwright config:** Add visual-qa project
5. **New spec file directories:** e2e/journeys/{persona}/ for journey tests

## Design Decisions

- **Keep existing 47 specs untouched** -- proven regression suite
- **Journey tests are additive** -- new files alongside existing, not replacing
- **Same infrastructure** -- Playwright + Firebase emulators, same fixtures/helpers/page objects
- **Pre-launch gate** = all journey tests + existing regression, run as single suite
- **No visual regression baselines at launch** -- defer toHaveScreenshot() until UI stabilizes
- **No video in regular CI** -- trace provides equivalent debugging value at lower cost
