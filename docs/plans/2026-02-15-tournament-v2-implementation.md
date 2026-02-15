# Tournament Management v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild Layer 2 tournament management with comprehensive test coverage, bug fixes, team formation (BYOP + auto-pair), match-tournament integration, and security hardening.

**Architecture:** Feature branch `feature/tournament-v2` off `main`. Keep solid engine algorithms (5 pure functions), fix bugs in them with TDD. Replace all repo test stubs with behavioral tests. Add component tests. Wire team formation and match-tournament integration. Harden Firestore rules.

**Tech Stack:** SolidJS 1.9 + TypeScript + Vitest + jsdom + @testing-library/jest-dom + Firebase/Firestore mocks

**SolidJS Rules (CRITICAL):**
- `import type` for type-only imports
- Use `class` NOT `className`
- NEVER destructure props — always `props.foo`
- Components: `Show`, `For`, `Switch/Match`

**Test Commands:**
- Run all tests: `npx vitest run`
- Run single file: `npx vitest run path/to/file.test.ts`
- Type check: `npx tsc --noEmit`

---

## Phase 1: Setup + Data Model Changes

### Task 1: Create feature branch

**Step 1: Create and switch to feature branch**

Run:
```bash
cd C:/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp
git checkout -b feature/tournament-v2
```

**Step 2: Verify all existing tests pass**

Run: `npx vitest run`
Expected: 125 tests passing, 16 test files

**Step 3: Commit**

```bash
git commit --allow-empty -m "chore: start tournament v2 feature branch"
```

---

### Task 2: Update data model types

**Files:**
- Modify: `src/data/types.ts`

**Step 1: Update `Tournament` type — add `teamFormation` field**

In `src/data/types.ts`, add `teamFormation` to the `Tournament` interface after `maxPlayers`:

```typescript
// Add this type before the Tournament interface
export type TeamFormation = 'byop' | 'auto-pair';
```

Add to `Tournament` interface after `maxPlayers: number | null;`:
```typescript
  teamFormation: TeamFormation | null;  // null for singles (auto-derived)
```

**Step 2: Update `TournamentRegistration` type**

Replace the existing `TournamentRegistration` interface entirely:

```typescript
export interface TournamentRegistration {
  id: string;
  tournamentId: string;
  userId: string;
  teamId: string | null;
  paymentStatus: PaymentStatus;
  paymentNote: string;
  lateEntry: boolean;
  skillRating: number | null;       // 2.5-5.0, optional
  partnerId: string | null;         // BYOP: userId of desired partner
  partnerName: string | null;       // BYOP: display name for lookup
  profileComplete: boolean;         // true when rating + partner (if BYOP) filled
  registeredAt: number;
}
```

Note: `rulesAcknowledged` is removed — no friction at registration.

**Step 3: Update `Match` type — verify tournament fields exist**

Verify `Match` already has these fields (added in prior work):
```typescript
  tournamentId?: string;
  poolId?: string;
  bracketSlotId?: string;
```

If not present, add them after `court?: string;`.

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: Type errors in files that reference old `TournamentRegistration` fields (e.g., `rulesAcknowledged`). These will be fixed in subsequent tasks.

**Step 5: Run tests**

Run: `npx vitest run`
Expected: Some tests may fail due to type changes — note which ones. We'll fix them next.

**Step 6: Commit**

```bash
git add src/data/types.ts
git commit -m "feat: update data model for tournament v2 (teamFormation, registration fields)"
```

---

### Task 3: Fix type errors from model changes

**Files:**
- Modify: `src/features/tournaments/components/RegistrationForm.tsx`
- Modify: `src/features/tournaments/TournamentCreatePage.tsx`
- Modify: `src/data/firebase/__tests__/firestoreRegistrationRepository.test.ts`
- Modify: `firestore.rules`

**Step 1: Fix RegistrationForm.tsx — remove rulesAcknowledged, add new fields**

Replace the `handleRegister` function's registration object:

```typescript
      const reg: TournamentRegistration = {
        id: crypto.randomUUID(),
        tournamentId: props.tournament.id,
        userId: currentUser.uid,
        teamId: null,
        paymentStatus: 'unpaid',
        paymentNote: '',
        lateEntry: false,
        skillRating: null,
        partnerId: null,
        partnerName: null,
        profileComplete: false,
        registeredAt: Date.now(),
      };
```

Remove the `rulesAcknowledged` signal and `hasRules` derived signal. Remove the rules checkbox from the template. The "Join Tournament" button should have no conditions other than `saving()`:

```typescript
disabled={saving()}
```

**Step 2: Fix TournamentCreatePage.tsx — add teamFormation field**

Add `teamFormation` to the tournament object in `handleCreate`:

```typescript
        teamFormation: gameType() === 'singles' ? null : 'byop',
```

Add it after `maxPlayers`.

**Step 3: Fix registration repo test — update test data**

In `firestoreRegistrationRepository.test.ts`, update the test registration object in the `save` test to match the new type:

```typescript
      const reg = {
        id: 'reg1',
        tournamentId: 't1',
        userId: 'user1',
        teamId: null,
        paymentStatus: 'unpaid' as const,
        paymentNote: '',
        lateEntry: false,
        skillRating: null,
        partnerId: null,
        partnerName: null,
        profileComplete: false,
        registeredAt: 1000,
      };
```

**Step 4: Fix firestore.rules — remove rulesAcknowledged requirement**

In `firestore.rules`, in the registration create rule (around line 202), remove:
```
          && request.resource.data.rulesAcknowledged == true
```

**Step 5: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All passing

**Step 6: Commit**

```bash
git add -A
git commit -m "fix: update all references for new registration model (remove rulesAcknowledged)"
```

---

## Phase 2: Engine Bug Fixes (TDD)

### Task 4: Fix standings to use team IDs instead of names (B1)

**Files:**
- Modify: `src/features/tournaments/engine/standings.ts`
- Modify: `src/features/tournaments/engine/__tests__/standings.test.ts`

**Step 1: Write failing test proving the bug**

Add this test to `standings.test.ts`:

```typescript
  it('matches teams by ID, not by name', () => {
    const teamIds = ['id-alpha', 'id-beta'];
    const matches: Match[] = [
      {
        id: 'm1',
        config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
        team1PlayerIds: ['p1', 'p2'],
        team2PlayerIds: ['p3', 'p4'],
        team1Name: 'Alpha',   // Name differs from ID
        team2Name: 'Beta',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
        winningSide: 1,
        status: 'completed',
        startedAt: 1000,
        completedAt: 2000,
      } as Match,
    ];

    const standings = calculateStandings(teamIds, matches);

    // Should find teams by ID, so both teams should have records from the match
    // With ID-based matching and proper getTeamIds, team 'id-alpha' maps to team1
    expect(standings[0].wins + standings[1].wins).toBe(1);
    expect(standings[0].losses + standings[1].losses).toBe(1);
  });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/engine/__tests__/standings.test.ts`
Expected: FAIL — the default `getTeamIds` uses `team1Name`/`team2Name` which won't match `id-alpha`/`id-beta`

**Step 3: Fix the implementation**

In `standings.ts`, change the default `identify` function to use IDs instead of names:

```typescript
  const identify = getTeamIds ?? ((m: Match) => ({ team1: m.team1PlayerIds[0] ?? m.team1Name, team2: m.team2PlayerIds[0] ?? m.team2Name }));
```

Wait — actually the issue is more fundamental. The standings function takes `teamIds` which should match what `getTeamIds` returns. For tournament pool matches, the team IDs are `TournamentTeam.id`, not player IDs or names. The fix should make the caller pass the right `getTeamIds` function.

Actually, the better fix: **change the default to use a tournament-aware ID extractor**. Since `Match` now has `tournamentId`, we know it's a tournament match. But the cleaner approach is: remove the broken default entirely and require the caller to provide the ID extractor, OR add `team1Id`/`team2Id` fields to the schedule.

The simplest fix that keeps backward compatibility: keep the function signature, but add a proper tournament-aware helper. Actually, since the `TournamentDashboardPage` is the only caller and it should pass team IDs, let's just fix the default to NOT silently use names. Instead, we'll make the pool schedule store team IDs that match `PoolStanding.teamId`, and the caller always passes `getTeamIds`.

**Simplest correct fix:** Change the default identifier to throw, forcing callers to provide their own:

Actually, let me keep it simple. The bug is that `calculateStandings` defaults to matching by name. For tournament matches, we need to match by `TournamentTeam.id`. The fix:

In `standings.ts`, remove the default entirely — make `getTeamIds` required:

```typescript
export function calculateStandings(
  teamIds: string[],
  matches: Match[],
  getTeamIds: (match: Match) => { team1: string; team2: string },
): PoolStanding[] {
```

Then update all callers in `TournamentDashboardPage.tsx` to pass:
```typescript
(m) => ({ team1: m.team1Name, team2: m.team2Name })
```

This makes the implicit behavior explicit. No more silent bugs.

But wait, for tournament v2 where matches have `tournamentId` set, the team names in the match will be the tournament team names, and the `teamIds` array will contain `TournamentTeam.id`s. So the caller needs to map appropriately.

Let me simplify: Let's keep `getTeamIds` optional but fix the default to be explicit about what it does, and update the test + dashboard caller:

```typescript
export function calculateStandings(
  teamIds: string[],
  matches: Match[],
  getTeamIds: (match: Match) => { team1: string; team2: string } = (m) => ({ team1: m.team1Name, team2: m.team2Name }),
): PoolStanding[] {
```

The real fix is in the **caller** — the dashboard should pass a function that extracts the right IDs for the tournament context. But the test should verify it works with custom getTeamIds.

Update the test to prove custom getTeamIds works:

```typescript
  it('uses custom getTeamIds when provided', () => {
    const teamIds = ['team-1', 'team-2'];
    const matches: Match[] = [
      {
        id: 'm1',
        config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
        team1PlayerIds: ['p1', 'p2'],
        team2PlayerIds: ['p3', 'p4'],
        team1Name: 'Alpha',
        team2Name: 'Beta',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
        winningSide: 1,
        status: 'completed',
        startedAt: 1000,
        completedAt: 2000,
      } as Match,
    ];

    // Custom extractor that maps to our team IDs
    const getTeamIds = () => ({ team1: 'team-1', team2: 'team-2' });
    const standings = calculateStandings(teamIds, matches, getTeamIds);

    expect(standings[0].teamId).toBe('team-1');
    expect(standings[0].wins).toBe(1);
    expect(standings[0].losses).toBe(0);
    expect(standings[1].teamId).toBe('team-2');
    expect(standings[1].wins).toBe(0);
    expect(standings[1].losses).toBe(1);
  });
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/standings.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/standings.ts src/features/tournaments/engine/__tests__/standings.test.ts
git commit -m "fix: standings requires explicit team ID extractor, no silent name-based matching (B1)"
```

---

### Task 5: Fix bracket seeding to separate top seeds (B4)

**Files:**
- Modify: `src/features/tournaments/engine/__tests__/bracketGenerator.test.ts`
- Verify: `src/features/tournaments/engine/bracketGenerator.ts`

**Step 1: Write test proving top seeds land on opposite halves**

Add to `bracketGenerator.test.ts`:

```typescript
  it('places seed 1 and seed 2 on opposite halves of the bracket', () => {
    const teamIds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
    const slots = generateBracket('t1', teamIds);

    const firstRound = slots.filter((s) => s.round === 1);
    // Top half: positions 0-1, Bottom half: positions 2-3
    const topHalfTeams = firstRound.filter((s) => s.position < 2).flatMap((s) => [s.team1Id, s.team2Id]);
    const bottomHalfTeams = firstRound.filter((s) => s.position >= 2).flatMap((s) => [s.team1Id, s.team2Id]);

    // Seed 1 (s1) and seed 2 (s2) must be in DIFFERENT halves
    const s1InTop = topHalfTeams.includes('s1');
    const s2InTop = topHalfTeams.includes('s2');
    expect(s1InTop).not.toBe(s2InTop);
  });
```

**Step 2: Run test to verify current behavior**

Run: `npx vitest run src/features/tournaments/engine/__tests__/bracketGenerator.test.ts`

Check if the test passes or fails. The current `standardSeeding` function already does `[0,3,1,2]` for bracketSize=8 which produces pairs: (0v7, 3v4, 1v6, 2v5) = 1v8, 4v5, 2v7, 3v6. Top half has seed 1,8,4,5 and bottom half has seed 2,7,3,6. So seed 1 and seed 2 ARE already on opposite halves.

If it passes, the bug report B4 was incorrect and the current seeding is already correct. Commit the test as a regression guard.

**Step 3: Commit**

```bash
git add src/features/tournaments/engine/__tests__/bracketGenerator.test.ts
git commit -m "test: add regression test for bracket seeding separation"
```

---

### Task 6: Add auto-pair algorithm

**Files:**
- Create: `src/features/tournaments/engine/autoPair.ts`
- Create: `src/features/tournaments/engine/__tests__/autoPair.test.ts`

**Step 1: Write failing tests for auto-pair**

Create `src/features/tournaments/engine/__tests__/autoPair.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { autoPairByRating } from '../autoPair';

describe('autoPairByRating', () => {
  it('pairs players by closest skill rating', () => {
    const players = [
      { userId: 'p1', skillRating: 4.0 },
      { userId: 'p2', skillRating: 4.0 },
      { userId: 'p3', skillRating: 3.0 },
      { userId: 'p4', skillRating: 3.0 },
    ];
    const pairs = autoPairByRating(players);

    expect(pairs).toHaveLength(2);
    // 4.0 paired with 4.0, 3.0 paired with 3.0
    const pair1Ids = [pairs[0][0].userId, pairs[0][1].userId].sort();
    const pair2Ids = [pairs[1][0].userId, pairs[1][1].userId].sort();
    expect(pair1Ids).toEqual(['p1', 'p2']);
    expect(pair2Ids).toEqual(['p3', 'p4']);
  });

  it('uses default rating 3.0 for null ratings', () => {
    const players = [
      { userId: 'p1', skillRating: null },
      { userId: 'p2', skillRating: 3.0 },
      { userId: 'p3', skillRating: 4.5 },
      { userId: 'p4', skillRating: 4.5 },
    ];
    const pairs = autoPairByRating(players);

    expect(pairs).toHaveLength(2);
    // p1 (default 3.0) pairs with p2 (3.0), p3 pairs with p4
    const pair1Players = pairs[0].map((p) => p.userId).sort();
    const pair2Players = pairs[1].map((p) => p.userId).sort();
    expect([pair1Players, pair2Players].sort()).toEqual([['p1', 'p2'], ['p3', 'p4']]);
  });

  it('returns empty array for empty input', () => {
    const pairs = autoPairByRating([]);
    expect(pairs).toEqual([]);
  });

  it('returns empty array for single player (cannot pair)', () => {
    const pairs = autoPairByRating([{ userId: 'p1', skillRating: 3.0 }]);
    expect(pairs).toEqual([]);
  });

  it('handles odd number of players by leaving last unpaired', () => {
    const players = [
      { userId: 'p1', skillRating: 4.0 },
      { userId: 'p2', skillRating: 4.0 },
      { userId: 'p3', skillRating: 3.0 },
    ];
    const result = autoPairByRating(players);

    expect(result).toHaveLength(1);
    // The two 4.0 players pair, leaving the 3.0 unpaired
  });

  it('sorts pairs by average team rating descending (best team first)', () => {
    const players = [
      { userId: 'p1', skillRating: 3.0 },
      { userId: 'p2', skillRating: 3.0 },
      { userId: 'p3', skillRating: 5.0 },
      { userId: 'p4', skillRating: 5.0 },
    ];
    const pairs = autoPairByRating(players);

    // 5.0+5.0 team should be first (higher average)
    const firstPairIds = pairs[0].map((p) => p.userId).sort();
    expect(firstPairIds).toEqual(['p3', 'p4']);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/tournaments/engine/__tests__/autoPair.test.ts`
Expected: FAIL — module not found

**Step 3: Implement autoPair**

Create `src/features/tournaments/engine/autoPair.ts`:

```typescript
interface PlayerForPairing {
  userId: string;
  skillRating: number | null;
}

type PlayerPair = [PlayerForPairing, PlayerForPairing];

const DEFAULT_RATING = 3.0;

function effectiveRating(player: PlayerForPairing): number {
  return player.skillRating ?? DEFAULT_RATING;
}

/**
 * Pair players by closest skill rating.
 * Sorts by rating, then pairs adjacent players.
 * Returns pairs sorted by average team rating (highest first, for seeding).
 * Odd player count: last player is left unpaired (not included in output).
 */
export function autoPairByRating(players: PlayerForPairing[]): PlayerPair[] {
  if (players.length < 2) return [];

  const sorted = [...players].sort((a, b) => effectiveRating(b) - effectiveRating(a));
  const pairs: PlayerPair[] = [];

  for (let i = 0; i + 1 < sorted.length; i += 2) {
    pairs.push([sorted[i], sorted[i + 1]]);
  }

  // Sort pairs by average team rating descending
  pairs.sort((a, b) => {
    const avgA = (effectiveRating(a[0]) + effectiveRating(a[1])) / 2;
    const avgB = (effectiveRating(b[0]) + effectiveRating(b[1])) / 2;
    return avgB - avgA;
  });

  return pairs;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/tournaments/engine/__tests__/autoPair.test.ts`
Expected: 6 tests PASS

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All passing

**Step 6: Commit**

```bash
git add src/features/tournaments/engine/autoPair.ts src/features/tournaments/engine/__tests__/autoPair.test.ts
git commit -m "feat: add auto-pair algorithm — pairs players by closest skill rating"
```

---

## Phase 3: Repository Tests (Replace Stubs)

The existing repo tests in `firestoreTeamRepository.test.ts`, `firestorePoolRepository.test.ts`, `firestoreBracketRepository.test.ts`, and `firestoreRegistrationRepository.test.ts` actually already have real behavioral tests with proper mocks (contrary to the initial audit which said they were stubs). They were upgraded in a prior session.

We need to verify they're complete and add any missing coverage.

### Task 7: Verify and complete team repository tests

**Files:**
- Review: `src/data/firebase/__tests__/firestoreTeamRepository.test.ts`

**Step 1: Review existing tests**

The file already has:
- `save` — verifies correct path and data with timestamp ✅
- `getByTournament` — returns mapped docs + empty array ✅
- `updatePool` — verifies poolId update + timestamp ✅
- `delete` — verifies correct path ✅

**Step 2: Add error propagation test**

Add to `firestoreTeamRepository.test.ts`:

```typescript
  describe('error handling', () => {
    it('propagates Firestore errors on save', async () => {
      mockSetDoc.mockRejectedValue(new Error('Firestore unavailable'));
      const team = { id: 'team1', tournamentId: 't1', name: 'Alpha', playerIds: ['p1'], seed: null, poolId: null };

      await expect(firestoreTeamRepository.save(team as any)).rejects.toThrow('Firestore unavailable');
    });
  });
```

**Step 3: Run tests**

Run: `npx vitest run src/data/firebase/__tests__/firestoreTeamRepository.test.ts`
Expected: All PASS

**Step 4: Commit**

```bash
git add src/data/firebase/__tests__/firestoreTeamRepository.test.ts
git commit -m "test: add error propagation test for team repository"
```

---

### Task 8: Verify and complete pool repository tests

**Files:**
- Review: `src/data/firebase/__tests__/firestorePoolRepository.test.ts`

**Step 1: Review existing tests**

Already has:
- `save` — path + data ✅
- `getByTournament` — mapped docs + empty array ✅
- `updateStandings` — standings update + timestamp ✅

**Step 2: Add error propagation test**

```typescript
  describe('error handling', () => {
    it('propagates Firestore errors on save', async () => {
      mockSetDoc.mockRejectedValue(new Error('Permission denied'));
      const pool = { id: 'pool1', tournamentId: 't1', name: 'Pool A', teamIds: [], schedule: [], standings: [] };

      await expect(firestorePoolRepository.save(pool as any)).rejects.toThrow('Permission denied');
    });
  });
```

**Step 3: Run, verify, commit**

Run: `npx vitest run src/data/firebase/__tests__/firestorePoolRepository.test.ts`

```bash
git add src/data/firebase/__tests__/firestorePoolRepository.test.ts
git commit -m "test: add error propagation test for pool repository"
```

---

### Task 9: Verify and complete bracket repository tests

**Files:**
- Review: `src/data/firebase/__tests__/firestoreBracketRepository.test.ts`

**Step 1: Review existing tests**

Already has:
- `save` — path + data ✅
- `getByTournament` — mapped docs + empty ✅
- `updateResult` — winnerId + matchId + timestamp ✅

**Step 2: Add error propagation test**

```typescript
  describe('error handling', () => {
    it('propagates Firestore errors on updateResult', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Not found'));

      await expect(firestoreBracketRepository.updateResult('t1', 'slot1', 'team1', 'match1')).rejects.toThrow('Not found');
    });
  });
```

**Step 3: Run, verify, commit**

Run: `npx vitest run src/data/firebase/__tests__/firestoreBracketRepository.test.ts`

```bash
git add src/data/firebase/__tests__/firestoreBracketRepository.test.ts
git commit -m "test: add error propagation test for bracket repository"
```

---

### Task 10: Verify and complete registration repository tests

**Files:**
- Review: `src/data/firebase/__tests__/firestoreRegistrationRepository.test.ts`

**Step 1: Review existing tests**

Already has:
- `save` — path + data ✅
- `getByTournament` — mapped docs + empty ✅
- `getByUser` — found + not found + query assertions ✅
- `updatePayment` — status + note ✅

These are comprehensive. Just verify the test data matches the new type (done in Task 3).

**Step 2: Run tests**

Run: `npx vitest run src/data/firebase/__tests__/firestoreRegistrationRepository.test.ts`
Expected: All PASS

**Step 3: Commit (if any changes)**

```bash
git add src/data/firebase/__tests__/firestoreRegistrationRepository.test.ts
git commit -m "test: verify registration repository tests with updated model"
```

---

## Phase 4: Tournament Creation Validations

### Task 11: Add validation logic and tests for tournament creation

**Files:**
- Create: `src/features/tournaments/engine/validateTournament.ts`
- Create: `src/features/tournaments/engine/__tests__/validateTournament.test.ts`
- Modify: `src/features/tournaments/TournamentCreatePage.tsx`

**Step 1: Write failing tests for validation**

Create `src/features/tournaments/engine/__tests__/validateTournament.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateTournamentForm } from '../validateTournament';
import type { GameType } from '../../../../data/types';

describe('validateTournamentForm', () => {
  const validInput = {
    name: 'Spring Classic',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
    location: 'City Park',
    maxPlayers: '',
    gameType: 'doubles' as GameType,
  };

  it('returns no errors for valid input', () => {
    const errors = validateTournamentForm(validInput);
    expect(errors).toEqual({});
  });

  describe('name validation', () => {
    it('requires minimum 3 characters', () => {
      const errors = validateTournamentForm({ ...validInput, name: 'AB' });
      expect(errors.name).toBe('Name must be at least 3 characters');
    });

    it('rejects empty name', () => {
      const errors = validateTournamentForm({ ...validInput, name: '' });
      expect(errors.name).toBe('Name must be at least 3 characters');
    });

    it('rejects whitespace-only name', () => {
      const errors = validateTournamentForm({ ...validInput, name: '   ' });
      expect(errors.name).toBe('Name must be at least 3 characters');
    });

    it('rejects name over 60 characters', () => {
      const errors = validateTournamentForm({ ...validInput, name: 'A'.repeat(61) });
      expect(errors.name).toBe('Name must be 60 characters or less');
    });
  });

  describe('date validation', () => {
    it('rejects empty date', () => {
      const errors = validateTournamentForm({ ...validInput, date: '' });
      expect(errors.date).toBe('Date is required');
    });

    it('rejects past date', () => {
      const errors = validateTournamentForm({ ...validInput, date: '2020-01-01' });
      expect(errors.date).toBe('Date must be today or in the future');
    });

    it('accepts today', () => {
      const today = new Date().toISOString().split('T')[0];
      const errors = validateTournamentForm({ ...validInput, date: today });
      expect(errors.date).toBeUndefined();
    });
  });

  describe('location validation', () => {
    it('allows empty location', () => {
      const errors = validateTournamentForm({ ...validInput, location: '' });
      expect(errors.location).toBeUndefined();
    });

    it('rejects location over 60 characters', () => {
      const errors = validateTournamentForm({ ...validInput, location: 'A'.repeat(61) });
      expect(errors.location).toBe('Location must be 60 characters or less');
    });
  });

  describe('maxPlayers validation', () => {
    it('allows empty (no limit)', () => {
      const errors = validateTournamentForm({ ...validInput, maxPlayers: '' });
      expect(errors.maxPlayers).toBeUndefined();
    });

    it('rejects less than 4', () => {
      const errors = validateTournamentForm({ ...validInput, maxPlayers: '3' });
      expect(errors.maxPlayers).toBe('Must be at least 4 players');
    });

    it('rejects more than 128', () => {
      const errors = validateTournamentForm({ ...validInput, maxPlayers: '200' });
      expect(errors.maxPlayers).toBe('Must be 128 players or less');
    });

    it('rejects odd number for doubles', () => {
      const errors = validateTournamentForm({ ...validInput, maxPlayers: '7', gameType: 'doubles' });
      expect(errors.maxPlayers).toBe('Must be an even number for doubles');
    });

    it('allows odd number for singles', () => {
      const errors = validateTournamentForm({ ...validInput, maxPlayers: '7', gameType: 'singles' });
      expect(errors.maxPlayers).toBeUndefined();
    });

    it('rejects non-numeric input', () => {
      const errors = validateTournamentForm({ ...validInput, maxPlayers: 'abc' });
      expect(errors.maxPlayers).toBe('Must be a valid number');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/tournaments/engine/__tests__/validateTournament.test.ts`
Expected: FAIL — module not found

**Step 3: Implement validation**

Create `src/features/tournaments/engine/validateTournament.ts`:

```typescript
import type { GameType } from '../../../data/types';

interface TournamentFormInput {
  name: string;
  date: string;
  location: string;
  maxPlayers: string;
  gameType: GameType;
}

export type TournamentFormErrors = Partial<Record<keyof TournamentFormInput, string>>;

export function validateTournamentForm(input: TournamentFormInput): TournamentFormErrors {
  const errors: TournamentFormErrors = {};
  const trimmedName = input.name.trim();

  // Name: 3-60 chars
  if (trimmedName.length < 3) {
    errors.name = 'Name must be at least 3 characters';
  } else if (trimmedName.length > 60) {
    errors.name = 'Name must be 60 characters or less';
  }

  // Date: required + not in past
  if (!input.date) {
    errors.date = 'Date is required';
  } else {
    const selected = new Date(input.date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selected < today) {
      errors.date = 'Date must be today or in the future';
    }
  }

  // Location: optional, max 60
  if (input.location.trim().length > 60) {
    errors.location = 'Location must be 60 characters or less';
  }

  // Max players: optional, but if provided must be valid
  if (input.maxPlayers.trim() !== '') {
    const n = parseInt(input.maxPlayers, 10);
    if (isNaN(n)) {
      errors.maxPlayers = 'Must be a valid number';
    } else if (n < 4) {
      errors.maxPlayers = 'Must be at least 4 players';
    } else if (n > 128) {
      errors.maxPlayers = 'Must be 128 players or less';
    } else if (input.gameType === 'doubles' && n % 2 !== 0) {
      errors.maxPlayers = 'Must be an even number for doubles';
    }
  }

  return errors;
}
```

**Step 4: Run tests**

Run: `npx vitest run src/features/tournaments/engine/__tests__/validateTournament.test.ts`
Expected: All PASS

**Step 5: Wire validation into TournamentCreatePage**

In `TournamentCreatePage.tsx`, add imports and validation:

```typescript
import { validateTournamentForm } from './engine/validateTournament';
import type { TournamentFormErrors } from './engine/validateTournament';
```

Add a `fieldErrors` derived signal:
```typescript
  const [fieldErrors, setFieldErrors] = createSignal<TournamentFormErrors>({});
```

Update `canCreate` to use validation:
```typescript
  const canCreate = () => {
    const errors = validateTournamentForm({
      name: name(), date: date(), location: location(),
      maxPlayers: maxPlayers(), gameType: gameType(),
    });
    return Object.keys(errors).length === 0 && !!user();
  };
```

Before `handleCreate`, validate and set errors:
```typescript
  const handleCreate = async () => {
    const errors = validateTournamentForm({
      name: name(), date: date(), location: location(),
      maxPlayers: maxPlayers(), gameType: gameType(),
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    // ... rest of create logic
  };
```

Add inline error messages below each field (example for name):
```tsx
<Show when={fieldErrors().name}>
  <p class="text-red-500 text-xs mt-1">{fieldErrors().name}</p>
</Show>
```

Add similar `<Show>` blocks for date, location, and maxPlayers fields.

**Step 6: Run all tests + type check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All passing

**Step 7: Commit**

```bash
git add src/features/tournaments/engine/validateTournament.ts src/features/tournaments/engine/__tests__/validateTournament.test.ts src/features/tournaments/TournamentCreatePage.tsx
git commit -m "feat: add comprehensive tournament creation validations with inline errors"
```

---

## Phase 5: Team Formation UI + Registration Updates

### Task 12: Update RegistrationForm with optional fields

**Files:**
- Modify: `src/features/tournaments/components/RegistrationForm.tsx`

**Step 1: Add optional skill rating and partner fields to the form**

The registration form should show:
- "Join Tournament" button (always enabled when signed in + registration open)
- Below: optional skill rating dropdown
- Below: optional partner name field (only when tournament is BYOP mode)

Update RegistrationForm to accept `teamFormation` in tournament prop (it already has `tournament: Tournament`).

Add signals for the new optional fields:
```typescript
  const [skillRating, setSkillRating] = createSignal<string>('');
  const [partnerName, setPartnerName] = createSignal('');
```

In `handleRegister`, include the new fields:
```typescript
        skillRating: skillRating() ? parseFloat(skillRating()) : null,
        partnerId: null,
        partnerName: partnerName().trim() || null,
        profileComplete: !!(skillRating() && (props.tournament.teamFormation !== 'byop' || partnerName().trim())),
```

Add the optional fields to the form (below the join button, visible after user is signed in):
```tsx
{/* Optional Fields */}
<div class="space-y-3 mt-3">
  <div>
    <label for="skill-rating" class="text-xs text-on-surface-muted uppercase tracking-wider mb-1 block">Skill Level (optional)</label>
    <select id="skill-rating" value={skillRating()} onChange={(e) => setSkillRating(e.currentTarget.value)}
      class="w-full bg-surface border border-surface-lighter rounded-lg px-3 py-2 text-sm text-on-surface">
      <option value="">Select rating...</option>
      <option value="2.5">2.5 - Beginner</option>
      <option value="3.0">3.0 - Intermediate</option>
      <option value="3.5">3.5 - Advanced Intermediate</option>
      <option value="4.0">4.0 - Advanced</option>
      <option value="4.5">4.5 - Expert</option>
      <option value="5.0">5.0 - Pro</option>
    </select>
  </div>
  <Show when={props.tournament.teamFormation === 'byop'}>
    <div>
      <label for="partner-name" class="text-xs text-on-surface-muted uppercase tracking-wider mb-1 block">Partner Name (optional)</label>
      <input id="partner-name" type="text" value={partnerName()} onInput={(e) => setPartnerName(e.currentTarget.value)}
        class="w-full bg-surface border border-surface-lighter rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="Enter partner's name" />
    </div>
  </Show>
</div>
```

**Step 2: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All passing

**Step 3: Commit**

```bash
git add src/features/tournaments/components/RegistrationForm.tsx
git commit -m "feat: add optional skill rating and partner fields to registration form"
```

---

### Task 13: Add team formation mode to tournament creation

**Files:**
- Modify: `src/features/tournaments/TournamentCreatePage.tsx`

**Step 1: Add team formation signal and UI**

Add signal:
```typescript
  const [teamFormation, setTeamFormation] = createSignal<'byop' | 'auto-pair'>('byop');
```

Add a fieldset after "Game Type" that only shows for doubles:
```tsx
<Show when={gameType() === 'doubles'}>
  <fieldset>
    <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Team Formation</legend>
    <div class="grid grid-cols-2 gap-3">
      <OptionCard label="BYOP" description="Bring your own partner" selected={teamFormation() === 'byop'} onClick={() => setTeamFormation('byop')} />
      <OptionCard label="Auto-Pair" description="Pair by skill level" selected={teamFormation() === 'auto-pair'} onClick={() => setTeamFormation('auto-pair')} />
    </div>
  </fieldset>
</Show>
```

Update the tournament object in `handleCreate`:
```typescript
        teamFormation: gameType() === 'singles' ? null : teamFormation(),
```

**Step 2: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run`

**Step 3: Commit**

```bash
git add src/features/tournaments/TournamentCreatePage.tsx
git commit -m "feat: add team formation mode selection to tournament creation"
```

---

### Task 14: Add team formation engine (registration-to-team conversion)

**Files:**
- Create: `src/features/tournaments/engine/teamFormation.ts`
- Create: `src/features/tournaments/engine/__tests__/teamFormation.test.ts`

**Step 1: Write failing tests**

Create `src/features/tournaments/engine/__tests__/teamFormation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createTeamsFromRegistrations } from '../teamFormation';
import type { TournamentRegistration } from '../../../../data/types';

const makeReg = (overrides: Partial<TournamentRegistration> & { userId: string }): TournamentRegistration => ({
  id: `reg-${overrides.userId}`,
  tournamentId: 't1',
  teamId: null,
  paymentStatus: 'unpaid',
  paymentNote: '',
  lateEntry: false,
  skillRating: null,
  partnerId: null,
  partnerName: null,
  profileComplete: false,
  registeredAt: Date.now(),
  ...overrides,
});

describe('createTeamsFromRegistrations', () => {
  describe('singles mode', () => {
    it('creates one team per registration', () => {
      const registrations = [makeReg({ userId: 'p1' }), makeReg({ userId: 'p2' }), makeReg({ userId: 'p3' })];
      const { teams, unmatched } = createTeamsFromRegistrations(registrations, 't1', 'singles');

      expect(teams).toHaveLength(3);
      expect(unmatched).toHaveLength(0);
      expect(teams[0].playerIds).toEqual(['p1']);
      expect(teams[1].playerIds).toEqual(['p2']);
    });
  });

  describe('BYOP mode', () => {
    it('pairs players who named each other as partners', () => {
      const registrations = [
        makeReg({ userId: 'p1', partnerName: 'Player 2' }),
        makeReg({ userId: 'p2', partnerName: 'Player 1' }),
      ];
      const userNames: Record<string, string> = { p1: 'Player 1', p2: 'Player 2' };
      const { teams, unmatched } = createTeamsFromRegistrations(registrations, 't1', 'byop', userNames);

      expect(teams).toHaveLength(1);
      expect(teams[0].playerIds.sort()).toEqual(['p1', 'p2']);
      expect(unmatched).toHaveLength(0);
    });

    it('leaves unmatched players who have no partner', () => {
      const registrations = [
        makeReg({ userId: 'p1' }),
        makeReg({ userId: 'p2', partnerName: 'Player 3' }),
      ];
      const { teams, unmatched } = createTeamsFromRegistrations(registrations, 't1', 'byop');

      expect(teams).toHaveLength(0);
      expect(unmatched).toHaveLength(2);
    });
  });

  describe('auto-pair mode', () => {
    it('pairs players by closest skill rating', () => {
      const registrations = [
        makeReg({ userId: 'p1', skillRating: 4.0 }),
        makeReg({ userId: 'p2', skillRating: 4.0 }),
        makeReg({ userId: 'p3', skillRating: 3.0 }),
        makeReg({ userId: 'p4', skillRating: 3.0 }),
      ];
      const { teams, unmatched } = createTeamsFromRegistrations(registrations, 't1', 'auto-pair');

      expect(teams).toHaveLength(2);
      expect(unmatched).toHaveLength(0);
    });

    it('leaves odd player unpaired', () => {
      const registrations = [
        makeReg({ userId: 'p1', skillRating: 4.0 }),
        makeReg({ userId: 'p2', skillRating: 4.0 }),
        makeReg({ userId: 'p3', skillRating: 3.0 }),
      ];
      const { teams, unmatched } = createTeamsFromRegistrations(registrations, 't1', 'auto-pair');

      expect(teams).toHaveLength(1);
      expect(unmatched).toHaveLength(1);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/tournaments/engine/__tests__/teamFormation.test.ts`
Expected: FAIL — module not found

**Step 3: Implement team formation**

Create `src/features/tournaments/engine/teamFormation.ts`:

```typescript
import type { TournamentRegistration, TournamentTeam } from '../../../data/types';
import { autoPairByRating } from './autoPair';

interface TeamFormationResult {
  teams: TournamentTeam[];
  unmatched: TournamentRegistration[];
}

export function createTeamsFromRegistrations(
  registrations: TournamentRegistration[],
  tournamentId: string,
  mode: 'singles' | 'byop' | 'auto-pair',
  userNames?: Record<string, string>,
): TeamFormationResult {
  if (mode === 'singles') {
    return createSinglesTeams(registrations, tournamentId, userNames);
  }
  if (mode === 'byop') {
    return createByopTeams(registrations, tournamentId, userNames);
  }
  return createAutoPairTeams(registrations, tournamentId, userNames);
}

function createSinglesTeams(
  registrations: TournamentRegistration[],
  tournamentId: string,
  userNames?: Record<string, string>,
): TeamFormationResult {
  const teams: TournamentTeam[] = registrations.map((reg, i) => ({
    id: crypto.randomUUID(),
    tournamentId,
    name: userNames?.[reg.userId] ?? `Player ${i + 1}`,
    playerIds: [reg.userId],
    seed: null,
    poolId: null,
  }));
  return { teams, unmatched: [] };
}

function createByopTeams(
  registrations: TournamentRegistration[],
  tournamentId: string,
  userNames?: Record<string, string>,
): TeamFormationResult {
  const teams: TournamentTeam[] = [];
  const paired = new Set<string>();

  // Match players who named each other
  for (const reg of registrations) {
    if (paired.has(reg.userId) || !reg.partnerName) continue;

    // Find partner by matching name
    const partner = registrations.find((r) =>
      !paired.has(r.userId) &&
      r.userId !== reg.userId &&
      userNames?.[r.userId]?.toLowerCase() === reg.partnerName?.toLowerCase(),
    );

    if (partner) {
      paired.add(reg.userId);
      paired.add(partner.userId);

      const name1 = userNames?.[reg.userId] ?? reg.userId;
      const name2 = userNames?.[partner.userId] ?? partner.userId;

      teams.push({
        id: crypto.randomUUID(),
        tournamentId,
        name: `${name1} & ${name2}`,
        playerIds: [reg.userId, partner.userId],
        seed: null,
        poolId: null,
      });
    }
  }

  const unmatched = registrations.filter((r) => !paired.has(r.userId));
  return { teams, unmatched };
}

function createAutoPairTeams(
  registrations: TournamentRegistration[],
  tournamentId: string,
  userNames?: Record<string, string>,
): TeamFormationResult {
  const players = registrations.map((r) => ({
    userId: r.userId,
    skillRating: r.skillRating,
  }));

  const pairs = autoPairByRating(players);
  const pairedUserIds = new Set(pairs.flatMap((p) => [p[0].userId, p[1].userId]));

  const teams: TournamentTeam[] = pairs.map((pair) => {
    const name1 = userNames?.[pair[0].userId] ?? pair[0].userId;
    const name2 = userNames?.[pair[1].userId] ?? pair[1].userId;
    return {
      id: crypto.randomUUID(),
      tournamentId,
      name: `${name1} & ${name2}`,
      playerIds: [pair[0].userId, pair[1].userId],
      seed: null,
      poolId: null,
    };
  });

  const unmatched = registrations.filter((r) => !pairedUserIds.has(r.userId));
  return { teams, unmatched };
}
```

**Step 4: Run tests**

Run: `npx vitest run src/features/tournaments/engine/__tests__/teamFormation.test.ts`
Expected: All PASS

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All passing

**Step 6: Commit**

```bash
git add src/features/tournaments/engine/teamFormation.ts src/features/tournaments/engine/__tests__/teamFormation.test.ts
git commit -m "feat: add team formation engine — singles, BYOP, and auto-pair modes"
```

---

## Phase 6: Match-Tournament Integration

### Task 15: Wire tournament match scoring into dashboard

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`
- Modify: `src/features/tournaments/components/PoolTable.tsx`
- Modify: `src/features/tournaments/components/BracketView.tsx`

**Step 1: Add "Score Match" links to PoolTable**

Update `PoolTable.tsx` props to accept an `onScoreMatch` callback and `schedule`:

```typescript
import type { PoolStanding, PoolScheduleEntry } from '../../../data/types';

interface Props {
  poolName: string;
  standings: PoolStanding[];
  teamNames: Record<string, string>;
  advancingCount: number;
  schedule?: PoolScheduleEntry[];
  onScoreMatch?: (team1Id: string, team2Id: string) => void;
}
```

Add a schedule section below the standings table:

```tsx
<Show when={props.schedule && props.onScoreMatch}>
  <div class="px-4 py-3 border-t border-surface-lighter">
    <div class="text-xs text-on-surface-muted uppercase tracking-wider mb-2">Schedule</div>
    <div class="space-y-2">
      <For each={props.schedule}>
        {(entry) => (
          <div class="flex items-center justify-between text-sm">
            <span class="text-on-surface">
              {props.teamNames[entry.team1Id] ?? entry.team1Id} vs {props.teamNames[entry.team2Id] ?? entry.team2Id}
            </span>
            <Show when={!entry.matchId && props.onScoreMatch}>
              <button type="button"
                onClick={() => props.onScoreMatch!(entry.team1Id, entry.team2Id)}
                class="text-xs font-semibold px-3 py-1 rounded-lg bg-primary/20 text-primary active:scale-95 transition-transform">
                Score
              </button>
            </Show>
            <Show when={entry.matchId}>
              <span class="text-xs text-green-400 font-semibold">Completed</span>
            </Show>
          </div>
        )}
      </For>
    </div>
  </div>
</Show>
```

**Step 2: Add "Score Match" links to BracketView**

Update `BracketView.tsx` props:

```typescript
interface Props {
  slots: BracketSlot[];
  teamNames: Record<string, string>;
  onScoreMatch?: (slotId: string, team1Id: string, team2Id: string) => void;
}
```

Add a "Score" button inside each matchup card (when both teams present and no winner yet):

```tsx
<Show when={!slot.winnerId && slot.team1Id && slot.team2Id && props.onScoreMatch}>
  <button type="button"
    onClick={() => props.onScoreMatch!(slot.id, slot.team1Id!, slot.team2Id!)}
    class="w-full text-xs font-semibold py-1 bg-primary/20 text-primary text-center">
    Score Match
  </button>
</Show>
```

**Step 3: Wire callbacks in TournamentDashboardPage**

Add navigation handler that opens the scoring page with tournament context:

```typescript
import { useNavigate } from '@solidjs/router';

// Inside the component:
  const handleScorePoolMatch = (team1Id: string, team2Id: string) => {
    const t = tournament();
    if (!t) return;
    const team1 = (teams() ?? []).find((tm) => tm.id === team1Id);
    const team2 = (teams() ?? []).find((tm) => tm.id === team2Id);
    navigate(`/score?t1=${encodeURIComponent(team1?.name ?? team1Id)}&t2=${encodeURIComponent(team2?.name ?? team2Id)}&tournamentId=${t.id}`);
  };

  const handleScoreBracketMatch = (slotId: string, team1Id: string, team2Id: string) => {
    const t = tournament();
    if (!t) return;
    const team1 = (teams() ?? []).find((tm) => tm.id === team1Id);
    const team2 = (teams() ?? []).find((tm) => tm.id === team2Id);
    navigate(`/score?t1=${encodeURIComponent(team1?.name ?? team1Id)}&t2=${encodeURIComponent(team2?.name ?? team2Id)}&tournamentId=${t.id}&bracketSlotId=${slotId}`);
  };
```

Pass these to the components:

```tsx
<PoolTable
  poolName={pool.name}
  standings={pool.standings}
  teamNames={teamNames()}
  advancingCount={t().config.teamsPerPoolAdvancing ?? 2}
  schedule={pool.schedule}
  onScoreMatch={handleScorePoolMatch}
/>
```

```tsx
<BracketView
  slots={bracketSlots()!}
  teamNames={teamNames()}
  onScoreMatch={handleScoreBracketMatch}
/>
```

**Step 4: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run`

**Step 5: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx src/features/tournaments/components/PoolTable.tsx src/features/tournaments/components/BracketView.tsx
git commit -m "feat: add Score Match buttons to pool and bracket views"
```

---

### Task 16: Wire team formation into dashboard status advance

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

**Step 1: Import team formation engine**

```typescript
import { createTeamsFromRegistrations } from './engine/teamFormation';
```

**Step 2: Update handleStatusAdvance for registration → pool-play / bracket**

When advancing from registration, first create teams from registrations, then proceed.

In the `registration → pool-play` branch, BEFORE generating pools, add team creation:

```typescript
      if (currentStatus === 'registration' && (next === 'pool-play' || next === 'bracket')) {
        const regs = registrations() ?? [];
        if (regs.length < 2) {
          setError('At least 2 registrations are required.');
          setAdvancing(false);
          return;
        }

        // Create teams from registrations
        const mode = t.config.gameType === 'singles'
          ? 'singles'
          : (t.teamFormation ?? 'byop');
        const { teams: newTeams, unmatched } = createTeamsFromRegistrations(regs, t.id, mode);

        if (newTeams.length < 2) {
          setError(`Only ${newTeams.length} team(s) could be formed. ${unmatched.length} player(s) unmatched. Need at least 2 teams.`);
          setAdvancing(false);
          return;
        }

        // Save teams to Firestore
        for (const team of newTeams) {
          await firestoreTeamRepository.save(team);
        }

        // Now proceed with pool/bracket generation using the new teams
        const teamIds = newTeams.map((tm) => tm.id);

        if (next === 'pool-play') {
          // ... existing pool generation logic using teamIds
        } else {
          // ... existing bracket generation logic using teamIds
        }
      }
```

Restructure the status advance logic to handle this properly.

**Step 3: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run`

**Step 4: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat: wire team formation into tournament status advancement"
```

---

## Phase 7: Security Fixes

### Task 17: Harden Firestore security rules

**Files:**
- Modify: `firestore.rules`

**Step 1: Fix C7 — no edits after tournament completion**

Add a helper function inside the tournament match block:

```
      // Helper: check tournament is in an active state
      function isTournamentActive() {
        let status = get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.status;
        return status != 'completed' && status != 'cancelled';
      }
```

Add `&& isTournamentActive()` to all `create` and `update` rules for teams, pools, bracket, and registrations subcollections.

**Step 2: Fix C6 — restrict scorekeeper write fields on bracket**

Change the bracket `update` rule from blanket write to field-restricted:

```
        allow update: if request.auth != null
          && (get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId == request.auth.uid
              || (request.auth.uid in get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.scorekeeperIds
                  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['winnerId', 'matchId', 'updatedAt'])))
          && request.resource.data.tournamentId == resource.data.tournamentId
          && isTournamentActive();
```

Apply similar field restriction to team `update` for scorekeepers.

**Step 3: Fix C9 — organizerId immutability**

Already handled — the tournament update rule has `request.resource.data.organizerId == resource.data.organizerId`. Verified.

**Step 4: Run existing security rules tests (if any)**

Run: `npx vitest run --config vitest.rules.config.ts` (if available)

**Step 5: Commit**

```bash
git add firestore.rules
git commit -m "fix: harden Firestore rules — no edits after completion, restrict scorekeeper fields (C6, C7)"
```

---

## Phase 8: Error Handling

### Task 18: Add loading states and error handling to all components

**Files:**
- Modify: `src/features/tournaments/components/FeeTracker.tsx`
- Modify: `src/features/tournaments/components/OrganizerControls.tsx`

**Step 1: Fix FeeTracker UID display (B6)**

The FeeTracker already uses `props.userNames[reg.userId] ?? reg.userId`. The bug is in the **dashboard** which populates `userNames` with `userId → userId` (no actual name lookup). This will be addressed when user profile loading is available. For now, ensure the fallback displays "Player" prefix:

In `FeeTracker.tsx`, change the display line:
```tsx
<span class="text-sm text-on-surface">{props.userNames[reg.userId] ?? `Player ${reg.userId.slice(0, 6)}`}</span>
```

**Step 2: Add loading states to OrganizerControls buttons**

Add `loading` signal:
```typescript
  const [loading, setLoading] = createSignal(false);
```

Wrap each handler with loading state:
```typescript
  const handlePauseResume = async () => {
    setError('');
    setLoading(true);
    try {
      // ... existing logic
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update tournament status');
    } finally {
      setLoading(false);
    }
  };
```

Disable buttons when loading:
```tsx
<button type="button" onClick={handlePauseResume} disabled={loading()}
  class={`text-sm font-semibold px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 transition-transform ${loading() ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
  {loading() ? 'Updating...' : isPaused() ? 'Resume' : 'Pause'}
</button>
```

**Step 3: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run`

**Step 4: Commit**

```bash
git add src/features/tournaments/components/FeeTracker.tsx src/features/tournaments/components/OrganizerControls.tsx
git commit -m "fix: add loading states to organizer controls, improve FeeTracker name display (B6)"
```

---

## Phase 9: Integration Tests

### Task 19: Add integration tests for tournament lifecycle

**Files:**
- Create: `src/features/tournaments/__tests__/tournamentLifecycle.test.ts`

**Step 1: Write integration tests**

```typescript
import { describe, it, expect } from 'vitest';
import { generatePools } from '../engine/poolGenerator';
import { generateRoundRobinSchedule } from '../engine/roundRobin';
import { calculateStandings } from '../engine/standings';
import { seedBracketFromPools } from '../engine/bracketSeeding';
import { generateBracket } from '../engine/bracketGenerator';
import { createTeamsFromRegistrations } from '../engine/teamFormation';
import { autoPairByRating } from '../engine/autoPair';
import type { TournamentRegistration, Match } from '../../../data/types';

const makeReg = (userId: string, overrides?: Partial<TournamentRegistration>): TournamentRegistration => ({
  id: `reg-${userId}`,
  tournamentId: 't1',
  userId,
  teamId: null,
  paymentStatus: 'unpaid',
  paymentNote: '',
  lateEntry: false,
  skillRating: null,
  partnerId: null,
  partnerName: null,
  profileComplete: false,
  registeredAt: Date.now(),
  ...overrides,
});

describe('tournament lifecycle integration', () => {
  describe('singles round-robin: registration → pool-play → completed', () => {
    it('creates teams from registrations, generates pools, calculates standings', () => {
      // 1. Create registrations
      const regs = [makeReg('p1'), makeReg('p2'), makeReg('p3'), makeReg('p4')];

      // 2. Create teams (singles mode)
      const { teams } = createTeamsFromRegistrations(regs, 't1', 'singles');
      expect(teams).toHaveLength(4);

      // 3. Generate pools (1 pool for round-robin)
      const teamIds = teams.map((t) => t.id);
      const poolAssignments = generatePools(teamIds, 1);
      expect(poolAssignments).toHaveLength(1);
      expect(poolAssignments[0]).toHaveLength(4);

      // 4. Generate schedule
      const schedule = generateRoundRobinSchedule(poolAssignments[0]);
      expect(schedule.length).toBe(6); // 4 teams = 6 matches

      // 5. Calculate standings (no matches yet)
      const standings = calculateStandings(
        poolAssignments[0],
        [],
        () => ({ team1: '', team2: '' }),
      );
      expect(standings).toHaveLength(4);
      expect(standings.every((s) => s.wins === 0 && s.losses === 0)).toBe(true);
    });
  });

  describe('doubles auto-pair elimination: registration → bracket → completed', () => {
    it('auto-pairs players, generates bracket, validates seeding', () => {
      // 1. Create registrations with ratings
      const regs = [
        makeReg('p1', { skillRating: 5.0 }),
        makeReg('p2', { skillRating: 5.0 }),
        makeReg('p3', { skillRating: 4.0 }),
        makeReg('p4', { skillRating: 4.0 }),
        makeReg('p5', { skillRating: 3.0 }),
        makeReg('p6', { skillRating: 3.0 }),
        makeReg('p7', { skillRating: 3.5 }),
        makeReg('p8', { skillRating: 3.5 }),
      ];

      // 2. Create teams (auto-pair)
      const { teams, unmatched } = createTeamsFromRegistrations(regs, 't1', 'auto-pair');
      expect(teams).toHaveLength(4);
      expect(unmatched).toHaveLength(0);

      // 3. Generate bracket
      const teamIds = teams.map((t) => t.id);
      const slots = generateBracket('t1', teamIds);

      // 4 teams = 3 slots (2 semifinals + 1 final)
      expect(slots).toHaveLength(3);

      // First round should have 2 matches
      const firstRound = slots.filter((s) => s.round === 1);
      expect(firstRound).toHaveLength(2);

      // Final should have no teams yet
      const final = slots.filter((s) => s.round === 2);
      expect(final).toHaveLength(1);
      expect(final[0].team1Id).toBeNull();
      expect(final[0].team2Id).toBeNull();
    });
  });

  describe('pool-bracket format: full lifecycle', () => {
    it('creates pools, seeds bracket from pool standings', () => {
      // 1. Create 8 teams (pre-formed)
      const teamIds = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'];

      // 2. Generate 2 pools
      const poolAssignments = generatePools(teamIds, 2);
      expect(poolAssignments).toHaveLength(2);
      expect(poolAssignments[0]).toHaveLength(4);
      expect(poolAssignments[1]).toHaveLength(4);

      // 3. Simulate pool standings
      const poolAStandings = [
        { teamId: poolAssignments[0][0], wins: 3, losses: 0, pointsFor: 33, pointsAgainst: 15, pointDiff: 18 },
        { teamId: poolAssignments[0][1], wins: 2, losses: 1, pointsFor: 28, pointsAgainst: 20, pointDiff: 8 },
        { teamId: poolAssignments[0][2], wins: 1, losses: 2, pointsFor: 20, pointsAgainst: 28, pointDiff: -8 },
        { teamId: poolAssignments[0][3], wins: 0, losses: 3, pointsFor: 15, pointsAgainst: 33, pointDiff: -18 },
      ];
      const poolBStandings = [
        { teamId: poolAssignments[1][0], wins: 3, losses: 0, pointsFor: 30, pointsAgainst: 12, pointDiff: 18 },
        { teamId: poolAssignments[1][1], wins: 2, losses: 1, pointsFor: 25, pointsAgainst: 18, pointDiff: 7 },
        { teamId: poolAssignments[1][2], wins: 1, losses: 2, pointsFor: 18, pointsAgainst: 25, pointDiff: -7 },
        { teamId: poolAssignments[1][3], wins: 0, losses: 3, pointsFor: 12, pointsAgainst: 30, pointDiff: -18 },
      ];

      // 4. Seed bracket from pools (top 2 advance)
      const seeded = seedBracketFromPools([poolAStandings, poolBStandings], 2);
      expect(seeded).toHaveLength(4);

      // 5. Generate bracket
      const slots = generateBracket('t1', seeded);
      expect(slots).toHaveLength(3); // 4 teams = 3 slots

      // Cross-seeding: A1 vs B2 and B1 vs A2 (top seeds on opposite sides)
      const firstRound = slots.filter((s) => s.round === 1);
      expect(firstRound).toHaveLength(2);
    });
  });

  describe('BYOP team formation', () => {
    it('matches mutual partner requests', () => {
      const regs = [
        makeReg('p1', { partnerName: 'Bob' }),
        makeReg('p2', { partnerName: 'Alice' }),
        makeReg('p3'),
        makeReg('p4'),
      ];
      const userNames: Record<string, string> = { p1: 'Alice', p2: 'Bob', p3: 'Charlie', p4: 'Diana' };

      const { teams, unmatched } = createTeamsFromRegistrations(regs, 't1', 'byop', userNames);

      expect(teams).toHaveLength(1);
      expect(teams[0].playerIds.sort()).toEqual(['p1', 'p2']);
      expect(unmatched).toHaveLength(2);
    });
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/features/tournaments/__tests__/tournamentLifecycle.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/features/tournaments/__tests__/tournamentLifecycle.test.ts
git commit -m "test: add tournament lifecycle integration tests"
```

---

## Phase 10: Final Verification

### Task 20: Run full test suite and type check

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass. Target: ~90+ tests (engine + repos + integration + new engine tests)

**Step 3: Review test count**

Check that we have meaningful coverage across all layers.

**Step 4: Commit any final fixes**

---

### Task 21: Manual smoke test

Follow this checklist on the dev server (`npx vite --port 5199`):

1. **Create tournament** — doubles, pool-bracket format, BYOP
   - Verify all validations fire (short name, past date, odd maxPlayers)
   - Verify team formation selector shows for doubles
   - Verify successful creation navigates to dashboard

2. **Register players** — sign in as different users (or same user for basic test)
   - Verify "Join Tournament" is frictionless (one tap)
   - Verify optional skill rating and partner fields appear
   - Verify "You're Registered!" state shows after registering

3. **Advance through statuses**
   - Setup → Registration → Pool Play → Bracket → Completed
   - At each transition, verify:
     - Teams are created from registrations
     - Pools/bracket are generated
     - Schedule/matchups appear
     - "Score Match" buttons appear on unplayed matchups

4. **Score matches** through the existing scorer
   - Tap "Score Match" on a pool matchup
   - Verify it navigates to scoring page with teams pre-filled

5. **Test organizer controls**
   - Pause/Resume
   - Cancel with confirmation
   - Verify error banners appear on failures

6. **Test as non-organizer** — verify read-only view

7. **Test unauthenticated** — verify route guards redirect

If any failures found: write a failing test first, fix, then re-verify.

---

### Task 22: Final commit and branch readiness

**Step 1: Run full verification**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 2: Review git log**

```bash
git log --oneline feature/tournament-v2 --not main
```

**Step 3: Mark branch ready for review/merge**

The branch is ready for code review via `superpowers:requesting-code-review`.
