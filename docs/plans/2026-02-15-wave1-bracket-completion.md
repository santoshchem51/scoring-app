# Wave 1: Bracket Scoring + Tournament Completion

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make bracket match scoring advance winners through the bracket, and add validation + results display for tournament completion.

**Architecture:** Two independent engine functions (bracket advancement + completion validation) with integration into ScoringPage and TournamentDashboardPage. Pure logic tested first, then wired into UI.

**Tech Stack:** SolidJS, Vitest, Firebase Firestore, Dexie.js

---

## Task 1: Bracket Winner Advancement Engine

**Files:**
- Create: `src/features/tournaments/engine/bracketAdvancement.ts`
- Create: `src/features/tournaments/engine/__tests__/bracketAdvancement.test.ts`

**Context:** When a bracket match completes, the winner must advance to the next round. The `BracketSlot` has a `nextSlotId` pointing to the next round's slot. The winner should fill either `team1Id` or `team2Id` in the next slot based on position parity (even position → team1, odd → team2).

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { advanceBracketWinner } from '../bracketAdvancement';
import type { BracketSlot } from '../../../../data/types';

function slot(overrides: Partial<BracketSlot>): BracketSlot {
  return {
    id: 'slot-1',
    tournamentId: 't1',
    round: 1,
    position: 0,
    team1Id: null,
    team2Id: null,
    matchId: null,
    winnerId: null,
    nextSlotId: null,
    ...overrides,
  };
}

describe('advanceBracketWinner', () => {
  it('returns null when current slot has no nextSlotId (finals)', () => {
    const current = slot({ id: 'final', nextSlotId: null });
    const all = [current];
    const result = advanceBracketWinner(current, 'team-a', all);
    expect(result).toBeNull();
  });

  it('places winner in team1Id when current slot has even position', () => {
    const semi1 = slot({ id: 'semi1', position: 0, nextSlotId: 'final' });
    const semi2 = slot({ id: 'semi2', position: 1, nextSlotId: 'final' });
    const final = slot({ id: 'final', round: 2, position: 0 });
    const all = [semi1, semi2, final];

    const result = advanceBracketWinner(semi1, 'team-a', all);
    expect(result).toEqual({ slotId: 'final', field: 'team1Id', teamId: 'team-a' });
  });

  it('places winner in team2Id when current slot has odd position', () => {
    const semi1 = slot({ id: 'semi1', position: 0, nextSlotId: 'final' });
    const semi2 = slot({ id: 'semi2', position: 1, nextSlotId: 'final' });
    const final = slot({ id: 'final', round: 2, position: 0 });
    const all = [semi1, semi2, final];

    const result = advanceBracketWinner(semi2, 'team-b', all);
    expect(result).toEqual({ slotId: 'final', field: 'team2Id', teamId: 'team-b' });
  });

  it('returns null when next slot is not found in slots array', () => {
    const current = slot({ id: 's1', nextSlotId: 'missing' });
    const result = advanceBracketWinner(current, 'team-a', [current]);
    expect(result).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd Projects/ScoringApp && npx vitest run src/features/tournaments/engine/__tests__/bracketAdvancement.test.ts
```
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
import type { BracketSlot } from '../../../../data/types';

export interface BracketAdvanceResult {
  slotId: string;
  field: 'team1Id' | 'team2Id';
  teamId: string;
}

export function advanceBracketWinner(
  currentSlot: BracketSlot,
  winnerTeamId: string,
  allSlots: BracketSlot[],
): BracketAdvanceResult | null {
  if (!currentSlot.nextSlotId) return null;

  const nextSlot = allSlots.find((s) => s.id === currentSlot.nextSlotId);
  if (!nextSlot) return null;

  const field = currentSlot.position % 2 === 0 ? 'team1Id' : 'team2Id';
  return { slotId: nextSlot.id, field, teamId: winnerTeamId };
}
```

**Step 4: Run tests to verify they pass**

```bash
cd Projects/ScoringApp && npx vitest run src/features/tournaments/engine/__tests__/bracketAdvancement.test.ts
```
Expected: 4 passing

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/bracketAdvancement.ts src/features/tournaments/engine/__tests__/bracketAdvancement.test.ts
git commit -m "feat: add bracket winner advancement engine with tests"
```

---

## Task 2: ScoringPage Bracket Integration

**Files:**
- Modify: `src/features/scoring/ScoringPage.tsx` (saveAndFinish method)
- Modify: `src/data/firebase/firestoreBracketRepository.ts` (add getByTournament if needed, add updateSlotTeam method)

**Context:** `ScoringPage.saveAndFinish()` already handles pool matches (updates schedule + standings). For bracket matches, it needs to:
1. Call `firestoreBracketRepository.updateResult()` on the current slot (set winnerId + matchId)
2. Use `advanceBracketWinner()` to determine next slot placement
3. Update the next slot's team field in Firestore

**Step 1: Add `updateSlotTeam` method to bracket repository**

In `firestoreBracketRepository.ts`, add:

```typescript
async updateSlotTeam(
  tournamentId: string,
  slotId: string,
  field: 'team1Id' | 'team2Id',
  teamId: string,
): Promise<void> {
  const ref = doc(firestore, 'tournaments', tournamentId, 'bracket', slotId);
  await updateDoc(ref, { [field]: teamId });
},
```

**Step 2: Update ScoringPage.saveAndFinish()**

After the existing pool update block (around line 240), add bracket handling:

```typescript
// Update bracket slot if this is a bracket match
if (updatedMatch.tournamentId && updatedMatch.bracketSlotId) {
  try {
    const tournamentId = updatedMatch.tournamentId;
    const slotId = updatedMatch.bracketSlotId;

    // Determine winner team ID from match result
    const winnerTeamId = updatedMatch.winningSide === 1
      ? updatedMatch.tournamentTeam1Id
      : updatedMatch.tournamentTeam2Id;

    if (winnerTeamId) {
      // 1. Update current slot with result
      await firestoreBracketRepository.updateResult(tournamentId, slotId, winnerTeamId, updatedMatch.id);

      // 2. Advance winner to next round
      const allSlots = await firestoreBracketRepository.getByTournament(tournamentId);
      const currentSlot = allSlots.find((s) => s.id === slotId);
      if (currentSlot) {
        const advance = advanceBracketWinner(currentSlot, winnerTeamId, allSlots);
        if (advance) {
          await firestoreBracketRepository.updateSlotTeam(
            tournamentId, advance.slotId, advance.field, advance.teamId
          );
        }
      }
    }
  } catch (err) {
    console.error('Failed to update bracket:', err);
  }
}
```

Add imports at top of ScoringPage.tsx:

```typescript
import { firestoreBracketRepository } from '../../data/firebase/firestoreBracketRepository';
import { advanceBracketWinner } from '../tournaments/engine/bracketAdvancement';
```

**Step 3: Run all tests**

```bash
cd Projects/ScoringApp && npx vitest run
```
Expected: All passing (no test breakage)

**Step 4: Commit**

```bash
git add src/features/scoring/ScoringPage.tsx src/data/firebase/firestoreBracketRepository.ts
git commit -m "feat: wire bracket match completion to advance winners"
```

---

## Task 3: Tournament Completion Validation Engine

**Files:**
- Create: `src/features/tournaments/engine/completionValidation.ts`
- Create: `src/features/tournaments/engine/__tests__/completionValidation.test.ts`

**Context:** Before advancing to `completed` status, we need to validate:
- **Round-robin:** All pool schedule entries have a matchId (all matches played)
- **Single-elimination / pool-bracket:** The bracket final slot has a winnerId

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { validatePoolCompletion, validateBracketCompletion } from '../completionValidation';
import type { TournamentPool, BracketSlot } from '../../../../data/types';

describe('validatePoolCompletion', () => {
  it('returns valid when all schedule entries have matchId', () => {
    const pools: TournamentPool[] = [{
      id: 'p1', tournamentId: 't1', name: 'Pool A', teamIds: ['a', 'b'],
      schedule: [
        { round: 1, team1Id: 'a', team2Id: 'b', matchId: 'm1', court: null },
      ],
      standings: [],
    }];
    const result = validatePoolCompletion(pools);
    expect(result).toEqual({ valid: true, message: null });
  });

  it('returns invalid when schedule entries are missing matchId', () => {
    const pools: TournamentPool[] = [{
      id: 'p1', tournamentId: 't1', name: 'Pool A', teamIds: ['a', 'b', 'c'],
      schedule: [
        { round: 1, team1Id: 'a', team2Id: 'b', matchId: 'm1', court: null },
        { round: 1, team1Id: 'a', team2Id: 'c', matchId: null, court: null },
        { round: 2, team1Id: 'b', team2Id: 'c', matchId: null, court: null },
      ],
      standings: [],
    }];
    const result = validatePoolCompletion(pools);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('2');
    expect(result.message).toContain('Pool A');
  });

  it('validates across multiple pools', () => {
    const pools: TournamentPool[] = [
      {
        id: 'p1', tournamentId: 't1', name: 'Pool A', teamIds: ['a', 'b'],
        schedule: [{ round: 1, team1Id: 'a', team2Id: 'b', matchId: 'm1', court: null }],
        standings: [],
      },
      {
        id: 'p2', tournamentId: 't1', name: 'Pool B', teamIds: ['c', 'd'],
        schedule: [{ round: 1, team1Id: 'c', team2Id: 'd', matchId: null, court: null }],
        standings: [],
      },
    ];
    const result = validatePoolCompletion(pools);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Pool B');
  });

  it('returns valid for empty pools array', () => {
    const result = validatePoolCompletion([]);
    expect(result).toEqual({ valid: true, message: null });
  });
});

describe('validateBracketCompletion', () => {
  it('returns valid when the final slot has a winnerId', () => {
    const slots: BracketSlot[] = [
      { id: 's1', tournamentId: 't1', round: 1, position: 0, team1Id: 'a', team2Id: 'b', matchId: 'm1', winnerId: 'a', nextSlotId: 'final' },
      { id: 'final', tournamentId: 't1', round: 2, position: 0, team1Id: 'a', team2Id: 'c', matchId: 'm2', winnerId: 'a', nextSlotId: null },
    ];
    const result = validateBracketCompletion(slots);
    expect(result).toEqual({ valid: true, message: null, championId: 'a' });
  });

  it('returns invalid when the final slot has no winnerId', () => {
    const slots: BracketSlot[] = [
      { id: 's1', tournamentId: 't1', round: 1, position: 0, team1Id: 'a', team2Id: 'b', matchId: 'm1', winnerId: 'a', nextSlotId: 'final' },
      { id: 'final', tournamentId: 't1', round: 2, position: 0, team1Id: 'a', team2Id: null, matchId: null, winnerId: null, nextSlotId: null },
    ];
    const result = validateBracketCompletion(slots);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('final');
  });

  it('returns invalid for empty bracket', () => {
    const result = validateBracketCompletion([]);
    expect(result.valid).toBe(false);
  });

  it('identifies final as highest round slot', () => {
    const slots: BracketSlot[] = [
      { id: 'q1', tournamentId: 't1', round: 1, position: 0, team1Id: 'a', team2Id: 'b', matchId: 'm1', winnerId: 'a', nextSlotId: 's1' },
      { id: 'q2', tournamentId: 't1', round: 1, position: 1, team1Id: 'c', team2Id: 'd', matchId: 'm2', winnerId: 'c', nextSlotId: 's1' },
      { id: 's1', tournamentId: 't1', round: 2, position: 0, team1Id: 'a', team2Id: 'c', matchId: 'm3', winnerId: 'a', nextSlotId: 'f' },
      { id: 'q3', tournamentId: 't1', round: 1, position: 2, team1Id: 'e', team2Id: 'f', matchId: 'm4', winnerId: 'e', nextSlotId: 's2' },
      { id: 'q4', tournamentId: 't1', round: 1, position: 3, team1Id: 'g', team2Id: 'h', matchId: 'm5', winnerId: 'g', nextSlotId: 's2' },
      { id: 's2', tournamentId: 't1', round: 2, position: 1, team1Id: 'e', team2Id: 'g', matchId: 'm6', winnerId: 'e', nextSlotId: 'f' },
      { id: 'f', tournamentId: 't1', round: 3, position: 0, team1Id: 'a', team2Id: 'e', matchId: 'm7', winnerId: 'a', nextSlotId: null },
    ];
    const result = validateBracketCompletion(slots);
    expect(result).toEqual({ valid: true, message: null, championId: 'a' });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd Projects/ScoringApp && npx vitest run src/features/tournaments/engine/__tests__/completionValidation.test.ts
```
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
import type { TournamentPool, BracketSlot } from '../../../../data/types';

interface ValidationResult {
  valid: boolean;
  message: string | null;
}

interface BracketValidationResult extends ValidationResult {
  championId: string | null;
}

export function validatePoolCompletion(pools: TournamentPool[]): ValidationResult {
  for (const pool of pools) {
    const incomplete = pool.schedule.filter((e) => !e.matchId);
    if (incomplete.length > 0) {
      return {
        valid: false,
        message: `${incomplete.length} match(es) in ${pool.name} not yet played.`,
      };
    }
  }
  return { valid: true, message: null };
}

export function validateBracketCompletion(slots: BracketSlot[]): BracketValidationResult {
  if (slots.length === 0) {
    return { valid: false, message: 'No bracket slots found.', championId: null };
  }

  const maxRound = Math.max(...slots.map((s) => s.round));
  const finalSlot = slots.find((s) => s.round === maxRound);

  if (!finalSlot) {
    return { valid: false, message: 'No final bracket slot found.', championId: null };
  }

  if (!finalSlot.winnerId) {
    return {
      valid: false,
      message: 'The final match has not been completed yet.',
      championId: null,
    };
  }

  return { valid: true, message: null, championId: finalSlot.winnerId };
}
```

**Step 4: Run tests to verify they pass**

```bash
cd Projects/ScoringApp && npx vitest run src/features/tournaments/engine/__tests__/completionValidation.test.ts
```
Expected: All passing

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/completionValidation.ts src/features/tournaments/engine/__tests__/completionValidation.test.ts
git commit -m "feat: add tournament completion validation engine with tests"
```

---

## Task 4: Dashboard Completion Flow Integration

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`
- Create: `src/features/tournaments/components/TournamentResults.tsx`

**Context:** The dashboard needs to:
1. Validate completion prerequisites before advancing to `completed`
2. Show a results/champion view when tournament is completed

**Step 1: Add completion validation to handleStatusAdvance**

In `TournamentDashboardPage.tsx`, in `handleStatusAdvance()`, add validation before the `completed` transition.

Find the section where status advances happen. Before calling `firestoreTournamentRepository.updateStatus(t.id, next)` when `next === 'completed'`, add:

```typescript
import { validatePoolCompletion, validateBracketCompletion } from './engine/completionValidation';

// Inside handleStatusAdvance, before the updateStatus call:
if (next === 'completed') {
  // Validate round-robin completion
  if (t.format === 'round-robin') {
    const currentPools = pools() ?? [];
    const poolResult = validatePoolCompletion(currentPools);
    if (!poolResult.valid) {
      setError(poolResult.message ?? 'Not all pool matches are completed.');
      return;
    }
  }

  // Validate bracket completion
  if (t.format === 'single-elimination' || t.format === 'pool-bracket') {
    const currentSlots = bracketSlots() ?? [];
    const bracketResult = validateBracketCompletion(currentSlots);
    if (!bracketResult.valid) {
      setError(bracketResult.message ?? 'Bracket is not complete.');
      return;
    }
  }
}
```

**Step 2: Create TournamentResults component**

```tsx
import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { PoolStanding, BracketSlot } from '../../../data/types';
import type { TournamentFormat } from '../../../data/types';

interface Props {
  format: TournamentFormat;
  poolStandings?: PoolStanding[];
  bracketSlots?: BracketSlot[];
  teamNames: Record<string, string>;
}

const TournamentResults: Component<Props> = (props) => {
  const champion = () => {
    if (props.format === 'round-robin') {
      const standings = props.poolStandings ?? [];
      return standings.length > 0 ? props.teamNames[standings[0].teamId] ?? 'Unknown' : null;
    }
    const slots = props.bracketSlots ?? [];
    if (slots.length === 0) return null;
    const maxRound = Math.max(...slots.map((s) => s.round));
    const finalSlot = slots.find((s) => s.round === maxRound);
    return finalSlot?.winnerId ? (props.teamNames[finalSlot.winnerId] ?? 'Unknown') : null;
  };

  return (
    <div class="bg-surface-light rounded-xl p-6 text-center">
      <div class="text-on-surface-muted text-xs uppercase tracking-wider mb-2">Tournament Complete</div>
      <Show when={champion()}>
        <div class="text-2xl font-bold text-primary mb-1">Champion</div>
        <div class="text-xl font-semibold text-on-surface">{champion()}</div>
      </Show>
      <Show when={props.format === 'round-robin' && props.poolStandings}>
        <div class="mt-4 text-left">
          <div class="text-xs text-on-surface-muted uppercase tracking-wider mb-2">Final Standings</div>
          <div class="space-y-1">
            <For each={props.poolStandings}>
              {(standing, index) => (
                <div class="flex items-center justify-between text-sm px-2 py-1">
                  <span class="text-on-surface">
                    <span class="text-on-surface-muted mr-2">{index() + 1}.</span>
                    {props.teamNames[standing.teamId] ?? standing.teamId}
                  </span>
                  <span class="text-on-surface-muted">
                    {standing.wins}W-{standing.losses}L ({standing.pointDiff > 0 ? '+' : ''}{standing.pointDiff})
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default TournamentResults;
```

**Step 3: Add TournamentResults to dashboard**

In `TournamentDashboardPage.tsx`, add a `<Show>` block for completed tournaments:

```tsx
import TournamentResults from './components/TournamentResults';

// In the JSX, before pool/bracket views:
<Show when={tournament()?.status === 'completed'}>
  <TournamentResults
    format={tournament()!.format}
    poolStandings={pools()?.[0]?.standings}
    bracketSlots={bracketSlots() ?? undefined}
    teamNames={teamNames()}
  />
</Show>
```

**Step 4: Run all tests**

```bash
cd Projects/ScoringApp && npx vitest run
```
Expected: All passing

**Step 5: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx src/features/tournaments/components/TournamentResults.tsx
git commit -m "feat: add completion validation and tournament results view"
```

---

## Task 5: Bracket Repository Tests for New Method

**Files:**
- Modify: `src/data/firebase/__tests__/firestoreBracketRepository.test.ts`

**Context:** Add test for the new `updateSlotTeam` method.

**Step 1: Add test**

```typescript
describe('updateSlotTeam', () => {
  it('updates team1Id field on the slot', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await firestoreBracketRepository.updateSlotTeam('t1', 'slot-1', 'team1Id', 'team-a');

    expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'bracket', 'slot-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', { team1Id: 'team-a' });
  });

  it('updates team2Id field on the slot', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await firestoreBracketRepository.updateSlotTeam('t1', 'slot-2', 'team2Id', 'team-b');

    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', { team2Id: 'team-b' });
  });
});
```

**Step 2: Run tests**

```bash
cd Projects/ScoringApp && npx vitest run src/data/firebase/__tests__/firestoreBracketRepository.test.ts
```
Expected: All passing

**Step 3: Commit**

```bash
git add src/data/firebase/__tests__/firestoreBracketRepository.test.ts
git commit -m "test: add bracket repository updateSlotTeam tests"
```

---

## Task 6: E2E Verification

Manual smoke test via Playwright:
1. Create a single-elimination tournament with 4 players
2. Advance to bracket phase
3. Score first semifinal → verify winner advances to final slot
4. Score second semifinal → verify winner fills other final slot
5. Score final → verify champion determined
6. Advance to completed → verify results view shows champion
7. Test round-robin completion validation (try to complete with unplayed matches)
