# E2E Infrastructure Hardening Design

**Date:** 2026-03-16
**Status:** Approved
**Goal:** Prevent the failure classes that broke 34/48 P0 tests from recurring in 131 P1/P2 tests

## Background

All 48 P0 E2E tests were written by agents from the plan document without inspecting the live DOM. 34 failed on first run. Root causes:

- Wrong Firestore subcollection paths (`events` vs `scoreEvents`)
- Missing data fields (`lastSnapshot` not populated, `games: []` for completed matches)
- Wrong defaults (sideout scoring breaks `scorePoints()`, doubles requires pre-paired teams)
- Broad selectors causing strict mode violations (`getByText(/pool/i)` matching 3 elements)
- Security rule denials (sessions seeded without group membership)
- 3 duplicate `toFirestoreFields` implementations with divergent behavior

## Design Overview

10 changes across 5 categories: factories, seeders, POMs, infrastructure, process.

---

## 1. Consolidate `toFirestoreFields` (delete duplicates)

**Problem:** 3 separate implementations exist:
- `e2e/helpers/emulator-auth.ts` (canonical, handles integers/doubles/maps correctly)
- `e2e/journeys/spectator/spectator-helpers.ts` (encodes ALL numbers as `integerValue` — truncates 0.7 to 0)
- `e2e/spectator/spectator.spec.ts` (third copy, also divergent)

**Fix:** Delete the copies. `spectator-helpers.ts` keeps only `seedDoc` which imports from `emulator-auth.ts`. All spectator specs import `seedDoc` from `spectator-helpers.ts` or use `seedFirestoreDocAdmin` directly.

---

## 2. Firestore Path Constants (`e2e/helpers/firestore-paths.ts`)

Compile-time protection against typo'd subcollection paths — the #1 bug class from P0.

```typescript
// e2e/helpers/firestore-paths.ts
export const PATHS = {
  tournaments: 'tournaments',
  teams: (tournamentId: string) => `tournaments/${tournamentId}/teams`,
  pools: (tournamentId: string) => `tournaments/${tournamentId}/pools`,
  bracket: (tournamentId: string) => `tournaments/${tournamentId}/bracket`,
  matches: 'matches',
  spectatorProjection: (matchId: string) => `matches/${matchId}/public`,
  scoreEvents: (matchId: string) => `matches/${matchId}/scoreEvents`,
  buddyGroups: 'buddyGroups',
  buddyMembers: (groupId: string) => `buddyGroups/${groupId}/members`,
  gameSessions: 'gameSessions',
  rsvps: (sessionId: string) => `gameSessions/${sessionId}/rsvps`,
  users: 'users',
} as const;
```

Seeders and tests import from this file instead of hardcoding paths.

---

## 3. Status-Driven Typed Factories

**Problem:** Current factories use `Record<string, unknown>` and produce incomplete data. A `status: 'completed'` match with `games: []` silently breaks `extractLiveScore`.

**Fix:** Type factories against `src/data/types.ts` and auto-fill co-required fields based on status.

### `makePublicMatch`
- `status: 'in-progress'` → auto-populate `lastSnapshot: JSON.stringify({ team1Score, team2Score, gameNumber: 1 })`
- `status: 'completed'` → require/default non-empty `games` array, set `winningSide`, `completedAt`
- `lastSnapshot` is always a JSON **string** (not an object) — the factory handles `JSON.stringify`

### `makeTournament`
- Default `config` includes all required fields: `gameType: 'singles'`, `scoringMode: 'rally'`, `matchFormat: 'single'`, `pointsToWin: 11`
- Default `config.poolCount: 1`, `config.teamsPerPoolAdvancing: 2` (valid for round-robin)

### `makeMatchRefSeed`
- Default `scoringMode: 'rally'` (currently defaults to `'sideout'`)

### Typing approach
```typescript
import type { Tournament, Match, Team, Pool } from '../../src/data/types';

export function makeTournament(overrides: Partial<Tournament> = {}): Tournament { ... }
export function makePublicMatch(ownerId: string, overrides: Partial<Match> = {}): Match { ... }
```

Where full typing isn't practical (some E2E-only fields), use intersection types.

---

## 4. Composite Seeders (`e2e/helpers/seeders.ts`)

High-level functions that create correctly-linked Firestore data in one call. Built on typed factories + path constants.

### Design principles
- Every seeder takes `userUid` as first param (consistency)
- Typed options interface per seeder (not `Record<string, unknown>`)
- Returns both IDs and full objects
- Fixed default team names: `['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']`
- JSDoc with "Use when / NOT for" routing guidance
- Barrel export from `e2e/helpers/seeders.ts`

### Functions

#### `seedPoolPlayTournament(userUid, opts?)`
```typescript
interface PoolPlayOptions {
  teamCount?: number;          // default 4
  poolCount?: number;          // default 1
  teamNames?: string[];        // default Alpha/Bravo/Charlie/Delta
  scoringMode?: 'rally' | 'sideout';  // default rally
  gameType?: 'singles' | 'doubles';    // default singles
  withCompletedMatch?: boolean; // seeds a scored match in schedule
}
interface PoolPlaySeed {
  tournamentId: string;
  tournament: Tournament;
  teams: Team[];
  pools: Pool[];
  teamNames: string[];
}
```

#### `seedBracketTournament(userUid, opts?)`
Tournament in bracket phase with slots. Returns `{ tournamentId, teams, slotIds }`.

#### `seedRegistrationTournament(userUid, opts?)`
Tournament in registration with optional pre-registered teams. Returns `{ tournamentId }`.

#### `seedScorekeeperTournament(userUid, opts?)`
Pool-play tournament where `userUid` is staff/scorekeeper. Calls `seedPoolPlayTournament` internally, adds staff role.

#### `seedSpectatorMatch(userUid, opts?)`
Match + spectator projection + optional score events. Auto-populates `lastSnapshot`. Returns `{ matchId, tournamentId }`.

#### `seedBuddyGroupWithMember(userUid, opts?)`
Group + member doc. Returns `{ groupId, group }`.

#### `seedGameSessionWithAccess(userUid, opts?)`
Group + member + session. Only creates group/member when `visibility !== 'open'`. Returns `{ groupId, sessionId, session }`.

---

## 5. POM Improvements

### Keep (already added during P0 debugging)
- `scorePointByName(teamName)` / `scorePointsByName(teamName, count)`
- `scoreFirstTeam()` / `scoreFirstTeamPoints(count)`

### Add
- **`getTeamNames()`** — reads actual button `aria-label` attributes from DOM, returns `{ team1: string, team2: string }`
- **`expectMatchCompleteAndSave()`** — combines `expectMatchOver()` + wait for button enabled + `saveAndFinish()`

### Drop (per Playwright expert review)
- ~~`scoreToWin()`~~ — embeds scoring rules, breaks for sideout/deuce. Keep explicit `scorePoints`/`scoreFirstTeamPoints` as primitives.

---

## 6. `testUserUid` Fixture

Eliminates the `getCurrentUserUid(page)` two-step pattern that every authenticated test repeats.

```typescript
// e2e/fixtures.ts
export const test = base.extend<E2EFixtures>({
  // ... existing fixtures ...

  testUserUid: async ({ authenticatedPage }, use) => {
    const uid = await getCurrentUserUid(authenticatedPage);
    await use(uid);
  },
});
```

Tests become:
```typescript
test('example', async ({ authenticatedPage: page, testUserUid }) => {
  const seed = await seedPoolPlayTournament(testUserUid);
  // ...
});
```

---

## 7. Test Tags

Add priority tags for running subsets:

```typescript
test.describe('@p0 Casual Scorer', () => { ... });
test.describe('@p1 Match History', () => { ... });
test.describe('@p2 Edge Cases', () => { ... });
```

Usage: `npx playwright test --grep @p0` for fast dev feedback, full suite in CI.

---

## 8. Global Setup Hardening

Change `clearEmulators()` to fail hard if emulators are unreachable (currently warns and continues, leading to mystery failures against stale data).

```typescript
// e2e/global-setup.ts
export default async function globalSetup() {
  const [authRes, firestoreRes] = await Promise.all([
    fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' }),
    fetch(`${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' }),
  ]);
  if (!authRes.ok || !firestoreRes.ok) {
    throw new Error('Emulators not reachable — start them before running tests');
  }
}
```

---

## 9. Anti-Patterns Reference (in-repo, slim)

Instead of a full DOM-REFERENCE.md, add a short anti-patterns section to the existing test plan or as a comment block in `e2e/helpers/seeders.ts`:

### Selectors
- Never use broad regex like `getByText(/pool/i)` — use exact text + `.first()`
- Table columns: `getByRole('columnheader', { name: 'L' })` not `getByText('L')`
- Score display in history: separate elements, use `matchCard.getByText('11', { exact: true })`
- Play-by-play scores: `1-0` format (no spaces)

### Scoring
- Default Quick Game = sideout doubles — Team 2 can't score from start
- Tournament matches use team names in buttons, not "Team 1"/"Team 2"
- Use `scoringMode: 'rally'` in test configs unless testing sideout specifically

### Data
- Scores read from `match.lastSnapshot` (not spectator projection)
- `lastSnapshot` is a JSON string, not an object
- Score events path: `scoreEvents` (not `events`)
- Buddy sessions need group membership for security rules

---

## 10. P1/P2 Test Writing Process

1. **Agent reads:** Seeder JSDoc + anti-patterns section + plan task description
2. **Agent writes tests using:** composite seeders (not raw factories), POM methods, path constants
3. **Batch size: 3-5 tests** per agent dispatch (not 10)
4. **Mandatory run** against live emulators after writing each batch
5. **Fix failures immediately** — update seeder JSDoc / anti-patterns if a new pattern is discovered
6. **Tag every describe block** with `@p1` or `@p2`

---

## Implementation Order

| Step | What | Why first |
|------|------|-----------|
| 1 | Consolidate `toFirestoreFields` (delete 2 copies) | Remove active bug source |
| 2 | Add `firestore-paths.ts` constants | Prevent #1 bug class |
| 3 | Type + fix factory defaults (status-driven) | Foundation for seeders |
| 4 | Add `testUserUid` fixture | Reduces boilerplate, unblocks seeders |
| 5 | Build composite seeders with JSDoc | Highest value for P1/P2 velocity |
| 6 | POM additions (`getTeamNames`, `expectMatchCompleteAndSave`) | Supports tournament scoring tests |
| 7 | Global setup hardening + test tags | Reliability + subset running |
| 8 | Update existing P0 tests to use seeders (opportunistic) | Validates seeders work before P1/P2 |
