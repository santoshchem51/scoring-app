# Match Re-scoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow organizers to correct scores on completed pool and bracket matches via a score edit modal, with automatic standings recalculation and bracket safety guards.

**Architecture:** New `rescoring.ts` engine with pure functions for winner derivation, score validation, and bracket safety checks. New `ScoreEditModal.tsx` component for direct score editing. "Edit" buttons added to `PoolTable` and `BracketView`. Dashboard wires modal state and handles save with pool recalc / bracket updates.

**Tech Stack:** SolidJS 1.9 + TypeScript + Vitest + Tailwind CSS v4

---

### Task 1: Create feature branch

**Step 1: Create and switch to feature branch**

```bash
cd C:\Projects\Personal_BrainStrom_Projects\Superpowers\Projects\ScoringApp
git checkout -b feature/match-rescoring
```

Expected: Branch created, on `feature/match-rescoring`.

---

### Task 2: Write rescoring engine — derive winner from games

**Files:**
- Create: `src/features/tournaments/engine/rescoring.ts`
- Create: `src/features/tournaments/engine/__tests__/rescoring.test.ts`

**Step 1: Write the failing tests for `deriveWinnerFromGames`**

```typescript
// src/features/tournaments/engine/__tests__/rescoring.test.ts
import { describe, it, expect } from 'vitest';
import { deriveWinnerFromGames } from '../rescoring';
import type { GameResult } from '../../../../data/types';

function game(team1Score: number, team2Score: number, gameNumber: number): GameResult {
  return {
    gameNumber,
    team1Score,
    team2Score,
    winningSide: team1Score > team2Score ? 1 : 2,
  };
}

describe('deriveWinnerFromGames', () => {
  it('returns side 1 when team1 wins single game', () => {
    const games = [game(11, 5, 1)];
    expect(deriveWinnerFromGames(games)).toBe(1);
  });

  it('returns side 2 when team2 wins single game', () => {
    const games = [game(5, 11, 1)];
    expect(deriveWinnerFromGames(games)).toBe(2);
  });

  it('returns side 1 when team1 wins 2-1 in best-of-3', () => {
    const games = [game(11, 7, 1), game(5, 11, 2), game(11, 9, 3)];
    expect(deriveWinnerFromGames(games)).toBe(1);
  });

  it('returns side 2 when team2 wins 2-0 in best-of-3', () => {
    const games = [game(5, 11, 1), game(8, 11, 2)];
    expect(deriveWinnerFromGames(games)).toBe(2);
  });

  it('returns side 1 when team1 wins 3-2 in best-of-5', () => {
    const games = [
      game(11, 5, 1), game(5, 11, 2), game(11, 9, 3),
      game(7, 11, 4), game(11, 8, 5),
    ];
    expect(deriveWinnerFromGames(games)).toBe(1);
  });

  it('returns null for empty games array', () => {
    expect(deriveWinnerFromGames([])).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/engine/__tests__/rescoring.test.ts`
Expected: FAIL — `deriveWinnerFromGames` is not defined

**Step 3: Write minimal implementation**

```typescript
// src/features/tournaments/engine/rescoring.ts
import type { GameResult, BracketSlot } from '../../../data/types';

/**
 * Derive the match winner from game results.
 * Returns 1 if team1 wins majority of games, 2 if team2, null if no games.
 */
export function deriveWinnerFromGames(games: GameResult[]): 1 | 2 | null {
  if (games.length === 0) return null;

  let team1Wins = 0;
  let team2Wins = 0;

  for (const g of games) {
    if (g.team1Score > g.team2Score) team1Wins++;
    else team2Wins++;
  }

  return team1Wins > team2Wins ? 1 : 2;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/rescoring.test.ts`
Expected: 6 tests PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/rescoring.ts src/features/tournaments/engine/__tests__/rescoring.test.ts
git commit -m "feat: add deriveWinnerFromGames rescoring function with tests"
```

---

### Task 3: Write rescoring engine — validate game scores

**Files:**
- Modify: `src/features/tournaments/engine/rescoring.ts`
- Modify: `src/features/tournaments/engine/__tests__/rescoring.test.ts`

**Step 1: Write the failing tests for `validateGameScores`**

Append to the test file:

```typescript
import { validateGameScores } from '../rescoring';

describe('validateGameScores', () => {
  it('returns valid for correct single game scores', () => {
    const result = validateGameScores([game(11, 5, 1)]);
    expect(result).toEqual({ valid: true });
  });

  it('returns invalid when a game has a tie', () => {
    const tiedGame: GameResult = { gameNumber: 1, team1Score: 8, team2Score: 8, winningSide: 1 };
    const result = validateGameScores([tiedGame]);
    expect(result).toEqual({ valid: false, message: 'Game 1: scores cannot be tied.' });
  });

  it('returns invalid for empty games array', () => {
    const result = validateGameScores([]);
    expect(result).toEqual({ valid: false, message: 'At least one game is required.' });
  });

  it('returns valid for best-of-3 with 2 games (sweep)', () => {
    const result = validateGameScores([game(11, 5, 1), game(11, 7, 2)]);
    expect(result).toEqual({ valid: true });
  });

  it('returns valid for best-of-3 with 3 games', () => {
    const result = validateGameScores([game(11, 5, 1), game(5, 11, 2), game(11, 9, 3)]);
    expect(result).toEqual({ valid: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/engine/__tests__/rescoring.test.ts`
Expected: FAIL — `validateGameScores` is not defined

**Step 3: Write minimal implementation**

Add to `rescoring.ts`:

```typescript
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validate that edited game scores are well-formed:
 * - At least one game
 * - No ties (each game has a clear winner)
 */
export function validateGameScores(games: GameResult[]): ValidationResult {
  if (games.length === 0) {
    return { valid: false, message: 'At least one game is required.' };
  }

  for (const g of games) {
    if (g.team1Score === g.team2Score) {
      return { valid: false, message: `Game ${g.gameNumber}: scores cannot be tied.` };
    }
  }

  return { valid: true };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/rescoring.test.ts`
Expected: 11 tests PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/rescoring.ts src/features/tournaments/engine/__tests__/rescoring.test.ts
git commit -m "feat: add validateGameScores rescoring function with tests"
```

---

### Task 4: Write rescoring engine — bracket re-score safety check

**Files:**
- Modify: `src/features/tournaments/engine/rescoring.ts`
- Modify: `src/features/tournaments/engine/__tests__/rescoring.test.ts`

**Step 1: Write the failing tests for `checkBracketRescoreSafety`**

Append to the test file:

```typescript
import { checkBracketRescoreSafety } from '../rescoring';
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

describe('checkBracketRescoreSafety', () => {
  it('returns safe when winner stays the same', () => {
    const current = slot({ id: 's1', team1Id: 'A', team2Id: 'B', winnerId: 'A', nextSlotId: 'final' });
    const final = slot({ id: 'final', round: 2 });
    const result = checkBracketRescoreSafety(current, 'A', [current, final]);
    expect(result).toEqual({ safe: true });
  });

  it('returns safe when winner changes but next match has no matchId', () => {
    const current = slot({ id: 's1', team1Id: 'A', team2Id: 'B', winnerId: 'A', nextSlotId: 'final' });
    const final = slot({ id: 'final', round: 2, matchId: null });
    const result = checkBracketRescoreSafety(current, 'B', [current, final]);
    expect(result).toEqual({ safe: true });
  });

  it('returns unsafe when winner changes and next match has started', () => {
    const current = slot({ id: 's1', team1Id: 'A', team2Id: 'B', winnerId: 'A', nextSlotId: 'final' });
    const final = slot({ id: 'final', round: 2, matchId: 'match-final' });
    const result = checkBracketRescoreSafety(current, 'B', [current, final]);
    expect(result).toEqual({ safe: false, message: 'Cannot change winner — the next round match has already started.' });
  });

  it('returns safe for finals (no next slot) regardless of winner change', () => {
    const final = slot({ id: 'final', team1Id: 'A', team2Id: 'B', winnerId: 'A', nextSlotId: null });
    const result = checkBracketRescoreSafety(final, 'B', [final]);
    expect(result).toEqual({ safe: true });
  });

  it('returns safe when winner changes and next slot not found in array', () => {
    const current = slot({ id: 's1', team1Id: 'A', team2Id: 'B', winnerId: 'A', nextSlotId: 'missing' });
    const result = checkBracketRescoreSafety(current, 'B', [current]);
    expect(result).toEqual({ safe: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/engine/__tests__/rescoring.test.ts`
Expected: FAIL — `checkBracketRescoreSafety` is not defined

**Step 3: Write minimal implementation**

Add to `rescoring.ts`:

```typescript
export interface BracketSafetyResult {
  safe: boolean;
  message?: string;
}

/**
 * Check if re-scoring a bracket match is safe.
 * Safe when:
 * - Winner stays the same
 * - Winner changes but next round match hasn't started (nextSlot.matchId is null)
 * - Finals match (no nextSlotId)
 * Unsafe when:
 * - Winner changes and next round match has started (nextSlot.matchId is not null)
 */
export function checkBracketRescoreSafety(
  currentSlot: BracketSlot,
  newWinnerTeamId: string,
  allSlots: BracketSlot[],
): BracketSafetyResult {
  // Winner stays the same — always safe
  if (currentSlot.winnerId === newWinnerTeamId) {
    return { safe: true };
  }

  // Finals or no next slot — safe to change winner
  if (!currentSlot.nextSlotId) {
    return { safe: true };
  }

  const nextSlot = allSlots.find((s) => s.id === currentSlot.nextSlotId);
  if (!nextSlot) {
    return { safe: true };
  }

  // Next match already started — block
  if (nextSlot.matchId) {
    return { safe: false, message: 'Cannot change winner — the next round match has already started.' };
  }

  return { safe: true };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/rescoring.test.ts`
Expected: 16 tests PASS

**Step 5: Run all tests to verify no regressions**

Run: `npx vitest run`
Expected: 190+ tests PASS (190 existing + 16 new = 206)

**Step 6: Commit**

```bash
git add src/features/tournaments/engine/rescoring.ts src/features/tournaments/engine/__tests__/rescoring.test.ts
git commit -m "feat: add checkBracketRescoreSafety rescoring function with tests"
```

---

### Task 5: Create ScoreEditModal component

**Files:**
- Create: `src/features/tournaments/components/ScoreEditModal.tsx`

**Context:**
- SolidJS modal component with number inputs for game scores
- Receives match data, renders editable game scores, validates, calls back with corrected data
- Uses `createSignal` for local editing state, `For` to render game rows
- Calls `validateGameScores` and `deriveWinnerFromGames` on save
- Team names, current games pre-filled in inputs
- Best-of-3/5: show all played games as rows
- Buttons: "Cancel" and "Save"
- Inline error display for validation failures

**Step 1: Write the component**

```typescript
// src/features/tournaments/components/ScoreEditModal.tsx
import { createSignal, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { GameResult } from '../../../data/types';
import { validateGameScores, deriveWinnerFromGames } from '../engine/rescoring';

export interface ScoreEditData {
  games: GameResult[];
  winningSide: 1 | 2;
}

interface Props {
  open: boolean;
  team1Name: string;
  team2Name: string;
  games: GameResult[];
  onSave: (data: ScoreEditData) => void;
  onCancel: () => void;
  /** Optional error message from parent (e.g., bracket safety check failure) */
  externalError?: string;
}

const ScoreEditModal: Component<Props> = (props) => {
  const [editedGames, setEditedGames] = createSignal<GameResult[]>([]);
  const [error, setError] = createSignal('');

  // Reset edited games when modal opens with new data
  const initGames = () => {
    setEditedGames(props.games.map((g) => ({ ...g })));
    setError('');
  };

  // Initialize on each open
  const isOpen = () => {
    if (props.open) initGames();
    return props.open;
  };

  const updateScore = (gameIndex: number, field: 'team1Score' | 'team2Score', value: number) => {
    setEditedGames((prev) =>
      prev.map((g, i) => (i === gameIndex ? { ...g, [field]: Math.max(0, value) } : g)),
    );
  };

  const handleSave = () => {
    const games = editedGames();

    // Re-derive winningSide for each game based on edited scores
    const correctedGames: GameResult[] = games.map((g) => ({
      ...g,
      winningSide: g.team1Score > g.team2Score ? (1 as const) : (2 as const),
    }));

    const validation = validateGameScores(correctedGames);
    if (!validation.valid) {
      setError(validation.message ?? 'Invalid scores.');
      return;
    }

    const winningSide = deriveWinnerFromGames(correctedGames);
    if (!winningSide) {
      setError('Could not determine match winner.');
      return;
    }

    props.onSave({ games: correctedGames, winningSide });
  };

  return (
    <Show when={isOpen()}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div class="bg-surface rounded-2xl w-full max-w-sm overflow-hidden">
          {/* Header */}
          <div class="px-4 py-3 bg-surface-light border-b border-surface-lighter">
            <h2 class="font-bold text-on-surface text-sm">
              Edit Score — {props.team1Name} vs {props.team2Name}
            </h2>
          </div>

          {/* Game Scores */}
          <div class="p-4 space-y-3">
            <For each={editedGames()}>
              {(game, index) => (
                <div class="flex items-center gap-3">
                  <span class="text-xs text-on-surface-muted w-16 shrink-0">Game {game.gameNumber}</span>
                  <div class="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      min="0"
                      value={game.team1Score}
                      onInput={(e) => updateScore(index(), 'team1Score', parseInt(e.currentTarget.value) || 0)}
                      class="w-16 text-center bg-surface-light border border-surface-lighter rounded-lg px-2 py-2 text-on-surface font-semibold text-sm"
                    />
                    <span class="text-on-surface-muted text-xs">-</span>
                    <input
                      type="number"
                      min="0"
                      value={game.team2Score}
                      onInput={(e) => updateScore(index(), 'team2Score', parseInt(e.currentTarget.value) || 0)}
                      class="w-16 text-center bg-surface-light border border-surface-lighter rounded-lg px-2 py-2 text-on-surface font-semibold text-sm"
                    />
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Error Display */}
          <Show when={error() || props.externalError}>
            <div class="px-4 pb-2">
              <p class="text-red-400 text-xs">{error() || props.externalError}</p>
            </div>
          </Show>

          {/* Buttons */}
          <div class="px-4 py-3 flex gap-3 border-t border-surface-lighter">
            <button
              type="button"
              onClick={() => props.onCancel()}
              class="flex-1 py-2 text-sm font-semibold text-on-surface-muted bg-surface-light rounded-lg active:scale-95 transition-transform"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              class="flex-1 py-2 text-sm font-semibold text-surface bg-primary rounded-lg active:scale-95 transition-transform"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ScoreEditModal;
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/components/ScoreEditModal.tsx
git commit -m "feat: add ScoreEditModal component for match re-scoring"
```

---

### Task 6: Add "Edit" button to PoolTable

**Files:**
- Modify: `src/features/tournaments/components/PoolTable.tsx`

**Context:**
- Add `onEditMatch` callback prop (optional, organizer-only)
- Show "Edit" button next to "Completed" text in the schedule section
- Passes `poolId`, `team1Id`, `team2Id`, and `matchId` back to parent

**Step 1: Add the prop and edit button**

In `PoolTable.tsx`, add to the `Props` interface:

```typescript
onEditMatch?: (poolId: string, matchId: string, team1Id: string, team2Id: string) => void;
```

In the schedule section, modify the `Completed` fallback span to include an "Edit" button when `onEditMatch` is provided:

Replace the existing "Completed" `<Show>` fallback (around line 63-65):

```typescript
<Show when={entry.matchId}>
  <div class="flex items-center gap-2">
    <span class="text-xs text-green-400 font-semibold">Completed</span>
    <Show when={props.onEditMatch}>
      <button type="button"
        onClick={() => props.onEditMatch!(props.poolId, entry.matchId!, entry.team1Id, entry.team2Id)}
        class="text-xs font-semibold px-2 py-0.5 rounded bg-surface-lighter text-on-surface-muted active:scale-95 transition-transform">
        Edit
      </button>
    </Show>
  </div>
</Show>
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/components/PoolTable.tsx
git commit -m "feat: add Edit button to PoolTable completed matches"
```

---

### Task 7: Add "Edit" button to BracketView

**Files:**
- Modify: `src/features/tournaments/components/BracketView.tsx`

**Context:**
- Add `onEditMatch` callback prop (optional, organizer-only)
- Show "Edit" button on completed bracket slots (when `slot.winnerId` exists)
- Passes `slotId`, `team1Id`, `team2Id`, and `matchId` back to parent

**Step 1: Add the prop and edit button**

In `BracketView.tsx`, add to the `Props` interface:

```typescript
onEditMatch?: (slotId: string, matchId: string, team1Id: string, team2Id: string) => void;
```

After the existing "Score Match" `<Show>` block (around line 63-69), add a new `<Show>` for completed slots:

```typescript
<Show when={slot.winnerId && slot.matchId && props.onEditMatch}>
  <button type="button"
    onClick={() => props.onEditMatch!(slot.id, slot.matchId!, slot.team1Id!, slot.team2Id!)}
    class="w-full text-xs font-semibold py-1 bg-surface-lighter text-on-surface-muted text-center active:scale-95 transition-transform">
    Edit
  </button>
</Show>
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/tournaments/components/BracketView.tsx
git commit -m "feat: add Edit button to BracketView completed matches"
```

---

### Task 8: Wire ScoreEditModal into TournamentDashboardPage

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

**Context:**
- Add modal state signals: `editingMatch` (the Match object being edited), `editingContext` (pool/bracket metadata), `editModalError`
- Add import for `ScoreEditModal`, `checkBracketRescoreSafety`, `deriveWinnerFromGames`, `advanceBracketWinner`
- Handler `handleEditPoolMatch`: fetches match from local DB, opens modal
- Handler `handleEditBracketMatch`: fetches match from local DB, opens modal
- Handler `handleSaveEditedScore`: validates, updates match in DB + Firestore, recalculates pool standings or updates bracket, closes modal
- Pass `onEditMatch` to `PoolTable` and `BracketView` (organizer-only, guarded by `isOrganizer()`)
- Render `ScoreEditModal` at bottom of component

**Step 1: Add imports**

Add these imports at the top of the file:

```typescript
import ScoreEditModal from './components/ScoreEditModal';
import type { ScoreEditData } from './components/ScoreEditModal';
import { checkBracketRescoreSafety } from './engine/rescoring';
import { advanceBracketWinner } from './engine/bracketAdvancement';
```

**Step 2: Add state signals**

After the existing `advancing` signal (around line 56):

```typescript
const [editingMatch, setEditingMatch] = createSignal<Match | null>(null);
const [editingContext, setEditingContext] = createSignal<{
  type: 'pool' | 'bracket';
  poolId?: string;
  slotId?: string;
  team1Id: string;
  team2Id: string;
} | null>(null);
const [editModalError, setEditModalError] = createSignal('');
```

**Step 3: Add handler functions**

After `handleScoreBracketMatch` (around line 407):

```typescript
const handleEditPoolMatch = async (poolId: string, matchId: string, team1Id: string, team2Id: string) => {
  try {
    const match = await matchRepository.getById(matchId);
    if (!match) {
      setError('Match not found.');
      return;
    }
    setEditingMatch(match);
    setEditingContext({ type: 'pool', poolId, team1Id, team2Id });
    setEditModalError('');
  } catch (err) {
    console.error('Failed to load match for editing:', err);
    setError('Failed to load match data.');
  }
};

const handleEditBracketMatch = async (slotId: string, matchId: string, team1Id: string, team2Id: string) => {
  try {
    const match = await matchRepository.getById(matchId);
    if (!match) {
      setError('Match not found.');
      return;
    }
    setEditingMatch(match);
    setEditingContext({ type: 'bracket', slotId, team1Id, team2Id });
    setEditModalError('');
  } catch (err) {
    console.error('Failed to load match for editing:', err);
    setError('Failed to load match data.');
  }
};

const handleCancelEdit = () => {
  setEditingMatch(null);
  setEditingContext(null);
  setEditModalError('');
};

const handleSaveEditedScore = async (data: ScoreEditData) => {
  const match = editingMatch();
  const ctx = editingContext();
  const t = tournament();
  if (!match || !ctx || !t) return;

  try {
    // For bracket matches, check safety before saving
    if (ctx.type === 'bracket' && ctx.slotId) {
      const slots = bracketSlots() ?? [];
      const currentSlot = slots.find((s) => s.id === ctx.slotId);
      if (currentSlot) {
        const newWinnerTeamId = data.winningSide === 1 ? ctx.team1Id : ctx.team2Id;
        const safety = checkBracketRescoreSafety(currentSlot, newWinnerTeamId, slots);
        if (!safety.safe) {
          setEditModalError(safety.message ?? 'Cannot change bracket winner.');
          return;
        }
      }
    }

    // Update match record
    const updatedMatch: Match = {
      ...match,
      games: data.games,
      winningSide: data.winningSide,
    };
    await matchRepository.save(updatedMatch);
    cloudSync.syncMatchToCloud(updatedMatch);

    // Pool match: recalculate standings
    if (ctx.type === 'pool' && ctx.poolId) {
      const pool = await firestorePoolRepository.getById(t.id, ctx.poolId);
      if (pool) {
        const allMatches = await matchRepository.getAll();
        const poolMatches = allMatches.filter(
          (m) => m.tournamentId === t.id && m.poolId === ctx.poolId && m.status === 'completed',
        );

        const standings = calculateStandings(
          pool.teamIds,
          poolMatches,
          (m) => ({ team1: m.tournamentTeam1Id ?? '', team2: m.tournamentTeam2Id ?? '' }),
        );

        await firestorePoolRepository.updateScheduleAndStandings(
          t.id, ctx.poolId, pool.schedule, standings,
        );
      }
    }

    // Bracket match: update winner if changed
    if (ctx.type === 'bracket' && ctx.slotId) {
      const slots = bracketSlots() ?? [];
      const currentSlot = slots.find((s) => s.id === ctx.slotId);
      if (currentSlot) {
        const newWinnerTeamId = data.winningSide === 1 ? ctx.team1Id : ctx.team2Id;

        // Update current slot result
        await firestoreBracketRepository.updateResult(t.id, ctx.slotId, newWinnerTeamId, match.id);

        // If winner changed and there's a next slot, update next slot's team assignment
        if (currentSlot.winnerId !== newWinnerTeamId && currentSlot.nextSlotId) {
          const advance = advanceBracketWinner(currentSlot, newWinnerTeamId, slots);
          if (advance) {
            await firestoreBracketRepository.updateSlotTeam(t.id, advance.slotId, advance.field, advance.teamId);
          }
        }
      }
    }

    // Close modal and refresh data
    setEditingMatch(null);
    setEditingContext(null);
    setEditModalError('');
    refetchPools();
    refetchBracket();
  } catch (err) {
    console.error('Failed to save edited score:', err);
    setEditModalError(err instanceof Error ? err.message : 'Failed to save score.');
  }
};
```

**Step 4: Pass `onEditMatch` to PoolTable and BracketView**

In the PoolTable render (around line 512-520), add the prop (only when organizer):

```typescript
<PoolTable
  poolId={pool.id}
  poolName={pool.name}
  standings={pool.standings}
  teamNames={teamNames()}
  advancingCount={t().config.teamsPerPoolAdvancing ?? 2}
  schedule={pool.schedule}
  onScoreMatch={handleScorePoolMatch}
  onEditMatch={isOrganizer() ? handleEditPoolMatch : undefined}
/>
```

In the BracketView render (around line 530-533), add the prop:

```typescript
<BracketView
  slots={bracketSlots()!}
  teamNames={teamNames()}
  onScoreMatch={handleScoreBracketMatch}
  onEditMatch={isOrganizer() ? handleEditBracketMatch : undefined}
/>
```

**Step 5: Render ScoreEditModal**

Just before the closing `</>` of the main `Show` children (before line 557), add:

```typescript
{/* Score Edit Modal */}
<Show when={editingMatch()}>
  {(match) => (
    <ScoreEditModal
      open={true}
      team1Name={match().team1Name}
      team2Name={match().team2Name}
      games={match().games}
      onSave={handleSaveEditedScore}
      onCancel={handleCancelEdit}
      externalError={editModalError()}
    />
  )}
</Show>
```

**Step 6: Add `cloudSync` import if not already present**

Verify `cloudSync` import exists. If not, add:

```typescript
import { cloudSync } from '../../data/firebase/cloudSync';
```

**Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 8: Run all tests**

Run: `npx vitest run`
Expected: 206 tests PASS (no regressions)

**Step 9: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat: wire ScoreEditModal into tournament dashboard for pool and bracket re-scoring"
```

---

### Task 9: E2E Verification — Pool Match Re-scoring

**Context:** Use Playwright MCP to verify the full pool match re-scoring flow.

**Flow:**
1. Navigate to the running app (`http://localhost:5199`)
2. Sign in with test user
3. Create a round-robin tournament (4 players, rally scoring, points to 11)
4. Register 4 players
5. Advance to Pool Play
6. Score 1 pool match with specific scores (e.g., 11-5)
7. Verify standings updated
8. Click "Edit" on the completed match
9. Change scores in the modal (e.g., 11-8)
10. Save
11. Verify standings recalculated correctly with new scores

**Verification points:**
- Edit button visible next to "Completed" (organizer only)
- Modal opens with pre-filled scores
- Scores can be edited via number inputs
- Save updates standings
- Cancel closes modal without changes

---

### Task 10: E2E Verification — Bracket Match Re-scoring

**Context:** Use Playwright MCP to verify bracket re-scoring with winner-same and winner-change scenarios.

**Flow:**
1. Navigate to the running app
2. Create a single-elimination tournament (4 players)
3. Advance to Bracket
4. Score semifinal 1: Team A wins 11-5
5. Score semifinal 2: Team B wins 11-7
6. **Test 1 — Winner stays same:** Edit semifinal 1 scores to 11-8 (A still wins). Verify save succeeds, winner unchanged.
7. **Test 2 — Winner changes, next not started:** Edit semifinal 1 scores to 5-11 (B now wins). Verify save succeeds (final hasn't started), next slot team updated.
8. Score the final match
9. **Test 3 — Winner changes, next started:** Edit semifinal 2 scores to 7-11. Verify error: "Cannot change winner — the next round match has already started."
10. Advance to Completed, verify champion displayed correctly

**Verification points:**
- Edit button visible on completed bracket matches
- Winner-same re-score works
- Winner-change re-score blocked when next match started
- Winner-change re-score allowed when next match not started
- Bracket slot team assignment updated on winner change
