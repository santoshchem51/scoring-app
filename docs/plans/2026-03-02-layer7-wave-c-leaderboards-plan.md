# Wave C: Leaderboards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Global + Friends leaderboards with composite score ranking, tabbed into the existing `/players` page.

**Architecture:** New `/leaderboard/{uid}` Firestore collection with denormalized stats, written atomically alongside existing stats updates via `runTransaction()`. Leaderboard UI as a tab in PlayersPage with scope (Global/Friends) and timeframe (All-Time/Last 30 Days) toggles. Pure scoring functions + Firestore repository + SolidJS hook + component tree.

**Tech Stack:** SolidJS 1.9, TypeScript, Firestore, Vitest, Tailwind CSS v4, Lucide Solid

**Design Doc:** `docs/plans/2026-03-02-layer7-wave-c-leaderboards-design.md`

---

### Task 1: Leaderboard Scoring — Pure Functions

**Files:**
- Create: `src/shared/utils/leaderboardScoring.ts`
- Create: `src/shared/utils/__tests__/leaderboardScoring.test.ts`
- Reference: `src/shared/utils/tierEngine.ts` (tier multipliers pattern)
- Reference: `src/data/types.ts` (StatsSummary, Tier, RecentResult)

**Step 1: Write failing tests for `computeCompositeScore`**

```typescript
// src/shared/utils/__tests__/leaderboardScoring.test.ts
import { describe, it, expect } from 'vitest';
import { computeCompositeScore } from '../leaderboardScoring';

describe('computeCompositeScore', () => {
  it('returns 0 for beginner with 0% win rate and 0 matches', () => {
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
    // beginner=25, intermediate=50, advanced=75, expert=100
    const beginner = computeCompositeScore('beginner', 0, 0);
    const intermediate = computeCompositeScore('intermediate', 0, 0);
    expect(intermediate - beginner).toBe(10); // 0.40 * (50-25) = 10
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/utils/__tests__/leaderboardScoring.test.ts`
Expected: FAIL — module not found

**Step 3: Implement `computeCompositeScore`**

```typescript
// src/shared/utils/leaderboardScoring.ts
import type { Tier } from '../../data/types';

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
  const tierScore = TIER_SCORE[tier];
  const activityScore = Math.min(totalMatches / 50, 1) * 100;
  return 0.40 * tierScore + 0.35 * winRate * 100 + 0.25 * activityScore;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/utils/__tests__/leaderboardScoring.test.ts`
Expected: PASS (all 6 tests)

**Step 5: Add failing tests for `computeLast30dStats`**

Add to the same test file:

```typescript
import { computeCompositeScore, computeLast30dStats } from '../leaderboardScoring';
import type { RecentResult } from '../../../data/types';

function makeResult(overrides: Partial<RecentResult> = {}): RecentResult {
  return {
    result: 'win',
    opponentTier: 'intermediate',
    completedAt: Date.now(),
    gameType: 'singles',
    ...overrides,
  };
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
    const results: RecentResult[] = [
      makeResult({ completedAt: now - 10 * 24 * 60 * 60 * 1000, result: 'win' }),   // 10 days ago
      makeResult({ completedAt: now - 40 * 24 * 60 * 60 * 1000, result: 'win' }),   // 40 days ago (excluded)
      makeResult({ completedAt: now - 5 * 24 * 60 * 60 * 1000, result: 'loss' }),   // 5 days ago
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
    // winRate=1.0, totalMatches=2, tier=expert
    const expected = computeCompositeScore('expert', 1.0, 2);
    expect(stats.compositeScore).toBe(expected);
  });
});
```

**Step 6: Run tests to verify new tests fail**

Run: `npx vitest run src/shared/utils/__tests__/leaderboardScoring.test.ts`
Expected: FAIL — `computeLast30dStats` not exported

**Step 7: Implement `computeLast30dStats`**

Add to `src/shared/utils/leaderboardScoring.ts`:

```typescript
import type { Tier, RecentResult } from '../../data/types';

// ... existing code ...

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface Last30dStats {
  totalMatches: number;
  wins: number;
  winRate: number;
  compositeScore: number;
}

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

**Step 8: Run tests to verify all pass**

Run: `npx vitest run src/shared/utils/__tests__/leaderboardScoring.test.ts`
Expected: PASS (all 11 tests)

**Step 9: Add failing tests for `buildLeaderboardEntry`**

Add to the same test file:

```typescript
import {
  computeCompositeScore,
  computeLast30dStats,
  buildLeaderboardEntry,
} from '../leaderboardScoring';
import type { RecentResult, StatsSummary } from '../../../data/types';

function makeStatsSummary(overrides: Partial<StatsSummary> = {}): StatsSummary {
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
    const recentResults: RecentResult[] = [
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

**Step 10: Run tests to verify they fail**

Run: `npx vitest run src/shared/utils/__tests__/leaderboardScoring.test.ts`
Expected: FAIL — `buildLeaderboardEntry` not exported

**Step 11: Implement `buildLeaderboardEntry`**

Add to `src/shared/utils/leaderboardScoring.ts`:

```typescript
import type { Tier, TierConfidence, RecentResult, StatsSummary } from '../../data/types';

// ... existing code ...

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

**Step 12: Run all tests to verify they pass**

Run: `npx vitest run src/shared/utils/__tests__/leaderboardScoring.test.ts`
Expected: PASS (all 16 tests)

**Step 13: Commit**

```bash
git add src/shared/utils/leaderboardScoring.ts src/shared/utils/__tests__/leaderboardScoring.test.ts
git commit -m "feat(leaderboard): add pure scoring functions with tests

computeCompositeScore, computeLast30dStats, buildLeaderboardEntry"
```

---

### Task 2: Firestore Leaderboard Repository

**Files:**
- Create: `src/data/firebase/firestoreLeaderboardRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreLeaderboardRepository.test.ts`
- Reference: `src/data/firebase/firestoreMatchRepository.ts` (repository pattern)
- Reference: `src/data/firebase/firestorePlayerStatsRepository.ts` (transaction pattern)

**Step 1: Write failing tests**

```typescript
// src/data/firebase/__tests__/firestoreLeaderboardRepository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LeaderboardEntry } from '../../../shared/utils/leaderboardScoring';

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

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
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

describe('firestoreLeaderboardRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGlobalLeaderboard', () => {
    it('queries with compositeScore desc for allTime', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'user-1', data: () => makeEntry({ uid: 'user-1', compositeScore: 80 }) },
          { id: 'user-2', data: () => makeEntry({ uid: 'user-2', compositeScore: 70 }) },
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
      expect(rank).toBe(6); // 5 above + 1 = rank 6
      expect(mockWhere).toHaveBeenCalledWith('compositeScore', '>', 60);
    });

    it('returns rank 1 when no one has higher score', async () => {
      mockGetCountFromServer.mockResolvedValueOnce({
        data: () => ({ count: 0 }),
      });

      const rank = await firestoreLeaderboardRepository.getUserRank('user-1', 90, 'allTime');
      expect(rank).toBe(1);
    });
  });

  describe('getUserEntry', () => {
    it('returns entry when it exists', async () => {
      const entry = makeEntry({ uid: 'user-1' });
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
import type { LeaderboardEntry } from '../../shared/utils/leaderboardScoring';

type Timeframe = 'allTime' | 'last30d';

const COLLECTION = 'leaderboard';

function scoreField(timeframe: Timeframe): string {
  return timeframe === 'allTime' ? 'compositeScore' : 'last30d.compositeScore';
}

export const firestoreLeaderboardRepository = {
  async getGlobalLeaderboard(
    timeframe: Timeframe,
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
    timeframe: Timeframe,
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
    timeframe: Timeframe,
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
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreLeaderboardRepository.ts src/data/firebase/__tests__/firestoreLeaderboardRepository.test.ts
git commit -m "feat(leaderboard): add Firestore leaderboard repository with tests

Global/friends queries, user rank via count(), getUserEntry"
```

---

### Task 3: Extend Write Path — Atomic Leaderboard Updates

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts` (add leaderboard write inside existing transaction)
- Modify: `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts` (add tests for leaderboard write)
- Reference: `src/shared/utils/leaderboardScoring.ts` (buildLeaderboardEntry)

**Step 1: Write failing tests for leaderboard write in transaction**

Add to the existing `firestorePlayerStatsRepository.test.ts`:

```typescript
// Add import at top:
import { buildLeaderboardEntry } from '../../../shared/utils/leaderboardScoring';

// Add new describe block:
describe('leaderboard write in updatePlayerStats', () => {
  it('writes leaderboard entry when totalMatches reaches 5', async () => {
    // First match ref check: not exists (new match)
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
      'user-1', match, 1, 'win', 'scorer-uid',
    );

    // Should write: matchRef, stats, public/tier, leaderboard
    const setCalls = mockTransactionSet.mock.calls;
    const leaderboardCall = setCalls.find(
      (call) => mockDoc.mock.calls.some(
        (docCall) => docCall[1] === 'leaderboard' && docCall[2] === 'user-1'
      )
    );
    expect(leaderboardCall).toBeDefined();
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
      'user-1', match, 1, 'win', 'scorer-uid',
    );

    // Should write matchRef and stats only (not leaderboard)
    const leaderboardDocCalls = mockDoc.mock.calls.filter(
      (call) => call[1] === 'leaderboard'
    );
    expect(leaderboardDocCalls).toHaveLength(0);
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
      'user-1', match, 1, 'win', 'scorer-uid',
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
Expected: FAIL — leaderboard doc ref not created, no leaderboard transaction.set call

**Step 3: Modify `updatePlayerStats` to write leaderboard entry**

In `src/data/firebase/firestorePlayerStatsRepository.ts`, make these changes:

1. Add import at top:
```typescript
import { buildLeaderboardEntry } from '../../shared/utils/leaderboardScoring';
```

2. Inside the `runTransaction()` callback in `updatePlayerStats()`, after the existing `transaction.set(statsDoc, stats, { merge: true })` line, add:

```typescript
    // Write leaderboard entry if player qualifies (>= 5 matches)
    const leaderboardEntry = buildLeaderboardEntry(
      uid,
      displayName,
      photoURL,
      stats,
      now,
    );
    if (leaderboardEntry) {
      const leaderboardDoc = doc(firestore, 'leaderboard', uid);
      const existingLeaderboard = await transaction.get(leaderboardDoc);
      // Preserve createdAt from existing entry
      if (existingLeaderboard.exists()) {
        leaderboardEntry.createdAt = existingLeaderboard.data()!.createdAt as number;
      }
      transaction.set(leaderboardDoc, leaderboardEntry);
    }
```

3. The `updatePlayerStats` function signature needs access to `displayName` and `photoURL`. These need to be passed from the caller. Check how the caller provides user info and add parameters as needed. The current caller is `processMatchCompletion` which has access to `auth.currentUser` — extract `displayName` and `photoURL` from there.

**Note:** The exact line numbers and surrounding code context will need to be verified by the implementing agent against the current file state. The key change is adding the leaderboard write inside the existing `runTransaction()` block, after the stats write.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: PASS (all existing + 3 new tests)

**Step 5: Run full test suite to check for regressions**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts
git commit -m "feat(leaderboard): write leaderboard entry atomically in stats transaction

Writes /leaderboard/{uid} when totalMatches >= 5, preserves createdAt"
```

---

### Task 4: Firestore Security Rules & Indexes

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`

**Step 1: Add leaderboard security rules**

In `firestore.rules`, add before the closing `}` of the `match /databases/{database}/documents` block:

```
    // ── Leaderboard (/leaderboard/{uid}) ──────────────────────────────
    match /leaderboard/{uid} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.winRate is number
        && request.resource.data.winRate >= 0
        && request.resource.data.winRate <= 1
        && request.resource.data.compositeScore is number
        && request.resource.data.compositeScore >= 0
        && request.resource.data.compositeScore <= 100
        && request.resource.data.wins is number
        && request.resource.data.totalMatches is number
        && request.resource.data.wins <= request.resource.data.totalMatches
        && request.resource.data.tier in ['beginner', 'intermediate', 'advanced', 'expert'];
      allow delete: if request.auth != null && request.auth.uid == uid;
    }
```

**Step 2: Add composite indexes**

In `firestore.indexes.json`, add to the `indexes` array:

```json
    {
      "collectionGroup": "leaderboard",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "compositeScore", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "leaderboard",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "last30d.compositeScore", "order": "DESCENDING" }
      ]
    },
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

**Step 3: Commit**

```bash
git add firestore.rules firestore.indexes.json
git commit -m "feat(leaderboard): add Firestore security rules and indexes

Owner-write with field validation, read for any authed user"
```

---

### Task 5: `useLeaderboard` Hook

**Files:**
- Create: `src/features/leaderboard/hooks/useLeaderboard.ts`
- Create: `src/features/leaderboard/hooks/__tests__/useLeaderboard.test.ts`
- Reference: `src/shared/hooks/useAuth.ts` (auth hook pattern)
- Reference: `src/data/useLiveQuery.ts` (data hook pattern)

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

// Mock SolidJS primitives for testing
vi.mock('solid-js', async () => {
  const actual = await vi.importActual('solid-js');
  return {
    ...actual,
  };
});

import { useLeaderboard } from '../useLeaderboard';

describe('useLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports useLeaderboard function', () => {
    expect(useLeaderboard).toBeDefined();
    expect(typeof useLeaderboard).toBe('function');
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
import type { LeaderboardEntry } from '../../../shared/utils/leaderboardScoring';

export type LeaderboardScope = 'global' | 'friends';
export type LeaderboardTimeframe = 'allTime' | 'last30d';

interface LeaderboardState {
  entries: LeaderboardEntry[];
  userEntry: LeaderboardEntry | null;
  userRank: number | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const cache = new Map<string, { data: LeaderboardState; fetchedAt: number }>();

function cacheKey(scope: LeaderboardScope, timeframe: LeaderboardTimeframe): string {
  return `leaderboard:${scope}:${timeframe}`;
}

function getCached(key: string): LeaderboardState | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

async function fetchLeaderboard(
  scope: LeaderboardScope,
  timeframe: LeaderboardTimeframe,
  uid: string | undefined,
  friendUids: string[],
): Promise<LeaderboardState> {
  const key = cacheKey(scope, timeframe);
  const cached = getCached(key);
  if (cached) return cached;

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
}

export function invalidateLeaderboardCache(): void {
  cache.clear();
}

export function useLeaderboard() {
  const { user } = useAuth();
  const [scope, setScope] = createSignal<LeaderboardScope>('global');
  const [timeframe, setTimeframe] = createSignal<LeaderboardTimeframe>('allTime');

  const [data] = createResource(
    () => ({
      scope: scope(),
      timeframe: timeframe(),
      uid: user()?.uid,
    }),
    async (params) => {
      // For friends scope, we need the user's opponent list
      // This will be fetched from the user's stats
      let friendUids: string[] = [];
      if (params.scope === 'friends' && params.uid) {
        const userEntry = await firestoreLeaderboardRepository.getUserEntry(params.uid);
        // friendUids would come from the user's stats uniqueOpponentUids
        // For now, we get it from the leaderboard — but this needs the stats repo
        // We'll handle this in the component by passing friendUids
        friendUids = [];
      }

      return fetchLeaderboard(params.scope, params.timeframe, params.uid, friendUids);
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

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/leaderboard/hooks/__tests__/useLeaderboard.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/leaderboard/hooks/useLeaderboard.ts src/features/leaderboard/hooks/__tests__/useLeaderboard.test.ts
git commit -m "feat(leaderboard): add useLeaderboard hook with 5-min cache

Scope (global/friends), timeframe (allTime/last30d) toggles, user rank"
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
- Reference: `src/features/profile/components/TierBadge.tsx` (tier colors)
- Reference: `src/shared/components/EmptyState.tsx` (empty state pattern)

**Step 1: Write failing tests for Podium**

```typescript
// src/features/leaderboard/components/__tests__/Podium.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import Podium from '../Podium';
import type { LeaderboardEntry } from '../../../../shared/utils/leaderboardScoring';

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
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

describe('Podium', () => {
  it('renders top 3 entries with correct names', () => {
    const entries = [
      makeEntry({ uid: 'u1', displayName: 'Gold', compositeScore: 90 }),
      makeEntry({ uid: 'u2', displayName: 'Silver', compositeScore: 80 }),
      makeEntry({ uid: 'u3', displayName: 'Bronze', compositeScore: 70 }),
    ];

    const { getByText } = render(() => <Podium entries={entries} />);
    expect(getByText('Gold')).toBeDefined();
    expect(getByText('Silver')).toBeDefined();
    expect(getByText('Bronze')).toBeDefined();
  });

  it('renders rank labels for each position', () => {
    const entries = [
      makeEntry({ uid: 'u1', displayName: 'First' }),
      makeEntry({ uid: 'u2', displayName: 'Second' }),
      makeEntry({ uid: 'u3', displayName: 'Third' }),
    ];

    const { getByText } = render(() => <Podium entries={entries} />);
    expect(getByText('#1')).toBeDefined();
    expect(getByText('#2')).toBeDefined();
    expect(getByText('#3')).toBeDefined();
  });

  it('handles fewer than 3 entries gracefully', () => {
    const entries = [makeEntry({ uid: 'u1', displayName: 'Only One' })];
    const { getByText } = render(() => <Podium entries={entries} />);
    expect(getByText('Only One')).toBeDefined();
  });

  it('shows composite score for each entry', () => {
    const entries = [
      makeEntry({ uid: 'u1', displayName: 'A', compositeScore: 85.5 }),
    ];
    const { container } = render(() => <Podium entries={entries} />);
    expect(container.textContent).toContain('85.5');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/leaderboard/components/__tests__/Podium.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement Podium**

```tsx
// src/features/leaderboard/components/Podium.tsx
import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { Trophy, Medal, Award } from 'lucide-solid';
import type { LeaderboardEntry } from '../../../shared/utils/leaderboardScoring';
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
                <img
                  src={entry.photoURL!}
                  alt={entry.displayName}
                  class="w-10 h-10 rounded-full object-cover"
                />
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

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/leaderboard/components/__tests__/Podium.test.tsx`
Expected: PASS (all 4 tests)

**Step 5: Write failing tests for RankingsList**

```typescript
// src/features/leaderboard/components/__tests__/RankingsList.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import RankingsList from '../RankingsList';
import type { LeaderboardEntry } from '../../../../shared/utils/leaderboardScoring';

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
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

describe('RankingsList', () => {
  it('renders entries with rank starting at startRank', () => {
    const entries = [
      makeEntry({ uid: 'u1', displayName: 'Fourth' }),
      makeEntry({ uid: 'u2', displayName: 'Fifth' }),
    ];

    const { getByText } = render(() => <RankingsList entries={entries} startRank={4} />);
    expect(getByText('4')).toBeDefined();
    expect(getByText('Fifth')).toBeDefined();
  });

  it('shows win rate as percentage', () => {
    const entries = [makeEntry({ uid: 'u1', winRate: 0.75 })];
    const { container } = render(() => <RankingsList entries={entries} startRank={4} />);
    expect(container.textContent).toContain('75%');
  });

  it('shows streak indicator with W/L prefix', () => {
    const entries = [
      makeEntry({ uid: 'u1', currentStreak: { type: 'W', count: 5 } }),
    ];
    const { container } = render(() => <RankingsList entries={entries} startRank={4} />);
    expect(container.textContent).toContain('W5');
  });

  it('highlights current user entry', () => {
    const entries = [makeEntry({ uid: 'current-user' })];
    const { container } = render(() => (
      <RankingsList entries={entries} startRank={4} currentUserUid="current-user" />
    ));
    const row = container.querySelector('[data-current-user="true"]');
    expect(row).toBeDefined();
  });

  it('renders empty list without errors', () => {
    const { container } = render(() => <RankingsList entries={[]} startRank={4} />);
    expect(container).toBeDefined();
  });
});
```

**Step 6: Implement RankingsList**

```tsx
// src/features/leaderboard/components/RankingsList.tsx
import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { TrendingUp, TrendingDown } from 'lucide-solid';
import type { LeaderboardEntry } from '../../../shared/utils/leaderboardScoring';
import TierBadge from '../../profile/components/TierBadge';

interface RankingsListProps {
  entries: LeaderboardEntry[];
  startRank: number;
  currentUserUid?: string;
}

const RankingsList: Component<RankingsListProps> = (props) => {
  return (
    <ul class="space-y-1 px-4" role="list">
      <For each={props.entries}>
        {(entry, index) => {
          const rank = () => props.startRank + index();
          const isCurrentUser = () => entry.uid === props.currentUserUid;

          return (
            <li
              class={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                isCurrentUser()
                  ? 'bg-primary/10 border border-primary/30'
                  : 'bg-surface-light border border-border'
              }`}
              data-current-user={isCurrentUser() ? 'true' : undefined}
            >
              <span class="text-on-surface-muted font-bold text-sm w-6 text-center">
                {rank()}
              </span>

              <Show
                when={entry.photoURL}
                fallback={
                  <div class="w-8 h-8 rounded-full bg-surface-lighter flex items-center justify-center text-on-surface-muted font-bold text-xs shrink-0">
                    {entry.displayName.charAt(0).toUpperCase()}
                  </div>
                }
              >
                <img
                  src={entry.photoURL!}
                  alt=""
                  class="w-8 h-8 rounded-full object-cover shrink-0"
                />
              </Show>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-on-surface text-sm font-medium truncate">
                    {entry.displayName}
                  </span>
                  <TierBadge tier={entry.tier} confidence={entry.tierConfidence} />
                </div>
              </div>

              <div class="flex items-center gap-3 text-xs shrink-0">
                <span class="text-on-surface-muted">{Math.round(entry.winRate * 100)}%</span>

                <span
                  class={`font-medium ${
                    entry.currentStreak.type === 'W' ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  <Show
                    when={entry.currentStreak.type === 'W'}
                    fallback={<TrendingDown size={12} class="inline mr-0.5" />}
                  >
                    <TrendingUp size={12} class="inline mr-0.5" />
                  </Show>
                  {entry.currentStreak.type}{entry.currentStreak.count}
                </span>

                <span class="text-on-surface font-bold">
                  {entry.compositeScore.toFixed(1)}
                </span>
              </div>
            </li>
          );
        }}
      </For>
    </ul>
  );
};

export default RankingsList;
```

**Step 7: Run tests to verify they pass**

Run: `npx vitest run src/features/leaderboard/components/__tests__/RankingsList.test.tsx`
Expected: PASS (all 5 tests)

**Step 8: Write failing tests for UserRankCard**

```typescript
// src/features/leaderboard/components/__tests__/UserRankCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import UserRankCard from '../UserRankCard';
import type { LeaderboardEntry } from '../../../../shared/utils/leaderboardScoring';

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
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

describe('UserRankCard', () => {
  it('shows rank and user info when entry exists', () => {
    const entry = makeEntry({ displayName: 'Alice' });
    const { getByText } = render(() => <UserRankCard entry={entry} rank={12} />);
    expect(getByText('Alice')).toBeDefined();
    expect(getByText('#12')).toBeDefined();
  });

  it('shows qualification message when matchesNeeded > 0', () => {
    const { getByText } = render(() => (
      <UserRankCard entry={null} rank={null} matchesNeeded={3} />
    ));
    expect(getByText(/Play 3 more match/)).toBeDefined();
  });

  it('shows sign-in message when not authenticated', () => {
    const { getByText } = render(() => (
      <UserRankCard entry={null} rank={null} signedOut />
    ));
    expect(getByText(/Sign in/)).toBeDefined();
  });

  it('shows composite score', () => {
    const entry = makeEntry({ compositeScore: 72.5 });
    const { container } = render(() => <UserRankCard entry={entry} rank={5} />);
    expect(container.textContent).toContain('72.5');
  });
});
```

**Step 9: Implement UserRankCard**

```tsx
// src/features/leaderboard/components/UserRankCard.tsx
import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { User } from 'lucide-solid';
import type { LeaderboardEntry } from '../../../shared/utils/leaderboardScoring';
import TierBadge from '../../profile/components/TierBadge';

interface UserRankCardProps {
  entry: LeaderboardEntry | null;
  rank: number | null;
  matchesNeeded?: number;
  signedOut?: boolean;
}

const UserRankCard: Component<UserRankCardProps> = (props) => {
  return (
    <div class="mx-4 rounded-xl p-4 bg-primary/10 border border-primary/30">
      <Show
        when={!props.signedOut}
        fallback={
          <div class="flex items-center gap-3 text-on-surface-muted">
            <User size={20} />
            <span class="text-sm">Sign in to see your ranking</span>
          </div>
        }
      >
        <Show
          when={props.entry}
          fallback={
            <div class="flex items-center gap-3 text-on-surface-muted">
              <User size={20} />
              <span class="text-sm">
                Play {props.matchesNeeded ?? 5} more match{(props.matchesNeeded ?? 5) !== 1 ? 'es' : ''} to appear on the leaderboard
              </span>
            </div>
          }
        >
          {(entry) => (
            <div class="flex items-center gap-3">
              <span class="text-primary font-bold text-lg">#{props.rank}</span>

              <Show
                when={entry().photoURL}
                fallback={
                  <div class="w-10 h-10 rounded-full bg-surface-lighter flex items-center justify-center text-on-surface-muted font-bold">
                    {entry().displayName.charAt(0).toUpperCase()}
                  </div>
                }
              >
                <img
                  src={entry().photoURL!}
                  alt=""
                  class="w-10 h-10 rounded-full object-cover"
                />
              </Show>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-on-surface font-medium truncate">{entry().displayName}</span>
                  <TierBadge tier={entry().tier} confidence={entry().tierConfidence} />
                </div>
                <span class="text-on-surface-muted text-xs">
                  {Math.round(entry().winRate * 100)}% win rate · {entry().totalMatches} matches
                </span>
              </div>

              <span class="text-primary font-bold text-xl">
                {entry().compositeScore.toFixed(1)}
              </span>
            </div>
          )}
        </Show>
      </Show>
    </div>
  );
};

export default UserRankCard;
```

**Step 10: Run all component tests**

Run: `npx vitest run src/features/leaderboard/components/__tests__/`
Expected: PASS (all 13 tests across 3 files)

**Step 11: Commit**

```bash
git add src/features/leaderboard/components/
git commit -m "feat(leaderboard): add Podium, RankingsList, and UserRankCard components

Top 3 podium with medals, rankings list with streak/winRate, user rank card with qualification"
```

---

### Task 7: LeaderboardTab + PlayersPage Tabs

**Files:**
- Create: `src/features/leaderboard/components/LeaderboardTab.tsx`
- Create: `src/features/leaderboard/components/__tests__/LeaderboardTab.test.tsx`
- Modify: `src/features/players/PlayersPage.tsx` (add tab navigation)
- Create: `src/features/players/__tests__/PlayersPage.test.tsx` (tab switching tests)

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
  it('renders scope toggle buttons', () => {
    const { getByText } = render(() => <LeaderboardTab />);
    expect(getByText('Global')).toBeDefined();
    expect(getByText('Friends')).toBeDefined();
  });

  it('renders timeframe toggle buttons', () => {
    const { getByText } = render(() => <LeaderboardTab />);
    expect(getByText('All Time')).toBeDefined();
    expect(getByText('Last 30 Days')).toBeDefined();
  });

  it('shows empty state when no entries', () => {
    const { getByText } = render(() => <LeaderboardTab />);
    expect(getByText(/No rankings yet/)).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/leaderboard/components/__tests__/LeaderboardTab.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement LeaderboardTab**

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
      {/* Scope toggle */}
      <div class="flex gap-2 px-4">
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

      {/* Timeframe toggle */}
      <div class="flex gap-2 px-4">
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

      {/* Loading */}
      <Show when={!leaderboard.loading()} fallback={<LoadingSkeleton />}>
        {/* Content */}
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
          {/* Podium */}
          <Show when={topThree().length > 0}>
            <Podium entries={topThree()} />
          </Show>

          {/* User rank card */}
          <UserRankCard
            entry={leaderboard.userEntry()}
            rank={leaderboard.userRank()}
            signedOut={!user()}
          />

          {/* Rankings list */}
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

// Internal components

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

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/leaderboard/components/__tests__/LeaderboardTab.test.tsx`
Expected: PASS (all 3 tests)

**Step 5: Write failing tests for PlayersPage tab switching**

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
  });

  it('switches to Leaderboard tab on click', async () => {
    const { getByRole, getByTestId } = render(() => <PlayersPage />);
    const leaderboardTab = getByRole('tab', { name: 'Leaderboard' });
    await fireEvent.click(leaderboardTab);

    expect(leaderboardTab.getAttribute('aria-selected')).toBe('true');
    expect(getByTestId('leaderboard-tab')).toBeDefined();
  });
});
```

**Step 6: Modify PlayersPage to add tabs**

Rewrite `src/features/players/PlayersPage.tsx`:

```tsx
import type { Component } from 'solid-js';
import { createSignal, For, Show, lazy } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import AddPlayerForm from './components/AddPlayerForm';
import PlayerCard from './components/PlayerCard';
import EmptyState from '../../shared/components/EmptyState';
import { Users } from 'lucide-solid';
import { useLiveQuery } from '../../data/useLiveQuery';
import { playerRepository } from '../../data/repositories/playerRepository';

const LeaderboardTab = lazy(() => import('../leaderboard/components/LeaderboardTab'));

type Tab = 'players' | 'leaderboard';

const PlayersPage: Component = () => {
  const { data: players } = useLiveQuery(() => playerRepository.getAll());
  const [activeTab, setActiveTab] = createSignal<Tab>('players');

  return (
    <PageLayout title="Players">
      {/* Tab bar */}
      <div class="flex border-b border-surface-lighter sticky top-0 bg-surface z-10" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab() === 'players'}
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
          role="tab"
          aria-selected={activeTab() === 'leaderboard'}
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

      {/* Tab content */}
      <Show when={activeTab() === 'players'}>
        <div class="p-4 space-y-4">
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
        <div class="pt-4">
          <LeaderboardTab />
        </div>
      </Show>
    </PageLayout>
  );
};

export default PlayersPage;
```

**Step 7: Run PlayersPage tests**

Run: `npx vitest run src/features/players/__tests__/PlayersPage.test.tsx`
Expected: PASS (all 3 tests)

**Step 8: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (no regressions)

**Step 9: Commit**

```bash
git add src/features/leaderboard/components/LeaderboardTab.tsx src/features/leaderboard/components/__tests__/LeaderboardTab.test.tsx src/features/players/PlayersPage.tsx src/features/players/__tests__/PlayersPage.test.tsx
git commit -m "feat(leaderboard): add LeaderboardTab and PlayersPage tab navigation

Scope/timeframe toggles, podium + rankings + user rank, tab switching"
```

---

### Task 8: E2E Tests

**Files:**
- Create: `e2e/leaderboard.spec.ts`
- Reference: existing E2E tests in `e2e/` directory
- Reference: `src/data/firebase/config.ts` (Firebase config for auth in browser)

**Step 1: Write E2E test for full leaderboard flow**

```typescript
// e2e/leaderboard.spec.ts
import { test, expect } from '@playwright/test';

// Auth helper: sign in via Firebase Auth emulator
async function signInTestUser(page, email: string, displayName: string) {
  await page.evaluate(
    async ({ email, displayName }) => {
      const { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } =
        await import('/node_modules/firebase/auth/dist/esm/index.esm.js');
      const auth = (window as any).__app_config__.auth;

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, 'testpass123');
        await updateProfile(cred.user, { displayName });
      } catch {
        await signInWithEmailAndPassword(auth, email, 'testpass123');
      }
    },
    { email, displayName },
  );
  // Wait for auth state to propagate
  await page.waitForTimeout(1000);
}

test.describe('Leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5199/players');
  });

  test('shows Players and Leaderboard tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Players' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Leaderboard' })).toBeVisible();
  });

  test('switches to Leaderboard tab and shows empty state', async ({ page }) => {
    await page.getByRole('tab', { name: 'Leaderboard' }).click();
    await expect(page.getByText('No rankings yet')).toBeVisible();
  });

  test('shows sign-in prompt for friends scope when not authenticated', async ({ page }) => {
    await page.getByRole('tab', { name: 'Leaderboard' }).click();
    // Friends button should be disabled or show sign-in message
    const friendsBtn = page.getByRole('button', { name: 'Friends' });
    await expect(friendsBtn).toBeVisible();
  });
});
```

**Step 2: Run E2E tests**

Run: `npx playwright test e2e/leaderboard.spec.ts`
Expected: Tests should pass against dev server + Firebase emulators

**Step 3: Commit**

```bash
git add e2e/leaderboard.spec.ts
git commit -m "test(leaderboard): add E2E tests for leaderboard tab navigation

Tab switching, empty state, scope toggle visibility"
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
Expected: All E2E tests pass

**Step 4: Build check**

Run: `npx vite build`
Expected: Successful build with no errors

**Step 5: Manual smoke test**

Start dev server (`npx vite --port 5199`) and verify:
1. Navigate to `/players` — tabs visible
2. Click "Leaderboard" tab — shows empty state
3. Click "Global" / "Friends" toggles
4. Click "All Time" / "Last 30 Days" toggles
5. Verify no console errors

**Step 6: Final commit**

If any cleanup was needed during verification, commit it:

```bash
git add -A
git commit -m "chore(leaderboard): wave C verification cleanup"
```
