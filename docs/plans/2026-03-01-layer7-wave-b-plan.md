# Layer 7 Wave B: Profile Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Profile page (`/profile`) showing the signed-in user's Google identity, stats dashboard, and recent match history, with navigation changes (TopNav dropdown menu, Settings removed from BottomNav).

**Architecture:** New `src/features/profile/` feature folder following existing page patterns (PageLayout, auth-gated). Data hook uses `createResource` with `Promise.allSettled` for parallel Firestore reads. Two new read methods on `firestorePlayerStatsRepository`. TopNav avatar becomes a dropdown menu with Profile/Settings/Sign-out links.

**Tech Stack:** SolidJS 1.9, TypeScript, Vitest, Firebase Firestore, Tailwind CSS v4

**Design doc:** `docs/plans/2026-03-01-layer7-wave-b-design.md`

---

## Task 1: Add `getStatsSummary` Read Method

**Files:**
- Modify: `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts:1,118`

**Step 1: Add `getDoc` mock to existing test setup**

In `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`, update the hoisted mocks (lines 4-23) to add `mockGetDoc`:

```typescript
const {
  mockDoc,
  mockGetDoc,
  mockGetDocs,
  mockCollection,
  mockRunTransaction,
  mockTransactionGet,
  mockTransactionSet,
} = vi.hoisted(() => {
  const mockTransactionGet = vi.fn();
  const mockTransactionSet = vi.fn();
  const mockRunTransaction = vi.fn((_firestore: unknown, callback: unknown) =>
    (callback as (txn: { get: typeof mockTransactionGet; set: typeof mockTransactionSet }) => Promise<void>)({
      get: mockTransactionGet,
      set: mockTransactionSet,
    }),
  );
  return {
    mockDoc: vi.fn(() => 'mock-doc-ref'),
    mockGetDoc: vi.fn(),
    mockGetDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    mockCollection: vi.fn(() => 'mock-collection-ref'),
    mockRunTransaction,
    mockTransactionGet,
    mockTransactionSet,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  collection: mockCollection,
  runTransaction: mockRunTransaction,
}));
```

**Step 2: Write failing tests for `getStatsSummary()`**

Append to the end of the main `describe` block (before the closing `});`):

```typescript
  describe('getStatsSummary', () => {
    it('returns stats summary when document exists', async () => {
      const stats = makeEmptyStats();
      stats.totalMatches = 10;
      stats.wins = 7;
      stats.winRate = 0.7;
      stats.tier = 'intermediate';
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => stats,
      });

      const result = await firestorePlayerStatsRepository.getStatsSummary('user-1');

      expect(mockDoc).toHaveBeenCalledWith(
        'mock-firestore', 'users', 'user-1', 'stats', 'summary',
      );
      expect(result).not.toBeNull();
      expect(result!.totalMatches).toBe(10);
      expect(result!.tier).toBe('intermediate');
    });

    it('returns null when no stats document exists', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const result = await firestorePlayerStatsRepository.getStatsSummary('user-1');

      expect(result).toBeNull();
    });
  });
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: FAIL — `getStatsSummary` is not a function

**Step 4: Implement `getStatsSummary()`**

In `src/data/firebase/firestorePlayerStatsRepository.ts`:

1. Update import on line 1 to add `getDoc`:
```typescript
import { doc, getDoc, getDocs, collection, runTransaction } from 'firebase/firestore';
```

2. Add method inside the exported object (after `processMatchCompletion`, before the closing `};`):
```typescript
  async getStatsSummary(uid: string): Promise<StatsSummary | null> {
    const ref = doc(firestore, 'users', uid, 'stats', 'summary');
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as StatsSummary) : null;
  },
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts
git commit -m "feat: add getStatsSummary read method to player stats repository"
```

---

## Task 2: Add `getRecentMatchRefs` Read Method

**Files:**
- Modify: `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts:1`

**Step 1: Add query mocks to test setup**

Update the hoisted mocks to add `mockQuery`, `mockOrderBy`, `mockLimit`, `mockStartAfter`:

```typescript
const {
  mockDoc,
  mockGetDoc,
  mockGetDocs,
  mockCollection,
  mockQuery,
  mockOrderBy,
  mockLimit,
  mockStartAfter,
  mockRunTransaction,
  mockTransactionGet,
  mockTransactionSet,
} = vi.hoisted(() => {
  const mockTransactionGet = vi.fn();
  const mockTransactionSet = vi.fn();
  const mockRunTransaction = vi.fn((_firestore: unknown, callback: unknown) =>
    (callback as (txn: { get: typeof mockTransactionGet; set: typeof mockTransactionSet }) => Promise<void>)({
      get: mockTransactionGet,
      set: mockTransactionSet,
    }),
  );
  return {
    mockDoc: vi.fn(() => 'mock-doc-ref'),
    mockGetDoc: vi.fn(),
    mockGetDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    mockCollection: vi.fn(() => 'mock-collection-ref'),
    mockQuery: vi.fn(() => 'mock-query'),
    mockOrderBy: vi.fn(() => 'mock-order-by'),
    mockLimit: vi.fn(() => 'mock-limit'),
    mockStartAfter: vi.fn(() => 'mock-start-after'),
    mockRunTransaction,
    mockTransactionGet,
    mockTransactionSet,
  };
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  collection: mockCollection,
  query: mockQuery,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  runTransaction: mockRunTransaction,
}));
```

**Step 2: Write failing tests for `getRecentMatchRefs()`**

Append after the `getStatsSummary` describe block:

```typescript
  describe('getRecentMatchRefs', () => {
    it('returns match refs ordered by completedAt desc', async () => {
      const matchRef1 = { matchId: 'm1', completedAt: 2000, result: 'win', gameType: 'singles' };
      const matchRef2 = { matchId: 'm2', completedAt: 1000, result: 'loss', gameType: 'doubles' };
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => matchRef1 },
          { data: () => matchRef2 },
        ],
      });

      const results = await firestorePlayerStatsRepository.getRecentMatchRefs('user-1', 10);

      expect(mockCollection).toHaveBeenCalledWith(
        'mock-firestore', 'users', 'user-1', 'matchRefs',
      );
      expect(mockOrderBy).toHaveBeenCalledWith('completedAt', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(results).toHaveLength(2);
      expect(results[0].matchId).toBe('m1');
    });

    it('returns empty array when no match refs exist', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const results = await firestorePlayerStatsRepository.getRecentMatchRefs('user-1');

      expect(results).toEqual([]);
    });

    it('uses startAfter cursor when provided', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await firestorePlayerStatsRepository.getRecentMatchRefs('user-1', 10, 5000);

      expect(mockStartAfter).toHaveBeenCalledWith(5000);
    });

    it('defaults to limit of 10', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await firestorePlayerStatsRepository.getRecentMatchRefs('user-1');

      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: FAIL — `getRecentMatchRefs` is not a function

**Step 4: Implement `getRecentMatchRefs()`**

In `src/data/firebase/firestorePlayerStatsRepository.ts`:

1. Update import on line 1:
```typescript
import { doc, getDoc, getDocs, collection, query, orderBy, limit as fbLimit, startAfter, runTransaction } from 'firebase/firestore';
```

2. Add method inside the exported object (after `getStatsSummary`, before the closing `};`):
```typescript
  async getRecentMatchRefs(
    uid: string,
    maxResults: number = 10,
    startAfterTimestamp?: number,
  ): Promise<MatchRef[]> {
    const constraints = [
      orderBy('completedAt', 'desc'),
      fbLimit(maxResults),
    ];
    if (startAfterTimestamp !== undefined) {
      constraints.splice(1, 0, startAfter(startAfterTimestamp));
    }
    const q = query(
      collection(firestore, 'users', uid, 'matchRefs'),
      ...constraints,
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as MatchRef);
  },
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`
Expected: All tests PASS

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts
git commit -m "feat: add getRecentMatchRefs with pagination cursor to player stats repository"
```

---

## Task 3: TierBadge Component

**Files:**
- Create: `src/features/profile/components/TierBadge.tsx`
- Create: `src/features/profile/__tests__/TierBadge.test.ts`

**Pre-step: Create directories**

```bash
mkdir -p src/features/profile/components src/features/profile/__tests__
```

**Step 1: Write failing tests for tier-to-style mapping**

Create `src/features/profile/__tests__/TierBadge.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getTierColor, getConfidenceDots } from '../components/TierBadge';

describe('getTierColor', () => {
  it('returns slate classes for beginner', () => {
    const color = getTierColor('beginner');
    expect(color.bg).toContain('slate');
    expect(color.text).toContain('slate');
  });

  it('returns green classes for intermediate', () => {
    const color = getTierColor('intermediate');
    expect(color.bg).toContain('green');
    expect(color.text).toContain('green');
  });

  it('returns orange classes for advanced', () => {
    const color = getTierColor('advanced');
    expect(color.bg).toContain('orange');
    expect(color.text).toContain('orange');
  });

  it('returns yellow classes for expert', () => {
    const color = getTierColor('expert');
    expect(color.bg).toContain('yellow');
    expect(color.text).toContain('yellow');
  });
});

describe('getConfidenceDots', () => {
  it('returns 1 filled dot for low confidence', () => {
    const dots = getConfidenceDots('low');
    expect(dots.filter((d) => d.filled)).toHaveLength(1);
    expect(dots).toHaveLength(3);
  });

  it('returns 2 filled dots for medium confidence', () => {
    const dots = getConfidenceDots('medium');
    expect(dots.filter((d) => d.filled)).toHaveLength(2);
  });

  it('returns 3 filled dots for high confidence', () => {
    const dots = getConfidenceDots('high');
    expect(dots.filter((d) => d.filled)).toHaveLength(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/profile/__tests__/TierBadge.test.ts`
Expected: FAIL — module not found

**Step 3: Implement TierBadge**

Create `src/features/profile/components/TierBadge.tsx`:

```typescript
import { For } from 'solid-js';
import type { Component } from 'solid-js';
import type { Tier, TierConfidence } from '../../../data/types';

interface TierColors {
  bg: string;
  text: string;
  dot: string;
}

const TIER_COLORS: Record<Tier, TierColors> = {
  beginner: { bg: 'bg-slate-500/20', text: 'text-slate-400', dot: 'bg-slate-400' },
  intermediate: { bg: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-400' },
  advanced: { bg: 'bg-orange-400/20', text: 'text-orange-400', dot: 'bg-orange-400' },
  expert: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400' },
};

export function getTierColor(tier: Tier): TierColors {
  return TIER_COLORS[tier];
}

export function getConfidenceDots(confidence: TierConfidence): Array<{ filled: boolean }> {
  const filledCount = confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;
  return [
    { filled: filledCount >= 1 },
    { filled: filledCount >= 2 },
    { filled: filledCount >= 3 },
  ];
}

interface TierBadgeProps {
  tier: Tier;
  confidence: TierConfidence;
}

const TierBadge: Component<TierBadgeProps> = (props) => {
  const colors = () => getTierColor(props.tier);
  const dots = () => getConfidenceDots(props.confidence);

  return (
    <span
      class={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase ${colors().bg} ${colors().text}`}
      aria-label={`Skill tier: ${props.tier}, confidence: ${props.confidence}`}
    >
      {props.tier}
      <span class="inline-flex gap-0.5" aria-hidden="true">
        <For each={dots()}>
          {(dot) => (
            <span
              class={`w-1.5 h-1.5 rounded-full ${dot.filled ? colors().dot : `${colors().dot} opacity-25`}`}
            />
          )}
        </For>
      </span>
    </span>
  );
};

export default TierBadge;
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/profile/__tests__/TierBadge.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/features/profile/components/TierBadge.tsx src/features/profile/__tests__/TierBadge.test.ts
git commit -m "feat: add TierBadge component with tier color mapping and confidence dots"
```

---

## Task 4: ProfileHeader Component

**Files:**
- Create: `src/features/profile/components/ProfileHeader.tsx`

**Context:** Pure presentation component. No complex logic — just renders Google identity + TierBadge. No tests needed (presentation only, verified by type check).

**Step 1: Implement ProfileHeader**

Create `src/features/profile/components/ProfileHeader.tsx`:

```typescript
import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { Tier, TierConfidence } from '../../../data/types';
import TierBadge from './TierBadge';

interface ProfileHeaderProps {
  displayName: string;
  email: string;
  photoURL: string | null;
  createdAt: number;
  tier?: Tier;
  tierConfidence?: TierConfidence;
  hasStats: boolean;
}

function formatMemberSince(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const ProfileHeader: Component<ProfileHeaderProps> = (props) => {
  return (
    <header class="flex flex-col items-center text-center gap-2 py-4" aria-label="Player profile">
      <Show
        when={props.photoURL}
        fallback={
          <div class="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-surface font-bold text-xl ring-2 ring-surface-light">
            {props.displayName?.charAt(0) ?? '?'}
          </div>
        }
      >
        <img
          src={props.photoURL!}
          alt={`Profile photo of ${props.displayName}`}
          class="w-16 h-16 rounded-full ring-2 ring-surface-light"
          referrerpolicy="no-referrer"
        />
      </Show>

      <div class="flex items-center gap-2 flex-wrap justify-center">
        <h1 class="text-xl font-bold text-on-surface">{props.displayName}</h1>
        <Show when={props.hasStats && props.tier && props.tierConfidence}>
          <TierBadge tier={props.tier!} confidence={props.tierConfidence!} />
        </Show>
      </div>

      <p class="text-sm text-on-surface-muted">{props.email}</p>
      <p class="text-xs text-on-surface-muted">
        Member since {formatMemberSince(props.createdAt)}
      </p>
    </header>
  );
};

export default ProfileHeader;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/profile/components/ProfileHeader.tsx
git commit -m "feat: add ProfileHeader component with avatar, name, and tier badge"
```

---

## Task 5: StatsOverview Component

**Files:**
- Create: `src/features/profile/components/StatsOverview.tsx`

**Context:** Renders the win rate card (full width, tinted), three stat cards (matches, streak, best streak), all with proper ARIA labels.

**Step 1: Implement StatsOverview**

Create `src/features/profile/components/StatsOverview.tsx`:

```typescript
import type { Component } from 'solid-js';
import type { StatsSummary } from '../../../data/types';

interface StatsOverviewProps {
  stats: StatsSummary;
}

function formatWinRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatStreak(streak: { type: 'W' | 'L'; count: number }): string {
  if (streak.count === 0) return '—';
  return `${streak.type}${streak.count}`;
}

const StatsOverview: Component<StatsOverviewProps> = (props) => {
  return (
    <section aria-labelledby="stats-heading" class="space-y-3">
      <h2 id="stats-heading" class="sr-only">Player Statistics</h2>

      {/* Win Rate — featured card */}
      <div
        class="bg-green-500/10 rounded-xl p-4"
        role="group"
        aria-label={`Win rate: ${Math.round(props.stats.winRate * 100)} percent`}
      >
        <div class="text-xs text-on-surface-muted uppercase tracking-wide font-semibold mb-1">Win Rate</div>
        <div class="text-2xl font-bold text-green-400">{formatWinRate(props.stats.winRate)}</div>
        <div class="text-xs text-on-surface-muted mt-1">
          Singles {props.stats.singles.wins}-{props.stats.singles.losses}
          {' · '}
          Doubles {props.stats.doubles.wins}-{props.stats.doubles.losses}
        </div>
      </div>

      {/* Stat cards row */}
      <div class="grid grid-cols-3 gap-3">
        <div
          class="bg-surface-light rounded-xl p-4"
          role="group"
          aria-label={`Total matches: ${props.stats.totalMatches}`}
        >
          <div class="text-xs text-on-surface-muted uppercase tracking-wide font-semibold mb-1">Matches</div>
          <div class="text-xl font-semibold text-on-surface">{props.stats.totalMatches}</div>
        </div>

        <div
          class="bg-surface-light rounded-xl p-4"
          role="group"
          aria-label={`Current streak: ${props.stats.currentStreak.count} ${props.stats.currentStreak.type === 'W' ? 'wins' : 'losses'}`}
        >
          <div class="text-xs text-on-surface-muted uppercase tracking-wide font-semibold mb-1">Streak</div>
          <div class={`text-xl font-semibold ${props.stats.currentStreak.type === 'W' ? 'text-green-400' : 'text-red-400'}`}>
            {formatStreak(props.stats.currentStreak)}
          </div>
        </div>

        <div
          class="bg-surface-light rounded-xl p-4"
          role="group"
          aria-label={`Best win streak: ${props.stats.bestWinStreak}`}
        >
          <div class="text-xs text-on-surface-muted uppercase tracking-wide font-semibold mb-1">Best</div>
          <div class="text-xl font-semibold text-on-surface">
            {props.stats.bestWinStreak > 0 ? `W${props.stats.bestWinStreak}` : '—'}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsOverview;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/profile/components/StatsOverview.tsx
git commit -m "feat: add StatsOverview component with win rate card and stat grid"
```

---

## Task 6: RecentMatches Component

**Files:**
- Create: `src/features/profile/components/RecentMatches.tsx`

**Context:** Compact match list with W/L indicators, relative dates, and "Load More" button. Rows are `<button>` elements (tappable for future detail view). Proper accessibility.

**Step 1: Implement RecentMatches**

Create `src/features/profile/components/RecentMatches.tsx`:

```typescript
import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { MatchRef } from '../../../data/types';

interface RecentMatchesProps {
  matches: MatchRef[];
  onLoadMore?: () => void;
  hasMore: boolean;
  loadingMore: boolean;
}

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d';
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}

function formatOpponentName(match: MatchRef): string {
  return match.opponentNames.join(' & ');
}

const RecentMatches: Component<RecentMatchesProps> = (props) => {
  return (
    <section aria-labelledby="matches-heading">
      <h2
        id="matches-heading"
        class="text-sm font-semibold text-on-surface-muted uppercase tracking-wide mb-3"
      >
        Recent Matches
      </h2>

      <div class="bg-surface rounded-xl overflow-hidden">
        <ul role="list" aria-label="Recent match results">
          <For each={props.matches}>
            {(match, index) => (
              <li
                class={`${index() > 0 ? 'border-t border-surface-lighter' : ''}`}
              >
                <button
                  type="button"
                  class="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left hover:bg-surface-lighter transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500"
                  aria-label={`${match.result === 'win' ? 'Win' : 'Loss'} against ${formatOpponentName(match)}, ${match.scores}, ${formatRelativeDate(match.completedAt)}`}
                >
                  {/* W/L badge */}
                  <span
                    class={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      match.result === 'win'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-400/20 text-red-400'
                    }`}
                    aria-hidden="true"
                  >
                    {match.result === 'win' ? 'W' : 'L'}
                  </span>

                  {/* Opponent name */}
                  <span class="text-sm text-on-surface font-medium truncate flex-1">
                    vs {formatOpponentName(match)}
                  </span>

                  {/* Score */}
                  <span class="text-sm text-on-surface-muted flex-shrink-0">
                    {match.scores}
                  </span>

                  {/* Date */}
                  <span class="text-xs text-on-surface-muted w-8 text-right flex-shrink-0">
                    {formatRelativeDate(match.completedAt)}
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>

        <Show when={props.hasMore}>
          <div class="border-t border-surface-lighter px-4 py-3">
            <button
              type="button"
              onClick={() => props.onLoadMore?.()}
              disabled={props.loadingMore}
              class="w-full text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
              aria-label="Load more matches"
            >
              {props.loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        </Show>
      </div>

      <div aria-live="polite" class="sr-only" id="match-load-status" />
    </section>
  );
};

export default RecentMatches;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/profile/components/RecentMatches.tsx
git commit -m "feat: add RecentMatches component with compact list and load more"
```

---

## Task 7: useProfileData Hook

**Files:**
- Create: `src/features/profile/hooks/useProfileData.ts`
- Create: `src/features/profile/__tests__/useProfileData.test.ts`

**Context:** Uses `createResource` for initial parallel fetch (profile + stats + matchRefs) via `Promise.allSettled`. Manual signal for pagination. Returns `{ data, extraMatches, loadMore, loadingMore, refetch }`.

**Step 1: Write failing tests**

Create `src/features/profile/__tests__/useProfileData.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserProfile, StatsSummary, MatchRef } from '../../../data/types';

const mockGetProfile = vi.fn();
const mockGetStatsSummary = vi.fn();
const mockGetRecentMatchRefs = vi.fn();

vi.mock('../../../data/firebase/firestoreUserRepository', () => ({
  firestoreUserRepository: {
    getProfile: mockGetProfile,
  },
}));

vi.mock('../../../data/firebase/firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: {
    getStatsSummary: mockGetStatsSummary,
    getRecentMatchRefs: mockGetRecentMatchRefs,
  },
}));

import { fetchProfileBundle } from '../hooks/useProfileData';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    displayName: 'Alice',
    displayNameLower: 'alice',
    email: 'alice@test.com',
    photoURL: null,
    createdAt: 1000000,
    ...overrides,
  };
}

function makeStats(overrides: Partial<StatsSummary> = {}): StatsSummary {
  return {
    schemaVersion: 1,
    totalMatches: 10,
    wins: 7,
    losses: 3,
    winRate: 0.7,
    currentStreak: { type: 'W', count: 3 },
    bestWinStreak: 5,
    singles: { matches: 6, wins: 4, losses: 2 },
    doubles: { matches: 4, wins: 3, losses: 1 },
    recentResults: [],
    tier: 'intermediate',
    tierConfidence: 'medium',
    tierUpdatedAt: 2000000,
    lastPlayedAt: 3000000,
    updatedAt: 3000000,
    ...overrides,
  };
}

function makeMatchRef(overrides: Partial<MatchRef> = {}): MatchRef {
  return {
    matchId: 'm1',
    startedAt: 1000,
    completedAt: 2000,
    gameType: 'singles',
    scoringMode: 'sideout',
    result: 'win',
    scores: '11-7, 11-4',
    gameScores: [[11, 7], [11, 4]],
    playerTeam: 1,
    opponentNames: ['Bob'],
    opponentIds: [],
    partnerName: null,
    partnerId: null,
    ownerId: 'user-1',
    tournamentId: null,
    tournamentName: null,
    ...overrides,
  };
}

describe('fetchProfileBundle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches profile, stats, and matches in parallel', async () => {
    const profile = makeProfile();
    const stats = makeStats();
    const matches = [makeMatchRef()];
    mockGetProfile.mockResolvedValueOnce(profile);
    mockGetStatsSummary.mockResolvedValueOnce(stats);
    mockGetRecentMatchRefs.mockResolvedValueOnce(matches);

    const result = await fetchProfileBundle('user-1');

    expect(mockGetProfile).toHaveBeenCalledWith('user-1');
    expect(mockGetStatsSummary).toHaveBeenCalledWith('user-1');
    expect(mockGetRecentMatchRefs).toHaveBeenCalledWith('user-1', 10);
    expect(result.profile).toEqual(profile);
    expect(result.stats).toEqual(stats);
    expect(result.matches).toEqual(matches);
  });

  it('returns partial data when stats fetch fails', async () => {
    const profile = makeProfile();
    mockGetProfile.mockResolvedValueOnce(profile);
    mockGetStatsSummary.mockRejectedValueOnce(new Error('permission-denied'));
    mockGetRecentMatchRefs.mockResolvedValueOnce([]);

    const result = await fetchProfileBundle('user-1');

    expect(result.profile).toEqual(profile);
    expect(result.stats).toBeNull();
    expect(result.errors.stats).not.toBeNull();
  });

  it('returns partial data when matches fetch fails', async () => {
    const profile = makeProfile();
    const stats = makeStats();
    mockGetProfile.mockResolvedValueOnce(profile);
    mockGetStatsSummary.mockResolvedValueOnce(stats);
    mockGetRecentMatchRefs.mockRejectedValueOnce(new Error('network error'));

    const result = await fetchProfileBundle('user-1');

    expect(result.profile).toEqual(profile);
    expect(result.stats).toEqual(stats);
    expect(result.matches).toEqual([]);
    expect(result.errors.matches).not.toBeNull();
  });

  it('tracks lastCompletedAt from last match for pagination cursor', async () => {
    const matches = [
      makeMatchRef({ matchId: 'm1', completedAt: 3000 }),
      makeMatchRef({ matchId: 'm2', completedAt: 2000 }),
      makeMatchRef({ matchId: 'm3', completedAt: 1000 }),
    ];
    mockGetProfile.mockResolvedValueOnce(makeProfile());
    mockGetStatsSummary.mockResolvedValueOnce(makeStats());
    mockGetRecentMatchRefs.mockResolvedValueOnce(matches);

    const result = await fetchProfileBundle('user-1');

    expect(result.lastCompletedAt).toBe(1000);
  });

  it('returns null lastCompletedAt when no matches', async () => {
    mockGetProfile.mockResolvedValueOnce(makeProfile());
    mockGetStatsSummary.mockResolvedValueOnce(makeStats());
    mockGetRecentMatchRefs.mockResolvedValueOnce([]);

    const result = await fetchProfileBundle('user-1');

    expect(result.lastCompletedAt).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/profile/__tests__/useProfileData.test.ts`
Expected: FAIL — module not found

**Step 3: Implement useProfileData**

Create `src/features/profile/hooks/useProfileData.ts`:

```typescript
import { createResource, createSignal, createMemo, createEffect, on } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { UserProfile, StatsSummary, MatchRef } from '../../../data/types';
import { firestoreUserRepository } from '../../../data/firebase/firestoreUserRepository';
import { firestorePlayerStatsRepository } from '../../../data/firebase/firestorePlayerStatsRepository';

export interface ProfileBundle {
  profile: UserProfile | null;
  stats: StatsSummary | null;
  matches: MatchRef[];
  lastCompletedAt: number | null;
  errors: {
    profile: Error | null;
    stats: Error | null;
    matches: Error | null;
  };
}

export async function fetchProfileBundle(userId: string): Promise<ProfileBundle> {
  const [profileResult, statsResult, matchesResult] = await Promise.allSettled([
    firestoreUserRepository.getProfile(userId),
    firestorePlayerStatsRepository.getStatsSummary(userId),
    firestorePlayerStatsRepository.getRecentMatchRefs(userId, 10),
  ]);

  const matches = matchesResult.status === 'fulfilled'
    ? (matchesResult.value ?? [])
    : [];

  return {
    profile: profileResult.status === 'fulfilled' ? profileResult.value : null,
    stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
    matches,
    lastCompletedAt: matches.length > 0
      ? matches[matches.length - 1].completedAt
      : null,
    errors: {
      profile: profileResult.status === 'rejected' ? profileResult.reason : null,
      stats: statsResult.status === 'rejected' ? statsResult.reason : null,
      matches: matchesResult.status === 'rejected' ? matchesResult.reason : null,
    },
  };
}

export function useProfileData(userId: Accessor<string | undefined>) {
  const [data, { refetch }] = createResource(userId, fetchProfileBundle);

  const [extraMatches, setExtraMatches] = createSignal<MatchRef[]>([]);
  const [lastCursor, setLastCursor] = createSignal<number | null>(null);
  const [loadingMore, setLoadingMore] = createSignal(false);

  // Sync cursor from initial fetch
  createEffect(on(() => data(), (d) => {
    if (d) setLastCursor(d.lastCompletedAt);
  }));

  const allMatches = createMemo<MatchRef[]>(() => {
    const initial = data()?.matches ?? [];
    const extra = extraMatches();
    return [...initial, ...extra];
  });

  const hasMore = createMemo(() => {
    // If we got exactly 10 results, there might be more
    const initial = data()?.matches ?? [];
    const extra = extraMatches();
    const lastBatch = extra.length > 0 ? extra : initial;
    return lastBatch.length >= 10;
  });

  const loadMore = async () => {
    const cursor = lastCursor();
    const uid = userId();
    if (!cursor || !uid || loadingMore()) return;

    setLoadingMore(true);
    try {
      const nextPage = await firestorePlayerStatsRepository.getRecentMatchRefs(uid, 10, cursor);
      if (nextPage.length > 0) {
        setExtraMatches((prev) => [...prev, ...nextPage]);
        setLastCursor(nextPage[nextPage.length - 1].completedAt);
      } else {
        setLastCursor(null); // No more results
      }
    } catch (err) {
      console.warn('Failed to load more matches:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  return { data, allMatches, hasMore, loadMore, loadingMore, refetch };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/profile/__tests__/useProfileData.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/features/profile/hooks/useProfileData.ts src/features/profile/__tests__/useProfileData.test.ts
git commit -m "feat: add useProfileData hook with parallel fetch and pagination"
```

---

## Task 8: ProfilePage Component

**Files:**
- Create: `src/features/profile/ProfilePage.tsx`

**Context:** Orchestrates data loading and renders the three section components. Uses `useAuth()` for current user, `useProfileData()` for Firestore data. Auth-gated by `RequireAuth` in router (Task 11). Follows BuddiesPage pattern: entry animation, loading fallback, empty state, content.

**Step 1: Implement ProfilePage**

Create `src/features/profile/ProfilePage.tsx`:

```typescript
import { Show, onMount, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { BarChart3 } from 'lucide-solid';
import { useAuth } from '../../shared/hooks/useAuth';
import { useProfileData } from './hooks/useProfileData';
import ProfileHeader from './components/ProfileHeader';
import StatsOverview from './components/StatsOverview';
import RecentMatches from './components/RecentMatches';
import EmptyState from '../../shared/components/EmptyState';
import Skeleton from '../../shared/components/Skeleton';

const ProfileSkeleton: Component = () => (
  <div class="space-y-4" role="status" aria-label="Loading profile">
    {/* Header skeleton */}
    <div class="flex flex-col items-center gap-2 py-4">
      <Skeleton class="w-16 h-16 rounded-full" />
      <Skeleton class="h-6 w-32" />
      <Skeleton class="h-4 w-40" />
      <Skeleton class="h-3 w-28" />
    </div>
    {/* Stats skeleton */}
    <Skeleton class="h-24 w-full rounded-xl" />
    <div class="grid grid-cols-3 gap-3">
      <Skeleton class="h-20 rounded-xl" />
      <Skeleton class="h-20 rounded-xl" />
      <Skeleton class="h-20 rounded-xl" />
    </div>
    {/* Matches skeleton */}
    <Skeleton class="h-6 w-32" />
    <Skeleton class="h-48 w-full rounded-xl" />
  </div>
);

const ProfilePage: Component = () => {
  const { user } = useAuth();
  const { data, allMatches, hasMore, loadMore, loadingMore } = useProfileData(() => user()?.uid);

  const hasStats = createMemo(() => {
    const stats = data()?.stats;
    return !!stats && stats.totalMatches > 0;
  });

  let containerRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!containerRef) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      containerRef.style.opacity = '1';
      return;
    }
    containerRef.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 200, easing: 'ease-out', fill: 'forwards' },
    );
  });

  return (
    <div ref={containerRef} style={{ opacity: '0' }} class="max-w-lg mx-auto px-4 pt-2 pb-24">
      <Show when={!data.loading} fallback={<ProfileSkeleton />}>
        {/* Header always shows (Google info available) */}
        <Show when={data()?.profile}>
          <ProfileHeader
            displayName={data()!.profile!.displayName}
            email={data()!.profile!.email}
            photoURL={data()!.profile!.photoURL}
            createdAt={data()!.profile!.createdAt}
            tier={data()?.stats?.tier}
            tierConfidence={data()?.stats?.tierConfidence}
            hasStats={hasStats()}
          />
        </Show>

        {/* Stats + Matches or Empty State */}
        <Show
          when={hasStats()}
          fallback={
            <EmptyState
              icon={<BarChart3 size={28} />}
              title="No matches recorded yet"
              description="Record your first match to see your stats and track progress"
              actionLabel="Start a Match"
              actionHref="/new"
            />
          }
        >
          <div class="space-y-6 mt-4">
            <StatsOverview stats={data()!.stats!} />

            <Show when={allMatches().length > 0}>
              <RecentMatches
                matches={allMatches()}
                onLoadMore={loadMore}
                hasMore={hasMore()}
                loadingMore={loadingMore()}
              />
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default ProfilePage;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/profile/ProfilePage.tsx
git commit -m "feat: add ProfilePage with stats dashboard and recent matches"
```

---

## Task 9: TopNav — Avatar Dropdown Menu

**Files:**
- Modify: `src/shared/components/TopNav.tsx:1-4,38-96`

**Context:** Transform the TopNav avatar area. Signed-out state gets a dropdown with "Sign in" + "Settings". Signed-in state gets "My Profile" + "Settings" + "Sign out".

**Step 1: Update TopNav**

In `src/shared/components/TopNav.tsx`:

1. Add import on line 3 (after the existing `A` import, same line is fine since it's already there):
```typescript
import { User, Settings } from 'lucide-solid';
```

2. Replace the entire auth section (lines 35-100) with:

```typescript
        {/* Right: Auth menu */}
        <Show when={!loading()}>
          <div class="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen())}
              class="flex items-center active:scale-95 transition-transform"
              aria-label="Account menu"
            >
              <Show
                when={user()?.photoURL}
                fallback={
                  <div class={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    user() ? 'bg-primary text-surface' : 'bg-surface-lighter text-on-surface-muted'
                  }`}>
                    {user()?.displayName?.charAt(0) ?? '?'}
                  </div>
                }
              >
                <img
                  src={user()!.photoURL!}
                  alt=""
                  class="w-8 h-8 rounded-full"
                  referrerpolicy="no-referrer"
                />
              </Show>
            </button>

            {/* Dropdown menu */}
            <Show when={menuOpen()}>
              <div
                class="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div class="absolute right-0 top-full mt-2 w-56 bg-surface-light rounded-xl shadow-lg border border-surface-lighter z-50 overflow-hidden">
                <Show when={user()}>
                  {/* Signed-in header */}
                  <div class="px-4 py-3 border-b border-surface-lighter">
                    <div class="font-semibold text-on-surface text-sm truncate">
                      {user()?.displayName}
                    </div>
                    <div class="text-xs text-on-surface-muted truncate">
                      {user()?.email}
                    </div>
                  </div>
                  {/* My Profile link */}
                  <A
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    class="flex items-center gap-3 w-full px-4 py-3 text-sm text-on-surface hover:bg-surface-lighter transition-colors"
                  >
                    <User size={16} class="text-on-surface-muted" />
                    My Profile
                  </A>
                </Show>

                <Show when={!user()}>
                  {/* Sign in button */}
                  <button
                    type="button"
                    onClick={() => {
                      signIn();
                      setMenuOpen(false);
                    }}
                    class="flex items-center gap-3 w-full px-4 py-3 text-sm text-primary font-semibold hover:bg-surface-lighter transition-colors"
                  >
                    Sign in with Google
                  </button>
                </Show>

                {/* Settings link (always visible) */}
                <A
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  class="flex items-center gap-3 w-full px-4 py-3 text-sm text-on-surface-muted hover:bg-surface-lighter transition-colors"
                >
                  <Settings size={16} />
                  Settings
                </A>

                <Show when={user()}>
                  {/* Sign out button */}
                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      setMenuOpen(false);
                    }}
                    class="flex items-center gap-3 w-full px-4 py-3 text-sm text-on-surface-muted hover:bg-surface-lighter transition-colors border-t border-surface-lighter"
                  >
                    Sign out
                  </button>
                </Show>
              </div>
            </Show>
          </div>
        </Show>
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/shared/components/TopNav.tsx
git commit -m "feat: add Profile and Settings links to TopNav avatar dropdown menu"
```

---

## Task 10: BottomNav — Remove Settings Tab

**Files:**
- Modify: `src/shared/components/BottomNav.tsx:4,76-81`

**Step 1: Remove Settings tab**

In `src/shared/components/BottomNav.tsx`:

1. Remove `Settings` from the lucide-solid import on line 4:
```typescript
import { Plus, Clock, Users, Sparkles, Heart } from 'lucide-solid';
```

2. Delete the Settings tab block (lines 76-81):
```typescript
        <A href="/settings" class={linkClass('/settings')} aria-current={isActive('/settings') ? 'page' : undefined} aria-label="Settings">
          <Show when={isActive('/settings')}>
            <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
          </Show>
          <Settings size={24} class="relative" />
          <span class="relative">Settings</span>
        </A>
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/shared/components/BottomNav.tsx
git commit -m "refactor: remove Settings tab from BottomNav (moved to TopNav menu)"
```

---

## Task 11: Router — Add `/profile` Route

**Files:**
- Modify: `src/app/router.tsx:6,38`

**Step 1: Add ProfilePage lazy import and route**

In `src/app/router.tsx`:

1. Add lazy import after line 16 (after BuddiesPage):
```typescript
const ProfilePage = lazy(() => import('../features/profile/ProfilePage'));
```

2. Add route inside the Router, before the `/settings` route (before line 66):
```typescript
      <Route path="/profile" component={RequireAuth}>
        <Route path="/" component={ProfilePage} />
      </Route>
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/router.tsx
git commit -m "feat: add /profile route with RequireAuth gate"
```

---

## Task 12: Final Verification

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (should be ~580+)

**Step 3: Verify all new files exist**

```bash
ls -la src/features/profile/ProfilePage.tsx
ls -la src/features/profile/hooks/useProfileData.ts
ls -la src/features/profile/components/ProfileHeader.tsx
ls -la src/features/profile/components/StatsOverview.tsx
ls -la src/features/profile/components/RecentMatches.tsx
ls -la src/features/profile/components/TierBadge.tsx
ls -la src/features/profile/__tests__/TierBadge.test.ts
ls -la src/features/profile/__tests__/useProfileData.test.ts
```

**Step 4: Start dev server and verify visually**

Run: `npx vite --port 5199`
Expected: App loads, TopNav avatar menu shows Profile/Settings links, `/profile` page renders with skeleton → content flow.

**Step 5: Check git log for clean commit history**

Run: `git log --oneline -14`
Expected: Clean series of `feat:` commits, one per task

---

## Summary

| Task | What | New Tests |
|------|------|-----------|
| 1 | `getStatsSummary()` read method | ~2 |
| 2 | `getRecentMatchRefs()` read method | ~4 |
| 3 | TierBadge component + tier color mapping | ~7 |
| 4 | ProfileHeader component | 0 (presentation) |
| 5 | StatsOverview component | 0 (presentation) |
| 6 | RecentMatches component | 0 (presentation) |
| 7 | useProfileData hook + fetchProfileBundle | ~5 |
| 8 | ProfilePage orchestration | 0 (verified by type check) |
| 9 | TopNav avatar dropdown menu | 0 (verified by type check) |
| 10 | BottomNav remove Settings tab | 0 (verified by type check) |
| 11 | Router add /profile route | 0 (verified by type check) |
| 12 | Final verification | 0 (run existing) |

**Estimated new tests: ~18**
**Total after: ~590+**
