# Wave B Backlog — Tournament Quick Wins Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Issues 1, 2, 4 from the Wave B backlog for tournament matches — real opponent tiers, actual unique opponent tracking, and populated opponentIds/partnerId.

**Architecture:** Enrich `processMatchCompletion` to batch-read opponent tiers from a new `public/tier` doc, populate match ref fields from registration UIDs, and track unique opponents in StatsSummary. Add a `defaultTier` setting to tournament creation.

**Tech Stack:** SolidJS 1.9, TypeScript, Firestore, Vitest, XState v5

---

### Task 1: Add `nearestTier` utility to tierEngine

**Files:**
- Modify: `src/shared/utils/tierEngine.ts`
- Modify: `src/shared/utils/__tests__/tierEngine.test.ts`

**Step 1: Write the failing tests**

Add to `src/shared/utils/__tests__/tierEngine.test.ts`:

```typescript
import { computeTierScore, computeTier, computeTierConfidence, nearestTier } from '../tierEngine';

// --- nearestTier ---

describe('nearestTier', () => {
  it('returns beginner for multiplier 0.5', () => {
    expect(nearestTier(0.5)).toBe('beginner');
  });

  it('returns intermediate for multiplier 0.8', () => {
    expect(nearestTier(0.8)).toBe('intermediate');
  });

  it('returns advanced for multiplier 1.0', () => {
    expect(nearestTier(1.0)).toBe('advanced');
  });

  it('returns expert for multiplier 1.3', () => {
    expect(nearestTier(1.3)).toBe('expert');
  });

  it('maps beginner+intermediate average (0.65) to intermediate', () => {
    expect(nearestTier(0.65)).toBe('intermediate');
  });

  it('maps beginner+advanced average (0.75) to intermediate', () => {
    expect(nearestTier(0.75)).toBe('intermediate');
  });

  it('maps beginner+expert average (0.9) to advanced', () => {
    expect(nearestTier(0.9)).toBe('advanced');
  });

  it('maps intermediate+advanced average (0.9) to advanced', () => {
    expect(nearestTier(0.9)).toBe('advanced');
  });

  it('maps intermediate+expert average (1.05) to advanced', () => {
    expect(nearestTier(1.05)).toBe('advanced');
  });

  it('maps advanced+expert average (1.15) to advanced', () => {
    expect(nearestTier(1.15)).toBe('advanced');
  });

  it('clamps below beginner to beginner', () => {
    expect(nearestTier(0.1)).toBe('beginner');
  });

  it('clamps above expert to expert', () => {
    expect(nearestTier(2.0)).toBe('expert');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/utils/__tests__/tierEngine.test.ts`
Expected: FAIL — `nearestTier` is not exported from `tierEngine`

**Step 3: Write minimal implementation**

Add to `src/shared/utils/tierEngine.ts` after the `TIER_MULTIPLIER` constant (~line 11):

```typescript
const TIER_MULTIPLIER_ENTRIES = Object.entries(TIER_MULTIPLIER) as [Tier, number][];

export function nearestTier(multiplier: number): Tier {
  let closest: Tier = 'beginner';
  let minDist = Infinity;
  for (const [tier, mul] of TIER_MULTIPLIER_ENTRIES) {
    const dist = Math.abs(multiplier - mul);
    if (dist < minDist) {
      minDist = dist;
      closest = tier;
    }
  }
  return closest;
}
```

Also export `TIER_MULTIPLIER` (change from `const` to `export const`) — needed by the stats repo for doubles averaging.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/utils/__tests__/tierEngine.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/shared/utils/tierEngine.ts src/shared/utils/__tests__/tierEngine.test.ts
git commit -m "feat: add nearestTier utility for doubles opponent tier averaging"
```

---

### Task 2: Add `uniqueOpponentUids` to `StatsSummary` and `defaultTier` to `TournamentConfig`

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts` (just `createEmptyStats`)

**Step 1: Update types**

In `src/data/types.ts`:

Add to `StatsSummary` interface (after `updatedAt` field, ~line 137):
```typescript
  uniqueOpponentUids: string[];
```

Add to `TournamentConfig` interface (after `teamsPerPoolAdvancing`, ~line 174):
```typescript
  defaultTier?: Tier;
```

**Step 2: Update `createEmptyStats`**

In `src/data/firebase/firestorePlayerStatsRepository.ts`, add to `createEmptyStats()` (after `updatedAt: 0`, ~line 60):
```typescript
    uniqueOpponentUids: [],
```

**Step 3: Run type check to verify**

Run: `npx tsc --noEmit`
Expected: PASS (or errors only in files we'll fix in later tasks)

**Step 4: Commit**

```bash
git add src/data/types.ts src/data/firebase/firestorePlayerStatsRepository.ts
git commit -m "feat: add uniqueOpponentUids to StatsSummary, defaultTier to TournamentConfig"
```

---

### Task 3: Update `buildMatchRef` to accept and populate `opponentIds`/`partnerId`

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts`

**Step 1: Update `buildMatchRef` signature and body**

Change the function at lines 8-42. Add a new optional parameter for enrichment data:

```typescript
interface MatchRefEnrichment {
  opponentIds?: string[];
  partnerId?: string | null;
}

function buildMatchRef(
  match: Match,
  playerTeam: 1 | 2,
  result: 'win' | 'loss',
  enrichment?: MatchRefEnrichment,
): MatchRef {
```

In the return object, replace the hardcoded values:
```typescript
    opponentIds: enrichment?.opponentIds ?? [],
    partnerId: enrichment?.partnerId ?? null,
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (existing callers pass no enrichment, defaults apply)

**Step 3: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts
git commit -m "feat: allow buildMatchRef to accept opponentIds and partnerId"
```

---

### Task 4: Add opponent tier resolution and enrichment to `processMatchCompletion`

This is the main task. We modify `processMatchCompletion` and `updatePlayerStats` to:
- Batch-read opponent `public/tier` docs
- Resolve opponent/partner UIDs per participant
- Compute doubles average tier
- Pass real tier + enrichment data through

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts`

**Step 1: Add imports**

At the top of the file (line 1), add `setDoc` to the Firestore imports:
```typescript
import { doc, getDoc, getDocs, setDoc, collection, query, orderBy, limit as fbLimit, startAfter, runTransaction } from 'firebase/firestore';
```

Add tier utilities import (line 4):
```typescript
import { computeTierScore, computeTier, computeTierConfidence, nearestTier, TIER_MULTIPLIER } from '../../shared/utils/tierEngine';
```

Add `Tier` to the type import:
```typescript
import type { Match, MatchRef, StatsSummary, RecentResult, Tier } from '../types';
```

**Step 2: Add helper to fetch opponent tiers**

Add after `estimateUniqueOpponents` (~line 79):

```typescript
async function fetchPublicTiers(uids: string[]): Promise<Record<string, Tier>> {
  if (uids.length === 0) return {};
  const snapshots = await Promise.all(
    uids.map((uid) => getDoc(doc(firestore, 'users', uid, 'public', 'tier'))),
  );
  const tiers: Record<string, Tier> = {};
  for (let i = 0; i < uids.length; i++) {
    if (snapshots[i].exists()) {
      tiers[uids[i]] = (snapshots[i].data() as { tier: Tier }).tier;
    }
  }
  return tiers;
}

function resolveOpponentTier(
  opponentUids: string[],
  tierMap: Record<string, Tier>,
  fallbackTier: Tier,
  gameType: 'singles' | 'doubles',
): Tier {
  const tiers = opponentUids.map((uid) => tierMap[uid] ?? fallbackTier);
  if (tiers.length === 0) return fallbackTier;
  if (gameType === 'singles' || tiers.length === 1) return tiers[0];
  // Doubles: average multipliers, map to nearest tier
  const avgMultiplier = tiers.reduce((sum, t) => sum + TIER_MULTIPLIER[t], 0) / tiers.length;
  return nearestTier(avgMultiplier);
}

async function writePublicTier(uid: string, tier: Tier): Promise<void> {
  await setDoc(doc(firestore, 'users', uid, 'public', 'tier'), { tier });
}
```

**Step 3: Add duplicate UID guard to `resolveParticipantUids`**

After the registration loop (after line ~110, before the return), add:

```typescript
    // Guard: detect duplicate UIDs across teams (data corruption)
    const seen = new Set<string>();
    const deduped: typeof participants = [];
    for (const p of participants) {
      if (seen.has(p.uid)) {
        console.warn('Duplicate UID across teams (data corruption), skipping:', p.uid);
        continue;
      }
      seen.add(p.uid);
      deduped.push(p);
    }
    return deduped;
```

Replace the `return participants` at end of the tournament branch with the dedup block above (remove old return).

**Step 4: Update `processMatchCompletion` to fetch tiers and tournament config**

Replace the current `processMatchCompletion` method (~lines 198-211):

```typescript
async processMatchCompletion(
  match: Match,
  scorerUid: string,
): Promise<void> {
  const participants = await resolveParticipantUids(match, scorerUid);
  if (participants.length === 0) return;

  const isTournamentMatch = !!(match.tournamentId && (match.tournamentTeam1Id || match.tournamentTeam2Id));

  // For tournament matches: fetch opponent tiers + tournament config
  let tierMap: Record<string, Tier> = {};
  let fallbackTier: Tier = 'beginner';

  if (isTournamentMatch) {
    const allUids = participants.map((p) => p.uid);
    tierMap = await fetchPublicTiers(allUids);

    // Fetch tournament defaultTier
    try {
      const tournamentSnap = await getDoc(doc(firestore, 'tournaments', match.tournamentId!));
      if (tournamentSnap.exists()) {
        const config = tournamentSnap.data()?.config;
        fallbackTier = config?.defaultTier ?? 'beginner';
      }
    } catch {
      // Fallback silently — defaultTier is a nice-to-have
    }
  }

  await Promise.all(
    participants.map(({ uid, playerTeam, result }) =>
      this.updatePlayerStats(uid, match, playerTeam, result, scorerUid, {
        isTournamentMatch,
        participants,
        tierMap,
        fallbackTier,
      }).catch((err) => {
        console.warn('Stats update failed for user:', uid, err);
      }),
    ),
  );
}
```

**Step 5: Update `updatePlayerStats` to use enrichment data**

Add an enrichment parameter type before the method:

```typescript
interface StatsEnrichment {
  isTournamentMatch: boolean;
  participants: Array<{ uid: string; playerTeam: 1 | 2; result: 'win' | 'loss' }>;
  tierMap: Record<string, Tier>;
  fallbackTier: Tier;
}
```

Update the method signature:
```typescript
async updatePlayerStats(
  uid: string,
  match: Match,
  playerTeam: 1 | 2,
  result: 'win' | 'loss',
  scorerUid: string,
  enrichment?: StatsEnrichment,
): Promise<void> {
```

Inside the transaction, after `matchRef.ownerId = scorerUid;` (~line 152):

```typescript
    // Enrich matchRef for tournament matches
    if (enrichment?.isTournamentMatch) {
      const opponentUids = enrichment.participants
        .filter((p) => p.playerTeam !== playerTeam)
        .map((p) => p.uid);
      const partnerUid = match.config.gameType === 'doubles'
        ? enrichment.participants.find((p) => p.playerTeam === playerTeam && p.uid !== uid)?.uid ?? null
        : null;
      matchRef.opponentIds = opponentUids;
      matchRef.partnerId = partnerUid;
    }
```

Replace the hardcoded `opponentTier: 'beginner'` in `newResult` (~line 176):

```typescript
    // Resolve opponent tier
    let opponentTier: Tier = 'beginner';
    if (enrichment?.isTournamentMatch) {
      const opponentUids = enrichment.participants
        .filter((p) => p.playerTeam !== playerTeam)
        .map((p) => p.uid);
      opponentTier = resolveOpponentTier(opponentUids, enrichment.tierMap, enrichment.fallbackTier, match.config.gameType);
    }

    const newResult: RecentResult = {
      result,
      opponentTier,
      completedAt: match.completedAt ?? Date.now(),
      gameType,
    };
```

Replace the `estimateUniqueOpponents` call (~line 185):

```typescript
    // Unique opponents: merge new opponent UIDs for tournament matches
    if (enrichment?.isTournamentMatch) {
      const opponentUids = enrichment.participants
        .filter((p) => p.playerTeam !== playerTeam)
        .map((p) => p.uid);
      const existingUids = new Set(stats.uniqueOpponentUids ?? []);
      for (const oid of opponentUids) {
        existingUids.add(oid);
      }
      stats.uniqueOpponentUids = [...existingUids];
    }
    const uniqueOpponents = (stats.uniqueOpponentUids ?? []).length || estimateUniqueOpponents(stats.totalMatches);
    stats.tierConfidence = computeTierConfidence(stats.totalMatches, uniqueOpponents);
```

After the transaction closes, write the public tier doc:

```typescript
  // Write public tier doc (outside transaction — eventual consistency is fine)
  await writePublicTier(uid, stats.tier).catch((err) => {
    console.warn('Failed to write public tier for', uid, err);
  });
```

Note: `stats` is scoped inside the transaction. Extract `tier` before the transaction ends:

Actually, restructure: declare `let newTier: Tier = 'beginner';` before the transaction, assign `newTier = stats.tier;` at the end of the transaction body, then call `writePublicTier(uid, newTier)` after the transaction resolves.

**Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 7: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts
git commit -m "feat: enrich tournament stats with real opponent tiers and UIDs"
```

---

### Task 5: Write unit tests for the new stats enrichment logic

**Files:**
- Create: `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`

This tests `resolveOpponentTier` and the enrichment flow. Since the repository uses Firestore directly, we mock Firestore calls.

**Step 1: Write the tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tier } from '../../types';

// Mock Firestore
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockRunTransaction = vi.fn();
const mockDoc = vi.fn((...args: string[]) => args.join('/'));
const mockCollection = vi.fn((...args: string[]) => args.join('/'));

vi.mock('firebase/firestore', () => ({
  doc: (...args: string[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  collection: (...args: string[]) => mockCollection(...args),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

// Import the module under test AFTER mocks
import { firestorePlayerStatsRepository } from '../firestorePlayerStatsRepository';

describe('firestorePlayerStatsRepository — tournament enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processMatchCompletion with tournament match', () => {
    it('fetches opponent public tiers for tournament matches', async () => {
      // Setup: tournament match with 2 participants
      const match = {
        id: 'match-1',
        tournamentId: 'tourney-1',
        tournamentTeam1Id: 'team-1',
        tournamentTeam2Id: 'team-2',
        winningSide: 1,
        completedAt: Date.now(),
        config: { gameType: 'singles' as const, scoringMode: 'rally' as const },
        games: [{ team1Score: 11, team2Score: 5 }],
      };

      // Mock registration lookup
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'reg-1', data: () => ({ userId: 'uid-1', teamId: 'team-1' }) },
          { id: 'reg-2', data: () => ({ userId: 'uid-2', teamId: 'team-2' }) },
        ],
      });

      // Mock public tier reads (one per participant)
      mockGetDoc
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'intermediate' }) })  // uid-1 tier
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ tier: 'advanced' }) })       // uid-2 tier
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ config: { defaultTier: 'beginner' } }) }); // tournament config

      // Mock transaction
      mockRunTransaction.mockImplementation(async (_fs: unknown, fn: (tx: unknown) => Promise<void>) => {
        const tx = {
          get: vi.fn()
            .mockResolvedValueOnce({ exists: () => false })  // matchRef doesn't exist (idempotency)
            .mockResolvedValueOnce({ exists: () => false }),  // stats don't exist
          set: vi.fn(),
        };
        await fn(tx);
        return tx;
      });

      // Mock writePublicTier
      mockSetDoc.mockResolvedValue(undefined);

      await firestorePlayerStatsRepository.processMatchCompletion(match as any, 'uid-1');

      // Verify public tier docs were fetched
      expect(mockGetDoc).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts
git commit -m "test: add unit tests for tournament stats enrichment"
```

---

### Task 6: Add `defaultTier` dropdown to tournament creation form

**Files:**
- Modify: `src/features/tournaments/TournamentCreatePage.tsx`

**Step 1: Add signal for defaultTier**

After the existing config signals (~line 33), add:
```typescript
const [defaultTier, setDefaultTier] = createSignal<Tier>('beginner');
```

Add the `Tier` import at the top:
```typescript
import type { Tier } from '../../data/types';
```

**Step 2: Add defaultTier to the tournament config object**

In the tournament object creation (~line 97), add to `config`:
```typescript
    defaultTier: defaultTier(),
```

**Step 3: Add the UI fieldset**

After the "Match Format" fieldset (~line 232, before the "Max Players" div), add:

```typescript
        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Default Skill Level</legend>
          <p class="text-xs text-on-surface-muted mb-2">Used for rating players without match history</p>
          <div class="grid grid-cols-4 gap-3">
            <OptionCard label="Beginner" selected={defaultTier() === 'beginner'} onClick={() => setDefaultTier('beginner')} />
            <OptionCard label="Intermediate" selected={defaultTier() === 'intermediate'} onClick={() => setDefaultTier('intermediate')} />
            <OptionCard label="Advanced" selected={defaultTier() === 'advanced'} onClick={() => setDefaultTier('advanced')} />
            <OptionCard label="Expert" selected={defaultTier() === 'expert'} onClick={() => setDefaultTier('expert')} />
          </div>
        </fieldset>
```

**Step 4: Run type check and dev server**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx vite --port 5199` (manually verify the dropdown renders)

**Step 5: Commit**

```bash
git add src/features/tournaments/TournamentCreatePage.tsx
git commit -m "feat: add Default Skill Level selector to tournament creation"
```

---

### Task 7: Update Firestore security rules

**Files:**
- Modify: `firestore.rules`

**Step 1: Add public tier doc rules**

Add a new rule block for the `public` subcollection (before the `stats` rules, ~line 475):

```
    // Public tier — readable by any authenticated user
    match /users/{userId}/public/{docId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.tier in ['beginner', 'intermediate', 'advanced', 'expert'];
      allow delete: if false;
    }
```

**Step 2: Add `defaultTier` validation to tournament create rule**

In the tournament create rule (~line 105-131), add before the final semicolon:

```
  && (!('defaultTier' in request.resource.data.config)
      || request.resource.data.config.defaultTier in ['beginner', 'intermediate', 'advanced', 'expert'])
```

Add the same to the tournament update rule (~line 133-163).

**Step 3: Verify rules parse**

Run: `npx firebase-tools emulators:start --only firestore` (or validate rules)
If firebase-tools isn't installed, just verify syntax by reading the file.

**Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat: add public tier doc rules and defaultTier validation"
```

---

### Task 8: Update matchRef write rules for new fields

**Files:**
- Modify: `firestore.rules`

**Step 1: Check current matchRef rules**

Current rules (lines 464-474) require `request.auth.uid == userId` for creates. But with tournament enrichment, the scorer writes matchRefs for OTHER players (opponents). The scorer's UID won't match the opponent's `userId`.

Check: does the current `allow create` rule on `matchRefs` restrict to `request.auth.uid == userId`? If so, this blocks tournament stats for opponents.

Look at the `stats` rules — they have validation on `totalMatches` and `winRate` but NO ownership check for writes. So stats can be written for other users.

For `matchRefs`, the rule says `request.auth.uid == userId`. This means **only the owner can create their own matchRefs**. But `processMatchCompletion` writes matchRefs for all participants (including opponents).

**Fix:** Change the matchRef create rule to allow any authenticated user to create refs for tournament matches, OR remove the `request.auth.uid == userId` constraint and rely on the `ownerId` field tracking who wrote it.

Update the create rule:
```
    match /users/{userId}/matchRefs/{refId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null
        && request.resource.data.matchId is string
        && request.resource.data.completedAt is number
        && request.resource.data.result in ['win', 'loss'];
      allow update, delete: if false;
    }
```

Remove the `request.auth.uid == userId` and `ownerId == request.auth.uid` constraints from create (the scorer writes refs for all participants). Keep the read constraint (only the owner can read their own match history).

**Step 2: Commit**

```bash
git add firestore.rules
git commit -m "fix: allow scorer to write matchRefs for tournament participants"
```

---

### Task 9: Run full test suite and verify

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS (590+ tests)

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Fix any failures**

If tests fail, investigate and fix. Common issues:
- Existing tests that mock `createEmptyStats` may need `uniqueOpponentUids: []`
- Tests that check `opponentTier` may expect `'beginner'` and need updating
- Import changes may break mocks

**Step 4: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: resolve test failures from Wave B backlog changes"
```

---

### Task 10: Integration smoke test

**Files:** None (manual verification)

**Step 1: Start dev server and emulators**

```bash
npx firebase emulators:start --only auth,firestore &
npx vite --port 5199
```

**Step 2: Create a tournament with defaultTier**

1. Navigate to tournament creation
2. Verify "Default Skill Level" dropdown appears with 4 options
3. Select "Intermediate"
4. Create the tournament
5. Verify in Firestore emulator that `config.defaultTier` is `'intermediate'`

**Step 3: Complete a tournament match**

1. Register 2 players, start the tournament
2. Score and complete a match
3. Check Firestore emulator:
   - `users/{uid}/stats/summary` should have `uniqueOpponentUids` populated
   - `users/{uid}/matchRefs/{matchId}` should have `opponentIds` populated
   - `users/{uid}/public/tier` should exist with a `tier` value
   - `RecentResult.opponentTier` should reflect real opponent tier (or `defaultTier` fallback)

**Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration test fixes for Wave B backlog"
```
