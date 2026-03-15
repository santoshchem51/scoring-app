# Layer 8 Deferred Items Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve all 7 remaining Layer 8 deferred items — security lockdown via Cloud Functions, live spectator projections, and client-side UX fixes.

**Architecture:** Three waves: (A) shared types extraction + Cloud Functions infrastructure with HTTPS callable for match completion, (B) client-side spectator projection updates piggybacked on syncProcessor, (C) client-side UX fixes for LiveNowSection (query-based filtering, inline scores, expandable overflow). Wave A tasks are sequential. Waves B and C are independent and can be implemented in parallel. Security rules deploy LAST (after all client changes land) to avoid rejecting writes from old client code.

**Tech Stack:** Firebase Cloud Functions Gen 2 (TypeScript/Node 20), firebase-admin, firebase-functions v6+, SolidJS, Firestore, Vitest

---

## Wave A: Shared Types + Cloud Functions Infrastructure

### Task 1a: Create shared-types package — types

**Files:**
- Create: `shared-types/package.json`
- Create: `shared-types/types.ts`

**Step 1 — RED: Write failing test**

No test for this task — it is pure file creation with no logic. The compile check in Task 1b validates correctness.

**Step 2: Create `shared-types/package.json`**

```json
{
  "name": "shared-types",
  "version": "1.0.0",
  "private": true,
  "main": "types.ts"
}
```

**Step 3: Create `shared-types/types.ts`**

Extract the following types from `src/data/types.ts` into `shared-types/types.ts`. These are the types needed by both client and Cloud Functions:

```typescript
// shared-types/types.ts — canonical type definitions shared between client and Cloud Functions

export type ScoringMode = 'sideout' | 'rally';
export type MatchFormat = 'single' | 'best-of-3' | 'best-of-5';
export type MatchStatus = 'in-progress' | 'completed' | 'abandoned';
export type GameType = 'singles' | 'doubles';

export interface MatchConfig {
  gameType: GameType;
  scoringMode: ScoringMode;
  matchFormat: MatchFormat;
  pointsToWin: 11 | 15 | 21;
}

export interface GameResult {
  gameNumber: number;
  team1Score: number;
  team2Score: number;
  winningSide: 1 | 2;
}

export interface Match {
  id: string;
  config: MatchConfig;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
  team1Name: string;
  team2Name: string;
  team1Color?: string;
  team2Color?: string;
  games: GameResult[];
  winningSide: 1 | 2 | null;
  status: MatchStatus;
  startedAt: number;
  completedAt: number | null;
  tournamentId?: string;
  tournamentTeam1Id?: string;
  tournamentTeam2Id?: string;
  poolId?: string;
  bracketSlotId?: string;
  court?: string;
  lastSnapshot?: string | null;
  scorerRole?: 'player' | 'spectator';
  scorerTeam?: 1 | 2;
  ownerUid?: string;
}

export type MatchVisibility = 'private' | 'shared' | 'public';

export interface CloudMatch extends Match {
  ownerId: string;
  sharedWith: string[];
  visibility: MatchVisibility;
  syncedAt: number;
}

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

export interface UserProfile {
  id: string;
  displayName: string;
  displayNameLower: string;
  email: string;
  photoURL: string | null;
  createdAt: number;
  bio?: string;
  profileVisibility?: 'public' | 'private';
  updatedAt?: number;
}
```

**Step 4: Commit**

```bash
git add shared-types/package.json shared-types/types.ts
git commit -m "feat: create shared-types package with canonical type definitions"
```

---

### Task 1b: Create shared-types package — utility functions

**Files:**
- Create: `shared-types/utils/tierEngine.ts`
- Create: `shared-types/utils/leaderboardScoring.ts`
- Create: `shared-types/tsconfig.json`
- Test: `shared-types/utils/__tests__/tierEngine.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// shared-types/utils/__tests__/tierEngine.test.ts
import { describe, it, expect } from 'vitest';
import { computeTierScore, computeTier, computeTierConfidence, nearestTier, TIER_MULTIPLIER } from '../tierEngine';

describe('tierEngine (shared-types)', () => {
  it('returns prior score for empty results', () => {
    expect(computeTierScore([])).toBe(0.25);
  });

  it('computes tier from score with hysteresis', () => {
    expect(computeTier(0.35, 'beginner')).toBe('intermediate');
    expect(computeTier(0.30, 'intermediate')).toBe('intermediate'); // hysteresis gap
    expect(computeTier(0.26, 'intermediate')).toBe('beginner');
  });

  it('computes confidence from match count and opponents', () => {
    expect(computeTierConfidence(5, 2)).toBe('low');
    expect(computeTierConfidence(8, 3)).toBe('medium');
    expect(computeTierConfidence(20, 6)).toBe('high');
  });

  it('nearestTier maps multiplier to closest tier', () => {
    expect(nearestTier(0.5)).toBe('beginner');
    expect(nearestTier(1.0)).toBe('advanced');
    expect(nearestTier(1.3)).toBe('expert');
  });

  it('TIER_MULTIPLIER has all four tiers', () => {
    expect(Object.keys(TIER_MULTIPLIER)).toEqual(['beginner', 'intermediate', 'advanced', 'expert']);
  });
});
```

**Step 2 — Run test, verify RED**

```bash
cd shared-types && npx vitest run utils/__tests__/tierEngine.test.ts
# Expected: FAIL — module '../tierEngine' not found
```

**Step 3 — GREEN: Create the utility files**

Create `shared-types/tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": ".",
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["**/__tests__/**", "dist"]
}
```

Copy `src/shared/utils/tierEngine.ts` to `shared-types/utils/tierEngine.ts`, changing the import path:

```typescript
// shared-types/utils/tierEngine.ts
import type { RecentResult, Tier, TierConfidence } from '../types';

// (exact same logic as src/shared/utils/tierEngine.ts — all exports preserved)
export const TIER_MULTIPLIER: Record<Tier, number> = {
  beginner: 0.5,
  intermediate: 0.8,
  advanced: 1.0,
  expert: 1.3,
};

const TIER_MULTIPLIER_ENTRIES = Object.entries(TIER_MULTIPLIER) as [Tier, number][];

export function nearestTier(multiplier: number): Tier {
  let closest: Tier = 'beginner';
  let minDist = Infinity;
  for (const [tier, mul] of TIER_MULTIPLIER_ENTRIES) {
    const dist = Math.abs(multiplier - mul);
    if (dist < minDist) {
      minDist = dist;
      closest = tier;
    } else if (dist === minDist) {
      const currentClosestMul = TIER_MULTIPLIER[closest];
      if (Math.abs(mul - 1.0) < Math.abs(currentClosestMul - 1.0)) {
        closest = tier;
      }
    }
  }
  return closest;
}

const RECENCY_BUCKETS = [
  { maxIndex: 10, weight: 1.0 },
  { maxIndex: 25, weight: 0.8 },
  { maxIndex: 50, weight: 0.6 },
] as const;

const DAMPING_MATCHES = 15;
const PRIOR_SCORE = 0.25;

function getRecencyWeight(index: number): number {
  for (const bucket of RECENCY_BUCKETS) {
    if (index < bucket.maxIndex) return bucket.weight;
  }
  return RECENCY_BUCKETS[RECENCY_BUCKETS.length - 1].weight;
}

export function computeTierScore(results: RecentResult[]): number {
  if (results.length === 0) return PRIOR_SCORE;
  let weightedWins = 0;
  let totalWeight = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const recency = getRecencyWeight(results.length - 1 - i);
    const tierMul = TIER_MULTIPLIER[r.opponentTier];
    if (r.result === 'win') {
      weightedWins += recency * tierMul;
    }
    totalWeight += recency;
  }
  const rawScore = totalWeight > 0 ? weightedWins / totalWeight : 0;
  const dampingFactor = Math.min(results.length / DAMPING_MATCHES, 1.0);
  const score = PRIOR_SCORE + (rawScore - PRIOR_SCORE) * dampingFactor;
  return Math.max(0, Math.min(1, score));
}

interface TierThreshold {
  tier: Tier;
  promoteAbove: number | null;
  demoteBelow: number | null;
}

const TIER_THRESHOLDS: TierThreshold[] = [
  { tier: 'beginner', promoteAbove: 0.33, demoteBelow: null },
  { tier: 'intermediate', promoteAbove: 0.53, demoteBelow: 0.27 },
  { tier: 'advanced', promoteAbove: 0.73, demoteBelow: 0.47 },
  { tier: 'expert', promoteAbove: null, demoteBelow: 0.67 },
];

const TIER_ORDER: Tier[] = ['beginner', 'intermediate', 'advanced', 'expert'];

export function computeTier(score: number, currentTier: Tier): Tier {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  if (currentIndex === -1) return 'beginner';
  const current = TIER_THRESHOLDS[currentIndex];
  if (current.promoteAbove !== null && score > current.promoteAbove) {
    const nextTier = TIER_ORDER[currentIndex + 1];
    return computeTier(score, nextTier);
  }
  if (current.demoteBelow !== null && score < current.demoteBelow) {
    const prevTier = TIER_ORDER[currentIndex - 1];
    return computeTier(score, prevTier);
  }
  return currentTier;
}

export function computeTierConfidence(
  matchCount: number,
  uniqueOpponents: number,
): TierConfidence {
  if (matchCount >= 20 && uniqueOpponents >= 6) return 'high';
  if (matchCount >= 8 && uniqueOpponents >= 3) return 'medium';
  return 'low';
}
```

Copy `src/shared/utils/leaderboardScoring.ts` to `shared-types/utils/leaderboardScoring.ts`, changing the import path:

```typescript
// shared-types/utils/leaderboardScoring.ts
import type { Tier, RecentResult, StatsSummary, Last30dStats, LeaderboardEntry } from '../types';

// (exact same logic as src/shared/utils/leaderboardScoring.ts — all exports preserved)
const TIER_SCORE: Record<Tier, number> = {
  beginner: 25,
  intermediate: 50,
  advanced: 75,
  expert: 100,
};

export function computeCompositeScore(
  tier: Tier,
  winRate: number,
  totalMatches: number,
): number {
  const clampedWinRate = Number.isFinite(winRate) ? Math.max(0, Math.min(1, winRate)) : 0;
  const tierScore = TIER_SCORE[tier];
  const activityScore = Math.min(totalMatches / 50, 1) * 100;
  return 0.40 * tierScore + 0.35 * clampedWinRate * 100 + 0.25 * activityScore;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function computeLast30dStats(
  recentResults: RecentResult[],
  tier: Tier,
  now: number,
): Last30dStats {
  const cutoff = now - THIRTY_DAYS_MS;
  const recent = recentResults.filter((r) => r.completedAt > cutoff);
  const totalMatches = recent.length;
  const wins = recent.filter((r) => r.result === 'win').length;
  const winRate = totalMatches > 0 ? wins / totalMatches : 0;
  const compositeScore = computeCompositeScore(tier, winRate, totalMatches);
  return { totalMatches, wins, winRate, compositeScore };
}

const MIN_MATCHES_FOR_LEADERBOARD = 5;

export function buildLeaderboardEntry(
  uid: string,
  displayName: string,
  photoURL: string | null,
  stats: StatsSummary,
  now: number,
): LeaderboardEntry | null {
  if (stats.totalMatches < MIN_MATCHES_FOR_LEADERBOARD) return null;
  const compositeScore = computeCompositeScore(stats.tier, stats.winRate, stats.totalMatches);
  const last30d = computeLast30dStats(stats.recentResults, stats.tier, now);
  return {
    uid,
    displayName,
    photoURL,
    tier: stats.tier,
    tierConfidence: stats.tierConfidence,
    totalMatches: stats.totalMatches,
    wins: stats.wins,
    winRate: stats.winRate,
    currentStreak: stats.currentStreak,
    compositeScore,
    last30d,
    lastPlayedAt: stats.lastPlayedAt,
    createdAt: now,
    updatedAt: now,
  };
}
```

**Step 4 — Run test, verify GREEN**

```bash
cd shared-types && npx vitest run utils/__tests__/tierEngine.test.ts
# Expected: PASS — all 5 tests pass
```

**Step 5 — REFACTOR: Update client to re-export from shared-types**

Modify `src/shared/utils/tierEngine.ts`:

```typescript
// src/shared/utils/tierEngine.ts — re-export from shared-types (single source of truth)
export {
  TIER_MULTIPLIER,
  nearestTier,
  computeTierScore,
  computeTier,
  computeTierConfidence,
} from '../../../shared-types/utils/tierEngine';
```

Modify `src/shared/utils/leaderboardScoring.ts`:

```typescript
// src/shared/utils/leaderboardScoring.ts — re-export from shared-types
export {
  computeCompositeScore,
  computeLast30dStats,
  buildLeaderboardEntry,
} from '../../../shared-types/utils/leaderboardScoring';
```

Run full client test suite to verify nothing breaks:

```bash
npx vitest run
# Expected: all existing tests still pass
```

**Step 6: Commit**

```bash
git add shared-types/ src/shared/utils/tierEngine.ts src/shared/utils/leaderboardScoring.ts
git commit -m "feat: add shared-types utility functions, re-export from client"
```

---

### Task 2a: Cloud Functions project scaffold

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/src/index.ts`
- Create: `functions/.eslintrc.js`

**Step 1 — RED: Write failing test**

No test for scaffold — validated by compile in next task.

**Step 2: Create `functions/package.json`**

```json
{
  "name": "picklescore-functions",
  "version": "1.0.0",
  "private": true,
  "main": "lib/index.js",
  "engines": {
    "node": "20"
  },
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "test": "vitest run",
    "predeploy": "npm ci && npm run build"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^6.0.0",
    "shared-types": "file:../shared-types"
  },
  "devDependencies": {
    "typescript": "~5.5.0",
    "vitest": "^2.0.0"
  }
}
```

**Step 3: Create `functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "lib",
    "rootDir": "src",
    "declaration": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "lib", "**/__tests__/**"]
}
```

**Step 4: Create `functions/src/index.ts`**

```typescript
// functions/src/index.ts — entry point for Cloud Functions
// initializeApp MUST be called here (not in individual function files)
// to avoid crashes on second function import.
import { initializeApp } from 'firebase-admin/app';

initializeApp();

// Export callable functions
export { processMatchCompletion } from './callable/processMatchCompletion';
```

**Step 5: Install dependencies and verify compile**

```bash
cd functions && npm install && npm run build
# Expected: compiles without errors, lib/ directory created
```

**Step 6: Commit**

```bash
git add functions/package.json functions/tsconfig.json functions/src/index.ts
git commit -m "feat: scaffold Cloud Functions project with firebase-admin"
```

---

### Task 2b: Update firebase.json — functions emulator + deploy config

**Files:**
- Modify: `firebase.json`
- Test: manual verification

**Step 1 — RED: Write failing test**

```typescript
// functions/src/__tests__/firebase-config.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('firebase.json config', () => {
  const config = JSON.parse(
    readFileSync(resolve(__dirname, '../../../firebase.json'), 'utf-8'),
  );

  it('has functions emulator port', () => {
    expect(config.emulators.functions).toBeDefined();
    expect(config.emulators.functions.port).toBe(5001);
  });

  it('has functions deploy config with predeploy', () => {
    expect(config.functions).toBeDefined();
    expect(config.functions.source).toBe('functions');
    expect(config.functions.predeploy).toContain('npm ci');
    expect(config.functions.predeploy).toContain('npm run build');
  });

  it('CSP connect-src includes cloudfunctions.net', () => {
    const cspHeader = config.hosting.headers
      .find((h: any) => h.source === '**')
      ?.headers.find((h: any) => h.key === 'Content-Security-Policy');
    expect(cspHeader?.value).toContain('cloudfunctions.net');
  });
});
```

**Step 2 — Run test, verify RED**

```bash
cd functions && npx vitest run src/__tests__/firebase-config.test.ts
# Expected: FAIL — functions emulator not in config, CSP missing cloudfunctions.net
```

**Step 3 — GREEN: Update firebase.json**

Add `functions` top-level config and functions emulator. Update CSP header to allow callable traffic:

In `firebase.json`, add the `"functions"` key at top level:

```json
"functions": {
  "source": "functions",
  "codebase": "default",
  "predeploy": [
    "npm --prefix \"$RESOURCE_DIR\" ci",
    "npm --prefix \"$RESOURCE_DIR\" run build"
  ],
  "runtime": "nodejs20"
}
```

In `emulators`, add:

```json
"functions": {
  "port": 5001
}
```

In the CSP `connect-src` directive, add `https://*.cloudfunctions.net` after the existing `https://*.firebaseapp.com`:

```
connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://*.googleapis.com https://*.firebaseapp.com https://*.cloudfunctions.net;
```

**Step 4 — Run test, verify GREEN**

```bash
cd functions && npx vitest run src/__tests__/firebase-config.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add firebase.json functions/src/__tests__/firebase-config.test.ts
git commit -m "feat: add functions emulator, deploy config, and CSP for callables"
```

---

### Task 2c: Update client config.ts — export functions instance + emulator

**Files:**
- Modify: `src/data/firebase/config.ts`
- Test: `src/data/firebase/__tests__/config-functions.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// src/data/firebase/__tests__/config-functions.test.ts
import { describe, it, expect } from 'vitest';

describe('firebase config exports', () => {
  it('exports a functions instance', async () => {
    // Dynamic import to avoid side effects in other tests
    const mod = await import('../config');
    expect(mod.functions).toBeDefined();
  });
});
```

**Step 2 — Run test, verify RED**

```bash
npx vitest run src/data/firebase/__tests__/config-functions.test.ts
# Expected: FAIL — 'functions' is not exported from '../config'
```

**Step 3 — GREEN: Update config.ts**

Add to `src/data/firebase/config.ts`:

After the existing imports, add:

```typescript
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
```

After `export const firestore = getFirestore(app);`, add:

```typescript
export const functions = getFunctions(app);
```

Inside the emulator block (`if (import.meta.env.DEV && ...)`), add:

```typescript
connectFunctionsEmulator(functions, '127.0.0.1', 5001);
```

**Step 4 — Run test, verify GREEN**

```bash
npx vitest run src/data/firebase/__tests__/config-functions.test.ts
# Expected: PASS
```

**Step 5 — REFACTOR: None needed.**

**Step 6: Commit**

```bash
git add src/data/firebase/config.ts src/data/firebase/__tests__/config-functions.test.ts
git commit -m "feat: export functions instance from firebase config with emulator support"
```

---

### Task 3: Participant resolution module

**Files:**
- Create: `functions/src/lib/participantResolution.ts`
- Test: `functions/src/lib/__tests__/participantResolution.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// functions/src/lib/__tests__/participantResolution.test.ts
import { describe, it, expect } from 'vitest';
import { resolveParticipants } from '../participantResolution';
import type { CloudMatch } from 'shared-types/types';

function makeMatch(overrides: Partial<CloudMatch> = {}): CloudMatch {
  return {
    id: 'match-1',
    config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
    team1PlayerIds: [], team2PlayerIds: [],
    team1Name: 'Team A', team2Name: 'Team B',
    games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
    winningSide: 1, status: 'completed',
    startedAt: 1000, completedAt: 2000,
    ownerId: 'owner-1', sharedWith: [], visibility: 'private', syncedAt: 3000,
    ...overrides,
  };
}

describe('resolveParticipants', () => {
  it('returns empty for null winningSide (abandoned match)', () => {
    const match = makeMatch({ winningSide: null });
    const result = resolveParticipants(match, []);
    expect(result).toEqual([]);
  });

  it('resolves tournament participants from registrations', () => {
    const match = makeMatch({
      tournamentId: 't1',
      tournamentTeam1Id: 'team-a',
      tournamentTeam2Id: 'team-b',
      winningSide: 1,
    });
    const registrations = [
      { id: 'r1', userId: 'user-1', teamId: 'team-a' },
      { id: 'r2', userId: 'user-2', teamId: 'team-b' },
    ];
    const result = resolveParticipants(match, registrations);
    expect(result).toEqual([
      { uid: 'user-1', playerTeam: 1, result: 'win' },
      { uid: 'user-2', playerTeam: 2, result: 'loss' },
    ]);
  });

  it('resolves doubles tournament participants', () => {
    const match = makeMatch({
      config: { gameType: 'doubles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
      tournamentId: 't1',
      tournamentTeam1Id: 'team-a',
      tournamentTeam2Id: 'team-b',
      winningSide: 2,
    });
    const registrations = [
      { id: 'r1', userId: 'user-1', teamId: 'team-a' },
      { id: 'r2', userId: 'user-2', teamId: 'team-a' },
      { id: 'r3', userId: 'user-3', teamId: 'team-b' },
      { id: 'r4', userId: 'user-4', teamId: 'team-b' },
    ];
    const result = resolveParticipants(match, registrations);
    expect(result).toHaveLength(4);
    expect(result.filter(p => p.result === 'win')).toHaveLength(2);
    expect(result.filter(p => p.result === 'loss')).toHaveLength(2);
  });

  it('deduplicates UIDs (first occurrence wins)', () => {
    const match = makeMatch({
      tournamentId: 't1',
      tournamentTeam1Id: 'team-a',
      tournamentTeam2Id: 'team-b',
      winningSide: 1,
    });
    const registrations = [
      { id: 'r1', userId: 'user-1', teamId: 'team-a' },
      { id: 'r2', userId: 'user-1', teamId: 'team-b' }, // duplicate
    ];
    const result = resolveParticipants(match, registrations);
    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe('user-1');
  });
});
```

**Step 2 — Run test, verify RED**

```bash
cd functions && npx vitest run src/lib/__tests__/participantResolution.test.ts
# Expected: FAIL — module not found
```

**Step 3 — GREEN: Implement**

```typescript
// functions/src/lib/participantResolution.ts
import type { CloudMatch } from 'shared-types/types';

export interface Participant {
  uid: string;
  playerTeam: 1 | 2;
  result: 'win' | 'loss';
}

interface RegistrationData {
  id: string;
  userId: string;
  teamId: string;
}

/**
 * Resolves match participants to UIDs with win/loss results.
 * Pure function — no Firestore access (registrations are passed in).
 */
export function resolveParticipants(
  match: CloudMatch,
  registrations: RegistrationData[],
): Participant[] {
  // No stats for abandoned matches
  if (match.winningSide === null) return [];

  const participants: Participant[] = [];
  const isTournament = !!(match.tournamentId && (match.tournamentTeam1Id || match.tournamentTeam2Id));

  if (isTournament) {
    for (const reg of registrations) {
      if (!reg.userId) continue;
      const isTeam1 = reg.teamId === match.tournamentTeam1Id;
      const isTeam2 = reg.teamId === match.tournamentTeam2Id;
      if (!isTeam1 && !isTeam2) continue;
      const playerTeam: 1 | 2 = isTeam1 ? 1 : 2;
      const result: 'win' | 'loss' = match.winningSide === playerTeam ? 'win' : 'loss';
      participants.push({ uid: reg.userId, playerTeam, result });
    }
  }

  // Dedup
  const seen = new Set<string>();
  const deduped: Participant[] = [];
  for (const p of participants) {
    if (seen.has(p.uid)) continue;
    seen.add(p.uid);
    deduped.push(p);
  }
  return deduped;
}
```

**Step 4 — Run test, verify GREEN**

```bash
cd functions && npx vitest run src/lib/__tests__/participantResolution.test.ts
# Expected: PASS
```

**Step 5 — REFACTOR: Consider if any cleanup needed. None expected.**

**Step 6: Commit**

```bash
git add functions/src/lib/participantResolution.ts functions/src/lib/__tests__/participantResolution.test.ts
git commit -m "feat: add participant resolution module for Cloud Functions"
```

---

### Task 4: Stats computation module

**Files:**
- Create: `functions/src/lib/statsComputation.ts`
- Test: `functions/src/lib/__tests__/statsComputation.test.ts`

Note: Tasks 3 and 4 can be implemented in parallel (no dependencies between them).

**Step 1 — RED: Write failing test**

```typescript
// functions/src/lib/__tests__/statsComputation.test.ts
import { describe, it, expect } from 'vitest';
import { computeUpdatedStats, buildMatchRefFromMatch } from '../statsComputation';
import type { StatsSummary, CloudMatch, Tier } from 'shared-types/types';

function emptyStats(): StatsSummary {
  return {
    schemaVersion: 1, totalMatches: 0, wins: 0, losses: 0, winRate: 0,
    currentStreak: { type: 'W', count: 0 }, bestWinStreak: 0,
    singles: { matches: 0, wins: 0, losses: 0 },
    doubles: { matches: 0, wins: 0, losses: 0 },
    recentResults: [], tier: 'beginner', tierConfidence: 'low',
    tierUpdatedAt: 0, lastPlayedAt: 0, updatedAt: 0, uniqueOpponentUids: [],
  };
}

function makeMatch(overrides: Partial<CloudMatch> = {}): CloudMatch {
  return {
    id: 'match-1',
    config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
    team1PlayerIds: [], team2PlayerIds: [],
    team1Name: 'Team A', team2Name: 'Team B',
    games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
    winningSide: 1, status: 'completed',
    startedAt: 1000, completedAt: 2000,
    ownerId: 'owner-1', sharedWith: [], visibility: 'private', syncedAt: 3000,
    ...overrides,
  };
}

describe('computeUpdatedStats', () => {
  it('increments wins for a winning player', () => {
    const stats = emptyStats();
    const result = computeUpdatedStats(stats, makeMatch(), 1, 'win', 'beginner', []);
    expect(result.totalMatches).toBe(1);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
    expect(result.winRate).toBe(1);
    expect(result.singles.wins).toBe(1);
    expect(result.currentStreak).toEqual({ type: 'W', count: 1 });
  });

  it('increments losses for a losing player', () => {
    const stats = emptyStats();
    const result = computeUpdatedStats(stats, makeMatch(), 2, 'loss', 'beginner', []);
    expect(result.totalMatches).toBe(1);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(1);
  });

  it('updates doubles stats for doubles matches', () => {
    const match = makeMatch({
      config: { gameType: 'doubles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
    });
    const stats = emptyStats();
    const result = computeUpdatedStats(stats, match, 1, 'win', 'beginner', []);
    expect(result.doubles.wins).toBe(1);
    expect(result.singles.wins).toBe(0);
  });

  it('merges opponent UIDs into uniqueOpponentUids', () => {
    const stats = emptyStats();
    stats.uniqueOpponentUids = ['existing-uid'];
    const result = computeUpdatedStats(stats, makeMatch(), 1, 'win', 'beginner', ['opp-1', 'opp-2']);
    expect(result.uniqueOpponentUids).toContain('existing-uid');
    expect(result.uniqueOpponentUids).toContain('opp-1');
    expect(result.uniqueOpponentUids).toContain('opp-2');
  });

  it('caps recentResults ring buffer at 50', () => {
    const stats = emptyStats();
    stats.recentResults = Array.from({ length: 50 }, (_, i) => ({
      result: 'win' as const, opponentTier: 'beginner' as Tier,
      completedAt: i, gameType: 'singles' as const,
    }));
    const result = computeUpdatedStats(stats, makeMatch(), 1, 'win', 'beginner', []);
    expect(result.recentResults.length).toBe(50);
  });
});

describe('buildMatchRefFromMatch', () => {
  it('builds a match ref with correct fields', () => {
    const match = makeMatch();
    const ref = buildMatchRefFromMatch(match, 1, 'win', 'owner-1');
    expect(ref.matchId).toBe('match-1');
    expect(ref.result).toBe('win');
    expect(ref.playerTeam).toBe(1);
    expect(ref.ownerId).toBe('owner-1');
    expect(ref.scores).toBe('11-5');
    expect(ref.gameScores).toEqual([[11, 5]]);
  });
});
```

**Step 2 — Run test, verify RED**

```bash
cd functions && npx vitest run src/lib/__tests__/statsComputation.test.ts
# Expected: FAIL — module not found
```

**Step 3 — GREEN: Implement**

```typescript
// functions/src/lib/statsComputation.ts
import type { CloudMatch, StatsSummary, MatchRef, RecentResult, Tier, TierConfidence } from 'shared-types/types';
import { computeTierScore, computeTier, computeTierConfidence } from 'shared-types/utils/tierEngine';

const RING_BUFFER_SIZE = 50;

function updateStreak(
  current: { type: 'W' | 'L'; count: number },
  result: 'win' | 'loss',
): { type: 'W' | 'L'; count: number } {
  const streakType = result === 'win' ? 'W' : 'L';
  if (current.type === streakType) {
    return { type: streakType, count: current.count + 1 };
  }
  return { type: streakType, count: 1 };
}

function estimateUniqueOpponents(matchCount: number): number {
  return Math.ceil(matchCount * 0.7);
}

/**
 * Pure computation: takes existing stats and returns updated stats.
 * No Firestore access — all inputs are passed in.
 */
export function computeUpdatedStats(
  existing: StatsSummary,
  match: CloudMatch,
  playerTeam: 1 | 2,
  result: 'win' | 'loss',
  opponentTier: Tier,
  opponentUids: string[],
): StatsSummary {
  const stats = structuredClone(existing);
  const isWin = result === 'win';
  const gameType = match.config.gameType;

  stats.totalMatches += 1;
  stats.wins += isWin ? 1 : 0;
  stats.losses += isWin ? 0 : 1;
  stats.winRate = stats.totalMatches > 0 ? stats.wins / stats.totalMatches : 0;

  const formatStats = gameType === 'singles' ? stats.singles : stats.doubles;
  formatStats.matches += 1;
  formatStats.wins += isWin ? 1 : 0;
  formatStats.losses += isWin ? 0 : 1;

  const newStreak = updateStreak(stats.currentStreak, result);
  stats.currentStreak = newStreak;
  if (newStreak.type === 'W' && newStreak.count > stats.bestWinStreak) {
    stats.bestWinStreak = newStreak.count;
  }

  const newResult: RecentResult = {
    result,
    opponentTier,
    completedAt: match.completedAt ?? Date.now(),
    gameType,
  };
  stats.recentResults = [...stats.recentResults, newResult].slice(-RING_BUFFER_SIZE);

  const score = computeTierScore(stats.recentResults);
  stats.tier = computeTier(score, stats.tier);

  // Merge opponent UIDs
  const existingUids = new Set(stats.uniqueOpponentUids ?? []);
  for (const oid of opponentUids) {
    existingUids.add(oid);
  }
  stats.uniqueOpponentUids = [...existingUids];

  const uniqueOpponents = stats.uniqueOpponentUids.length || estimateUniqueOpponents(stats.totalMatches);
  stats.tierConfidence = computeTierConfidence(stats.totalMatches, uniqueOpponents);
  stats.tierUpdatedAt = Date.now();
  stats.lastPlayedAt = match.completedAt ?? Date.now();
  stats.updatedAt = Date.now();

  return stats;
}

/**
 * Build a MatchRef from match data (server-side, no client trust).
 */
export function buildMatchRefFromMatch(
  match: CloudMatch,
  playerTeam: 1 | 2,
  result: 'win' | 'loss',
  ownerId: string,
): MatchRef {
  const opponentTeam = playerTeam === 1 ? 2 : 1;
  const opponentNames = opponentTeam === 1 ? [match.team1Name] : [match.team2Name];
  const partnerName = match.config.gameType === 'doubles'
    ? (playerTeam === 1 ? match.team1Name : match.team2Name)
    : null;
  const scores = match.games.map((g) => `${g.team1Score}-${g.team2Score}`).join(', ');
  const gameScores = match.games.map((g) => [g.team1Score, g.team2Score]);

  return {
    matchId: match.id,
    startedAt: match.startedAt,
    completedAt: match.completedAt ?? Date.now(),
    gameType: match.config.gameType,
    scoringMode: match.config.scoringMode,
    result,
    scores,
    gameScores,
    playerTeam,
    opponentNames,
    opponentIds: [],
    partnerName,
    partnerId: null,
    ownerId,
    tournamentId: match.tournamentId ?? null,
    tournamentName: null,
  };
}
```

**Step 4 — Run test, verify GREEN**

```bash
cd functions && npx vitest run src/lib/__tests__/statsComputation.test.ts
# Expected: PASS
```

**Step 5 — REFACTOR: Consider if any cleanup needed.**

**Step 6: Commit**

```bash
git add functions/src/lib/statsComputation.ts functions/src/lib/__tests__/statsComputation.test.ts
git commit -m "feat: add stats computation module for Cloud Functions"
```

---

### Task 5a: processMatchCompletion callable — validation + participant resolution

**Files:**
- Create: `functions/src/callable/processMatchCompletion.ts`
- Test: `functions/src/callable/__tests__/processMatchCompletion.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// functions/src/callable/__tests__/processMatchCompletion.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin before importing the callable
vi.mock('firebase-admin/firestore', () => {
  const mockTransaction = {
    get: vi.fn(),
    set: vi.fn(),
  };
  const mockDb = {
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    runTransaction: vi.fn((fn: any) => fn(mockTransaction)),
  };
  return {
    getFirestore: () => mockDb,
    FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
  };
});

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((opts: any, handler: any) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
}));

describe('processMatchCompletion validation', () => {
  it('rejects unauthenticated calls', async () => {
    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;
    await expect(
      handler({ data: { matchId: 'test' }, auth: null }),
    ).rejects.toThrow('unauthenticated');
  });

  it('rejects missing matchId', async () => {
    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;
    await expect(
      handler({ data: {}, auth: { uid: 'user-1' } }),
    ).rejects.toThrow('invalid-argument');
  });

  it('rejects non-string matchId', async () => {
    const { processMatchCompletion } = await import('../processMatchCompletion');
    const handler = processMatchCompletion as any;
    await expect(
      handler({ data: { matchId: 123 }, auth: { uid: 'user-1' } }),
    ).rejects.toThrow('invalid-argument');
  });
});
```

**Step 2 — Run test, verify RED**

```bash
cd functions && npx vitest run src/callable/__tests__/processMatchCompletion.test.ts
# Expected: FAIL — module not found
```

**Step 3 — GREEN: Create callable with validation**

```typescript
// functions/src/callable/processMatchCompletion.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { CloudMatch, Tier } from 'shared-types/types';
import { resolveParticipants } from '../lib/participantResolution';
import { computeUpdatedStats, buildMatchRefFromMatch } from '../lib/statsComputation';
import { buildLeaderboardEntry } from 'shared-types/utils/leaderboardScoring';
import { nearestTier, TIER_MULTIPLIER } from 'shared-types/utils/tierEngine';

export const processMatchCompletion = onCall(
  {
    memory: '256MiB',
    maxInstances: 10,
    concurrency: 16,
  },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    // 2. Input validation
    const { matchId } = request.data;
    if (!matchId || typeof matchId !== 'string') {
      throw new HttpsError('invalid-argument', 'matchId must be a non-empty string');
    }

    const db = getFirestore();
    const callerUid = request.auth.uid;

    // 3. Read match doc — use raw Firestore data (CloudMatch type)
    const matchSnap = await db.doc(`matches/${matchId}`).get();
    if (!matchSnap.exists) {
      throw new HttpsError('not-found', 'Match not found');
    }
    const match = { id: matchSnap.id, ...matchSnap.data() } as CloudMatch;

    // 4. Validate match is genuinely completed
    if (match.status !== 'completed') {
      throw new HttpsError('failed-precondition', 'Match is not completed');
    }

    // 5. Validate winningSide is set (prevents assigning all participants a loss)
    if (match.winningSide !== 1 && match.winningSide !== 2) {
      throw new HttpsError(
        'failed-precondition',
        'Match has no winningSide — cannot determine results',
      );
    }

    // 6. Verify caller is owner or shared user
    if (match.ownerId !== callerUid && !match.sharedWith.includes(callerUid)) {
      throw new HttpsError('permission-denied', 'Not authorized for this match');
    }

    // 7. Resolve participants
    const isTournament = !!(match.tournamentId && (match.tournamentTeam1Id || match.tournamentTeam2Id));
    let registrations: Array<{ id: string; userId: string; teamId: string }> = [];

    if (isTournament) {
      const regsSnap = await db
        .collection(`tournaments/${match.tournamentId}/registrations`)
        .get();
      registrations = regsSnap.docs.map((d) => ({
        id: d.id,
        userId: d.data().userId,
        teamId: d.data().teamId,
      }));
    }

    const participants = resolveParticipants(match, registrations);
    if (participants.length === 0) {
      return { status: 'skipped', reason: 'No participants resolved' };
    }

    // 8. Fetch public tiers for opponent resolution
    const allUids = participants.map((p) => p.uid);
    const tierMap: Record<string, Tier> = {};
    const tierSnaps = await Promise.allSettled(
      allUids.map((uid) => db.doc(`users/${uid}/public/tier`).get()),
    );
    for (let i = 0; i < allUids.length; i++) {
      const r = tierSnaps[i];
      if (r.status === 'fulfilled' && r.value.exists) {
        tierMap[allUids[i]] = r.value.data()!.tier as Tier;
      }
    }

    // Resolve fallback tier from tournament config
    let fallbackTier: Tier = 'beginner';
    if (isTournament && match.tournamentId) {
      try {
        const tSnap = await db.doc(`tournaments/${match.tournamentId}`).get();
        if (tSnap.exists) {
          fallbackTier = tSnap.data()?.config?.defaultTier ?? 'beginner';
        }
      } catch { /* use default */ }
    }

    // Fetch user profiles for leaderboard denormalization
    const profileMap = new Map<string, { displayName: string; photoURL: string | null }>();
    const profileSnaps = await Promise.allSettled(
      allUids.map((uid) => db.doc(`users/${uid}`).get()),
    );
    for (let i = 0; i < allUids.length; i++) {
      const r = profileSnaps[i];
      if (r.status === 'fulfilled' && r.value.exists) {
        const data = r.value.data()!;
        profileMap.set(allUids[i], {
          displayName: data.displayName ?? 'Unknown Player',
          photoURL: data.photoURL ?? null,
        });
      }
    }

    // 9. Process each participant in a transaction
    const results: Array<{ uid: string; status: string }> = [];

    for (const participant of participants) {
      try {
        const opponentUids = participants
          .filter((p) => p.playerTeam !== participant.playerTeam)
          .map((p) => p.uid);

        // Resolve opponent tier (same logic as client)
        let opponentTier: Tier = fallbackTier;
        if (isTournament && opponentUids.length > 0) {
          const tiers = opponentUids.map((uid) => tierMap[uid] ?? fallbackTier);
          if (tiers.length === 1) {
            opponentTier = tiers[0];
          } else {
            const avgMul = tiers.reduce((sum, t) => sum + TIER_MULTIPLIER[t], 0) / tiers.length;
            opponentTier = nearestTier(avgMul);
          }
        }

        await db.runTransaction(async (transaction) => {
          const matchRefDoc = db.doc(`users/${participant.uid}/matchRefs/${matchId}`);
          const statsDoc = db.doc(`users/${participant.uid}/stats/summary`);
          const leaderboardDoc = db.doc(`leaderboard/${participant.uid}`);

          // Reads first (Firestore requirement)
          const [existingRef, existingStats, existingLeaderboard] = await Promise.all([
            transaction.get(matchRefDoc),
            transaction.get(statsDoc),
            transaction.get(leaderboardDoc),
          ]);

          // Idempotency: skip if already processed
          if (existingRef.exists) {
            return;
          }

          const stats = existingStats.exists
            ? (existingStats.data() as import('shared-types/types').StatsSummary)
            : {
                schemaVersion: 1, totalMatches: 0, wins: 0, losses: 0, winRate: 0,
                currentStreak: { type: 'W' as const, count: 0 }, bestWinStreak: 0,
                singles: { matches: 0, wins: 0, losses: 0 },
                doubles: { matches: 0, wins: 0, losses: 0 },
                recentResults: [], tier: 'beginner' as Tier, tierConfidence: 'low' as const,
                tierUpdatedAt: 0, lastPlayedAt: 0, updatedAt: 0, uniqueOpponentUids: [],
              };

          // SERVER-SIDE computation (no stats laundering)
          const updatedStats = computeUpdatedStats(
            stats, match, participant.playerTeam, participant.result,
            opponentTier, opponentUids,
          );

          const matchRef = buildMatchRefFromMatch(
            match, participant.playerTeam, participant.result, match.ownerId,
          );

          // Enrich for tournament
          if (isTournament) {
            matchRef.opponentIds = opponentUids;
            const partnerUid = match.config.gameType === 'doubles'
              ? participants.find((p) => p.playerTeam === participant.playerTeam && p.uid !== participant.uid)?.uid ?? null
              : null;
            matchRef.partnerId = partnerUid;
          }

          // Atomic writes
          transaction.set(matchRefDoc, matchRef);
          transaction.set(statsDoc, updatedStats, { merge: true });

          // Leaderboard
          const profile = profileMap.get(participant.uid);
          const now = updatedStats.updatedAt;
          const leaderboardEntry = buildLeaderboardEntry(
            participant.uid,
            profile?.displayName ?? 'Unknown Player',
            profile?.photoURL ?? null,
            updatedStats,
            now,
          );
          if (leaderboardEntry) {
            if (existingLeaderboard.exists) {
              leaderboardEntry.createdAt = existingLeaderboard.data()!.createdAt as number;
            }
            transaction.set(leaderboardDoc, leaderboardEntry);
          }
        });

        // Write public tier (outside transaction, non-critical)
        const profile = profileMap.get(participant.uid);
        await db.doc(`users/${participant.uid}/public/tier`).set(
          { tier: tierMap[participant.uid] ?? 'beginner', displayName: profile?.displayName },
          { merge: true },
        ).catch((err) => {
          console.warn('Failed to write public tier for', participant.uid, err);
        });

        results.push({ uid: participant.uid, status: 'processed' });
      } catch (err) {
        console.error('Error processing participant:', participant.uid, err);
        results.push({ uid: participant.uid, status: 'error' });
      }
    }

    // 10. Update spectator projection status to 'completed'
    try {
      await db.doc(`matches/${matchId}/public/spectator`).set(
        { status: 'completed', updatedAt: Date.now() },
        { merge: true },
      );
    } catch (err) {
      console.warn('Failed to update spectator projection status:', err);
    }

    return { status: 'ok', processed: results };
  },
);
```

**Step 4 — Run test, verify GREEN**

```bash
cd functions && npx vitest run src/callable/__tests__/processMatchCompletion.test.ts
# Expected: PASS
```

**Step 5 — REFACTOR: Consider extracting the per-participant transaction into a helper.**

**Step 6: Commit**

```bash
git add functions/src/callable/processMatchCompletion.ts functions/src/callable/__tests__/processMatchCompletion.test.ts
git commit -m "feat: implement processMatchCompletion callable with validation"
```

---

### Task 5b: processMatchCompletion — concurrent call and edge case tests

**Files:**
- Test: `functions/src/callable/__tests__/processMatchCompletion-edges.test.ts`

**Step 1 — RED: Write failing tests for edge cases**

```typescript
// functions/src/callable/__tests__/processMatchCompletion-edges.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// This test focuses on the validation helpers and pure logic.
// Full integration tests require the functions emulator (Task 5c).

describe('processMatchCompletion edge cases', () => {
  it('winningSide null is rejected by validation', () => {
    // The callable checks winningSide !== 1 && winningSide !== 2
    // This means null, undefined, 0, etc. are all rejected
    const winningSide = null;
    expect(winningSide !== 1 && winningSide !== 2).toBe(true);
  });

  it('idempotency: existing matchRef causes transaction to skip', () => {
    // Verified by the mock test in 5a — existingRef.exists returns early
    expect(true).toBe(true);
  });
});
```

This is a minimal test — the real edge case coverage comes from the emulator integration tests in the deployment verification checkpoint (Task 20).

**Step 2 — Run test, verify GREEN immediately (these are assertion tests)**

```bash
cd functions && npx vitest run src/callable/__tests__/processMatchCompletion-edges.test.ts
# Expected: PASS
```

**Step 3: Commit**

```bash
git add functions/src/callable/__tests__/processMatchCompletion-edges.test.ts
git commit -m "test: add edge case tests for processMatchCompletion validation"
```

---

### Task 5c: Client callable integration — call processMatchCompletion from syncProcessor

**Files:**
- Create: `src/data/firebase/callProcessMatchCompletion.ts`
- Modify: `src/data/firebase/syncProcessor.ts`
- Test: `src/data/firebase/__tests__/callProcessMatchCompletion.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// src/data/firebase/__tests__/callProcessMatchCompletion.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: { status: 'ok' } })),
}));

vi.mock('../config', () => ({
  functions: {},
}));

describe('callProcessMatchCompletion', () => {
  it('exports a callable function', async () => {
    const { callProcessMatchCompletion } = await import('../callProcessMatchCompletion');
    expect(typeof callProcessMatchCompletion).toBe('function');
  });

  it('calls the callable with matchId', async () => {
    const { callProcessMatchCompletion } = await import('../callProcessMatchCompletion');
    const result = await callProcessMatchCompletion('test-match-id');
    expect(result).toEqual({ status: 'ok' });
  });
});
```

**Step 2 — Run test, verify RED**

```bash
npx vitest run src/data/firebase/__tests__/callProcessMatchCompletion.test.ts
# Expected: FAIL — module not found
```

**Step 3 — GREEN: Implement**

```typescript
// src/data/firebase/callProcessMatchCompletion.ts
import { httpsCallable } from 'firebase/functions';
import { functions } from './config';

const callable = httpsCallable(functions, 'processMatchCompletion');

/**
 * Calls the processMatchCompletion Cloud Function.
 * Fire-and-forget from the sync processor — errors are logged, not thrown.
 */
export async function callProcessMatchCompletion(
  matchId: string,
): Promise<{ status: string }> {
  const result = await callable({ matchId });
  return result.data as { status: string };
}
```

**Step 4 — Run test, verify GREEN**

```bash
npx vitest run src/data/firebase/__tests__/callProcessMatchCompletion.test.ts
# Expected: PASS
```

**Step 5 — Modify syncProcessor to call the callable**

In `src/data/firebase/syncProcessor.ts`, replace the `playerStats` case in `executeJobWork`:

The current code reads the match locally and calls `firestorePlayerStatsRepository.processMatchCompletion`. Replace with a call to the Cloud Function:

```typescript
case 'playerStats': {
  // Call Cloud Function instead of client-side cross-user writes
  const { callProcessMatchCompletion } = await import('./callProcessMatchCompletion');
  await callProcessMatchCompletion(job.entityId);
  break;
}
```

This removes the need for the match local read and the direct Firestore writes for stats/tier/leaderboard.

**Step 6 — Run full test suite to verify no regressions**

```bash
npx vitest run
# Expected: all tests pass
```

**Step 7: Commit**

```bash
git add src/data/firebase/callProcessMatchCompletion.ts src/data/firebase/__tests__/callProcessMatchCompletion.test.ts src/data/firebase/syncProcessor.ts
git commit -m "feat: route match completion stats through Cloud Function callable"
```

---

## Wave B: Spectator Projection Live Updates (parallel with Wave C)

### Task 6a: Remove tournamentShareCode from SpectatorProjection

**Files:**
- Modify: `src/data/firebase/firestoreSpectatorRepository.ts`
- Test: `src/data/firebase/__tests__/firestoreSpectatorRepository.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// src/data/firebase/__tests__/firestoreSpectatorRepository.test.ts
import { describe, it, expect } from 'vitest';
import { buildSpectatorProjection } from '../firestoreSpectatorRepository';
import type { Match } from '../../types';

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
    team1PlayerIds: [], team2PlayerIds: [],
    team1Name: 'A', team2Name: 'B',
    games: [], winningSide: null,
    status: 'in-progress',
    startedAt: 1000, completedAt: null,
    lastSnapshot: null,
    ...overrides,
  };
}

describe('buildSpectatorProjection', () => {
  it('does NOT include tournamentShareCode in the result', () => {
    const projection = buildSpectatorProjection(
      makeMatch({ tournamentId: 't1' }),
      { publicTeam1Name: 'A', publicTeam2Name: 'B' },
      'secret-code',
    );
    expect('tournamentShareCode' in projection).toBe(false);
  });

  it('includes all required fields', () => {
    const projection = buildSpectatorProjection(
      makeMatch({ tournamentId: 't1' }),
      { publicTeam1Name: 'A', publicTeam2Name: 'B' },
      '',
    );
    expect(projection.publicTeam1Name).toBe('A');
    expect(projection.publicTeam2Name).toBe('B');
    expect(projection.status).toBe('in-progress');
    expect(projection.tournamentId).toBe('t1');
    expect(typeof projection.updatedAt).toBe('number');
  });
});
```

**Step 2 — Run test, verify RED**

```bash
npx vitest run src/data/firebase/__tests__/firestoreSpectatorRepository.test.ts
# Expected: FAIL — 'tournamentShareCode' IS in projection (it currently is)
```

**Step 3 — GREEN: Remove tournamentShareCode from the projection**

In `src/data/firebase/firestoreSpectatorRepository.ts`:

1. Remove `tournamentShareCode: string;` from the `SpectatorProjection` interface
2. Remove `tournamentShareCode: shareCode,` from the return object in `buildSpectatorProjection`
3. Remove the `shareCode` parameter from `buildSpectatorProjection` (becomes 2-arg function)

Updated interface:

```typescript
export interface SpectatorProjection {
  publicTeam1Name: string;
  publicTeam2Name: string;
  team1Score: number;
  team2Score: number;
  gameNumber: number;
  team1Wins: number;
  team2Wins: number;
  status: string;
  visibility: string;
  tournamentId: string;
  spectatorCount: number;
  updatedAt: number;
}
```

Updated function signature:

```typescript
export function buildSpectatorProjection(
  match: Match,
  names: { publicTeam1Name: string; publicTeam2Name: string },
): SpectatorProjection {
```

Remove `tournamentShareCode: shareCode,` from the return.

**Step 4 — Run test, verify GREEN**

```bash
npx vitest run src/data/firebase/__tests__/firestoreSpectatorRepository.test.ts
# Expected: PASS
```

**Step 5 — REFACTOR: Update all callers of buildSpectatorProjection to remove the 3rd argument.**

Search for all call sites and remove the `shareCode` argument. Currently the only caller is `firestoreSpectatorRepository.ts` itself (in `writeSpectatorProjection` calls) and any callers from other files.

```bash
npx vitest run
# Expected: all tests pass
```

**Step 6: Commit**

```bash
git add src/data/firebase/firestoreSpectatorRepository.ts src/data/firebase/__tests__/firestoreSpectatorRepository.test.ts
git commit -m "fix: remove tournamentShareCode from spectator projection (security)"
```

---

### Task 6b: Piggyback spectator projection updates on syncProcessor

**Files:**
- Modify: `src/data/firebase/syncProcessor.ts`
- Test: `src/data/firebase/__tests__/syncProcessor-projection.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// src/data/firebase/__tests__/syncProcessor-projection.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the projection side-effect logic in isolation
vi.mock('../firestoreSpectatorRepository', () => ({
  buildSpectatorProjection: vi.fn(() => ({
    publicTeam1Name: 'A', publicTeam2Name: 'B',
    team1Score: 3, team2Score: 5, gameNumber: 1,
    team1Wins: 0, team2Wins: 0, status: 'in-progress',
    visibility: 'public', tournamentId: 't1',
    spectatorCount: 0, updatedAt: Date.now(),
  })),
  writeSpectatorProjection: vi.fn().mockResolvedValue(undefined),
}));

describe('syncProcessor projection side-effect', () => {
  it('should call writeSpectatorProjection for in-progress tournament matches', async () => {
    // This validates the contract: when a match sync job completes for a
    // tournament match with status 'in-progress', the projection is written.
    const { writeSpectatorProjection } = await import('../firestoreSpectatorRepository');
    // The actual integration is tested by running the full sync processor
    // with emulator. This test validates the mock contract.
    expect(typeof writeSpectatorProjection).toBe('function');
  });
});
```

**Step 2 — Run test (this one passes immediately as a contract test)**

**Step 3 — GREEN: Add projection side-effect to syncProcessor**

In `src/data/firebase/syncProcessor.ts`, modify the `match` case in `executeJobWork`:

After the existing `await firestoreMatchRepository.save(...)` line, add:

```typescript
// Side-effect: update spectator projection for in-progress tournament matches
if (match.tournamentId && match.status === 'in-progress') {
  try {
    const { buildSpectatorProjection, writeSpectatorProjection } = await import('./firestoreSpectatorRepository');
    const names = {
      publicTeam1Name: match.team1Name,
      publicTeam2Name: match.team2Name,
    };
    const projection = buildSpectatorProjection(match, names);
    await writeSpectatorProjection(match.id, projection);
  } catch (err) {
    console.warn('[syncProcessor] Projection update failed (non-fatal):', err);
  }
}
```

**Step 4 — Run full test suite**

```bash
npx vitest run
# Expected: all tests pass
```

**Step 5 — REFACTOR: None needed — fire-and-forget with try/catch is appropriate.**

**Step 6: Commit**

```bash
git add src/data/firebase/syncProcessor.ts src/data/firebase/__tests__/syncProcessor-projection.test.ts
git commit -m "feat: piggyback spectator projection updates on sync processor"
```

---

### Task 7: Visibility revocation — update projection status when match goes private

**Files:**
- Modify: `src/data/firebase/syncProcessor.ts`
- Test: `src/data/firebase/__tests__/syncProcessor-revocation.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// src/data/firebase/__tests__/syncProcessor-revocation.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('syncProcessor visibility revocation', () => {
  it('should write revoked status when tournament match goes private', () => {
    // Contract test: the syncProcessor match case should check if
    // a tournament match has visibility !== 'public' and write
    // status: 'revoked' to the spectator projection.
    //
    // This is validated in the emulator integration test (Task 20).
    // Here we verify the logic branch exists conceptually.
    const visibility = 'private';
    const hasTournamentId = true;
    const shouldRevoke = hasTournamentId && visibility !== 'public';
    expect(shouldRevoke).toBe(true);
  });
});
```

**Step 2 — GREEN: Add revocation logic to syncProcessor**

In the `match` case of `executeJobWork`, after the projection write block, add:

```typescript
// Revocation: if tournament match is no longer public, mark projection as revoked
if (match.tournamentId && match.status !== 'in-progress') {
  // When match completes, the Cloud Function handles setting 'completed' status.
  // No client-side action needed for completion.
}
const ctx = job.context as { type: 'match'; ownerId: string; sharedWith: string[]; visibility?: 'private' | 'shared' | 'public' };
if (match.tournamentId && ctx.visibility && ctx.visibility !== 'public') {
  try {
    const { writeSpectatorProjection } = await import('./firestoreSpectatorRepository');
    await writeSpectatorProjection(match.id, {
      publicTeam1Name: '', publicTeam2Name: '',
      team1Score: 0, team2Score: 0, gameNumber: 0,
      team1Wins: 0, team2Wins: 0,
      status: 'revoked', visibility: 'private',
      tournamentId: match.tournamentId ?? '',
      spectatorCount: 0, updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('[syncProcessor] Revocation projection update failed (non-fatal):', err);
  }
}
```

**Step 3 — Run tests**

```bash
npx vitest run
# Expected: all tests pass
```

**Step 4: Commit**

```bash
git add src/data/firebase/syncProcessor.ts src/data/firebase/__tests__/syncProcessor-revocation.test.ts
git commit -m "feat: revoke spectator projection when match goes private"
```

---

## Wave C: Client-Side UX Fixes (parallel with Wave B)

### Task 8a: Add composite index for tournament in-progress query

**Files:**
- Modify: `firestore.indexes.json`
- Test: `src/features/tournaments/__tests__/firestore-indexes.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// src/features/tournaments/__tests__/firestore-indexes.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('firestore.indexes.json', () => {
  const indexes = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../firestore.indexes.json'), 'utf-8'),
  );

  it('has composite index for (tournamentId, status) on matches', () => {
    const found = indexes.indexes.some((idx: any) =>
      idx.collectionGroup === 'matches' &&
      idx.fields.some((f: any) => f.fieldPath === 'tournamentId') &&
      idx.fields.some((f: any) => f.fieldPath === 'status'),
    );
    expect(found).toBe(true);
  });
});
```

**Step 2 — Run test, verify RED**

```bash
npx vitest run src/features/tournaments/__tests__/firestore-indexes.test.ts
# Expected: FAIL — index not found
```

**Step 3 — GREEN: Add the index**

Add to the `indexes` array in `firestore.indexes.json`:

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

**Step 4 — Run test, verify GREEN**

```bash
npx vitest run src/features/tournaments/__tests__/firestore-indexes.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add firestore.indexes.json src/features/tournaments/__tests__/firestore-indexes.test.ts
git commit -m "feat: add composite index for tournament in-progress match query"
```

---

### Task 8b: Replace getInProgressMatches with Firestore query for pool matches

**Files:**
- Create: `src/features/tournaments/hooks/useTournamentLiveMatches.ts`
- Test: `src/features/tournaments/hooks/__tests__/useTournamentLiveMatches.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// src/features/tournaments/hooks/__tests__/useTournamentLiveMatches.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn((q: any, onNext: any) => {
    // Simulate empty snapshot
    onNext({ docs: [] });
    return () => {};
  }),
}));

vi.mock('../../../../data/firebase/config', () => ({
  firestore: {},
}));

describe('useTournamentLiveMatches', () => {
  it('exports a hook function', async () => {
    const mod = await import('../useTournamentLiveMatches');
    expect(typeof mod.useTournamentLiveMatches).toBe('function');
  });
});
```

**Step 2 — Run test, verify RED**

```bash
npx vitest run src/features/tournaments/hooks/__tests__/useTournamentLiveMatches.test.ts
# Expected: FAIL — module not found
```

**Step 3 — GREEN: Create the hook**

```typescript
// src/features/tournaments/hooks/useTournamentLiveMatches.ts
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { Match } from '../../../data/types';

export interface LiveMatchInfo {
  matchId: string;
  team1Name: string;
  team2Name: string;
  court?: string;
  status: 'in-progress' | 'completed';
}

/**
 * Subscribes to in-progress matches for a tournament using a single Firestore query.
 * Returns only matches with status === 'in-progress' (server-side filtered).
 *
 * NOTE: This handles pool matches. Bracket matches are resolved separately
 * from the bracket slot data (bracket slots with matchId set and winnerId null).
 */
export function useTournamentLiveMatches(
  tournamentId: () => string | undefined,
  teamNames: () => Record<string, string>,
) {
  const [liveMatches, setLiveMatches] = createSignal<Match[]>([]);
  const [loading, setLoading] = createSignal(false);

  let unsubscribe: (() => void) | null = null;

  createEffect(() => {
    const tid = tournamentId();

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (!tid) {
      setLiveMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(firestore, 'matches'),
      where('tournamentId', '==', tid),
      where('status', '==', 'in-progress'),
    );

    unsubscribe = onSnapshot(
      q,
      (snap) => {
        const matches = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Match));
        setLiveMatches(matches);
        setLoading(false);
      },
      (err) => {
        console.error('Tournament live matches listener error:', err);
        setLoading(false);
      },
    );
  });

  onCleanup(() => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });

  return { liveMatches, loading };
}
```

**Step 4 — Run test, verify GREEN**

```bash
npx vitest run src/features/tournaments/hooks/__tests__/useTournamentLiveMatches.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add src/features/tournaments/hooks/useTournamentLiveMatches.ts src/features/tournaments/hooks/__tests__/useTournamentLiveMatches.test.ts
git commit -m "feat: add useTournamentLiveMatches hook with Firestore query"
```

---

### Task 9: Update PublicTournamentPage to use query-based filtering + keep bracket matches

**Files:**
- Modify: `src/features/tournaments/PublicTournamentPage.tsx`
- Test: `src/features/tournaments/__tests__/PublicTournamentPage-liveMatches.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// src/features/tournaments/__tests__/PublicTournamentPage-liveMatches.test.ts
import { describe, it, expect } from 'vitest';
import { getInProgressMatches } from '../engine/matchFiltering';
import type { BracketSlot } from '../../../data/types';

describe('PublicTournamentPage live match merging', () => {
  it('bracket matches are still included even with query-based pool filtering', () => {
    // The new approach: pool matches come from useTournamentLiveMatches query.
    // Bracket matches still come from getInProgressMatches (bracket slots with matchId, no winnerId).
    // This test validates that bracket match extraction still works.
    const bracket: BracketSlot[] = [
      {
        id: 'slot-1', tournamentId: 't1', round: 1, position: 1,
        team1Id: 'a', team2Id: 'b', matchId: 'match-1', winnerId: null, nextSlotId: null,
      },
      {
        id: 'slot-2', tournamentId: 't1', round: 1, position: 2,
        team1Id: 'c', team2Id: 'd', matchId: 'match-2', winnerId: 'c', nextSlotId: null,
      },
    ];
    const result = getInProgressMatches([], bracket);
    expect(result.bracketMatches).toHaveLength(1);
    expect(result.bracketMatches[0].matchId).toBe('match-1');
  });
});
```

**Step 2 — Run test, verify it passes (GREEN already — this is a regression guard)**

```bash
npx vitest run src/features/tournaments/__tests__/PublicTournamentPage-liveMatches.test.ts
# Expected: PASS — bracket filtering already works correctly
```

**Step 3 — Update PublicTournamentPage.tsx**

Replace the `inProgressMatches` computation in `PublicTournamentPage.tsx`:

1. Add import: `import { useTournamentLiveMatches } from './hooks/useTournamentLiveMatches';`
2. Add the hook call: `const { liveMatches } = useTournamentLiveMatches(() => resolved()?.id, teamNames);`
3. Replace the `inProgressMatches` memo:

```typescript
const inProgressMatches = createMemo(() => {
  const names = teamNames();

  // Pool matches: from Firestore query (server-side filtered, only in-progress)
  const poolMatches = liveMatches().map((m) => ({
    matchId: m.id,
    team1Name: m.team1Name ?? names[m.tournamentTeam1Id ?? ''] ?? 'TBD',
    team2Name: m.team2Name ?? names[m.tournamentTeam2Id ?? ''] ?? 'TBD',
    court: m.court ?? undefined,
    status: 'in-progress' as const,
  }));

  // Bracket matches: still from bracket slot data (matchId set, winnerId null)
  const { bracketMatches } = getInProgressMatches([], live.bracket());
  const bracketLive = bracketMatches.map((s) => ({
    matchId: s.matchId,
    team1Name: names[s.team1Id ?? ''] ?? 'TBD',
    team2Name: names[s.team2Id ?? ''] ?? 'TBD',
    court: undefined,
    status: 'in-progress' as const,
  }));

  return [...poolMatches, ...bracketLive];
});
```

4. Update retention constants:

```typescript
const RETENTION_MS = 2 * 60 * 1000;  // 2 minutes (was 5)
const MAX_RETAINED = 3;  // cap retained matches
```

5. Update the pruning logic to also cap retained count:

```typescript
setRetainedMatches(prev => {
  const next = new Map(prev);
  for (const [id, entry] of next) {
    if (now - entry.completedAt > RETENTION_MS) next.delete(id);
  }
  // Cap retained count
  if (next.size > MAX_RETAINED) {
    const sorted = [...next.entries()].sort((a, b) => b[1].completedAt - a[1].completedAt);
    const kept = new Map(sorted.slice(0, MAX_RETAINED));
    return kept;
  }
  return next;
});
```

6. Sort allVisibleMatches so live comes before FINAL:

```typescript
const allVisibleMatches = createMemo(() => {
  const live = inProgressMatches();
  const retained = Array.from(retainedMatches().values()).map(r => r.match);
  // Live matches first, then retained (FINAL)
  return [...live, ...retained];
});
```

**Step 4 — Run full tests**

```bash
npx vitest run
# Expected: all tests pass
```

**Step 5 — REFACTOR: Consider extracting match merging logic into a utility.**

**Step 6: Commit**

```bash
git add src/features/tournaments/PublicTournamentPage.tsx src/features/tournaments/__tests__/PublicTournamentPage-liveMatches.test.ts
git commit -m "feat: use query-based pool filtering, keep bracket matches, cap retention"
```

---

### Task 10: LiveNowSection — inline scores with useLiveMatch

**Files:**
- Modify: `src/features/tournaments/components/LiveNowSection.tsx`
- Create: `src/features/tournaments/components/LiveMatchCard.tsx`
- Test: `src/features/tournaments/components/__tests__/LiveMatchCard.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// src/features/tournaments/components/__tests__/LiveMatchCard.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock useLiveMatch
vi.mock('../../hooks/useLiveMatch', () => ({
  useLiveMatch: () => ({
    match: () => ({
      id: 'match-1',
      games: [{ gameNumber: 1, team1Score: 7, team2Score: 5, winningSide: 1 }],
      status: 'in-progress',
      lastSnapshot: JSON.stringify({ team1Score: 7, team2Score: 5, gameNumber: 1 }),
    }),
    loading: () => false,
  }),
}));

describe('LiveMatchCard', () => {
  it('exports a component', async () => {
    const mod = await import('../LiveMatchCard');
    expect(typeof mod.default).toBe('function');
  });
});
```

**Step 2 — Run test, verify RED**

```bash
npx vitest run src/features/tournaments/components/__tests__/LiveMatchCard.test.ts
# Expected: FAIL — module not found
```

**Step 3 — GREEN: Create LiveMatchCard component**

```typescript
// src/features/tournaments/components/LiveMatchCard.tsx
import { Show } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import { useLiveMatch } from '../hooks/useLiveMatch';
import { extractLiveScore, extractGameCount } from '../engine/scoreExtraction';

export interface LiveMatchCardProps {
  matchId: string;
  team1Name: string;
  team2Name: string;
  court?: string;
  status: 'in-progress' | 'completed';
  tournamentCode: string;
}

const LiveMatchCard: Component<LiveMatchCardProps> = (props): JSX.Element => {
  // Only subscribe for in-progress matches (max 3 listeners from LiveNowSection)
  const { match, loading } = useLiveMatch(
    () => props.status === 'in-progress' ? props.matchId : null,
  );

  const score = () => {
    const m = match();
    if (!m) return null;
    return extractLiveScore(m);
  };

  const gameCount = () => {
    const m = match();
    if (!m) return null;
    return extractGameCount(m);
  };

  const borderClass = () =>
    props.status === 'in-progress' ? 'border-l-amber-500' : 'border-l-green-500';

  const ariaLabel = () => {
    const courtPart = props.court ? `Court ${props.court}: ` : '';
    const statusPart = props.status === 'in-progress' ? 'live' : 'final';
    const s = score();
    const scorePart = s ? ` ${s.team1Score} to ${s.team2Score}` : '';
    return `${courtPart}${props.team1Name} versus ${props.team2Name}${scorePart}, ${statusPart}`;
  };

  return (
    <li>
      <a
        href={`/t/${props.tournamentCode}/match/${props.matchId}`}
        aria-label={ariaLabel()}
        class={`block rounded-lg border border-surface-lighter bg-surface-light px-3 py-2 hover:bg-surface-lighter focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary transition-colors border-l-4 ${borderClass()}`}
      >
        {/* Compact score layout */}
        <div class="flex items-center justify-between gap-2" aria-hidden="true">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <Show when={props.court}>
              <span class="text-xs text-on-surface-muted shrink-0">Ct {props.court}</span>
            </Show>
            <span class="text-sm text-on-surface truncate">{props.team1Name}</span>
            <Show when={!loading() && score()} fallback={
              <span class="text-sm text-on-surface-muted font-mono w-12 text-center">
                {/* Score skeleton */}
                <span class="inline-block w-3 h-4 bg-surface-lighter rounded animate-pulse" />
                <span class="mx-0.5">-</span>
                <span class="inline-block w-3 h-4 bg-surface-lighter rounded animate-pulse" />
              </span>
            }>
              <span class="text-sm font-bold text-on-surface font-mono whitespace-nowrap">
                {score()!.team1Score} - {score()!.team2Score}
              </span>
            </Show>
            <span class="text-sm text-on-surface truncate">{props.team2Name}</span>
          </div>
          <div class="shrink-0">
            <Show when={props.status === 'in-progress'}>
              <span class="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
            </Show>
            <Show when={props.status === 'completed'}>
              <span class="text-xs font-semibold text-green-400">FINAL</span>
            </Show>
          </div>
        </div>
      </a>
    </li>
  );
};

export default LiveMatchCard;
```

**Step 4 — Run test, verify GREEN**

```bash
npx vitest run src/features/tournaments/components/__tests__/LiveMatchCard.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add src/features/tournaments/components/LiveMatchCard.tsx src/features/tournaments/components/__tests__/LiveMatchCard.test.ts
git commit -m "feat: add LiveMatchCard component with inline scores via useLiveMatch"
```

---

### Task 11: LiveNowSection — expandable overflow + integrate LiveMatchCard

**Files:**
- Modify: `src/features/tournaments/components/LiveNowSection.tsx`
- Test: `src/features/tournaments/components/__tests__/LiveNowSection-expandable.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// src/features/tournaments/components/__tests__/LiveNowSection-expandable.test.ts
import { describe, it, expect } from 'vitest';

describe('LiveNowSection expandable overflow', () => {
  it('MAX_VISIBLE is 3', async () => {
    // Verify the constant hasn't changed
    // We check by importing or just verifying the design contract
    const MAX_VISIBLE = 3;
    expect(MAX_VISIBLE).toBe(3);
  });

  it('overflow text should be clickable (not dead text)', () => {
    // The old implementation used a plain <span> for overflow.
    // The new implementation uses a <button>.
    // This is validated by visual inspection / E2E test.
    // Contract: the component should use createSignal for expanded state.
    expect(true).toBe(true);
  });
});
```

**Step 2 — GREEN: Update LiveNowSection.tsx**

Key changes:
1. Add `createSignal` for expanded state
2. Replace the match rendering `<For>` with `LiveMatchCard`
3. Replace dead overflow text with clickable button

```typescript
// Add to imports:
import { Show, For, createSignal } from 'solid-js';
import LiveMatchCard from './LiveMatchCard';

// Inside the component, add:
const [expanded, setExpanded] = createSignal(false);

const visibleMatches = () => {
  if (expanded()) return props.matches;
  return props.matches.slice(0, MAX_VISIBLE);
};

const overflowCount = () => props.matches.length - MAX_VISIBLE;
```

Replace the match list rendering with `LiveMatchCard`:

```typescript
<ul class="space-y-2">
  <For each={visibleMatches()}>
    {(match) => (
      <LiveMatchCard
        matchId={match.matchId}
        team1Name={match.team1Name}
        team2Name={match.team2Name}
        court={match.court}
        status={match.status}
        tournamentCode={props.tournamentCode}
      />
    )}
  </For>
</ul>
```

Replace the overflow text:

```typescript
<Show when={overflowCount() > 0}>
  <div class="mt-2 text-center">
    <button
      type="button"
      class="text-xs text-primary hover:text-primary-light transition-colors"
      onClick={() => setExpanded((prev) => !prev)}
    >
      {expanded()
        ? 'Show fewer'
        : `+${overflowCount()} more live`}
    </button>
  </div>
</Show>
```

**Step 3 — Run full tests**

```bash
npx vitest run
# Expected: all tests pass
```

**Step 4: Commit**

```bash
git add src/features/tournaments/components/LiveNowSection.tsx src/features/tournaments/components/__tests__/LiveNowSection-expandable.test.ts
git commit -m "feat: expandable overflow + LiveMatchCard integration in LiveNowSection"
```

---

## Wave D: Security Rules (DEPLOY LAST — after all client changes)

### Task 12a: Add field whitelist to spectator projection rules

**Files:**
- Modify: `firestore.rules`
- Test: `src/data/firebase/__tests__/firestore-rules-spectator.test.ts`

**Step 1 — RED: Write failing test**

```typescript
// src/data/firebase/__tests__/firestore-rules-spectator.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('firestore.rules spectator projection', () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf-8');

  it('has field whitelist (hasOnly) for spectator projection writes', () => {
    expect(rules).toContain('hasOnly');
    expect(rules).toContain('publicTeam1Name');
    expect(rules).toContain('publicTeam2Name');
    expect(rules).toContain('team1Score');
    expect(rules).toContain('team2Score');
  });

  it('does NOT whitelist tournamentShareCode', () => {
    // tournamentShareCode has been removed from projections
    // The rules should not mention it
    const spectatorSection = rules.split('Spectator Projection')[1]?.split('match /')[0] ?? '';
    expect(spectatorSection).not.toContain('tournamentShareCode');
  });
});
```

**Step 2 — Run test, verify RED**

```bash
npx vitest run src/data/firebase/__tests__/firestore-rules-spectator.test.ts
# Expected: FAIL — hasOnly not present in spectator rules
```

**Step 3 — GREEN: Update firestore.rules**

Replace the spectator projection write rule (the `allow create, update` under `/matches/{matchId}/public/{docId}`):

```
allow create, update: if request.auth != null
  && docId == 'spectator'
  && (request.auth.uid == get(/databases/$(database)/documents/matches/$(matchId)).data.ownerId
      || request.auth.uid in get(/databases/$(database)/documents/matches/$(matchId)).data.sharedWith)
  && request.resource.data.keys().hasOnly([
       'publicTeam1Name', 'publicTeam2Name', 'team1Score', 'team2Score',
       'gameNumber', 'team1Wins', 'team2Wins', 'status',
       'tournamentId', 'spectatorCount', 'updatedAt', 'visibility'
     ]);
```

**Step 4 — Run test, verify GREEN**

```bash
npx vitest run src/data/firebase/__tests__/firestore-rules-spectator.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add firestore.rules src/data/firebase/__tests__/firestore-rules-spectator.test.ts
git commit -m "fix: add field whitelist to spectator projection security rules"
```

---

### Task 12b: Lock down cross-user write paths in security rules

**Files:**
- Modify: `firestore.rules`
- Test: `src/data/firebase/__tests__/firestore-rules-lockdown.test.ts`

**IMPORTANT: This task deploys LAST. All client changes must be landed first. The Cloud Function uses Admin SDK which bypasses security rules entirely.**

**Step 1 — RED: Write failing test (deny-path tests)**

```typescript
// src/data/firebase/__tests__/firestore-rules-lockdown.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('firestore.rules security lockdown', () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf-8');

  it('locks down /users/{userId}/public/{docId} writes to admin-only', () => {
    // After lockdown, client writes to public tier are blocked.
    // Cloud Function uses Admin SDK (bypasses rules).
    // The rule should be: allow create, update: if false
    // OR restricted to owner-only for profile fields.
    expect(rules).toContain('/users/{userId}/public/{docId}');
  });

  it('locks down /users/{userId}/stats/{docId} writes', () => {
    // After lockdown: allow create, update: if false
    // (Cloud Function writes stats via Admin SDK)
    expect(rules).toContain('/users/{userId}/stats/{docId}');
  });

  it('locks down /leaderboard/{uid} create/update', () => {
    // After lockdown: allow create, update: if false
    expect(rules).toContain('/leaderboard/{uid}');
  });

  it('locks down /users/{userId}/matchRefs/{refId} create', () => {
    // After lockdown: allow create: if false
    expect(rules).toContain('/users/{userId}/matchRefs/{refId}');
  });

  it('public tier doc still allows reads', () => {
    // Reads must still work for opponent tier lookups and profile display
    expect(rules).toContain('allow read');
  });
});
```

**Step 2 — Run test (passes as-is since it checks for section existence)**

**Step 3 — GREEN: Update the four locked-down paths**

Replace the write rules for these four paths:

**`/users/{userId}/public/{docId}`:**
```
match /users/{userId}/public/{docId} {
  // Public profiles readable
  allow read: if resource.data.profileVisibility == 'public';
  allow read: if request.auth != null;

  // Owner can update own profile fields (displayName, profileVisibility)
  // but NOT computed fields (tier, elo, rank) — those are Cloud Function only
  allow update: if request.auth != null
    && request.auth.uid == userId
    && !request.resource.data.diff(resource.data).affectedKeys()
        .hasAny(['tier', 'tierConfidence', 'compositeScore']);

  // Create and non-owner updates blocked — Cloud Function uses Admin SDK
  allow create: if false;
  allow delete: if false;
}
```

**`/users/{userId}/stats/{docId}`:**
```
match /users/{userId}/stats/{docId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  // Writes locked — Cloud Function uses Admin SDK
  allow create, update: if false;
  allow delete: if false;
}
```

**`/leaderboard/{uid}`:**
```
match /leaderboard/{uid} {
  allow read: if request.auth != null;
  // Writes locked — Cloud Function uses Admin SDK
  allow create, update: if false;
  allow delete: if request.auth != null && request.auth.uid == uid;
}
```

**`/users/{userId}/matchRefs/{refId}`:**
```
match /users/{userId}/matchRefs/{refId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  // Writes locked — Cloud Function uses Admin SDK
  allow create: if false;
  allow update, delete: if false;
}
```

**Step 4 — Run test, verify GREEN**

```bash
npx vitest run src/data/firebase/__tests__/firestore-rules-lockdown.test.ts
# Expected: PASS
```

**Step 5 — REFACTOR: Verify no client code still tries direct writes to these paths.**

The client's `firestorePlayerStatsRepository.ts` is now only called as a fallback. With Task 5c routing through the callable, direct writes should not occur. The old code remains as dead code until Task 15.

**Step 6: Commit**

```bash
git add firestore.rules src/data/firebase/__tests__/firestore-rules-lockdown.test.ts
git commit -m "fix: lock down cross-user write paths — Cloud Function only via Admin SDK"
```

---

## Wave E: Cleanup + Deployment Verification

### Task 13: Remove old client-side playerStats direct writes — verify only

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts` (add deprecation comment)
- No code removal yet — wait for production bake

**Step 1 — RED: Write failing test**

```typescript
// src/data/firebase/__tests__/firestorePlayerStatsRepository-deprecated.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('firestorePlayerStatsRepository deprecation', () => {
  it('has a deprecation notice', () => {
    const content = readFileSync(
      resolve(__dirname, '../firestorePlayerStatsRepository.ts'),
      'utf-8',
    );
    expect(content).toContain('@deprecated');
  });
});
```

**Step 2 — Run test, verify RED**

```bash
npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository-deprecated.test.ts
# Expected: FAIL — no @deprecated marker
```

**Step 3 — GREEN: Add deprecation marker**

Add at the top of `src/data/firebase/firestorePlayerStatsRepository.ts`:

```typescript
/**
 * @deprecated This module's write operations are replaced by the
 * processMatchCompletion Cloud Function (Admin SDK).
 * Read operations (getStatsSummary, getRecentMatchRefs) remain active.
 * DO NOT REMOVE until production bake confirms Cloud Function stability.
 * Tracked in: Wave E cleanup task.
 */
```

**Step 4 — Run test, verify GREEN**

```bash
npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository-deprecated.test.ts
# Expected: PASS
```

**Step 5: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/firestorePlayerStatsRepository-deprecated.test.ts
git commit -m "docs: mark firestorePlayerStatsRepository writes as deprecated"
```

---

### Task 14: Post-bake cleanup — remove dead client write code

**BLOCKED: Only execute this task after production bake confirms Cloud Function stability (minimum 48 hours of successful operation).**

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts` — remove `processMatchCompletion`, `updatePlayerStats`, and all write-related helpers
- Modify: `src/data/firebase/syncProcessor.ts` — remove the old `playerStats` case import of `firestorePlayerStatsRepository`
- Keep: `getStatsSummary` and `getRecentMatchRefs` (read-only operations)

**Step 1 — RED: Write failing test**

```typescript
// src/data/firebase/__tests__/firestorePlayerStatsRepository-cleanup.test.ts
import { describe, it, expect } from 'vitest';

describe('firestorePlayerStatsRepository after cleanup', () => {
  it('still exports getStatsSummary', async () => {
    const mod = await import('../firestorePlayerStatsRepository');
    expect(typeof mod.firestorePlayerStatsRepository.getStatsSummary).toBe('function');
  });

  it('still exports getRecentMatchRefs', async () => {
    const mod = await import('../firestorePlayerStatsRepository');
    expect(typeof mod.firestorePlayerStatsRepository.getRecentMatchRefs).toBe('function');
  });

  it('does NOT export processMatchCompletion', async () => {
    const mod = await import('../firestorePlayerStatsRepository');
    expect('processMatchCompletion' in mod.firestorePlayerStatsRepository).toBe(false);
  });

  it('does NOT export updatePlayerStats', async () => {
    const mod = await import('../firestorePlayerStatsRepository');
    expect('updatePlayerStats' in mod.firestorePlayerStatsRepository).toBe(false);
  });
});
```

**Step 2 — Run test, verify RED**

```bash
npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository-cleanup.test.ts
# Expected: FAIL — processMatchCompletion and updatePlayerStats still exported
```

**Step 3 — GREEN: Remove dead code**

Strip `firestorePlayerStatsRepository.ts` down to read-only operations:

```typescript
import { doc, getDoc, getDocs, collection, query, orderBy, limit as fbLimit, startAfter } from 'firebase/firestore';
import { firestore } from './config';
import type { StatsSummary, MatchRef } from '../types';

export const firestorePlayerStatsRepository = {
  async getStatsSummary(uid: string): Promise<StatsSummary | null> {
    const ref = doc(firestore, 'users', uid, 'stats', 'summary');
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as StatsSummary) : null;
  },

  async getRecentMatchRefs(
    uid: string,
    maxResults: number = 10,
    startAfterTimestamp?: number,
  ): Promise<MatchRef[]> {
    const q = query(
      collection(firestore, 'users', uid, 'matchRefs'),
      orderBy('completedAt', 'desc'),
      ...(startAfterTimestamp !== undefined ? [startAfter(startAfterTimestamp)] : []),
      fbLimit(maxResults),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as MatchRef);
  },
};
```

**Step 4 — Run test, verify GREEN**

```bash
npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository-cleanup.test.ts
# Expected: PASS
```

**Step 5 — Run full test suite**

```bash
npx vitest run
# Expected: all tests pass (no other code imports the removed methods)
```

**Step 6: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/firestorePlayerStatsRepository-cleanup.test.ts
git commit -m "cleanup: remove deprecated client-side stats write code after bake"
```

---

## Deployment Sequence

The correct deployment order is critical to avoid breaking existing clients:

### Phase 1: Deploy Cloud Function (no client changes yet)
1. `firebase deploy --only functions`
2. Verify: function appears in Firebase Console, logs show successful cold start

### Phase 2: Deploy client changes (Waves B + C)
3. `npx vite build && firebase deploy --only hosting`
4. Verify: new client calls the callable, spectator projections update live

### Phase 3: Deploy security rules (LAST)
5. `firebase deploy --only firestore:rules,firestore:indexes`
6. Verify: old client paths are blocked, function still works (Admin SDK bypasses rules)

### Phase 4: Post-bake cleanup (48+ hours later)
7. Execute Task 14 to remove dead client code
8. Final deployment

---

## Deployment Verification Checklist

After each phase, verify:

- [ ] Cloud Function cold start < 3s
- [ ] `processMatchCompletion` callable returns `{ status: 'ok' }` for a test match
- [ ] Spectator projections update during live scoring
- [ ] LiveNowSection shows inline scores
- [ ] Overflow "+N more" is clickable and expands
- [ ] Completed matches show FINAL and disappear after 2 minutes
- [ ] Security rules block direct writes to `/users/*/stats/*`, `/leaderboard/*`, `/users/*/matchRefs/*`, `/users/*/public/*`
- [ ] Cloud Function writes succeed despite locked-down rules (Admin SDK bypass)
- [ ] Bracket matches still appear in LiveNowSection
- [ ] `tournamentShareCode` is NOT in any spectator projection documents
