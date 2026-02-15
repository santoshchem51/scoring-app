# BYOP Manual Pairing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a tap-to-pair UI so organizers can manually pair unmatched players in doubles/BYOP tournaments during the registration phase.

**Architecture:** Pure helper functions (`pairingHelpers.ts`) classify registrations into paired/unmatched groups and prepare `partnerName` updates. A new `OrganizerPairingPanel` SolidJS component renders the tap-to-pair UI. The dashboard swaps in this panel for BYOP tournaments. No data model changes — works through existing `TournamentRegistration.partnerName` field.

**Tech Stack:** SolidJS 1.9, TypeScript, Tailwind CSS v4, Vitest, Firebase Firestore

**Design doc:** `docs/plans/2026-02-15-byop-manual-pairing-design.md`

---

### Task 1: Create feature branch

**Step 1: Create and checkout branch**

```bash
cd C:\Projects\Personal_BrainStrom_Projects\Superpowers\Projects\ScoringApp
git checkout -b feature/byop-manual-pairing
```

**Step 2: Verify branch**

Run: `git branch --show-current`
Expected: `feature/byop-manual-pairing`

---

### Task 2: Pairing helpers — classifyRegistrations

**Files:**
- Create: `src/features/tournaments/engine/pairingHelpers.ts`
- Create: `src/features/tournaments/engine/__tests__/pairingHelpers.test.ts`

**Context:** The existing `createByopTeams()` in `teamFormation.ts` does mutual-name matching and returns `TournamentTeam` objects. We need a similar function that returns registration-level data (not team objects) so the UI can show who's paired and who's unmatched.

**Step 1: Write the failing tests**

```typescript
// src/features/tournaments/engine/__tests__/pairingHelpers.test.ts
import { describe, it, expect } from 'vitest';
import { classifyRegistrations } from '../pairingHelpers';
import type { TournamentRegistration } from '../../../../data/types';

const makeReg = (overrides: Partial<TournamentRegistration> & { userId: string }): TournamentRegistration => ({
  id: `reg-${overrides.userId}`,
  tournamentId: 't1',
  playerName: null,
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

describe('classifyRegistrations', () => {
  it('detects mutually-named partners as pre-paired', () => {
    const regs = [
      makeReg({ userId: 'p1', playerName: 'Alice', partnerName: 'Bob' }),
      makeReg({ userId: 'p2', playerName: 'Bob', partnerName: 'Alice' }),
    ];
    const userNames: Record<string, string> = { p1: 'Alice', p2: 'Bob' };
    const result = classifyRegistrations(regs, userNames);

    expect(result.paired).toHaveLength(1);
    expect(result.paired[0].player1.userId).toBe('p1');
    expect(result.paired[0].player2.userId).toBe('p2');
    expect(result.unmatched).toHaveLength(0);
  });

  it('leaves players without partnerName as unmatched', () => {
    const regs = [
      makeReg({ userId: 'p1', playerName: 'Alice' }),
      makeReg({ userId: 'p2', playerName: 'Bob' }),
    ];
    const userNames: Record<string, string> = { p1: 'Alice', p2: 'Bob' };
    const result = classifyRegistrations(regs, userNames);

    expect(result.paired).toHaveLength(0);
    expect(result.unmatched).toHaveLength(2);
  });

  it('handles one-sided naming as unmatched', () => {
    const regs = [
      makeReg({ userId: 'p1', playerName: 'Alice', partnerName: 'Bob' }),
      makeReg({ userId: 'p2', playerName: 'Bob' }),  // Bob didn't name Alice
    ];
    const userNames: Record<string, string> = { p1: 'Alice', p2: 'Bob' };
    const result = classifyRegistrations(regs, userNames);

    expect(result.paired).toHaveLength(0);
    expect(result.unmatched).toHaveLength(2);
  });

  it('handles mix of paired and unmatched', () => {
    const regs = [
      makeReg({ userId: 'p1', playerName: 'Alice', partnerName: 'Bob' }),
      makeReg({ userId: 'p2', playerName: 'Bob', partnerName: 'Alice' }),
      makeReg({ userId: 'p3', playerName: 'Charlie' }),
      makeReg({ userId: 'p4', playerName: 'Diana' }),
    ];
    const userNames: Record<string, string> = { p1: 'Alice', p2: 'Bob', p3: 'Charlie', p4: 'Diana' };
    const result = classifyRegistrations(regs, userNames);

    expect(result.paired).toHaveLength(1);
    expect(result.unmatched).toHaveLength(2);
    expect(result.unmatched.map((r) => r.userId).sort()).toEqual(['p3', 'p4']);
  });

  it('is case-insensitive for partner name matching', () => {
    const regs = [
      makeReg({ userId: 'p1', playerName: 'Alice', partnerName: 'BOB' }),
      makeReg({ userId: 'p2', playerName: 'Bob', partnerName: 'alice' }),
    ];
    const userNames: Record<string, string> = { p1: 'Alice', p2: 'Bob' };
    const result = classifyRegistrations(regs, userNames);

    expect(result.paired).toHaveLength(1);
  });

  it('returns empty arrays for empty registrations', () => {
    const result = classifyRegistrations([], {});
    expect(result.paired).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/tournaments/engine/__tests__/pairingHelpers.test.ts`
Expected: FAIL — `Cannot find module '../pairingHelpers'`

**Step 3: Write minimal implementation**

```typescript
// src/features/tournaments/engine/pairingHelpers.ts
import type { TournamentRegistration } from '../../../data/types';

export interface PairedTeam {
  player1: TournamentRegistration;
  player2: TournamentRegistration;
}

export interface ClassifyResult {
  paired: PairedTeam[];
  unmatched: TournamentRegistration[];
}

export function classifyRegistrations(
  registrations: TournamentRegistration[],
  userNames: Record<string, string>,
): ClassifyResult {
  const paired: PairedTeam[] = [];
  const pairedIds = new Set<string>();

  for (const reg of registrations) {
    if (pairedIds.has(reg.userId) || !reg.partnerName) continue;

    const partner = registrations.find((r) =>
      !pairedIds.has(r.userId) &&
      r.userId !== reg.userId &&
      userNames[r.userId]?.toLowerCase() === reg.partnerName?.toLowerCase() &&
      r.partnerName?.toLowerCase() === userNames[reg.userId]?.toLowerCase(),
    );

    if (partner) {
      pairedIds.add(reg.userId);
      pairedIds.add(partner.userId);
      paired.push({ player1: reg, player2: partner });
    }
  }

  const unmatched = registrations.filter((r) => !pairedIds.has(r.userId));
  return { paired, unmatched };
}
```

**Note:** Unlike `createByopTeams()` which only checks one direction (A named B), `classifyRegistrations` checks BOTH directions (A named B AND B named A). This is the "mutual" requirement.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/tournaments/engine/__tests__/pairingHelpers.test.ts`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/pairingHelpers.ts src/features/tournaments/engine/__tests__/pairingHelpers.test.ts
git commit -m "feat: add classifyRegistrations pairing helper with tests"
```

---

### Task 3: Pairing helpers — preparePairUpdate, prepareUnpairUpdate, prepareAutoPairUpdates

**Files:**
- Modify: `src/features/tournaments/engine/pairingHelpers.ts`
- Modify: `src/features/tournaments/engine/__tests__/pairingHelpers.test.ts`

**Step 1: Write the failing tests**

Add to the existing test file:

```typescript
import { classifyRegistrations, preparePairUpdate, prepareUnpairUpdate, prepareAutoPairUpdates } from '../pairingHelpers';

// ... existing tests ...

describe('preparePairUpdate', () => {
  it('returns mutual partnerName updates', () => {
    const reg1 = makeReg({ userId: 'p1', playerName: 'Alice' });
    const reg2 = makeReg({ userId: 'p2', playerName: 'Bob' });
    const result = preparePairUpdate(reg1, reg2);

    expect(result).toEqual([
      { regId: 'reg-p1', partnerName: 'Bob' },
      { regId: 'reg-p2', partnerName: 'Alice' },
    ]);
  });

  it('uses playerName for partner name (not userId)', () => {
    const reg1 = makeReg({ userId: 'manual-abc', playerName: 'Charlie' });
    const reg2 = makeReg({ userId: 'manual-xyz', playerName: 'Diana' });
    const result = preparePairUpdate(reg1, reg2);

    expect(result[0].partnerName).toBe('Diana');
    expect(result[1].partnerName).toBe('Charlie');
  });
});

describe('prepareUnpairUpdate', () => {
  it('returns null partnerName for both registrations', () => {
    const reg1 = makeReg({ userId: 'p1', playerName: 'Alice', partnerName: 'Bob' });
    const reg2 = makeReg({ userId: 'p2', playerName: 'Bob', partnerName: 'Alice' });
    const result = prepareUnpairUpdate(reg1, reg2);

    expect(result).toEqual([
      { regId: 'reg-p1', partnerName: null },
      { regId: 'reg-p2', partnerName: null },
    ]);
  });
});

describe('prepareAutoPairUpdates', () => {
  it('pairs unmatched players by skill rating and returns updates', () => {
    const unmatched = [
      makeReg({ userId: 'p1', playerName: 'Alice', skillRating: 4.0 }),
      makeReg({ userId: 'p2', playerName: 'Bob', skillRating: 4.0 }),
      makeReg({ userId: 'p3', playerName: 'Charlie', skillRating: 3.0 }),
      makeReg({ userId: 'p4', playerName: 'Diana', skillRating: 3.0 }),
    ];
    const result = prepareAutoPairUpdates(unmatched);

    expect(result).toHaveLength(2); // 2 pairs = 2 update arrays
    // Each pair is an array of 2 updates
    expect(result[0]).toHaveLength(2);
    expect(result[1]).toHaveLength(2);
    // Verify mutual naming
    for (const pair of result) {
      expect(pair[0].partnerName).not.toBeNull();
      expect(pair[1].partnerName).not.toBeNull();
    }
  });

  it('leaves odd player out', () => {
    const unmatched = [
      makeReg({ userId: 'p1', playerName: 'Alice', skillRating: 4.0 }),
      makeReg({ userId: 'p2', playerName: 'Bob', skillRating: 3.5 }),
      makeReg({ userId: 'p3', playerName: 'Charlie', skillRating: 3.0 }),
    ];
    const result = prepareAutoPairUpdates(unmatched);

    expect(result).toHaveLength(1); // only 1 pair formed
  });

  it('returns empty for fewer than 2 players', () => {
    const result = prepareAutoPairUpdates([makeReg({ userId: 'p1', playerName: 'Alice' })]);
    expect(result).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/tournaments/engine/__tests__/pairingHelpers.test.ts`
Expected: FAIL — functions not exported

**Step 3: Add implementations to pairingHelpers.ts**

Add below the existing `classifyRegistrations` function:

```typescript
import { autoPairByRating } from './autoPair';

export interface PartnerNameUpdate {
  regId: string;
  partnerName: string | null;
}

export function preparePairUpdate(
  reg1: TournamentRegistration,
  reg2: TournamentRegistration,
): [PartnerNameUpdate, PartnerNameUpdate] {
  return [
    { regId: reg1.id, partnerName: reg2.playerName },
    { regId: reg2.id, partnerName: reg1.playerName },
  ];
}

export function prepareUnpairUpdate(
  reg1: TournamentRegistration,
  reg2: TournamentRegistration,
): [PartnerNameUpdate, PartnerNameUpdate] {
  return [
    { regId: reg1.id, partnerName: null },
    { regId: reg2.id, partnerName: null },
  ];
}

export function prepareAutoPairUpdates(
  unmatched: TournamentRegistration[],
): [PartnerNameUpdate, PartnerNameUpdate][] {
  const players = unmatched.map((r) => ({
    userId: r.userId,
    skillRating: r.skillRating,
  }));

  const pairs = autoPairByRating(players);
  const updates: [PartnerNameUpdate, PartnerNameUpdate][] = [];

  for (const [p1, p2] of pairs) {
    const reg1 = unmatched.find((r) => r.userId === p1.userId)!;
    const reg2 = unmatched.find((r) => r.userId === p2.userId)!;
    updates.push(preparePairUpdate(reg1, reg2));
  }

  return updates;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/tournaments/engine/__tests__/pairingHelpers.test.ts`
Expected: All 12 tests PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/pairingHelpers.ts src/features/tournaments/engine/__tests__/pairingHelpers.test.ts
git commit -m "feat: add pair/unpair/auto-pair helper functions with tests"
```

---

### Task 4: Add updatePartnerName to registration repository

**Files:**
- Modify: `src/data/firebase/firestoreRegistrationRepository.ts`

**Context:** The pairing panel needs to update a registration's `partnerName` field. The existing repository has `save()` (full overwrite) and `updatePayment()` but nothing for `partnerName`. Add a targeted update method.

**Step 1: Add the method**

Add to the `firestoreRegistrationRepository` object in `src/data/firebase/firestoreRegistrationRepository.ts`:

```typescript
async updatePartnerName(tournamentId: string, regId: string, partnerName: string | null): Promise<void> {
  const ref = doc(firestore, 'tournaments', tournamentId, 'registrations', regId);
  await updateDoc(ref, { partnerName, updatedAt: serverTimestamp() });
},
```

**Step 2: Run existing tests**

Run: `npx vitest run`
Expected: All tests PASS (no regressions)

**Step 3: Commit**

```bash
git add src/data/firebase/firestoreRegistrationRepository.ts
git commit -m "feat: add updatePartnerName to registration repository"
```

---

### Task 5: Build OrganizerPairingPanel component

**Files:**
- Create: `src/features/tournaments/components/OrganizerPairingPanel.tsx`

**Context:** This SolidJS component renders the tap-to-pair UI. It receives registrations as props, classifies them into paired/unmatched, and handles the pairing interactions.

**SolidJS rules (CRITICAL):**
- `import type` for type-only imports
- Use `class` NOT `className`
- NEVER destructure props — always use `props.foo`
- Use `createSignal` for local state, `createMemo` for derived values
- Use `Show`, `For` for conditional/list rendering

**Step 1: Create the component**

```typescript
// src/features/tournaments/components/OrganizerPairingPanel.tsx
import { createSignal, createMemo, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { TournamentRegistration } from '../../../data/types';
import { classifyRegistrations, preparePairUpdate, prepareUnpairUpdate, prepareAutoPairUpdates } from '../engine/pairingHelpers';
import type { PairedTeam } from '../engine/pairingHelpers';
import { firestoreRegistrationRepository } from '../../../data/firebase/firestoreRegistrationRepository';

interface Props {
  tournamentId: string;
  registrations: TournamentRegistration[];
  userNames: Record<string, string>;
  onUpdated: () => void;
}

const OrganizerPairingPanel: Component<Props> = (props) => {
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);

  const classified = createMemo(() =>
    classifyRegistrations(props.registrations, props.userNames),
  );

  const handlePlayerTap = async (reg: TournamentRegistration) => {
    if (saving()) return;

    const current = selectedId();
    if (current === reg.userId) {
      // Deselect
      setSelectedId(null);
      return;
    }

    if (current === null) {
      // First selection
      setSelectedId(reg.userId);
      return;
    }

    // Second selection — pair them
    const firstReg = props.registrations.find((r) => r.userId === current);
    if (!firstReg) return;

    setSaving(true);
    try {
      const updates = preparePairUpdate(firstReg, reg);
      await firestoreRegistrationRepository.updatePartnerName(props.tournamentId, updates[0].regId, updates[0].partnerName);
      await firestoreRegistrationRepository.updatePartnerName(props.tournamentId, updates[1].regId, updates[1].partnerName);
      setSelectedId(null);
      props.onUpdated();
    } catch (err) {
      console.error('Failed to pair players:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUnpair = async (pair: PairedTeam) => {
    if (saving()) return;
    setSaving(true);
    try {
      const updates = prepareUnpairUpdate(pair.player1, pair.player2);
      await firestoreRegistrationRepository.updatePartnerName(props.tournamentId, updates[0].regId, updates[0].partnerName);
      await firestoreRegistrationRepository.updatePartnerName(props.tournamentId, updates[1].regId, updates[1].partnerName);
      props.onUpdated();
    } catch (err) {
      console.error('Failed to unpair team:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoPair = async () => {
    if (saving()) return;
    const unmatched = classified().unmatched;
    if (unmatched.length < 2) return;

    setSaving(true);
    try {
      const allUpdates = prepareAutoPairUpdates(unmatched);
      for (const [u1, u2] of allUpdates) {
        await firestoreRegistrationRepository.updatePartnerName(props.tournamentId, u1.regId, u1.partnerName);
        await firestoreRegistrationRepository.updatePartnerName(props.tournamentId, u2.regId, u2.partnerName);
      }
      setSelectedId(null);
      props.onUpdated();
    } catch (err) {
      console.error('Failed to auto-pair:', err);
    } finally {
      setSaving(false);
    }
  };

  const playerName = (reg: TournamentRegistration) =>
    props.userNames[reg.userId] ?? reg.playerName ?? `Player ${reg.userId.slice(0, 6)}`;

  return (
    <div class="space-y-4">
      {/* Unmatched Players */}
      <Show when={classified().unmatched.length > 0}>
        <div class="bg-surface-light rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="text-xs text-on-surface-muted uppercase tracking-wider">
              Unmatched Players ({classified().unmatched.length})
            </div>
            <Show when={classified().unmatched.length >= 2}>
              <button type="button" onClick={handleAutoPair} disabled={saving()}
                class={`text-xs font-semibold px-3 py-1 rounded-lg bg-primary/20 text-primary transition-transform ${saving() ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
                Auto-pair remaining
              </button>
            </Show>
          </div>

          <Show when={selectedId()}>
            <p class="text-xs text-primary mb-2">Tap another player to pair</p>
          </Show>

          <div class="grid grid-cols-2 gap-2">
            <For each={classified().unmatched}>
              {(reg) => (
                <button type="button" onClick={() => handlePlayerTap(reg)}
                  disabled={saving()}
                  class={`text-left rounded-lg px-3 py-2 transition-all ${
                    selectedId() === reg.userId
                      ? 'bg-primary/20 ring-2 ring-primary'
                      : 'bg-surface hover:bg-surface-lighter'
                  } ${saving() ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
                  <div class="text-sm font-medium text-on-surface truncate">{playerName(reg)}</div>
                  <Show when={reg.skillRating}>
                    <div class="text-xs text-on-surface-muted">{reg.skillRating} rating</div>
                  </Show>
                </button>
              )}
            </For>
          </div>

          <Show when={classified().unmatched.length === 1}>
            <p class="text-xs text-amber-400 mt-2">1 player unmatched — add another player or remove this one</p>
          </Show>
        </div>
      </Show>

      {/* Paired Teams */}
      <Show when={classified().paired.length > 0}>
        <div class="bg-surface-light rounded-xl p-4">
          <div class="text-xs text-on-surface-muted uppercase tracking-wider mb-3">
            Paired Teams ({classified().paired.length})
          </div>
          <div class="space-y-2">
            <For each={classified().paired}>
              {(pair) => (
                <div class="flex items-center justify-between bg-surface rounded-lg px-3 py-2">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-on-surface truncate">
                      {playerName(pair.player1)} & {playerName(pair.player2)}
                    </div>
                    <Show when={pair.player1.skillRating || pair.player2.skillRating}>
                      <div class="text-xs text-on-surface-muted">
                        Combined: {((pair.player1.skillRating ?? 3.0) + (pair.player2.skillRating ?? 3.0)).toFixed(1)}
                      </div>
                    </Show>
                  </div>
                  <button type="button" onClick={() => handleUnpair(pair)}
                    disabled={saving()}
                    class={`ml-2 text-xs font-semibold px-2 py-1 rounded-lg text-red-400 bg-red-400/10 transition-transform ${saving() ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
                    Unpair
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* All paired summary */}
      <Show when={classified().unmatched.length === 0 && classified().paired.length > 0}>
        <div class="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <p class="text-green-400 text-sm font-semibold">All players paired! Ready to advance.</p>
        </div>
      </Show>
    </div>
  );
};

export default OrganizerPairingPanel;
```

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/features/tournaments/components/OrganizerPairingPanel.tsx
git commit -m "feat: add OrganizerPairingPanel tap-to-pair component"
```

---

### Task 6: Wire OrganizerPairingPanel into TournamentDashboardPage

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx:470-485`

**Context:** Currently, the registration phase shows `OrganizerPlayerManager` (for adding players) and `RegistrationForm` (for self-registration). For BYOP tournaments, we need to also show `OrganizerPairingPanel` below the player manager so the organizer can pair unmatched players.

**Step 1: Add import**

Add to the imports section of `TournamentDashboardPage.tsx`:

```typescript
import OrganizerPairingPanel from './components/OrganizerPairingPanel';
```

**Step 2: Add pairing panel to registration section**

Find the registration section (currently lines 470-485):

```typescript
{/* Registration Section */}
<Show when={t().status === 'registration'}>
  <div class="space-y-4">
    <Show when={isOrganizer()}>
      <OrganizerPlayerManager
        tournament={t()}
        registrations={registrations() ?? []}
        onUpdated={handleRegistered}
      />
    </Show>
    <RegistrationForm
      tournament={t()}
      existingRegistration={existingRegistration()}
      onRegistered={handleRegistered}
    />
  </div>
</Show>
```

Replace with:

```typescript
{/* Registration Section */}
<Show when={t().status === 'registration'}>
  <div class="space-y-4">
    <Show when={isOrganizer()}>
      <OrganizerPlayerManager
        tournament={t()}
        registrations={registrations() ?? []}
        onUpdated={handleRegistered}
      />
      <Show when={t().config.gameType === 'doubles' && t().teamFormation === 'byop'}>
        <OrganizerPairingPanel
          tournamentId={t().id}
          registrations={registrations() ?? []}
          userNames={userNames()}
          onUpdated={handleRegistered}
        />
      </Show>
    </Show>
    <RegistrationForm
      tournament={t()}
      existingRegistration={existingRegistration()}
      onRegistered={handleRegistered}
    />
  </div>
</Show>
```

**Step 3: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat: wire OrganizerPairingPanel into dashboard for BYOP tournaments"
```

---

### Task 7: E2E verification — BYOP manual pairing flow

**Context:** Verify the full BYOP manual pairing flow end-to-end using the dev server + Firebase emulators.

**Prerequisites:**
- Firebase emulators running (Auth on 9099, Firestore on 8180)
- Dev server running (`npx vite --port 5199`)

**Test scenario:**

1. Create a new tournament:
   - Format: Single Elimination
   - Game type: Doubles
   - Team formation: BYOP
   - Scoring: Rally, 11 points
   - Name: "BYOP Pairing Test"

2. Add 4 players (organizer adds all manually):
   - Alice (skill 4.0)
   - Bob (skill 4.0)
   - Charlie (skill 3.0)
   - Diana (skill 3.0)

3. Verify Unmatched Players section:
   - All 4 players show as unmatched cards
   - "Auto-pair remaining" button is visible

4. Manual pair test:
   - Tap Alice → she highlights with primary ring
   - Tap Bob → both move to "Paired Teams" section
   - Verify "Alice & Bob" appears as a paired team

5. Auto-pair test:
   - Click "Auto-pair remaining" for Charlie + Diana
   - Verify "Charlie & Diana" appears as paired team
   - Verify "All players paired! Ready to advance." message

6. Unpair test:
   - Click "Unpair" on Alice & Bob
   - Verify both return to unmatched list
   - Re-pair them manually

7. Advance to bracket:
   - Click "Advance to Bracket Play"
   - Verify bracket generated with 2 teams
   - Verify team names show correctly

8. Score and complete:
   - Score semifinal → winner advances
   - Score final → champion displayed
   - Advance to completed → "TOURNAMENT COMPLETE" shown

**Step 1: Run the E2E test manually via Playwright**

Verify each step above works correctly.

**Step 2: Update the gaps doc**

Mark Gap #1 (BYOP Manual Pairing) as RESOLVED in `docs/plans/2026-02-15-tournament-v2-gaps-and-testing.md` with commit references and E2E verification notes.

**Step 3: Commit**

```bash
git add docs/plans/2026-02-15-tournament-v2-gaps-and-testing.md
git commit -m "docs: mark BYOP manual pairing gap as resolved"
```
