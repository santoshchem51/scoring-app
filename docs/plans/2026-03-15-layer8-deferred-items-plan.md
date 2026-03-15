# Layer 8 Deferred Items Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve all 7 remaining Layer 8 deferred items — security lockdown via Cloud Functions, live spectator projections, and client-side UX fixes.

**Architecture:** Three waves: (A) shared types extraction + Cloud Functions infrastructure with HTTPS callable for match completion, (B) client-side spectator projection updates piggybacked on syncProcessor, (C) client-side UX fixes for LiveNowSection (query-based filtering, inline scores, expandable overflow).

**Tech Stack:** Firebase Cloud Functions Gen 2 (TypeScript/Node 20), firebase-admin, firebase-functions v6+, SolidJS, Firestore, Vitest

---

## Wave A: Shared Types + Cloud Functions Infrastructure

### Task 1: Extract Shared Types to `shared-types/`

**Files:**
- Create: `shared-types/types.ts`
- Create: `shared-types/tsconfig.json`
- Create: `shared-types/utils/tierEngine.ts`
- Create: `shared-types/utils/leaderboardScoring.ts`
- Modify: `src/data/types.ts`
- Modify: `src/shared/utils/tierEngine.ts`
- Modify: `src/shared/utils/leaderboardScoring.ts`

**Step 1: Create `shared-types/tsconfig.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "outDir": "../functions/lib/shared-types",
    "rootDir": ".",
    "strict": true,
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "skipLibCheck": true
  },
  "include": ["./**/*.ts"]
}
```

**Step 2: Create `shared-types/types.ts`**

Copy these type definitions from `src/data/types.ts` (lines 1-168) — all zero-dependency types:

```typescript
// Scoring & match config
export type ScoringMode = 'sideout' | 'rally';
export type MatchFormat = 'single' | 'best-of-3' | 'best-of-5';
export type MatchStatus = 'in-progress' | 'completed' | 'abandoned';
export type GameType = 'singles' | 'doubles';

export interface MatchConfig {
  gameType: GameType;
  scoringMode: ScoringMode;
  matchFormat: MatchFormat;
  pointsToWin: number;
}

export interface GameResult {
  gameNumber: number;
  team1Score: number;
  team2Score: number;
  winningSide: 1 | 2 | null;
}

export interface Match {
  id: string;
  config: MatchConfig;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
  team1Name: string;
  team2Name: string;
  games: GameResult[];
  winningSide: 1 | 2 | null;
  status: MatchStatus;
  startedAt: number;
  completedAt: number | null;
  lastSnapshot?: string | null;
  ownerId?: string;
  sharedWith?: string[];
  visibility?: 'private' | 'shared' | 'public';
  tournamentId?: string | null;
  tournamentTeam1Id?: string | null;
  tournamentTeam2Id?: string | null;
  poolId?: string | null;
  bracketSlotId?: string | null;
}

// Tier system
export type Tier = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type TierConfidence = 'low' | 'medium' | 'high';

export interface RecentResult {
  result: 'win' | 'loss';
  opponentTier: Tier;
  completedAt: number;
  gameType: 'singles' | 'doubles';
}

export interface MatchRef {
  matchId: string;
  startedAt: number;
  completedAt: number;
  gameType: 'singles' | 'doubles';
  scoringMode: 'sideout' | 'rally';
  result: 'win' | 'loss';
  scores: string;
  gameScores: number[][];
  playerTeam: 1 | 2;
  opponentNames: string[];
  opponentIds: string[];
  partnerName: string | null;
  partnerId: string | null;
  ownerId: string;
  tournamentId: string | null;
  tournamentName: string | null;
}

export interface StatsSummary {
  schemaVersion: number;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: { type: 'W' | 'L'; count: number };
  bestWinStreak: number;
  singles: { matches: number; wins: number; losses: number };
  doubles: { matches: number; wins: number; losses: number };
  recentResults: RecentResult[];
  tier: Tier;
  tierConfidence: TierConfidence;
  tierUpdatedAt: number;
  lastPlayedAt: number;
  updatedAt: number;
  uniqueOpponentUids: string[];
}

export interface Last30dStats {
  totalMatches: number;
  wins: number;
  winRate: number;
  compositeScore: number;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  tier: Tier;
  tierConfidence: TierConfidence;
  totalMatches: number;
  wins: number;
  winRate: number;
  currentStreak: { type: 'W' | 'L'; count: number };
  compositeScore: number;
  last30d: Last30dStats;
  lastPlayedAt: number;
  createdAt: number;
  updatedAt: number;
}
```

**Step 3: Copy `shared-types/utils/tierEngine.ts`**

Copy the full content from `src/shared/utils/tierEngine.ts`. Update imports to use relative `../types` instead of `../../data/types`.

**Step 4: Copy `shared-types/utils/leaderboardScoring.ts`**

Copy the full content from `src/shared/utils/leaderboardScoring.ts`. Update imports to use relative `../types`.

**Step 5: Update client files to re-export from shared-types**

In `src/data/types.ts`, replace the extracted type definitions with re-exports:

```typescript
// Re-export shared types (canonical definitions in shared-types/)
export type {
  ScoringMode, MatchFormat, MatchStatus, GameType, MatchConfig, GameResult, Match,
  Tier, TierConfidence, RecentResult, MatchRef, StatsSummary, Last30dStats, LeaderboardEntry,
} from '../../shared-types/types';
```

Keep any client-only types (like Dexie table types) in the original file.

In `src/shared/utils/tierEngine.ts`, replace with re-export:
```typescript
export { computeTierScore, computeTier, computeTierConfidence, TIER_MULTIPLIER } from '../../../shared-types/utils/tierEngine';
```

In `src/shared/utils/leaderboardScoring.ts`, replace with re-export:
```typescript
export { computeCompositeScore, buildLeaderboardEntry, MIN_MATCHES_FOR_LEADERBOARD } from '../../../shared-types/utils/leaderboardScoring';
```

**Step 6: Run tests to verify nothing broke**

Run: `cd Projects/ScoringApp && npx vitest run`
Expected: All tests pass (re-exports are transparent)

**Step 7: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add shared-types/ src/data/types.ts src/shared/utils/tierEngine.ts src/shared/utils/leaderboardScoring.ts
git commit -m "refactor: extract shared types for Cloud Functions consumption"
```

---

### Task 2: Scaffold Cloud Functions Directory

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/src/index.ts`
- Modify: `firebase.json`

**Step 1: Create `functions/package.json`**

```json
{
  "name": "picklescoring-functions",
  "main": "lib/src/index.js",
  "engines": { "node": "20" },
  "scripts": {
    "build": "tsc -b",
    "build:watch": "tsc -b --watch",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "firebase-admin": "^12.7.0",
    "firebase-functions": "^6.3.0"
  },
  "devDependencies": {
    "typescript": "~5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create `functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "outDir": "lib",
    "rootDir": ".",
    "strict": true,
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "declaration": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*.ts"],
  "references": [{ "path": "../shared-types" }]
}
```

**Step 3: Create `functions/src/index.ts`**

```typescript
// Cloud Functions entry point — Gen 2
// Functions are exported here and auto-registered by Firebase CLI

export { processMatchCompletion } from './callable/processMatchCompletion.js';
```

**Step 4: Update `firebase.json`**

Add the `functions` section to the existing config:

```json
"functions": {
  "source": "functions",
  "predeploy": "cd functions && npm run build",
  "runtime": "nodejs20"
}
```

**Step 5: Install dependencies**

Run: `cd functions && npm install`

**Step 6: Verify build**

Run: `cd functions && npm run build`
Expected: Compiles with no errors (index.ts will fail because processMatchCompletion doesn't exist yet — that's fine, we'll create a stub)

**Step 7: Commit**

```bash
git add functions/ firebase.json
git commit -m "chore: scaffold Cloud Functions directory with Gen 2 config"
```

---

### Task 3: Implement `processMatchCompletion` Callable — Participant Resolution

**Files:**
- Create: `functions/src/lib/participantResolution.ts`
- Test: `functions/src/__tests__/participantResolution.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { resolveParticipantUids } from '../lib/participantResolution.js';
import type { Match } from '../../../shared-types/types.js';

describe('resolveParticipantUids', () => {
  it('returns player IDs from casual match', () => {
    const match = {
      team1PlayerIds: ['uid1'],
      team2PlayerIds: ['uid2'],
      tournamentId: null,
    } as Match;

    const result = resolveParticipantUids(match, []);
    expect(result).toEqual([
      { uid: 'uid1', playerTeam: 1, result: 'win' },
      { uid: 'uid2', playerTeam: 2, result: 'loss' },
    ]);
  });

  it('returns all team member UIDs for tournament match', () => {
    const match = {
      team1PlayerIds: ['uid1', 'uid2'],
      team2PlayerIds: ['uid3', 'uid4'],
      tournamentId: 'tourney1',
      winningSide: 2,
    } as Match;

    const result = resolveParticipantUids(match, []);
    expect(result).toEqual([
      { uid: 'uid1', playerTeam: 1, result: 'loss' },
      { uid: 'uid2', playerTeam: 1, result: 'loss' },
      { uid: 'uid3', playerTeam: 2, result: 'win' },
      { uid: 'uid4', playerTeam: 2, result: 'win' },
    ]);
  });

  it('deduplicates UIDs', () => {
    const match = {
      team1PlayerIds: ['uid1', 'uid1'],
      team2PlayerIds: ['uid2'],
      winningSide: 1,
    } as Match;

    const result = resolveParticipantUids(match, []);
    expect(result).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd functions && npx vitest run src/__tests__/participantResolution.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
import type { Match } from '../../../shared-types/types.js';

export interface ParticipantInfo {
  uid: string;
  playerTeam: 1 | 2;
  result: 'win' | 'loss';
}

export function resolveParticipantUids(
  match: Match,
  _registrations: Array<{ teamId: string; playerIds: string[] }>,
): ParticipantInfo[] {
  const seen = new Set<string>();
  const participants: ParticipantInfo[] = [];

  const addTeam = (playerIds: string[], team: 1 | 2) => {
    const result = match.winningSide === team ? 'win' : 'loss';
    for (const uid of playerIds) {
      if (uid && !seen.has(uid)) {
        seen.add(uid);
        participants.push({ uid, playerTeam: team, result });
      }
    }
  };

  addTeam(match.team1PlayerIds, 1);
  addTeam(match.team2PlayerIds, 2);

  return participants;
}
```

**Step 4: Run test to verify it passes**

Run: `cd functions && npx vitest run src/__tests__/participantResolution.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/src/lib/participantResolution.ts functions/src/__tests__/participantResolution.test.ts
git commit -m "feat(functions): add participant resolution for match completion"
```

---

### Task 4: Implement `processMatchCompletion` Callable — Stats Computation

**Files:**
- Create: `functions/src/lib/statsComputation.ts`
- Test: `functions/src/__tests__/statsComputation.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { computeUpdatedStats, buildMatchRefFromMatch } from '../lib/statsComputation.js';
import type { Match, StatsSummary } from '../../../shared-types/types.js';

describe('computeUpdatedStats', () => {
  const emptyStats: StatsSummary = {
    schemaVersion: 1,
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: { type: 'W', count: 0 },
    bestWinStreak: 0,
    singles: { matches: 0, wins: 0, losses: 0 },
    doubles: { matches: 0, wins: 0, losses: 0 },
    recentResults: [],
    tier: 'beginner',
    tierConfidence: 'low',
    tierUpdatedAt: 0,
    lastPlayedAt: 0,
    updatedAt: 0,
    uniqueOpponentUids: [],
  };

  it('increments totalMatches and wins on a win', () => {
    const result = computeUpdatedStats(emptyStats, 'win', 'singles', 'beginner', [], Date.now());
    expect(result.totalMatches).toBe(1);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
    expect(result.winRate).toBeCloseTo(1.0);
    expect(result.singles.matches).toBe(1);
    expect(result.singles.wins).toBe(1);
  });

  it('increments losses on a loss', () => {
    const result = computeUpdatedStats(emptyStats, 'loss', 'singles', 'beginner', [], Date.now());
    expect(result.totalMatches).toBe(1);
    expect(result.losses).toBe(1);
    expect(result.winRate).toBeCloseTo(0);
  });

  it('updates streak correctly', () => {
    const afterWin = computeUpdatedStats(emptyStats, 'win', 'singles', 'beginner', [], Date.now());
    expect(afterWin.currentStreak).toEqual({ type: 'W', count: 1 });

    const afterWin2 = computeUpdatedStats(afterWin, 'win', 'singles', 'beginner', [], Date.now());
    expect(afterWin2.currentStreak).toEqual({ type: 'W', count: 2 });
    expect(afterWin2.bestWinStreak).toBe(2);

    const afterLoss = computeUpdatedStats(afterWin2, 'loss', 'singles', 'beginner', [], Date.now());
    expect(afterLoss.currentStreak).toEqual({ type: 'L', count: 1 });
    expect(afterLoss.bestWinStreak).toBe(2); // preserved
  });

  it('caps recentResults at 50', () => {
    let stats = emptyStats;
    for (let i = 0; i < 55; i++) {
      stats = computeUpdatedStats(stats, 'win', 'singles', 'beginner', [], Date.now());
    }
    expect(stats.recentResults).toHaveLength(50);
  });
});

describe('buildMatchRefFromMatch', () => {
  it('builds a matchRef for a winning team 1 player', () => {
    const match = {
      id: 'match1',
      config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
      team1Name: 'Alice',
      team2Name: 'Bob',
      team1PlayerIds: ['uid1'],
      team2PlayerIds: ['uid2'],
      games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
      winningSide: 1,
      status: 'completed',
      startedAt: 1000,
      completedAt: 2000,
      tournamentId: null,
    } as unknown as Match;

    const ref = buildMatchRefFromMatch(match, 1, 'win', 'scorer1');
    expect(ref.matchId).toBe('match1');
    expect(ref.result).toBe('win');
    expect(ref.playerTeam).toBe(1);
    expect(ref.scores).toBe('11-5');
    expect(ref.gameScores).toEqual([[11, 5]]);
    expect(ref.opponentNames).toEqual(['Bob']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd functions && npx vitest run src/__tests__/statsComputation.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

Create `functions/src/lib/statsComputation.ts` — port the stats computation logic from `firestorePlayerStatsRepository.ts` (lines 245-355) into pure functions that don't depend on Firestore SDK. Use the shared `tierEngine` and `leaderboardScoring` utilities.

Key functions to implement:
- `computeUpdatedStats(existing, result, gameType, opponentTier, opponentUids, now)` — returns new `StatsSummary`
- `buildMatchRefFromMatch(match, playerTeam, result, scorerUid)` — returns `MatchRef`

Mirror the exact computation from the client code: streak logic, ring buffer capping at 50, tier computation with hysteresis, format-specific stats, unique opponent tracking.

**Step 4: Run test to verify it passes**

Run: `cd functions && npx vitest run src/__tests__/statsComputation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add functions/src/lib/statsComputation.ts functions/src/__tests__/statsComputation.test.ts
git commit -m "feat(functions): add server-side stats computation (no Firestore dependency)"
```

---

### Task 5: Implement `processMatchCompletion` Callable — Main Function

**Files:**
- Create: `functions/src/callable/processMatchCompletion.ts`
- Test: `functions/src/__tests__/processMatchCompletion.test.ts`

**Step 1: Write the callable function**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import { resolveParticipantUids } from '../lib/participantResolution.js';
import { computeUpdatedStats, buildMatchRefFromMatch } from '../lib/statsComputation.js';
import { buildLeaderboardEntry } from '../../../shared-types/utils/leaderboardScoring.js';
import type { Match, StatsSummary } from '../../../shared-types/types.js';

initializeApp();

export const processMatchCompletion = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    maxInstances: 10,
    concurrency: 16,
  },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { matchId } = request.data;
    if (!matchId || typeof matchId !== 'string') {
      throw new HttpsError('invalid-argument', 'matchId is required');
    }

    const db = getFirestore();
    const callerUid = request.auth.uid;

    // 2. Read and validate match
    const matchSnap = await db.doc(`matches/${matchId}`).get();
    if (!matchSnap.exists) {
      throw new HttpsError('not-found', 'Match not found');
    }

    const match = { id: matchSnap.id, ...matchSnap.data() } as Match;

    if (match.status !== 'completed') {
      throw new HttpsError('failed-precondition', 'Match is not completed');
    }

    if (match.ownerId !== callerUid && !(match.sharedWith ?? []).includes(callerUid)) {
      throw new HttpsError('permission-denied', 'Not authorized for this match');
    }

    // 3. Resolve participants
    const participants = resolveParticipantUids(match, []);

    // 4. Process each participant
    const now = Date.now();
    for (const participant of participants) {
      await db.runTransaction(async (txn) => {
        // Idempotency check
        const matchRefDoc = db.doc(`users/${participant.uid}/matchRefs/${matchId}`);
        const existingRef = await txn.get(matchRefDoc);
        if (existingRef.exists) return; // Already processed

        // Read existing stats
        const statsDoc = db.doc(`users/${participant.uid}/stats/summary`);
        const statsSnap = await txn.get(statsDoc);
        const existingStats = (statsSnap.exists ? statsSnap.data() : null) as StatsSummary | null;

        // Read existing leaderboard for createdAt preservation
        const leaderboardDoc = db.doc(`leaderboard/${participant.uid}`);
        const leaderboardSnap = await txn.get(leaderboardDoc);

        // Resolve opponent tier (read from public tier docs)
        const opponentUids = participants
          .filter((p) => p.playerTeam !== participant.playerTeam)
          .map((p) => p.uid);
        let opponentTier: 'beginner' | 'intermediate' | 'advanced' | 'expert' = 'beginner';
        if (opponentUids.length > 0) {
          const tierSnap = await txn.get(db.doc(`users/${opponentUids[0]}/public/tier`));
          if (tierSnap.exists) {
            opponentTier = (tierSnap.data()?.tier as typeof opponentTier) ?? 'beginner';
          }
        }

        // Build matchRef
        const matchRef = buildMatchRefFromMatch(match, participant.playerTeam, participant.result, callerUid);

        // Compute updated stats server-side
        const emptyStats: StatsSummary = {
          schemaVersion: 1, totalMatches: 0, wins: 0, losses: 0, winRate: 0,
          currentStreak: { type: 'W', count: 0 }, bestWinStreak: 0,
          singles: { matches: 0, wins: 0, losses: 0 },
          doubles: { matches: 0, wins: 0, losses: 0 },
          recentResults: [], tier: 'beginner', tierConfidence: 'low',
          tierUpdatedAt: 0, lastPlayedAt: 0, updatedAt: 0, uniqueOpponentUids: [],
        };
        const updatedStats = computeUpdatedStats(
          existingStats ?? emptyStats,
          participant.result,
          match.config.gameType,
          opponentTier,
          opponentUids,
          now,
        );

        // Atomic writes: matchRef + stats + leaderboard
        txn.set(matchRefDoc, matchRef);
        txn.set(statsDoc, updatedStats);

        // Leaderboard (if qualifies)
        // Fetch user profile for display name
        const userDoc = await txn.get(db.doc(`users/${participant.uid}/public/tier`));
        const displayName = userDoc.data()?.displayName ?? 'Player';
        const photoURL = null; // Not stored in public tier

        const entry = buildLeaderboardEntry(
          participant.uid, displayName, photoURL, updatedStats, now,
        );
        if (entry) {
          if (leaderboardSnap.exists) {
            entry.createdAt = (leaderboardSnap.data()?.createdAt as number) ?? now;
          }
          txn.set(leaderboardDoc, entry);
        }
      });

      // Post-transaction: write public tier (non-critical)
      try {
        const statsSnap = await db.doc(`users/${participant.uid}/stats/summary`).get();
        const stats = statsSnap.data() as StatsSummary;
        await db.doc(`users/${participant.uid}/public/tier`).set(
          { tier: stats.tier, updatedAt: now },
          { merge: true },
        );
      } catch (err) {
        console.warn(`Failed to write public tier for ${participant.uid}:`, err);
      }
    }

    // 5. Update spectator projection status
    try {
      const projRef = db.doc(`matches/${matchId}/public/spectator`);
      const projSnap = await projRef.get();
      if (projSnap.exists) {
        await projRef.update({ status: 'completed', updatedAt: now });
      }
    } catch (err) {
      console.warn('Failed to update spectator projection:', err);
    }

    return { success: true, participantsProcessed: participants.length };
  },
);
```

**Step 2: Write integration test (unit-level, mocking Firestore)**

The test should verify:
- Unauthenticated calls are rejected
- Missing matchId is rejected
- Non-completed match is rejected
- Non-owner is rejected
- Idempotency: already-processed match returns cleanly
- Stats are computed server-side, not copied from input

**Step 3: Run tests**

Run: `cd functions && npx vitest run`
Expected: PASS

**Step 4: Build and verify**

Run: `cd functions && npm run build`
Expected: Compiles successfully

**Step 5: Commit**

```bash
git add functions/src/callable/processMatchCompletion.ts functions/src/__tests__/processMatchCompletion.test.ts
git commit -m "feat(functions): implement processMatchCompletion HTTPS callable"
```

---

### Task 6: Update Client to Call the Callable

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts:411-470`
- Modify: `src/data/firebase/syncProcessor.ts:133-142`
- Modify: `src/data/firebase/cloudSync.ts:184-195`
- Test: Existing stats tests should still pass

**Step 1: Add callable invocation to cloudSync**

In `src/data/firebase/cloudSync.ts`, add a new function that calls the Cloud Function instead of using the sync queue for stats:

```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from './config';

async function callProcessMatchCompletion(matchId: string): Promise<void> {
  const processMatch = httpsCallable(functions, 'processMatchCompletion');
  await processMatch({ matchId });
}
```

**Step 2: Update `syncPlayerStatsAfterMatch` to call the callable**

Replace the sync queue enqueue with the callable invocation. Keep the sync queue approach as a fallback during migration:

```typescript
syncPlayerStatsAfterMatch(match: Match): void {
  const user = auth.currentUser;
  if (!user) return;

  // Call Cloud Function for server-side stats processing
  callProcessMatchCompletion(match.id).catch((err) => {
    console.warn('Cloud Function failed, falling back to client-side:', err);
    // Fallback: enqueue the old way (remove this after migration completes)
    enqueueJob(
      'playerStats',
      match.id,
      { type: 'playerStats', scorerUid: user.uid },
      [`match:${match.id}`],
    ).catch((fallbackErr) => {
      console.error('Stats sync completely failed:', fallbackErr);
    });
  });
}
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass

**Step 4: Commit**

```bash
git add src/data/firebase/cloudSync.ts
git commit -m "feat: call processMatchCompletion callable on match completion"
```

---

### Task 7: Update Firestore Security Rules

**Files:**
- Modify: `firestore.rules`
- Test: `npm run test:rules` (if rule tests exist)

**Step 1: Lock down cross-user write paths**

Update `firestore.rules` to block client writes on all four paths. Add field validation for spectator projection.

For `/users/{userId}/public/{docId}` — split into two rules:
```
// Tier doc — Cloud Function only
match /users/{userId}/public/tier {
  allow read: if request.auth != null;
  allow write: if false;
}

// Profile doc — user can edit their own (but not computed fields)
match /users/{userId}/public/profile {
  allow read: if true;
  allow write: if request.auth != null
    && request.auth.uid == userId
    && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['tier', 'compositeScore']);
}
```

For stats, leaderboard, matchRefs:
```
match /users/{userId}/stats/{docId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false;
}

match /leaderboard/{uid} {
  allow read;
  allow write: if false;
}

match /users/{userId}/matchRefs/{refId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false;
}
```

For spectator projection — add field validation:
```
match /public/{docId} {
  allow read;
  allow create, update: if request.auth != null
    && docId == 'spectator'
    && (request.auth.uid == matchData().ownerId
        || request.auth.uid in matchData().sharedWith)
    && request.resource.data.keys().hasOnly([
         'publicTeam1Name', 'publicTeam2Name', 'team1Score', 'team2Score',
         'gameNumber', 'team1Wins', 'team2Wins', 'status',
         'tournamentId', 'spectatorCount', 'updatedAt', 'visibility'
       ]);
  allow delete: if false;
}
```

**Step 2: Run rule tests**

Run: `npm run test:rules`
Expected: PASS (update rule tests as needed for new deny rules)

**Step 3: Commit**

```bash
git add firestore.rules
git commit -m "security: lock down cross-user write paths, add spectator field validation"
```

---

## Wave B: Spectator Projection Live Updates

### Task 8: Add Projection Write to Sync Processor

**Files:**
- Modify: `src/data/firebase/syncProcessor.ts:108-119`
- Modify: `src/data/firebase/syncQueue.ts` (SyncJobContext type)
- Modify: `src/data/firebase/cloudSync.ts` (store names in context)
- Modify: `src/data/firebase/firestoreSpectatorRepository.ts` (remove shareCode from projection)
- Test: `src/data/firebase/__tests__/syncProcessor.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
// Test that when processing a match job for a tournament match with status 'in-progress',
// the sync processor writes the spectator projection.
// Test that when the projection write fails, the match job still succeeds.
// Test that non-tournament matches skip the projection write.
```

**Step 2: Update `SyncJobContext` to include spectator names**

In the sync queue types, extend the match context:

```typescript
| { type: 'match'; ownerId: string; sharedWith: string[]; visibility?: 'private' | 'shared' | 'public'; spectatorNames?: { publicTeam1Name: string; publicTeam2Name: string } }
```

**Step 3: Update `cloudSync.syncMatchToCloud` to store sanitized names**

When enqueuing a match job for a public tournament match, include the sanitized names in the context. Read names from local state (Dexie) at enqueue time.

**Step 4: Add projection write to `executeJobWork` match case**

After `firestoreMatchRepository.save()` succeeds, add fire-and-forget projection write:

```typescript
case 'match': {
  // ... existing match save ...
  await firestoreMatchRepository.save(match, uid, ctx.sharedWith, ctx.visibility);

  // Fire-and-forget: update spectator projection for tournament matches
  if (match.tournamentId && match.status === 'in-progress' && ctx.spectatorNames) {
    try {
      const projection = buildSpectatorProjection(match, ctx.spectatorNames, '');
      await writeSpectatorProjection(match.id, projection);
    } catch (err) {
      console.warn('[syncProcessor] Spectator projection update failed (non-fatal):', err);
    }
  }
  break;
}
```

**Step 5: Remove `tournamentShareCode` from `SpectatorProjection`**

In `firestoreSpectatorRepository.ts`, remove the `tournamentShareCode` field from the interface and from `buildSpectatorProjection`.

**Step 6: Run tests**

Run: `npx vitest run`
Expected: PASS

**Step 7: Commit**

```bash
git add src/data/firebase/syncProcessor.ts src/data/firebase/syncQueue.ts src/data/firebase/cloudSync.ts src/data/firebase/firestoreSpectatorRepository.ts
git commit -m "feat: write spectator projection on every score sync for tournament matches"
```

---

### Task 9: Handle Projection Status in Spectator UI

**Files:**
- Modify: `src/features/tournaments/hooks/useSpectatorProjection.ts`
- Modify: `src/features/tournaments/PublicMatchPage.tsx`
- Test: `src/features/tournaments/__tests__/useSpectatorProjection.test.ts`

**Step 1: Update `useSpectatorProjection` to expose status**

The hook already returns the full `SpectatorProjection`. Add handling for `status: 'completed'` and `status: 'revoked'` in `PublicMatchPage.tsx`:

```typescript
// In PublicMatchPage.tsx, add status-aware rendering:
<Show when={projection()?.status === 'revoked'}>
  <div class="text-center p-8 text-on-surface-muted">
    This match is no longer public.
  </div>
</Show>
```

**Step 2: Write test for revoked/completed status handling**

**Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/tournaments/hooks/useSpectatorProjection.ts src/features/tournaments/PublicMatchPage.tsx
git commit -m "feat: handle revoked/completed spectator projection status in UI"
```

---

## Wave C: Client-Side UX Fixes

### Task 10: Add Composite Index for Tournament In-Progress Query

**Files:**
- Modify: `firestore.indexes.json`

**Step 1: Add the composite index**

```json
{
  "collectionGroup": "matches",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "tournamentId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

**Step 2: Commit**

```bash
git add firestore.indexes.json
git commit -m "chore: add composite index for tournament in-progress match query"
```

---

### Task 11: Create `useTournamentLiveMatches` Hook

**Files:**
- Create: `src/features/tournaments/hooks/useTournamentLiveMatches.ts`
- Test: `src/features/tournaments/hooks/__tests__/useTournamentLiveMatches.test.ts`

**Step 1: Write the failing test**

Test that the hook:
- Returns an empty array initially (loading state)
- Subscribes to the correct Firestore query path
- Returns only in-progress matches
- Cleans up listener on unmount

**Step 2: Implement the hook**

```typescript
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { Match } from '../../../data/types';

export interface TournamentLiveMatch {
  matchId: string;
  match: Match;
}

export function useTournamentLiveMatches(tournamentId: () => string | null | undefined) {
  const [matches, setMatches] = createSignal<TournamentLiveMatch[]>([]);
  const [loading, setLoading] = createSignal(true);

  createEffect(() => {
    const tid = tournamentId();
    if (!tid) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(firestore, 'matches'),
      where('tournamentId', '==', tid),
      where('status', '==', 'in-progress'),
    );

    const unsub = onSnapshot(q, (snap) => {
      const results = snap.docs.map((doc) => ({
        matchId: doc.id,
        match: { id: doc.id, ...doc.data() } as Match,
      }));
      setMatches(results);
      setLoading(false);
    });

    onCleanup(unsub);
  });

  return { matches, loading };
}
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/tournaments/hooks/useTournamentLiveMatches.ts src/features/tournaments/hooks/__tests__/useTournamentLiveMatches.test.ts
git commit -m "feat: add useTournamentLiveMatches hook with single Firestore query"
```

---

### Task 12: Update PublicTournamentPage — Query-Based Filtering + Retention Changes

**Files:**
- Modify: `src/features/tournaments/PublicTournamentPage.tsx:60-133`
- Test: Existing PublicTournamentPage tests

**Step 1: Replace `getInProgressMatches` with `useTournamentLiveMatches`**

Replace the `inProgressMatches` memo (lines 60-82) with the new hook:

```typescript
const { matches: liveMatchDocs, loading: liveLoading } = useTournamentLiveMatches(
  () => live.tournament()?.id,
);

const inProgressMatches = createMemo(() => {
  const names = teamNames();
  return liveMatchDocs().map((m) => ({
    matchId: m.matchId,
    team1Name: names[m.match.tournamentTeam1Id ?? ''] ?? m.match.team1Name,
    team2Name: names[m.match.tournamentTeam2Id ?? ''] ?? m.match.team2Name,
    court: undefined, // TODO: resolve from pool schedule if available
    status: 'in-progress' as const,
  }));
});
```

**Step 2: Add pending state support**

Pass `liveLoading()` to `LiveNowSection` so it can show skeletons:

```typescript
<LiveNowSection
  matches={allVisibleMatches()}
  tournamentCode={code()}
  loading={liveLoading()}
/>
```

**Step 3: Update retention — cap at 3 and reduce to 2 minutes**

```typescript
const RETENTION_MS = 2 * 60 * 1000; // Changed from 5 to 2 minutes
const MAX_RETAINED = 3;

// In the retention effect, add cap:
setRetainedMatches(p => {
  const next = new Map(p);
  next.set(match.matchId, { match: { ...match, status: 'completed' as const }, completedAt: Date.now() });
  // Cap at MAX_RETAINED — evict oldest if over limit
  if (next.size > MAX_RETAINED) {
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, entry] of next) {
      if (entry.completedAt < oldestTime) {
        oldestTime = entry.completedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) next.delete(oldestKey);
  }
  return next;
});
```

**Step 4: Ensure live matches sort before FINAL**

The `allVisibleMatches` memo already puts live before retained — verify this is maintained.

**Step 5: Run tests**

Run: `npx vitest run`
Expected: PASS

**Step 6: Commit**

```bash
git add src/features/tournaments/PublicTournamentPage.tsx
git commit -m "feat: use query-based live match filtering, cap retention at 3/2min"
```

---

### Task 13: Add Inline Scores to LiveNowSection

**Files:**
- Modify: `src/features/tournaments/components/LiveNowSection.tsx`
- Test: `src/features/tournaments/components/__tests__/LiveNowSection.test.ts`

**Step 1: Write the failing test**

Test that LiveNowSection renders score values when match data is loaded.

**Step 2: Update LiveNowSection to use `useLiveMatch` per visible card**

Add `useLiveMatch` inside the `<For>` loop for each visible match. Render compact inline scores with skeleton loading state:

```tsx
<For each={visibleMatches()}>
  {(m) => {
    const { match: liveMatch, loading } = useLiveMatch(() => m.matchId);
    const score = () => extractLiveScore(liveMatch());

    return (
      <li>
        <a href={`/t/${props.tournamentCode}/match/${m.matchId}`}
           class={`block px-3 py-2 rounded-lg border-l-4 transition-colors duration-300 ${
             m.status === 'completed'
               ? 'border-green-500 bg-surface-lighter'
               : 'border-amber-500 bg-surface-light'
           }`}>
          <div class="flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex justify-between text-sm">
                <span class="truncate">{m.team1Name}</span>
                <Show when={!loading()} fallback={<span class="w-4 h-4 bg-surface-lighter rounded animate-pulse" />}>
                  <span class="font-mono font-bold">{score().team1Score}</span>
                </Show>
              </div>
              <div class="flex justify-between text-sm">
                <span class="truncate">{m.team2Name}</span>
                <Show when={!loading()} fallback={<span class="w-4 h-4 bg-surface-lighter rounded animate-pulse" />}>
                  <span class="font-mono font-bold">{score().team2Score}</span>
                </Show>
              </div>
            </div>
            <div class="ml-2 flex-shrink-0">
              <Show when={m.status === 'in-progress'}>
                <span class="text-xs text-red-400 font-semibold flex items-center gap-1">
                  <span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  LIVE
                </span>
              </Show>
              <Show when={m.status === 'completed'}>
                <span class="text-xs text-green-400 font-semibold">FINAL</span>
              </Show>
            </div>
          </div>
        </a>
      </li>
    );
  }}
</For>
```

**Step 3: Add loading skeleton when `props.loading` is true**

```tsx
<Show when={props.loading}>
  <div class="space-y-2">
    <For each={[1, 2, 3]}>
      {() => <div class="h-14 bg-surface-lighter rounded-lg animate-pulse" />}
    </For>
  </div>
</Show>
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/components/LiveNowSection.tsx
git commit -m "feat: add inline live scores to LiveNowSection cards with skeleton loading"
```

---

### Task 14: Add Expandable Overflow to LiveNowSection

**Files:**
- Modify: `src/features/tournaments/components/LiveNowSection.tsx`
- Test: `src/features/tournaments/components/__tests__/LiveNowSection.test.ts`

**Step 1: Write the failing test**

Test that:
- When 4+ matches, shows "+N more live" button
- Clicking expands to show all matches
- Clicking "Show fewer" collapses back to MAX_VISIBLE

**Step 2: Add expandable state**

```tsx
const [expanded, setExpanded] = createSignal(false);
const displayLimit = () => expanded() ? props.matches.length : MAX_VISIBLE;
const visibleMatches = () => props.matches.slice(0, displayLimit());
const overflowCount = () => Math.max(0, props.matches.length - MAX_VISIBLE);
```

Replace the old static overflow text (lines 134-140) with:

```tsx
<Show when={overflowCount() > 0}>
  <button
    type="button"
    onClick={() => setExpanded((prev) => !prev)}
    class="w-full mt-2 py-2 text-center text-xs text-on-surface-muted hover:text-on-surface transition-colors rounded-lg"
  >
    {expanded() ? 'Show fewer' : `+${overflowCount()} more live \u2192`}
  </button>
</Show>
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/tournaments/components/LiveNowSection.tsx
git commit -m "feat: add expandable overflow toggle to LiveNowSection"
```

---

### Task 15: Final Integration Test + Cleanup

**Files:**
- Run full test suite
- Remove dead code (old client-side `writePublicTier` calls in stats flow)
- Verify type check passes

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run Cloud Functions tests**

Run: `cd functions && npx vitest run`
Expected: All tests pass

**Step 4: Build Cloud Functions**

Run: `cd functions && npm run build`
Expected: Compiles successfully

**Step 5: Clean up dead code**

Remove `writePublicTier` call from `firestorePlayerStatsRepository.ts` (lines 359-361) — now handled by Cloud Function.

Remove the old leaderboard write from the client-side transaction in `updatePlayerStats` (lines 346-351) — now handled by Cloud Function.

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: remove dead client-side stats/tier/leaderboard write code"
```

---

## Summary

| Wave | Tasks | What It Delivers |
|------|-------|------------------|
| **A** (Tasks 1-7) | Shared types + Cloud Functions + security rules | Server-side stats computation, cross-user write lockdown |
| **B** (Tasks 8-9) | Spectator projection live updates | Live scores in spectator projection, revocation handling |
| **C** (Tasks 10-14) | Client-side UX fixes | Accurate live filtering, inline scores, expandable overflow |
| **Cleanup** (Task 15) | Integration test + dead code removal | Clean codebase, all tests passing |
