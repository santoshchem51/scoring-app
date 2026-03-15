# Layer 8: Spectator Experience — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable courtside and remote spectators to watch live tournament matches via public URLs with real-time scoreboards, play-by-play feeds, and match analytics.

**Architecture:** Enhance existing `PublicTournamentPage` with a "Live Now" section, add a new lazy-loaded `PublicMatchPage` at `/t/:code/match/:matchId`. Use a public projection subdoc (`/matches/{id}/public/spectator`) to expose only sanitized data. All spectator views are read-only, no auth required.

**Tech Stack:** SolidJS, Firebase Firestore (onSnapshot), Vitest, Playwright, CSS containment, inline SVG

**Design doc:** `docs/plans/2026-03-14-layer8-spectator-experience-design.md`

---

## Wave Structure

| Wave | Scope | Tasks |
|------|-------|-------|
| **A: Foundation** | Data model, security rules, share code hardening, engine functions | Tasks 1-8 |
| **B: Match Page** | PublicMatchPage, SpectatorScoreboard, PlayByPlayFeed, MatchAnalytics | Tasks 9-16 |
| **C: Tournament Hub** | LiveNowSection, phase indicator, overflow handling | Tasks 17-21 |
| **D: Polish & Launch** | Spectator count, App Check, privacy policy, RTDB rules, E2E tests | Tasks 22-26 |

---

## Wave A: Foundation

### Task 1: Share Code Hardening

**Files:**
- Modify: `src/features/tournaments/engine/shareCode.ts`
- Modify: `src/features/tournaments/engine/__tests__/shareCode.test.ts`

**Step 1: Update failing test for 8-char crypto-random codes**

```typescript
// In shareCode.test.ts — update existing tests
import { generateShareCode, SHARE_CODE_CHARS } from '../shareCode';

describe('generateShareCode', () => {
  it('generates an 8-character code', () => {
    const code = generateShareCode();
    expect(code).toHaveLength(8);
  });

  it('uses only valid characters', () => {
    const code = generateShareCode();
    for (const ch of code) {
      expect(SHARE_CODE_CHARS).toContain(ch);
    }
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateShareCode()));
    expect(codes.size).toBe(100);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/engine/__tests__/shareCode.test.ts`
Expected: FAIL — code length is 6, not 8

**Step 3: Update implementation**

```typescript
// shareCode.ts
export const SHARE_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateShareCode(length = 8): string {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SHARE_CODE_CHARS[values[i] % SHARE_CODE_CHARS.length];
  }
  return code;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/shareCode.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/shareCode.ts src/features/tournaments/engine/__tests__/shareCode.test.ts
git commit -m "feat(l8): harden share codes to 8-char crypto-random"
```

---

### Task 2: Score Extraction Engine

Extract the score extraction logic from `LiveScoreCard` into a reusable pure function.

**Files:**
- Create: `src/features/tournaments/engine/scoreExtraction.ts`
- Create: `src/features/tournaments/engine/__tests__/scoreExtraction.test.ts`
- Modify: `src/features/tournaments/components/LiveScoreCard.tsx` (use extracted function)

**Step 1: Write failing tests**

```typescript
// scoreExtraction.test.ts
import { describe, it, expect } from 'vitest';
import { extractLiveScore, extractGameCount } from '../scoreExtraction';
import type { Match } from '../../../../data/types';

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'test', config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'best-of-3', pointsToWin: 11 },
    team1PlayerIds: [], team2PlayerIds: [], team1Name: 'A', team2Name: 'B',
    games: [], winningSide: null, status: 'in-progress', startedAt: Date.now(), completedAt: null,
    ...overrides,
  };
}

describe('extractLiveScore', () => {
  it('returns 0-0 for undefined match', () => {
    expect(extractLiveScore(undefined)).toEqual({ team1Score: 0, team2Score: 0 });
  });

  it('parses lastSnapshot for in-progress match', () => {
    const match = makeMatch({
      status: 'in-progress',
      lastSnapshot: JSON.stringify({ team1Score: 7, team2Score: 5 }),
    });
    expect(extractLiveScore(match)).toEqual({ team1Score: 7, team2Score: 5 });
  });

  it('falls back to last completed game', () => {
    const match = makeMatch({
      status: 'in-progress',
      games: [{ team1Score: 11, team2Score: 7, startedAt: 0, completedAt: 1 }],
    });
    expect(extractLiveScore(match)).toEqual({ team1Score: 11, team2Score: 7 });
  });

  it('handles malformed lastSnapshot JSON', () => {
    const match = makeMatch({ status: 'in-progress', lastSnapshot: 'bad json' });
    expect(extractLiveScore(match)).toEqual({ team1Score: 0, team2Score: 0 });
  });

  it('returns 0-0 for match with no games and no snapshot', () => {
    expect(extractLiveScore(makeMatch())).toEqual({ team1Score: 0, team2Score: 0 });
  });
});

describe('extractGameCount', () => {
  it('returns 0-0 for no completed games', () => {
    expect(extractGameCount(makeMatch())).toEqual({ team1Wins: 0, team2Wins: 0 });
  });

  it('counts wins from completed games', () => {
    const match = makeMatch({
      games: [
        { team1Score: 11, team2Score: 7, startedAt: 0, completedAt: 1 },
        { team1Score: 5, team2Score: 11, startedAt: 2, completedAt: 3 },
      ],
    });
    expect(extractGameCount(match)).toEqual({ team1Wins: 1, team2Wins: 1 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/engine/__tests__/scoreExtraction.test.ts`
Expected: FAIL — module not found

**Step 3: Implement**

```typescript
// scoreExtraction.ts
import type { Match } from '../../../data/types';

export interface LiveScore {
  team1Score: number;
  team2Score: number;
}

export interface GameCount {
  team1Wins: number;
  team2Wins: number;
}

export function extractLiveScore(match: Match | undefined): LiveScore {
  if (!match) return { team1Score: 0, team2Score: 0 };

  if (match.lastSnapshot && match.status === 'in-progress') {
    try {
      const snap = typeof match.lastSnapshot === 'string'
        ? JSON.parse(match.lastSnapshot)
        : match.lastSnapshot;
      return { team1Score: snap.team1Score ?? 0, team2Score: snap.team2Score ?? 0 };
    } catch { /* fall through */ }
  }

  if (match.games.length > 0) {
    const last = match.games[match.games.length - 1];
    return { team1Score: last.team1Score, team2Score: last.team2Score };
  }

  return { team1Score: 0, team2Score: 0 };
}

export function extractGameCount(match: Match | undefined): GameCount {
  if (!match || match.games.length === 0) return { team1Wins: 0, team2Wins: 0 };

  let team1Wins = 0;
  let team2Wins = 0;
  for (const game of match.games) {
    if (game.team1Score > game.team2Score) team1Wins++;
    else if (game.team2Score > game.team1Score) team2Wins++;
  }
  return { team1Wins, team2Wins };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/scoreExtraction.test.ts`
Expected: PASS

**Step 5: Update LiveScoreCard to use extracted function**

Replace the inline `liveScore` and `gameCount` computations in `LiveScoreCard.tsx` (lines 14-42) with imports from `scoreExtraction.ts`. The rendered output should be identical.

**Step 6: Run existing tests to verify no regression**

Run: `npx vitest run`
Expected: All existing tests PASS

**Step 7: Commit**

```bash
git add src/features/tournaments/engine/scoreExtraction.ts src/features/tournaments/engine/__tests__/scoreExtraction.test.ts src/features/tournaments/components/LiveScoreCard.tsx
git commit -m "refactor(l8): extract score extraction logic into reusable engine function"
```

---

### Task 3: Match Filtering Engine

**Files:**
- Create: `src/features/tournaments/engine/matchFiltering.ts`
- Create: `src/features/tournaments/engine/__tests__/matchFiltering.test.ts`

**Step 1: Write failing tests**

```typescript
// matchFiltering.test.ts
import { describe, it, expect } from 'vitest';
import { getInProgressMatches } from '../matchFiltering';
import type { TournamentPool, BracketSlot } from '../../../../data/types';

describe('getInProgressMatches', () => {
  it('returns empty for no pools and no bracket', () => {
    expect(getInProgressMatches([], [])).toEqual({ poolMatches: [], bracketMatches: [] });
  });

  it('finds pool matches with matchId but no winnerId in schedule', () => {
    const pools: TournamentPool[] = [{
      id: 'p1', tournamentId: 't1', name: 'Pool A', teamIds: ['a', 'b'],
      standings: [],
      schedule: [
        { round: 1, team1Id: 'a', team2Id: 'b', matchId: 'm1', court: '1' },
        { round: 2, team1Id: 'a', team2Id: 'b', matchId: null, court: null },
      ],
    }];
    const result = getInProgressMatches(pools, []);
    expect(result.poolMatches).toHaveLength(1);
    expect(result.poolMatches[0].matchId).toBe('m1');
  });

  it('finds bracket matches with matchId but no winnerId', () => {
    const bracket: BracketSlot[] = [
      { id: 's1', tournamentId: 't1', round: 1, position: 1, team1Id: 'a', team2Id: 'b', matchId: 'm2', winnerId: null, nextSlotId: null },
      { id: 's2', tournamentId: 't1', round: 1, position: 2, team1Id: 'c', team2Id: 'd', matchId: 'm3', winnerId: 'c', nextSlotId: null },
    ];
    const result = getInProgressMatches([], bracket);
    expect(result.bracketMatches).toHaveLength(1);
    expect(result.bracketMatches[0].matchId).toBe('m2');
  });

  it('excludes pool entries without matchId', () => {
    const pools: TournamentPool[] = [{
      id: 'p1', tournamentId: 't1', name: 'Pool A', teamIds: ['a', 'b'],
      standings: [],
      schedule: [{ round: 1, team1Id: 'a', team2Id: 'b', matchId: null, court: null }],
    }];
    const result = getInProgressMatches(pools, []);
    expect(result.poolMatches).toHaveLength(0);
  });
});
```

**Step 2: Run test — FAIL**

**Step 3: Implement**

```typescript
// matchFiltering.ts
import type { TournamentPool, BracketSlot, PoolScheduleEntry } from '../../../data/types';

export interface InProgressMatches {
  poolMatches: (PoolScheduleEntry & { poolName: string })[];
  bracketMatches: BracketSlot[];
}

export function getInProgressMatches(
  pools: TournamentPool[],
  bracket: BracketSlot[],
): InProgressMatches {
  const poolMatches = pools.flatMap((pool) =>
    pool.schedule
      .filter((entry) => entry.matchId != null)
      .map((entry) => ({ ...entry, poolName: pool.name })),
  );

  const bracketMatches = bracket.filter(
    (slot) => slot.matchId != null && slot.winnerId == null,
  );

  return { poolMatches, bracketMatches };
}
```

**Step 4: Run test — PASS**

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/matchFiltering.ts src/features/tournaments/engine/__tests__/matchFiltering.test.ts
git commit -m "feat(l8): add match filtering engine for in-progress matches"
```

---

### Task 4: Match Analytics Engine

**Files:**
- Create: `src/features/tournaments/engine/matchAnalytics.ts`
- Create: `src/features/tournaments/engine/__tests__/matchAnalytics.test.ts`

**Step 1: Write failing tests**

```typescript
// matchAnalytics.test.ts
import { describe, it, expect } from 'vitest';
import { calculateMomentum, detectStreaks, getPointDistribution } from '../matchAnalytics';
import type { ScoreEvent } from '../../../../data/types';

function makeEvent(team: 1 | 2, t1: number, t2: number, type: ScoreEvent['type'] = 'POINT_SCORED'): ScoreEvent {
  return { id: `e-${t1}-${t2}`, matchId: 'm1', gameNumber: 1, timestamp: Date.now(), type, team, team1Score: t1, team2Score: t2 };
}

describe('calculateMomentum', () => {
  it('returns 50/50 for empty events', () => {
    expect(calculateMomentum([])).toEqual({ team1Pct: 50, team2Pct: 50 });
  });

  it('returns 50/50 for non-point events only', () => {
    expect(calculateMomentum([makeEvent(1, 0, 0, 'SIDE_OUT')])).toEqual({ team1Pct: 50, team2Pct: 50 });
  });

  it('calculates from last 10 points', () => {
    const events = [
      makeEvent(1, 1, 0), makeEvent(1, 2, 0), makeEvent(1, 3, 0),
      makeEvent(1, 4, 0), makeEvent(1, 5, 0), makeEvent(1, 6, 0),
      makeEvent(2, 6, 1), makeEvent(2, 6, 2), makeEvent(2, 6, 3), makeEvent(2, 6, 4),
    ];
    expect(calculateMomentum(events)).toEqual({ team1Pct: 60, team2Pct: 40 });
  });
});

describe('detectStreaks', () => {
  it('returns null for empty events', () => {
    expect(detectStreaks([])).toBeNull();
  });

  it('detects a streak of 3+', () => {
    const events = [makeEvent(1, 1, 0), makeEvent(1, 2, 0), makeEvent(1, 3, 0)];
    expect(detectStreaks(events)).toEqual({ team: 1, length: 3 });
  });

  it('returns null for streak under 3', () => {
    const events = [makeEvent(1, 1, 0), makeEvent(2, 1, 1)];
    expect(detectStreaks(events)).toBeNull();
  });
});

describe('getPointDistribution', () => {
  it('returns empty for no events', () => {
    expect(getPointDistribution([])).toEqual({ team1: 0, team2: 0 });
  });

  it('counts points per team', () => {
    const events = [makeEvent(1, 1, 0), makeEvent(1, 2, 0), makeEvent(2, 2, 1)];
    expect(getPointDistribution(events)).toEqual({ team1: 2, team2: 1 });
  });
});
```

**Step 2: Run test — FAIL**

**Step 3: Implement**

```typescript
// matchAnalytics.ts
import type { ScoreEvent } from '../../../data/types';

export interface Momentum { team1Pct: number; team2Pct: number; }
export interface Streak { team: 1 | 2; length: number; }

export function calculateMomentum(events: ScoreEvent[], window = 10): Momentum {
  const points = events.filter((e) => e.type === 'POINT_SCORED');
  if (points.length === 0) return { team1Pct: 50, team2Pct: 50 };

  const recent = points.slice(-window);
  const t1 = recent.filter((e) => e.team === 1).length;
  const total = recent.length;
  const team1Pct = Math.round((t1 / total) * 100);
  return { team1Pct, team2Pct: 100 - team1Pct };
}

export function detectStreaks(events: ScoreEvent[]): Streak | null {
  const points = events.filter((e) => e.type === 'POINT_SCORED');
  if (points.length < 3) return null;

  let streak = 1;
  for (let i = points.length - 1; i > 0; i--) {
    if (points[i].team === points[i - 1].team) {
      streak++;
    } else {
      break;
    }
  }

  if (streak >= 3) return { team: points[points.length - 1].team, length: streak };
  return null;
}

export function getPointDistribution(events: ScoreEvent[]): { team1: number; team2: number } {
  const points = events.filter((e) => e.type === 'POINT_SCORED');
  const team1 = points.filter((e) => e.team === 1).length;
  const team2 = points.filter((e) => e.team === 2).length;
  return { team1, team2 };
}
```

**Step 4: Run test — PASS**

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/matchAnalytics.ts src/features/tournaments/engine/__tests__/matchAnalytics.test.ts
git commit -m "feat(l8): add match analytics engine (momentum, streaks, distribution)"
```

---

### Task 5: Visibility Propagation in Cloud Sync

**Files:**
- Modify: `src/data/firebase/cloudSync.ts` (add visibility param to syncMatchToCloud)
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx` (pass visibility: 'public')
- Modify: `src/data/firebase/firestoreMatchRepository.ts` (accept visibility in toCloudMatch)

**Step 1: Update cloudSync.syncMatchToCloud signature**

Add `visibility?: MatchVisibility` to the function and thread it through to `enqueueJob`:

```typescript
syncMatchToCloud(match: Match, sharedWith: string[] = [], visibility: MatchVisibility = 'private'): void {
  const user = auth.currentUser;
  if (!user) return;
  enqueueJob('match', match.id, {
    type: 'match',
    ownerId: user.uid,
    sharedWith,
    visibility,
  }).catch((err) => {
    console.warn('Failed to enqueue match sync:', match.id, err);
  });
}
```

**Step 2: Update TournamentDashboardPage match creation (around line 585)**

Change: `cloudSync.syncMatchToCloud(match);`
To: `cloudSync.syncMatchToCloud(match, [], 'public');`

**Step 3: Update firestoreMatchRepository.toCloudMatch to use passed visibility**

Ensure the `visibility` from the sync job payload overrides the default `'private'`.

**Step 4: Run existing tests**

Run: `npx vitest run`
Expected: All existing tests PASS

**Step 5: Commit**

```bash
git add src/data/firebase/cloudSync.ts src/features/tournaments/TournamentDashboardPage.tsx src/data/firebase/firestoreMatchRepository.ts
git commit -m "feat(l8): thread visibility through cloud sync for public tournament matches"
```

---

### Task 6: Public Spectator Projection Subdoc

**Files:**
- Create: `src/data/firebase/firestoreSpectatorRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreSpectatorRepository.test.ts`

**Step 1: Write failing tests**

```typescript
// firestoreSpectatorRepository.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config', () => ({
  firestore: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
}));

import { buildSpectatorProjection } from '../firestoreSpectatorRepository';
import type { Match } from '../../types';

describe('buildSpectatorProjection', () => {
  it('builds projection with sanitized names', () => {
    const match: Partial<Match> = {
      id: 'm1', status: 'in-progress', tournamentId: 't1',
      team1Name: 'Sarah M.', team2Name: 'Mike T.',
      games: [], lastSnapshot: JSON.stringify({ team1Score: 5, team2Score: 3 }),
    };
    const result = buildSpectatorProjection(
      match as Match,
      { publicTeam1Name: 'Sarah M.', publicTeam2Name: 'Player B' },
      'ABC12345',
    );
    expect(result.publicTeam1Name).toBe('Sarah M.');
    expect(result.publicTeam2Name).toBe('Player B');
    expect(result.tournamentShareCode).toBe('ABC12345');
    expect(result).not.toHaveProperty('team1PlayerIds');
    expect(result).not.toHaveProperty('ownerUid');
    expect(result).not.toHaveProperty('sharedWith');
  });
});
```

**Step 2: Run test — FAIL**

**Step 3: Implement**

```typescript
// firestoreSpectatorRepository.ts
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from './config';
import type { Match } from '../types';
import { extractLiveScore, extractGameCount } from '../../features/tournaments/engine/scoreExtraction';

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
  tournamentShareCode: string;
  spectatorCount: number;
  updatedAt: number;
}

export function buildSpectatorProjection(
  match: Match,
  names: { publicTeam1Name: string; publicTeam2Name: string },
  shareCode: string,
): SpectatorProjection {
  const { team1Score, team2Score } = extractLiveScore(match);
  const { team1Wins, team2Wins } = extractGameCount(match);
  const snapshot = match.lastSnapshot ? (() => {
    try { return JSON.parse(match.lastSnapshot as string); } catch { return null; }
  })() : null;

  return {
    publicTeam1Name: names.publicTeam1Name,
    publicTeam2Name: names.publicTeam2Name,
    team1Score,
    team2Score,
    gameNumber: snapshot?.gameNumber ?? match.games.length + 1,
    team1Wins,
    team2Wins,
    status: match.status,
    visibility: 'public',
    tournamentId: match.tournamentId ?? '',
    tournamentShareCode: shareCode,
    spectatorCount: 0,
    updatedAt: Date.now(),
  };
}

export async function writeSpectatorProjection(matchId: string, projection: SpectatorProjection): Promise<void> {
  const ref = doc(firestore, 'matches', matchId, 'public', 'spectator');
  await setDoc(ref, projection);
}
```

**Step 4: Run test — PASS**

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreSpectatorRepository.ts src/data/firebase/__tests__/firestoreSpectatorRepository.test.ts
git commit -m "feat(l8): add spectator projection builder and repository"
```

---

### Task 7: Security Rules — Spectator Subdoc + Field Deny-List

**Files:**
- Modify: `firestore.rules`
- Modify: `test/rules/firestore.test.ts` (or create `test/rules/spectator.test.ts`)

**Step 1: Write failing security rules tests**

Add a new describe block for spectator rules. Test:
- Unauthenticated read of `/matches/{id}/public/spectator` → ALLOWED
- Unauthenticated create/update/delete → DENIED
- Non-owner create/update/delete → DENIED
- Unfiltered scoreEvent collection query without `where` → DENIED
- Match update with protected field (`spectatorCount`) → DENIED
- Match update with only legitimate fields → ALLOWED

**Step 2: Run tests — FAIL**

**Step 3: Update firestore.rules**

Add spectator subdoc rules:
```
match /matches/{matchId}/public/{docId} {
  allow read: if true;
  allow write: if false; // Only Cloud Functions (admin SDK) can write
}
```

Add field deny-list to match update rule:
```
allow update: if isMatchOwner()
  && !request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['spectatorCount', 'tournamentShareCode', 'publicTeam1Name', 'publicTeam2Name']);
```

Add `visibility` stamp to scoreEvent docs and read rule:
```
match /matches/{matchId}/scoreEvents/{eventId} {
  allow read: if resource.data.visibility == 'public'
            || isMatchOwnerOrShared();
}
```

**Step 4: Run tests — PASS**

**Step 5: Commit**

```bash
git add firestore.rules test/rules/spectator.test.ts
git commit -m "feat(l8): add security rules for spectator subdoc and field deny-list"
```

---

### Task 8: Expand Public Tier Doc + RTDB Deny-All

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts` (expand `writePublicTier`)
- Modify: `firestore.rules` (conditional read on profileVisibility)
- Create: `database.rules.json` (RTDB deny-all placeholder)
- Add security rules tests for conditional public tier read

**Step 1: Write failing rules tests for conditional public tier read**

Test: unauthenticated read when `profileVisibility: 'public'` → ALLOWED, when `'private'` → DENIED, when field missing → DENIED.

**Step 2: Run tests — FAIL**

**Step 3: Update firestore.rules**

```
match /users/{userId}/public/{docId} {
  allow read: if resource.data.profileVisibility == 'public'
            || (request.auth != null && request.auth.uid == userId);
  allow create, update: if request.auth != null
    && request.auth.uid == userId;
  allow delete: if false;
}
```

**Step 4: Expand writePublicTier function**

```typescript
async function writePublicTier(
  uid: string,
  tier: Tier,
  displayName?: string,
  profileVisibility?: 'public' | 'private',
): Promise<void> {
  const data: Record<string, unknown> = { tier };
  if (displayName !== undefined) data.displayName = displayName;
  if (profileVisibility !== undefined) data.profileVisibility = profileVisibility;
  await setDoc(doc(firestore, 'users', uid, 'public', 'tier'), data, { merge: true });
}
```

**Step 5: Create database.rules.json**

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

**Step 6: Run tests — PASS**

**Step 7: Commit**

```bash
git add firestore.rules database.rules.json src/data/firebase/firestorePlayerStatsRepository.ts test/rules/
git commit -m "feat(l8): expand public tier doc with conditional reads + RTDB deny-all"
```

---

## Wave B: Match Page

### Task 9: useScoreEventStream Hook

**Files:**
- Create: `src/features/tournaments/hooks/useScoreEventStream.ts`
- Create: `src/features/tournaments/hooks/__tests__/useScoreEventStream.test.ts`

Single `onSnapshot` on full scoreEvents subcollection. Includes visibility-aware listener with 500ms debounce and generation counter for cleanup.

**Step 1: Write failing hook tests** — mock `onSnapshot`, verify subscription, cleanup, visibility-change detach/reattach.

**Step 2: Run tests — FAIL**

**Step 3: Implement hook** — `onSnapshot` on `collection(firestore, 'matches', matchId, 'scoreEvents')` ordered by timestamp. Wrap with visibility-change listener. Generation counter prevents stale callbacks.

**Step 4: Run tests — PASS**

**Step 5: Commit**

---

### Task 10: useVisibilityAwareListener Hook

**Files:**
- Create: `src/shared/hooks/useVisibilityAwareListener.ts`
- Create: `src/shared/hooks/__tests__/useVisibilityAwareListener.test.ts`

Generic hook that detaches/reattaches Firestore listeners on `document.visibilitychange` with 500ms debounce.

**Step 1-5: TDD cycle**

---

### Task 11: SpectatorScoreboard Component

**Files:**
- Create: `src/features/tournaments/components/SpectatorScoreboard.tsx`
- Create: `src/features/tournaments/components/__tests__/SpectatorScoreboard.test.tsx`

120px singles / 148px doubles. Score digits with `tabular-nums`, LIVE text + red dot, serving indicator, game pills, contextual info row. Pseudo-element opacity flash on score change. Segmented control merged into header.

CSS: `contain: layout style paint`, `100dvh` flex layout, `clamp(48px, 10vw, 64px)` scores, `min-width: 1.2ch`.

Accessibility: `role="region"`, dedicated sr-only announcer div with `aria-live="polite"`, 3s debounce. Assertive announcements for game/match end.

**Step 1-5: TDD cycle** — test loading/error/null states, score rendering, doubles layout, privacy anonymization, aria attributes.

---

### Task 12: PlayByPlayFeed Component

**Files:**
- Create: `src/features/tournaments/components/PlayByPlayFeed.tsx`
- Create: `src/features/tournaments/components/__tests__/PlayByPlayFeed.test.tsx`

`<For each={events()}>` with `contain: content` per row. Auto-scroll with rAF debounce, instant scroll when updates <400ms apart. Pause on touch/wheel/focus. "Jump to live (N new)" pill via `position: fixed` + IntersectionObserver.

Semantic: `role="log"`, `aria-relevant="additions"`.

**Step 1-5: TDD cycle** — test event rendering, empty state, auto-scroll behavior, pause on interaction, role attribute.

---

### Task 13: MatchAnalytics Component

**Files:**
- Create: `src/features/tournaments/components/MatchAnalytics.tsx`
- Create: `src/features/tournaments/components/__tests__/MatchAnalytics.test.tsx`

CSS momentum bar (flexbox, team colors + % labels). Run of play with ● and ■ shapes. Streak text. Inline SVG point distribution with `scaleY` transitions. Hidden `<table>` for screen reader access.

**Step 1-5: TDD cycle**

---

### Task 14: Segmented Control Component

**Files:**
- Create: `src/features/tournaments/components/SegmentedControl.tsx`
- Create: `src/features/tournaments/components/__tests__/SegmentedControl.test.tsx`

Reusable `role="tablist"` / `role="tab"` / `role="tabpanel"` with arrow key navigation, `aria-selected`, proper `tabindex` management. Compact pill style, 32-36px height.

**Step 1-5: TDD cycle** — test ARIA attributes, keyboard navigation, visual selection state.

---

### Task 15: PublicMatchPage

**Files:**
- Create: `src/features/tournaments/PublicMatchPage.tsx`
- Modify: `src/app/router.tsx` (add lazy route)

Lazy-loaded page at `/t/:code/match/:matchId`. Resolves share code → tournament, validates `match.tournamentId === tournament.id`. Composes SpectatorScoreboard + SegmentedControl + PlayByPlayFeed/MatchAnalytics.

Preconnect to Firebase in `index.html`. Skeleton scoreboard via `<Suspense fallback>`.

**Step 1: Add route to router.tsx**

After line 53 (`/t/:code`), add:
```typescript
const PublicMatchPage = lazy(() => import('../features/tournaments/PublicMatchPage'));
// In routes:
<Route path="/t/:code/match/:matchId" component={PublicMatchPage} />
```

**Step 2: Implement page with composition of previous components**

**Step 3: Component test for routing validation (mismatch → 404)**

**Step 4: Commit**

---

### Task 16: Wire Spectator Projection to Scoring Actor

**Files:**
- Modify: scoring flow to write/update `/matches/{id}/public/spectator` alongside `lastSnapshot`

When a tournament match score changes, update the spectator projection subdoc with current scores. This keeps the public view in sync without spectators needing to read the main match doc.

**Step 1-5: TDD cycle**

---

## Wave C: Tournament Hub

### Task 17: LiveNowSection Component

**Files:**
- Create: `src/features/tournaments/components/LiveNowSection.tsx`
- Create: `src/features/tournaments/components/__tests__/LiveNowSection.test.tsx`

Shows in-progress matches with inline scores, capped at 3 visible cards. Match cards as `<a>` elements with comprehensive `aria-label`. Status badges for LIVE/FINAL/UPCOMING. Overflow indicator "N more live →".

**Step 1-5: TDD cycle** — test shows/hides based on matches, cap at 3, overflow indicator, status badges, `<a>` elements with correct hrefs, empty state.

---

### Task 18: Tournament Phase Indicator

**Files:**
- Modify: `src/features/tournaments/PublicTournamentPage.tsx`

Single line above LiveNowSection: "Pool Play · Round 3 of 4 · 8 live". Derived from tournament status and match counts.

**Step 1-5: TDD cycle**

---

### Task 19: Integrate LiveNowSection into PublicTournamentPage

**Files:**
- Modify: `src/features/tournaments/PublicTournamentPage.tsx`

Add LiveNowSection between status card and pool tables. Wire up `getInProgressMatches` from pools/bracket data. Pass `teamNames` memo. Add conditional sticky (≤3 matches) vs scrollable + FAB (4+).

**Step 1-5: TDD cycle**

---

### Task 20: "Up Next" State

**Files:**
- Modify: `src/features/tournaments/components/LiveNowSection.tsx`

When no matches are in progress, show next 2-3 scheduled matches with team names, relative time, court, UPCOMING badge. Transition cross-fade (300ms) between Up Next and Live Now.

**Step 1-5: TDD cycle**

---

### Task 21: Completed Match Retention

**Files:**
- Modify: `src/features/tournaments/components/LiveNowSection.tsx`

Keep finished match visible for 5 minutes with FINAL badge + green border. Use `setTimeout` to remove, clear on component cleanup.

**Step 1-5: TDD cycle**

---

## Wave D: Polish & Launch

### Task 22: Privacy Sanitization Flow

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

When creating a tournament match, read participating players' `/users/{uid}/public/tier` docs. Check `profileVisibility`. Write sanitized names to spectator projection subdoc. Non-consenting → "Team A" / "Team B".

**Step 1-5: TDD cycle**

---

### Task 23: Registration Privacy Rules

**Files:**
- Modify: `firestore.rules` (remove `isTournamentPublic()` from registration read rules)
- Add security rules tests

Ensure unauthenticated users cannot read tournament registrations (which contain real names and skill ratings).

**Step 1-5: TDD cycle**

---

### Task 24: Firebase App Check Setup

**Files:**
- Modify: `src/data/firebase/config.ts`
- Create: `.env` entries for reCAPTCHA site key

Initialize App Check with reCAPTCHA Enterprise provider. Debug token for development. CSP header updates in `firebase.json`.

Deploy in Monitor mode first.

---

### Task 25: Privacy Policy + Consent Disclosure

**Files:**
- Add privacy policy link to spectator page footers
- Update `profileVisibility` toggle UI text to enumerate: name on scoreboards, match scores, play-by-play timing data

---

### Task 26: E2E Tests

**Files:**
- Create: `e2e/spectator/hub.spec.ts`
- Create: `e2e/spectator/match.spec.ts`
- Modify: `e2e/helpers/factories.ts` (add `makeScoreEvent`, `makePublicMatch`, `makeSpectatorSubdoc`)

11 E2E tests as specified in design doc Section 5:
- Hub navigation, match navigation, cross-tab real-time sync, play-by-play touch pause, privacy anonymization, match completion transition, doubles layout, hub overflow, reduced motion, segmented control keyboard, unauthenticated access.

Test infrastructure: `clearFirestoreEmulator()` per file, unique IDs, auto-retrying assertions, `trace: 'on-first-retry'`.

---

## Estimated Total

| Category | Count |
|----------|-------|
| Unit tests | ~25 |
| Component tests | ~30 |
| Hook tests | ~15 |
| Security rules tests | ~35 |
| E2E tests | ~11 |
| **Total** | **~115 tests** |
| **Tasks** | **26** |
| **Waves** | **4** |
