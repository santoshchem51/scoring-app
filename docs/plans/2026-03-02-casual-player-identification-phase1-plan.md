# Casual Player Identification — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix phantom stats (Issue #3) and scorer team assignment for casual matches by adding `scorerRole` / `scorerTeam` fields and updating stats processing logic.

**Architecture:** Two optional fields (`scorerRole`, `scorerTeam`) on the `Match` interface control whether the scorer gets stats and which team they're on. The `resolveParticipantUids` function is updated to respect these fields, with pre-existing bug fixes (winningSide null, dedup guard). A progressive-disclosure "Your Role" UI section is added to GameSetupPage.

**Tech Stack:** SolidJS 1.9 + TypeScript + Vitest + Tailwind CSS v4 + Firebase/Firestore

**Design doc:** `docs/plans/2026-03-02-casual-player-identification-design.md`

---

### Task 1: Add `scorerRole` and `scorerTeam` to Match interface

**Files:**
- Modify: `src/data/types.ts:27-48`

**Step 1: Add the two optional fields to the Match interface**

Add after line 47 (`lastSnapshot?: string | null;`):

```typescript
  scorerRole?: 'player' | 'spectator';  // undefined = 'player' (backward compat)
  scorerTeam?: 1 | 2;                    // undefined = 1 (backward compat)
```

**Step 2: Verify type check passes**

Run: `npx tsc --noEmit`
Expected: No errors (new fields are optional, nothing references them yet)

**Step 3: Commit**

```bash
git add src/data/types.ts
git commit -m "feat: add scorerRole and scorerTeam to Match interface"
```

---

### Task 2: Add winningSide null early guard in resolveParticipantUids

Pre-existing bug: when `winningSide === null`, the expression `match.winningSide === 1 ? 'win' : 'loss'` produces `'loss'` for everyone. Fix: early return with empty participants.

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts:114-170`
- Test: `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`

**Step 1: Write the failing test**

Add to the test file, in a new describe block:

```typescript
describe('winningSide null guard', () => {
  it('returns no participants when winningSide is null (abandoned match)', async () => {
    const match = makeCasualMatch({ winningSide: null, status: 'abandoned' });

    // Set up transaction mocks: matchRef not exists, stats not exists
    mockTransactionGet.mockResolvedValue({ exists: () => false });

    await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

    // No stats should be written — transaction.set never called
    expect(mockTransactionSet).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: FAIL — the current code still produces a participant with `result: 'loss'`

**Step 3: Add the early guard**

In `src/data/firebase/firestorePlayerStatsRepository.ts`, add at the very start of `resolveParticipantUids` (line 118, after the `participants` declaration):

```typescript
  // Early guard: no stats for abandoned matches (winningSide is null)
  if (match.winningSide === null) return [];
```

The function should now look like:

```typescript
async function resolveParticipantUids(
  match: Match,
  scorerUid: string,
): Promise<Array<{ uid: string; playerTeam: 1 | 2; result: 'win' | 'loss' }>> {
  const participants: Array<{ uid: string; playerTeam: 1 | 2; result: 'win' | 'loss' }> = [];

  // Early guard: no stats for abandoned matches (winningSide is null)
  if (match.winningSide === null) return [];

  const isTournamentMatch = // ... rest unchanged
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts
git commit -m "fix: add winningSide null guard in resolveParticipantUids"
```

---

### Task 3: Replace casual path with scorerRole/scorerTeam-aware logic

Replace the casual match path in `resolveParticipantUids` to support:
- Phase 2+ player IDs in team arrays (future-ready)
- `scorerRole === 'spectator'` → no stats for scorer
- `scorerTeam` → scorer gets stats for correct team

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts:163-167`
- Test: `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`

**Step 1: Write the failing tests**

Add a new describe block:

```typescript
describe('casual path with scorerRole/scorerTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: matchRef doesn't exist, stats doc doesn't exist
    mockTransactionGet.mockResolvedValue({ exists: () => false });
    mockGetDoc.mockResolvedValue({ exists: () => false });
  });

  it('spectator scorer gets no stats', async () => {
    const match = makeCasualMatch({ scorerRole: 'spectator' });

    await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

    expect(mockTransactionSet).not.toHaveBeenCalled();
  });

  it('scorer on team 2 gets correct result when team 2 wins', async () => {
    const match = makeCasualMatch({
      scorerRole: 'player',
      scorerTeam: 2,
      winningSide: 2,
    });

    await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

    // Should have written matchRef + stats
    expect(mockTransactionSet).toHaveBeenCalled();
    const matchRefArg = mockTransactionSet.mock.calls[0][1] as MatchRef;
    expect(matchRefArg.playerTeam).toBe(2);
    expect(matchRefArg.result).toBe('win');
  });

  it('scorer on team 2 gets loss when team 1 wins', async () => {
    const match = makeCasualMatch({
      scorerRole: 'player',
      scorerTeam: 2,
      winningSide: 1,
    });

    await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

    expect(mockTransactionSet).toHaveBeenCalled();
    const matchRefArg = mockTransactionSet.mock.calls[0][1] as MatchRef;
    expect(matchRefArg.playerTeam).toBe(2);
    expect(matchRefArg.result).toBe('loss');
  });

  it('undefined scorerRole defaults to player (backward compat)', async () => {
    const match = makeCasualMatch(); // no scorerRole, no scorerTeam

    await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

    expect(mockTransactionSet).toHaveBeenCalled();
    const matchRefArg = mockTransactionSet.mock.calls[0][1] as MatchRef;
    expect(matchRefArg.playerTeam).toBe(1);
    expect(matchRefArg.result).toBe('win'); // winningSide defaults to 1 in makeMatch
  });

  it('respects team1PlayerIds/team2PlayerIds when populated (Phase 2+ ready)', async () => {
    const match = makeCasualMatch({
      team1PlayerIds: ['uid-A'],
      team2PlayerIds: ['uid-B'],
      winningSide: 1,
    });

    await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

    // Both players should get stats
    expect(mockRunTransaction).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: Multiple FAIL — spectator test fails (scorer still gets stats), team 2 tests fail (always assigned team 1), playerIds test fails (Phase 2 logic not implemented)

**Step 3: Replace the casual path**

In `src/data/firebase/firestorePlayerStatsRepository.ts`, replace lines 163-167:

**OLD** (current casual path):
```typescript
  // Casual match: only scorer gets stats
  if (!isTournamentMatch && participants.length === 0) {
    const result: 'win' | 'loss' = match.winningSide === 1 ? 'win' : 'loss';
    participants.push({ uid: scorerUid, playerTeam: 1, result });
  }
```

**NEW:**
```typescript
  // Casual match: give stats to linked players, fallback to scorer
  if (!isTournamentMatch) {
    const team1Uids = match.team1PlayerIds ?? [];
    const team2Uids = match.team2PlayerIds ?? [];

    // Phase 2+: if player IDs populated, give all linked players stats
    for (const uid of team1Uids) {
      const result: 'win' | 'loss' = match.winningSide === 1 ? 'win' : 'loss';
      participants.push({ uid, playerTeam: 1, result });
    }
    for (const uid of team2Uids) {
      const result: 'win' | 'loss' = match.winningSide === 2 ? 'win' : 'loss';
      participants.push({ uid, playerTeam: 2, result });
    }

    // Fallback: scorer gets stats if no playerIds and not spectating
    if (participants.length === 0 && match.scorerRole !== 'spectator') {
      const team: 1 | 2 = match.scorerTeam ?? 1;
      const result: 'win' | 'loss' = match.winningSide === team ? 'win' : 'loss';
      participants.push({ uid: scorerUid, playerTeam: team, result });
    }
  }
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts
git commit -m "feat: scorerRole/scorerTeam-aware casual path in resolveParticipantUids"
```

---

### Task 4: Extract dedup guard to shared position

Move the duplicate UID guard from inside the tournament `try` block to the bottom of `resolveParticipantUids`, so it covers both tournament and casual paths.

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts:144-155` and bottom of function
- Test: `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`

**Step 1: Write the failing test**

```typescript
describe('dedup guard (shared)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransactionGet.mockResolvedValue({ exists: () => false });
    mockGetDoc.mockResolvedValue({ exists: () => false });
  });

  it('deduplicates UIDs in casual team arrays', async () => {
    const match = makeCasualMatch({
      team1PlayerIds: ['uid-A'],
      team2PlayerIds: ['uid-A'],  // same UID on both teams — corrupted data
      winningSide: 1,
    });

    await firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid');

    // Should only process uid-A once (first occurrence wins)
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: FAIL — uid-A appears twice, `mockRunTransaction` called 2 times

**Step 3: Move the dedup guard**

In `resolveParticipantUids`:

1. **Remove** the existing dedup block from inside the tournament `try` (lines 144-155). Change the tournament path to just `return participants;` after the loop (the dedup guard at the bottom will handle it).

2. **Add** the shared dedup guard at the bottom of the function, just before the final `return`:

The function ending should become:

```typescript
    // ... end of casual path

  }

  // Shared dedup guard: remove duplicate UIDs (first occurrence wins)
  const seen = new Set<string>();
  const deduped: typeof participants = [];
  for (const p of participants) {
    if (seen.has(p.uid)) {
      console.warn('Duplicate UID across teams, skipping:', p.uid);
      continue;
    }
    seen.add(p.uid);
    deduped.push(p);
  }
  return deduped;
}
```

**Important**: The tournament path's `return deduped;` inside the try block must change to just adding participants and falling through. Restructure the tournament path to not return early — let execution flow to the shared dedup at the bottom.

Full revised function:

```typescript
async function resolveParticipantUids(
  match: Match,
  scorerUid: string,
): Promise<Array<{ uid: string; playerTeam: 1 | 2; result: 'win' | 'loss' }>> {
  const participants: Array<{ uid: string; playerTeam: 1 | 2; result: 'win' | 'loss' }> = [];

  // Early guard: no stats for abandoned matches (winningSide is null)
  if (match.winningSide === null) return [];

  const isTournamentMatch = !!(match.tournamentId && (match.tournamentTeam1Id || match.tournamentTeam2Id));

  if (isTournamentMatch) {
    // Tournament match: look up registrations to find UIDs
    try {
      const regsSnapshot = await getDocs(
        collection(firestore, 'tournaments', match.tournamentId!, 'registrations'),
      );
      const registrations = regsSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Array<{ id: string; userId: string; teamId: string }>;

      for (const reg of registrations) {
        if (!reg.userId) continue;
        const isTeam1 = reg.teamId === match.tournamentTeam1Id;
        const isTeam2 = reg.teamId === match.tournamentTeam2Id;
        if (!isTeam1 && !isTeam2) continue;

        const playerTeam: 1 | 2 = isTeam1 ? 1 : 2;
        const result: 'win' | 'loss' = match.winningSide === playerTeam ? 'win' : 'loss';
        participants.push({ uid: reg.userId, playerTeam, result });
      }
    } catch (err) {
      // Return empty — don't fall through to casual path and give scorer phantom stats
      console.warn('Failed to resolve tournament participant UIDs, skipping stats:', err);
      return [];
    }
  }

  // Casual match: give stats to linked players, fallback to scorer
  if (!isTournamentMatch) {
    const team1Uids = match.team1PlayerIds ?? [];
    const team2Uids = match.team2PlayerIds ?? [];

    for (const uid of team1Uids) {
      const result: 'win' | 'loss' = match.winningSide === 1 ? 'win' : 'loss';
      participants.push({ uid, playerTeam: 1, result });
    }
    for (const uid of team2Uids) {
      const result: 'win' | 'loss' = match.winningSide === 2 ? 'win' : 'loss';
      participants.push({ uid, playerTeam: 2, result });
    }

    if (participants.length === 0 && match.scorerRole !== 'spectator') {
      const team: 1 | 2 = match.scorerTeam ?? 1;
      const result: 'win' | 'loss' = match.winningSide === team ? 'win' : 'loss';
      participants.push({ uid: scorerUid, playerTeam: team, result });
    }
  }

  // Shared dedup guard: remove duplicate UIDs (first occurrence wins)
  const seen = new Set<string>();
  const deduped: typeof participants = [];
  for (const p of participants) {
    if (seen.has(p.uid)) {
      console.warn('Duplicate UID across teams, skipping:', p.uid);
      continue;
    }
    seen.add(p.uid);
    deduped.push(p);
  }
  return deduped;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: PASS (all existing tournament dedup tests still pass + new casual dedup test passes)

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts
git commit -m "refactor: extract dedup guard to shared position in resolveParticipantUids"
```

---

### Task 5: Add scorerRole/scorerTeam to pullCloudMatchesToLocal

The `pullCloudMatchesToLocal` function explicitly maps fields from CloudMatch to local Match. New fields must be mapped or they'll be silently dropped during cloud→local sync.

**Files:**
- Modify: `src/data/firebase/cloudSync.ts:47-67`
- Test: `src/data/firebase/__tests__/cloudSync.test.ts`

**Step 1: Write the failing test**

In the cloudSync test file, add a test that verifies the new fields are preserved during pull:

```typescript
it('preserves scorerRole and scorerTeam when pulling cloud matches', async () => {
  mockGetByOwner.mockResolvedValueOnce([
    makeCloudMatch({
      scorerRole: 'spectator',
      scorerTeam: 2,
    }),
  ]);

  await cloudSync.pullCloudMatchesToLocal();

  const savedMatch = mockSave.mock.calls[0][0];
  expect(savedMatch.scorerRole).toBe('spectator');
  expect(savedMatch.scorerTeam).toBe(2);
});
```

Note: Check the existing test file for the exact mock names (`mockGetByOwner`, `mockSave`, `makeCloudMatch`) — adapt to match existing patterns.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/cloudSync.test.ts`
Expected: FAIL — `scorerRole` and `scorerTeam` are `undefined` on the saved match

**Step 3: Add the field mapping**

In `src/data/firebase/cloudSync.ts`, add to the `localMatch` object inside `pullCloudMatchesToLocal` (after line 67, `court: cloudMatch.court,`):

```typescript
          scorerRole: cloudMatch.scorerRole,
          scorerTeam: cloudMatch.scorerTeam,
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/cloudSync.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/cloudSync.ts src/data/firebase/__tests__/cloudSync.test.ts
git commit -m "fix: map scorerRole/scorerTeam in pullCloudMatchesToLocal"
```

---

### Task 6: Add "Your Role" section to GameSetupPage

Add a progressive-disclosure "Your Role" section that lets the scorer declare whether they're playing or scoring for others, and which team they're on.

**Files:**
- Modify: `src/features/scoring/GameSetupPage.tsx`

**Step 1: Add signals for scorerRole, scorerTeam, and expanded state**

After line 24 (`const [team2Color, setTeam2Color] = ...`), add:

```typescript
  const [scorerRole, setScorerRole] = createSignal<'player' | 'spectator'>('player');
  const [scorerTeam, setScorerTeam] = createSignal<1 | 2>(1);
  const [roleExpanded, setRoleExpanded] = createSignal(false);
```

**Step 2: Wire scorerRole/scorerTeam into startGame()**

In the `startGame` function, add to the Match object (after `completedAt: null,` on line 49):

```typescript
      scorerRole: scorerRole(),
      scorerTeam: scorerTeam(),
```

**Step 3: Wire silent defaults into quickStart()**

In the `quickStart` function, add to the Match object (after `completedAt: null,` on line 83):

```typescript
      scorerRole: 'player',
      scorerTeam: 1,
```

**Step 4: Add the "Your Role" UI section**

After the closing `</div>` of the two-column grid (line 197), before `</div>` and `</PageLayout>` (line 198), add:

```tsx
        {/* Your Role */}
        <div class="mt-6">
          <Show
            when={roleExpanded()}
            fallback={
              <div class="flex items-center justify-between bg-surface-light rounded-xl px-4 py-3">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-on-surface-muted">Your Role:</span>
                  <span class="text-sm font-semibold text-on-surface">
                    {scorerRole() === 'player' ? "I'm Playing" : 'Scoring for Others'}
                  </span>
                  <Show when={scorerRole() === 'player'}>
                    <span
                      class="inline-block w-3 h-3 rounded-full"
                      style={{ "background-color": scorerTeam() === 1 ? team1Color() : team2Color() }}
                    />
                  </Show>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleExpanded(true)}
                  class="text-sm text-primary font-semibold"
                >
                  Change
                </button>
              </div>
            }
          >
            <fieldset>
              <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Your Role</legend>
              <div class="grid grid-cols-2 gap-3">
                <OptionCard
                  label="I'm Playing"
                  description="Track your stats"
                  selected={scorerRole() === 'player'}
                  onClick={() => setScorerRole('player')}
                />
                <OptionCard
                  label="Scoring for Others"
                  description="No stats for you"
                  selected={scorerRole() === 'spectator'}
                  onClick={() => setScorerRole('spectator')}
                />
              </div>
              <Show when={scorerRole() === 'player'}>
                <div class="mt-3">
                  <p class="text-sm text-on-surface-muted mb-2">Which team are you on?</p>
                  <div class="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setScorerTeam(1)}
                      class={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                        scorerTeam() === 1
                          ? 'border-primary bg-primary/20 text-on-surface'
                          : 'border-surface-lighter bg-surface-light text-on-surface-muted'
                      }`}
                    >
                      <span
                        class="inline-block w-3 h-3 rounded-full"
                        style={{ "background-color": team1Color() }}
                      />
                      <span class="text-sm font-semibold">{team1Name() || 'Team 1'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setScorerTeam(2)}
                      class={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                        scorerTeam() === 2
                          ? 'border-primary bg-primary/20 text-on-surface'
                          : 'border-surface-lighter bg-surface-light text-on-surface-muted'
                      }`}
                    >
                      <span
                        class="inline-block w-3 h-3 rounded-full"
                        style={{ "background-color": team2Color() }}
                      />
                      <span class="text-sm font-semibold">{team2Name() || 'Team 2'}</span>
                    </button>
                  </div>
                </div>
              </Show>
              <button
                type="button"
                onClick={() => setRoleExpanded(false)}
                class="mt-3 text-sm text-on-surface-muted underline"
              >
                Done
              </button>
            </fieldset>
          </Show>
        </div>
```

**Step 5: Add the import for `Show`**

Update line 2:

```typescript
import { createSignal, Show } from 'solid-js';
```

**Step 6: Verify it renders**

Run: `npx vite --port 5199`
Navigate to `/setup` and confirm:
- Collapsed "Your Role: I'm Playing [Change]" appears below team names
- Clicking "Change" expands to show OptionCards + team selector
- Selecting "Scoring for Others" hides team selector
- Team selector shows team color dots and names

**Step 7: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add src/features/scoring/GameSetupPage.tsx
git commit -m "feat: add Your Role section to GameSetupPage"
```

---

### Task 7: Add team indicator to ScoringPage

Add a persistent "You're on Team X" indicator at the top of the scoring screen so the scorer can verify their team selection.

**Files:**
- Modify: `src/features/scoring/ScoringPage.tsx:285-302`

**Step 1: Add the indicator**

In `ScoringView`, after the `{/* Match info header */}` div (line 302), add:

```tsx
        {/* Scorer team indicator (casual matches only) */}
        <Show when={!props.match.tournamentId && props.match.scorerRole !== 'spectator'}>
          <div class="flex items-center justify-center gap-2 px-4">
            <span
              class="inline-block w-2.5 h-2.5 rounded-full"
              style={{
                "background-color": (props.match.scorerTeam ?? 1) === 1
                  ? (props.match.team1Color ?? DEFAULT_TEAM1_COLOR)
                  : (props.match.team2Color ?? DEFAULT_TEAM2_COLOR),
              }}
            />
            <span class="text-xs text-on-surface-muted">
              You're on {(props.match.scorerTeam ?? 1) === 1 ? props.match.team1Name : props.match.team2Name}
            </span>
          </div>
        </Show>
```

**Step 2: Add `Show` to imports if not already present**

Check line 1 — `Show` is already imported.

**Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/features/scoring/ScoringPage.tsx
git commit -m "feat: add scorer team indicator to ScoringPage"
```

---

### Task 8: Run full test suite + type check

**Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass (should be ~650+)

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Fix any failures**

If any tests fail, investigate and fix. Common issues:
- Existing tests that hardcode `team1PlayerIds: ['p1']` in casual matches — these now trigger the Phase 2 path instead of the scorer fallback. The `makeMatch` factory already uses `['p1']`/`['p2']` but these are only used in tournament tests. Verify `makeCasualMatch` factory passes empty arrays by default (it inherits from `makeMatch` which has `['p1']`/`['p2']`).

**CRITICAL**: If `makeMatch` defaults have `team1PlayerIds: ['p1']`, existing casual tests will now route through the Phase 2 playerIds path. You may need to override `makeCasualMatch` to use empty arrays:

```typescript
function makeCasualMatch(overrides: Partial<Match> = {}): Match {
  return makeMatch({
    id: 'casual-match-1',
    team1PlayerIds: [],
    team2PlayerIds: [],
    ...overrides,
  });
}
```

This ensures backward-compatible behavior for existing casual match tests. Update the factory ONLY if tests fail for this reason.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: test suite compatibility with new casual path"
```
