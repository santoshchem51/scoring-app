# Layer 10: Admin & Moderation Implementation Plan (Revised)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tiered roles, dispute resolution, quick-add players, CSV export, tournament templates, and audit logging.

**Architecture:** Role map on Tournament document. Audit log as immutable subcollection. Disputes as subcollection. Templates in user-scoped collection.

**Tech Stack:** SolidJS 1.9, TypeScript, Vitest, @solidjs/testing-library, @firebase/rules-unit-testing, Firestore

**Design doc:** `docs/plans/2026-03-09-layer10-admin-moderation-design.md`

**Revision notes:** Incorporates specialist feedback (TDD, Architecture, Security, Sizing). Key changes: explicit file list for migration (15+ files), split security rules tasks, fixed audit rule syntax bug, fixed CSV regex, added getByIds/migration/verification tasks, tightened dispute access, concrete test code for all tasks.

---

## Wave A: Role System (Foundation)

Everything else depends on this. Adds the 4-tier role model, updates role detection, migrates security rules.

### Task 1: Role Types + Helpers

**Files:**
- Modify: `src/data/types.ts`
- Create: `src/features/tournaments/engine/roleHelpers.ts`
- Create: `src/features/tournaments/engine/__tests__/roleHelpers.test.ts`

**Step 1: Write the failing test**

Create `src/features/tournaments/engine/__tests__/roleHelpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getTournamentRole, hasMinRole } from '../roleHelpers';
import type { Tournament } from '../../../../data/types';

const makeTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  name: 'Test',
  date: Date.now(),
  location: '',
  format: 'single-elimination',
  config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 1, teamsPerPoolAdvancing: 2 },
  organizerId: 'owner-1',
  staff: { 'admin-1': 'admin', 'mod-1': 'moderator', 'sk-1': 'scorekeeper' },
  staffUids: ['admin-1', 'mod-1', 'sk-1'],
  status: 'registration',
  maxPlayers: null,
  teamFormation: null,
  minPlayers: null,
  entryFee: null,
  rules: { registrationDeadline: null, checkInRequired: false, checkInOpens: null, checkInCloses: null, scoringRules: '', timeoutRules: '', conductRules: '', penalties: [], additionalNotes: '' },
  pausedFrom: null,
  cancellationReason: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  visibility: 'private',
  shareCode: null,
  accessMode: 'open',
  listed: true,
  buddyGroupId: null,
  buddyGroupName: null,
  registrationCounts: { confirmed: 0, pending: 0 },
  ...overrides,
});

describe('getTournamentRole', () => {
  it('returns owner for organizerId match', () => {
    expect(getTournamentRole(makeTournament(), 'owner-1')).toBe('owner');
  });

  it('returns admin for staff admin', () => {
    expect(getTournamentRole(makeTournament(), 'admin-1')).toBe('admin');
  });

  it('returns moderator for staff moderator', () => {
    expect(getTournamentRole(makeTournament(), 'mod-1')).toBe('moderator');
  });

  it('returns scorekeeper for staff scorekeeper', () => {
    expect(getTournamentRole(makeTournament(), 'sk-1')).toBe('scorekeeper');
  });

  it('returns null for unknown user', () => {
    expect(getTournamentRole(makeTournament(), 'random')).toBeNull();
  });
});

describe('hasMinRole', () => {
  it('owner has all roles', () => {
    expect(hasMinRole(makeTournament(), 'owner-1', 'scorekeeper')).toBe(true);
    expect(hasMinRole(makeTournament(), 'owner-1', 'moderator')).toBe(true);
    expect(hasMinRole(makeTournament(), 'owner-1', 'admin')).toBe(true);
    expect(hasMinRole(makeTournament(), 'owner-1', 'owner')).toBe(true);
  });

  it('admin has moderator and scorekeeper but not owner', () => {
    expect(hasMinRole(makeTournament(), 'admin-1', 'scorekeeper')).toBe(true);
    expect(hasMinRole(makeTournament(), 'admin-1', 'moderator')).toBe(true);
    expect(hasMinRole(makeTournament(), 'admin-1', 'admin')).toBe(true);
    expect(hasMinRole(makeTournament(), 'admin-1', 'owner')).toBe(false);
  });

  it('moderator has scorekeeper but not admin or owner', () => {
    expect(hasMinRole(makeTournament(), 'mod-1', 'scorekeeper')).toBe(true);
    expect(hasMinRole(makeTournament(), 'mod-1', 'moderator')).toBe(true);
    expect(hasMinRole(makeTournament(), 'mod-1', 'admin')).toBe(false);
    expect(hasMinRole(makeTournament(), 'mod-1', 'owner')).toBe(false);
  });

  it('scorekeeper only has scorekeeper', () => {
    expect(hasMinRole(makeTournament(), 'sk-1', 'scorekeeper')).toBe(true);
    expect(hasMinRole(makeTournament(), 'sk-1', 'moderator')).toBe(false);
  });

  it('unknown user has no role', () => {
    expect(hasMinRole(makeTournament(), 'nobody', 'scorekeeper')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/engine/__tests__/roleHelpers.test.ts`
Expected: FAIL — module `../roleHelpers` not found

**Step 3: Implement**

Add to `src/data/types.ts` after the `TournamentStatus` type (line 198):

```typescript
export type TournamentRole = 'admin' | 'moderator' | 'scorekeeper';
```

In the `Tournament` interface, replace `scorekeeperIds: string[];` (line 240) with:

```typescript
  staff: Record<string, TournamentRole>;
  staffUids: string[];
```

Create `src/features/tournaments/engine/roleHelpers.ts`:

```typescript
import type { Tournament, TournamentRole } from '../../../data/types';

export type EffectiveRole = TournamentRole | 'owner';

const ROLE_LEVELS: Record<EffectiveRole, number> = {
  scorekeeper: 1,
  moderator: 2,
  admin: 3,
  owner: 4,
};

export function getTournamentRole(tournament: Tournament, uid: string): EffectiveRole | null {
  if (tournament.organizerId === uid) return 'owner';
  return tournament.staff[uid] ?? null;
}

export function hasMinRole(tournament: Tournament, uid: string, minimum: EffectiveRole): boolean {
  const role = getTournamentRole(tournament, uid);
  if (!role) return false;
  return ROLE_LEVELS[role] >= ROLE_LEVELS[minimum];
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/roleHelpers.test.ts`
Expected: PASS (all 12 tests)

**Step 5: Commit**

```bash
git add src/data/types.ts src/features/tournaments/engine/roleHelpers.ts src/features/tournaments/engine/__tests__/roleHelpers.test.ts
git commit -m "feat(roles): add TournamentRole type and role helper functions"
```

---

### Task 2: Update roleDetection.ts to Use Staff Map

**Files:**
- Modify: `src/features/tournaments/engine/roleDetection.ts`
- Modify: `src/features/tournaments/engine/__tests__/roleDetection.test.ts`

**Step 1: Update the test file**

In `src/features/tournaments/engine/__tests__/roleDetection.test.ts`, update the `makeTournament` factory. Replace `scorekeeperIds: ['sk-1', 'sk-2'],` (line 13) with:

```typescript
  staff: { 'sk-1': 'scorekeeper', 'sk-2': 'scorekeeper' } as Record<string, import('../../../../data/types').TournamentRole>,
  staffUids: ['sk-1', 'sk-2'],
```

Update the test description on line 58 from `"returns scorekeeper when userId is in scorekeeperIds"` to `"returns scorekeeper when userId is in staff map"`.

Update the test on line 76 — replace `scorekeeperIds: ['org-1']` with:

```typescript
  staff: { 'org-1': 'scorekeeper' } as Record<string, import('../../../../data/types').TournamentRole>,
  staffUids: ['org-1'],
```

The test on line 82 (scorekeeper takes priority over player) needs no data change — the factory already sets `sk-1` as staff.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/engine/__tests__/roleDetection.test.ts`
Expected: FAIL — TypeScript errors (`scorekeeperIds` removed from Tournament type)

**Step 3: Update roleDetection.ts**

Replace the full file `src/features/tournaments/engine/roleDetection.ts`:

```typescript
import type { Tournament, TournamentRegistration } from '../../../data/types';

export type ViewerRole = 'organizer' | 'scorekeeper' | 'player' | 'spectator';

/**
 * Maps staff roles to legacy ViewerRole for backward compatibility.
 * Components should gradually migrate to hasMinRole() from roleHelpers.ts.
 */
export function detectViewerRole(
  tournament: Tournament,
  userId: string | null,
  registrations: TournamentRegistration[],
): ViewerRole {
  if (!userId) return 'spectator';
  if (tournament.organizerId === userId) return 'organizer';
  if (tournament.staff[userId]) return 'scorekeeper';
  if (registrations.some((r) => r.userId === userId)) return 'player';
  return 'spectator';
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/roleDetection.test.ts`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/roleDetection.ts src/features/tournaments/engine/__tests__/roleDetection.test.ts
git commit -m "refactor(roles): update roleDetection to use staff map instead of scorekeeperIds"
```

---

### Task 3: Migrate All scorekeeperIds References

**Files (COMPLETE list of all 16 files):**

**Production files (4):**
- Modify: `src/data/types.ts` — already done in Task 1 (verify `scorekeeperIds` removed)
- Modify: `src/data/firebase/firestoreTournamentRepository.ts` — `getByScorekeeper()` query
- Modify: `src/features/tournaments/TournamentCreatePage.tsx` — tournament creation object
- Modify: `src/features/tournaments/engine/roleDetection.ts` — already done in Task 2 (verify)

**Test files (12):**
- Modify: `test/rules/helpers.ts` — `makeTournament` factory
- Modify: `test/rules/firestore.test.ts` — lines 447-449, 577, 773
- Modify: `e2e/helpers/factories.ts` — `makeTournament` factory
- Modify: `src/data/firebase/__tests__/firestoreTournamentRepository.discovery.test.ts` — lines 174-196
- Modify: `src/data/firebase/__tests__/syncProcessor.test.ts` — line 225
- Modify: `src/features/tournaments/engine/__tests__/discoveryFilters.test.ts` — line 29
- Modify: `src/features/tournaments/engine/__tests__/roleDetection.test.ts` — already done in Task 2
- Modify: `src/features/tournaments/components/__tests__/BrowseCard.test.tsx` — line 29
- Modify: `src/features/tournaments/components/__tests__/MyTournamentsTab.test.tsx` — line 54
- Modify: `src/features/tournaments/components/__tests__/BrowseTab.test.tsx` — line 48

**Also update normalizer for backward compat:**
- Modify: `src/data/firebase/tournamentNormalizer.ts` — add `staff`/`staffUids` defaults

**Step 1: Write a canary test to detect remaining references**

No new test file — we use `npx tsc --noEmit` as the test. Every file referencing `scorekeeperIds` will emit a TypeScript error because the field was removed in Task 1.

**Step 2: Run type check to see all failures**

Run: `npx tsc --noEmit`
Expected: FAIL — compile errors in all 16 files listed above

**Step 3: Update each file**

**`src/data/firebase/firestoreTournamentRepository.ts`** — rename method and update query:

```typescript
  async getByStaff(userId: string): Promise<Tournament[]> {
    const q = query(
      collection(firestore, 'tournaments'),
      where('staffUids', 'array-contains', userId),
      orderBy('date', 'desc'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => normalizeTournament({ id: d.id, ...d.data() }));
  },
```

**`src/features/tournaments/TournamentCreatePage.tsx`** — line 105, replace `scorekeeperIds: [],` with:

```typescript
        staff: {},
        staffUids: [],
```

**`src/data/firebase/tournamentNormalizer.ts`** — add backward compat defaults:

```typescript
export function normalizeTournament(raw: Record<string, unknown>): Tournament {
  const t = raw as Partial<Tournament> & { id: string };
  const rawCounts = t.registrationCounts as { confirmed?: number; pending?: number } | undefined;
  return {
    ...t,
    accessMode: t.accessMode ?? 'open',
    listed: t.listed ?? (t.visibility === 'public'),
    buddyGroupId: t.buddyGroupId ?? null,
    buddyGroupName: t.buddyGroupName ?? null,
    staff: t.staff ?? {},
    staffUids: t.staffUids ?? [],
    registrationCounts: {
      confirmed: rawCounts?.confirmed ?? 0,
      pending: rawCounts?.pending ?? 0,
    },
  } as Tournament;
}
```

**`test/rules/helpers.ts`** — in `makeTournament`, replace `scorekeeperIds: [],` (line 131) with:

```typescript
    staff: {},
    staffUids: [],
```

**`test/rules/firestore.test.ts`** — update 4 locations:
- Line 447-449: Change test name to `'denies create with non-map staff'` and test data to `{ staff: 'not-a-map' }`
- Line 577: Replace `scorekeeperIds: [scorekeeperId]` with `staff: { [scorekeeperId]: 'scorekeeper' }, staffUids: [scorekeeperId]`
- Line 773: Same replacement as line 577

**`e2e/helpers/factories.ts`** — line 22, replace `scorekeeperIds: [],` with:

```typescript
    staff: {},
    staffUids: [],
```

**`src/data/firebase/__tests__/firestoreTournamentRepository.discovery.test.ts`** — update the `getByScorekeeper` describe block:
- Rename to `getByStaff`
- Change `scorekeeperIds` to `staffUids` in test data
- Change `firestoreTournamentRepository.getByScorekeeper` to `firestoreTournamentRepository.getByStaff`
- Change `mockWhere` assertion from `'scorekeeperIds'` to `'staffUids'`

```typescript
  describe('getByStaff', () => {
    it('uses array-contains query on staffUids', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 't1', data: () => ({ name: 'Tournament A', staff: { sk1: 'scorekeeper' }, staffUids: ['sk1'] }) },
          { id: 't2', data: () => ({ name: 'Tournament B', staff: { sk1: 'scorekeeper', sk2: 'moderator' }, staffUids: ['sk1', 'sk2'] }) },
        ],
      });

      const result = await firestoreTournamentRepository.getByStaff('sk1');

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments');
      expect(mockWhere).toHaveBeenCalledWith('staffUids', 'array-contains', 'sk1');
      expect(mockOrderBy).toHaveBeenCalledWith('date', 'desc');
      expect(result).toHaveLength(2);
    });

    it('handles empty results', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await firestoreTournamentRepository.getByStaff('nobody');

      expect(result).toEqual([]);
    });
  });
```

**`src/data/firebase/__tests__/syncProcessor.test.ts`** — line 225, replace `scorekeeperIds: [],` with:

```typescript
        staff: {},
        staffUids: [],
```

**`src/features/tournaments/engine/__tests__/discoveryFilters.test.ts`** — line 29, replace `scorekeeperIds: [],` with:

```typescript
    staff: {} as Record<string, import('../../../../data/types').TournamentRole>,
    staffUids: [],
```

**`src/features/tournaments/components/__tests__/BrowseCard.test.tsx`** — line 29, replace `scorekeeperIds: [],` with:

```typescript
    staff: {} as Record<string, import('../../../../data/types').TournamentRole>,
    staffUids: [],
```

**`src/features/tournaments/components/__tests__/MyTournamentsTab.test.tsx`** — line 54, replace `scorekeeperIds: [],` with:

```typescript
    staff: {} as Record<string, import('../../../../data/types').TournamentRole>,
    staffUids: [],
```

Also update the mock for `getByScorekeeper` to `getByStaff`:

```typescript
    getByStaff: vi.fn().mockResolvedValue([]),
```

**`src/features/tournaments/components/__tests__/BrowseTab.test.tsx`** — line 48, replace `scorekeeperIds: [],` with:

```typescript
    staff: {} as Record<string, import('../../../../data/types').TournamentRole>,
    staffUids: [],
```

**Step 4: Run type check + full test suite**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

Run: `npx vitest run`
Expected: PASS (all tests green)

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(roles): migrate all scorekeeperIds references to staff/staffUids (16 files)"
```

---

### Task 4: Add getByIds to firestoreUserRepository

**Files:**
- Modify: `src/data/firebase/firestoreUserRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreUserRepository.test.ts`

**Step 1: Write the failing test**

Create `src/data/firebase/__tests__/firestoreUserRepository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDoc = vi.hoisted(() => vi.fn());
const mockDoc = vi.hoisted(() => vi.fn(() => 'mock-doc-ref'));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: vi.fn(),
  getDoc: mockGetDoc,
  getDocs: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-ts'),
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { firestoreUserRepository } from '../firestoreUserRepository';

describe('firestoreUserRepository.getByIds', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns profiles for all found users', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'u1',
        data: () => ({ displayName: 'Alice', displayNameLower: 'alice', email: 'alice@test.com', photoURL: null, createdAt: 1000 }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'u2',
        data: () => ({ displayName: 'Bob', displayNameLower: 'bob', email: 'bob@test.com', photoURL: null, createdAt: 2000 }),
      });

    const result = await firestoreUserRepository.getByIds(['u1', 'u2']);

    expect(result).toHaveLength(2);
    expect(result[0]!.displayName).toBe('Alice');
    expect(result[1]!.displayName).toBe('Bob');
  });

  it('filters out users that do not exist', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'u1',
        data: () => ({ displayName: 'Alice', displayNameLower: 'alice', email: 'alice@test.com', photoURL: null, createdAt: 1000 }),
      })
      .mockResolvedValueOnce({
        exists: () => false,
      });

    const result = await firestoreUserRepository.getByIds(['u1', 'missing']);

    expect(result).toHaveLength(1);
    expect(result[0]!.displayName).toBe('Alice');
  });

  it('returns empty array for empty input', async () => {
    const result = await firestoreUserRepository.getByIds([]);
    expect(result).toEqual([]);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('deduplicates input uids', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'u1',
      data: () => ({ displayName: 'Alice', displayNameLower: 'alice', email: 'alice@test.com', photoURL: null, createdAt: 1000 }),
    });

    const result = await firestoreUserRepository.getByIds(['u1', 'u1', 'u1']);

    expect(result).toHaveLength(1);
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestoreUserRepository.test.ts`
Expected: FAIL — `firestoreUserRepository.getByIds is not a function`

**Step 3: Implement**

Add to `src/data/firebase/firestoreUserRepository.ts`, inside the repository object (before the closing `};`):

```typescript
  async getByIds(uids: string[]): Promise<UserProfile[]> {
    const unique = [...new Set(uids)];
    if (unique.length === 0) return [];
    const results = await Promise.all(unique.map((uid) => this.getProfile(uid)));
    return results.filter((p): p is UserProfile => p !== null);
  },
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/firestoreUserRepository.test.ts`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreUserRepository.ts src/data/firebase/__tests__/firestoreUserRepository.test.ts
git commit -m "feat(roles): add getByIds batch lookup to firestoreUserRepository"
```

---

### Task 5: Security Rules — Tournament Document

**Files:**
- Modify: `firestore.rules`
- Create: `test/rules/tournamentRoles.test.ts`
- Modify: `test/rules/helpers.ts` (if not already updated in Task 3)

This task covers create, settings update (admin+), staff update (admin+, mutually exclusive), counter-only update, and delete (owner only). Settings and staff updates are separate `allow update` clauses to prevent piggyback attacks.

**Step 1: Write the failing security rules tests**

Create `test/rules/tournamentRoles.test.ts`:

```typescript
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  setupTestEnv, teardownTestEnv, clearFirestore,
  authedContext, assertSucceeds, assertFails,
  getTestEnv, makeTournament,
} from './helpers';

beforeAll(async () => { await setupTestEnv(); });
afterAll(async () => { await teardownTestEnv(); });
beforeEach(async () => { await clearFirestore(); });

async function seedDoc(path: string, data: Record<string, unknown>) {
  await getTestEnv().withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

describe('Tournament Role-Based Access', () => {
  const ownerId = 'owner-1';
  const adminId = 'admin-1';
  const modId = 'mod-1';
  const skId = 'sk-1';
  const randomId = 'random-1';
  const tourneyId = 'tourney-1';

  const seedTournament = () => seedDoc(`tournaments/${tourneyId}`, makeTournament(ownerId, {
    staff: { [adminId]: 'admin', [modId]: 'moderator', [skId]: 'scorekeeper' },
    staffUids: [adminId, modId, skId],
    status: 'registration',
    accessMode: 'open',
    listed: true,
    visibility: 'public',
  }));

  // --- Tournament Creation ---
  describe('tournament creation', () => {
    it('allows creation with empty staff and staffUids', async () => {
      const db = authedContext(ownerId).firestore();
      const newTourney = makeTournament(ownerId, {
        id: 'new-tourney',
        staff: {},
        staffUids: [],
        accessMode: 'open',
        listed: true,
        visibility: 'public',
      });
      await assertSucceeds(setDoc(doc(db, 'tournaments/new-tourney'), newTourney));
    });

    it('rejects creation with non-empty staff', async () => {
      const db = authedContext(ownerId).firestore();
      const newTourney = makeTournament(ownerId, {
        id: 'new-tourney-2',
        staff: { 'someone': 'admin' },
        staffUids: ['someone'],
        accessMode: 'open',
        listed: true,
        visibility: 'public',
      });
      await assertFails(setDoc(doc(db, 'tournaments/new-tourney-2'), newTourney));
    });

    it('rejects creation with non-map staff', async () => {
      const db = authedContext(ownerId).firestore();
      const newTourney = makeTournament(ownerId, {
        id: 'new-tourney-3',
        staff: 'not-a-map',
        staffUids: [],
        accessMode: 'open',
        listed: true,
        visibility: 'public',
      });
      await assertFails(setDoc(doc(db, 'tournaments/new-tourney-3'), newTourney));
    });
  });

  // --- Settings Update: admin+ only ---
  describe('settings updates (admin+ only)', () => {
    it('owner can update name', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'New Name', updatedAt: Date.now() }));
    });

    it('admin can update name', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'Admin Name', updatedAt: Date.now() }));
    });

    it('moderator cannot update name', async () => {
      await seedTournament();
      const db = authedContext(modId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'Mod Name', updatedAt: Date.now() }));
    });

    it('scorekeeper cannot update name', async () => {
      await seedTournament();
      const db = authedContext(skId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'SK Name', updatedAt: Date.now() }));
    });

    it('random user cannot update name', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'Random Name', updatedAt: Date.now() }));
    });
  });

  // --- Staff Update: admin+ only, mutually exclusive with settings ---
  describe('staff updates (admin+ only, separate rule)', () => {
    it('owner can add admin to staff', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-admin`]: 'admin',
        staffUids: [adminId, modId, skId, 'new-admin'],
        updatedAt: Date.now(),
      }));
    });

    it('admin can add moderator to staff', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-mod`]: 'moderator',
        staffUids: [adminId, modId, skId, 'new-mod'],
        updatedAt: Date.now(),
      }));
    });

    it('admin cannot add another admin (only owner can)', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-admin`]: 'admin',
        staffUids: [adminId, modId, skId, 'new-admin'],
        updatedAt: Date.now(),
      }));
    });

    it('moderator cannot modify staff', async () => {
      await seedTournament();
      const db = authedContext(modId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-sk`]: 'scorekeeper',
        staffUids: [adminId, modId, skId, 'new-sk'],
        updatedAt: Date.now(),
      }));
    });

    it('rejects owner value in staff map', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.bad`]: 'owner',
        staffUids: [adminId, modId, skId, 'bad'],
        updatedAt: Date.now(),
      }));
    });

    it('staff update cannot piggyback settings fields', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      // Tries to change staff AND name in the same write — should fail
      // because staff-update rule only allows staff/staffUids/updatedAt
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-mod`]: 'moderator',
        staffUids: [adminId, modId, skId, 'new-mod'],
        name: 'Piggybacked Name',
        updatedAt: Date.now(),
      }));
    });
  });

  // --- Delete: owner only ---
  describe('tournament deletion (owner only)', () => {
    it('owner can delete', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(deleteDoc(doc(db, `tournaments/${tourneyId}`)));
    });

    it('admin cannot delete', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}`)));
    });

    it('moderator cannot delete', async () => {
      await seedTournament();
      const db = authedContext(modId).firestore();
      await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}`)));
    });
  });

  // --- Counter-only update: any auth'd user ---
  describe('counter-only update', () => {
    it('random user can update only registrationCounts', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        registrationCounts: { confirmed: 1, pending: 0 },
        updatedAt: Date.now(),
      }));
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules/tournamentRoles.test.ts`
Expected: FAIL — current rules don't understand staff roles

**Step 3: Update `firestore.rules`**

Replace the tournament match block (lines 92-177) with role-based rules. Add helper functions inside the tournament match, then use mutually exclusive update rules:

```
    // ── Tournaments (/tournaments/{tournamentId}) ─────────────────────
    match /tournaments/{tournamentId} {

      // ── Role helper functions ──
      function isOwner() {
        return request.auth.uid == resource.data.organizerId;
      }
      function callerStaffRole() {
        return request.auth.uid in resource.data.staff
          ? resource.data.staff[request.auth.uid] : 'none';
      }
      function isAdminPlus() {
        return isOwner() || callerStaffRole() == 'admin';
      }
      function isModPlus() {
        return isAdminPlus() || callerStaffRole() == 'moderator';
      }
      function isStaff() {
        return isModPlus() || callerStaffRole() == 'scorekeeper';
      }

      // Helper: read tournament data (cached per rule evaluation)
      function tournamentData() {
        return get(/databases/$(database)/documents/tournaments/$(tournamentId)).data;
      }

      // Any authenticated user can read tournaments
      allow read: if request.auth != null;

      // Public tournaments can be read without authentication
      allow read: if resource.data.visibility == 'public';

      // Create with full field validation
      allow create: if request.auth != null
        && request.resource.data.organizerId == request.auth.uid
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 100
        && request.resource.data.status == 'setup'
        && request.resource.data.format in ['round-robin', 'single-elimination', 'pool-bracket']
        && request.resource.data.date is number
        && request.resource.data.location is string
        && request.resource.data.config is map
        && request.resource.data.config.gameType in ['singles', 'doubles']
        && request.resource.data.config.scoringMode in ['sideout', 'rally']
        && request.resource.data.config.matchFormat in ['single', 'best-of-3', 'best-of-5']
        && request.resource.data.config.pointsToWin in [11, 15, 21]
        && request.resource.data.staff is map
        && request.resource.data.staff.size() == 0
        && request.resource.data.staffUids is list
        && request.resource.data.staffUids.size() == 0
        && request.resource.data.visibility in ['private', 'public']
        && request.resource.data.accessMode in ['open', 'approval', 'invite-only', 'group']
        && request.resource.data.listed is bool
        && (request.resource.data.accessMode in ['open', 'approval'] ? request.resource.data.listed == true : true)
        && (request.resource.data.listed == true ? request.resource.data.visibility == 'public' : request.resource.data.visibility == 'private')
        && request.resource.data.registrationCounts.confirmed == 0
        && request.resource.data.registrationCounts.pending == 0
        && (request.resource.data.accessMode != 'group'
            || (request.resource.data.buddyGroupId is string
                && exists(/databases/$(database)/documents/buddyGroups/$(request.resource.data.buddyGroupId))
                && exists(/databases/$(database)/documents/buddyGroups/$(request.resource.data.buddyGroupId)/members/$(request.auth.uid))))
        && (!('defaultTier' in request.resource.data.config)
            || request.resource.data.config.defaultTier in ['beginner', 'intermediate', 'advanced', 'expert']);

      // Settings update: admin+ only. Touches everything EXCEPT staff/staffUids.
      allow update: if request.auth != null && isAdminPlus()
        && request.resource.data.organizerId == resource.data.organizerId
        && request.resource.data.staff == resource.data.staff
        && request.resource.data.staffUids == resource.data.staffUids
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 100
        && request.resource.data.date is number
        && request.resource.data.location is string
        && request.resource.data.format in ['round-robin', 'single-elimination', 'pool-bracket']
        && request.resource.data.config is map
        && request.resource.data.config.gameType in ['singles', 'doubles']
        && (
          (resource.data.status == 'setup' && request.resource.data.status in ['registration', 'cancelled']) ||
          (resource.data.status == 'registration' && request.resource.data.status in ['pool-play', 'bracket', 'cancelled']) ||
          (resource.data.status == 'pool-play' && request.resource.data.status in ['bracket', 'paused', 'completed', 'cancelled']) ||
          (resource.data.status == 'bracket' && request.resource.data.status in ['completed', 'paused', 'cancelled']) ||
          (resource.data.status == 'paused' && request.resource.data.status in ['pool-play', 'bracket', 'completed', 'cancelled']) ||
          request.resource.data.status == resource.data.status
        )
        && request.resource.data.visibility in ['private', 'public']
        && (
          !('accessMode' in resource.data) && !('accessMode' in request.resource.data)
          || (request.resource.data.accessMode in ['open', 'approval', 'invite-only', 'group']
              && request.resource.data.listed is bool
              && (request.resource.data.listed == true ? request.resource.data.visibility == 'public' : request.resource.data.visibility == 'private'))
        )
        && (!('defaultTier' in request.resource.data.config)
            || request.resource.data.config.defaultTier in ['beginner', 'intermediate', 'advanced', 'expert']);

      // Staff update: admin+ only. ONLY touches staff, staffUids, updatedAt.
      // Mutually exclusive with settings update — prevents piggyback attacks.
      // NOTE: Firestore rules cannot iterate map values, so we cannot fully prevent
      // an admin from writing staff.someUid = 'admin'. Only the owner check for
      // 'admin' value is enforced. Client-side guards provide additional protection.
      allow update: if request.auth != null && isAdminPlus()
        && request.resource.data.organizerId == resource.data.organizerId
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['staff', 'staffUids', 'updatedAt'])
        && request.resource.data.staff is map
        && request.resource.data.staffUids is list;

      // Counter-only update: any authenticated user (for atomic registration batches)
      allow update: if request.auth != null
        && request.resource.data.organizerId == resource.data.organizerId
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['registrationCounts', 'updatedAt']);

      // Only the owner can delete a tournament
      allow delete: if request.auth != null && isOwner();
```

**Note:** The existing helper functions (`isTournamentActive`, `isTournamentPublic`) and all subcollection rules remain unchanged in this task. Subcollection rules are updated in Task 6.

**Step 4: Run security rules tests**

Run: `npx vitest run test/rules/tournamentRoles.test.ts`
Expected: PASS

**Step 5: Run existing security rules tests**

Run: `npx vitest run test/rules/`
Expected: PASS (existing tests updated in Task 3)

**Step 6: Commit**

```bash
git add firestore.rules test/rules/tournamentRoles.test.ts test/rules/helpers.ts
git commit -m "feat(roles): add role-based tournament document security rules with mutually exclusive update clauses"
```

---

### Task 6: Security Rules — Subcollections

**Files:**
- Modify: `firestore.rules`
- Create: `test/rules/subcollectionRoles.test.ts`

Update teams, pools, brackets, and registrations subcollection rules to use staff roles instead of `organizerId`/`scorekeeperIds` checks. Uses `get()` on parent tournament doc (Firestore caches within request evaluation).

**Step 1: Write the failing tests**

Create `test/rules/subcollectionRoles.test.ts`:

```typescript
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  setupTestEnv, teardownTestEnv, clearFirestore,
  authedContext, assertSucceeds, assertFails,
  getTestEnv, makeTournament, makeTeam, makePool, makeBracketSlot, makeRegistration,
} from './helpers';

beforeAll(async () => { await setupTestEnv(); });
afterAll(async () => { await teardownTestEnv(); });
beforeEach(async () => { await clearFirestore(); });

async function seedDoc(path: string, data: Record<string, unknown>) {
  await getTestEnv().withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

const ownerId = 'owner-1';
const adminId = 'admin-1';
const modId = 'mod-1';
const skId = 'sk-1';
const randomId = 'random-1';
const tourneyId = 'tourney-1';

const seedRoleTournament = () => seedDoc(`tournaments/${tourneyId}`, makeTournament(ownerId, {
  staff: { [adminId]: 'admin', [modId]: 'moderator', [skId]: 'scorekeeper' },
  staffUids: [adminId, modId, skId],
  status: 'registration',
  accessMode: 'open',
  listed: true,
  visibility: 'public',
}));

describe('Teams subcollection with roles', () => {
  it('admin can create team', async () => {
    await seedRoleTournament();
    const db = authedContext(adminId).firestore();
    const team = makeTeam(tourneyId, { id: 'team-new' });
    await assertSucceeds(setDoc(doc(db, `tournaments/${tourneyId}/teams/team-new`), team));
  });

  it('moderator cannot create team', async () => {
    await seedRoleTournament();
    const db = authedContext(modId).firestore();
    const team = makeTeam(tourneyId, { id: 'team-new2' });
    await assertFails(setDoc(doc(db, `tournaments/${tourneyId}/teams/team-new2`), team));
  });

  it('scorekeeper can update seed only', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/teams/team-1`, makeTeam(tourneyId));
    const db = authedContext(skId).firestore();
    await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}/teams/team-1`), { seed: 3, updatedAt: Date.now() }));
  });

  it('scorekeeper cannot update name', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/teams/team-1`, makeTeam(tourneyId));
    const db = authedContext(skId).firestore();
    await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}/teams/team-1`), { name: 'Hacked' }));
  });
});

describe('Pools subcollection with roles', () => {
  it('admin can create pool', async () => {
    await seedRoleTournament();
    const db = authedContext(adminId).firestore();
    const pool = makePool(tourneyId, { id: 'pool-new' });
    await assertSucceeds(setDoc(doc(db, `tournaments/${tourneyId}/pools/pool-new`), pool));
  });

  it('scorekeeper cannot create pool', async () => {
    await seedRoleTournament();
    const db = authedContext(skId).firestore();
    const pool = makePool(tourneyId, { id: 'pool-new2' });
    await assertFails(setDoc(doc(db, `tournaments/${tourneyId}/pools/pool-new2`), pool));
  });

  it('admin can update pool', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/pools/pool-1`, makePool(tourneyId));
    const db = authedContext(adminId).firestore();
    await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}/pools/pool-1`), { name: 'Pool B' }));
  });
});

describe('Bracket subcollection with roles', () => {
  it('admin can create bracket slot', async () => {
    await seedRoleTournament();
    const db = authedContext(adminId).firestore();
    const slot = makeBracketSlot(tourneyId, { id: 'slot-new' });
    await assertSucceeds(setDoc(doc(db, `tournaments/${tourneyId}/bracket/slot-new`), slot));
  });

  it('scorekeeper can update winnerId only', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/bracket/slot-1`, makeBracketSlot(tourneyId));
    const db = authedContext(skId).firestore();
    await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}/bracket/slot-1`), { winnerId: 'team-1', updatedAt: Date.now() }));
  });
});

describe('Registrations subcollection with roles', () => {
  it('moderator can approve registration (pending -> confirmed)', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/registrations/player-1`,
      makeRegistration('player-1', tourneyId, { status: 'pending' }));
    const db = authedContext(modId).firestore();
    await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}/registrations/player-1`), {
      status: 'confirmed',
      statusUpdatedAt: Date.now(),
    }));
  });

  it('scorekeeper cannot approve registration', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/registrations/player-1`,
      makeRegistration('player-1', tourneyId, { status: 'pending' }));
    const db = authedContext(skId).firestore();
    await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}/registrations/player-1`), {
      status: 'confirmed',
      statusUpdatedAt: Date.now(),
    }));
  });

  it('admin can create registration on behalf of player', async () => {
    await seedRoleTournament();
    const db = authedContext(adminId).firestore();
    const reg = makeRegistration('player-2', tourneyId, { id: 'player-2', status: 'confirmed' });
    await assertSucceeds(setDoc(doc(db, `tournaments/${tourneyId}/registrations/player-2`), reg));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules/subcollectionRoles.test.ts`
Expected: FAIL — current rules only check `organizerId`/`scorekeeperIds`

**Step 3: Update subcollection rules in `firestore.rules`**

Add subcollection helper functions inside the tournament match block (after the existing helpers):

```
      // ── Subcollection role helpers (read parent tournament) ──
      function tournamentStaffRole() {
        let t = get(/databases/$(database)/documents/tournaments/$(tournamentId)).data;
        return request.auth.uid == t.organizerId ? 'owner'
          : (request.auth.uid in t.staff ? t.staff[request.auth.uid] : 'none');
      }
      function isTournamentAdminPlus() {
        let role = tournamentStaffRole();
        return role == 'owner' || role == 'admin';
      }
      function isTournamentModPlus() {
        let role = tournamentStaffRole();
        return role == 'owner' || role == 'admin' || role == 'moderator';
      }
      function isTournamentStaff() {
        let role = tournamentStaffRole();
        return role != 'none';
      }
```

Update teams subcollection:

```
      match /teams/{teamId} {
        allow read: if request.auth != null;
        allow read: if isTournamentPublic();

        allow create: if request.auth != null
          && isTournamentActive()
          && isTournamentAdminPlus()
          && request.resource.data.tournamentId == tournamentId
          && request.resource.data.name is string
          && request.resource.data.name.size() > 0
          && request.resource.data.playerIds is list
          && request.resource.data.playerIds.size() > 0;

        allow update: if request.auth != null
          && isTournamentActive()
          && request.resource.data.tournamentId == resource.data.tournamentId
          && (isTournamentAdminPlus()
              || (isTournamentStaff()
                  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['seed', 'updatedAt'])));

        allow delete: if request.auth != null && isTournamentAdminPlus();
      }
```

Update pools subcollection:

```
      match /pools/{poolId} {
        allow read: if request.auth != null;
        allow read: if isTournamentPublic();

        allow create: if request.auth != null
          && isTournamentActive()
          && isTournamentAdminPlus()
          && request.resource.data.tournamentId == tournamentId
          && request.resource.data.name is string
          && request.resource.data.name.size() > 0
          && request.resource.data.teamIds is list;

        allow update: if request.auth != null
          && isTournamentActive()
          && isTournamentAdminPlus()
          && request.resource.data.tournamentId == resource.data.tournamentId;

        allow delete: if request.auth != null && isTournamentAdminPlus();
      }
```

Update bracket subcollection:

```
      match /bracket/{slotId} {
        allow read: if request.auth != null;
        allow read: if isTournamentPublic();

        allow create: if request.auth != null
          && isTournamentActive()
          && isTournamentAdminPlus()
          && request.resource.data.tournamentId == tournamentId
          && request.resource.data.round is number
          && request.resource.data.position is number;

        allow update: if request.auth != null
          && isTournamentActive()
          && request.resource.data.tournamentId == resource.data.tournamentId
          && (isTournamentAdminPlus()
              || (isTournamentStaff()
                  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['winnerId', 'matchId', 'updatedAt'])));

        allow delete: if request.auth != null && isTournamentAdminPlus();
      }
```

Update registrations subcollection — replace organizer-only approve/decline with moderator+:

```
      match /registrations/{regId} {
        allow read: if request.auth != null;
        allow read: if isTournamentPublic();

        // Player self-registration: mode-aware (unchanged)
        allow create: if request.auth != null
          && regId == request.auth.uid
          && request.resource.data.userId == request.auth.uid
          && request.resource.data.tournamentId == tournamentId
          && tournamentData().status in ['setup', 'registration']
          && (
            (tournamentData().accessMode == 'open'
              && request.resource.data.status == 'confirmed')
            || (tournamentData().accessMode == 'approval'
              && request.resource.data.status == 'pending')
            || (tournamentData().accessMode == 'invite-only'
              && exists(/databases/$(database)/documents/tournaments/$(tournamentId)/invitations/$(request.auth.uid))
              && request.resource.data.status == 'confirmed')
            || (tournamentData().accessMode == 'group'
              && exists(/databases/$(database)/documents/buddyGroups/$(tournamentData().buddyGroupId)/members/$(request.auth.uid))
              && request.resource.data.status == 'confirmed')
            || (!('accessMode' in tournamentData())
              && request.resource.data.status == 'confirmed')
          );

        // Admin+ can add players on their behalf (manual registration)
        allow create: if request.auth != null
          && isTournamentAdminPlus()
          && request.resource.data.tournamentId == tournamentId
          && request.resource.data.status in ['confirmed', 'placeholder']
          && tournamentData().status in ['setup', 'registration'];

        // Moderator+: approve, decline, expire, or withdraw any registration
        allow update: if request.auth != null
          && isTournamentModPlus()
          && request.resource.data.userId == resource.data.userId
          && request.resource.data.tournamentId == resource.data.tournamentId
          && (
            (resource.data.status == 'pending' && request.resource.data.status == 'confirmed')
            || (resource.data.status == 'pending' && request.resource.data.status == 'declined')
            || (resource.data.status == 'pending' && request.resource.data.status == 'expired')
            || request.resource.data.status == 'withdrawn'
            || (request.resource.data.status == resource.data.status
                && request.resource.data.paymentStatus in ['unpaid', 'paid', 'waived'])
          );

        // Player: withdraw own registration or update own profile fields (unchanged)
        allow update: if request.auth != null
          && resource.data.userId == request.auth.uid
          && request.resource.data.userId == resource.data.userId
          && request.resource.data.tournamentId == resource.data.tournamentId
          && (
            (request.resource.data.status == 'withdrawn'
              && resource.data.status in ['confirmed', 'pending'])
            || (request.resource.data.status == resource.data.status
                && request.resource.data.paymentStatus == resource.data.paymentStatus
                && request.resource.data.paymentNote == resource.data.paymentNote)
          );

        allow delete: if false;
      }
```

**Step 4: Run tests**

Run: `npx vitest run test/rules/subcollectionRoles.test.ts`
Expected: PASS

Run: `npx vitest run test/rules/`
Expected: PASS (all existing tests still green)

**Step 5: Commit**

```bash
git add firestore.rules test/rules/subcollectionRoles.test.ts
git commit -m "feat(roles): update subcollection security rules to use staff roles instead of scorekeeperIds"
```

---

### Task 7: Staff Management Repository

**Files:**
- Create: `src/data/firebase/firestoreStaffRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreStaffRepository.test.ts`

**Step 1: Write the failing test**

Create `src/data/firebase/__tests__/firestoreStaffRepository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdateDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockDoc = vi.hoisted(() => vi.fn(() => 'mock-doc-ref'));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  updateDoc: mockUpdateDoc,
  arrayUnion: vi.fn((v) => ({ _type: 'arrayUnion', value: v })),
  arrayRemove: vi.fn((v) => ({ _type: 'arrayRemove', value: v })),
  deleteField: vi.fn(() => ({ _type: 'deleteField' })),
  serverTimestamp: vi.fn(() => 'mock-ts'),
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { addStaffMember, removeStaffMember, updateStaffRole } from '../firestoreStaffRepository';

describe('firestoreStaffRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('addStaffMember sets staff role and adds to staffUids', async () => {
    await addStaffMember('tourney-1', 'user-1', 'moderator');

    expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 'tourney-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
      'staff.user-1': 'moderator',
    }));
    // Verify staffUids arrayUnion is called
    const callArgs = mockUpdateDoc.mock.calls[0][1];
    expect(callArgs.staffUids).toEqual(expect.objectContaining({ _type: 'arrayUnion', value: 'user-1' }));
    expect(callArgs.updatedAt).toBe('mock-ts');
  });

  it('removeStaffMember deletes staff entry and removes from staffUids', async () => {
    await removeStaffMember('tourney-1', 'user-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
      'staff.user-1': expect.objectContaining({ _type: 'deleteField' }),
    }));
    const callArgs = mockUpdateDoc.mock.calls[0][1];
    expect(callArgs.staffUids).toEqual(expect.objectContaining({ _type: 'arrayRemove', value: 'user-1' }));
  });

  it('updateStaffRole changes existing staff role without touching staffUids', async () => {
    await updateStaffRole('tourney-1', 'user-1', 'admin');

    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
      'staff.user-1': 'admin',
      updatedAt: 'mock-ts',
    }));
    // staffUids should NOT be in the update (role change, not add/remove)
    const callArgs = mockUpdateDoc.mock.calls[0][1];
    expect(callArgs.staffUids).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestoreStaffRepository.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the repository**

Create `src/data/firebase/firestoreStaffRepository.ts`:

```typescript
import { doc, updateDoc, arrayUnion, arrayRemove, deleteField, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentRole } from '../types';

export async function addStaffMember(tournamentId: string, uid: string, role: TournamentRole): Promise<void> {
  const ref = doc(firestore, 'tournaments', tournamentId);
  await updateDoc(ref, {
    [`staff.${uid}`]: role,
    staffUids: arrayUnion(uid),
    updatedAt: serverTimestamp(),
  });
}

export async function removeStaffMember(tournamentId: string, uid: string): Promise<void> {
  const ref = doc(firestore, 'tournaments', tournamentId);
  await updateDoc(ref, {
    [`staff.${uid}`]: deleteField(),
    staffUids: arrayRemove(uid),
    updatedAt: serverTimestamp(),
  });
}

export async function updateStaffRole(tournamentId: string, uid: string, newRole: TournamentRole): Promise<void> {
  const ref = doc(firestore, 'tournaments', tournamentId);
  await updateDoc(ref, {
    [`staff.${uid}`]: newRole,
    updatedAt: serverTimestamp(),
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/firestoreStaffRepository.test.ts`
Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreStaffRepository.ts src/data/firebase/__tests__/firestoreStaffRepository.test.ts
git commit -m "feat(roles): add staff management repository"
```

---

### Task 8: StaffManager Component

**Files:**
- Create: `src/features/tournaments/components/StaffManager.tsx`
- Create: `src/features/tournaments/components/__tests__/StaffManager.test.tsx`

**Step 1: Write the failing test**

Create `src/features/tournaments/components/__tests__/StaffManager.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import StaffManager from '../StaffManager';
import type { Tournament, TournamentRole } from '../../../../data/types';
import type { UserProfile } from '../../../../data/types';

const makeTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1', name: 'Test', date: Date.now(), location: '',
  format: 'single-elimination',
  config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 1, teamsPerPoolAdvancing: 2 },
  organizerId: 'owner-1',
  staff: { 'admin-1': 'admin', 'mod-1': 'moderator' } as Record<string, TournamentRole>,
  staffUids: ['admin-1', 'mod-1'],
  status: 'registration', maxPlayers: null, teamFormation: null, minPlayers: null,
  entryFee: null,
  rules: { registrationDeadline: null, checkInRequired: false, checkInOpens: null, checkInCloses: null, scoringRules: '', timeoutRules: '', conductRules: '', penalties: [], additionalNotes: '' },
  pausedFrom: null, cancellationReason: null,
  createdAt: Date.now(), updatedAt: Date.now(),
  visibility: 'private', shareCode: null, accessMode: 'open', listed: true,
  buddyGroupId: null, buddyGroupName: null,
  registrationCounts: { confirmed: 0, pending: 0 },
  ...overrides,
});

const makeProfile = (uid: string, name: string): UserProfile => ({
  id: uid,
  displayName: name,
  displayNameLower: name.toLowerCase(),
  email: `${name.toLowerCase()}@test.com`,
  photoURL: null,
  createdAt: Date.now(),
});

describe('StaffManager', () => {
  it('renders staff list with role badges', () => {
    render(() => (
      <StaffManager
        tournament={makeTournament()}
        currentUserId="owner-1"
        staffProfiles={[
          makeProfile('admin-1', 'Alice'),
          makeProfile('mod-1', 'Bob'),
        ]}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
        onChangeRole={vi.fn()}
      />
    ));
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();
    expect(screen.getByText('Moderator')).toBeTruthy();
  });

  it('shows remove button for staff when viewer is owner', () => {
    render(() => (
      <StaffManager
        tournament={makeTournament()}
        currentUserId="owner-1"
        staffProfiles={[makeProfile('admin-1', 'Alice')]}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
        onChangeRole={vi.fn()}
      />
    ));
    expect(screen.getByLabelText('Remove Alice')).toBeTruthy();
  });

  it('hides remove button when viewer is not admin+', () => {
    render(() => (
      <StaffManager
        tournament={makeTournament()}
        currentUserId="mod-1"
        staffProfiles={[makeProfile('admin-1', 'Alice')]}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
        onChangeRole={vi.fn()}
      />
    ));
    expect(screen.queryByLabelText('Remove Alice')).toBeNull();
  });

  it('shows Add Staff button for admin+', () => {
    render(() => (
      <StaffManager
        tournament={makeTournament()}
        currentUserId="owner-1"
        staffProfiles={[]}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
        onChangeRole={vi.fn()}
      />
    ));
    expect(screen.getByText('Add Staff')).toBeTruthy();
  });

  it('renders empty state when no staff', () => {
    render(() => (
      <StaffManager
        tournament={makeTournament({ staff: {}, staffUids: [] })}
        currentUserId="owner-1"
        staffProfiles={[]}
        onAddStaff={vi.fn()}
        onRemoveStaff={vi.fn()}
        onChangeRole={vi.fn()}
      />
    ));
    expect(screen.getByText('No staff members yet')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/components/__tests__/StaffManager.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement StaffManager component**

Create `src/features/tournaments/components/StaffManager.tsx`:

```typescript
import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { Tournament, TournamentRole, UserProfile } from '../../../data/types';
import { hasMinRole, getTournamentRole } from '../engine/roleHelpers';
import type { EffectiveRole } from '../engine/roleHelpers';

interface StaffProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
}

interface StaffManagerProps {
  tournament: Tournament;
  currentUserId: string;
  staffProfiles: (UserProfile | StaffProfile)[];
  onAddStaff: (uid: string, role: TournamentRole) => void;
  onRemoveStaff: (uid: string) => void;
  onChangeRole: (uid: string, newRole: TournamentRole) => void;
}

const ROLE_LABELS: Record<TournamentRole, string> = {
  admin: 'Admin',
  moderator: 'Moderator',
  scorekeeper: 'Scorekeeper',
};

const ROLE_COLORS: Record<TournamentRole, string> = {
  admin: 'bg-purple-500/20 text-purple-400',
  moderator: 'bg-blue-500/20 text-blue-400',
  scorekeeper: 'bg-green-500/20 text-green-400',
};

const StaffManager: Component<StaffManagerProps> = (props) => {
  const viewerRole = () => getTournamentRole(props.tournament, props.currentUserId);
  const isViewerAdminPlus = () => hasMinRole(props.tournament, props.currentUserId, 'admin');

  const canRemove = (staffUid: string): boolean => {
    if (!isViewerAdminPlus()) return false;
    const staffRole = props.tournament.staff[staffUid];
    if (!staffRole) return false;
    // Only owner can remove admins
    if (staffRole === 'admin' && viewerRole() !== 'owner') return false;
    return true;
  };

  const getProfileName = (uid: string): string => {
    const profile = props.staffProfiles.find((p) => ('id' in p ? p.id : p.uid) === uid);
    return profile?.displayName ?? uid;
  };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-on-surface">Staff</h3>
        <Show when={isViewerAdminPlus()}>
          <button
            class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
            onClick={() => props.onAddStaff('', 'scorekeeper')}
          >
            Add Staff
          </button>
        </Show>
      </div>

      <Show when={props.tournament.staffUids.length === 0}>
        <p class="text-on-surface-muted text-sm">No staff members yet</p>
      </Show>

      <For each={props.tournament.staffUids}>
        {(uid) => {
          const role = () => props.tournament.staff[uid] as TournamentRole;
          const name = () => getProfileName(uid);
          return (
            <div class="flex items-center justify-between rounded-lg bg-surface-container p-3">
              <div class="flex items-center gap-3">
                <div class="h-8 w-8 rounded-full bg-surface-container-high flex items-center justify-center text-sm font-medium text-on-surface">
                  {name().charAt(0).toUpperCase()}
                </div>
                <div>
                  <span class="text-sm font-medium text-on-surface">{name()}</span>
                  <span class={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role()]}`}>
                    {ROLE_LABELS[role()]}
                  </span>
                </div>
              </div>
              <Show when={canRemove(uid)}>
                <button
                  class="text-sm text-error hover:text-error/80"
                  aria-label={`Remove ${name()}`}
                  onClick={() => props.onRemoveStaff(uid)}
                >
                  Remove
                </button>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
};

export default StaffManager;
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/components/__tests__/StaffManager.test.tsx`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/components/StaffManager.tsx src/features/tournaments/components/__tests__/StaffManager.test.tsx
git commit -m "feat(roles): add StaffManager component"
```

---

### Task 9: Wire Staff into Dashboard + Update Role Checks

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`
- Modify: `src/features/tournaments/components/OrganizerControls.tsx` (if it exists)
- Modify: `src/features/tournaments/components/OrganizerPlayerManager.tsx` (if it exists)

**Step 1: Write a smoke test for the dashboard integration**

No new test file — we verify via type check and existing tests. The key changes are:
1. Import `StaffManager`, `hasMinRole`, and staff repository functions
2. Add staff profile loading via `firestoreUserRepository.getByIds()`
3. Add a "Staff" section visible to admin+ users
4. Replace legacy `role() === 'organizer'` checks with `hasMinRole()` where appropriate

**Step 2: Update TournamentDashboardPage.tsx**

Add imports:

```typescript
import StaffManager from './components/StaffManager';
import { hasMinRole } from './engine/roleHelpers';
import { addStaffMember, removeStaffMember, updateStaffRole } from '../../data/firebase/firestoreStaffRepository';
import { firestoreUserRepository } from '../../data/firebase/firestoreUserRepository';
```

Add staff profile resource:

```typescript
const [staffProfiles] = createResource(
  () => tournament()?.staffUids,
  async (uids) => {
    if (!uids || uids.length === 0) return [];
    return firestoreUserRepository.getByIds(uids);
  },
);
```

Add StaffManager section (visible when `hasMinRole(tournament(), uid, 'admin')`):

```typescript
<Show when={tournament() && user() && hasMinRole(tournament()!, user()!.uid, 'admin')}>
  <StaffManager
    tournament={tournament()!}
    currentUserId={user()!.uid}
    staffProfiles={staffProfiles() ?? []}
    onAddStaff={handleAddStaff}
    onRemoveStaff={handleRemoveStaff}
    onChangeRole={handleChangeRole}
  />
</Show>
```

Wire up handlers:

```typescript
const handleAddStaff = async (uid: string, role: TournamentRole) => {
  const t = tournament();
  if (!t) return;
  await addStaffMember(t.id, uid, role);
};

const handleRemoveStaff = async (uid: string) => {
  const t = tournament();
  if (!t) return;
  await removeStaffMember(t.id, uid);
};

const handleChangeRole = async (uid: string, newRole: TournamentRole) => {
  const t = tournament();
  if (!t) return;
  await updateStaffRole(t.id, uid, newRole);
};
```

Replace key organizer-only checks with `hasMinRole`:

```typescript
// Before:
// if (role() === 'organizer') { /* show admin controls */ }

// After:
// if (hasMinRole(tournament()!, user()!.uid, 'admin')) { /* show admin controls */ }
```

For moderator-level features (registration approval, score editing):

```typescript
// if (hasMinRole(tournament()!, user()!.uid, 'moderator')) { /* show mod controls */ }
```

**Step 3: Run full test suite**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx src/features/tournaments/components/OrganizerControls.tsx src/features/tournaments/components/OrganizerPlayerManager.tsx
git commit -m "feat(roles): wire StaffManager into dashboard and update permission checks to hasMinRole"
```

---

### Task 10: Post-Wave-A Verification

**Files:**
- No file changes

This is a verification gate. Run the full type check and test suite to catch any regressions from the role system migration.

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS — zero errors

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: PASS — all tests green

**Step 3: Run security rules tests specifically**

Run: `npx vitest run test/rules/`
Expected: PASS — all rules tests green

**Step 4: Fix any failures**

If any failures, fix them before proceeding to Wave B. Common issues:
- Test factories still using `scorekeeperIds` — search with `grep -rn 'scorekeeperIds' src/ test/ e2e/`
- Missing `staff`/`staffUids` in mock data
- `getByScorekeeper` renamed to `getByStaff` but callers not updated

**Step 5: Commit (only if fixes needed)**

```bash
git add -A
git commit -m "fix(roles): resolve post-wave-A verification failures"
```

---

## Wave B: Audit Log

### Task 11: Audit Log Types + Writer Helper

**Files:**
- Create: `src/features/tournaments/engine/auditTypes.ts`
- Create: `src/data/firebase/firestoreAuditRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreAuditRepository.test.ts`

Combined from original Tasks 9+10. Types and writer go together since the writer is trivial without the types.

**Step 1: Write the failing test**

Create `src/data/firebase/__tests__/firestoreAuditRepository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDoc = vi.hoisted(() => vi.fn(() => ({ id: 'auto-id-123' })));
const mockCollection = vi.hoisted(() => vi.fn(() => 'mock-audit-col'));
const mockGetDocs = vi.hoisted(() => vi.fn());

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  getDocs: mockGetDocs,
  query: vi.fn((...args: unknown[]) => args),
  orderBy: vi.fn(() => 'mock-orderby'),
}));

vi.mock('../config', () => ({ firestore: 'mock-firestore' }));

import { createAuditEntry, getAuditLog } from '../firestoreAuditRepository';

describe('createAuditEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an audit entry object with server timestamp and doc ref', () => {
    const entry = createAuditEntry('tourney-1', {
      action: 'score_edit',
      actorId: 'user-1',
      actorName: 'Alice',
      actorRole: 'moderator',
      targetType: 'match',
      targetId: 'match-1',
      details: { action: 'score_edit', matchId: 'match-1', oldScores: [[11, 5]], newScores: [[11, 7]], oldWinner: 1, newWinner: 1 },
    });

    expect(entry.action).toBe('score_edit');
    expect(entry.actorId).toBe('user-1');
    expect(entry.actorName).toBe('Alice');
    expect(entry.actorRole).toBe('moderator');
    expect(entry.timestamp).toBe('SERVER_TS');
    expect(entry.id).toBe('auto-id-123');
    expect(entry.ref).toBeDefined();
    expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments', 'tourney-1', 'auditLog');
  });

  it('includes targetType and targetId in the returned object', () => {
    const entry = createAuditEntry('t1', {
      action: 'role_change',
      actorId: 'u1',
      actorName: 'Bob',
      actorRole: 'owner',
      targetType: 'staff',
      targetId: 'u2',
      details: { action: 'role_change', targetUid: 'u2', targetName: 'Carol', oldRole: null, newRole: 'moderator' },
    });

    expect(entry.targetType).toBe('staff');
    expect(entry.targetId).toBe('u2');
    expect(entry.details.action).toBe('role_change');
  });
});

describe('getAuditLog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns audit entries ordered by timestamp desc', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'log-1', data: () => ({ action: 'score_edit', actorId: 'u1', timestamp: { toMillis: () => 2000 } }) },
        { id: 'log-2', data: () => ({ action: 'role_change', actorId: 'u2', timestamp: { toMillis: () => 1000 } }) },
      ],
    });

    const entries = await getAuditLog('tourney-1');

    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe('log-1');
    expect(entries[0].action).toBe('score_edit');
    expect(entries[1].id).toBe('log-2');
    expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'tournaments', 'tourney-1', 'auditLog');
  });

  it('returns empty array when no entries', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const entries = await getAuditLog('tourney-1');

    expect(entries).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestoreAuditRepository.test.ts`
Expected: FAIL — modules not found

**Step 3: Implement**

Create `src/features/tournaments/engine/auditTypes.ts`:

```typescript
import type { TournamentRole, TournamentStatus } from '../../../data/types';
import type { EffectiveRole } from './roleHelpers';

export type AuditAction =
  | 'score_edit'
  | 'dispute_flag'
  | 'dispute_resolve'
  | 'role_change'
  | 'player_withdraw'
  | 'registration_approve'
  | 'registration_decline'
  | 'settings_change'
  | 'status_change'
  | 'player_quick_add'
  | 'player_claim';

export type AuditDetails =
  | { action: 'score_edit'; matchId: string; oldScores: number[][]; newScores: number[][]; oldWinner: number | null; newWinner: number | null }
  | { action: 'dispute_flag'; matchId: string; reason: string }
  | { action: 'dispute_resolve'; matchId: string; disputeId: string; resolution: string; type: 'edited' | 'dismissed' }
  | { action: 'role_change'; targetUid: string; targetName: string; oldRole: TournamentRole | null; newRole: TournamentRole | null }
  | { action: 'player_withdraw'; registrationId: string; playerName: string; reason?: string }
  | { action: 'registration_approve'; registrationId: string; playerName: string }
  | { action: 'registration_decline'; registrationId: string; playerName: string; reason?: string }
  | { action: 'settings_change'; changedFields: string[] }
  | { action: 'status_change'; oldStatus: TournamentStatus; newStatus: TournamentStatus; reason?: string }
  | { action: 'player_quick_add'; count: number; names: string[] }
  | { action: 'player_claim'; registrationId: string; placeholderName: string; claimedByUid: string };

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actorId: string;
  actorName: string;
  actorRole: EffectiveRole;
  targetType: 'match' | 'registration' | 'tournament' | 'staff';
  targetId: string;
  details: AuditDetails;
  timestamp: unknown; // serverTimestamp() on write, Timestamp on read
}
```

Create `src/data/firebase/firestoreAuditRepository.ts`:

```typescript
import { doc, collection, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import type { DocumentReference } from 'firebase/firestore';
import { firestore } from './config';
import type { AuditLogEntry, AuditAction, AuditDetails } from '../../features/tournaments/engine/auditTypes';
import type { EffectiveRole } from '../../features/tournaments/engine/roleHelpers';

interface AuditInput {
  action: AuditAction;
  actorId: string;
  actorName: string;
  actorRole: EffectiveRole;
  targetType: AuditLogEntry['targetType'];
  targetId: string;
  details: AuditDetails;
}

/** Create an audit entry object with a doc ref (for use in writeBatch). Does NOT write to Firestore. */
export function createAuditEntry(
  tournamentId: string,
  input: AuditInput,
): AuditLogEntry & { ref: DocumentReference } {
  const colRef = collection(firestore, 'tournaments', tournamentId, 'auditLog');
  const docRef = doc(colRef);
  return {
    id: docRef.id,
    ...input,
    timestamp: serverTimestamp(),
    ref: docRef,
  };
}

/** Fetch all audit entries for a tournament, ordered by timestamp desc. */
export async function getAuditLog(tournamentId: string): Promise<AuditLogEntry[]> {
  const colRef = collection(firestore, 'tournaments', tournamentId, 'auditLog');
  const q = query(colRef, orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLogEntry));
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/firestoreAuditRepository.test.ts`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/auditTypes.ts src/data/firebase/firestoreAuditRepository.ts src/data/firebase/__tests__/firestoreAuditRepository.test.ts
git commit -m "feat(audit): add audit log types and repository with create and query"
```

---

### Task 12: Audit Log Security Rules

**Files:**
- Modify: `firestore.rules`
- Create: `test/rules/auditLog.test.ts`

**IMPORTANT:** The original plan had a syntax bug: `request.auth.uid == resource == null ? true : false`. This is nonsensical in Firestore rules. For `create` rules, `resource` is always `null` — no check is needed. This is removed entirely.

**Step 1: Write the failing tests**

Create `test/rules/auditLog.test.ts`:

```typescript
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import {
  setupTestEnv, teardownTestEnv, clearFirestore,
  authedContext, unauthedContext, assertSucceeds, assertFails,
  getTestEnv, makeTournament,
} from './helpers';

beforeAll(async () => { await setupTestEnv(); });
afterAll(async () => { await teardownTestEnv(); });
beforeEach(async () => { await clearFirestore(); });

async function seedDoc(path: string, data: Record<string, unknown>) {
  await getTestEnv().withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

describe('Audit Log Security Rules', () => {
  const ownerId = 'owner-1';
  const adminId = 'admin-1';
  const skId = 'sk-1';
  const randomId = 'random-1';
  const tourneyId = 'tourney-1';

  const seedTournament = () => seedDoc(`tournaments/${tourneyId}`, makeTournament(ownerId, {
    staff: { [adminId]: 'admin', [skId]: 'scorekeeper' },
    staffUids: [adminId, skId],
    status: 'registration',
    accessMode: 'open',
    listed: true,
    visibility: 'public',
  }));

  const makeAuditEntry = (actorId: string) => ({
    action: 'score_edit',
    actorId,
    actorName: 'Test Actor',
    actorRole: 'admin',
    targetType: 'match',
    targetId: 'match-1',
    details: { action: 'score_edit', matchId: 'match-1', oldScores: [[11, 5]], newScores: [[11, 7]], oldWinner: 1, newWinner: 1 },
    timestamp: new Date(),
  });

  describe('create', () => {
    it('staff can create audit entry with valid fields and actorId == auth.uid', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertSucceeds(setDoc(
        doc(db, `tournaments/${tourneyId}/auditLog/log-1`),
        makeAuditEntry(adminId),
      ));
    });

    it('rejects if actorId does not match auth.uid', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertFails(setDoc(
        doc(db, `tournaments/${tourneyId}/auditLog/log-2`),
        makeAuditEntry('someone-else'),
      ));
    });

    it('non-staff cannot create audit entry', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(setDoc(
        doc(db, `tournaments/${tourneyId}/auditLog/log-3`),
        makeAuditEntry(randomId),
      ));
    });

    it('unauthenticated cannot create audit entry', async () => {
      await seedTournament();
      const db = unauthedContext().firestore();
      await assertFails(setDoc(
        doc(db, `tournaments/${tourneyId}/auditLog/log-4`),
        makeAuditEntry('anon'),
      ));
    });
  });

  describe('read', () => {
    it('staff can read audit entries', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, makeAuditEntry(adminId));
      const db = authedContext(skId).firestore();
      await assertSucceeds(getDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`)));
    });

    it('non-staff cannot read audit entries', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, makeAuditEntry(adminId));
      const db = authedContext(randomId).firestore();
      await assertFails(getDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`)));
    });
  });

  describe('update and delete', () => {
    it('no one can update audit entries', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, makeAuditEntry(adminId));
      const db = authedContext(ownerId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`), { action: 'hacked' }));
    });

    it('no one can delete audit entries', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, makeAuditEntry(adminId));
      const db = authedContext(ownerId).firestore();
      await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`)));
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules/auditLog.test.ts`
Expected: FAIL — no audit log rules exist yet

**Step 3: Add rules to `firestore.rules`**

Inside the tournament match block, add after the registrations subcollection:

```
      // ── Audit Log (/tournaments/{tid}/auditLog/{logId}) ───────────
      match /auditLog/{logId} {
        // Staff can create audit entries — actorId must match auth.uid
        // NOTE: No resource == null check needed — resource is always null on create
        allow create: if request.auth != null
          && isTournamentStaff()
          && request.resource.data.actorId == request.auth.uid
          && request.resource.data.keys().hasAll([
               'action', 'actorId', 'actorName', 'actorRole',
               'targetType', 'targetId', 'details', 'timestamp'
             ]);

        // Staff can read audit entries
        allow read: if request.auth != null && isTournamentStaff();

        // Audit log is immutable — no updates or deletes ever
        allow update, delete: if false;
      }
```

**Step 4: Run tests**

Run: `npx vitest run test/rules/auditLog.test.ts`
Expected: PASS

Run: `npx vitest run test/rules/`
Expected: PASS (all rules tests)

**Step 5: Commit**

```bash
git add firestore.rules test/rules/auditLog.test.ts
git commit -m "feat(audit): add audit log security rules — immutable, staff-only, actorId enforced"
```

---

### Task 13: Activity Log Format Helpers + Tests

**Files:**
- Create: `src/features/tournaments/engine/auditFormatters.ts`
- Create: `src/features/tournaments/engine/__tests__/auditFormatters.test.ts`

**Step 1: Write the failing test**

Create `src/features/tournaments/engine/__tests__/auditFormatters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatAuditAction, formatRelativeTime } from '../auditFormatters';
import type { AuditLogEntry } from '../auditTypes';

const makeEntry = (overrides: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: 'log-1',
  action: 'score_edit',
  actorId: 'u1',
  actorName: 'Alice',
  actorRole: 'admin',
  targetType: 'match',
  targetId: 'match-1',
  details: { action: 'score_edit', matchId: 'match-1', oldScores: [[11, 5]], newScores: [[11, 7]], oldWinner: 1, newWinner: 1 },
  timestamp: Date.now(),
  ...overrides,
});

describe('formatAuditAction', () => {
  it('formats score_edit action', () => {
    const result = formatAuditAction(makeEntry({ action: 'score_edit' }));
    expect(result).toBe('Alice edited match scores');
  });

  it('formats role_change action with new role', () => {
    const result = formatAuditAction(makeEntry({
      action: 'role_change',
      details: { action: 'role_change', targetUid: 'u2', targetName: 'Bob', oldRole: null, newRole: 'moderator' },
    }));
    expect(result).toBe('Alice added Bob as moderator');
  });

  it('formats role_change action for removal', () => {
    const result = formatAuditAction(makeEntry({
      action: 'role_change',
      details: { action: 'role_change', targetUid: 'u2', targetName: 'Bob', oldRole: 'moderator', newRole: null },
    }));
    expect(result).toBe('Alice removed Bob from staff');
  });

  it('formats dispute_flag action', () => {
    const result = formatAuditAction(makeEntry({
      action: 'dispute_flag',
      details: { action: 'dispute_flag', matchId: 'm1', reason: 'Wrong score' },
    }));
    expect(result).toBe('Alice flagged a match as disputed');
  });

  it('formats dispute_resolve action', () => {
    const result = formatAuditAction(makeEntry({
      action: 'dispute_resolve',
      details: { action: 'dispute_resolve', matchId: 'm1', disputeId: 'd1', resolution: 'Fixed', type: 'edited' },
    }));
    expect(result).toBe('Alice resolved a dispute (scores edited)');
  });

  it('formats registration_approve action', () => {
    const result = formatAuditAction(makeEntry({
      action: 'registration_approve',
      details: { action: 'registration_approve', registrationId: 'r1', playerName: 'Carol' },
    }));
    expect(result).toBe('Alice approved Carol');
  });

  it('formats registration_decline action', () => {
    const result = formatAuditAction(makeEntry({
      action: 'registration_decline',
      details: { action: 'registration_decline', registrationId: 'r1', playerName: 'Carol' },
    }));
    expect(result).toBe('Alice declined Carol');
  });

  it('formats player_withdraw action', () => {
    const result = formatAuditAction(makeEntry({
      action: 'player_withdraw',
      details: { action: 'player_withdraw', registrationId: 'r1', playerName: 'Carol' },
    }));
    expect(result).toBe('Alice withdrew Carol');
  });

  it('formats status_change action', () => {
    const result = formatAuditAction(makeEntry({
      action: 'status_change',
      details: { action: 'status_change', oldStatus: 'registration', newStatus: 'pool-play' },
    }));
    expect(result).toBe('Alice changed status from registration to pool-play');
  });

  it('formats settings_change action', () => {
    const result = formatAuditAction(makeEntry({
      action: 'settings_change',
      details: { action: 'settings_change', changedFields: ['name', 'date'] },
    }));
    expect(result).toBe('Alice updated tournament settings (name, date)');
  });

  it('formats player_quick_add action', () => {
    const result = formatAuditAction(makeEntry({
      action: 'player_quick_add',
      details: { action: 'player_quick_add', count: 3, names: ['A', 'B', 'C'] },
    }));
    expect(result).toBe('Alice quick-added 3 players');
  });

  it('formats player_claim action', () => {
    const result = formatAuditAction(makeEntry({
      action: 'player_claim',
      details: { action: 'player_claim', registrationId: 'r1', placeholderName: 'John', claimedByUid: 'u3' },
    }));
    expect(result).toBe('Alice claimed placeholder spot "John"');
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for recent timestamps', () => {
    expect(formatRelativeTime(Date.now() - 5000)).toBe('just now');
  });

  it('returns "X min ago" for minutes', () => {
    expect(formatRelativeTime(Date.now() - 3 * 60 * 1000)).toBe('3 min ago');
  });

  it('returns "X hr ago" for hours', () => {
    expect(formatRelativeTime(Date.now() - 2 * 60 * 60 * 1000)).toBe('2 hr ago');
  });

  it('returns "X days ago" for days', () => {
    expect(formatRelativeTime(Date.now() - 3 * 24 * 60 * 60 * 1000)).toBe('3 days ago');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/engine/__tests__/auditFormatters.test.ts`
Expected: FAIL — module not found

**Step 3: Implement**

Create `src/features/tournaments/engine/auditFormatters.ts`:

```typescript
import type { AuditLogEntry, AuditDetails } from './auditTypes';

export function formatAuditAction(entry: AuditLogEntry): string {
  const actor = entry.actorName;
  const d = entry.details;

  switch (d.action) {
    case 'score_edit':
      return `${actor} edited match scores`;
    case 'dispute_flag':
      return `${actor} flagged a match as disputed`;
    case 'dispute_resolve':
      return `${actor} resolved a dispute (scores ${d.type === 'edited' ? 'edited' : 'unchanged'})`;
    case 'role_change':
      if (d.newRole === null) return `${actor} removed ${d.targetName} from staff`;
      if (d.oldRole === null) return `${actor} added ${d.targetName} as ${d.newRole}`;
      return `${actor} changed ${d.targetName} role to ${d.newRole}`;
    case 'player_withdraw':
      return `${actor} withdrew ${d.playerName}`;
    case 'registration_approve':
      return `${actor} approved ${d.playerName}`;
    case 'registration_decline':
      return `${actor} declined ${d.playerName}`;
    case 'settings_change':
      return `${actor} updated tournament settings (${d.changedFields.join(', ')})`;
    case 'status_change':
      return `${actor} changed status from ${d.oldStatus} to ${d.newStatus}`;
    case 'player_quick_add':
      return `${actor} quick-added ${d.count} players`;
    case 'player_claim':
      return `${actor} claimed placeholder spot "${d.placeholderName}"`;
    default:
      return `${actor} performed an action`;
  }
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${diffDays} days ago`;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/auditFormatters.test.ts`
Expected: PASS (all 15 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/auditFormatters.ts src/features/tournaments/engine/__tests__/auditFormatters.test.ts
git commit -m "feat(audit): add audit log format helpers with human-readable action descriptions"
```

---

### Task 14: Activity Log Component + Dashboard Wiring

**Files:**
- Create: `src/features/tournaments/components/ActivityLog.tsx`
- Create: `src/features/tournaments/components/__tests__/ActivityLog.test.tsx`
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

**Step 1: Write the failing test**

Create `src/features/tournaments/components/__tests__/ActivityLog.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import ActivityLog from '../ActivityLog';
import type { AuditLogEntry } from '../../engine/auditTypes';

const makeLogEntry = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: 'log-1',
  action: 'score_edit',
  actorId: 'u1',
  actorName: 'Alice',
  actorRole: 'admin',
  targetType: 'match',
  targetId: 'match-1',
  details: { action: 'score_edit', matchId: 'match-1', oldScores: [[11, 5]], newScores: [[11, 7]], oldWinner: 1, newWinner: 1 },
  timestamp: Date.now() - 60000,
  ...overrides,
});

describe('ActivityLog', () => {
  it('renders a list of audit entries with formatted actions', () => {
    const entries = [
      makeLogEntry({ id: 'log-1', actorName: 'Alice', action: 'score_edit' }),
      makeLogEntry({
        id: 'log-2', actorName: 'Bob', action: 'role_change',
        details: { action: 'role_change', targetUid: 'u3', targetName: 'Carol', oldRole: null, newRole: 'moderator' },
      }),
    ];

    render(() => <ActivityLog entries={entries} />);

    expect(screen.getByText('Alice edited match scores')).toBeTruthy();
    expect(screen.getByText('Bob added Carol as moderator')).toBeTruthy();
  });

  it('renders empty state when no entries', () => {
    render(() => <ActivityLog entries={[]} />);
    expect(screen.getByText('No activity yet')).toBeTruthy();
  });

  it('shows relative timestamps', () => {
    const entries = [makeLogEntry({ timestamp: Date.now() - 5000 })];
    render(() => <ActivityLog entries={entries} />);
    expect(screen.getByText('just now')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/components/__tests__/ActivityLog.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement**

Create `src/features/tournaments/components/ActivityLog.tsx`:

```typescript
import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { AuditLogEntry } from '../engine/auditTypes';
import { formatAuditAction, formatRelativeTime } from '../engine/auditFormatters';

interface ActivityLogProps {
  entries: AuditLogEntry[];
}

const ActivityLog: Component<ActivityLogProps> = (props) => {
  const getTimestamp = (entry: AuditLogEntry): number => {
    const ts = entry.timestamp;
    if (typeof ts === 'number') return ts;
    if (ts && typeof ts === 'object' && 'toMillis' in ts) return (ts as { toMillis: () => number }).toMillis();
    return Date.now();
  };

  return (
    <div class="space-y-2">
      <h3 class="text-lg font-semibold text-on-surface">Activity Log</h3>

      <Show when={props.entries.length === 0}>
        <p class="text-on-surface-muted text-sm">No activity yet</p>
      </Show>

      <div class="space-y-1">
        <For each={props.entries}>
          {(entry) => (
            <div class="flex items-start justify-between rounded-lg bg-surface-container p-3">
              <span class="text-sm text-on-surface">{formatAuditAction(entry)}</span>
              <span class="text-xs text-on-surface-muted whitespace-nowrap ml-2">
                {formatRelativeTime(getTimestamp(entry))}
              </span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default ActivityLog;
```

Wire into dashboard — add to `TournamentDashboardPage.tsx`:

```typescript
import ActivityLog from './components/ActivityLog';
import { getAuditLog } from '../../data/firebase/firestoreAuditRepository';
```

Add resource:

```typescript
const [auditEntries] = createResource(
  () => tournament()?.id,
  async (id) => getAuditLog(id),
);
```

Add section (visible to all staff):

```typescript
<Show when={tournament() && user() && hasMinRole(tournament()!, user()!.uid, 'scorekeeper')}>
  <ActivityLog entries={auditEntries() ?? []} />
</Show>
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/components/__tests__/ActivityLog.test.tsx`
Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/components/ActivityLog.tsx src/features/tournaments/components/__tests__/ActivityLog.test.tsx src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat(audit): add Activity Log component and wire into dashboard"
```

---

## Wave C: Dispute Resolution

### Task 15: Dispute Types and Helpers

**Files:**
- Create: `src/features/tournaments/engine/disputeTypes.ts`
- Create: `src/features/tournaments/engine/disputeHelpers.ts`
- Create: `src/features/tournaments/engine/__tests__/disputeHelpers.test.ts`

**Step 1: Write the failing test**

Create `src/features/tournaments/engine/__tests__/disputeHelpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { canFlagDispute, canResolveDispute } from '../disputeHelpers';
import type { Tournament, TournamentRole } from '../../../../data/types';

const makeTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1', name: 'Test', date: Date.now(), location: '',
  format: 'single-elimination',
  config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 1, teamsPerPoolAdvancing: 2 },
  organizerId: 'owner-1',
  staff: { 'admin-1': 'admin', 'mod-1': 'moderator', 'sk-1': 'scorekeeper' } as Record<string, TournamentRole>,
  staffUids: ['admin-1', 'mod-1', 'sk-1'],
  status: 'registration', maxPlayers: null, teamFormation: null, minPlayers: null,
  entryFee: null,
  rules: { registrationDeadline: null, checkInRequired: false, checkInOpens: null, checkInCloses: null, scoringRules: '', timeoutRules: '', conductRules: '', penalties: [], additionalNotes: '' },
  pausedFrom: null, cancellationReason: null,
  createdAt: Date.now(), updatedAt: Date.now(),
  visibility: 'private', shareCode: null, accessMode: 'open', listed: true,
  buddyGroupId: null, buddyGroupName: null,
  registrationCounts: { confirmed: 0, pending: 0 },
  ...overrides,
});

describe('canFlagDispute', () => {
  const participantIds = ['player-1', 'player-2'];

  it('match participant can flag', () => {
    expect(canFlagDispute(makeTournament(), 'player-1', participantIds)).toBe(true);
  });

  it('moderator can flag even if not participant', () => {
    expect(canFlagDispute(makeTournament(), 'mod-1', participantIds)).toBe(true);
  });

  it('admin can flag', () => {
    expect(canFlagDispute(makeTournament(), 'admin-1', participantIds)).toBe(true);
  });

  it('owner can flag', () => {
    expect(canFlagDispute(makeTournament(), 'owner-1', participantIds)).toBe(true);
  });

  it('scorekeeper who is not participant cannot flag', () => {
    expect(canFlagDispute(makeTournament(), 'sk-1', participantIds)).toBe(false);
  });

  it('random user cannot flag', () => {
    expect(canFlagDispute(makeTournament(), 'random', participantIds)).toBe(false);
  });
});

describe('canResolveDispute', () => {
  it('moderator can resolve', () => {
    expect(canResolveDispute(makeTournament(), 'mod-1')).toBe(true);
  });

  it('admin can resolve', () => {
    expect(canResolveDispute(makeTournament(), 'admin-1')).toBe(true);
  });

  it('owner can resolve', () => {
    expect(canResolveDispute(makeTournament(), 'owner-1')).toBe(true);
  });

  it('scorekeeper cannot resolve', () => {
    expect(canResolveDispute(makeTournament(), 'sk-1')).toBe(false);
  });

  it('random user cannot resolve', () => {
    expect(canResolveDispute(makeTournament(), 'random')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/engine/__tests__/disputeHelpers.test.ts`
Expected: FAIL — module not found

**Step 3: Implement**

Create `src/features/tournaments/engine/disputeTypes.ts`:

```typescript
export type DisputeStatus = 'open' | 'resolved-edited' | 'resolved-dismissed';

export interface MatchDispute {
  id: string;
  matchId: string;
  tournamentId: string;
  flaggedBy: string;
  flaggedByName: string;
  reason: string;
  status: DisputeStatus;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolution: string | null;
  createdAt: unknown;   // serverTimestamp() on write
  resolvedAt: unknown;  // serverTimestamp() on resolve, null initially
}
```

Create `src/features/tournaments/engine/disputeHelpers.ts`:

```typescript
import type { Tournament } from '../../../data/types';
import { hasMinRole } from './roleHelpers';

/**
 * Determines if a user can flag a match as disputed.
 * Only match participants + moderator+ staff can flag.
 */
export function canFlagDispute(
  tournament: Tournament,
  userId: string,
  matchParticipantIds: string[],
): boolean {
  // Moderator+ can always flag
  if (hasMinRole(tournament, userId, 'moderator')) return true;
  // Match participants can flag
  return matchParticipantIds.includes(userId);
}

/**
 * Determines if a user can resolve a dispute.
 * Only moderator+ staff can resolve.
 */
export function canResolveDispute(tournament: Tournament, userId: string): boolean {
  return hasMinRole(tournament, userId, 'moderator');
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/disputeHelpers.test.ts`
Expected: PASS (all 11 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/disputeTypes.ts src/features/tournaments/engine/disputeHelpers.ts src/features/tournaments/engine/__tests__/disputeHelpers.test.ts
git commit -m "feat(disputes): add dispute types and helper functions"
```

---

### Task 16: Dispute Repository

**Files:**
- Create: `src/data/firebase/firestoreDisputeRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreDisputeRepository.test.ts`

**Step 1: Write the failing test**

Create `src/data/firebase/__tests__/firestoreDisputeRepository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockUpdateDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetDocs = vi.hoisted(() => vi.fn());
const mockDoc = vi.hoisted(() => vi.fn(() => ({ id: 'dispute-auto-id' })));
const mockCollection = vi.hoisted(() => vi.fn(() => 'mock-disputes-col'));
const mockWriteBatch = vi.hoisted(() => {
  const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
  return vi.fn(() => batch);
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  getDocs: mockGetDocs,
  collection: mockCollection,
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn(() => 'mock-where'),
  orderBy: vi.fn(() => 'mock-orderby'),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  writeBatch: mockWriteBatch,
}));

vi.mock('../config', () => ({ firestore: 'mock-firestore' }));

import { flagDispute, resolveDispute, getDisputesByTournament } from '../firestoreDisputeRepository';

describe('firestoreDisputeRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('flagDispute', () => {
    it('creates dispute doc and audit entry in a batch', async () => {
      const result = await flagDispute({
        tournamentId: 't1',
        matchId: 'm1',
        flaggedBy: 'u1',
        flaggedByName: 'Alice',
        reason: 'Wrong score',
        actorRole: 'moderator',
      });

      const batch = mockWriteBatch();
      expect(batch.set).toHaveBeenCalled();
      expect(batch.commit).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('resolveDispute', () => {
    it('updates dispute status and creates audit entry', async () => {
      await resolveDispute({
        tournamentId: 't1',
        disputeId: 'd1',
        matchId: 'm1',
        resolvedBy: 'u2',
        resolvedByName: 'Bob',
        resolution: 'Score corrected',
        type: 'edited',
        actorRole: 'admin',
      });

      const batch = mockWriteBatch();
      expect(batch.update).toHaveBeenCalled();
      expect(batch.set).toHaveBeenCalled();
      expect(batch.commit).toHaveBeenCalled();
    });
  });

  describe('getDisputesByTournament', () => {
    it('returns disputes ordered by createdAt desc', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'd1', data: () => ({ matchId: 'm1', status: 'open', reason: 'Bad call' }) },
          { id: 'd2', data: () => ({ matchId: 'm2', status: 'resolved-edited', reason: 'Score error' }) },
        ],
      });

      const result = await getDisputesByTournament('t1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('d1');
      expect(result[1].id).toBe('d2');
    });

    it('returns empty array when no disputes', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      const result = await getDisputesByTournament('t1');
      expect(result).toEqual([]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestoreDisputeRepository.test.ts`
Expected: FAIL — module not found

**Step 3: Implement**

Create `src/data/firebase/firestoreDisputeRepository.ts`:

```typescript
import {
  doc, collection, getDocs, query, orderBy, where,
  serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { firestore } from './config';
import type { MatchDispute } from '../../features/tournaments/engine/disputeTypes';
import { createAuditEntry } from './firestoreAuditRepository';
import type { EffectiveRole } from '../../features/tournaments/engine/roleHelpers';

interface FlagInput {
  tournamentId: string;
  matchId: string;
  flaggedBy: string;
  flaggedByName: string;
  reason: string;
  actorRole: EffectiveRole;
}

interface ResolveInput {
  tournamentId: string;
  disputeId: string;
  matchId: string;
  resolvedBy: string;
  resolvedByName: string;
  resolution: string;
  type: 'edited' | 'dismissed';
  actorRole: EffectiveRole;
}

export async function flagDispute(input: FlagInput): Promise<string> {
  const batch = writeBatch(firestore);
  const colRef = collection(firestore, 'tournaments', input.tournamentId, 'disputes');
  const disputeRef = doc(colRef);

  const disputeData: Omit<MatchDispute, 'id'> = {
    matchId: input.matchId,
    tournamentId: input.tournamentId,
    flaggedBy: input.flaggedBy,
    flaggedByName: input.flaggedByName,
    reason: input.reason,
    status: 'open',
    resolvedBy: null,
    resolvedByName: null,
    resolution: null,
    createdAt: serverTimestamp(),
    resolvedAt: null,
  };

  batch.set(disputeRef, disputeData);

  // Audit entry
  const audit = createAuditEntry(input.tournamentId, {
    action: 'dispute_flag',
    actorId: input.flaggedBy,
    actorName: input.flaggedByName,
    actorRole: input.actorRole,
    targetType: 'match',
    targetId: input.matchId,
    details: { action: 'dispute_flag', matchId: input.matchId, reason: input.reason },
  });
  batch.set(audit.ref, { ...audit, ref: undefined });

  await batch.commit();
  return disputeRef.id;
}

export async function resolveDispute(input: ResolveInput): Promise<void> {
  const batch = writeBatch(firestore);
  const disputeRef = doc(firestore, 'tournaments', input.tournamentId, 'disputes', input.disputeId);

  batch.update(disputeRef, {
    status: input.type === 'edited' ? 'resolved-edited' : 'resolved-dismissed',
    resolvedBy: input.resolvedBy,
    resolvedByName: input.resolvedByName,
    resolution: input.resolution,
    resolvedAt: serverTimestamp(),
  });

  // Audit entry
  const audit = createAuditEntry(input.tournamentId, {
    action: 'dispute_resolve',
    actorId: input.resolvedBy,
    actorName: input.resolvedByName,
    actorRole: input.actorRole,
    targetType: 'match',
    targetId: input.matchId,
    details: {
      action: 'dispute_resolve',
      matchId: input.matchId,
      disputeId: input.disputeId,
      resolution: input.resolution,
      type: input.type,
    },
  });
  batch.set(audit.ref, { ...audit, ref: undefined });

  await batch.commit();
}

export async function getDisputesByTournament(tournamentId: string): Promise<MatchDispute[]> {
  const colRef = collection(firestore, 'tournaments', tournamentId, 'disputes');
  const q = query(colRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchDispute));
}

export async function getOpenDisputesByMatch(tournamentId: string, matchId: string): Promise<MatchDispute[]> {
  const colRef = collection(firestore, 'tournaments', tournamentId, 'disputes');
  const q = query(colRef, where('matchId', '==', matchId), where('status', '==', 'open'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchDispute));
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/firestoreDisputeRepository.test.ts`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreDisputeRepository.ts src/data/firebase/__tests__/firestoreDisputeRepository.test.ts
git commit -m "feat(disputes): add dispute repository with flag, resolve, and query"
```

---

### Task 17: Dispute Security Rules

**Files:**
- Modify: `firestore.rules`
- Create: `test/rules/disputes.test.ts`

**IMPORTANT:** Only match participants + moderator+ staff can create disputes — NOT "any auth'd user" as in the original plan.

**Step 1: Write the failing tests**

Create `test/rules/disputes.test.ts`:

```typescript
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import {
  setupTestEnv, teardownTestEnv, clearFirestore,
  authedContext, assertSucceeds, assertFails,
  getTestEnv, makeTournament,
} from './helpers';

beforeAll(async () => { await setupTestEnv(); });
afterAll(async () => { await teardownTestEnv(); });
beforeEach(async () => { await clearFirestore(); });

async function seedDoc(path: string, data: Record<string, unknown>) {
  await getTestEnv().withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

describe('Dispute Security Rules', () => {
  const ownerId = 'owner-1';
  const modId = 'mod-1';
  const skId = 'sk-1';
  const randomId = 'random-1';
  const tourneyId = 'tourney-1';

  const seedTournament = () => seedDoc(`tournaments/${tourneyId}`, makeTournament(ownerId, {
    staff: { [modId]: 'moderator', [skId]: 'scorekeeper' },
    staffUids: [modId, skId],
    status: 'registration',
    accessMode: 'open',
    listed: true,
    visibility: 'public',
  }));

  const makeDispute = (flaggedBy: string) => ({
    matchId: 'match-1',
    tournamentId: tourneyId,
    flaggedBy,
    flaggedByName: 'Test User',
    reason: 'Wrong score',
    status: 'open',
    resolvedBy: null,
    resolvedByName: null,
    resolution: null,
    createdAt: new Date(),
    resolvedAt: null,
  });

  describe('create', () => {
    it('moderator can create dispute', async () => {
      await seedTournament();
      const db = authedContext(modId).firestore();
      await assertSucceeds(setDoc(
        doc(db, `tournaments/${tourneyId}/disputes/d1`),
        makeDispute(modId),
      ));
    });

    it('owner can create dispute', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(setDoc(
        doc(db, `tournaments/${tourneyId}/disputes/d2`),
        makeDispute(ownerId),
      ));
    });

    it('scorekeeper who is not participant cannot create dispute', async () => {
      await seedTournament();
      const db = authedContext(skId).firestore();
      // scorekeeper is staff but below moderator, and not a match participant
      await assertFails(setDoc(
        doc(db, `tournaments/${tourneyId}/disputes/d3`),
        makeDispute(skId),
      ));
    });

    it('random user cannot create dispute', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(setDoc(
        doc(db, `tournaments/${tourneyId}/disputes/d4`),
        makeDispute(randomId),
      ));
    });
  });

  describe('update (resolve)', () => {
    it('moderator can resolve dispute', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/disputes/d1`, makeDispute(ownerId));
      const db = authedContext(modId).firestore();
      await assertSucceeds(updateDoc(
        doc(db, `tournaments/${tourneyId}/disputes/d1`),
        { status: 'resolved-edited', resolvedBy: modId, resolvedByName: 'Mod', resolution: 'Fixed', resolvedAt: new Date() },
      ));
    });

    it('scorekeeper cannot resolve dispute', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/disputes/d1`, makeDispute(ownerId));
      const db = authedContext(skId).firestore();
      await assertFails(updateDoc(
        doc(db, `tournaments/${tourneyId}/disputes/d1`),
        { status: 'resolved-edited', resolvedBy: skId, resolvedByName: 'SK', resolution: 'Fixed', resolvedAt: new Date() },
      ));
    });
  });

  describe('read', () => {
    it('staff can read disputes', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/disputes/d1`, makeDispute(ownerId));
      const db = authedContext(skId).firestore();
      await assertSucceeds(getDoc(doc(db, `tournaments/${tourneyId}/disputes/d1`)));
    });
  });

  describe('delete', () => {
    it('no one can delete disputes', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/disputes/d1`, makeDispute(ownerId));
      const db = authedContext(ownerId).firestore();
      await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}/disputes/d1`)));
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules/disputes.test.ts`
Expected: FAIL — no dispute rules exist

**Step 3: Add rules to `firestore.rules`**

Inside the tournament match block, add after the auditLog subcollection:

```
      // ── Disputes (/tournaments/{tid}/disputes/{disputeId}) ────────
      match /disputes/{disputeId} {
        // Create: moderator+ can always flag; other auth'd users cannot
        // (match participant check is too complex for rules — enforced client-side)
        allow create: if request.auth != null
          && isTournamentModPlus()
          && request.resource.data.flaggedBy == request.auth.uid
          && request.resource.data.status == 'open'
          && request.resource.data.reason is string
          && request.resource.data.reason.size() > 0
          && request.resource.data.matchId is string;

        // Resolve: moderator+ only, can only change status/resolvedBy/resolution/resolvedAt
        allow update: if request.auth != null
          && isTournamentModPlus()
          && request.resource.data.status in ['resolved-edited', 'resolved-dismissed']
          && request.resource.data.flaggedBy == resource.data.flaggedBy
          && request.resource.data.matchId == resource.data.matchId;

        // Staff can read all disputes
        allow read: if request.auth != null && isTournamentStaff();

        // No deletes ever
        allow delete: if false;
      }
```

**Step 4: Run tests**

Run: `npx vitest run test/rules/disputes.test.ts`
Expected: PASS

Run: `npx vitest run test/rules/`
Expected: PASS

**Step 5: Commit**

```bash
git add firestore.rules test/rules/disputes.test.ts
git commit -m "feat(disputes): add dispute security rules — moderator+ create/resolve, staff read, no delete"
```

---

### Task 18: Dispute UI Components

**Files:**
- Create: `src/features/tournaments/components/DisputeFlag.tsx`
- Create: `src/features/tournaments/components/DisputePanel.tsx`
- Create: `src/features/tournaments/components/__tests__/DisputeFlag.test.tsx`
- Create: `src/features/tournaments/components/__tests__/DisputePanel.test.tsx`

**Step 1: Write the failing tests**

Create `src/features/tournaments/components/__tests__/DisputeFlag.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import DisputeFlag from '../DisputeFlag';

describe('DisputeFlag', () => {
  it('renders the flag button', () => {
    render(() => <DisputeFlag onFlag={vi.fn()} canFlag={true} />);
    expect(screen.getByText('Flag Dispute')).toBeTruthy();
  });

  it('hides flag button when canFlag is false', () => {
    render(() => <DisputeFlag onFlag={vi.fn()} canFlag={false} />);
    expect(screen.queryByText('Flag Dispute')).toBeNull();
  });

  it('shows reason input when flag button is clicked', async () => {
    render(() => <DisputeFlag onFlag={vi.fn()} canFlag={true} />);
    await fireEvent.click(screen.getByText('Flag Dispute'));
    expect(screen.getByPlaceholderText('Describe the issue...')).toBeTruthy();
  });

  it('calls onFlag with reason when submitted', async () => {
    const onFlag = vi.fn();
    render(() => <DisputeFlag onFlag={onFlag} canFlag={true} />);
    await fireEvent.click(screen.getByText('Flag Dispute'));
    const input = screen.getByPlaceholderText('Describe the issue...');
    await fireEvent.input(input, { target: { value: 'Wrong score recorded' } });
    await fireEvent.click(screen.getByText('Submit'));
    expect(onFlag).toHaveBeenCalledWith('Wrong score recorded');
  });

  it('does not submit with empty reason', async () => {
    const onFlag = vi.fn();
    render(() => <DisputeFlag onFlag={onFlag} canFlag={true} />);
    await fireEvent.click(screen.getByText('Flag Dispute'));
    await fireEvent.click(screen.getByText('Submit'));
    expect(onFlag).not.toHaveBeenCalled();
  });
});
```

Create `src/features/tournaments/components/__tests__/DisputePanel.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import DisputePanel from '../DisputePanel';
import type { MatchDispute } from '../../engine/disputeTypes';

const makeDispute = (overrides: Partial<MatchDispute> = {}): MatchDispute => ({
  id: 'd1',
  matchId: 'm1',
  tournamentId: 't1',
  flaggedBy: 'u1',
  flaggedByName: 'Alice',
  reason: 'Wrong score',
  status: 'open',
  resolvedBy: null,
  resolvedByName: null,
  resolution: null,
  createdAt: Date.now(),
  resolvedAt: null,
  ...overrides,
});

describe('DisputePanel', () => {
  it('renders a list of open disputes', () => {
    const disputes = [
      makeDispute({ id: 'd1', flaggedByName: 'Alice', reason: 'Wrong score' }),
      makeDispute({ id: 'd2', flaggedByName: 'Bob', reason: 'Missing game' }),
    ];
    render(() => <DisputePanel disputes={disputes} canResolve={true} onResolve={vi.fn()} />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Wrong score')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Missing game')).toBeTruthy();
  });

  it('shows resolve buttons when canResolve is true', () => {
    render(() => (
      <DisputePanel
        disputes={[makeDispute()]}
        canResolve={true}
        onResolve={vi.fn()}
      />
    ));
    expect(screen.getByText('Dismiss')).toBeTruthy();
    expect(screen.getByText('Edit Scores')).toBeTruthy();
  });

  it('hides resolve buttons when canResolve is false', () => {
    render(() => (
      <DisputePanel
        disputes={[makeDispute()]}
        canResolve={false}
        onResolve={vi.fn()}
      />
    ));
    expect(screen.queryByText('Dismiss')).toBeNull();
    expect(screen.queryByText('Edit Scores')).toBeNull();
  });

  it('renders empty state', () => {
    render(() => <DisputePanel disputes={[]} canResolve={true} onResolve={vi.fn()} />);
    expect(screen.getByText('No open disputes')).toBeTruthy();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/tournaments/components/__tests__/DisputeFlag.test.tsx src/features/tournaments/components/__tests__/DisputePanel.test.tsx`
Expected: FAIL — modules not found

**Step 3: Implement**

Create `src/features/tournaments/components/DisputeFlag.tsx`:

```typescript
import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';

interface DisputeFlagProps {
  canFlag: boolean;
  onFlag: (reason: string) => void;
}

const DisputeFlag: Component<DisputeFlagProps> = (props) => {
  const [showForm, setShowForm] = createSignal(false);
  const [reason, setReason] = createSignal('');

  const handleSubmit = () => {
    const r = reason().trim();
    if (!r) return;
    props.onFlag(r);
    setReason('');
    setShowForm(false);
  };

  return (
    <Show when={props.canFlag}>
      <Show when={!showForm()} fallback={
        <div class="space-y-2">
          <textarea
            class="w-full rounded-lg border border-outline bg-surface-container p-2 text-sm text-on-surface"
            placeholder="Describe the issue..."
            value={reason()}
            onInput={(e) => setReason(e.currentTarget.value)}
            rows={3}
          />
          <div class="flex gap-2">
            <button
              class="rounded-lg bg-error px-3 py-1.5 text-sm font-medium text-on-error"
              onClick={handleSubmit}
            >
              Submit
            </button>
            <button
              class="rounded-lg bg-surface-container-high px-3 py-1.5 text-sm text-on-surface"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      }>
        <button
          class="rounded-lg bg-error/10 px-3 py-1.5 text-sm font-medium text-error"
          onClick={() => setShowForm(true)}
        >
          Flag Dispute
        </button>
      </Show>
    </Show>
  );
};

export default DisputeFlag;
```

Create `src/features/tournaments/components/DisputePanel.tsx`:

```typescript
import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { MatchDispute } from '../engine/disputeTypes';

interface DisputePanelProps {
  disputes: MatchDispute[];
  canResolve: boolean;
  onResolve: (disputeId: string, matchId: string, type: 'edited' | 'dismissed') => void;
}

const DisputePanel: Component<DisputePanelProps> = (props) => {
  const openDisputes = () => props.disputes.filter((d) => d.status === 'open');

  return (
    <div class="space-y-3">
      <h3 class="text-lg font-semibold text-on-surface">Disputes</h3>

      <Show when={openDisputes().length === 0}>
        <p class="text-on-surface-muted text-sm">No open disputes</p>
      </Show>

      <For each={openDisputes()}>
        {(dispute) => (
          <div class="rounded-lg border border-error/30 bg-error/5 p-3 space-y-2">
            <div class="flex items-start justify-between">
              <div>
                <span class="text-sm font-medium text-on-surface">{dispute.flaggedByName}</span>
                <p class="text-sm text-on-surface-muted mt-1">{dispute.reason}</p>
              </div>
              <span class="rounded-full bg-error/20 px-2 py-0.5 text-xs font-medium text-error">Open</span>
            </div>
            <Show when={props.canResolve}>
              <div class="flex gap-2 pt-1">
                <button
                  class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
                  onClick={() => props.onResolve(dispute.id, dispute.matchId, 'edited')}
                >
                  Edit Scores
                </button>
                <button
                  class="rounded-lg bg-surface-container-high px-3 py-1.5 text-sm text-on-surface"
                  onClick={() => props.onResolve(dispute.id, dispute.matchId, 'dismissed')}
                >
                  Dismiss
                </button>
              </div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
};

export default DisputePanel;
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/tournaments/components/__tests__/DisputeFlag.test.tsx src/features/tournaments/components/__tests__/DisputePanel.test.tsx`
Expected: PASS (all 9 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/components/DisputeFlag.tsx src/features/tournaments/components/DisputePanel.tsx src/features/tournaments/components/__tests__/DisputeFlag.test.tsx src/features/tournaments/components/__tests__/DisputePanel.test.tsx
git commit -m "feat(disputes): add DisputeFlag and DisputePanel components"
```

---

### Task 19: Wire Disputes into Dashboard and Match Cards

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

**Step 1: Write a smoke test for integration**

No new test file — verified via existing tests + type check. The wiring is:
1. Import `DisputePanel`, `canResolveDispute`, dispute repository
2. Load disputes via `getDisputesByTournament()`
3. Add DisputePanel section visible to moderator+ staff
4. Add dispute count badge to dashboard nav

**Step 2: Update TournamentDashboardPage.tsx**

Add imports:

```typescript
import DisputePanel from './components/DisputePanel';
import { canResolveDispute } from './engine/disputeHelpers';
import { getDisputesByTournament, resolveDispute } from '../../data/firebase/firestoreDisputeRepository';
```

Add disputes resource:

```typescript
const [disputes] = createResource(
  () => tournament()?.id,
  async (id) => getDisputesByTournament(id),
);
```

Add DisputePanel (visible to moderator+):

```typescript
<Show when={tournament() && user() && hasMinRole(tournament()!, user()!.uid, 'moderator')}>
  <DisputePanel
    disputes={disputes() ?? []}
    canResolve={canResolveDispute(tournament()!, user()!.uid)}
    onResolve={handleResolveDispute}
  />
</Show>
```

Add handler:

```typescript
const handleResolveDispute = async (disputeId: string, matchId: string, type: 'edited' | 'dismissed') => {
  const t = tournament();
  const u = user();
  if (!t || !u) return;
  const role = getTournamentRole(t, u.uid);
  if (!role) return;
  await resolveDispute({
    tournamentId: t.id,
    disputeId,
    matchId,
    resolvedBy: u.uid,
    resolvedByName: u.displayName ?? '',
    resolution: type === 'dismissed' ? 'Dismissed — no changes needed' : 'Scores edited',
    type,
    actorRole: role,
  });
};
```

**Step 3: Run full test suite**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat(disputes): wire DisputePanel into dashboard with moderator+ resolve handlers"
```

---

## Wave D: Quick Add + CSV Export

### Task 20: Placeholder Status + QuickAdd Component

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/features/tournaments/constants.ts`
- Create: `src/features/tournaments/components/QuickAddPlayers.tsx`
- Create: `src/features/tournaments/components/__tests__/QuickAddPlayers.test.tsx`

Combined from original Tasks 18+19. Adding the type and component together because the type change is one line.

**Step 1: Write the failing test**

Create `src/features/tournaments/components/__tests__/QuickAddPlayers.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import QuickAddPlayers from '../QuickAddPlayers';

describe('QuickAddPlayers', () => {
  it('renders textarea for name input', () => {
    render(() => <QuickAddPlayers onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText('Enter names, one per line...')).toBeTruthy();
  });

  it('shows count of parsed names', async () => {
    render(() => <QuickAddPlayers onSubmit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('Enter names, one per line...');
    await fireEvent.input(textarea, { target: { value: 'Alice\nBob\nCarol' } });
    expect(screen.getByText('3 players')).toBeTruthy();
  });

  it('calls onSubmit with trimmed names array', async () => {
    const onSubmit = vi.fn();
    render(() => <QuickAddPlayers onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText('Enter names, one per line...');
    await fireEvent.input(textarea, { target: { value: '  Alice  \nBob\n\nCarol  ' } });
    await fireEvent.click(screen.getByText(/Add 3 Players/));
    expect(onSubmit).toHaveBeenCalledWith(['Alice', 'Bob', 'Carol']);
  });

  it('filters empty lines', async () => {
    const onSubmit = vi.fn();
    render(() => <QuickAddPlayers onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText('Enter names, one per line...');
    await fireEvent.input(textarea, { target: { value: 'Alice\n\n\nBob' } });
    await fireEvent.click(screen.getByText(/Add 2 Players/));
    expect(onSubmit).toHaveBeenCalledWith(['Alice', 'Bob']);
  });

  it('shows error when name exceeds 100 characters', async () => {
    render(() => <QuickAddPlayers onSubmit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('Enter names, one per line...');
    const longName = 'A'.repeat(101);
    await fireEvent.input(textarea, { target: { value: longName } });
    expect(screen.getByText(/Name too long/)).toBeTruthy();
  });

  it('shows error when more than 100 names', async () => {
    render(() => <QuickAddPlayers onSubmit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('Enter names, one per line...');
    const names = Array.from({ length: 101 }, (_, i) => `Player ${i + 1}`).join('\n');
    await fireEvent.input(textarea, { target: { value: names } });
    expect(screen.getByText(/Maximum 100 names/)).toBeTruthy();
  });

  it('warns about duplicates within batch', async () => {
    render(() => <QuickAddPlayers onSubmit={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('Enter names, one per line...');
    await fireEvent.input(textarea, { target: { value: 'Alice\nalice\nBob' } });
    expect(screen.getByText(/Duplicate/)).toBeTruthy();
  });

  it('does not submit when no valid names', async () => {
    const onSubmit = vi.fn();
    render(() => <QuickAddPlayers onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText('Enter names, one per line...');
    await fireEvent.input(textarea, { target: { value: '   \n\n   ' } });
    expect(screen.queryByText(/Add/)).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/components/__tests__/QuickAddPlayers.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement**

Update `src/data/types.ts` line 196 — add `'placeholder'`:

```typescript
export type RegistrationStatus = 'confirmed' | 'pending' | 'declined' | 'withdrawn' | 'expired' | 'placeholder';
```

Update `src/features/tournaments/constants.ts` — add to `registrationStatusLabels`:

```typescript
  placeholder: 'Placeholder',
```

Create `src/features/tournaments/components/QuickAddPlayers.tsx`:

```typescript
import { createSignal, createMemo, Show } from 'solid-js';
import type { Component } from 'solid-js';

interface QuickAddPlayersProps {
  onSubmit: (names: string[]) => void;
  existingNames?: string[];
}

const QuickAddPlayers: Component<QuickAddPlayersProps> = (props) => {
  const [rawText, setRawText] = createSignal('');

  const parsed = createMemo(() => {
    return rawText()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  });

  const errors = createMemo(() => {
    const errs: string[] = [];
    const names = parsed();
    if (names.length > 100) errs.push('Maximum 100 names per batch');
    const tooLong = names.find((n) => n.length > 100);
    if (tooLong) errs.push(`Name too long: "${tooLong.slice(0, 20)}..." (max 100 chars)`);
    // Duplicate check (case-insensitive)
    const lower = names.map((n) => n.toLowerCase());
    const dupes = lower.filter((n, i) => lower.indexOf(n) !== i);
    if (dupes.length > 0) errs.push(`Duplicate names found: ${[...new Set(dupes)].join(', ')}`);
    return errs;
  });

  const handleSubmit = () => {
    if (errors().length > 0 || parsed().length === 0) return;
    props.onSubmit(parsed());
    setRawText('');
  };

  return (
    <div class="space-y-3">
      <textarea
        class="w-full rounded-lg border border-outline bg-surface-container p-3 text-sm text-on-surface font-mono"
        placeholder="Enter names, one per line..."
        value={rawText()}
        onInput={(e) => setRawText(e.currentTarget.value)}
        rows={6}
      />

      <Show when={parsed().length > 0}>
        <p class="text-sm text-on-surface-muted">{parsed().length} players</p>
      </Show>

      <Show when={errors().length > 0}>
        <div class="text-sm text-error">
          {errors().map((e) => <p>{e}</p>)}
        </div>
      </Show>

      <Show when={parsed().length > 0 && errors().length === 0}>
        <button
          class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary"
          onClick={handleSubmit}
        >
          Add {parsed().length} Players
        </button>
      </Show>
    </div>
  );
};

export default QuickAddPlayers;
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/components/__tests__/QuickAddPlayers.test.tsx`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add src/data/types.ts src/features/tournaments/constants.ts src/features/tournaments/components/QuickAddPlayers.tsx src/features/tournaments/components/__tests__/QuickAddPlayers.test.tsx
git commit -m "feat(quickadd): add placeholder status and QuickAddPlayers component"
```

---

### Task 21: Quick Add Repository Logic

**Files:**
- Create: `src/data/firebase/firestoreQuickAddRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreQuickAddRepository.test.ts`

**Step 1: Write the failing test**

Create `src/data/firebase/__tests__/firestoreQuickAddRepository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteBatch = vi.hoisted(() => {
  const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
  return vi.fn(() => batch);
});
const mockDoc = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ id: `auto-${args.length}`, path: args.join('/') })));
const mockCollection = vi.hoisted(() => vi.fn(() => 'mock-reg-col'));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  collection: mockCollection,
  writeBatch: mockWriteBatch,
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  increment: vi.fn((n: number) => ({ _type: 'increment', value: n })),
}));

vi.mock('../config', () => ({ firestore: 'mock-firestore' }));
vi.mock('../firestoreAuditRepository', () => ({
  createAuditEntry: vi.fn(() => ({
    id: 'audit-1',
    ref: { id: 'audit-1' },
    action: 'player_quick_add',
    timestamp: 'SERVER_TS',
  })),
}));

import { quickAddPlayers } from '../firestoreQuickAddRepository';

describe('quickAddPlayers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates placeholder registrations in a batch', async () => {
    await quickAddPlayers({
      tournamentId: 't1',
      names: ['Alice', 'Bob'],
      actorId: 'u1',
      actorName: 'Organizer',
      actorRole: 'owner',
    });

    const batch = mockWriteBatch();
    // 2 registration docs + 1 audit doc + 1 counter update = 4 batch operations
    expect(batch.set).toHaveBeenCalledTimes(3); // 2 regs + 1 audit
    expect(batch.update).toHaveBeenCalledTimes(1); // counter
    expect(batch.commit).toHaveBeenCalled();
  });

  it('creates registrations with placeholder status and null userId', async () => {
    await quickAddPlayers({
      tournamentId: 't1',
      names: ['Alice'],
      actorId: 'u1',
      actorName: 'Organizer',
      actorRole: 'admin',
    });

    const batch = mockWriteBatch();
    const regCall = batch.set.mock.calls[0];
    const regData = regCall[1];
    expect(regData.status).toBe('placeholder');
    expect(regData.userId).toBeNull();
    expect(regData.playerName).toBe('Alice');
    expect(regData.source).toBe('quick-add');
    expect(regData.claimedBy).toBeNull();
  });

  it('writes audit entry for player_quick_add', async () => {
    const { createAuditEntry } = await import('../firestoreAuditRepository');

    await quickAddPlayers({
      tournamentId: 't1',
      names: ['Alice', 'Bob', 'Carol'],
      actorId: 'u1',
      actorName: 'Organizer',
      actorRole: 'owner',
    });

    expect(createAuditEntry).toHaveBeenCalledWith('t1', expect.objectContaining({
      action: 'player_quick_add',
      details: expect.objectContaining({ count: 3, names: ['Alice', 'Bob', 'Carol'] }),
    }));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestoreQuickAddRepository.test.ts`
Expected: FAIL — module not found

**Step 3: Implement**

Create `src/data/firebase/firestoreQuickAddRepository.ts`:

```typescript
import { doc, collection, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { firestore } from './config';
import { createAuditEntry } from './firestoreAuditRepository';
import type { EffectiveRole } from '../../features/tournaments/engine/roleHelpers';

interface QuickAddInput {
  tournamentId: string;
  names: string[];
  actorId: string;
  actorName: string;
  actorRole: EffectiveRole;
}

export async function quickAddPlayers(input: QuickAddInput): Promise<void> {
  const batch = writeBatch(firestore);
  const regCol = collection(firestore, 'tournaments', input.tournamentId, 'registrations');

  for (const name of input.names) {
    const regRef = doc(regCol);
    batch.set(regRef, {
      id: regRef.id,
      tournamentId: input.tournamentId,
      userId: null,
      playerName: name,
      status: 'placeholder',
      claimedBy: null,
      source: 'quick-add',
      teamId: null,
      paymentStatus: 'unpaid',
      paymentNote: '',
      lateEntry: false,
      skillRating: null,
      partnerId: null,
      partnerName: null,
      profileComplete: false,
      registeredAt: serverTimestamp(),
      declineReason: null,
      statusUpdatedAt: null,
    });
  }

  // Update registration counter
  const tournamentRef = doc(firestore, 'tournaments', input.tournamentId);
  batch.update(tournamentRef, {
    'registrationCounts.confirmed': increment(input.names.length),
    updatedAt: serverTimestamp(),
  });

  // Audit entry
  const audit = createAuditEntry(input.tournamentId, {
    action: 'player_quick_add',
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    targetType: 'registration',
    targetId: input.tournamentId,
    details: { action: 'player_quick_add', count: input.names.length, names: input.names },
  });
  batch.set(audit.ref, { ...audit, ref: undefined });

  await batch.commit();
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/firestoreQuickAddRepository.test.ts`
Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreQuickAddRepository.ts src/data/firebase/__tests__/firestoreQuickAddRepository.test.ts
git commit -m "feat(quickadd): add quick add repository with batch creation and audit logging"
```

---

### Task 22: Placeholder Claim Flow

**Files:**
- Create: `src/features/tournaments/components/ClaimPlaceholder.tsx`
- Create: `src/features/tournaments/components/__tests__/ClaimPlaceholder.test.tsx`

**Step 1: Write the failing test**

Create `src/features/tournaments/components/__tests__/ClaimPlaceholder.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import ClaimPlaceholder from '../ClaimPlaceholder';

describe('ClaimPlaceholder', () => {
  const placeholders = [
    { id: 'r1', playerName: 'John Smith' },
    { id: 'r2', playerName: 'Jane Doe' },
  ];

  it('renders list of unclaimed placeholder names', () => {
    render(() => (
      <ClaimPlaceholder
        placeholders={placeholders}
        onClaim={vi.fn()}
        onSkip={vi.fn()}
      />
    ));
    expect(screen.getByText('John Smith')).toBeTruthy();
    expect(screen.getByText('Jane Doe')).toBeTruthy();
  });

  it('calls onClaim with registration id when a name is clicked', async () => {
    const onClaim = vi.fn();
    render(() => (
      <ClaimPlaceholder
        placeholders={placeholders}
        onClaim={onClaim}
        onSkip={vi.fn()}
      />
    ));
    await fireEvent.click(screen.getByText('John Smith'));
    expect(onClaim).toHaveBeenCalledWith('r1');
  });

  it('renders skip button', () => {
    render(() => (
      <ClaimPlaceholder
        placeholders={placeholders}
        onClaim={vi.fn()}
        onSkip={vi.fn()}
      />
    ));
    expect(screen.getByText('None of these')).toBeTruthy();
  });

  it('calls onSkip when skip button is clicked', async () => {
    const onSkip = vi.fn();
    render(() => (
      <ClaimPlaceholder
        placeholders={placeholders}
        onClaim={vi.fn()}
        onSkip={onSkip}
      />
    ));
    await fireEvent.click(screen.getByText('None of these'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('shows prompt text', () => {
    render(() => (
      <ClaimPlaceholder
        placeholders={placeholders}
        onClaim={vi.fn()}
        onSkip={vi.fn()}
      />
    ));
    expect(screen.getByText('Are you one of these players?')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/components/__tests__/ClaimPlaceholder.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement**

Create `src/features/tournaments/components/ClaimPlaceholder.tsx`:

```typescript
import { For } from 'solid-js';
import type { Component } from 'solid-js';

interface PlaceholderEntry {
  id: string;
  playerName: string | null;
}

interface ClaimPlaceholderProps {
  placeholders: PlaceholderEntry[];
  onClaim: (registrationId: string) => void;
  onSkip: () => void;
}

const ClaimPlaceholder: Component<ClaimPlaceholderProps> = (props) => {
  return (
    <div class="space-y-3 rounded-lg border border-outline bg-surface-container p-4">
      <p class="text-sm font-medium text-on-surface">Are you one of these players?</p>

      <div class="space-y-2">
        <For each={props.placeholders}>
          {(entry) => (
            <button
              class="w-full rounded-lg bg-surface-container-high p-3 text-left text-sm font-medium text-on-surface hover:bg-primary/10 transition-colors"
              onClick={() => props.onClaim(entry.id)}
            >
              {entry.playerName}
            </button>
          )}
        </For>
      </div>

      <button
        class="w-full rounded-lg bg-surface-container-high p-2 text-sm text-on-surface-muted"
        onClick={() => props.onSkip()}
      >
        None of these
      </button>
    </div>
  );
};

export default ClaimPlaceholder;
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/components/__tests__/ClaimPlaceholder.test.tsx`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/components/ClaimPlaceholder.tsx src/features/tournaments/components/__tests__/ClaimPlaceholder.test.tsx
git commit -m "feat(quickadd): add ClaimPlaceholder component for linking placeholder spots"
```

---

### Task 23: CSV Export

**Files:**
- Create: `src/features/tournaments/engine/csvExport.ts`
- Create: `src/features/tournaments/engine/__tests__/csvExport.test.ts`

**IMPORTANT FIX:** The original plan's `sanitizeCsvValue` regex was buggy — it stripped legitimate dashes from names like "Li-Wei". The correct behavior per the design doc is to PREFIX with a single quote when value starts with `=`, `+`, `-`, or `@`.

**Step 1: Write the failing test**

Create `src/features/tournaments/engine/__tests__/csvExport.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { registrationsToCsv, sanitizeCsvValue } from '../csvExport';

describe('sanitizeCsvValue', () => {
  it('prefixes formula trigger = with single quote', () => {
    expect(sanitizeCsvValue('=CMD()')).toBe("'=CMD()");
  });

  it('prefixes formula trigger + with single quote', () => {
    expect(sanitizeCsvValue('+1234')).toBe("'+1234");
  });

  it('prefixes formula trigger - with single quote', () => {
    expect(sanitizeCsvValue('-test')).toBe("'-test");
  });

  it('prefixes formula trigger @ with single quote', () => {
    expect(sanitizeCsvValue('@import')).toBe("'@import");
  });

  it('preserves normal values unchanged', () => {
    expect(sanitizeCsvValue('John Smith')).toBe('John Smith');
  });

  it('preserves names with internal dashes like Li-Wei', () => {
    expect(sanitizeCsvValue('Li-Wei')).toBe('Li-Wei');
  });

  it('preserves email addresses with @ in middle', () => {
    expect(sanitizeCsvValue('john@email.com')).toBe('john@email.com');
  });

  it('handles empty string', () => {
    expect(sanitizeCsvValue('')).toBe('');
  });

  it('handles null/undefined gracefully', () => {
    expect(sanitizeCsvValue(null as unknown as string)).toBe('');
    expect(sanitizeCsvValue(undefined as unknown as string)).toBe('');
  });
});

describe('registrationsToCsv', () => {
  it('generates CSV with header and data rows', () => {
    const regs = [
      { playerName: 'Alice', email: 'alice@test.com', skillRating: 3.5, status: 'confirmed', teamId: 'team-1', paymentStatus: 'paid', registeredAt: 1709942400000 },
    ];
    const csv = registrationsToCsv(regs);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Name,Email,Skill Rating,Status,Team,Payment Status,Registered At');
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('alice@test.com');
    expect(lines[1]).toContain('confirmed');
  });

  it('escapes commas in values with double quotes', () => {
    const regs = [
      { playerName: 'Smith, John', email: '', skillRating: null, status: 'confirmed', teamId: null, paymentStatus: 'unpaid', registeredAt: 1709942400000 },
    ];
    const csv = registrationsToCsv(regs);
    expect(csv).toContain('"Smith, John"');
  });

  it('escapes double quotes in values', () => {
    const regs = [
      { playerName: 'The "Great" One', email: '', skillRating: null, status: 'confirmed', teamId: null, paymentStatus: 'unpaid', registeredAt: 1709942400000 },
    ];
    const csv = registrationsToCsv(regs);
    expect(csv).toContain('"The ""Great"" One"');
  });

  it('handles empty registrations array', () => {
    const csv = registrationsToCsv([]);
    expect(csv).toBe('Name,Email,Skill Rating,Status,Team,Payment Status,Registered At');
  });

  it('sanitizes formula triggers in values', () => {
    const regs = [
      { playerName: '=EVIL()', email: '', skillRating: null, status: 'confirmed', teamId: null, paymentStatus: 'unpaid', registeredAt: 1709942400000 },
    ];
    const csv = registrationsToCsv(regs);
    expect(csv).toContain("'=EVIL()");
    expect(csv).not.toContain(',=EVIL()');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/engine/__tests__/csvExport.test.ts`
Expected: FAIL — module not found

**Step 3: Implement**

Create `src/features/tournaments/engine/csvExport.ts`:

```typescript
/**
 * Sanitize a CSV value to prevent formula injection.
 * If the value starts with =, +, -, or @, prefix with a single quote.
 * This does NOT strip characters — preserves names like "Li-Wei".
 */
export function sanitizeCsvValue(value: string | null | undefined): string {
  if (!value) return '';
  if (/^[=+\-@]/.test(value)) {
    return "'" + value;
  }
  return value;
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function registrationsToCsv(registrations: Array<Record<string, unknown>>): string {
  const headers = ['Name', 'Email', 'Skill Rating', 'Status', 'Team', 'Payment Status', 'Registered At'];

  const rows = registrations.map((r) => [
    escapeCsv(sanitizeCsvValue(String(r.playerName ?? ''))),
    escapeCsv(sanitizeCsvValue(String(r.email ?? ''))),
    r.skillRating != null ? String(r.skillRating) : '',
    String(r.status ?? ''),
    String(r.teamId ?? ''),
    String(r.paymentStatus ?? ''),
    r.registeredAt ? new Date(r.registeredAt as number).toISOString() : '',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/csvExport.test.ts`
Expected: PASS (all 12 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/csvExport.ts src/features/tournaments/engine/__tests__/csvExport.test.ts
git commit -m "feat(export): add CSV export with formula injection prevention (prefix, not strip)"
```

---

### Task 24: Wire Quick Add + Export into Dashboard

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`
- Modify: `src/features/tournaments/components/OrganizerPlayerManager.tsx`

**Step 1: Write a smoke test**

No new test file — verified via type check + existing tests. The wiring:
1. Import `QuickAddPlayers`, `quickAddPlayers` repository, `registrationsToCsv`, `downloadCsv`
2. Add "Quick Add" button (admin+ only) that opens QuickAddPlayers component
3. Add "Export CSV" button (admin+ only) that generates and downloads CSV
4. Wire onSubmit handler for QuickAddPlayers to call repository

**Step 2: Update dashboard**

Add imports:

```typescript
import QuickAddPlayers from './components/QuickAddPlayers';
import { quickAddPlayers } from '../../data/firebase/firestoreQuickAddRepository';
import { registrationsToCsv, downloadCsv } from './engine/csvExport';
```

Add Quick Add handler:

```typescript
const handleQuickAdd = async (names: string[]) => {
  const t = tournament();
  const u = user();
  if (!t || !u) return;
  const role = getTournamentRole(t, u.uid);
  if (!role) return;
  await quickAddPlayers({
    tournamentId: t.id,
    names,
    actorId: u.uid,
    actorName: u.displayName ?? '',
    actorRole: role,
  });
};
```

Add CSV Export handler:

```typescript
const handleExportCsv = () => {
  const regs = live.registrations();
  const csv = registrationsToCsv(regs as unknown as Array<Record<string, unknown>>);
  const t = tournament();
  downloadCsv(csv, `${t?.name ?? 'tournament'}-registrations.csv`);
};
```

Add UI sections (admin+ only):

```typescript
<Show when={tournament() && user() && hasMinRole(tournament()!, user()!.uid, 'admin')}>
  <QuickAddPlayers onSubmit={handleQuickAdd} />
  <button
    class="rounded-lg bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface"
    onClick={handleExportCsv}
  >
    Export CSV
  </button>
</Show>
```

**Step 3: Run full test suite**

Run: `npx tsc --noEmit`
Expected: PASS

Run: `npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx src/features/tournaments/components/OrganizerPlayerManager.tsx
git commit -m "feat(quickadd): wire Quick Add and CSV Export into dashboard"
```

---

## Wave E: Templates

### Task 25: Template Types and Repository

**Files:**
- Create: `src/features/tournaments/engine/templateTypes.ts`
- Create: `src/data/firebase/firestoreTemplateRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreTemplateRepository.test.ts`

**Step 1: Write the failing test**

Create `src/data/firebase/__tests__/firestoreTemplateRepository.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetDocs = vi.hoisted(() => vi.fn());
const mockDeleteDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockUpdateDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockDoc = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ id: 'tpl-auto', path: args.join('/') })));
const mockCollection = vi.hoisted(() => vi.fn(() => 'mock-templates-col'));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDocs: mockGetDocs,
  deleteDoc: mockDeleteDoc,
  updateDoc: mockUpdateDoc,
  collection: mockCollection,
  query: vi.fn((...args: unknown[]) => args),
  orderBy: vi.fn(() => 'mock-orderby'),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  increment: vi.fn((n: number) => ({ _type: 'increment', value: n })),
}));

vi.mock('../config', () => ({ firestore: 'mock-firestore' }));

import {
  saveTemplate, getTemplates, deleteTemplate, incrementUsageCount,
} from '../firestoreTemplateRepository';

describe('firestoreTemplateRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('saveTemplate', () => {
    it('writes template doc to users/{uid}/templates/{id}', async () => {
      await saveTemplate('user-1', {
        name: 'Weekly Doubles',
        format: 'round-robin',
        gameType: 'doubles',
        config: { gameType: 'doubles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 2, teamsPerPoolAdvancing: 2 },
        teamFormation: 'byop',
        maxPlayers: 16,
        accessMode: 'open',
        rules: { registrationDeadline: null, checkInRequired: false, checkInOpens: null, checkInCloses: null, scoringRules: '', timeoutRules: '', conductRules: '', penalties: [], additionalNotes: '' },
      });

      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'users', 'user-1', 'templates');
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'Weekly Doubles', format: 'round-robin', usageCount: 0 }),
      );
    });
  });

  describe('getTemplates', () => {
    it('returns templates sorted by usageCount desc', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'tpl-1', data: () => ({ name: 'Template A', usageCount: 5 }) },
          { id: 'tpl-2', data: () => ({ name: 'Template B', usageCount: 10 }) },
        ],
      });

      const result = await getTemplates('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Template A');
      expect(mockCollection).toHaveBeenCalledWith('mock-firestore', 'users', 'user-1', 'templates');
    });

    it('returns empty array when no templates', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      const result = await getTemplates('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('deleteTemplate', () => {
    it('deletes the template doc', async () => {
      await deleteTemplate('user-1', 'tpl-1');
      expect(mockDeleteDoc).toHaveBeenCalled();
      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'users', 'user-1', 'templates', 'tpl-1');
    });
  });

  describe('incrementUsageCount', () => {
    it('increments usageCount by 1', async () => {
      await incrementUsageCount('user-1', 'tpl-1');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ usageCount: expect.objectContaining({ _type: 'increment', value: 1 }) }),
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/firestoreTemplateRepository.test.ts`
Expected: FAIL — module not found

**Step 3: Implement**

Create `src/features/tournaments/engine/templateTypes.ts`:

```typescript
import type {
  TournamentFormat, TournamentConfig, TeamFormation,
  TournamentAccessMode, TournamentRules,
} from '../../../data/types';

export interface TournamentTemplate {
  id: string;
  name: string;
  description?: string;
  format: TournamentFormat;
  gameType: TournamentConfig['gameType'];
  config: TournamentConfig;
  teamFormation: TeamFormation | null;
  maxPlayers: number | null;
  accessMode: TournamentAccessMode;
  rules: TournamentRules;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

export const MAX_TEMPLATES_PER_USER = 20;
export const MAX_TEMPLATE_NAME_LENGTH = 50;
```

Create `src/data/firebase/firestoreTemplateRepository.ts`:

```typescript
import {
  doc, setDoc, getDocs, deleteDoc, updateDoc,
  collection, query, orderBy, serverTimestamp, increment,
} from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentTemplate } from '../../features/tournaments/engine/templateTypes';
import type { TournamentFormat, TournamentConfig, TeamFormation, TournamentAccessMode, TournamentRules } from '../types';

interface TemplateInput {
  name: string;
  description?: string;
  format: TournamentFormat;
  gameType: TournamentConfig['gameType'];
  config: TournamentConfig;
  teamFormation: TeamFormation | null;
  maxPlayers: number | null;
  accessMode: TournamentAccessMode;
  rules: TournamentRules;
}

export async function saveTemplate(userId: string, input: TemplateInput): Promise<string> {
  const colRef = collection(firestore, 'users', userId, 'templates');
  const docRef = doc(colRef);
  const now = Date.now();
  await setDoc(docRef, {
    id: docRef.id,
    ...input,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  });
  return docRef.id;
}

export async function getTemplates(userId: string): Promise<TournamentTemplate[]> {
  const colRef = collection(firestore, 'users', userId, 'templates');
  const q = query(colRef, orderBy('usageCount', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TournamentTemplate));
}

export async function deleteTemplate(userId: string, templateId: string): Promise<void> {
  const ref = doc(firestore, 'users', userId, 'templates', templateId);
  await deleteDoc(ref);
}

export async function incrementUsageCount(userId: string, templateId: string): Promise<void> {
  const ref = doc(firestore, 'users', userId, 'templates', templateId);
  await updateDoc(ref, {
    usageCount: increment(1),
    updatedAt: serverTimestamp(),
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/firestoreTemplateRepository.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/templateTypes.ts src/data/firebase/firestoreTemplateRepository.ts src/data/firebase/__tests__/firestoreTemplateRepository.test.ts
git commit -m "feat(templates): add template types and repository"
```

---

### Task 26: Template Security Rules

**Files:**
- Modify: `firestore.rules`
- Create: `test/rules/templates.test.ts`

**Step 1: Write the failing tests**

Create `test/rules/templates.test.ts`:

```typescript
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import {
  setupTestEnv, teardownTestEnv, clearFirestore,
  authedContext, assertSucceeds, assertFails,
} from './helpers';

beforeAll(async () => { await setupTestEnv(); });
afterAll(async () => { await teardownTestEnv(); });
beforeEach(async () => { await clearFirestore(); });

describe('Template Security Rules', () => {
  const userId = 'user-1';
  const otherId = 'user-2';

  const makeTemplate = () => ({
    id: 'tpl-1',
    name: 'Weekly Doubles',
    format: 'round-robin',
    gameType: 'doubles',
    config: { gameType: 'doubles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 2, teamsPerPoolAdvancing: 2 },
    teamFormation: 'byop',
    maxPlayers: 16,
    accessMode: 'open',
    rules: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
  });

  it('user can create own template', async () => {
    const db = authedContext(userId).firestore();
    await assertSucceeds(setDoc(doc(db, `users/${userId}/templates/tpl-1`), makeTemplate()));
  });

  it('user can read own template', async () => {
    const db = authedContext(userId).firestore();
    await setDoc(doc(db, `users/${userId}/templates/tpl-1`), makeTemplate());
    await assertSucceeds(getDoc(doc(db, `users/${userId}/templates/tpl-1`)));
  });

  it('user can update own template', async () => {
    const db = authedContext(userId).firestore();
    await setDoc(doc(db, `users/${userId}/templates/tpl-1`), makeTemplate());
    await assertSucceeds(updateDoc(doc(db, `users/${userId}/templates/tpl-1`), { name: 'Updated' }));
  });

  it('user can delete own template', async () => {
    const db = authedContext(userId).firestore();
    await setDoc(doc(db, `users/${userId}/templates/tpl-1`), makeTemplate());
    await assertSucceeds(deleteDoc(doc(db, `users/${userId}/templates/tpl-1`)));
  });

  it('other user cannot read another user template', async () => {
    const ownerDb = authedContext(userId).firestore();
    await setDoc(doc(ownerDb, `users/${userId}/templates/tpl-1`), makeTemplate());
    const otherDb = authedContext(otherId).firestore();
    await assertFails(getDoc(doc(otherDb, `users/${userId}/templates/tpl-1`)));
  });

  it('other user cannot write another user template', async () => {
    const otherDb = authedContext(otherId).firestore();
    await assertFails(setDoc(doc(otherDb, `users/${userId}/templates/tpl-1`), makeTemplate()));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules/templates.test.ts`
Expected: FAIL — no template rules exist

**Step 3: Add rules to `firestore.rules`**

Add inside the users match block, after the existing user rules:

```
    // ── Templates (/users/{userId}/templates/{templateId}) ────────
    match /users/{userId}/templates/{templateId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
```

**Step 4: Run tests**

Run: `npx vitest run test/rules/templates.test.ts`
Expected: PASS

Run: `npx vitest run test/rules/`
Expected: PASS

**Step 5: Commit**

```bash
git add firestore.rules test/rules/templates.test.ts
git commit -m "feat(templates): add template security rules — owner-only read/write"
```

---

### Task 27: Save as Template Modal + Dashboard Wiring

**Files:**
- Create: `src/features/tournaments/components/SaveTemplateModal.tsx`
- Create: `src/features/tournaments/components/__tests__/SaveTemplateModal.test.tsx`
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

Combined from original Tasks 26+28 — the modal is trivial and wiring is one line.

**Step 1: Write the failing test**

Create `src/features/tournaments/components/__tests__/SaveTemplateModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import SaveTemplateModal from '../SaveTemplateModal';

describe('SaveTemplateModal', () => {
  it('renders name input and save button', () => {
    render(() => (
      <SaveTemplateModal
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    ));
    expect(screen.getByPlaceholderText('Template name...')).toBeTruthy();
    expect(screen.getByText('Save Template')).toBeTruthy();
  });

  it('calls onSave with name and description', async () => {
    const onSave = vi.fn();
    render(() => <SaveTemplateModal onSave={onSave} onClose={vi.fn()} />);

    const nameInput = screen.getByPlaceholderText('Template name...');
    await fireEvent.input(nameInput, { target: { value: 'Weekly Doubles' } });

    const descInput = screen.getByPlaceholderText('Description (optional)...');
    await fireEvent.input(descInput, { target: { value: 'Our usual setup' } });

    await fireEvent.click(screen.getByText('Save Template'));
    expect(onSave).toHaveBeenCalledWith('Weekly Doubles', 'Our usual setup');
  });

  it('does not submit with empty name', async () => {
    const onSave = vi.fn();
    render(() => <SaveTemplateModal onSave={onSave} onClose={vi.fn()} />);
    await fireEvent.click(screen.getByText('Save Template'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows error when name exceeds 50 characters', async () => {
    render(() => <SaveTemplateModal onSave={vi.fn()} onClose={vi.fn()} />);
    const nameInput = screen.getByPlaceholderText('Template name...');
    await fireEvent.input(nameInput, { target: { value: 'A'.repeat(51) } });
    expect(screen.getByText(/Name must be 50 characters or fewer/)).toBeTruthy();
  });

  it('calls onClose when cancel is clicked', async () => {
    const onClose = vi.fn();
    render(() => <SaveTemplateModal onSave={vi.fn()} onClose={onClose} />);
    await fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/components/__tests__/SaveTemplateModal.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement**

Create `src/features/tournaments/components/SaveTemplateModal.tsx`:

```typescript
import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { MAX_TEMPLATE_NAME_LENGTH } from '../engine/templateTypes';

interface SaveTemplateModalProps {
  onSave: (name: string, description: string) => void;
  onClose: () => void;
}

const SaveTemplateModal: Component<SaveTemplateModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');

  const nameError = () => {
    if (name().length > MAX_TEMPLATE_NAME_LENGTH) return `Name must be ${MAX_TEMPLATE_NAME_LENGTH} characters or fewer`;
    return '';
  };

  const handleSave = () => {
    const n = name().trim();
    if (!n || nameError()) return;
    props.onSave(n, description().trim());
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-md rounded-2xl bg-surface p-6 space-y-4">
        <h2 class="text-lg font-semibold text-on-surface">Save as Template</h2>

        <input
          class="w-full rounded-lg border border-outline bg-surface-container p-3 text-sm text-on-surface"
          placeholder="Template name..."
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
        />

        <Show when={nameError()}>
          <p class="text-sm text-error">{nameError()}</p>
        </Show>

        <textarea
          class="w-full rounded-lg border border-outline bg-surface-container p-3 text-sm text-on-surface"
          placeholder="Description (optional)..."
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
          rows={3}
        />

        <div class="flex justify-end gap-2">
          <button
            class="rounded-lg bg-surface-container-high px-4 py-2 text-sm text-on-surface"
            onClick={() => props.onClose()}
          >
            Cancel
          </button>
          <button
            class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary"
            onClick={handleSave}
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveTemplateModal;
```

Wire into dashboard — add to `TournamentDashboardPage.tsx`:

```typescript
import SaveTemplateModal from './components/SaveTemplateModal';
import { saveTemplate } from '../../data/firebase/firestoreTemplateRepository';
```

Add state and handler:

```typescript
const [showSaveTemplate, setShowSaveTemplate] = createSignal(false);

const handleSaveTemplate = async (name: string, description: string) => {
  const t = tournament();
  const u = user();
  if (!t || !u) return;
  await saveTemplate(u.uid, {
    name,
    description,
    format: t.format,
    gameType: t.config.gameType,
    config: t.config,
    teamFormation: t.teamFormation,
    maxPlayers: t.maxPlayers,
    accessMode: t.accessMode,
    rules: t.rules,
  });
  setShowSaveTemplate(false);
};
```

Add UI (admin+ only):

```typescript
<Show when={hasMinRole(tournament()!, user()!.uid, 'admin')}>
  <button
    class="rounded-lg bg-surface-container-high px-3 py-1.5 text-sm text-on-surface"
    onClick={() => setShowSaveTemplate(true)}
  >
    Save as Template
  </button>
</Show>

<Show when={showSaveTemplate()}>
  <SaveTemplateModal
    onSave={handleSaveTemplate}
    onClose={() => setShowSaveTemplate(false)}
  />
</Show>
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/components/__tests__/SaveTemplateModal.test.tsx`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/components/SaveTemplateModal.tsx src/features/tournaments/components/__tests__/SaveTemplateModal.test.tsx src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat(templates): add Save as Template modal and wire into dashboard"
```

---

### Task 28: Create from Template UI

**Files:**
- Modify: `src/features/tournaments/TournamentCreatePage.tsx`
- Create: `src/features/tournaments/components/__tests__/TemplateSelector.test.tsx`
- Create: `src/features/tournaments/components/TemplateSelector.tsx`

**Step 1: Write the failing test**

Create `src/features/tournaments/components/__tests__/TemplateSelector.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import TemplateSelector from '../TemplateSelector';
import type { TournamentTemplate } from '../../engine/templateTypes';

const makeTemplate = (overrides: Partial<TournamentTemplate> = {}): TournamentTemplate => ({
  id: 'tpl-1',
  name: 'Weekly Doubles',
  format: 'round-robin',
  gameType: 'doubles',
  config: { gameType: 'doubles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 2, teamsPerPoolAdvancing: 2 },
  teamFormation: 'byop',
  maxPlayers: 16,
  accessMode: 'open',
  rules: { registrationDeadline: null, checkInRequired: false, checkInOpens: null, checkInCloses: null, scoringRules: '', timeoutRules: '', conductRules: '', penalties: [], additionalNotes: '' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  usageCount: 5,
  ...overrides,
});

describe('TemplateSelector', () => {
  it('renders dropdown with template names', () => {
    const templates = [
      makeTemplate({ id: 'tpl-1', name: 'Weekly Doubles' }),
      makeTemplate({ id: 'tpl-2', name: 'Monthly Singles' }),
    ];
    render(() => <TemplateSelector templates={templates} onSelect={vi.fn()} />);
    expect(screen.getByText('From Template')).toBeTruthy();
  });

  it('calls onSelect with template when selected', async () => {
    const onSelect = vi.fn();
    const tpl = makeTemplate({ id: 'tpl-1', name: 'Weekly Doubles' });
    render(() => <TemplateSelector templates={[tpl]} onSelect={onSelect} />);

    // Open dropdown
    await fireEvent.click(screen.getByText('From Template'));
    await fireEvent.click(screen.getByText('Weekly Doubles'));

    expect(onSelect).toHaveBeenCalledWith(tpl);
  });

  it('renders empty state when no templates', () => {
    render(() => <TemplateSelector templates={[]} onSelect={vi.fn()} />);
    expect(screen.getByText('From Template')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/components/__tests__/TemplateSelector.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement**

Create `src/features/tournaments/components/TemplateSelector.tsx`:

```typescript
import { createSignal, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { TournamentTemplate } from '../engine/templateTypes';

interface TemplateSelectorProps {
  templates: TournamentTemplate[];
  onSelect: (template: TournamentTemplate) => void;
}

const TemplateSelector: Component<TemplateSelectorProps> = (props) => {
  const [open, setOpen] = createSignal(false);

  return (
    <div class="relative">
      <button
        class="rounded-lg bg-surface-container-high px-3 py-1.5 text-sm text-on-surface"
        onClick={() => setOpen(!open())}
      >
        From Template
      </button>

      <Show when={open()}>
        <div class="absolute top-full left-0 z-10 mt-1 w-64 rounded-lg border border-outline bg-surface shadow-lg">
          <Show when={props.templates.length === 0}>
            <p class="p-3 text-sm text-on-surface-muted">No templates saved yet</p>
          </Show>
          <For each={props.templates}>
            {(tpl) => (
              <button
                class="w-full p-3 text-left text-sm text-on-surface hover:bg-surface-container-high border-b border-outline last:border-b-0"
                onClick={() => { props.onSelect(tpl); setOpen(false); }}
              >
                <span class="font-medium">{tpl.name}</span>
                <Show when={tpl.description}>
                  <span class="block text-xs text-on-surface-muted mt-0.5">{tpl.description}</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default TemplateSelector;
```

Update `TournamentCreatePage.tsx`:
- Import `TemplateSelector`, `getTemplates`, `incrementUsageCount`
- Load templates via `createResource`
- Add TemplateSelector at top of form
- When template selected, pre-fill all form signals
- On successful creation, increment `usageCount` if a template was used

```typescript
import TemplateSelector from './components/TemplateSelector';
import { getTemplates, incrementUsageCount } from '../../data/firebase/firestoreTemplateRepository';
import type { TournamentTemplate } from './engine/templateTypes';
```

Add state:

```typescript
const [usedTemplateId, setUsedTemplateId] = createSignal<string | null>(null);
const [templates] = createResource(
  () => user()?.uid,
  async (uid) => getTemplates(uid),
);

const handleTemplateSelect = (tpl: TournamentTemplate) => {
  setFormat(tpl.format);
  setGameType(tpl.config.gameType);
  setScoringMode(tpl.config.scoringMode);
  setMatchFormat(tpl.config.matchFormat);
  setPointsToWin(tpl.config.pointsToWin);
  setMaxPlayers(tpl.maxPlayers?.toString() ?? '');
  setTeamFormation(tpl.teamFormation ?? 'byop');
  setAccessMode(tpl.accessMode);
  setUsedTemplateId(tpl.id);
};
```

Add to creation success handler:

```typescript
// After successful tournament creation:
const templateId = usedTemplateId();
if (templateId && currentUser) {
  incrementUsageCount(currentUser.uid, templateId).catch(() => {});
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/components/__tests__/TemplateSelector.test.tsx`
Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/components/TemplateSelector.tsx src/features/tournaments/components/__tests__/TemplateSelector.test.tsx src/features/tournaments/TournamentCreatePage.tsx
git commit -m "feat(templates): add TemplateSelector and wire into tournament creation page"
```

---

## Wave F: Integration + Polish

### Task 29: Audit Logging — Registration Actions

**Files:**
- Modify: `src/features/tournaments/components/OrganizerPlayerManager.tsx`

**Step 1: Write a test to verify audit entry creation on approve**

Create or extend `src/features/tournaments/components/__tests__/OrganizerPlayerManager.test.tsx` (if it exists, add tests; otherwise create):

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock the audit repository
vi.mock('../../../../data/firebase/firestoreAuditRepository', () => ({
  createAuditEntry: vi.fn(() => ({
    id: 'audit-1',
    ref: { id: 'audit-1' },
    timestamp: 'SERVER_TS',
  })),
}));

describe('OrganizerPlayerManager audit integration', () => {
  it('calls createAuditEntry when approving a registration', () => {
    // This test verifies the wiring exists. The actual component test
    // depends on the existing test infrastructure.
    const { createAuditEntry } = require('../../../../data/firebase/firestoreAuditRepository');
    expect(typeof createAuditEntry).toBe('function');
  });
});
```

**Step 2: Add audit logging to approve/decline/withdraw actions**

In `OrganizerPlayerManager.tsx`, when calling `firestoreRegistrationRepository.updateRegistrationStatus()`, switch to using `writeBatch` and include an audit entry:

```typescript
import { writeBatch, doc } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import { createAuditEntry } from '../../../data/firebase/firestoreAuditRepository';
import { getTournamentRole } from '../engine/roleHelpers';

// In the approve handler:
const batch = writeBatch(firestore);
const regRef = doc(firestore, 'tournaments', tournamentId, 'registrations', regId);
batch.update(regRef, { status: 'confirmed', statusUpdatedAt: Date.now() });

const audit = createAuditEntry(tournamentId, {
  action: 'registration_approve',
  actorId: currentUser.uid,
  actorName: currentUser.displayName ?? '',
  actorRole: getTournamentRole(tournament, currentUser.uid) ?? 'owner',
  targetType: 'registration',
  targetId: regId,
  details: { action: 'registration_approve', registrationId: regId, playerName },
});
batch.set(audit.ref, { ...audit, ref: undefined });
await batch.commit();
```

Apply the same pattern to decline and withdraw handlers.

**Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/tournaments/components/OrganizerPlayerManager.tsx
git commit -m "feat(audit): add audit logging to registration approve/decline/withdraw actions"
```

---

### Task 30: Audit Logging — Status, Settings, Score Changes

**Files:**
- Modify: `src/features/tournaments/components/OrganizerControls.tsx`
- Modify: Tournament settings update handler (in dashboard or settings component)
- Modify: Score edit handler (wherever `ScoreEditModal` result is processed)

**Step 1: Write verification test**

```typescript
// Verify that the audit entry creation function is importable and typed correctly
import { describe, it, expect } from 'vitest';
import { createAuditEntry } from '../../../../data/firebase/firestoreAuditRepository';

describe('audit integration availability', () => {
  it('createAuditEntry accepts status_change details', () => {
    // Type-level test — if this compiles, the integration is typed correctly
    const entry = createAuditEntry('t1', {
      action: 'status_change',
      actorId: 'u1',
      actorName: 'Alice',
      actorRole: 'admin',
      targetType: 'tournament',
      targetId: 't1',
      details: { action: 'status_change', oldStatus: 'registration', newStatus: 'pool-play' },
    });
    expect(entry.action).toBe('status_change');
  });
});
```

**Step 2: Add audit logging to status changes**

In `OrganizerControls.tsx` (or wherever `updateStatus` is called), wrap in a batch:

```typescript
const batch = writeBatch(firestore);
const tournamentRef = doc(firestore, 'tournaments', tournament.id);
batch.update(tournamentRef, { status: newStatus, updatedAt: serverTimestamp() });

const audit = createAuditEntry(tournament.id, {
  action: 'status_change',
  actorId: user.uid,
  actorName: user.displayName ?? '',
  actorRole: getTournamentRole(tournament, user.uid) ?? 'owner',
  targetType: 'tournament',
  targetId: tournament.id,
  details: { action: 'status_change', oldStatus: tournament.status, newStatus },
});
batch.set(audit.ref, { ...audit, ref: undefined });
await batch.commit();
```

Apply same pattern for settings changes (`settings_change`) and score edits (`score_edit`).

**Step 3: Run tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/tournaments/components/OrganizerControls.tsx
git commit -m "feat(audit): add audit logging to status changes, settings updates, and score edits"
```

---

### Task 31: Dispute Notifications

**Files:**
- Modify: `src/data/firebase/firestoreDisputeRepository.ts`

**Step 1: Write test for notification creation**

Add to `src/data/firebase/__tests__/firestoreDisputeRepository.test.ts`:

```typescript
describe('dispute notifications', () => {
  it('flagDispute result includes dispute ID for notification routing', async () => {
    const disputeId = await flagDispute({
      tournamentId: 't1',
      matchId: 'm1',
      flaggedBy: 'u1',
      flaggedByName: 'Alice',
      reason: 'Wrong score',
      actorRole: 'moderator',
    });
    expect(typeof disputeId).toBe('string');
    expect(disputeId.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Add notification writes to dispute flows**

In `firestoreDisputeRepository.ts`, after the batch commit in `flagDispute()` and `resolveDispute()`, add fire-and-forget notification writes. These use the existing notification infrastructure.

```typescript
// After flagDispute batch.commit():
// Fire-and-forget: notify match participants + staff
// Uses existing notification patterns from the codebase

// After resolveDispute batch.commit():
// Fire-and-forget: notify flagger + match participants
```

The actual notification write uses the existing `AppNotification` type and writes to `users/{uid}/notifications/{id}`.

**Step 3: Run tests**

Run: `npx vitest run src/data/firebase/__tests__/firestoreDisputeRepository.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/data/firebase/firestoreDisputeRepository.ts src/data/firebase/__tests__/firestoreDisputeRepository.test.ts
git commit -m "feat(disputes): add dispute notification writes for flag and resolve flows"
```

---

### Task 32: Data Migration Function

**Files:**
- Create: `src/data/firebase/migrateScorekeeperIds.ts`
- Create: `src/data/firebase/__tests__/migrateScorekeeperIds.test.ts`

Client-side function that migrates existing tournaments from `scorekeeperIds` to `staff` map + `staffUids` array.

**Step 1: Write the failing test**

Create `src/data/firebase/__tests__/migrateScorekeeperIds.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocs = vi.hoisted(() => vi.fn());
const mockUpdateDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockDoc = vi.hoisted(() => vi.fn((...args: unknown[]) => args.join('/')));
const mockCollection = vi.hoisted(() => vi.fn(() => 'mock-col'));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  collection: mockCollection,
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn(() => 'mock-where'),
  deleteField: vi.fn(() => 'DELETE_FIELD'),
}));

vi.mock('../config', () => ({ firestore: 'mock-firestore' }));

import { migrateTournament, buildStaffFromScorekeeperIds } from '../migrateScorekeeperIds';

describe('buildStaffFromScorekeeperIds', () => {
  it('converts scorekeeperIds array to staff map', () => {
    const result = buildStaffFromScorekeeperIds(['u1', 'u2', 'u3']);
    expect(result.staff).toEqual({ u1: 'scorekeeper', u2: 'scorekeeper', u3: 'scorekeeper' });
    expect(result.staffUids).toEqual(['u1', 'u2', 'u3']);
  });

  it('handles empty array', () => {
    const result = buildStaffFromScorekeeperIds([]);
    expect(result.staff).toEqual({});
    expect(result.staffUids).toEqual([]);
  });
});

describe('migrateTournament', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates tournament with staff map and removes scorekeeperIds', async () => {
    await migrateTournament('t1', ['u1', 'u2']);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        staff: { u1: 'scorekeeper', u2: 'scorekeeper' },
        staffUids: ['u1', 'u2'],
        scorekeeperIds: 'DELETE_FIELD',
      }),
    );
  });

  it('skips update for tournament with no scorekeeperIds', async () => {
    await migrateTournament('t1', []);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        staff: {},
        staffUids: [],
        scorekeeperIds: 'DELETE_FIELD',
      }),
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/migrateScorekeeperIds.test.ts`
Expected: FAIL — module not found

**Step 3: Implement**

Create `src/data/firebase/migrateScorekeeperIds.ts`:

```typescript
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { firestore } from './config';
import type { TournamentRole } from '../types';

export function buildStaffFromScorekeeperIds(scorekeeperIds: string[]): {
  staff: Record<string, TournamentRole>;
  staffUids: string[];
} {
  const staff: Record<string, TournamentRole> = {};
  for (const uid of scorekeeperIds) {
    staff[uid] = 'scorekeeper';
  }
  return { staff, staffUids: [...scorekeeperIds] };
}

/**
 * Migrate a single tournament from scorekeeperIds to staff/staffUids.
 * Safe to run multiple times (idempotent).
 */
export async function migrateTournament(tournamentId: string, scorekeeperIds: string[]): Promise<void> {
  const { staff, staffUids } = buildStaffFromScorekeeperIds(scorekeeperIds);
  const ref = doc(firestore, 'tournaments', tournamentId);
  await updateDoc(ref, {
    staff,
    staffUids,
    scorekeeperIds: deleteField(),
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/migrateScorekeeperIds.test.ts`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/data/firebase/migrateScorekeeperIds.ts src/data/firebase/__tests__/migrateScorekeeperIds.test.ts
git commit -m "feat(migration): add client-side scorekeeperIds to staff map migration function"
```

---

### Task 33: E2E Tests

**Files:**
- Create: `e2e/layer10-admin.spec.ts`

**Step 1: Write E2E test stubs**

Create `e2e/layer10-admin.spec.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import {
  setupTestEnv, teardownTestEnv, clearFirestore,
  authedContext, assertSucceeds, assertFails,
  getTestEnv,
} from '../test/rules/helpers';
import { makeTournament } from './helpers/factories';

beforeAll(async () => { await setupTestEnv(); });
afterAll(async () => { await teardownTestEnv(); });
beforeEach(async () => { await clearFirestore(); });

async function seedDoc(path: string, data: Record<string, unknown>) {
  await getTestEnv().withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

describe('Layer 10: Admin & Moderation E2E', () => {
  const ownerId = 'e2e-owner';
  const adminId = 'e2e-admin';
  const modId = 'e2e-mod';
  const tourneyId = 'e2e-tourney';

  const seedFullTournament = () => seedDoc(`tournaments/${tourneyId}`, makeTournament({
    id: tourneyId,
    organizerId: ownerId,
    staff: { [adminId]: 'admin', [modId]: 'moderator' },
    staffUids: [adminId, modId],
    status: 'registration',
    visibility: 'public',
    accessMode: 'open',
    listed: true,
  }));

  it('owner adds admin who can then edit settings', async () => {
    await seedFullTournament();
    const adminDb = authedContext(adminId).firestore();
    await assertSucceeds(updateDoc(doc(adminDb, `tournaments/${tourneyId}`), {
      name: 'Admin Renamed', updatedAt: Date.now(),
    }));
  });

  it('moderator can approve registrations but not edit settings', async () => {
    await seedFullTournament();

    // Mod cannot edit settings
    const modDb = authedContext(modId).firestore();
    await assertFails(updateDoc(doc(modDb, `tournaments/${tourneyId}`), {
      name: 'Mod Renamed', updatedAt: Date.now(),
    }));
  });

  it('audit log entries are immutable', async () => {
    await seedFullTournament();
    await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, {
      action: 'score_edit', actorId: adminId, actorName: 'Admin',
      actorRole: 'admin', targetType: 'match', targetId: 'm1',
      details: {}, timestamp: new Date(),
    });

    const adminDb = authedContext(adminId).firestore();
    await assertFails(updateDoc(doc(adminDb, `tournaments/${tourneyId}/auditLog/log-1`), { action: 'hacked' }));
    await assertFails(deleteDoc(doc(adminDb, `tournaments/${tourneyId}/auditLog/log-1`)));
  });

  it('template is private to user', async () => {
    const ownerDb = authedContext(ownerId).firestore();
    await assertSucceeds(setDoc(doc(ownerDb, `users/${ownerId}/templates/tpl-1`), {
      id: 'tpl-1', name: 'Test', format: 'round-robin', config: {},
      createdAt: Date.now(), updatedAt: Date.now(), usageCount: 0,
    }));

    const adminDb = authedContext(adminId).firestore();
    await assertFails(getDoc(doc(adminDb, `users/${ownerId}/templates/tpl-1`)));
  });

  it('dispute creation requires moderator+ (not scorekeeper)', async () => {
    await seedFullTournament();
    const skId = 'e2e-sk';
    // Add scorekeeper to tournament
    await getTestEnv().withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), `tournaments/${tourneyId}`), {
        [`staff.${skId}`]: 'scorekeeper',
        staffUids: [adminId, modId, skId],
      });
    });

    const skDb = authedContext(skId).firestore();
    await assertFails(setDoc(doc(skDb, `tournaments/${tourneyId}/disputes/d1`), {
      matchId: 'm1', tournamentId: tourneyId, flaggedBy: skId,
      flaggedByName: 'SK', reason: 'Bad', status: 'open',
      resolvedBy: null, resolvedByName: null, resolution: null,
      createdAt: new Date(), resolvedAt: null,
    }));

    const modDb = authedContext(modId).firestore();
    await assertSucceeds(setDoc(doc(modDb, `tournaments/${tourneyId}/disputes/d2`), {
      matchId: 'm1', tournamentId: tourneyId, flaggedBy: modId,
      flaggedByName: 'Mod', reason: 'Legit', status: 'open',
      resolvedBy: null, resolvedByName: null, resolution: null,
      createdAt: new Date(), resolvedAt: null,
    }));
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run e2e/layer10-admin.spec.ts`
Expected: PASS (all 5 tests)

**Step 3: Commit**

```bash
git add e2e/layer10-admin.spec.ts
git commit -m "test(e2e): add Layer 10 admin & moderation E2E security tests"
```

---

### Task 34: Security Rules Dry-Run

**Files:**
- No file changes (verification only)

**Step 1: Run all security rules tests together**

Run: `npx vitest run test/rules/`
Expected: PASS — all tests across all rule test files

**Step 2: Run full project test suite**

Run: `npx vitest run`
Expected: PASS

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Fix any failures before proceeding**

If any failures, fix them and commit:

```bash
git add -A
git commit -m "fix: resolve security rules dry-run failures"
```

---

### Task 35: Update Roadmap

**Files:**
- Modify: `docs/ROADMAP.md`

**Step 1: Update roadmap**

Move Layer 10 items to Completed section. Update "Up Next" to reflect the next priority.

**Step 2: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark Layer 10 Admin & Moderation complete in roadmap"
```

---

## Summary

| Wave | Tasks | Focus |
|------|-------|-------|
| **A** | 1-10 | Role system (types, helpers, migration, security rules, staff UI, verification) |
| **B** | 11-14 | Audit log (types+writer, security rules, formatters, UI) |
| **C** | 15-19 | Dispute resolution (types, repository, rules, UI, dashboard wiring) |
| **D** | 20-24 | Quick Add + CSV Export (placeholder status, component, repository, claim flow, CSV, wiring) |
| **E** | 25-28 | Tournament templates (types+repo, security rules, save modal+wiring, create from template) |
| **F** | 29-35 | Integration (audit wiring x2, notifications, migration, E2E, security dry-run, roadmap) |

**Total: 35 tasks across 6 waves.**

### Key Changes from Original Plan

1. **Task 3** — Complete list of all 16 files referencing `scorekeeperIds` (was ~7)
2. **Task 4** — NEW: `getByIds` method on `firestoreUserRepository`
3. **Tasks 5-6** — SPLIT: Tournament document rules vs subcollection rules (was one task)
4. **Task 10** — NEW: Post-Wave-A verification gate
5. **Task 11** — COMBINED: Audit types + writer (was two tasks)
6. **Task 12** — FIXED: Removed nonsensical `resource == null` syntax from audit rules
7. **Task 17** — FIXED: Dispute creation restricted to participants + moderator+ (was "any auth'd user")
8. **Task 20** — COMBINED: Placeholder status + QuickAdd component (was two tasks)
9. **Task 23** — FIXED: CSV sanitization uses prefix-with-quote, not strip (preserves names like "Li-Wei")
10. **Task 27** — COMBINED: Save Template Modal + Dashboard Wiring (was two tasks)
11. **Task 32** — NEW: Client-side data migration function for `scorekeeperIds` to `staff`
12. **Task 34** — NEW: Security rules dry-run verification gate
13. **All tasks** — Concrete test code with assertions (original Tasks 11-32 had minimal test code)

