# Casual Phase 2: Buddy Picker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let scorers assign buddy group members to teams during casual game setup, so all linked players get stats and can see the match in their history.

**Architecture:** Collapsible "Add Players" section on GameSetupPage with deferred buddy loading, action sheet for team assignment, and cloud sync changes for shared match visibility. State owned by parent (GameSetupPage), components are pure presentational.

**Tech Stack:** SolidJS 1.9, TypeScript, Vitest, @solidjs/testing-library, Firestore, Dexie.js, Tailwind CSS v4, Playwright (E2E)

**Design Doc:** `docs/plans/2026-03-03-casual-phase2-buddy-picker-design.md`

---

## Task 1: Cloud Sync — `sharedWith` Parameter Threading

**Files:**
- Modify: `src/data/firebase/firestoreMatchRepository.ts:27-46`
- Modify: `src/data/firebase/cloudSync.ts:15-21`
- Test: `src/data/firebase/__tests__/cloudSync.test.ts`
- Test: `src/data/firebase/__tests__/firestoreMatchRepository.test.ts` (create)

### Step 1: Write failing tests for `toCloudMatch` and `syncMatchToCloud`

**File: `src/data/firebase/__tests__/firestoreMatchRepository.test.ts`** (create)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDocs = vi.fn();
const mockDoc = vi.fn().mockReturnValue({ id: 'mock-ref' });
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  deleteDoc: vi.fn(),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
}));

vi.mock('./config', () => ({
  firestore: {},
}));

import { firestoreMatchRepository } from '../firestoreMatchRepository';
import type { Match } from '../../types';

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    config: { gameType: 'doubles', scoringMode: 'side-out', matchFormat: 'single', pointsToWin: 11 },
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Name: 'Team 1',
    team2Name: 'Team 2',
    games: [],
    winningSide: null,
    status: 'in-progress',
    startedAt: Date.now(),
    completedAt: null,
    ...overrides,
  };
}

describe('firestoreMatchRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('save', () => {
    it('defaults sharedWith to empty array when not provided', async () => {
      const match = makeMatch();
      await firestoreMatchRepository.save(match, 'owner-uid');

      const savedData = mockSetDoc.mock.calls[0][1];
      expect(savedData.sharedWith).toEqual([]);
    });

    it('uses provided sharedWith array', async () => {
      const match = makeMatch();
      await firestoreMatchRepository.save(match, 'owner-uid', ['buddy-1', 'buddy-2']);

      const savedData = mockSetDoc.mock.calls[0][1];
      expect(savedData.sharedWith).toEqual(['buddy-1', 'buddy-2']);
    });
  });

  describe('getBySharedWith', () => {
    it('returns matches where user is in sharedWith', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'm1', data: () => ({ id: 'm1', ownerId: 'other', sharedWith: ['user-1'] }) },
        ],
      });

      const results = await firestoreMatchRepository.getBySharedWith('user-1');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('m1');
    });

    it('returns empty array when no shared matches', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const results = await firestoreMatchRepository.getBySharedWith('user-1');
      expect(results).toEqual([]);
    });
  });
});
```

**Add to `src/data/firebase/__tests__/cloudSync.test.ts`** (append to existing file):

```typescript
describe('syncMatchToCloud with sharedWith', () => {
  it('passes sharedWith to firestoreMatchRepository.save when provided', () => {
    const match = makeCasualMatch();
    cloudSync.syncMatchToCloud(match, ['buddy-1', 'buddy-2']);

    expect(mockFirestoreMatchRepository.save).toHaveBeenCalledWith(
      match,
      'test-user-uid',
      ['buddy-1', 'buddy-2'],
    );
  });

  it('defaults to empty sharedWith when not provided (backward compat)', () => {
    const match = makeCasualMatch();
    cloudSync.syncMatchToCloud(match);

    expect(mockFirestoreMatchRepository.save).toHaveBeenCalledWith(
      match,
      'test-user-uid',
      [],
    );
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx vitest run src/data/firebase/__tests__/firestoreMatchRepository.test.ts --reporter=verbose
npx vitest run src/data/firebase/__tests__/cloudSync.test.ts --reporter=verbose
```

Expected: FAIL — `save` doesn't accept 3rd param, `getBySharedWith` doesn't exist, `syncMatchToCloud` doesn't accept 2nd param.

### Step 3: Implement the changes

**File: `src/data/firebase/firestoreMatchRepository.ts`**

Replace `toCloudMatch` (lines 27-36):
```typescript
function toCloudMatch(
  match: Match,
  ownerId: string,
  sharedWith: string[] = [],
  visibility: MatchVisibility = 'private',
): CloudMatch {
  const raw = {
    ...match,
    ownerId,
    sharedWith,
    visibility,
    syncedAt: Date.now(),
  };
  return stripUndefined(raw as unknown as Record<string, unknown>) as unknown as CloudMatch;
}
```

Replace `save` method (lines 39-46):
```typescript
async save(match: Match, ownerId: string, sharedWith: string[] = []): Promise<void> {
  const ref = doc(firestore, 'matches', match.id);
  const cloudMatch = toCloudMatch(match, ownerId, sharedWith);
  await setDoc(ref, {
    ...cloudMatch,
    updatedAt: serverTimestamp(),
  });
},
```

Add `getBySharedWith` method (after `getByOwner`):
```typescript
async getBySharedWith(userId: string): Promise<CloudMatch[]> {
  const q = query(
    collection(firestore, 'matches'),
    where('sharedWith', 'array-contains', userId),
    orderBy('startedAt', 'desc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CloudMatch);
},
```

**File: `src/data/firebase/cloudSync.ts`**

Replace `syncMatchToCloud` (lines 15-21):
```typescript
syncMatchToCloud(match: Match, sharedWith: string[] = []): void {
  const user = auth.currentUser;
  if (!user) return;
  firestoreMatchRepository.save(match, user.uid, sharedWith).catch((err) => {
    console.warn('Cloud sync failed for match:', match.id, err);
  });
},
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/data/firebase/__tests__/firestoreMatchRepository.test.ts --reporter=verbose
npx vitest run src/data/firebase/__tests__/cloudSync.test.ts --reporter=verbose
```

Expected: ALL PASS

### Step 5: Commit

```bash
git add src/data/firebase/firestoreMatchRepository.ts src/data/firebase/cloudSync.ts src/data/firebase/__tests__/firestoreMatchRepository.test.ts src/data/firebase/__tests__/cloudSync.test.ts
git commit -m "feat(cloud-sync): thread sharedWith param through toCloudMatch and syncMatchToCloud"
```

---

## Task 2: Cloud Sync — Merged Pull with Deduplication

**Files:**
- Modify: `src/data/firebase/cloudSync.ts:39-79`
- Test: `src/data/firebase/__tests__/cloudSync.test.ts`

### Step 1: Write failing test for merged pull

**Append to `src/data/firebase/__tests__/cloudSync.test.ts`:**

```typescript
describe('pullCloudMatchesToLocal with shared matches', () => {
  it('pulls both owned and shared matches', async () => {
    const ownedMatch = { ...makeCasualMatch(), id: 'owned-1', ownerId: 'test-user-uid' };
    const sharedMatch = { ...makeCasualMatch(), id: 'shared-1', ownerId: 'other-uid', sharedWith: ['test-user-uid'] };

    mockFirestoreMatchRepository.getByOwner.mockResolvedValue([ownedMatch]);
    mockFirestoreMatchRepository.getBySharedWith.mockResolvedValue([sharedMatch]);

    const count = await cloudSync.pullCloudMatchesToLocal();

    expect(count).toBe(2);
    expect(mockMatchRepository.save).toHaveBeenCalledTimes(2);
  });

  it('deduplicates matches that appear in both owned and shared', async () => {
    const match = { ...makeCasualMatch(), id: 'dup-1', ownerId: 'test-user-uid', sharedWith: ['test-user-uid'] };

    mockFirestoreMatchRepository.getByOwner.mockResolvedValue([match]);
    mockFirestoreMatchRepository.getBySharedWith.mockResolvedValue([match]);

    const count = await cloudSync.pullCloudMatchesToLocal();

    expect(count).toBe(1);
    expect(mockMatchRepository.save).toHaveBeenCalledTimes(1);
  });

  it('still works when getBySharedWith returns empty', async () => {
    mockFirestoreMatchRepository.getByOwner.mockResolvedValue([makeCasualMatch()]);
    mockFirestoreMatchRepository.getBySharedWith.mockResolvedValue([]);

    const count = await cloudSync.pullCloudMatchesToLocal();

    expect(count).toBe(1);
  });
});
```

### Step 2: Run test to verify it fails

```bash
npx vitest run src/data/firebase/__tests__/cloudSync.test.ts -t "pullCloudMatchesToLocal with shared" --reporter=verbose
```

Expected: FAIL — `getBySharedWith` not called, no dedup logic.

### Step 3: Implement merged pull

**File: `src/data/firebase/cloudSync.ts`**

Replace `pullCloudMatchesToLocal` (lines 39-79):
```typescript
async pullCloudMatchesToLocal(): Promise<number> {
  const user = auth.currentUser;
  if (!user) return 0;

  try {
    const [ownedMatches, sharedMatches] = await Promise.all([
      firestoreMatchRepository.getByOwner(user.uid),
      firestoreMatchRepository.getBySharedWith(user.uid),
    ]);

    // Deduplicate by match ID (owned takes precedence)
    const seen = new Set<string>();
    const allMatches = [...ownedMatches];
    for (const m of ownedMatches) seen.add(m.id);
    for (const m of sharedMatches) {
      if (!seen.has(m.id)) {
        allMatches.push(m);
        seen.add(m.id);
      }
    }

    let synced = 0;
    for (const cloudMatch of allMatches) {
      const localMatch: Match = {
        id: cloudMatch.id,
        config: cloudMatch.config,
        team1PlayerIds: cloudMatch.team1PlayerIds,
        team2PlayerIds: cloudMatch.team2PlayerIds,
        team1Name: cloudMatch.team1Name,
        team2Name: cloudMatch.team2Name,
        team1Color: cloudMatch.team1Color,
        team2Color: cloudMatch.team2Color,
        games: cloudMatch.games,
        winningSide: cloudMatch.winningSide,
        status: cloudMatch.status,
        startedAt: cloudMatch.startedAt,
        completedAt: cloudMatch.completedAt,
        lastSnapshot: cloudMatch.lastSnapshot,
        tournamentId: cloudMatch.tournamentId,
        tournamentTeam1Id: cloudMatch.tournamentTeam1Id,
        tournamentTeam2Id: cloudMatch.tournamentTeam2Id,
        poolId: cloudMatch.poolId,
        bracketSlotId: cloudMatch.bracketSlotId,
        court: cloudMatch.court,
        scorerRole: cloudMatch.scorerRole,
        scorerTeam: cloudMatch.scorerTeam,
      };
      await matchRepository.save(localMatch);
      synced++;
    }
    return synced;
  } catch (err) {
    console.warn('Failed to pull cloud matches:', err);
    return 0;
  }
},
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/data/firebase/__tests__/cloudSync.test.ts --reporter=verbose
```

Expected: ALL PASS

### Step 5: Commit

```bash
git add src/data/firebase/cloudSync.ts src/data/firebase/__tests__/cloudSync.test.ts
git commit -m "feat(cloud-sync): merge owned and shared matches in pullCloudMatchesToLocal with dedup"
```

---

## Task 3: Capacity Guard in `resolveParticipantUids`

**Files:**
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts:156-177`
- Test: `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`

### Step 1: Write failing tests

**Append to `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`** (in the casual path describe block):

```typescript
describe('capacity guard', () => {
  it('rejects team with more than 2 players in doubles', async () => {
    const match = makeCasualMatch({
      config: { gameType: 'doubles', scoringMode: 'side-out', matchFormat: 'single', pointsToWin: 11 },
      team1PlayerIds: ['uid-A', 'uid-B', 'uid-C'],
      team2PlayerIds: ['uid-D'],
      winningSide: 1,
    });
    await processMatchCompletion(match, 'uid-A');

    expect(mockTransactionSet).not.toHaveBeenCalled();
  });

  it('rejects team with more than 1 player in singles', async () => {
    const match = makeCasualMatch({
      config: { gameType: 'singles', scoringMode: 'side-out', matchFormat: 'single', pointsToWin: 11 },
      team1PlayerIds: ['uid-A', 'uid-B'],
      team2PlayerIds: ['uid-C'],
      winningSide: 1,
    });
    await processMatchCompletion(match, 'uid-A');

    expect(mockTransactionSet).not.toHaveBeenCalled();
  });

  it('allows exactly 2 players per team in doubles', async () => {
    const match = makeCasualMatch({
      config: { gameType: 'doubles', scoringMode: 'side-out', matchFormat: 'single', pointsToWin: 11 },
      team1PlayerIds: ['uid-A', 'uid-B'],
      team2PlayerIds: ['uid-C', 'uid-D'],
      winningSide: 1,
    });
    await processMatchCompletion(match, 'uid-A');

    expect(mockTransactionSet).toHaveBeenCalledTimes(4);
  });

  it('scorer in team array does not double-count with fallback', async () => {
    const match = makeCasualMatch({
      team1PlayerIds: ['scorer-uid'],
      team2PlayerIds: [],
      winningSide: 1,
      scorerRole: 'player',
      scorerTeam: 1,
    });
    await processMatchCompletion(match, 'scorer-uid');

    // Scorer appears in team1PlayerIds → gets stats from array path
    // Fallback doesn't fire (participants.length > 0)
    // Only 1 stats write
    expect(mockTransactionSet).toHaveBeenCalledTimes(1);
  });

  it('partial linking: 1 UID on team 1, empty team 2, correct stats', async () => {
    const match = makeCasualMatch({
      team1PlayerIds: ['uid-A'],
      team2PlayerIds: [],
      winningSide: 1,
      scorerRole: 'player',
      scorerTeam: 1,
    });
    await processMatchCompletion(match, 'uid-A');

    expect(mockTransactionSet).toHaveBeenCalledTimes(1);
    const statsArg = mockTransactionSet.mock.calls[0][1];
    expect(statsArg.wins).toBe(1);
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts -t "capacity guard" --reporter=verbose
```

Expected: FAIL — capacity guard not implemented, 3-player team still processes.

### Step 3: Implement capacity guard

**File: `src/data/firebase/firestorePlayerStatsRepository.ts`**

Add capacity guard after line 158 (after `const team2Uids = ...`), before the for loops:

```typescript
    const team1Uids = match.team1PlayerIds ?? [];
    const team2Uids = match.team2PlayerIds ?? [];

    // Capacity guard: reject invalid team sizes
    const maxPerTeam = match.config.gameType === 'singles' ? 1 : 2;
    if (team1Uids.length > maxPerTeam || team2Uids.length > maxPerTeam) {
      console.warn('Invalid team size for casual match, skipping stats:', {
        matchId: match.id,
        gameType: match.config.gameType,
        team1Count: team1Uids.length,
        team2Count: team2Uids.length,
        maxPerTeam,
      });
      return [];
    }

    // Phase 2+: if player IDs populated, give all linked players stats
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts --reporter=verbose
```

Expected: ALL PASS (including all existing Phase 1 tests)

### Step 5: Commit

```bash
git add src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts
git commit -m "feat(stats): add capacity guard to resolveParticipantUids for casual matches"
```

---

## Task 4: Buddy Picker Helpers (Pure Functions)

**Files:**
- Create: `src/features/scoring/helpers/buddyPickerHelpers.ts`
- Create: `src/features/scoring/helpers/__tests__/buddyPickerHelpers.test.ts`

### Step 1: Write failing tests

**File: `src/features/scoring/helpers/__tests__/buddyPickerHelpers.test.ts`** (create)

```typescript
import { describe, it, expect } from 'vitest';
import type { BuddyGroupMember } from '../../../../data/types';
import {
  deduplicateBuddies,
  filterValidMembers,
  excludeSelf,
  buildTeamArrays,
} from '../buddyPickerHelpers';

function makeMember(overrides: Partial<BuddyGroupMember> = {}): BuddyGroupMember {
  return {
    userId: 'user-1',
    displayName: 'Alice',
    photoURL: null,
    role: 'member',
    joinedAt: Date.now(),
    ...overrides,
  };
}

describe('buddyPickerHelpers', () => {
  describe('deduplicateBuddies', () => {
    it('removes duplicate members by userId', () => {
      const members = [
        makeMember({ userId: 'u1', displayName: 'Alice' }),
        makeMember({ userId: 'u1', displayName: 'Alice (Group 2)' }),
        makeMember({ userId: 'u2', displayName: 'Bob' }),
      ];
      const result = deduplicateBuddies(members);
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('u1');
      expect(result[1].userId).toBe('u2');
    });

    it('returns empty array for empty input', () => {
      expect(deduplicateBuddies([])).toEqual([]);
    });
  });

  describe('filterValidMembers', () => {
    it('removes members with empty userId', () => {
      const members = [
        makeMember({ userId: '' }),
        makeMember({ userId: 'u1' }),
      ];
      expect(filterValidMembers(members)).toHaveLength(1);
    });

    it('removes members with undefined-like userId', () => {
      const members = [
        makeMember({ userId: undefined as unknown as string }),
        makeMember({ userId: 'u1' }),
      ];
      expect(filterValidMembers(members)).toHaveLength(1);
    });
  });

  describe('excludeSelf', () => {
    it('removes current user from list', () => {
      const members = [
        makeMember({ userId: 'me' }),
        makeMember({ userId: 'other' }),
      ];
      expect(excludeSelf(members, 'me')).toHaveLength(1);
      expect(excludeSelf(members, 'me')[0].userId).toBe('other');
    });
  });

  describe('buildTeamArrays', () => {
    it('splits assignments into team1 and team2 arrays', () => {
      const assignments: Record<string, 1 | 2> = { 'u1': 1, 'u2': 2, 'u3': 1 };
      const result = buildTeamArrays(assignments);
      expect(result.team1).toEqual(['u1', 'u3']);
      expect(result.team2).toEqual(['u2']);
    });

    it('adds scorer to correct team when playing', () => {
      const assignments: Record<string, 1 | 2> = { 'u1': 1 };
      const result = buildTeamArrays(assignments, { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 2 });
      expect(result.team1).toEqual(['u1']);
      expect(result.team2).toEqual(['scorer']);
    });

    it('excludes scorer when spectator', () => {
      const assignments: Record<string, 1 | 2> = { 'u1': 1 };
      const result = buildTeamArrays(assignments, { scorerUid: 'scorer', scorerRole: 'spectator', scorerTeam: 1 });
      expect(result.team1).toEqual(['u1']);
      expect(result.team2).toEqual([]);
    });

    it('computes sharedWith as all buddy UIDs (excludes scorer)', () => {
      const assignments: Record<string, 1 | 2> = { 'u1': 1, 'u2': 2 };
      const result = buildTeamArrays(assignments, { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 1 });
      expect(result.sharedWith).toEqual(['u1', 'u2']);
    });

    it('returns empty arrays for empty assignments', () => {
      const result = buildTeamArrays({});
      expect(result.team1).toEqual([]);
      expect(result.team2).toEqual([]);
      expect(result.sharedWith).toEqual([]);
    });
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx vitest run src/features/scoring/helpers/__tests__/buddyPickerHelpers.test.ts --reporter=verbose
```

Expected: FAIL — module not found.

### Step 3: Implement helpers

**File: `src/features/scoring/helpers/buddyPickerHelpers.ts`** (create)

```typescript
import type { BuddyGroupMember } from '../../../data/types';

export function deduplicateBuddies(members: BuddyGroupMember[]): BuddyGroupMember[] {
  const seen = new Set<string>();
  const result: BuddyGroupMember[] = [];
  for (const m of members) {
    if (!seen.has(m.userId)) {
      seen.add(m.userId);
      result.push(m);
    }
  }
  return result;
}

export function filterValidMembers(members: BuddyGroupMember[]): BuddyGroupMember[] {
  return members.filter((m) => m.userId && typeof m.userId === 'string' && m.userId.trim().length > 0);
}

export function excludeSelf(members: BuddyGroupMember[], currentUid: string): BuddyGroupMember[] {
  return members.filter((m) => m.userId !== currentUid);
}

interface ScorerInfo {
  scorerUid: string;
  scorerRole: 'player' | 'spectator';
  scorerTeam: 1 | 2;
}

export function buildTeamArrays(
  assignments: Record<string, 1 | 2>,
  scorer?: ScorerInfo,
): { team1: string[]; team2: string[]; sharedWith: string[] } {
  const team1: string[] = [];
  const team2: string[] = [];
  const sharedWith: string[] = [];

  for (const [uid, team] of Object.entries(assignments)) {
    if (team === 1) team1.push(uid);
    else team2.push(uid);
    sharedWith.push(uid);
  }

  if (scorer && scorer.scorerRole === 'player') {
    if (scorer.scorerTeam === 1) team1.push(scorer.scorerUid);
    else team2.push(scorer.scorerUid);
  }

  return { team1, team2, sharedWith };
}
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/features/scoring/helpers/__tests__/buddyPickerHelpers.test.ts --reporter=verbose
```

Expected: ALL PASS

### Step 5: Commit

```bash
git add src/features/scoring/helpers/buddyPickerHelpers.ts src/features/scoring/helpers/__tests__/buddyPickerHelpers.test.ts
git commit -m "feat(buddy-picker): add pure helper functions for dedup, validation, team array building"
```

---

## Task 5: `useBuddyPickerData` Hook

**Files:**
- Create: `src/features/scoring/hooks/useBuddyPickerData.ts`
- Create: `src/features/scoring/hooks/__tests__/useBuddyPickerData.test.ts`

### Step 1: Write failing tests

**File: `src/features/scoring/hooks/__tests__/useBuddyPickerData.test.ts`** (create)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'solid-js';

const mockGetGroupsForUser = vi.fn();
const mockGetMembers = vi.fn();

vi.mock('../../../../data/firebase/firestoreBuddyGroupRepository', () => ({
  firestoreBuddyGroupRepository: {
    getGroupsForUser: (...args: unknown[]) => mockGetGroupsForUser(...args),
    getMembers: (...args: unknown[]) => mockGetMembers(...args),
  },
}));

import { useBuddyPickerData } from '../useBuddyPickerData';

describe('useBuddyPickerData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty list initially (before load)', () => {
    createRoot((dispose) => {
      const { buddies, loading } = useBuddyPickerData(() => undefined);
      expect(buddies()).toEqual([]);
      expect(loading()).toBe(false);
      dispose();
    });
  });

  it('fetches and deduplicates members across groups', async () => {
    mockGetGroupsForUser.mockResolvedValue(['group-1', 'group-2']);
    mockGetMembers
      .mockResolvedValueOnce([
        { userId: 'u1', displayName: 'Alice', photoURL: null, role: 'member', joinedAt: 1 },
        { userId: 'u2', displayName: 'Bob', photoURL: null, role: 'member', joinedAt: 1 },
      ])
      .mockResolvedValueOnce([
        { userId: 'u1', displayName: 'Alice', photoURL: null, role: 'member', joinedAt: 1 },
        { userId: 'u3', displayName: 'Charlie', photoURL: null, role: 'member', joinedAt: 1 },
      ]);

    await createRoot(async (dispose) => {
      const { buddies, load } = useBuddyPickerData(() => 'current-user');
      await load();

      expect(buddies()).toHaveLength(3);
      expect(buddies().map((b) => b.userId)).toEqual(['u1', 'u2', 'u3']);
      dispose();
    });
  });

  it('excludes current user from results', async () => {
    mockGetGroupsForUser.mockResolvedValue(['group-1']);
    mockGetMembers.mockResolvedValue([
      { userId: 'current-user', displayName: 'Me', photoURL: null, role: 'admin', joinedAt: 1 },
      { userId: 'u1', displayName: 'Alice', photoURL: null, role: 'member', joinedAt: 1 },
    ]);

    await createRoot(async (dispose) => {
      const { buddies, load } = useBuddyPickerData(() => 'current-user');
      await load();

      expect(buddies()).toHaveLength(1);
      expect(buddies()[0].userId).toBe('u1');
      dispose();
    });
  });

  it('filters members with empty userId', async () => {
    mockGetGroupsForUser.mockResolvedValue(['group-1']);
    mockGetMembers.mockResolvedValue([
      { userId: '', displayName: 'Ghost', photoURL: null, role: 'member', joinedAt: 1 },
      { userId: 'u1', displayName: 'Alice', photoURL: null, role: 'member', joinedAt: 1 },
    ]);

    await createRoot(async (dispose) => {
      const { buddies, load } = useBuddyPickerData(() => 'me');
      await load();

      expect(buddies()).toHaveLength(1);
      dispose();
    });
  });

  it('handles fetch failure gracefully', async () => {
    mockGetGroupsForUser.mockRejectedValue(new Error('Network error'));

    await createRoot(async (dispose) => {
      const { buddies, error, load } = useBuddyPickerData(() => 'me');
      await load();

      expect(buddies()).toEqual([]);
      expect(error()).toBeTruthy();
      dispose();
    });
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx vitest run src/features/scoring/hooks/__tests__/useBuddyPickerData.test.ts --reporter=verbose
```

Expected: FAIL — module not found.

### Step 3: Implement the hook

**File: `src/features/scoring/hooks/useBuddyPickerData.ts`** (create)

```typescript
import { createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { BuddyGroupMember } from '../../../data/types';
import { firestoreBuddyGroupRepository } from '../../../data/firebase/firestoreBuddyGroupRepository';
import { deduplicateBuddies, filterValidMembers, excludeSelf } from '../helpers/buddyPickerHelpers';

interface BuddyPickerData {
  buddies: Accessor<BuddyGroupMember[]>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  load: () => Promise<void>;
}

export function useBuddyPickerData(currentUid: Accessor<string | undefined>): BuddyPickerData {
  const [buddies, setBuddies] = createSignal<BuddyGroupMember[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let loaded = false;

  const load = async () => {
    const uid = currentUid();
    if (!uid || loaded) return;

    setLoading(true);
    setError(null);
    try {
      const groupIds = await firestoreBuddyGroupRepository.getGroupsForUser(uid);
      const memberArrays = await Promise.all(
        groupIds.map((gid) => firestoreBuddyGroupRepository.getMembers(gid)),
      );
      const allMembers = memberArrays.flat();
      const processed = excludeSelf(deduplicateBuddies(filterValidMembers(allMembers)), uid);
      setBuddies(processed);
      loaded = true;
    } catch (err) {
      console.warn('Failed to load buddy picker data:', err);
      setError('Failed to load buddies');
    } finally {
      setLoading(false);
    }
  };

  return { buddies, loading, error, load };
}
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/features/scoring/hooks/__tests__/useBuddyPickerData.test.ts --reporter=verbose
```

Expected: ALL PASS

### Step 5: Commit

```bash
git add src/features/scoring/hooks/useBuddyPickerData.ts src/features/scoring/hooks/__tests__/useBuddyPickerData.test.ts
git commit -m "feat(buddy-picker): add useBuddyPickerData hook with dedup, filter, and error handling"
```

---

## Task 6: BuddyAvatar Component

**Files:**
- Create: `src/features/scoring/components/BuddyAvatar.tsx`
- Create: `src/features/scoring/components/__tests__/BuddyAvatar.test.tsx`

### Step 1: Write failing tests

**File: `src/features/scoring/components/__tests__/BuddyAvatar.test.tsx`** (create)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import BuddyAvatar from '../BuddyAvatar';

describe('BuddyAvatar', () => {
  it('renders display name initial when no photo', () => {
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={null} teamColor="#22c55e" onClick={vi.fn()} />
    ));
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders photo when photoURL provided', () => {
    const { container } = render(() => (
      <BuddyAvatar displayName="Alice" photoURL="https://example.com/photo.jpg" team={null} teamColor="#22c55e" onClick={vi.fn()} />
    ));
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute('src')).toBe('https://example.com/photo.jpg');
  });

  it('shows team badge when assigned to team 1', () => {
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={1} teamColor="#22c55e" onClick={vi.fn()} />
    ));
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('shows team badge when assigned to team 2', () => {
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={2} teamColor="#f97316" onClick={vi.fn()} />
    ));
    expect(screen.getByText('T2')).toBeInTheDocument();
  });

  it('shows no badge when unassigned', () => {
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={null} teamColor="#22c55e" onClick={vi.fn()} />
    ));
    expect(screen.queryByText('T1')).not.toBeInTheDocument();
    expect(screen.queryByText('T2')).not.toBeInTheDocument();
  });

  it('calls onClick when tapped', async () => {
    const onClick = vi.fn();
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={null} teamColor="#22c55e" onClick={onClick} />
    ));
    await fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows truncated name below avatar', () => {
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={null} teamColor="#22c55e" onClick={vi.fn()} />
    ));
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(() => (
      <BuddyAvatar displayName="Alice" photoURL={null} team={1} teamColor="#22c55e" onClick={vi.fn()} />
    ));
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('Alice');
    expect(btn.getAttribute('aria-label')).toContain('Team 1');
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx vitest run src/features/scoring/components/__tests__/BuddyAvatar.test.tsx --reporter=verbose
```

Expected: FAIL — module not found.

### Step 3: Implement BuddyAvatar

**File: `src/features/scoring/components/BuddyAvatar.tsx`** (create)

```typescript
import type { Component } from 'solid-js';
import { Show } from 'solid-js';

interface BuddyAvatarProps {
  displayName: string;
  photoURL: string | null;
  team: 1 | 2 | null;
  teamColor: string;
  onClick: () => void;
}

const BuddyAvatar: Component<BuddyAvatarProps> = (props) => {
  const initial = () => props.displayName.charAt(0).toUpperCase();

  const ariaLabel = () => {
    const teamStr = props.team ? `Team ${props.team}` : 'unassigned';
    return `${props.displayName}, ${teamStr}. Tap to change.`;
  };

  return (
    <button
      type="button"
      class="flex flex-col items-center gap-1 flex-shrink-0 active:scale-95 transition-transform"
      style={{ width: '56px' }}
      onClick={props.onClick}
      aria-label={ariaLabel()}
    >
      <div
        class="relative w-12 h-12 rounded-full overflow-hidden border-2"
        style={{ "border-color": props.team ? props.teamColor : 'var(--color-surface-lighter)' }}
      >
        <Show
          when={props.photoURL}
          fallback={
            <div class="w-full h-full flex items-center justify-center bg-surface-light text-on-surface font-bold text-lg">
              {initial()}
            </div>
          }
        >
          <img src={props.photoURL!} alt="" class="w-full h-full object-cover" />
        </Show>
        <Show when={props.team}>
          <div
            class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ "background-color": props.teamColor }}
          >
            T{props.team}
          </div>
        </Show>
      </div>
      <span class="text-xs text-on-surface-muted truncate w-full text-center">{props.displayName}</span>
    </button>
  );
};

export default BuddyAvatar;
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/features/scoring/components/__tests__/BuddyAvatar.test.tsx --reporter=verbose
```

Expected: ALL PASS

### Step 5: Commit

```bash
git add src/features/scoring/components/BuddyAvatar.tsx src/features/scoring/components/__tests__/BuddyAvatar.test.tsx
git commit -m "feat(buddy-picker): add BuddyAvatar component with team badge and a11y"
```

---

## Task 7: BuddyActionSheet Component

**Files:**
- Create: `src/features/scoring/components/BuddyActionSheet.tsx`
- Create: `src/features/scoring/components/__tests__/BuddyActionSheet.test.tsx`

### Step 1: Write failing tests

**File: `src/features/scoring/components/__tests__/BuddyActionSheet.test.tsx`** (create)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import BuddyActionSheet from '../BuddyActionSheet';

const defaultProps = {
  open: true,
  buddyName: 'Alice',
  team1Name: 'Hawks',
  team2Name: 'Eagles',
  team1Color: '#22c55e',
  team2Color: '#f97316',
  team1Full: false,
  team2Full: false,
  currentTeam: null as 1 | 2 | null,
  onAssign: vi.fn(),
  onUnassign: vi.fn(),
  onClose: vi.fn(),
};

describe('BuddyActionSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(() => <BuddyActionSheet {...defaultProps} open={false} />);
    expect(container.querySelector('.fixed')).not.toBeInTheDocument();
  });

  it('shows buddy name and team options when open', () => {
    render(() => <BuddyActionSheet {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/Hawks/)).toBeInTheDocument();
    expect(screen.getByText(/Eagles/)).toBeInTheDocument();
  });

  it('calls onAssign with team 1 when tapped', async () => {
    const onAssign = vi.fn();
    render(() => <BuddyActionSheet {...defaultProps} onAssign={onAssign} />);
    await fireEvent.click(screen.getByText(/Hawks/));
    expect(onAssign).toHaveBeenCalledWith(1);
  });

  it('calls onAssign with team 2 when tapped', async () => {
    const onAssign = vi.fn();
    render(() => <BuddyActionSheet {...defaultProps} onAssign={onAssign} />);
    await fireEvent.click(screen.getByText(/Eagles/));
    expect(onAssign).toHaveBeenCalledWith(2);
  });

  it('shows Remove option when buddy is assigned', () => {
    render(() => <BuddyActionSheet {...defaultProps} currentTeam={1} />);
    expect(screen.getByText('Remove')).toBeInTheDocument();
  });

  it('hides Remove option when buddy is unassigned', () => {
    render(() => <BuddyActionSheet {...defaultProps} currentTeam={null} />);
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });

  it('calls onUnassign when Remove tapped', async () => {
    const onUnassign = vi.fn();
    render(() => <BuddyActionSheet {...defaultProps} currentTeam={1} onUnassign={onUnassign} />);
    await fireEvent.click(screen.getByText('Remove'));
    expect(onUnassign).toHaveBeenCalledOnce();
  });

  it('disables full team option with aria-disabled', () => {
    render(() => <BuddyActionSheet {...defaultProps} team1Full={true} />);
    const team1Btn = screen.getByText(/Hawks/).closest('button');
    expect(team1Btn?.getAttribute('aria-disabled')).toBe('true');
  });

  it('does not call onAssign when disabled team tapped', async () => {
    const onAssign = vi.fn();
    render(() => <BuddyActionSheet {...defaultProps} team1Full={true} onAssign={onAssign} />);
    await fireEvent.click(screen.getByText(/Hawks/));
    expect(onAssign).not.toHaveBeenCalled();
  });

  it('closes on backdrop tap', async () => {
    const onClose = vi.fn();
    const { container } = render(() => <BuddyActionSheet {...defaultProps} onClose={onClose} />);
    const backdrop = container.querySelector('[data-testid="sheet-backdrop"]');
    await fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx vitest run src/features/scoring/components/__tests__/BuddyActionSheet.test.tsx --reporter=verbose
```

Expected: FAIL — module not found.

### Step 3: Implement BuddyActionSheet

**File: `src/features/scoring/components/BuddyActionSheet.tsx`** (create)

```typescript
import type { Component } from 'solid-js';
import { Show } from 'solid-js';

interface BuddyActionSheetProps {
  open: boolean;
  buddyName: string;
  team1Name: string;
  team2Name: string;
  team1Color: string;
  team2Color: string;
  team1Full: boolean;
  team2Full: boolean;
  currentTeam: 1 | 2 | null;
  onAssign: (team: 1 | 2) => void;
  onUnassign: () => void;
  onClose: () => void;
}

const BuddyActionSheet: Component<BuddyActionSheetProps> = (props) => {
  const handleTeamClick = (team: 1 | 2) => {
    const isFull = team === 1 ? props.team1Full : props.team2Full;
    if (isFull) return;
    props.onAssign(team);
  };

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex items-end justify-center">
        <div
          data-testid="sheet-backdrop"
          class="absolute inset-0 bg-black/50"
          onClick={props.onClose}
        />
        <div
          class="relative w-full max-w-lg bg-surface rounded-t-2xl p-6 pb-safe"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="w-12 h-1 bg-surface-lighter rounded-full mx-auto mb-4" />
          <h3 class="text-lg font-bold text-on-surface mb-4">{props.buddyName}</h3>

          <div class="space-y-3">
            <button
              type="button"
              class="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98]"
              classList={{
                'bg-surface-light': !props.team1Full,
                'bg-surface-light/50 opacity-50 cursor-not-allowed': props.team1Full,
              }}
              aria-disabled={props.team1Full ? 'true' : undefined}
              onClick={() => handleTeamClick(1)}
            >
              <span class="w-4 h-4 rounded-full flex-shrink-0" style={{ "background-color": props.team1Color }} />
              <span class="text-on-surface font-medium">
                {props.team1Name}{props.team1Full ? ' (full)' : ''}
              </span>
            </button>

            <button
              type="button"
              class="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98]"
              classList={{
                'bg-surface-light': !props.team2Full,
                'bg-surface-light/50 opacity-50 cursor-not-allowed': props.team2Full,
              }}
              aria-disabled={props.team2Full ? 'true' : undefined}
              onClick={() => handleTeamClick(2)}
            >
              <span class="w-4 h-4 rounded-full flex-shrink-0" style={{ "background-color": props.team2Color }} />
              <span class="text-on-surface font-medium">
                {props.team2Name}{props.team2Full ? ' (full)' : ''}
              </span>
            </button>

            <Show when={props.currentTeam !== null}>
              <button
                type="button"
                class="w-full p-4 rounded-xl bg-surface-light text-red-400 font-medium transition-all active:scale-[0.98]"
                onClick={props.onUnassign}
              >
                Remove
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default BuddyActionSheet;
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/features/scoring/components/__tests__/BuddyActionSheet.test.tsx --reporter=verbose
```

Expected: ALL PASS

### Step 5: Commit

```bash
git add src/features/scoring/components/BuddyActionSheet.tsx src/features/scoring/components/__tests__/BuddyActionSheet.test.tsx
git commit -m "feat(buddy-picker): add BuddyActionSheet bottom sheet component"
```

---

## Task 8: BuddyPicker Component

**Files:**
- Create: `src/features/scoring/components/BuddyPicker.tsx`
- Create: `src/features/scoring/components/__tests__/BuddyPicker.test.tsx`

> **Note:** This is the largest component. Tests mock the `useBuddyPickerData` hook and verify the collapsible section, avatar rendering, sorting, and action sheet integration. The full test file and component are substantial — implement incrementally, testing one behavior at a time.

### Step 1: Write failing tests

**File: `src/features/scoring/components/__tests__/BuddyPicker.test.tsx`** (create)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import type { BuddyGroupMember } from '../../../../data/types';

const mockLoad = vi.fn().mockResolvedValue(undefined);
const mockBuddies = vi.fn<() => BuddyGroupMember[]>().mockReturnValue([]);
const mockLoading = vi.fn().mockReturnValue(false);
const mockError = vi.fn().mockReturnValue(null);

vi.mock('../../hooks/useBuddyPickerData', () => ({
  useBuddyPickerData: () => ({
    buddies: mockBuddies,
    loading: mockLoading,
    error: mockError,
    load: mockLoad,
  }),
}));

import BuddyPicker from '../BuddyPicker';

function makeMember(userId: string, displayName: string): BuddyGroupMember {
  return { userId, displayName, photoURL: null, role: 'member', joinedAt: 1 };
}

const baseProps = {
  buddyAssignments: {} as Record<string, 1 | 2>,
  scorerRole: 'player' as const,
  scorerTeam: 1 as 1 | 2,
  scorerUid: 'scorer-uid',
  team1Name: 'Hawks',
  team2Name: 'Eagles',
  team1Color: '#22c55e',
  team2Color: '#f97316',
  gameType: 'doubles' as const,
  onAssign: vi.fn(),
  onUnassign: vi.fn(),
};

describe('BuddyPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuddies.mockReturnValue([]);
    mockLoading.mockReturnValue(false);
    mockError.mockReturnValue(null);
  });

  it('renders collapsed by default with "Add Players" text', () => {
    render(() => <BuddyPicker {...baseProps} />);
    expect(screen.getByText(/Add Players/)).toBeInTheDocument();
  });

  it('expands on tap and calls load', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    render(() => <BuddyPicker {...baseProps} />);

    await fireEvent.click(screen.getByText(/Add Players/));
    expect(mockLoad).toHaveBeenCalledOnce();
  });

  it('shows "Done" button when expanded', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    render(() => <BuddyPicker {...baseProps} />);

    await fireEvent.click(screen.getByText(/Add Players/));
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('collapses when Done is tapped', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    render(() => <BuddyPicker {...baseProps} />);

    await fireEvent.click(screen.getByText(/Add Players/));
    await fireEvent.click(screen.getByText('Done'));
    expect(screen.getByText(/Add Players/)).toBeInTheDocument();
  });

  it('shows error message on fetch failure', async () => {
    mockError.mockReturnValue('Failed to load buddies');
    render(() => <BuddyPicker {...baseProps} />);

    await fireEvent.click(screen.getByText(/Add Players/));
    expect(screen.getByText(/Connect to the internet/)).toBeInTheDocument();
  });

  it('shows empty state when no buddy groups', async () => {
    mockBuddies.mockReturnValue([]);
    render(() => <BuddyPicker {...baseProps} />);

    await fireEvent.click(screen.getByText(/Add Players/));
    expect(screen.getByText(/Create a buddy group/)).toBeInTheDocument();
  });

  it('renders buddy avatars when data loaded', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice'), makeMember('u2', 'Bob')]);
    render(() => <BuddyPicker {...baseProps} />);

    await fireEvent.click(screen.getByText(/Add Players/));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows collapsed summary with assigned player names', () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    const assignments = { 'u1': 1 as const };
    render(() => <BuddyPicker {...baseProps} buddyAssignments={assignments} />);

    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Change/)).toBeInTheDocument();
  });

  it('shows capacity indicators when expanded', async () => {
    mockBuddies.mockReturnValue([makeMember('u1', 'Alice')]);
    render(() => <BuddyPicker {...baseProps} />);

    await fireEvent.click(screen.getByText(/Add Players/));
    expect(screen.getByText(/Team 1:/)).toBeInTheDocument();
    expect(screen.getByText(/Team 2:/)).toBeInTheDocument();
  });
});
```

### Step 2: Run tests to verify they fail

```bash
npx vitest run src/features/scoring/components/__tests__/BuddyPicker.test.tsx --reporter=verbose
```

Expected: FAIL — module not found.

### Step 3: Implement BuddyPicker

**File: `src/features/scoring/components/BuddyPicker.tsx`** (create)

```typescript
import type { Component } from 'solid-js';
import { createSignal, Show, For } from 'solid-js';
import type { BuddyGroupMember, GameType } from '../../../data/types';
import { useBuddyPickerData } from '../hooks/useBuddyPickerData';
import BuddyAvatar from './BuddyAvatar';
import BuddyActionSheet from './BuddyActionSheet';

interface BuddyPickerProps {
  buddyAssignments: Record<string, 1 | 2>;
  scorerRole: 'player' | 'spectator';
  scorerTeam: 1 | 2;
  scorerUid: string;
  team1Name: string;
  team2Name: string;
  team1Color: string;
  team2Color: string;
  gameType: GameType;
  onAssign: (userId: string, team: 1 | 2) => void;
  onUnassign: (userId: string) => void;
}

const BuddyPicker: Component<BuddyPickerProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const [selectedBuddy, setSelectedBuddy] = createSignal<BuddyGroupMember | null>(null);
  const { buddies, loading, error, load } = useBuddyPickerData(() => props.scorerUid);

  const maxPerTeam = () => props.gameType === 'singles' ? 1 : 2;

  const team1Count = () => {
    let count = Object.values(props.buddyAssignments).filter((t) => t === 1).length;
    if (props.scorerRole === 'player' && props.scorerTeam === 1) count++;
    return count;
  };

  const team2Count = () => {
    let count = Object.values(props.buddyAssignments).filter((t) => t === 2).length;
    if (props.scorerRole === 'player' && props.scorerTeam === 2) count++;
    return count;
  };

  const hasAssignments = () => Object.keys(props.buddyAssignments).length > 0;

  const assignedSummary = () => {
    const entries = Object.entries(props.buddyAssignments);
    if (entries.length === 0) return '';
    const totalPlayers = entries.length + (props.scorerRole === 'player' ? 1 : 0);
    if (totalPlayers >= 4) return 'Teams set: 2v2';

    const t1Names = entries
      .filter(([, t]) => t === 1)
      .map(([uid]) => buddies().find((b) => b.userId === uid)?.displayName ?? uid);
    const t2Names = entries
      .filter(([, t]) => t === 2)
      .map(([uid]) => buddies().find((b) => b.userId === uid)?.displayName ?? uid);

    const parts: string[] = [];
    if (t1Names.length > 0) parts.push(`${t1Names.join(', ')} (T1)`);
    if (t2Names.length > 0) parts.push(`${t2Names.join(', ')} (T2)`);
    return parts.join(' vs ');
  };

  const sortedBuddies = () => {
    const assigned = buddies().filter((b) => b.userId in props.buddyAssignments);
    const unassigned = buddies().filter((b) => !(b.userId in props.buddyAssignments));
    return [...assigned, ...unassigned];
  };

  const handleExpand = async () => {
    setExpanded(true);
    await load();
  };

  const handleAvatarClick = (buddy: BuddyGroupMember) => {
    const onlyOneTeamOpen =
      (team1Count() >= maxPerTeam() ? 1 : 0) + (team2Count() >= maxPerTeam() ? 1 : 0) === 1;
    const isUnassigned = !(buddy.userId in props.buddyAssignments);

    if (isUnassigned && onlyOneTeamOpen) {
      const openTeam: 1 | 2 = team1Count() < maxPerTeam() ? 1 : 2;
      props.onAssign(buddy.userId, openTeam);
      return;
    }
    setSelectedBuddy(buddy);
  };

  const handleSheetAssign = (team: 1 | 2) => {
    const buddy = selectedBuddy();
    if (buddy) props.onAssign(buddy.userId, team);
    setSelectedBuddy(null);
  };

  const handleSheetUnassign = () => {
    const buddy = selectedBuddy();
    if (buddy) props.onUnassign(buddy.userId);
    setSelectedBuddy(null);
  };

  return (
    <div class="mt-6">
      <Show
        when={expanded()}
        fallback={
          <div
            class="flex items-center justify-between bg-surface-light rounded-xl px-4 py-3 cursor-pointer"
            onClick={handleExpand}
            role="button"
            tabIndex={0}
          >
            <div class="flex items-center gap-2">
              <Show
                when={hasAssignments()}
                fallback={
                  <span class="text-sm text-on-surface-muted">Add Players [optional]</span>
                }
              >
                <span class="text-sm text-on-surface-muted">Players:</span>
                <span class="text-sm font-semibold text-on-surface">{assignedSummary()}</span>
              </Show>
            </div>
            <span class="text-sm text-primary font-semibold">
              {hasAssignments() ? 'Change' : ''}
            </span>
          </div>
        }
      >
        <fieldset>
          <div class="flex items-center justify-between mb-3">
            <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
              Add Players
            </legend>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              class="text-sm text-primary font-semibold"
            >
              Done
            </button>
          </div>

          <Show when={error()}>
            <p class="text-sm text-on-surface-muted py-4 text-center">
              Connect to the internet to add players.
            </p>
          </Show>

          <Show when={!error() && !loading() && buddies().length === 0}>
            <p class="text-sm text-on-surface-muted py-4 text-center">
              Create a buddy group to add players.
            </p>
          </Show>

          <Show when={!error() && buddies().length > 0}>
            <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <For each={sortedBuddies()}>
                {(buddy) => (
                  <BuddyAvatar
                    displayName={buddy.displayName}
                    photoURL={buddy.photoURL}
                    team={props.buddyAssignments[buddy.userId] ?? null}
                    teamColor={
                      props.buddyAssignments[buddy.userId] === 1
                        ? props.team1Color
                        : props.buddyAssignments[buddy.userId] === 2
                          ? props.team2Color
                          : props.team1Color
                    }
                    onClick={() => handleAvatarClick(buddy)}
                  />
                )}
              </For>
            </div>

            <div class="text-xs text-on-surface-muted mt-2">
              <span>Team 1: {team1Count()}/{maxPerTeam()}</span>
              <span class="mx-2">·</span>
              <span>Team 2: {team2Count()}/{maxPerTeam()}</span>
            </div>
          </Show>
        </fieldset>
      </Show>

      <BuddyActionSheet
        open={selectedBuddy() !== null}
        buddyName={selectedBuddy()?.displayName ?? ''}
        team1Name={props.team1Name}
        team2Name={props.team2Name}
        team1Color={props.team1Color}
        team2Color={props.team2Color}
        team1Full={team1Count() >= maxPerTeam()}
        team2Full={team2Count() >= maxPerTeam()}
        currentTeam={selectedBuddy() ? (props.buddyAssignments[selectedBuddy()!.userId] ?? null) : null}
        onAssign={handleSheetAssign}
        onUnassign={handleSheetUnassign}
        onClose={() => setSelectedBuddy(null)}
      />
    </div>
  );
};

export default BuddyPicker;
```

### Step 4: Run tests to verify they pass

```bash
npx vitest run src/features/scoring/components/__tests__/BuddyPicker.test.tsx --reporter=verbose
```

Expected: ALL PASS

### Step 5: Commit

```bash
git add src/features/scoring/components/BuddyPicker.tsx src/features/scoring/components/__tests__/BuddyPicker.test.tsx
git commit -m "feat(buddy-picker): add BuddyPicker collapsible section with avatar row and action sheet"
```

---

## Task 9: GameSetupPage Integration

**Files:**
- Modify: `src/features/scoring/GameSetupPage.tsx`
- Test: `src/features/scoring/__tests__/GameSetupPage.test.tsx` (create or append)

> **Note:** This is the integration task that wires BuddyPicker into the page. It adds state management, reactive scorer sync effects, and modifies `startGame()` / `quickStart()`.

### Step 1: Write failing integration tests

**File: `src/features/scoring/__tests__/GameSetupPage.test.tsx`** (create — test the key state behaviors)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildTeamArrays } from '../helpers/buddyPickerHelpers';

// Test the integration logic as pure functions where possible
describe('GameSetupPage buddy integration logic', () => {
  it('buildTeamArrays includes scorer on team 1 when playing', () => {
    const result = buildTeamArrays(
      { 'buddy-1': 2 },
      { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 1 },
    );
    expect(result.team1).toEqual(['scorer']);
    expect(result.team2).toEqual(['buddy-1']);
    expect(result.sharedWith).toEqual(['buddy-1']);
  });

  it('buildTeamArrays excludes scorer when spectator', () => {
    const result = buildTeamArrays(
      { 'buddy-1': 1, 'buddy-2': 2 },
      { scorerUid: 'scorer', scorerRole: 'spectator', scorerTeam: 1 },
    );
    expect(result.team1).toEqual(['buddy-1']);
    expect(result.team2).toEqual(['buddy-2']);
    expect(result.sharedWith).toEqual(['buddy-1', 'buddy-2']);
  });

  it('buildTeamArrays returns empty for quick start (no assignments)', () => {
    const result = buildTeamArrays({});
    expect(result.team1).toEqual([]);
    expect(result.team2).toEqual([]);
    expect(result.sharedWith).toEqual([]);
  });

  it('buildTeamArrays deduplicates sharedWith', () => {
    const result = buildTeamArrays(
      { 'buddy-1': 1, 'buddy-2': 2 },
      { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 1 },
    );
    const uniqueShared = new Set(result.sharedWith);
    expect(uniqueShared.size).toBe(result.sharedWith.length);
  });
});
```

### Step 2: Run tests to verify they pass (these test existing helpers)

```bash
npx vitest run src/features/scoring/__tests__/GameSetupPage.test.tsx --reporter=verbose
```

Expected: PASS (testing existing `buildTeamArrays`). This validates the integration logic before wiring.

### Step 3: Integrate BuddyPicker into GameSetupPage

**File: `src/features/scoring/GameSetupPage.tsx`**

Add imports (after existing imports):
```typescript
import BuddyPicker from './components/BuddyPicker';
import { buildTeamArrays } from './helpers/buddyPickerHelpers';
import { useAuth } from '../../shared/hooks/useAuth';
```

Add signal (after `roleExpanded` signal, line 27):
```typescript
const [buddyAssignments, setBuddyAssignments] = createSignal<Record<string, 1 | 2>>({});
```

Add auth hook (after signal declarations):
```typescript
const { user } = useAuth();
```

Add buddy handlers (before `startGame`):
```typescript
const handleBuddyAssign = (userId: string, team: 1 | 2) => {
  setBuddyAssignments((prev) => ({ ...prev, [userId]: team }));
};

const handleBuddyUnassign = (userId: string) => {
  setBuddyAssignments((prev) => {
    const next = { ...prev };
    delete next[userId];
    return next;
  });
};
```

Modify `startGame` — replace `team1PlayerIds: []` and `team2PlayerIds: []` (lines 42-43):
```typescript
const { team1, team2, sharedWith } = buildTeamArrays(buddyAssignments(), {
  scorerUid: user()?.uid ?? '',
  scorerRole: scorerRole(),
  scorerTeam: scorerTeam(),
});

const match: Match = {
  id: crypto.randomUUID(),
  config,
  team1PlayerIds: team1,
  team2PlayerIds: team2,
  // ... rest unchanged
};

// In the try block, replace cloudSync.syncMatchToCloud(match):
cloudSync.syncMatchToCloud(match, sharedWith);
```

Add BuddyPicker JSX — insert after teams section (line 203), before "Your Role" section (line 206):
```typescript
{/* Add Players */}
<Show when={user()}>
  <BuddyPicker
    buddyAssignments={buddyAssignments()}
    scorerRole={scorerRole()}
    scorerTeam={scorerTeam()}
    scorerUid={user()!.uid}
    team1Name={team1Name()}
    team2Name={team2Name()}
    team1Color={team1Color()}
    team2Color={team2Color()}
    gameType={gameType()}
    onAssign={handleBuddyAssign}
    onUnassign={handleBuddyUnassign}
  />
</Show>
```

### Step 4: Run all tests to verify nothing is broken

```bash
npx vitest run --reporter=verbose
```

Expected: ALL PASS

### Step 5: Commit

```bash
git add src/features/scoring/GameSetupPage.tsx src/features/scoring/__tests__/GameSetupPage.test.tsx
git commit -m "feat(buddy-picker): integrate BuddyPicker into GameSetupPage with state management"
```

---

## Task 10: E2E Tests

**Files:**
- Create: `e2e/casual/buddy-picker.spec.ts`

> **Note:** E2E tests require the dev server running (`npx vite --port 5199`) and Firebase emulators. Follow existing E2E patterns in `e2e/` folder.

### Step 1: Write E2E tests

**File: `e2e/casual/buddy-picker.spec.ts`** (create)

Reference existing E2E patterns in `e2e/` and the E2E testing learnings from the memory file:
- Firebase auth in browser: use app's `config.auth`
- SolidJS inputs: use `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` + `dispatchEvent`
- Dev server: port 5199, Emulators: Auth 9099, Firestore 8180

Write tests covering:
1. Expand picker → assign buddy to Team 1 → start match → verify `team1PlayerIds` in Firestore
2. Full doubles team → action sheet disables full team option
3. Start match with buddies → verify `sharedWith` populated in Firestore
4. Quick Start → no buddy data, verify scorer gets stats
5. Offline → picker shows error → match starts without buddies
6. Scorer flips to spectator after assigning → scorer removed from team arrays
7. Shared user pulls match → appears in their match history

### Step 2: Run E2E tests

```bash
npx playwright test e2e/casual/buddy-picker.spec.ts --reporter=list
```

### Step 3: Fix any failures and re-run

### Step 4: Commit

```bash
git add e2e/casual/buddy-picker.spec.ts
git commit -m "test(e2e): add buddy picker E2E tests for casual match player linking"
```

---

## Final Verification

After all tasks complete:

```bash
# Run full test suite
npx vitest run --reporter=verbose

# Run type check
npx tsc --noEmit

# Run E2E tests
npx playwright test e2e/casual/buddy-picker.spec.ts

# Run full E2E suite to check for regressions
npx playwright test
```

All must pass before marking Phase 2 complete.
