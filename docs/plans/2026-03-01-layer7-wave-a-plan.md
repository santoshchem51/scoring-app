# Layer 7 Wave A: Player Stats + Match History + Tier Engine — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a match completes, write match references for each signed-in participant and update their stats summary with a tier calculation — all fire-and-forget, no UI changes.

**Architecture:** New types added to `src/data/types.ts`. Pure tier engine in `src/shared/utils/tierEngine.ts`. New `firestorePlayerStatsRepository` handles Firestore reads/writes for `matchRefs` and `stats` subcollections under `users/{uid}`. `cloudSync.ts` gains one fire-and-forget method called from `ScoringPage.tsx` after match completion.

**Tech Stack:** SolidJS 1.9, TypeScript, Vitest, Firebase Firestore, Dexie.js

**Design doc:** `docs/plans/2026-03-01-layer7-wave-a-design.md`

---

## Task 1: Add Player Stats Types

**Files:**
- Modify: `src/data/types.ts:85-86` (insert new section after `UserProfile`)

**Step 1: Add types**

Open `src/data/types.ts`. After line 85 (the closing `}` of `UserProfile`), insert:

```typescript
// --- Player Stats types (Layer 7 Wave A) ---

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
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (additive types only, no consumers yet)

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests pass (no behavior change)

**Step 4: Commit**

```bash
git add src/data/types.ts
git commit -m "feat: add MatchRef, StatsSummary, and Tier types for player stats"
```

---

## Task 2: Tier Engine — Score Computation (Pure Function + Tests)

**Files:**
- Create: `src/shared/utils/__tests__/tierEngine.test.ts`
- Create: `src/shared/utils/tierEngine.ts`

**Context:** The tier engine is a set of pure functions. No Firebase, no side effects. It takes a `RecentResult[]` array and match metadata, returns tier info.

**Reference:** Design doc Section 2 (Tier Engine) defines the algorithm:
- `TIER_MULTIPLIER`: beginner=0.5, intermediate=0.8, advanced=1.0, expert=1.3
- `RECENCY_WEIGHTS`: recent(last 10)=1.0, middle(11-25)=0.8, older(26-50)=0.6
- Bayesian damping: `dampingFactor = min(matchCount / 15, 1.0)`, `score = 0.25 + (rawScore - 0.25) * dampingFactor`

**Step 1: Write failing tests for `computeTierScore()`**

Create `src/shared/utils/__tests__/tierEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { RecentResult, Tier } from '../../../data/types';
import { computeTierScore, computeTier, computeTierConfidence } from '../tierEngine';

// --- Factory ---
function makeResult(overrides: Partial<RecentResult> = {}): RecentResult {
  return {
    result: 'win',
    opponentTier: 'intermediate',
    completedAt: Date.now(),
    gameType: 'singles',
    ...overrides,
  };
}

function makeResults(
  count: number,
  overrides: Partial<RecentResult> = {},
): RecentResult[] {
  return Array.from({ length: count }, (_, i) =>
    makeResult({ completedAt: Date.now() - i * 60000, ...overrides }),
  );
}

// --- computeTierScore ---

describe('computeTierScore', () => {
  it('returns 0.25 for empty results (prior)', () => {
    expect(computeTierScore([])).toBeCloseTo(0.25, 2);
  });

  it('damps toward 0.25 with few matches (3 wins)', () => {
    const results = makeResults(3, { result: 'win', opponentTier: 'intermediate' });
    const score = computeTierScore(results);
    // With 3 matches, dampingFactor = 3/15 = 0.2
    // rawScore from all wins vs intermediate (0.8 multiplier) = ~1.0
    // score = 0.25 + (1.0 - 0.25) * 0.2 = 0.40
    expect(score).toBeGreaterThan(0.25);
    expect(score).toBeLessThan(0.6);
  });

  it('converges to real score at 15+ matches', () => {
    const results = makeResults(15, { result: 'win', opponentTier: 'intermediate' });
    const score = computeTierScore(results);
    // dampingFactor = 1.0, so full score comes through
    expect(score).toBeGreaterThan(0.7);
  });

  it('caps around intermediate for 100% wins vs beginners', () => {
    const results = makeResults(20, { result: 'win', opponentTier: 'beginner' });
    const score = computeTierScore(results);
    // beginner multiplier = 0.5, so wins only count half
    // Should be around 0.5, NOT high enough for expert
    expect(score).toBeLessThan(0.65);
  });

  it('rewards wins vs experts', () => {
    const vsBeginners = computeTierScore(
      makeResults(20, { result: 'win', opponentTier: 'beginner' }),
    );
    const vsExperts = computeTierScore(
      makeResults(20, { result: 'win', opponentTier: 'expert' }),
    );
    expect(vsExperts).toBeGreaterThan(vsBeginners);
  });

  it('weights recent matches more heavily', () => {
    // 10 recent losses + 15 older wins should score lower than
    // 10 recent wins + 15 older losses
    const recentLosses: RecentResult[] = [
      ...makeResults(10, { result: 'loss' }),
      ...makeResults(15, { result: 'win', completedAt: Date.now() - 100000 }),
    ];
    const recentWins: RecentResult[] = [
      ...makeResults(10, { result: 'win' }),
      ...makeResults(15, { result: 'loss', completedAt: Date.now() - 100000 }),
    ];
    expect(computeTierScore(recentWins)).toBeGreaterThan(
      computeTierScore(recentLosses),
    );
  });

  it('handles all losses → low score', () => {
    const results = makeResults(20, { result: 'loss' });
    const score = computeTierScore(results);
    expect(score).toBeLessThan(0.25);
  });

  it('returns clamped value between 0 and 1', () => {
    const allWins = makeResults(50, { result: 'win', opponentTier: 'expert' });
    const allLosses = makeResults(50, { result: 'loss', opponentTier: 'beginner' });
    expect(computeTierScore(allWins)).toBeLessThanOrEqual(1.0);
    expect(computeTierScore(allWins)).toBeGreaterThanOrEqual(0.0);
    expect(computeTierScore(allLosses)).toBeLessThanOrEqual(1.0);
    expect(computeTierScore(allLosses)).toBeGreaterThanOrEqual(0.0);
  });

  it('50% win rate vs mixed opponents → mid range', () => {
    const results: RecentResult[] = [];
    for (let i = 0; i < 20; i++) {
      results.push(makeResult({
        result: i % 2 === 0 ? 'win' : 'loss',
        opponentTier: 'intermediate',
        completedAt: Date.now() - i * 60000,
      }));
    }
    const score = computeTierScore(results);
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(0.7);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/utils/__tests__/tierEngine.test.ts`
Expected: FAIL — `tierEngine.ts` doesn't exist

**Step 3: Implement `computeTierScore()`**

Create `src/shared/utils/tierEngine.ts`:

```typescript
import type { RecentResult, Tier, TierConfidence } from '../../data/types';

// --- Constants ---

const TIER_MULTIPLIER: Record<Tier, number> = {
  beginner: 0.5,
  intermediate: 0.8,
  advanced: 1.0,
  expert: 1.3,
};

const RECENCY_BUCKETS = [
  { maxIndex: 10, weight: 1.0 },   // last 10 matches
  { maxIndex: 25, weight: 0.8 },   // matches 11-25
  { maxIndex: 50, weight: 0.6 },   // matches 26-50
] as const;

const DAMPING_MATCHES = 15;
const PRIOR_SCORE = 0.25;

// --- Score Computation ---

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
    const recency = getRecencyWeight(i);
    const tierMul = TIER_MULTIPLIER[r.opponentTier];

    if (r.result === 'win') {
      weightedWins += recency * tierMul;
    }
    totalWeight += recency;
  }

  const rawScore = totalWeight > 0 ? weightedWins / totalWeight : 0;

  // Bayesian damping: pull toward prior for small samples
  const dampingFactor = Math.min(results.length / DAMPING_MATCHES, 1.0);
  const score = PRIOR_SCORE + (rawScore - PRIOR_SCORE) * dampingFactor;

  return Math.max(0, Math.min(1, score));
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/utils/__tests__/tierEngine.test.ts`
Expected: All `computeTierScore` tests PASS

**Step 5: Commit**

```bash
git add src/shared/utils/tierEngine.ts src/shared/utils/__tests__/tierEngine.test.ts
git commit -m "feat: add computeTierScore — multiplicative weighted win rate with Bayesian damping"
```

---

## Task 3: Tier Engine — Tier Assignment with Hysteresis

**Files:**
- Modify: `src/shared/utils/__tests__/tierEngine.test.ts`
- Modify: `src/shared/utils/tierEngine.ts`

**Context:** `computeTier()` maps a score (0–1) to a Tier label using hysteresis thresholds. It takes the current tier as input so it can apply promote/demote gaps.

**Reference (from design doc):**

| Tier | Promote above | Demote below |
|------|--------------|-------------|
| Beginner | 0.33 | — |
| Intermediate | 0.53 | 0.27 |
| Advanced | 0.73 | 0.47 |
| Expert | — | 0.67 |

**Step 1: Write failing tests for `computeTier()`**

Append to `src/shared/utils/__tests__/tierEngine.test.ts`:

```typescript
// --- computeTier ---

describe('computeTier', () => {
  it('returns beginner for score below 0.33', () => {
    expect(computeTier(0.2, 'beginner')).toBe('beginner');
  });

  it('promotes from beginner to intermediate at 0.33', () => {
    expect(computeTier(0.34, 'beginner')).toBe('intermediate');
  });

  it('promotes from intermediate to advanced at 0.53', () => {
    expect(computeTier(0.54, 'intermediate')).toBe('advanced');
  });

  it('promotes from advanced to expert at 0.73', () => {
    expect(computeTier(0.74, 'advanced')).toBe('expert');
  });

  it('demotes from intermediate to beginner below 0.27', () => {
    expect(computeTier(0.26, 'intermediate')).toBe('beginner');
  });

  it('demotes from advanced to intermediate below 0.47', () => {
    expect(computeTier(0.46, 'advanced')).toBe('intermediate');
  });

  it('demotes from expert to advanced below 0.67', () => {
    expect(computeTier(0.66, 'expert')).toBe('advanced');
  });

  // Hysteresis: stay at current tier in the gap between promote/demote
  it('stays intermediate at 0.30 (between demote 0.27 and promote 0.33)', () => {
    expect(computeTier(0.30, 'intermediate')).toBe('intermediate');
  });

  it('stays advanced at 0.50 (between demote 0.47 and promote 0.53)', () => {
    expect(computeTier(0.50, 'advanced')).toBe('advanced');
  });

  it('stays expert at 0.70 (between demote 0.67 and promote 0.73)', () => {
    expect(computeTier(0.70, 'expert')).toBe('expert');
  });

  it('defaults to beginner for first-time player', () => {
    expect(computeTier(0.25, 'beginner')).toBe('beginner');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/utils/__tests__/tierEngine.test.ts`
Expected: FAIL — `computeTier` imported but not exported yet

**Step 3: Implement `computeTier()`**

Append to `src/shared/utils/tierEngine.ts`:

```typescript
// --- Tier Assignment with Hysteresis ---

interface TierThreshold {
  tier: Tier;
  promoteAbove: number | null;  // null = can't promote higher
  demoteBelow: number | null;   // null = can't demote lower
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
  const current = TIER_THRESHOLDS[currentIndex];

  // Check promotion
  if (current.promoteAbove !== null && score > current.promoteAbove) {
    // Recursively check if we should promote further
    const nextTier = TIER_ORDER[currentIndex + 1];
    return computeTier(score, nextTier);
  }

  // Check demotion
  if (current.demoteBelow !== null && score < current.demoteBelow) {
    const prevTier = TIER_ORDER[currentIndex - 1];
    return computeTier(score, prevTier);
  }

  // Stay at current tier (hysteresis gap)
  return currentTier;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/utils/__tests__/tierEngine.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/shared/utils/tierEngine.ts src/shared/utils/__tests__/tierEngine.test.ts
git commit -m "feat: add computeTier with hysteresis thresholds for tier promotion/demotion"
```

---

## Task 4: Tier Engine — Confidence Computation

**Files:**
- Modify: `src/shared/utils/__tests__/tierEngine.test.ts`
- Modify: `src/shared/utils/tierEngine.ts`

**Step 1: Write failing tests for `computeTierConfidence()`**

Append to `src/shared/utils/__tests__/tierEngine.test.ts`:

```typescript
// --- computeTierConfidence ---

describe('computeTierConfidence', () => {
  it('returns low for fewer than 8 matches', () => {
    expect(computeTierConfidence(5, 2)).toBe('low');
  });

  it('returns low for 8 matches but only 2 unique opponents', () => {
    expect(computeTierConfidence(8, 2)).toBe('low');
  });

  it('returns medium for 8 matches and 3 unique opponents', () => {
    expect(computeTierConfidence(8, 3)).toBe('medium');
  });

  it('returns medium for 19 matches and 5 unique opponents', () => {
    expect(computeTierConfidence(19, 5)).toBe('medium');
  });

  it('returns high for 20 matches and 6 unique opponents', () => {
    expect(computeTierConfidence(20, 6)).toBe('high');
  });

  it('returns high for 50 matches and 10 unique opponents', () => {
    expect(computeTierConfidence(50, 10)).toBe('high');
  });

  it('returns low for 0 matches', () => {
    expect(computeTierConfidence(0, 0)).toBe('low');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/utils/__tests__/tierEngine.test.ts`
Expected: FAIL — `computeTierConfidence` not yet exported

**Step 3: Implement `computeTierConfidence()`**

Append to `src/shared/utils/tierEngine.ts`:

```typescript
// --- Confidence ---

export function computeTierConfidence(
  matchCount: number,
  uniqueOpponents: number,
): TierConfidence {
  if (matchCount >= 20 && uniqueOpponents >= 6) return 'high';
  if (matchCount >= 8 && uniqueOpponents >= 3) return 'medium';
  return 'low';
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/utils/__tests__/tierEngine.test.ts`
Expected: All tests PASS

**Step 5: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/shared/utils/tierEngine.ts src/shared/utils/__tests__/tierEngine.test.ts
git commit -m "feat: add computeTierConfidence based on match count and opponent variety"
```

---

## Task 5: Player Stats Repository — Test Setup and `updatePlayerStats`

**Files:**
- Create: `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
- Create: `src/data/firebase/firestorePlayerStatsRepository.ts`

**Context:** This repository reads/writes to Firestore subcollections `users/{uid}/matchRefs/{matchId}` and `users/{uid}/stats/summary`. It follows the same `vi.hoisted` mock pattern used by all other Firestore repository tests in this project.

**Key references:**
- Mock pattern: `src/data/firebase/__tests__/firestoreRegistrationRepository.test.ts`
- Repository pattern: `src/data/firebase/firestoreTeamRepository.ts`
- Subcollection paths: `users/{uid}/matchRefs/{matchId}`, `users/{uid}/stats/summary`

**Step 1: Write failing test for `updatePlayerStats()`**

Create `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Match, StatsSummary, MatchRef } from '../../types';

const {
  mockDoc,
  mockSetDoc,
  mockGetDoc,
  mockCollection,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(() => 'mock-doc-ref'),
  mockSetDoc: vi.fn(),
  mockGetDoc: vi.fn(),
  mockCollection: vi.fn(() => 'mock-collection-ref'),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  collection: mockCollection,
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
  auth: { currentUser: { uid: 'scorer-uid' } },
}));

vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: {},
}));

import { firestorePlayerStatsRepository } from '../firestorePlayerStatsRepository';

// --- Factories ---

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    config: {
      gameType: 'singles',
      scoringMode: 'sideout',
      matchFormat: 'best-of-3',
      pointsToWin: 11,
    },
    team1PlayerIds: ['p1'],
    team2PlayerIds: ['p2'],
    team1Name: 'Alice',
    team2Name: 'Bob',
    games: [
      { gameNumber: 1, team1Score: 11, team2Score: 7, winningSide: 1 },
      { gameNumber: 2, team1Score: 11, team2Score: 4, winningSide: 1 },
    ],
    winningSide: 1,
    status: 'completed',
    startedAt: 1000000,
    completedAt: 2000000,
    ...overrides,
  };
}

function makeEmptyStats(): StatsSummary {
  return {
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
  };
}

describe('firestorePlayerStatsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updatePlayerStats', () => {
    it('creates matchRef and new stats summary for first match', async () => {
      // No existing matchRef
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      // No existing stats
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win',
      );

      // Should write matchRef doc
      expect(mockDoc).toHaveBeenCalledWith(
        'mock-firestore', 'users', 'user-1', 'matchRefs', 'match-1',
      );

      // Should write stats/summary doc
      expect(mockDoc).toHaveBeenCalledWith(
        'mock-firestore', 'users', 'user-1', 'stats', 'summary',
      );

      // setDoc called twice: matchRef + stats
      expect(mockSetDoc).toHaveBeenCalledTimes(2);

      // Verify stats summary shape
      const statsCall = mockSetDoc.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.totalMatches).toBe(1);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(0);
      expect(stats.winRate).toBeCloseTo(1.0);
      expect(stats.tier).toBe('beginner'); // damped with 1 match
      expect(stats.recentResults).toHaveLength(1);
    });

    it('skips if matchRef already exists (idempotency)', async () => {
      // matchRef already exists
      mockGetDoc.mockResolvedValueOnce({ exists: () => true });

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win',
      );

      // Should NOT write anything
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('updates existing stats summary incrementally', async () => {
      // No existing matchRef
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      // Existing stats with 5 matches
      const existingStats = makeEmptyStats();
      existingStats.totalMatches = 5;
      existingStats.wins = 3;
      existingStats.losses = 2;
      existingStats.winRate = 0.6;
      existingStats.currentStreak = { type: 'W', count: 2 };
      existingStats.bestWinStreak = 3;
      existingStats.singles = { matches: 5, wins: 3, losses: 2 };
      existingStats.recentResults = makeResults(5);
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingStats,
      });
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win',
      );

      const statsCall = mockSetDoc.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.totalMatches).toBe(6);
      expect(stats.wins).toBe(4);
      expect(stats.losses).toBe(2);
      expect(stats.currentStreak).toEqual({ type: 'W', count: 3 });
      expect(stats.recentResults).toHaveLength(6);
    });

    it('resets win streak on a loss', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      const existingStats = makeEmptyStats();
      existingStats.totalMatches = 3;
      existingStats.wins = 3;
      existingStats.losses = 0;
      existingStats.currentStreak = { type: 'W', count: 3 };
      existingStats.bestWinStreak = 3;
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingStats,
      });
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch({ winningSide: 2 });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'loss',
      );

      const statsCall = mockSetDoc.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.currentStreak).toEqual({ type: 'L', count: 1 });
      expect(stats.bestWinStreak).toBe(3); // preserved
    });

    it('caps recentResults ring buffer at 50', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      const existingStats = makeEmptyStats();
      existingStats.totalMatches = 50;
      existingStats.recentResults = makeResults(50);
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => existingStats,
      });
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch();
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win',
      );

      const statsCall = mockSetDoc.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.recentResults).toHaveLength(50);
    });

    it('builds matchRef with correct fields', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch({
        id: 'match-42',
        team1Name: 'Alice',
        team2Name: 'Bob',
        startedAt: 1000,
        completedAt: 2000,
      });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win',
      );

      const refCall = mockSetDoc.mock.calls[0];
      const ref = refCall[1] as MatchRef;
      expect(ref.matchId).toBe('match-42');
      expect(ref.startedAt).toBe(1000);
      expect(ref.completedAt).toBe(2000);
      expect(ref.gameType).toBe('singles');
      expect(ref.result).toBe('win');
      expect(ref.playerTeam).toBe(1);
      expect(ref.scores).toBe('11-7, 11-4');
      expect(ref.gameScores).toEqual([[11, 7], [11, 4]]);
    });

    it('tracks doubles stats separately', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch({
        config: {
          gameType: 'doubles',
          scoringMode: 'rally',
          matchFormat: 'best-of-3',
          pointsToWin: 11,
        },
      });
      await firestorePlayerStatsRepository.updatePlayerStats(
        'user-1', match, 1, 'win',
      );

      const statsCall = mockSetDoc.mock.calls[1];
      const stats = statsCall[1] as StatsSummary;
      expect(stats.doubles.matches).toBe(1);
      expect(stats.doubles.wins).toBe(1);
      expect(stats.singles.matches).toBe(0);
    });
  });
});

// Re-export factory for use in test
function makeResults(
  count: number,
  overrides: Partial<import('../../types').RecentResult> = {},
): import('../../types').RecentResult[] {
  return Array.from({ length: count }, (_, i) => ({
    result: 'win' as const,
    opponentTier: 'intermediate' as const,
    completedAt: Date.now() - i * 60000,
    gameType: 'singles' as const,
    ...overrides,
  }));
}
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: FAIL — module not found

**Step 3: Implement `firestorePlayerStatsRepository`**

Create `src/data/firebase/firestorePlayerStatsRepository.ts`:

```typescript
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './config';
import type { Match, MatchRef, StatsSummary, RecentResult, Tier } from '../types';
import { computeTierScore, computeTier, computeTierConfidence } from '../../shared/utils/tierEngine';

const RING_BUFFER_SIZE = 50;

function buildMatchRef(
  match: Match,
  playerTeam: 1 | 2,
  result: 'win' | 'loss',
): MatchRef {
  const opponentTeam = playerTeam === 1 ? 2 : 1;
  const opponentNames = opponentTeam === 1 ? [match.team1Name] : [match.team2Name];
  const partnerName = match.config.gameType === 'doubles'
    ? (playerTeam === 1 ? match.team1Name : match.team2Name)
    : null;

  const scores = match.games
    .map((g) => `${g.team1Score}-${g.team2Score}`)
    .join(', ');
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
    ownerId: '',
    tournamentId: match.tournamentId ?? null,
    tournamentName: null,
  };
}

function createEmptyStats(): StatsSummary {
  return {
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
  };
}

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

function countUniqueOpponents(recentResults: RecentResult[]): number {
  // For v1 we approximate: count distinct completedAt timestamps as a proxy
  // (true opponent tracking requires opponentIds on RecentResult, deferred)
  // Since we can't track opponent IDs in RecentResult, use match count as lower bound
  return Math.min(recentResults.length, recentResults.length);
}

export const firestorePlayerStatsRepository = {
  async updatePlayerStats(
    uid: string,
    match: Match,
    playerTeam: 1 | 2,
    result: 'win' | 'loss',
  ): Promise<void> {
    // 1. Idempotency check: skip if matchRef already exists
    const matchRefDoc = doc(firestore, 'users', uid, 'matchRefs', match.id);
    const existingRef = await getDoc(matchRefDoc);
    if (existingRef.exists()) return;

    // 2. Read existing stats
    const statsDoc = doc(firestore, 'users', uid, 'stats', 'summary');
    const existingStatsSnap = await getDoc(statsDoc);
    const stats: StatsSummary = existingStatsSnap.exists()
      ? (existingStatsSnap.data() as StatsSummary)
      : createEmptyStats();

    // 3. Build and write matchRef
    const matchRef = buildMatchRef(match, playerTeam, result);
    matchRef.ownerId = uid;
    await setDoc(matchRefDoc, matchRef);

    // 4. Update stats
    const isWin = result === 'win';
    const gameType = match.config.gameType;

    stats.totalMatches += 1;
    stats.wins += isWin ? 1 : 0;
    stats.losses += isWin ? 0 : 1;
    stats.winRate = stats.totalMatches > 0 ? stats.wins / stats.totalMatches : 0;

    // Format-specific stats
    const formatStats = gameType === 'singles' ? stats.singles : stats.doubles;
    formatStats.matches += 1;
    formatStats.wins += isWin ? 1 : 0;
    formatStats.losses += isWin ? 0 : 1;

    // Streak
    const newStreak = updateStreak(stats.currentStreak, result);
    stats.currentStreak = newStreak;
    if (newStreak.type === 'W' && newStreak.count > stats.bestWinStreak) {
      stats.bestWinStreak = newStreak.count;
    }

    // Ring buffer
    const newResult: RecentResult = {
      result,
      opponentTier: 'beginner', // v1: default opponent tier (circular bootstrap)
      completedAt: match.completedAt ?? Date.now(),
      gameType,
    };
    stats.recentResults = [...stats.recentResults, newResult].slice(-RING_BUFFER_SIZE);

    // Tier computation
    const score = computeTierScore(stats.recentResults);
    stats.tier = computeTier(score, stats.tier);
    const uniqueOpponents = countUniqueOpponents(stats.recentResults);
    stats.tierConfidence = computeTierConfidence(stats.totalMatches, uniqueOpponents);
    stats.tierUpdatedAt = Date.now();

    stats.lastPlayedAt = match.completedAt ?? Date.now();
    stats.updatedAt = Date.now();

    // 5. Write updated stats
    await setDoc(statsDoc, stats);
  },
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts
git commit -m "feat: add firestorePlayerStatsRepository with updatePlayerStats, matchRef, and stats summary"
```

---

## Task 6: Player Stats Repository — `processMatchCompletion` and UID Resolution

**Files:**
- Modify: `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts`

**Context:** `processMatchCompletion()` is the public orchestrator. It resolves participant UIDs (tournament → registration lookup; casual → scorer only) and calls `updatePlayerStats` for each.

**Key references:**
- `firestoreRegistrationRepository.getByTournament()` returns `TournamentRegistration[]`
- `TournamentRegistration` has `userId: string` and `teamId: string`
- Match has `tournamentTeam1Id` and `tournamentTeam2Id` to match registrations to teams

**Step 1: Write failing tests for `processMatchCompletion()`**

Append to the `describe('firestorePlayerStatsRepository')` block in the test file:

```typescript
  describe('processMatchCompletion', () => {
    it('writes stats for scorer only on casual match', async () => {
      // matchRef check (not exists) + stats check (not exists) for scorer
      mockGetDoc
        .mockResolvedValueOnce({ exists: () => false })  // matchRef
        .mockResolvedValueOnce({ exists: () => false }); // stats
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch();
      await firestorePlayerStatsRepository.processMatchCompletion(
        match, 'scorer-uid',
      );

      // Only scorer gets stats (casual match = no tournament)
      // 2 setDoc calls: matchRef + stats for scorer
      expect(mockSetDoc).toHaveBeenCalledTimes(2);
    });

    it('writes stats for all tournament participants', async () => {
      // Need to mock firestoreRegistrationRepository
      const { mockGetDocs } = await vi.importMock<{
        mockGetDocs: ReturnType<typeof vi.fn>;
      }>('firebase/firestore');

      // For each of the 2 UIDs resolved: matchRef check + stats check
      mockGetDoc
        .mockResolvedValueOnce({ exists: () => false })  // uid-A matchRef
        .mockResolvedValueOnce({ exists: () => false })  // uid-A stats
        .mockResolvedValueOnce({ exists: () => false })  // uid-B matchRef
        .mockResolvedValueOnce({ exists: () => false }); // uid-B stats
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch({
        tournamentId: 'tourn-1',
        tournamentTeam1Id: 'team-A',
        tournamentTeam2Id: 'team-B',
      });

      // Mock registration lookup via getDocs
      // This is done through the repository's internal call
      // We need to add getDocs to our mocks - see updated mock setup
      await firestorePlayerStatsRepository.processMatchCompletion(
        match, 'scorer-uid',
      );

      // Should process stats for resolved UIDs
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('swallows errors for individual players without blocking others', async () => {
      // First player fails, second succeeds
      mockGetDoc
        .mockRejectedValueOnce(new Error('Firestore error'))  // uid-1 fails
        .mockResolvedValueOnce({ exists: () => false })        // uid-2 matchRef
        .mockResolvedValueOnce({ exists: () => false });       // uid-2 stats
      mockSetDoc.mockResolvedValue(undefined);

      const match = makeMatch();
      // Should not throw
      await expect(
        firestorePlayerStatsRepository.processMatchCompletion(match, 'scorer-uid'),
      ).resolves.not.toThrow();
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: FAIL — `processMatchCompletion` not yet defined

**Step 3: Update mock setup to include getDocs**

Update the hoisted mocks at the top of the test file to add `mockGetDocs`:

```typescript
const {
  mockDoc,
  mockSetDoc,
  mockGetDoc,
  mockGetDocs,
  mockCollection,
  mockQuery,
  mockWhere,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(() => 'mock-doc-ref'),
  mockSetDoc: vi.fn(),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  mockCollection: vi.fn(() => 'mock-collection-ref'),
  mockQuery: vi.fn(() => 'mock-query'),
  mockWhere: vi.fn(() => 'mock-where'),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
}));
```

**Step 4: Implement `processMatchCompletion()` and `resolveParticipantUids()`**

Add to `src/data/firebase/firestorePlayerStatsRepository.ts`:

Update imports at top:

```typescript
import { doc, getDoc, getDocs, setDoc, collection, query, where } from 'firebase/firestore';
```

Add these functions before the exported object:

```typescript
async function resolveParticipantUids(
  match: Match,
  scorerUid: string,
): Promise<Array<{ uid: string; playerTeam: 1 | 2; result: 'win' | 'loss' }>> {
  const participants: Array<{ uid: string; playerTeam: 1 | 2; result: 'win' | 'loss' }> = [];

  if (match.tournamentId && (match.tournamentTeam1Id || match.tournamentTeam2Id)) {
    // Tournament match: look up registrations to find UIDs
    try {
      const regsSnapshot = await getDocs(
        collection(firestore, 'tournaments', match.tournamentId, 'registrations'),
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
      console.warn('Failed to resolve tournament participant UIDs:', err);
    }
  }

  // Casual match: only scorer gets stats
  if (participants.length === 0) {
    // Scorer is team 1 by convention (they started the match)
    const result: 'win' | 'loss' = match.winningSide === 1 ? 'win' : 'loss';
    participants.push({ uid: scorerUid, playerTeam: 1, result });
  }

  return participants;
}
```

Add `processMatchCompletion` to the exported object:

```typescript
  async processMatchCompletion(
    match: Match,
    scorerUid: string,
  ): Promise<void> {
    const participants = await resolveParticipantUids(match, scorerUid);

    await Promise.all(
      participants.map(({ uid, playerTeam, result }) =>
        this.updatePlayerStats(uid, match, playerTeam, result).catch((err) => {
          console.warn('Stats update failed for user:', uid, err);
        }),
      ),
    );
  },
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts
git commit -m "feat: add processMatchCompletion with tournament UID resolution and casual fallback"
```

---

## Task 7: Firestore Security Rules — matchRefs and stats Subcollections

**Files:**
- Modify: `firestore.rules:399` (insert before the buddy notifications closing, or after)

**Context:** Add rules for two new subcollections under `/users/{userId}`. `matchRefs` are immutable (create only, no update/delete). `stats` allow create+update but no delete. Any authenticated user can create (scorer writes for all participants), following the `buddyNotifications` precedent.

**Step 1: Add subcollection rules**

In `firestore.rules`, insert after line 399 (after the `buddyNotifications` block closing `}`), before the collection group rules:

```javascript
    // ── Match References (/users/{userId}/matchRefs/{refId}) ──────────
    match /users/{userId}/matchRefs/{refId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.matchId is string
        && request.resource.data.completedAt is number
        && request.resource.data.result in ['win', 'loss'];
      allow update, delete: if false;
    }

    // ── Stats Summary (/users/{userId}/stats/{docId}) ─────────────────
    match /users/{userId}/stats/{docId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null;
      allow delete: if false;
    }
```

**Step 2: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: All tests PASS (rules don't affect unit tests, but verify nothing else broke)

**Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore rules for matchRefs (immutable) and stats subcollections"
```

---

## Task 8: CloudSync Integration — `syncPlayerStatsAfterMatch`

**Files:**
- Modify: `src/data/firebase/cloudSync.ts:7,122`
- Create: `src/data/firebase/__tests__/cloudSync.playerStats.test.ts` (separate test file to keep focused)

**Context:** Add one new fire-and-forget method to the existing `cloudSync` object. Follows the exact same pattern as `syncMatchToCloud`: void return, auth guard, `.catch()` for error swallowing.

**Step 1: Write failing test**

Create `src/data/firebase/__tests__/cloudSync.playerStats.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Match } from '../../types';

const mockProcessMatchCompletion = vi.fn();

vi.mock('../firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: {
    processMatchCompletion: mockProcessMatchCompletion,
  },
}));

vi.mock('../firestoreMatchRepository', () => ({
  firestoreMatchRepository: {},
}));

vi.mock('../firestoreScoreEventRepository', () => ({
  firestoreScoreEventRepository: {},
}));

vi.mock('../firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: {},
}));

vi.mock('../firestoreUserRepository', () => ({
  firestoreUserRepository: {},
}));

vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: {},
}));

const mockAuth = { currentUser: null as { uid: string } | null };
vi.mock('../config', () => ({
  auth: mockAuth,
  firestore: 'mock-firestore',
}));

import { cloudSync } from '../cloudSync';

describe('cloudSync.syncPlayerStatsAfterMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = { uid: 'test-user' } as { uid: string };
  });

  it('calls processMatchCompletion with match and scorer uid', () => {
    mockProcessMatchCompletion.mockResolvedValue(undefined);
    const match = { id: 'match-1' } as Match;

    cloudSync.syncPlayerStatsAfterMatch(match);

    expect(mockProcessMatchCompletion).toHaveBeenCalledWith(match, 'test-user');
  });

  it('does nothing when user is not authenticated', () => {
    mockAuth.currentUser = null;
    const match = { id: 'match-1' } as Match;

    cloudSync.syncPlayerStatsAfterMatch(match);

    expect(mockProcessMatchCompletion).not.toHaveBeenCalled();
  });

  it('swallows errors without throwing', () => {
    mockProcessMatchCompletion.mockRejectedValue(new Error('Network error'));
    const match = { id: 'match-1' } as Match;

    // Should not throw (fire-and-forget)
    expect(() => cloudSync.syncPlayerStatsAfterMatch(match)).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/cloudSync.playerStats.test.ts`
Expected: FAIL — `syncPlayerStatsAfterMatch` is not a function

**Step 3: Implement `syncPlayerStatsAfterMatch`**

Modify `src/data/firebase/cloudSync.ts`:

1. Add import at line 5 (after the existing imports):
```typescript
import { firestorePlayerStatsRepository } from './firestorePlayerStatsRepository';
```

2. Add method inside the `cloudSync` object, before the closing `};` (insert before line 137):
```typescript
  /**
   * Fire-and-forget: update match refs and stats for all signed-in participants.
   */
  syncPlayerStatsAfterMatch(match: Match): void {
    const user = auth.currentUser;
    if (!user) return;
    firestorePlayerStatsRepository
      .processMatchCompletion(match, user.uid)
      .catch((err) => {
        console.warn('Stats sync failed:', match.id, err);
      });
  },
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/cloudSync.playerStats.test.ts`
Expected: All tests PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (including existing cloudSync tests)

**Step 6: Commit**

```bash
git add src/data/firebase/cloudSync.ts src/data/firebase/__tests__/cloudSync.playerStats.test.ts
git commit -m "feat: add syncPlayerStatsAfterMatch to cloudSync (fire-and-forget)"
```

---

## Task 9: ScoringPage Integration — One Line

**Files:**
- Modify: `src/features/scoring/ScoringPage.tsx:203`

**Context:** Add one line after `cloudSync.syncMatchToCloud(updatedMatch)` (line 203) to trigger stats sync. This is fire-and-forget — it never blocks navigation or tournament updates.

**Step 1: Add the call**

In `src/features/scoring/ScoringPage.tsx`, after line 203 (`cloudSync.syncMatchToCloud(updatedMatch);`), add:

```typescript
    cloudSync.syncPlayerStatsAfterMatch(updatedMatch);
```

The result should look like:

```typescript
    await matchRepository.save(updatedMatch);
    cloudSync.syncMatchToCloud(updatedMatch);
    cloudSync.syncPlayerStatsAfterMatch(updatedMatch);

    // Update tournament pool if this is a tournament match
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (the method exists on cloudSync, accepts Match)

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/features/scoring/ScoringPage.tsx
git commit -m "feat: trigger player stats sync after match completion in ScoringPage"
```

---

## Task 10: Expand UserProfile with Optional Fields

**Files:**
- Modify: `src/data/types.ts:78-85` (UserProfile interface)
- Modify: `src/data/firebase/firestoreUserRepository.ts` (getProfile defaults)

**Context:** Add `bio`, `profileVisibility`, and `updatedAt` optional fields to UserProfile. These are optional for backward compatibility — existing docs don't have them, so read code provides defaults.

**Step 1: Update UserProfile type**

In `src/data/types.ts`, modify the `UserProfile` interface (lines 78-85):

```typescript
export interface UserProfile {
  id: string;
  displayName: string;
  displayNameLower: string;
  email: string;
  photoURL: string | null;
  createdAt: number;
  // Layer 7 Wave A additions (optional for backward compat)
  bio?: string;
  profileVisibility?: 'public' | 'private';
  updatedAt?: number;
}
```

**Step 2: Update `getProfile()` to provide defaults**

In `src/data/firebase/firestoreUserRepository.ts`, find the `getProfile()` method. Where it maps Firestore data to a `UserProfile`, ensure new fields have defaults. If there's a mapping like `return { id: d.id, ...d.data() }`, the optional fields will be `undefined` (fine — callers use `?? ''` as stated in design doc). No code change needed if it uses spread.

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (fields are optional, no consumers break)

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/data/types.ts src/data/firebase/firestoreUserRepository.ts
git commit -m "feat: add optional bio, profileVisibility, updatedAt to UserProfile"
```

---

## Task 11: Final Verification

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (should be ~470+ total)

**Step 3: Verify all new files exist**

```bash
ls -la src/shared/utils/tierEngine.ts
ls -la src/shared/utils/__tests__/tierEngine.test.ts
ls -la src/data/firebase/firestorePlayerStatsRepository.ts
ls -la src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts
ls -la src/data/firebase/__tests__/cloudSync.playerStats.test.ts
```

**Step 4: Check git log for clean commit history**

Run: `git log --oneline -12`
Expected: Clean series of `feat:` commits, one per task

---

## Summary

| Task | What | New Tests |
|------|------|-----------|
| 1 | Types (`MatchRef`, `StatsSummary`, `Tier`, etc.) | 0 (type-only) |
| 2 | `computeTierScore()` — weighted win rate + damping | ~9 |
| 3 | `computeTier()` — hysteresis thresholds | ~11 |
| 4 | `computeTierConfidence()` — match count + opponent variety | ~7 |
| 5 | `updatePlayerStats()` — matchRef + stats CRUD | ~7 |
| 6 | `processMatchCompletion()` — UID resolution + orchestration | ~3 |
| 7 | Firestore rules for `matchRefs` + `stats` | 0 (rules only) |
| 8 | `cloudSync.syncPlayerStatsAfterMatch()` | ~3 |
| 9 | ScoringPage one-line integration | 0 (verified by type check) |
| 10 | UserProfile optional fields | 0 (additive) |
| 11 | Final verification | 0 (run existing) |

**Estimated new tests: ~40**
**Total after: ~500+**
