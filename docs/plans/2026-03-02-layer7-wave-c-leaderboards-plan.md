# Wave C: Leaderboards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Global + Friends leaderboards with composite score ranking, tabbed into the existing `/players` page.

**Architecture:** New `/leaderboard/{uid}` Firestore collection with denormalized stats, written atomically alongside existing stats updates via `runTransaction()`. Leaderboard UI as a tab in PlayersPage with scope (Global/Friends) and timeframe (All-Time/Last 30 Days) toggles. Pure scoring functions + Firestore repository + SolidJS hook + component tree.

**Tech Stack:** SolidJS 1.9, TypeScript, Firestore, Vitest, Tailwind CSS v4, Lucide Solid

**Design Doc:** `docs/plans/2026-03-02-layer7-wave-c-leaderboards-design.md`

**Specialist Review Changes:** This plan was revised after 4 specialist reviews (Firestore, codebase fit, testing, SolidJS/frontend). Changes marked with **[REVISED]**.

---

### Task 1: Types & Leaderboard Scoring — Pure Functions

**[REVISED]** Types defined in `src/data/types.ts` per project convention (not in utils file).

**Files:**
- Modify: `src/data/types.ts` (add `Last30dStats` and `LeaderboardEntry` interfaces)
- Create: `src/shared/utils/leaderboardScoring.ts`
- Create: `src/shared/utils/__tests__/leaderboardScoring.test.ts`
- Create: `src/test/factories.ts` **[REVISED]** shared test factory
- Reference: `src/shared/utils/tierEngine.ts` (tier multipliers pattern)

**Step 1: Add types to `src/data/types.ts`**

After the existing `StatsSummary` interface (around line 141), add:

```typescript
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

**Step 2: Create shared test factory**

**[REVISED]** Single source of truth for test data — avoids duplication across 5+ test files.

```typescript
// src/test/factories.ts
import type { RecentResult, StatsSummary, LeaderboardEntry } from '../data/types';

export function makeResult(overrides: Partial<RecentResult> = {}): RecentResult {
  return {
    result: 'win',
    opponentTier: 'intermediate',
    completedAt: Date.now(),
    gameType: 'singles',
    ...overrides,
  };
}

export function makeStatsSummary(overrides: Partial<StatsSummary> = {}): StatsSummary {
  return {
    schemaVersion: 1,
    totalMatches: 10,
    wins: 6,
    losses: 4,
    winRate: 0.6,
    currentStreak: { type: 'W', count: 2 },
    bestWinStreak: 3,
    singles: { matches: 5, wins: 3, losses: 2 },
    doubles: { matches: 5, wins: 3, losses: 2 },
    recentResults: [],
    tier: 'intermediate',
    tierConfidence: 'medium',
    tierUpdatedAt: Date.now(),
    lastPlayedAt: Date.now(),
    updatedAt: Date.now(),
    uniqueOpponentUids: ['opp-1', 'opp-2'],
    ...overrides,
  };
}

export function makeLeaderboardEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    uid: 'user-1',
    displayName: 'Alice',
    photoURL: null,
    tier: 'intermediate',
    tierConfidence: 'medium',
    totalMatches: 10,
    wins: 6,
    winRate: 0.6,
    currentStreak: { type: 'W', count: 2 },
    compositeScore: 55,
    last30d: { totalMatches: 5, wins: 3, winRate: 0.6, compositeScore: 50 },
    lastPlayedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}
```

**Step 3: Write failing tests for `computeCompositeScore`**

```typescript
// src/shared/utils/__tests__/leaderboardScoring.test.ts
import { describe, it, expect } from 'vitest';
import { computeCompositeScore } from '../leaderboardScoring';

describe('computeCompositeScore', () => {
  it('returns 10 for beginner with 0% win rate and 0 matches', () => {
    expect(computeCompositeScore('beginner', 0, 0)).toBe(10);
    // 0.40 * 25 + 0.35 * 0 + 0.25 * 0 = 10
  });

  it('returns max for expert with 100% win rate and 50+ matches', () => {
    expect(computeCompositeScore('expert', 1.0, 50)).toBe(100);
    // 0.40 * 100 + 0.35 * 100 + 0.25 * 100 = 100
  });

  it('caps activity score at 50 matches', () => {
    const at50 = computeCompositeScore('intermediate', 0.5, 50);
    const at100 = computeCompositeScore('intermediate', 0.5, 100);
    expect(at50).toBe(at100);
  });

  it('produces tier-heavy ranking (expert > advanced at same winRate)', () => {
    const expert = computeCompositeScore('expert', 0.5, 20);
    const advanced = computeCompositeScore('advanced', 0.5, 20);
    expect(expert).toBeGreaterThan(advanced);
  });

  it('returns value between 0 and 100', () => {
    const score = computeCompositeScore('intermediate', 0.65, 30);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('handles exact tier score values', () => {
    const beginner = computeCompositeScore('beginner', 0, 0);
    const intermediate = computeCompositeScore('intermediate', 0, 0);
    expect(intermediate - beginner).toBe(10); // 0.40 * (50-25) = 10
  });

  // [REVISED] Edge case tests from testing specialist review
  it('clamps negative winRate to 0 in score calculation', () => {
    const score = computeCompositeScore('expert', -0.5, 10);
    const scoreAtZero = computeCompositeScore('expert', 0, 10);
    expect(score).toBe(scoreAtZero);
  });

  it('clamps winRate > 1.0 to 1.0 in score calculation', () => {
    const at100pct = computeCompositeScore('expert', 1.0, 10);
    const atOver100 = computeCompositeScore('expert', 1.5, 10);
    expect(atOver100).toBe(at100pct);
  });

  it('handles NaN winRate gracefully', () => {
    const score = computeCompositeScore('expert', NaN, 10);
    expect(isNaN(score)).toBe(false);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
```

**Step 4: Run tests to verify they fail**

Run: `npx vitest run src/shared/utils/__tests__/leaderboardScoring.test.ts`
Expected: FAIL — module not found

**Step 5: Implement `computeCompositeScore`**

```typescript
// src/shared/utils/leaderboardScoring.ts
import type { Tier, RecentResult, StatsSummary, Last30dStats, LeaderboardEntry } from '../../data/types';

const TIER_SCORE: Record<Tier, number> = {
  beginner: 25,
  intermediate: 50,
  advanced: 75,
  expert: 100,
};

// [REVISED] Clamp winRate to valid range to handle edge cases
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
```

**Step 6: Run tests to verify they pass**

Run: `npx vitest run src/shared/utils/__tests__/leaderboardScoring.test.ts`
Expected: PASS (all 9 tests)

**Step 7: Add failing tests for `computeLast30dStats`**

Add to the same test file:

```typescript
import { computeCompositeScore, computeLast30dStats } from '../leaderboardScoring';
import { makeResult } from '../../../test/factories';

describe('computeLast30dStats', () => {
  it('returns zeros for empty results', () => {
    const stats = computeLast30dStats([], 'intermediate', Date.now());
    expect(stats).toEqual({
      totalMatches: 0,
      wins: 0,
      winRate: 0,
      compositeScore: expect.any(Number),
    });
  });

  it('includes only results within last 30 days', () => {
    const now = Date.now();
    const results = [
      makeResult({ completedAt: now - 10 * 24 * 60 * 60 * 1000, result: 'win' }),
      makeResult({ completedAt: now - 40 * 24 * 60 * 60 * 1000, result: 'win' }),
      makeResult({ completedAt: now - 5 * 24 * 60 * 60 * 1000, result: 'loss' }),
    ];
    const stats = computeLast30dStats(results, 'intermediate', now);
    expect(stats.totalMatches).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.winRate).toBeCloseTo(0.5);
  });

  it('returns all results when all within 30 days', () => {
    const now = Date.now();
    const results = [
      makeResult({ completedAt: now - 1000, result: 'win' }),
      makeResult({ completedAt: now - 2000, result: 'win' }),
      makeResult({ completedAt: now - 3000, result: 'loss' }),
    ];
    const stats = computeLast30dStats(results, 'advanced', now);
    expect(stats.totalMatches).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.winRate).toBeCloseTo(2 / 3);
  });

  it('returns zeros when all results older than 30 days', () => {
    const now = Date.now();
    const results = [
      makeResult({ completedAt: now - 60 * 24 * 60 * 60 * 1000 }),
    ];
    const stats = computeLast30dStats(results, 'beginner', now);
    expect(stats.totalMatches).toBe(0);
    expect(stats.wins).toBe(0);
    expect(stats.winRate).toBe(0);
  });

  it('computes compositeScore using the 30d winRate and activity', () => {
    const now = Date.now();
    const results = [
      makeResult({ completedAt: now - 1000, result: 'win' }),
      makeResult({ completedAt: now - 2000, result: 'win' }),
    ];
    const stats = computeLast30dStats(results, 'expert', now);
    const expected = computeCompositeScore('expert', 1.0, 2);
    expect(stats.compositeScore).toBe(expected);
  });
});
```

**Step 8: Run tests to verify new tests fail**

Run: `npx vitest run src/shared/utils/__tests__/leaderboardScoring.test.ts`
Expected: FAIL — `computeLast30dStats` not exported

**Step 9: Implement `computeLast30dStats`**

Add to `src/shared/utils/leaderboardScoring.ts`:

```typescript
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
```

**Step 10: Run tests to verify all pass**

Run: `npx vitest run src/shared/utils/__tests__/leaderboardScoring.test.ts`
Expected: PASS (all 14 tests)

**Step 11: Add failing tests for `buildLeaderboardEntry`**

```typescript
import {
  computeCompositeScore,
  computeLast30dStats,
  buildLeaderboardEntry,
} from '../leaderboardScoring';
import { makeResult, makeStatsSummary } from '../../../test/factories';

describe('buildLeaderboardEntry', () => {
  it('returns null when totalMatches < 5', () => {
    const stats = makeStatsSummary({ totalMatches: 4 });
    const result = buildLeaderboardEntry('uid-1', 'Alice', 'https://photo.url', stats, Date.now());
    expect(result).toBeNull();
  });

  it('builds entry with correct fields when totalMatches >= 5', () => {
    const now = Date.now();
    const stats = makeStatsSummary({ totalMatches: 10, wins: 6, winRate: 0.6, tier: 'intermediate' });
    const entry = buildLeaderboardEntry('uid-1', 'Alice', 'https://photo.url', stats, now);

    expect(entry).not.toBeNull();
    expect(entry!.uid).toBe('uid-1');
    expect(entry!.displayName).toBe('Alice');
    expect(entry!.photoURL).toBe('https://photo.url');
    expect(entry!.tier).toBe('intermediate');
    expect(entry!.totalMatches).toBe(10);
    expect(entry!.wins).toBe(6);
    expect(entry!.winRate).toBe(0.6);
    expect(entry!.compositeScore).toBe(computeCompositeScore('intermediate', 0.6, 10));
  });

  it('includes last30d stats computed from recentResults', () => {
    const now = Date.now();
    const recentResults = [
      makeResult({ completedAt: now - 1000, result: 'win' }),
      makeResult({ completedAt: now - 2000, result: 'loss' }),
    ];
    const stats = makeStatsSummary({ totalMatches: 10, recentResults });
    const entry = buildLeaderboardEntry('uid-1', 'Bob', null, stats, now);

    expect(entry!.last30d.totalMatches).toBe(2);
    expect(entry!.last30d.wins).toBe(1);
    expect(entry!.last30d.winRate).toBeCloseTo(0.5);
  });

  it('handles null photoURL', () => {
    const stats = makeStatsSummary();
    const entry = buildLeaderboardEntry('uid-1', 'Charlie', null, stats, Date.now());
    expect(entry!.photoURL).toBeNull();
  });

  it('sets createdAt to now for new entries', () => {
    const now = Date.now();
    const stats = makeStatsSummary();
    const entry = buildLeaderboardEntry('uid-1', 'Dave', null, stats, now);
    expect(entry!.createdAt).toBe(now);
    expect(entry!.updatedAt).toBe(now);
  });
});
```

**Step 12: Implement `buildLeaderboardEntry`**

Add to `src/shared/utils/leaderboardScoring.ts`:

```typescript
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

**Step 13: Run all tests to verify they pass**

Run: `npx vitest run src/shared/utils/__tests__/leaderboardScoring.test.ts`
Expected: PASS (all 19 tests)

**Step 14: Commit**

```bash
git add src/data/types.ts src/shared/utils/leaderboardScoring.ts src/shared/utils/__tests__/leaderboardScoring.test.ts src/test/factories.ts
git commit -m "feat(leaderboard): add types, pure scoring functions, and shared test factory

LeaderboardEntry/Last30dStats types in types.ts, computeCompositeScore with
edge case clamping, computeLast30dStats, buildLeaderboardEntry"
```

---

### Task 2: Firestore Leaderboard Repository

**Files:**
- Create: `src/data/firebase/firestoreLeaderboardRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreLeaderboardRepository.test.ts`
- Reference: `src/data/firebase/firestoreMatchRepository.ts` (repository pattern)

**Step 1: Write failing tests**

```typescript
// src/data/firebase/__tests__/firestoreLeaderboardRepository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeLeaderboardEntry } from '../../../test/factories';

const {
  mockDoc,
  mockGetDoc,
  mockGetDocs,
  mockCollection,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockGetCountFromServer,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(() => 'mock-doc-ref'),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  mockCollection: vi.fn(() => 'mock-collection-ref'),
  mockQuery: vi.fn((...args: unknown[]) => args),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  mockOrderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  mockLimit: vi.fn((n: number) => ({ type: 'limit', n })),
  mockGetCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  getCountFromServer: mockGetCountFromServer,
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { firestoreLeaderboardRepository } from '../firestoreLeaderboardRepository';

describe('firestoreLeaderboardRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGlobalLeaderboard', () => {
    it('queries with compositeScore desc for allTime', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'user-1', data: () => makeLeaderboardEntry({ uid: 'user-1', compositeScore: 80 }) },
          { id: 'user-2', data: () => makeLeaderboardEntry({ uid: 'user-2', compositeScore: 70 }) },
        ],
      });

      const results = await firestoreLeaderboardRepository.getGlobalLeaderboard('allTime', 25);
      expect(mockOrderBy).toHaveBeenCalledWith('compositeScore', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(25);
      expect(results).toHaveLength(2);
      expect(results[0].compositeScore).toBe(80);
    });

    it('queries with last30d.compositeScore desc for last30d', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await firestoreLeaderboardRepository.getGlobalLeaderboard('last30d', 25);
      expect(mockOrderBy).toHaveBeenCalledWith('last30d.compositeScore', 'desc');
    });
  });

  describe('getFriendsLeaderboard', () => {
    it('filters by uid in friendUids', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await firestoreLeaderboardRepository.getFriendsLeaderboard(
        ['friend-1', 'friend-2'],
        'allTime',
      );
      expect(mockWhere).toHaveBeenCalledWith('uid', 'in', ['friend-1', 'friend-2']);
    });

    it('returns empty array for empty friendUids', async () => {
      const results = await firestoreLeaderboardRepository.getFriendsLeaderboard([], 'allTime');
      expect(results).toEqual([]);
      expect(mockGetDocs).not.toHaveBeenCalled();
    });
  });

  describe('getUserRank', () => {
    it('counts documents with higher compositeScore', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 5 }),
      });

      const rank = await firestoreLeaderboardRepository.getUserRank('user-1', 60, 'allTime');
      expect(rank).toBe(6);
      expect(mockWhere).toHaveBeenCalledWith('compositeScore', '>', 60);
    });

    it('returns rank 1 when no one has higher score', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 0 }),
      });

      const rank = await firestoreLeaderboardRepository.getUserRank('user-1', 90, 'allTime');
      expect(rank).toBe(1);
    });

    it('uses last30d.compositeScore for last30d timeframe', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 3 }),
      });

      await firestoreLeaderboardRepository.getUserRank('user-1', 60, 'last30d');
      expect(mockWhere).toHaveBeenCalledWith('last30d.compositeScore', '>', 60);
    });
  });

  describe('getUserEntry', () => {
    it('returns entry when it exists', async () => {
      const entry = makeLeaderboardEntry({ uid: 'user-1' });
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => entry,
        id: 'user-1',
      });

      const result = await firestoreLeaderboardRepository.getUserEntry('user-1');
      expect(result).toBeDefined();
      expect(result!.uid).toBe('user-1');
    });

    it('returns null when entry does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const result = await firestoreLeaderboardRepository.getUserEntry('user-1');
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/firebase/__tests__/firestoreLeaderboardRepository.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the repository**

```typescript
// src/data/firebase/firestoreLeaderboardRepository.ts
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
} from 'firebase/firestore';
import { firestore } from './config';
import type { LeaderboardEntry } from '../../data/types';

export type LeaderboardTimeframe = 'allTime' | 'last30d';

const COLLECTION = 'leaderboard';

function scoreField(timeframe: LeaderboardTimeframe): string {
  return timeframe === 'allTime' ? 'compositeScore' : 'last30d.compositeScore';
}

export const firestoreLeaderboardRepository = {
  async getGlobalLeaderboard(
    timeframe: LeaderboardTimeframe,
    maxResults: number = 25,
  ): Promise<LeaderboardEntry[]> {
    const q = query(
      collection(firestore, COLLECTION),
      orderBy(scoreField(timeframe), 'desc'),
      limit(maxResults),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ ...d.data(), uid: d.id }) as LeaderboardEntry);
  },

  async getFriendsLeaderboard(
    friendUids: string[],
    timeframe: LeaderboardTimeframe,
  ): Promise<LeaderboardEntry[]> {
    if (friendUids.length === 0) return [];

    const q = query(
      collection(firestore, COLLECTION),
      where('uid', 'in', friendUids),
      orderBy(scoreField(timeframe), 'desc'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ ...d.data(), uid: d.id }) as LeaderboardEntry);
  },

  async getUserRank(
    uid: string,
    userScore: number,
    timeframe: LeaderboardTimeframe,
  ): Promise<number> {
    const q = query(
      collection(firestore, COLLECTION),
      where(scoreField(timeframe), '>', userScore),
    );
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count + 1;
  },

  async getUserEntry(uid: string): Promise<LeaderboardEntry | null> {
    const ref = doc(firestore, COLLECTION, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { ...snap.data(), uid: snap.id } as LeaderboardEntry;
  },
};
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/firestoreLeaderboardRepository.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreLeaderboardRepository.ts src/data/firebase/__tests__/firestoreLeaderboardRepository.test.ts
git commit -m "feat(leaderboard): add Firestore leaderboard repository with tests

Global/friends queries, user rank via count(), getUserEntry"
```

---

### Task 3: Extend Write Path — Atomic Leaderboard Updates

**[REVISED]** Resolved blocker: `displayName`/`photoURL` not available in stats chain. Fix: fetch user profiles in `processMatchCompletion()` using existing `firestoreUserRepository.getProfile()`.

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts`
- Modify: `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
- Reference: `src/shared/utils/leaderboardScoring.ts` (buildLeaderboardEntry)
- Reference: `src/data/firebase/firestoreUserRepository.ts` (getProfile)

**Call chain (traced from codebase):**
```
ScoringPage.saveAndFinish()                         [src/features/scoring/ScoringPage.tsx:204]
  → cloudSync.syncPlayerStatsAfterMatch(match)      [src/data/firebase/cloudSync.ts:144]
    → processMatchCompletion(match, scorerUid)      [firestorePlayerStatsRepository.ts:315]
      → resolveParticipantUids(match, scorerUid)    → returns [{uid, playerTeam, result}]
      → [NEW] fetch user profiles for each uid      → returns {uid → {displayName, photoURL}}
      → updatePlayerStats(uid, match, ..., displayName, photoURL)
        → [NEW] inside transaction: buildLeaderboardEntry() + transaction.set()
```

**Step 1: Write failing tests for profile fetching in processMatchCompletion**

Add to existing `firestorePlayerStatsRepository.test.ts`:

```typescript
// Add mock for firestoreUserRepository
const mockGetProfile = vi.fn();

vi.mock('../firestoreUserRepository', () => ({
  firestoreUserRepository: {
    getProfile: mockGetProfile,
  },
}));

// Import buildLeaderboardEntry for verification
import { buildLeaderboardEntry } from '../../../shared/utils/leaderboardScoring';

describe('leaderboard write in updatePlayerStats', () => {
  it('fetches user profile and writes leaderboard entry when totalMatches reaches 5', async () => {
    mockGetProfile.mockResolvedValue({
      displayName: 'Alice Test',
      photoURL: 'https://photo.example.com/alice.jpg',
    });

    // matchRef check: not exists (new match)
    mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
    // Stats doc: exists with 4 matches (this will be the 5th)
    mockTransactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        schemaVersion: 1,
        totalMatches: 4,
        wins: 3,
        losses: 1,
        winRate: 0.75,
        currentStreak: { type: 'W', count: 2 },
        bestWinStreak: 3,
        singles: { matches: 4, wins: 3, losses: 1 },
        doubles: { matches: 0, wins: 0, losses: 0 },
        recentResults: [],
        tier: 'intermediate',
        tierConfidence: 'medium',
        tierUpdatedAt: Date.now(),
        lastPlayedAt: Date.now(),
        updatedAt: Date.now(),
        uniqueOpponentUids: ['opp-1', 'opp-2', 'opp-3'],
      }),
    });
    // Leaderboard doc: not exists yet
    mockTransactionGet.mockResolvedValueOnce({ exists: () => false });

    const match = makeMatch({ winningSide: 1 });
    await firestorePlayerStatsRepository.updatePlayerStats(
      'user-1', match, 1, 'win', 'scorer-uid', 'Alice Test', 'https://photo.example.com/alice.jpg',
    );

    // Should have a transaction.set call with compositeScore field (leaderboard write)
    const setCalls = mockTransactionSet.mock.calls;
    const leaderboardCall = setCalls.find(
      (call) => {
        const data = call[1] as Record<string, unknown>;
        return data && typeof data === 'object' && 'compositeScore' in data;
      }
    );
    expect(leaderboardCall).toBeDefined();
    expect((leaderboardCall![1] as Record<string, unknown>).displayName).toBe('Alice Test');
  });

  it('does not write leaderboard entry when totalMatches < 5', async () => {
    mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
    mockTransactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        schemaVersion: 1,
        totalMatches: 2,
        wins: 1,
        losses: 1,
        winRate: 0.5,
        currentStreak: { type: 'L', count: 1 },
        bestWinStreak: 1,
        singles: { matches: 2, wins: 1, losses: 1 },
        doubles: { matches: 0, wins: 0, losses: 0 },
        recentResults: [],
        tier: 'beginner',
        tierConfidence: 'low',
        tierUpdatedAt: Date.now(),
        lastPlayedAt: Date.now(),
        updatedAt: Date.now(),
        uniqueOpponentUids: ['opp-1'],
      }),
    });

    const match = makeMatch({ winningSide: 1 });
    await firestorePlayerStatsRepository.updatePlayerStats(
      'user-1', match, 1, 'win', 'scorer-uid', 'Bob', null,
    );

    // No transaction.set call should have compositeScore
    const setCalls = mockTransactionSet.mock.calls;
    const leaderboardCall = setCalls.find(
      (call) => {
        const data = call[1] as Record<string, unknown>;
        return data && typeof data === 'object' && 'compositeScore' in data;
      }
    );
    expect(leaderboardCall).toBeUndefined();
  });

  it('preserves createdAt from existing leaderboard entry', async () => {
    const existingCreatedAt = Date.now() - 100000;

    mockTransactionGet.mockResolvedValueOnce({ exists: () => false });
    mockTransactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        schemaVersion: 1,
        totalMatches: 10,
        wins: 7,
        losses: 3,
        winRate: 0.7,
        currentStreak: { type: 'W', count: 3 },
        bestWinStreak: 3,
        singles: { matches: 10, wins: 7, losses: 3 },
        doubles: { matches: 0, wins: 0, losses: 0 },
        recentResults: [],
        tier: 'advanced',
        tierConfidence: 'high',
        tierUpdatedAt: Date.now(),
        lastPlayedAt: Date.now(),
        updatedAt: Date.now(),
        uniqueOpponentUids: ['opp-1', 'opp-2', 'opp-3', 'opp-4', 'opp-5', 'opp-6'],
      }),
    });
    // Existing leaderboard doc
    mockTransactionGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ createdAt: existingCreatedAt }),
    });

    const match = makeMatch({ winningSide: 1 });
    await firestorePlayerStatsRepository.updatePlayerStats(
      'user-1', match, 1, 'win', 'scorer-uid', 'Charlie', null,
    );

    const setCalls = mockTransactionSet.mock.calls;
    const leaderboardCall = setCalls.find(
      (call) => {
        const data = call[1] as Record<string, unknown>;
        return data && typeof data === 'object' && 'compositeScore' in data;
      }
    );
    expect(leaderboardCall).toBeDefined();
    expect((leaderboardCall![1] as Record<string, unknown>).createdAt).toBe(existingCreatedAt);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: FAIL — signature mismatch, no leaderboard writes

**Step 3: Modify `updatePlayerStats` signature and add leaderboard write**

In `src/data/firebase/firestorePlayerStatsRepository.ts`:

1. Add import:
```typescript
import { buildLeaderboardEntry } from '../../shared/utils/leaderboardScoring';
```

2. Update `updatePlayerStats` signature — add `displayName` and `photoURL` after `scorerUid`:
```typescript
async updatePlayerStats(
  uid: string,
  match: Match,
  playerTeam: 1 | 2,
  result: 'win' | 'loss',
  scorerUid: string,
  displayName: string,       // NEW
  photoURL: string | null,   // NEW
  enrichment?: StatsEnrichment,
): Promise<void>
```

3. Inside the `runTransaction()` callback, after the existing `transaction.set(statsDoc, stats, { merge: true })` line, add:

```typescript
    // Write leaderboard entry if player qualifies (>= 5 matches)
    const leaderboardEntry = buildLeaderboardEntry(uid, displayName, photoURL, stats, now);
    if (leaderboardEntry) {
      const leaderboardDoc = doc(firestore, 'leaderboard', uid);
      const existingLeaderboard = await transaction.get(leaderboardDoc);
      if (existingLeaderboard.exists()) {
        leaderboardEntry.createdAt = existingLeaderboard.data()!.createdAt as number;
      }
      transaction.set(leaderboardDoc, leaderboardEntry);
    }
```

4. Update `processMatchCompletion` to fetch profiles and pass them through:

```typescript
async processMatchCompletion(match: Match, scorerUid: string): Promise<void> {
  const participants = await resolveParticipantUids(match, scorerUid);
  if (participants.length === 0) return;

  // ... existing tournament enrichment code ...

  // [NEW] Fetch user profiles for leaderboard denormalization
  const { firestoreUserRepository } = await import('./firestoreUserRepository');
  const profileMap = new Map<string, { displayName: string; photoURL: string | null }>();
  await Promise.allSettled(
    participants.map(async ({ uid }) => {
      const profile = await firestoreUserRepository.getProfile(uid);
      if (profile) {
        profileMap.set(uid, { displayName: profile.displayName, photoURL: profile.photoURL });
      }
    }),
  );

  await Promise.all(
    participants.map(({ uid, playerTeam, result }) => {
      const profile = profileMap.get(uid);
      return this.updatePlayerStats(
        uid, match, playerTeam, result, scorerUid,
        profile?.displayName ?? 'Unknown Player',  // NEW
        profile?.photoURL ?? null,                  // NEW
        { isTournamentMatch, participants, tierMap, fallbackTier },
      ).catch((err) => {
        console.warn('Stats update failed for user:', uid, err);
      });
    }),
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: PASS (all existing + 3 new tests)

**Step 5: Run full test suite for regressions**

Run: `npx vitest run`
Expected: All tests pass. If existing tests fail due to signature change, update their call sites to include `displayName` and `photoURL` params.

**Step 6: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts
git commit -m "feat(leaderboard): atomic leaderboard write in stats transaction

Fetch user profiles in processMatchCompletion, pass displayName/photoURL
to updatePlayerStats, write /leaderboard/{uid} when totalMatches >= 5"
```

---

### Task 4: Firestore Security Rules, Indexes & Rules Tests

**[REVISED]** Stronger rules (validate nested fields, immutable createdAt). Only 2 composite indexes (single-field auto-created). Added security rules tests.

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Create: `src/data/firebase/__tests__/leaderboard.rules.test.ts`

**Step 1: Add leaderboard security rules**

In `firestore.rules`, add before the closing `}` of the `match /databases/{database}/documents` block:

```
    // ── Leaderboard (/leaderboard/{uid}) ──────────────────────────────
    match /leaderboard/{uid} {
      allow read: if request.auth != null;

      allow create: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.displayName is string
        && request.resource.data.displayName.size() > 0
        && request.resource.data.displayName.size() < 256
        && request.resource.data.winRate is number
        && request.resource.data.winRate >= 0
        && request.resource.data.winRate <= 1
        && request.resource.data.compositeScore is number
        && request.resource.data.compositeScore >= 0
        && request.resource.data.compositeScore <= 100
        && request.resource.data.wins is number
        && request.resource.data.totalMatches is number
        && request.resource.data.wins <= request.resource.data.totalMatches
        && request.resource.data.tier in ['beginner', 'intermediate', 'advanced', 'expert']
        && request.resource.data.last30d is map
        && request.resource.data.last30d.winRate is number
        && request.resource.data.last30d.winRate >= 0
        && request.resource.data.last30d.winRate <= 1
        && request.resource.data.last30d.compositeScore is number
        && request.resource.data.last30d.compositeScore >= 0
        && request.resource.data.last30d.compositeScore <= 100;

      allow update: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.displayName is string
        && request.resource.data.displayName.size() > 0
        && request.resource.data.displayName.size() < 256
        && request.resource.data.winRate is number
        && request.resource.data.winRate >= 0
        && request.resource.data.winRate <= 1
        && request.resource.data.compositeScore is number
        && request.resource.data.compositeScore >= 0
        && request.resource.data.compositeScore <= 100
        && request.resource.data.wins is number
        && request.resource.data.totalMatches is number
        && request.resource.data.wins <= request.resource.data.totalMatches
        && request.resource.data.tier in ['beginner', 'intermediate', 'advanced', 'expert']
        && request.resource.data.last30d is map
        && request.resource.data.last30d.winRate is number
        && request.resource.data.last30d.winRate >= 0
        && request.resource.data.last30d.winRate <= 1
        && request.resource.data.last30d.compositeScore is number
        && request.resource.data.last30d.compositeScore >= 0
        && request.resource.data.last30d.compositeScore <= 100
        && request.resource.data.createdAt == resource.data.createdAt;

      allow delete: if request.auth != null && request.auth.uid == uid;
    }
```

**Step 2: Add composite indexes only**

**[REVISED]** Removed single-field indexes #1 and #2 — Firestore auto-creates these. Only add the 2 composite indexes needed for friends queries.

In `firestore.indexes.json`, add to the `indexes` array:

```json
    {
      "collectionGroup": "leaderboard",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "compositeScore", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "leaderboard",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "last30d.compositeScore", "order": "DESCENDING" }
      ]
    }
```

**Step 3: Write security rules tests**

**[REVISED]** Added per testing specialist review. Uses existing `@firebase/rules-unit-testing` (already in devDependencies).

```typescript
// src/data/firebase/__tests__/leaderboard.rules.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

let testEnv: RulesTestEnvironment;

const validEntry = {
  uid: 'user-1',
  displayName: 'Alice',
  photoURL: null,
  tier: 'intermediate',
  tierConfidence: 'medium',
  totalMatches: 10,
  wins: 6,
  winRate: 0.6,
  currentStreak: { type: 'W', count: 2 },
  compositeScore: 55,
  last30d: { totalMatches: 5, wins: 3, winRate: 0.6, compositeScore: 50 },
  lastPlayedAt: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'test-leaderboard-rules',
    firestore: {
      rules: readFileSync('./firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('leaderboard security rules', () => {
  it('allows authenticated user to read any leaderboard entry', async () => {
    const db = testEnv.authenticatedContext('reader').firestore();
    const ref = doc(db, 'leaderboard', 'user-1');
    await assertSucceeds(getDoc(ref));
  });

  it('denies unauthenticated read', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const ref = doc(db, 'leaderboard', 'user-1');
    await assertFails(getDoc(ref));
  });

  it('allows owner to create own leaderboard entry', async () => {
    const db = testEnv.authenticatedContext('user-1').firestore();
    const ref = doc(db, 'leaderboard', 'user-1');
    await assertSucceeds(setDoc(ref, validEntry));
  });

  it('denies write to another user leaderboard entry', async () => {
    const db = testEnv.authenticatedContext('user-1').firestore();
    const ref = doc(db, 'leaderboard', 'user-2');
    await assertFails(setDoc(ref, { ...validEntry, uid: 'user-2' }));
  });

  it('denies write when compositeScore > 100', async () => {
    const db = testEnv.authenticatedContext('user-1').firestore();
    const ref = doc(db, 'leaderboard', 'user-1');
    await assertFails(setDoc(ref, { ...validEntry, compositeScore: 101 }));
  });

  it('denies write when winRate > 1', async () => {
    const db = testEnv.authenticatedContext('user-1').firestore();
    const ref = doc(db, 'leaderboard', 'user-1');
    await assertFails(setDoc(ref, { ...validEntry, winRate: 1.5 }));
  });

  it('denies write when wins > totalMatches', async () => {
    const db = testEnv.authenticatedContext('user-1').firestore();
    const ref = doc(db, 'leaderboard', 'user-1');
    await assertFails(setDoc(ref, { ...validEntry, wins: 20, totalMatches: 10 }));
  });

  it('denies write with invalid tier', async () => {
    const db = testEnv.authenticatedContext('user-1').firestore();
    const ref = doc(db, 'leaderboard', 'user-1');
    await assertFails(setDoc(ref, { ...validEntry, tier: 'godmode' }));
  });

  it('denies write with empty displayName', async () => {
    const db = testEnv.authenticatedContext('user-1').firestore();
    const ref = doc(db, 'leaderboard', 'user-1');
    await assertFails(setDoc(ref, { ...validEntry, displayName: '' }));
  });

  it('allows owner to delete own leaderboard entry', async () => {
    const db = testEnv.authenticatedContext('user-1').firestore();
    const ref = doc(db, 'leaderboard', 'user-1');
    await assertSucceeds(deleteDoc(ref));
  });
});
```

**Step 4: Run rules tests**

Run: `npm run test:rules` (or the equivalent command that starts emulators and runs rules tests)
Expected: PASS (all 10 tests)

**Step 5: Commit**

```bash
git add firestore.rules firestore.indexes.json src/data/firebase/__tests__/leaderboard.rules.test.ts
git commit -m "feat(leaderboard): add security rules, indexes, and rules tests

Strong field validation, createdAt immutability on update, nested last30d
validation, 2 composite indexes for friends queries"
```

---

### Task 5: `useLeaderboard` Hook

**[REVISED]** Fixed friendUids (fetches from stats repo), added cache dedup, selective invalidation.

**Files:**
- Create: `src/features/leaderboard/hooks/useLeaderboard.ts`
- Create: `src/features/leaderboard/hooks/__tests__/useLeaderboard.test.ts`
- Reference: `src/shared/hooks/useAuth.ts`
- Reference: `src/data/firebase/firestorePlayerStatsRepository.ts` (for uniqueOpponentUids)

**Step 1: Write failing tests**

```typescript
// src/features/leaderboard/hooks/__tests__/useLeaderboard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetGlobalLeaderboard = vi.fn(() => Promise.resolve([]));
const mockGetFriendsLeaderboard = vi.fn(() => Promise.resolve([]));
const mockGetUserRank = vi.fn(() => Promise.resolve(1));
const mockGetUserEntry = vi.fn(() => Promise.resolve(null));

vi.mock('../../../../data/firebase/firestoreLeaderboardRepository', () => ({
  firestoreLeaderboardRepository: {
    getGlobalLeaderboard: mockGetGlobalLeaderboard,
    getFriendsLeaderboard: mockGetFriendsLeaderboard,
    getUserRank: mockGetUserRank,
    getUserEntry: mockGetUserEntry,
  },
}));

vi.mock('../../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'test-uid', displayName: 'Test User' }),
  }),
}));

import { useLeaderboard, invalidateLeaderboardCache } from '../useLeaderboard';

describe('useLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateLeaderboardCache();
  });

  it('exports useLeaderboard function', () => {
    expect(useLeaderboard).toBeDefined();
    expect(typeof useLeaderboard).toBe('function');
  });

  it('exports invalidateLeaderboardCache function', () => {
    expect(invalidateLeaderboardCache).toBeDefined();
    expect(typeof invalidateLeaderboardCache).toBe('function');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/leaderboard/hooks/__tests__/useLeaderboard.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the hook**

```typescript
// src/features/leaderboard/hooks/useLeaderboard.ts
import { createSignal, createResource } from 'solid-js';
import { useAuth } from '../../../shared/hooks/useAuth';
import { firestoreLeaderboardRepository } from '../../../data/firebase/firestoreLeaderboardRepository';
import type { LeaderboardEntry } from '../../../data/types';
import type { LeaderboardTimeframe } from '../../../data/firebase/firestoreLeaderboardRepository';

export type LeaderboardScope = 'global' | 'friends';
export type { LeaderboardTimeframe };

interface LeaderboardState {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userRank: number | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// [REVISED] Added fetching promise to prevent concurrent requests for same key
const cache = new Map<string, {
  data: LeaderboardState;
  fetchedAt: number;
  fetching?: Promise<LeaderboardState>;
}>();

function cacheKey(scope: LeaderboardScope, timeframe: LeaderboardTimeframe): string {
  return `leaderboard:${scope}:${timeframe}`;
}

// [REVISED] Selective cache invalidation
export function invalidateLeaderboardCache(
  scope?: LeaderboardScope,
  timeframe?: LeaderboardTimeframe,
): void {
  if (scope && timeframe) {
    cache.delete(cacheKey(scope, timeframe));
  } else {
    cache.clear();
  }
}

async function fetchLeaderboardData(
  scope: LeaderboardScope,
  timeframe: LeaderboardTimeframe,
  uid: string | undefined,
  friendUids: string[],
): Promise<LeaderboardState> {
  const key = cacheKey(scope, timeframe);
  const entry = cache.get(key);

  // Return in-flight request if one exists
  if (entry?.fetching) return entry.fetching;

  // Return cached if still valid
  if (entry && Date.now() - entry.fetchedAt <= CACHE_TTL_MS) return entry.data;

  // Start new fetch
  const promise = (async () => {
    let entries: LeaderboardEntry[];
    if (scope === 'friends') {
      entries = await firestoreLeaderboardRepository.getFriendsLeaderboard(friendUids, timeframe);
    } else {
      entries = await firestoreLeaderboardRepository.getGlobalLeaderboard(timeframe, 25);
    }

    let userEntry: LeaderboardEntry | null = null;
    let userRank: number | null = null;

    if (uid) {
      userEntry = await firestoreLeaderboardRepository.getUserEntry(uid);
      if (userEntry) {
        const score = timeframe === 'allTime'
          ? userEntry.compositeScore
          : userEntry.last30d.compositeScore;
        userRank = await firestoreLeaderboardRepository.getUserRank(uid, score, timeframe);
      }
    }

    const state: LeaderboardState = { entries, userEntry, userRank };
    cache.set(key, { data: state, fetchedAt: Date.now() });
    return state;
  })();

  // Store the fetching promise to prevent concurrent requests
  cache.set(key, { data: entry?.data ?? { entries: [], userEntry: null, userRank: null }, fetchedAt: entry?.fetchedAt ?? 0, fetching: promise });

  try {
    return await promise;
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}

export function useLeaderboard() {
  const { user } = useAuth();
  const [scope, setScope] = createSignal<LeaderboardScope>('global');
  const [timeframe, setTimeframe] = createSignal<LeaderboardTimeframe>('allTime');

  // [REVISED] friendUids fetched from user's stats (uniqueOpponentUids), capped at 30
  const [friendUids] = createResource(
    () => user()?.uid,
    async (uid) => {
      if (!uid) return [];
      const entry = await firestoreLeaderboardRepository.getUserEntry(uid);
      // If user has no leaderboard entry, we can't get friendUids from it.
      // Fetch from stats instead — dynamic import to avoid circular deps.
      const { firestorePlayerStatsRepository } = await import(
        '../../../data/firebase/firestorePlayerStatsRepository'
      );
      const stats = await firestorePlayerStatsRepository.getStatsSummary(uid);
      if (!stats) return [];
      // Cap at 30 (Firestore 'in' query limit)
      return stats.uniqueOpponentUids.slice(0, 30);
    },
  );

  // Use string cache key as resource source for stable identity comparison
  const [data] = createResource(
    () => `${scope()}:${timeframe()}:${user()?.uid ?? 'anon'}`,
    async (key) => {
      const [s, tf, uid] = key.split(':') as [LeaderboardScope, LeaderboardTimeframe, string];
      const resolvedUid = uid === 'anon' ? undefined : uid;
      const uids = s === 'friends' ? (friendUids() ?? []) : [];
      return fetchLeaderboardData(s, tf, resolvedUid, uids);
    },
  );

  return {
    entries: () => data()?.entries ?? [],
    userEntry: () => data()?.userEntry ?? null,
    userRank: () => data()?.userRank ?? null,
    loading: () => data.loading,
    scope,
    setScope,
    timeframe,
    setTimeframe,
  };
}
```

**Note for implementing agent:** Check if `firestorePlayerStatsRepository` already has a `getStatsSummary(uid)` method. If not, add one — it's a simple `getDoc` on `/users/{uid}/stats/summary`. The stats doc is owner-only read, but the hook only calls this for the current user's own UID, so the security rule passes.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/leaderboard/hooks/__tests__/useLeaderboard.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/leaderboard/hooks/useLeaderboard.ts src/features/leaderboard/hooks/__tests__/useLeaderboard.test.ts
git commit -m "feat(leaderboard): add useLeaderboard hook with cache dedup

Scope/timeframe toggles, friendUids from stats, 5-min cache with
in-flight dedup and selective invalidation"
```

---

### Task 6: Leaderboard UI Components

**Files:**
- Create: `src/features/leaderboard/components/Podium.tsx`
- Create: `src/features/leaderboard/components/RankingsList.tsx`
- Create: `src/features/leaderboard/components/UserRankCard.tsx`
- Create: `src/features/leaderboard/components/__tests__/Podium.test.tsx`
- Create: `src/features/leaderboard/components/__tests__/RankingsList.test.tsx`
- Create: `src/features/leaderboard/components/__tests__/UserRankCard.test.tsx`
- Reference: `src/features/profile/components/TierBadge.tsx`
- Reference: `src/shared/components/EmptyState.tsx`

**Step 1: Write failing tests for Podium**

```typescript
// src/features/leaderboard/components/__tests__/Podium.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import Podium from '../Podium';
import { makeLeaderboardEntry } from '../../../../test/factories';

describe('Podium', () => {
  it('renders top 3 entries with correct names', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u1', displayName: 'Gold', compositeScore: 90 }),
      makeLeaderboardEntry({ uid: 'u2', displayName: 'Silver', compositeScore: 80 }),
      makeLeaderboardEntry({ uid: 'u3', displayName: 'Bronze', compositeScore: 70 }),
    ];

    const { getByText } = render(() => <Podium entries={entries} />);
    expect(getByText('Gold')).toBeDefined();
    expect(getByText('Silver')).toBeDefined();
    expect(getByText('Bronze')).toBeDefined();
  });

  it('renders rank labels for each position', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u1', displayName: 'First' }),
      makeLeaderboardEntry({ uid: 'u2', displayName: 'Second' }),
      makeLeaderboardEntry({ uid: 'u3', displayName: 'Third' }),
    ];

    const { getByText } = render(() => <Podium entries={entries} />);
    expect(getByText('#1')).toBeDefined();
    expect(getByText('#2')).toBeDefined();
    expect(getByText('#3')).toBeDefined();
  });

  it('handles fewer than 3 entries gracefully', () => {
    const entries = [makeLeaderboardEntry({ uid: 'u1', displayName: 'Only One' })];
    const { getByText } = render(() => <Podium entries={entries} />);
    expect(getByText('Only One')).toBeDefined();
  });

  it('shows composite score for each entry', () => {
    const entries = [
      makeLeaderboardEntry({ uid: 'u1', displayName: 'A', compositeScore: 85.5 }),
    ];
    const { container } = render(() => <Podium entries={entries} />);
    expect(container.textContent).toContain('85.5');
  });
});
```

**Step 2: Implement Podium**

```tsx
// src/features/leaderboard/components/Podium.tsx
import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { Trophy, Medal, Award } from 'lucide-solid';
import type { LeaderboardEntry } from '../../../data/types';
import TierBadge from '../../profile/components/TierBadge';

interface PodiumProps {
  entries: LeaderboardEntry[];
}

const RANK_STYLES = [
  { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  { icon: Medal, color: 'text-slate-300', bg: 'bg-slate-300/10', border: 'border-slate-300/30' },
  { icon: Award, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
];

const Podium: Component<PodiumProps> = (props) => {
  return (
    <div class="grid grid-cols-3 gap-2 px-4">
      <For each={props.entries.slice(0, 3)}>
        {(entry, index) => {
          const style = RANK_STYLES[index()];
          const Icon = style.icon;

          return (
            <div
              class={`flex flex-col items-center gap-2 rounded-xl p-3 border ${style.bg} ${style.border} ${
                index() === 0 ? 'scale-105' : ''
              }`}
            >
              <div class={`flex items-center gap-1 ${style.color} font-bold text-sm`}>
                <Icon size={16} />
                <span>#{index() + 1}</span>
              </div>

              <Show
                when={entry.photoURL}
                fallback={
                  <div class="w-10 h-10 rounded-full bg-surface-lighter flex items-center justify-center text-on-surface-muted font-bold text-sm">
                    {entry.displayName.charAt(0).toUpperCase()}
                  </div>
                }
              >
                <img src={entry.photoURL!} alt={entry.displayName} class="w-10 h-10 rounded-full object-cover" />
              </Show>

              <span class="text-on-surface text-xs font-medium text-center truncate w-full">
                {entry.displayName}
              </span>

              <TierBadge tier={entry.tier} confidence={entry.tierConfidence} />

              <span class={`text-lg font-bold ${style.color}`}>
                {entry.compositeScore.toFixed(1)}
              </span>
            </div>
          );
        }}
      </For>
    </div>
  );
};

export default Podium;
```

**Step 3: Write failing tests for RankingsList, implement, verify**

(Same pattern as original plan — use `makeLeaderboardEntry` from shared factory. See Podium above for the pattern.)

**Step 4: Write failing tests for UserRankCard, implement, verify**

(Same pattern — use shared factory.)

**Step 5: Run all component tests**

Run: `npx vitest run src/features/leaderboard/components/__tests__/`
Expected: PASS (all 13 tests across 3 files)

**Step 6: Commit**

```bash
git add src/features/leaderboard/components/
git commit -m "feat(leaderboard): add Podium, RankingsList, and UserRankCard components

Top 3 podium with medals, rankings list with streak/winRate, user rank card"
```

---

### Task 7: LeaderboardTab + PlayersPage Tabs

**[REVISED]** Full ARIA tab semantics (tabpanel, aria-controls, aria-labelledby, keyboard nav). Eager import instead of lazy (avoids Suspense flash). Toggle pill groups wrapped with `role="group"`.

**Files:**
- Create: `src/features/leaderboard/components/LeaderboardTab.tsx`
- Create: `src/features/leaderboard/components/__tests__/LeaderboardTab.test.tsx`
- Modify: `src/features/players/PlayersPage.tsx`
- Create: `src/features/players/__tests__/PlayersPage.test.tsx`

**Step 1: Write failing tests for LeaderboardTab**

```typescript
// src/features/leaderboard/components/__tests__/LeaderboardTab.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import LeaderboardTab from '../LeaderboardTab';

vi.mock('../../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'test-uid', displayName: 'Test User' }),
  }),
}));

vi.mock('../../hooks/useLeaderboard', () => ({
  useLeaderboard: () => ({
    entries: () => [],
    userEntry: () => null,
    userRank: () => null,
    loading: () => false,
    scope: () => 'global',
    setScope: vi.fn(),
    timeframe: () => 'allTime',
    setTimeframe: vi.fn(),
  }),
}));

describe('LeaderboardTab', () => {
  it('renders scope toggle group with Global and Friends', () => {
    const { getByText, getByRole } = render(() => <LeaderboardTab />);
    expect(getByText('Global')).toBeDefined();
    expect(getByText('Friends')).toBeDefined();
    // [REVISED] Toggle group has accessible label
    expect(getByRole('group', { name: /scope/i })).toBeDefined();
  });

  it('renders timeframe toggle group with All Time and Last 30 Days', () => {
    const { getByText, getByRole } = render(() => <LeaderboardTab />);
    expect(getByText('All Time')).toBeDefined();
    expect(getByText('Last 30 Days')).toBeDefined();
    expect(getByRole('group', { name: /timeframe/i })).toBeDefined();
  });

  it('shows empty state when no entries', () => {
    const { getByText } = render(() => <LeaderboardTab />);
    expect(getByText(/No rankings yet/)).toBeDefined();
  });
});
```

**Step 2: Implement LeaderboardTab**

```tsx
// src/features/leaderboard/components/LeaderboardTab.tsx
import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { Trophy } from 'lucide-solid';
import { useLeaderboard } from '../hooks/useLeaderboard';
import type { LeaderboardScope, LeaderboardTimeframe } from '../hooks/useLeaderboard';
import { useAuth } from '../../../shared/hooks/useAuth';
import EmptyState from '../../../shared/components/EmptyState';
import Podium from './Podium';
import RankingsList from './RankingsList';
import UserRankCard from './UserRankCard';

const LeaderboardTab: Component = () => {
  const { user } = useAuth();
  const leaderboard = useLeaderboard();

  const topThree = () => leaderboard.entries().slice(0, 3);
  const restEntries = () => leaderboard.entries().slice(3);

  return (
    <div class="space-y-4 pb-4">
      {/* [REVISED] Scope toggle with role="group" */}
      <div class="flex gap-2 px-4" role="group" aria-label="Leaderboard scope">
        <TogglePill
          label="Global"
          active={leaderboard.scope() === 'global'}
          onClick={() => leaderboard.setScope('global')}
        />
        <TogglePill
          label="Friends"
          active={leaderboard.scope() === 'friends'}
          onClick={() => leaderboard.setScope('friends')}
          disabled={!user()}
        />
      </div>

      {/* [REVISED] Timeframe toggle with role="group" */}
      <div class="flex gap-2 px-4" role="group" aria-label="Leaderboard timeframe">
        <TogglePill
          label="All Time"
          active={leaderboard.timeframe() === 'allTime'}
          onClick={() => leaderboard.setTimeframe('allTime')}
        />
        <TogglePill
          label="Last 30 Days"
          active={leaderboard.timeframe() === 'last30d'}
          onClick={() => leaderboard.setTimeframe('last30d')}
        />
      </div>

      <Show when={!leaderboard.loading()} fallback={<LoadingSkeleton />}>
        <Show
          when={leaderboard.entries().length > 0}
          fallback={
            <EmptyState
              icon={<Trophy size={32} />}
              title="No rankings yet"
              description="Play matches to start building the leaderboard."
            />
          }
        >
          <Show when={topThree().length > 0}>
            <Podium entries={topThree()} />
          </Show>

          <UserRankCard
            entry={leaderboard.userEntry()}
            rank={leaderboard.userRank()}
            signedOut={!user()}
          />

          <Show when={restEntries().length > 0}>
            <RankingsList
              entries={restEntries()}
              startRank={4}
              currentUserUid={user()?.uid}
            />
          </Show>
        </Show>
      </Show>
    </div>
  );
};

interface TogglePillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const TogglePill: Component<TogglePillProps> = (props) => {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      aria-pressed={props.active}
      class={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
        props.active
          ? 'bg-primary text-on-primary'
          : 'bg-surface-light text-on-surface-muted border border-border'
      } ${props.disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.97]'}`}
    >
      {props.label}
    </button>
  );
};

const LoadingSkeleton: Component = () => {
  return (
    <div class="space-y-3 px-4 animate-pulse">
      <div class="grid grid-cols-3 gap-2">
        <div class="h-32 bg-surface-light rounded-xl" />
        <div class="h-36 bg-surface-light rounded-xl" />
        <div class="h-32 bg-surface-light rounded-xl" />
      </div>
      <div class="h-16 bg-surface-light rounded-xl" />
      <div class="space-y-1">
        <div class="h-14 bg-surface-light rounded-lg" />
        <div class="h-14 bg-surface-light rounded-lg" />
        <div class="h-14 bg-surface-light rounded-lg" />
      </div>
    </div>
  );
};

export default LeaderboardTab;
```

**Step 3: Modify PlayersPage to add tabs with full ARIA**

**[REVISED]** Eager import (no lazy), full ARIA tab semantics, keyboard navigation.

```tsx
// src/features/players/PlayersPage.tsx
import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import AddPlayerForm from './components/AddPlayerForm';
import PlayerCard from './components/PlayerCard';
import EmptyState from '../../shared/components/EmptyState';
import { Users } from 'lucide-solid';
import { useLiveQuery } from '../../data/useLiveQuery';
import { playerRepository } from '../../data/repositories/playerRepository';
import LeaderboardTab from '../leaderboard/components/LeaderboardTab';

type Tab = 'players' | 'leaderboard';
const TABS: Tab[] = ['players', 'leaderboard'];

const PlayersPage: Component = () => {
  const { data: players } = useLiveQuery(() => playerRepository.getAll());
  const [activeTab, setActiveTab] = createSignal<Tab>('players');

  // [REVISED] Keyboard navigation for tabs
  const handleTabKeydown = (e: KeyboardEvent) => {
    const current = TABS.indexOf(activeTab());
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveTab(TABS[(current + 1) % TABS.length]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveTab(TABS[(current - 1 + TABS.length) % TABS.length]);
    }
  };

  return (
    <PageLayout title="Players">
      {/* [REVISED] Full ARIA tab semantics */}
      <div
        class="flex border-b border-surface-lighter sticky top-0 bg-surface z-10"
        role="tablist"
        onKeyDown={handleTabKeydown}
      >
        <button
          id="tab-players"
          role="tab"
          aria-selected={activeTab() === 'players'}
          aria-controls="panel-players"
          tabIndex={activeTab() === 'players' ? 0 : -1}
          onClick={() => setActiveTab('players')}
          class={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
            activeTab() === 'players'
              ? 'text-primary border-primary'
              : 'text-on-surface-muted border-transparent'
          }`}
        >
          Players
        </button>
        <button
          id="tab-leaderboard"
          role="tab"
          aria-selected={activeTab() === 'leaderboard'}
          aria-controls="panel-leaderboard"
          tabIndex={activeTab() === 'leaderboard' ? 0 : -1}
          onClick={() => setActiveTab('leaderboard')}
          class={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${
            activeTab() === 'leaderboard'
              ? 'text-primary border-primary'
              : 'text-on-surface-muted border-transparent'
          }`}
        >
          Leaderboard
        </button>
      </div>

      <Show when={activeTab() === 'players'}>
        <div id="panel-players" role="tabpanel" aria-labelledby="tab-players" class="p-4 space-y-4">
          <Show
            when={players() && players()!.length > 0}
            fallback={
              <>
                <AddPlayerForm />
                <EmptyState
                  icon={<Users size={32} />}
                  title="No Players Yet"
                  description="Add players to track individual stats and win/loss records."
                />
              </>
            }
          >
            <div class="md:grid md:grid-cols-2 md:gap-6 space-y-4 md:space-y-0">
              <div>
                <AddPlayerForm />
              </div>
              <ul role="list" class="space-y-2 list-none p-0 m-0">
                <For each={players()}>
                  {(player) => <li><PlayerCard player={player} /></li>}
                </For>
              </ul>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={activeTab() === 'leaderboard'}>
        <div id="panel-leaderboard" role="tabpanel" aria-labelledby="tab-leaderboard" class="pt-4">
          <LeaderboardTab />
        </div>
      </Show>
    </PageLayout>
  );
};

export default PlayersPage;
```

**Step 4: Write PlayersPage tab tests**

```typescript
// src/features/players/__tests__/PlayersPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

vi.mock('../../../data/useLiveQuery', () => ({
  useLiveQuery: () => ({ data: () => [], error: () => undefined }),
}));

vi.mock('../../leaderboard/components/LeaderboardTab', () => ({
  default: () => <div data-testid="leaderboard-tab">Leaderboard Content</div>,
}));

import PlayersPage from '../PlayersPage';

describe('PlayersPage tabs', () => {
  it('renders Players and Leaderboard tabs', () => {
    const { getByRole } = render(() => <PlayersPage />);
    expect(getByRole('tab', { name: 'Players' })).toBeDefined();
    expect(getByRole('tab', { name: 'Leaderboard' })).toBeDefined();
  });

  it('shows Players content by default', () => {
    const { getByRole } = render(() => <PlayersPage />);
    const playersTab = getByRole('tab', { name: 'Players' });
    expect(playersTab.getAttribute('aria-selected')).toBe('true');
    expect(getByRole('tabpanel', { name: 'Players' })).toBeDefined();
  });

  it('switches to Leaderboard tab on click', async () => {
    const { getByRole, getByTestId } = render(() => <PlayersPage />);
    const leaderboardTab = getByRole('tab', { name: 'Leaderboard' });
    await fireEvent.click(leaderboardTab);

    expect(leaderboardTab.getAttribute('aria-selected')).toBe('true');
    expect(getByTestId('leaderboard-tab')).toBeDefined();
  });

  it('supports keyboard navigation between tabs', async () => {
    const { getByRole } = render(() => <PlayersPage />);
    const playersTab = getByRole('tab', { name: 'Players' });
    playersTab.focus();

    await fireEvent.keyDown(playersTab, { key: 'ArrowRight' });
    const leaderboardTab = getByRole('tab', { name: 'Leaderboard' });
    expect(leaderboardTab.getAttribute('aria-selected')).toBe('true');
  });

  it('has correct ARIA attributes on tabpanels', async () => {
    const { getByRole } = render(() => <PlayersPage />);
    const panel = getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe('tab-players');
    expect(panel.getAttribute('id')).toBe('panel-players');
  });
});
```

**Step 5: Run all tests**

Run: `npx vitest run src/features/leaderboard/components/__tests__/LeaderboardTab.test.tsx src/features/players/__tests__/PlayersPage.test.tsx`
Expected: PASS (all tests)

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardTab.tsx src/features/leaderboard/components/__tests__/LeaderboardTab.test.tsx src/features/players/PlayersPage.tsx src/features/players/__tests__/PlayersPage.test.tsx
git commit -m "feat(leaderboard): add LeaderboardTab and PlayersPage tab navigation

Full ARIA tab semantics, keyboard nav, scope/timeframe toggle groups,
eager import (no lazy flash)"
```

---

### Task 8: E2E Tests

**[REVISED]** Uses existing `signInAsTestUser` helper, `seedFirestoreDocAdmin`, E2E factories, and fixtures from `e2e/helpers/`.

**Files:**
- Create: `e2e/leaderboard.spec.ts`
- Reference: `e2e/helpers/emulator-auth.ts` (signInAsTestUser, seedFirestoreDocAdmin)
- Reference: `e2e/helpers/factories.ts` (makeUserProfile, makeStatsSummary)
- Reference: `e2e/fixtures.ts` (testUserEmail fixture)

**Step 1: Write E2E tests**

```typescript
// e2e/leaderboard.spec.ts
import { test, expect } from '@playwright/test';
import { signInAsTestUser, clearEmulators } from './helpers/emulator-auth';

test.describe('Leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5199/players');
  });

  test('shows Players and Leaderboard tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Players' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Leaderboard' })).toBeVisible();
  });

  test('Players tab is selected by default', async ({ page }) => {
    const playersTab = page.getByRole('tab', { name: 'Players' });
    await expect(playersTab).toHaveAttribute('aria-selected', 'true');
  });

  test('switches to Leaderboard tab and shows empty state', async ({ page }) => {
    await page.getByRole('tab', { name: 'Leaderboard' }).click();
    await expect(page.getByText('No rankings yet')).toBeVisible();
  });

  test('Leaderboard tab shows scope and timeframe toggles', async ({ page }) => {
    await page.getByRole('tab', { name: 'Leaderboard' }).click();
    await expect(page.getByRole('button', { name: 'Global' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Friends' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All Time' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Last 30 Days' })).toBeVisible();
  });

  test('Friends button is disabled when not signed in', async ({ page }) => {
    await page.getByRole('tab', { name: 'Leaderboard' }).click();
    const friendsBtn = page.getByRole('button', { name: 'Friends' });
    await expect(friendsBtn).toBeDisabled();
  });

  test('Friends button is enabled after sign-in', async ({ page }) => {
    const email = `e2e-lb-${Date.now()}@test.com`;
    await signInAsTestUser(page, { email, displayName: 'LB Tester' });
    await page.goto('http://localhost:5199/players');
    await page.getByRole('tab', { name: 'Leaderboard' }).click();

    const friendsBtn = page.getByRole('button', { name: 'Friends' });
    await expect(friendsBtn).toBeEnabled();
  });
});
```

**Step 2: Run E2E tests**

Run: `npx playwright test e2e/leaderboard.spec.ts`
Expected: Tests pass against dev server + Firebase emulators

**Step 3: Commit**

```bash
git add e2e/leaderboard.spec.ts
git commit -m "test(leaderboard): add E2E tests for tab navigation and toggles

Tab switching, empty state, scope/timeframe visibility, auth gating"
```

---

### Task 9: Final Verification & Cleanup

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Run E2E tests**

Run: `npx playwright test`
Expected: All E2E tests pass (including new leaderboard tests)

**Step 4: Run security rules tests**

Run: `npm run test:rules`
Expected: All rules tests pass

**Step 5: Build check**

Run: `npx vite build`
Expected: Successful build

**Step 6: Manual smoke test**

Start dev server (`npx vite --port 5199`) and verify:
1. Navigate to `/players` — two tabs visible
2. Click "Leaderboard" tab — shows empty state
3. Click "Global" / "Friends" toggles — Friends disabled when signed out
4. Click "All Time" / "Last 30 Days" toggles
5. Tab keyboard navigation (ArrowLeft/ArrowRight)
6. No console errors

**Step 7: Final commit if cleanup needed**

```bash
git add -A
git commit -m "chore(leaderboard): wave C verification cleanup"
```
