# Layer 2: Tournament Management — Validation Issues

> **Date**: 2026-02-15
> **Branch**: `feature/tournament-management`
> **Reviewed by**: 5 specialized agents (spec compliance, code quality, integration, test coverage, security)
> **Status**: 100/100 tests passing, TypeScript clean, production build successful

---

## Issue Severity Guide

- **CRITICAL** — Blocks core functionality or causes data corruption
- **HIGH** — Significant bug, security vulnerability, or major missing feature
- **MEDIUM** — Notable gap, poor UX, or defense-in-depth issue
- **LOW** — Cosmetic, minor improvement, or future consideration

---

## Category A: Orchestration & Wiring (THE BIG GAP)

The data layer (types, repos, algorithms) and presentation layer (components) are well-built, but the orchestration layer connecting them is almost entirely missing. This is the single biggest issue.

### A1. [CRITICAL] 5 UI components built but never rendered anywhere

**Components orphaned** (exist in `src/features/tournaments/components/` but not imported by any page):
1. `PoolTable.tsx` — pool standings table
2. `BracketView.tsx` — bracket visualization
3. `RegistrationForm.tsx` — player registration flow
4. `FeeTracker.tsx` — entry fee payment tracking
5. `OrganizerControls.tsx` — pause/resume/cancel controls

**Expected**: `TournamentDashboardPage.tsx` should import and conditionally render all 5 based on tournament status and user role.

### A2. [CRITICAL] 5 engine algorithms built but never called from UI

| Algorithm | File | Purpose | Called from UI? |
|-----------|------|---------|-----------------|
| `generateRoundRobinSchedule` | `roundRobin.ts` | Create match schedule per pool | NO |
| `generatePools` | `poolGenerator.ts` | Distribute teams into pools | NO |
| `generateBracket` | `bracketGenerator.ts` | Create elimination bracket | NO |
| `calculateStandings` | `standings.ts` | Compute W/L/PF/PA rankings | NO |
| `seedBracketFromPools` | `bracketSeeding.ts` | Seed bracket from pool results | NO |

All 5 are only imported from test files. The "Advance" button on the dashboard changes status strings but triggers zero side effects.

### A3. [CRITICAL] No team creation workflow

- `firestoreTeamRepository.save()` exists but is never called from any UI
- No "Add Team" form, button, or page exists
- `RegistrationForm` registers individual users but never creates teams
- No workflow to convert registrations into teams

### A4. [CRITICAL] Status transitions have no side effects

When the "Advance" button is pressed:
| Transition | What should happen | What actually happens |
|------------|-------------------|----------------------|
| `setup → registration` | Open registration | Just changes status string (OK) |
| `registration → pool-play` | Generate pools, create schedules | Just changes status string |
| `pool-play → bracket` | Calculate standings, seed & generate bracket | Just changes status string |
| `bracket → completed` | Finalize results | Just changes status string (OK) |

### A5. [CRITICAL] 2 of 5 Firestore repositories never used from UI

- `firestorePoolRepository` — never imported by any page
- `firestoreBracketRepository` — never imported by any page

### A6. [CRITICAL] No link between tournament matches and the scoring system

- No way to start a match from within a tournament context
- No way for match results to flow back to tournament standings
- The `Match.tournamentId` field exists in types but is never set

---

## Category B: Logic Bugs

### B1. [HIGH] `standings.ts:17-19` — Matches on team NAME instead of team ID

```ts
const isTeam1 = match.team1Name === teamId;
const isTeam2 = match.team2Name === teamId;
```

The function takes `teamIds` (IDs) but compares against `team1Name`/`team2Name` (display names). If two teams share a name or names change, standings will be wrong. The plan specified a 3rd `teamMatchMap` parameter for proper ID-based association — it was dropped in implementation.

### B2. [HIGH] `OrganizerControls.tsx:20` — Resume from pause always goes to `pool-play`

```ts
const newStatus: TournamentStatus = isPaused() ? 'pool-play' : 'paused';
```

If paused during `bracket` phase, resuming sends the tournament back to `pool-play`. The pre-pause status is not stored anywhere.

**Fix**: Add a `pausedFrom` field to the Tournament type, or derive the previous status from tournament data.

### B3. [HIGH] `TournamentCreatePage.tsx:57` — `parseInt` without NaN check

```ts
maxPlayers: maxPlayers() ? parseInt(maxPlayers(), 10) : null,
```

Typing "abc" produces `NaN` which gets saved to Firestore.

### B4. [MEDIUM] `bracketGenerator.ts:9-15` — Standard seeding doesn't separate top seeds

Current seeding for 8 teams: `[1v8], [2v7], [3v6], [4v5]` in that order. This means seed 1 could face seed 2 in the semifinals. Proper bracket seeding should ensure top seeds are on opposite halves: `[1v8], [4v5]` on one side, `[2v7], [3v6]` on the other.

### B5. [MEDIUM] `TournamentDashboardPage.tsx:38-48` — Status advance is format-unaware

The status path is always `setup → registration → pool-play → bracket → completed`, but:
- `round-robin` format has no bracket phase
- `single-elimination` format has no pool-play phase

### B6. [LOW] `FeeTracker.tsx:57` — Shows raw Firebase UID instead of player name

```tsx
<span class="text-sm text-on-surface">{reg.userId}</span>
```

---

## Category C: Security Vulnerabilities

### C1. [HIGH] Users can self-update `paymentStatus` on their own registration

**File**: `firestore.rules:61`
```
allow update: if request.auth != null && resource.data.userId == request.auth.uid;
```

A user can mark themselves as `"paid"` without actually paying via direct Firestore API call.

**Fix**: Restrict user self-updates to exclude `paymentStatus` and `paymentNote` fields.

### C2. [HIGH] No server-side validation on tournament creation

**File**: `firestore.rules:30` — only checks `organizerId == auth.uid`, no field validation.

A direct API call can create tournaments with empty names, invalid formats, `status: 'completed'`, negative `maxPlayers`, etc.

**Fix**: Add field validation rules for `name.size() > 0`, `status == 'setup'`, `format in [valid values]`.

### C3. [HIGH] No server-side status transition validation

**File**: `firestore.rules:29` — organizer has blanket `write` access.

A direct API call can jump from `setup` to `completed`, revert `cancelled` to `setup`, or set invalid status strings.

**Fix**: Add transition validation in Firestore rules.

### C4. [HIGH] No route-level auth guards on tournament pages

**File**: `router.tsx:31-33`

Unauthenticated users can navigate directly to `/tournaments/new` and see the full create form. The BottomNav hides the tab but doesn't prevent direct URL access.

**Fix**: Wrap tournament route content in `<Show when={user()}>` with sign-in redirect.

### C5. [MEDIUM] No duplicate registration prevention at DB level

**File**: `firestore.rules:58`

Same user can create multiple registrations via direct API calls. Client checks `existingRegistration` but this is bypassable and race-condition-prone.

**Fix**: Use `userId` as document ID, or add Cloud Function validation.

### C6. [MEDIUM] Scorekeepers have full `write` on teams and bracket subcollections

**File**: `firestore.rules:36-39, 50-53`

Scorekeepers can delete teams, change names/seeds, modify bracket structure — not just update results.

**Fix**: Restrict scorekeepers to `update` on specific fields.

### C7. [MEDIUM] Bracket/pool results editable after tournament completion

Bracket and pool write rules don't check tournament status. Results can be modified after `completed` or `cancelled`.

### C8. [CRITICAL-functional] No `delete` rule for registrations

Users cannot withdraw from tournaments. Organizers cannot remove registrations. Any delete attempt is silently denied by Firestore.

### C9. [MEDIUM] Organizer can change `organizerId` (ownership transfer)

Blanket `write` on tournament document allows changing `organizerId` to another UID.

---

## Category D: Missing Error Handling

### D1. [HIGH] `OrganizerControls.tsx` — No try/catch on async operations

`handlePauseResume`, `handleCancel`, `handleEndEarly` all call `firestoreTournamentRepository.updateStatus()` without error handling. Failed operations produce unhandled promise rejections with no user feedback.

### D2. [MEDIUM] `TournamentDashboardPage.tsx:46` — No error handling on status advance

`handleStatusAdvance` calls `firestoreTournamentRepository.updateStatus()` without try/catch.

### D3. [LOW] `TournamentCreatePage.tsx:70`, `RegistrationForm.tsx:42` — Using native `alert()` for errors

Blocks UI thread. Should use a toast/notification component.

---

## Category E: Test Coverage Gaps

### E1. [CRITICAL] All 5 Firestore repo test files are existence-only stubs

All 18 repo tests only check `typeof method === 'function'`. Zero tests call any method, verify Firestore paths, assert on data transformation, or test error handling. These tests provide false confidence — they pass even if every method body is replaced with `async () => {}`.

| File | Tests | Behavioral assertions |
|------|-------|-----------------------|
| `firestoreTournamentRepository.test.ts` | 5 | 0 |
| `firestoreTeamRepository.test.ts` | 4 | 0 |
| `firestorePoolRepository.test.ts` | 3 | 0 |
| `firestoreBracketRepository.test.ts` | 3 | 0 |
| `firestoreRegistrationRepository.test.ts` | 3 | 0 |

Additionally, `firestoreTeamRepository.test.ts` and `firestorePoolRepository.test.ts` don't even mock Firebase.

### E2. [CRITICAL] Zero UI component tests

No `.test.tsx` files exist anywhere in `src/features/tournaments/`.

### E3. [CRITICAL] Zero integration tests

No test exercises the full tournament workflow (create → register → generate pools → play → standings → seed bracket → bracket play → winner).

### E4. [IMPORTANT] Engine algorithm edge cases missing

| Algorithm | Missing tests |
|-----------|---------------|
| roundRobin | 0 teams, 1 team |
| bracketGenerator | 2 teams (minimum), 1 team, 3 teams (odd non-power-of-2) |
| poolGenerator | 0 teams, poolCount > teamCount, poolCount = 0 |
| standings | Multi-game matches, same-record tiebreaks, in-progress match exclusion |
| bracketSeeding | Unequal pool sizes, all teams tied, single pool |

### E5. [IMPORTANT] `firestoreRegistrationRepository.getByUser()` not tested at all

Method exists in implementation but has no test — not even an existence check.

---

## Category F: Code Quality / DRY

### F1. [MEDIUM] Duplicate lookup maps in `TournamentDashboardPage.tsx` and `TournamentCard.tsx`

`statusLabels`, `statusColors`, `formatLabels` defined in both files. Should be extracted to `src/features/tournaments/constants.ts`.

### F2. [LOW] `firestoreTournamentRepository.ts:10-16` — Race condition in save (check-then-write)

`getDoc` then `setDoc` is not atomic. Could use `setDoc` with merge or Firestore transactions.

### F3. [LOW] `db.ts:18-23` — Dexie `tournaments` table appears unused

Local Dexie schema has a tournaments table but all tournament data flows through Firestore repos. No local tournament repository exists.

### F4. [LOW] All Firestore repos use `as Type` without runtime validation

```ts
return { id: snap.id, ...snap.data() } as Tournament;
```

Malformed Firestore data won't be caught. Consider Zod or similar runtime validation.

### F5. [LOW] `cloudSync.syncTournamentToCloud()` never called

`TournamentCreatePage` calls `firestoreTournamentRepository.save()` directly, bypassing the sync wrapper. This is actually fine since `save()` goes to Firestore directly, but it's inconsistent with match creation which uses `cloudSync.syncMatchToCloud()`.

---

## Priority Summary

| Priority | Count | Key items |
|----------|-------|-----------|
| CRITICAL | 8 | Orchestration gap (A1-A6), stub tests (E1), no UI tests (E2) |
| HIGH | 8 | Logic bugs (B1-B3), security (C1-C4), error handling (D1) |
| MEDIUM | 10 | Format-aware status (B5), security (C5-C9), error handling (D2), DRY (F1) |
| LOW | 6 | Minor UX, code quality, consistency issues |
| **TOTAL** | **32** |

---

## Recommended Fix Order

1. **Wire the dashboard** (A1-A6) — This is 60% of the remaining work. The dashboard needs to become the central hub: render components by status, trigger algorithms on transitions, link matches to tournaments.
2. **Fix logic bugs** (B1-B3) — Standings name-vs-ID, pause/resume, parseInt validation
3. **Add auth guards** (C4) — Route-level protection for tournament pages
4. **Harden Firestore rules** (C1-C3) — Payment fraud prevention, field validation, status transitions
5. **Add error handling** (D1-D2) — try/catch on all async operations
6. **Upgrade repo tests** (E1) — Replace existence stubs with behavioral tests
7. **Everything else** — Edge cases, DRY, format-aware status, cosmetics
