# Tournament Access Control — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add four tournament access modes (open, approval, invite-only, group) with an independent listed toggle, approval queue, and registration status tracking.

**Architecture:** Two-dimensional access control (accessMode + listed) with denormalized visibility for backward compat. Registration and invitation docs keyed by userId (breaking change). Registration status transitions enforced in Firestore rules. Denormalized registrationCounts on tournament doc updated via writeBatch.

**Tech Stack:** SolidJS 1.9 + TypeScript + Firestore + Tailwind CSS v4 (no new dependencies)

**Design doc:** `docs/plans/2026-02-28-tournament-access-control-design.md`

---

## Context for Implementers

### SolidJS Rules (CRITICAL)
- `import type` for type-only imports (`verbatimModuleSyntax: true`)
- Use `class` NOT `className`
- NEVER destructure props — always use `props.foo`
- Signals: `createSignal`, Resources: `createResource`, Memos: `createMemo`
- Components: `Show`, `For`, `Switch/Match`

### Key Files
- **Types:** `src/data/types.ts`
- **Tournament repo:** `src/data/firebase/firestoreTournamentRepository.ts`
- **Registration repo:** `src/data/firebase/firestoreRegistrationRepository.ts`
- **Invitation repo:** `src/data/firebase/firestoreInvitationRepository.ts`
- **Buddy group repo:** `src/data/firebase/firestoreBuddyGroupRepository.ts` (writeBatch pattern)
- **Firestore rules:** `firestore.rules`
- **Indexes:** `firestore.indexes.json`
- **Constants:** `src/features/tournaments/constants.ts`
- **Discovery filters:** `src/features/tournaments/engine/discoveryFilters.ts`
- **Create page:** `src/features/tournaments/TournamentCreatePage.tsx`
- **Registration form:** `src/features/tournaments/components/RegistrationForm.tsx`
- **Browse card:** `src/features/tournaments/components/BrowseCard.tsx`
- **Share modal:** `src/features/tournaments/components/ShareTournamentModal.tsx`
- **Player manager:** `src/features/tournaments/components/OrganizerPlayerManager.tsx`
- **Invitation inbox:** `src/features/tournaments/components/InvitationInbox.tsx`
- **Dashboard:** `src/features/tournaments/TournamentDashboardPage.tsx`
- **My Tournaments tab:** `src/features/tournaments/components/MyTournamentsTab.tsx`
- **BottomNav:** `src/shared/components/BottomNav.tsx`

### Test Commands
- **Run all tests:** `npx vitest run`
- **Run specific test:** `npx vitest run src/path/to/test.test.ts`
- **Type check:** `npx tsc --noEmit`
- **Build:** `npx vite build`

### Existing Patterns
- **writeBatch:** See `firestoreBuddyGroupRepository.ts:addMember()` — batch.set + batch.update with increment()
- **Mocks:** Use `vi.hoisted()` for mock functions, `vi.mock()` for modules, import after mocks
- **Registration doc path:** `tournaments/{tournamentId}/registrations/{docId}`
- **Invitation doc path:** `tournaments/{tournamentId}/invitations/{docId}`

---

## Task 1: Create Feature Branch

**Files:** None

**Step 1:** Create and switch to feature branch

```bash
cd /c/Projects/Personal_BrainStrom_Projects/Superpowers/Projects/ScoringApp
git checkout -b feature/tournament-access-control
```

**Step 2:** Verify clean state

```bash
git status
```

Expected: `On branch feature/tournament-access-control, nothing to commit`

---

## Task 2: Update Data Types

**Files:**
- Modify: `src/data/types.ts`

**Step 1: Add new types and update interfaces**

Add below the existing `TournamentVisibility` type (line 89):

```typescript
export type TournamentAccessMode = 'open' | 'approval' | 'invite-only' | 'group';
export type RegistrationStatus = 'confirmed' | 'pending' | 'declined' | 'withdrawn' | 'expired';
```

Add new fields to the `Tournament` interface (after `shareCode: string | null;` on line 144):

```typescript
  accessMode: TournamentAccessMode;
  listed: boolean;
  buddyGroupId: string | null;
  buddyGroupName: string | null;
  registrationCounts: { confirmed: number; pending: number };
```

Add new fields to the `TournamentRegistration` interface (after `registeredAt: number;` on line 208):

```typescript
  status: RegistrationStatus;
  declineReason: string | null;
  statusUpdatedAt: number | null;
```

**Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: Type errors in files that construct Tournament/Registration objects without the new required fields. This is expected — we'll fix them in subsequent tasks.

**Step 3: Commit**

```bash
git add src/data/types.ts
git commit -m "feat: add access control types to Tournament and Registration

TournamentAccessMode, RegistrationStatus, and new fields on both
interfaces. Breaking change to types — callers updated in later tasks."
```

---

## Task 3: Add Backward-Compat Normalization Helpers

**Files:**
- Create: `src/data/firebase/tournamentNormalizer.ts`
- Create: `src/data/firebase/__tests__/tournamentNormalizer.test.ts`

**Step 1: Write the failing tests**

Create `src/data/firebase/__tests__/tournamentNormalizer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeTournament, normalizeRegistration } from '../tournamentNormalizer';

describe('normalizeTournament', () => {
  it('returns new fields as-is when present', () => {
    const raw = {
      id: 't1',
      accessMode: 'approval',
      listed: false,
      buddyGroupId: null,
      buddyGroupName: null,
      registrationCounts: { confirmed: 5, pending: 2 },
      visibility: 'private',
    };
    const result = normalizeTournament(raw as any);
    expect(result.accessMode).toBe('approval');
    expect(result.listed).toBe(false);
    expect(result.registrationCounts).toEqual({ confirmed: 5, pending: 2 });
  });

  it('defaults accessMode to open when missing', () => {
    const raw = { id: 't1', visibility: 'public' };
    const result = normalizeTournament(raw as any);
    expect(result.accessMode).toBe('open');
  });

  it('infers listed=true from visibility=public when listed missing', () => {
    const raw = { id: 't1', visibility: 'public' };
    const result = normalizeTournament(raw as any);
    expect(result.listed).toBe(true);
  });

  it('infers listed=false from visibility=private when listed missing', () => {
    const raw = { id: 't1', visibility: 'private' };
    const result = normalizeTournament(raw as any);
    expect(result.listed).toBe(false);
  });

  it('defaults registrationCounts to zeros when missing', () => {
    const raw = { id: 't1' };
    const result = normalizeTournament(raw as any);
    expect(result.registrationCounts).toEqual({ confirmed: 0, pending: 0 });
  });

  it('defaults buddyGroupId and buddyGroupName to null when missing', () => {
    const raw = { id: 't1' };
    const result = normalizeTournament(raw as any);
    expect(result.buddyGroupId).toBeNull();
    expect(result.buddyGroupName).toBeNull();
  });
});

describe('normalizeRegistration', () => {
  it('returns status as-is when present', () => {
    const raw = { id: 'r1', status: 'pending' };
    const result = normalizeRegistration(raw as any);
    expect(result.status).toBe('pending');
  });

  it('defaults status to confirmed when missing', () => {
    const raw = { id: 'r1' };
    const result = normalizeRegistration(raw as any);
    expect(result.status).toBe('confirmed');
  });

  it('defaults declineReason to null when missing', () => {
    const raw = { id: 'r1' };
    const result = normalizeRegistration(raw as any);
    expect(result.declineReason).toBeNull();
  });

  it('defaults statusUpdatedAt to null when missing', () => {
    const raw = { id: 'r1' };
    const result = normalizeRegistration(raw as any);
    expect(result.statusUpdatedAt).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/data/firebase/__tests__/tournamentNormalizer.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement the normalizer**

Create `src/data/firebase/tournamentNormalizer.ts`:

```typescript
import type { Tournament, TournamentRegistration } from '../types';

export function normalizeTournament(raw: Record<string, unknown>): Tournament {
  const t = raw as Partial<Tournament> & { id: string };
  return {
    ...t,
    accessMode: t.accessMode ?? 'open',
    listed: t.listed ?? (t.visibility === 'public'),
    buddyGroupId: t.buddyGroupId ?? null,
    buddyGroupName: t.buddyGroupName ?? null,
    registrationCounts: t.registrationCounts ?? { confirmed: 0, pending: 0 },
  } as Tournament;
}

export function normalizeRegistration(raw: Record<string, unknown>): TournamentRegistration {
  const r = raw as Partial<TournamentRegistration> & { id: string };
  return {
    ...r,
    status: r.status ?? 'confirmed',
    declineReason: r.declineReason ?? null,
    statusUpdatedAt: r.statusUpdatedAt ?? null,
  } as TournamentRegistration;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/data/firebase/__tests__/tournamentNormalizer.test.ts
```

Expected: All 10 tests PASS.

**Step 5: Commit**

```bash
git add src/data/firebase/tournamentNormalizer.ts src/data/firebase/__tests__/tournamentNormalizer.test.ts
git commit -m "feat: add backward-compat normalization for tournament and registration docs

Runtime defaults for missing accessMode, listed, registrationCounts,
status, declineReason, statusUpdatedAt fields."
```

---

## Task 4: Update Tournament Repository

**Files:**
- Modify: `src/data/firebase/firestoreTournamentRepository.ts`

**Step 1: Integrate normalizer into all read paths**

Add import at top:

```typescript
import { normalizeTournament } from './tournamentNormalizer';
```

Update every method that reads tournament docs to use the normalizer. Replace all occurrences of `{ id: d.id, ...d.data() } as Tournament` with `normalizeTournament({ id: d.id, ...d.data() })`. This affects:

- `getById` (line ~23): `return normalizeTournament({ id: snap.id, ...snap.data() });`
- `getByOrganizer` (line ~33): `snapshot.docs.map((d) => normalizeTournament({ id: d.id, ...d.data() }))`
- `getByShareCode` (line ~44): `return normalizeTournament({ id: snap.docs[0].id, ...snap.docs[0].data() });`
- `getPublicTournaments` (line ~75): `snapshot.docs.map((d) => normalizeTournament({ id: d.id, ...d.data() }))`
- `getByScorekeeper` (line ~94): `snapshot.docs.map((d) => normalizeTournament({ id: d.id, ...d.data() }))`

**Step 2: Add updateAccessMode method**

Add to the repository object:

```typescript
  async updateAccessMode(
    id: string,
    accessMode: import('../types').TournamentAccessMode,
    listed: boolean,
    buddyGroupId: string | null,
    buddyGroupName: string | null,
  ): Promise<void> {
    const ref = doc(firestore, 'tournaments', id);
    const visibility = listed ? 'public' : 'private';
    await updateDoc(ref, {
      accessMode,
      listed,
      visibility,
      buddyGroupId,
      buddyGroupName,
      updatedAt: serverTimestamp(),
    });
  },
```

**Step 3: Run full test suite + type check**

```bash
npx vitest run && npx tsc --noEmit
```

Note: Type errors may still exist in other files that construct Tournament objects. That's expected.

**Step 4: Commit**

```bash
git add src/data/firebase/firestoreTournamentRepository.ts
git commit -m "feat: integrate normalizer into tournament repository reads

All read paths now normalize legacy docs. Added updateAccessMode method."
```

---

## Task 5: Update Registration Repository (userId-keyed docs + status)

**Files:**
- Modify: `src/data/firebase/firestoreRegistrationRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreRegistrationRepository.access.test.ts`

**Step 1: Write failing tests for new methods**

Create `src/data/firebase/__tests__/firestoreRegistrationRepository.access.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDoc, mockSetDoc, mockGetDoc, mockGetDocs, mockUpdateDoc, mockCollection, mockQuery, mockWhere, mockWriteBatch } = vi.hoisted(() => {
  const batchInstance = {
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockDoc: vi.fn((...args: unknown[]) => ({ _doc: args })),
    mockSetDoc: vi.fn().mockResolvedValue(undefined),
    mockGetDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
    mockCollection: vi.fn((...args: unknown[]) => ({ _collection: args })),
    mockQuery: vi.fn((...args: unknown[]) => ({ _query: args })),
    mockWhere: vi.fn((...args: unknown[]) => ({ _where: args })),
    mockWriteBatch: vi.fn(() => batchInstance),
  };
});

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  writeBatch: mockWriteBatch,
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  increment: vi.fn((n: number) => ({ _increment: n })),
}));

vi.mock('../config', () => ({ firestore: 'mock-firestore' }));

import { firestoreRegistrationRepository } from '../firestoreRegistrationRepository';

describe('firestoreRegistrationRepository - access control', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('saveWithStatus', () => {
    it('uses userId as doc ID and includes status field', async () => {
      const reg = {
        id: 'old-uuid',
        tournamentId: 't1',
        userId: 'user-1',
        status: 'pending' as const,
        playerName: 'Alice',
        registeredAt: 1000,
        declineReason: null,
        statusUpdatedAt: null,
      };

      await firestoreRegistrationRepository.saveWithStatus(reg as any, 't1');

      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'registrations', 'user-1');
    });

    it('increments confirmed count for confirmed status', async () => {
      const reg = {
        tournamentId: 't1',
        userId: 'user-1',
        status: 'confirmed' as const,
      };
      const batchInstance = mockWriteBatch();

      await firestoreRegistrationRepository.saveWithStatus(reg as any, 't1');

      expect(batchInstance.update).toHaveBeenCalled();
    });

    it('increments pending count for pending status', async () => {
      const reg = {
        tournamentId: 't1',
        userId: 'user-1',
        status: 'pending' as const,
      };
      const batchInstance = mockWriteBatch();

      await firestoreRegistrationRepository.saveWithStatus(reg as any, 't1');

      expect(batchInstance.update).toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('updates status and adjusts counts in a batch', async () => {
      const batchInstance = mockWriteBatch();

      await firestoreRegistrationRepository.updateRegistrationStatus(
        't1', 'user-1', 'pending', 'confirmed',
      );

      expect(batchInstance.update).toHaveBeenCalledTimes(2); // reg doc + tournament doc
      expect(batchInstance.commit).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/data/firebase/__tests__/firestoreRegistrationRepository.access.test.ts
```

Expected: FAIL — `saveWithStatus` and `updateRegistrationStatus` don't exist.

**Step 3: Add new methods to registration repository**

Add imports to `src/data/firebase/firestoreRegistrationRepository.ts`:

```typescript
import { doc, setDoc, getDocs, updateDoc, collection, query, where, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { normalizeRegistration } from './tournamentNormalizer';
```

Add these methods to the repository object:

```typescript
  async saveWithStatus(reg: TournamentRegistration, tournamentId: string): Promise<void> {
    const batch = writeBatch(firestore);
    const regRef = doc(firestore, 'tournaments', tournamentId, 'registrations', reg.userId);
    const tournamentRef = doc(firestore, 'tournaments', tournamentId);

    batch.set(regRef, { ...reg, updatedAt: serverTimestamp() });

    if (reg.status === 'confirmed') {
      batch.update(tournamentRef, {
        'registrationCounts.confirmed': increment(1),
        updatedAt: serverTimestamp(),
      });
    } else if (reg.status === 'pending') {
      batch.update(tournamentRef, {
        'registrationCounts.pending': increment(1),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  },

  async updateRegistrationStatus(
    tournamentId: string,
    userId: string,
    fromStatus: RegistrationStatus,
    toStatus: RegistrationStatus,
    declineReason?: string,
  ): Promise<void> {
    const batch = writeBatch(firestore);
    const regRef = doc(firestore, 'tournaments', tournamentId, 'registrations', userId);
    const tournamentRef = doc(firestore, 'tournaments', tournamentId);

    const regUpdate: Record<string, unknown> = {
      status: toStatus,
      statusUpdatedAt: Date.now(),
      updatedAt: serverTimestamp(),
    };
    if (declineReason !== undefined) {
      regUpdate.declineReason = declineReason;
    }
    batch.update(regRef, regUpdate);

    // Adjust counters
    const decrements: Record<string, unknown> = {};
    const increments: Record<string, unknown> = {};

    if (fromStatus === 'confirmed') decrements['registrationCounts.confirmed'] = increment(-1);
    if (fromStatus === 'pending') decrements['registrationCounts.pending'] = increment(-1);
    if (toStatus === 'confirmed') increments['registrationCounts.confirmed'] = increment(1);
    if (toStatus === 'pending') increments['registrationCounts.pending'] = increment(1);

    batch.update(tournamentRef, {
      ...decrements,
      ...increments,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  },

  async batchUpdateStatus(
    tournamentId: string,
    userIds: string[],
    fromStatus: RegistrationStatus,
    toStatus: RegistrationStatus,
  ): Promise<void> {
    const batch = writeBatch(firestore);
    const tournamentRef = doc(firestore, 'tournaments', tournamentId);

    for (const userId of userIds) {
      const regRef = doc(firestore, 'tournaments', tournamentId, 'registrations', userId);
      batch.update(regRef, {
        status: toStatus,
        statusUpdatedAt: Date.now(),
        updatedAt: serverTimestamp(),
      });
    }

    const countAdjustments: Record<string, unknown> = {};
    if (fromStatus === 'pending') countAdjustments['registrationCounts.pending'] = increment(-userIds.length);
    if (fromStatus === 'confirmed') countAdjustments['registrationCounts.confirmed'] = increment(-userIds.length);
    if (toStatus === 'confirmed') countAdjustments['registrationCounts.confirmed'] = increment(userIds.length);
    if (toStatus === 'pending') countAdjustments['registrationCounts.pending'] = increment(userIds.length);

    batch.update(tournamentRef, { ...countAdjustments, updatedAt: serverTimestamp() });
    await batch.commit();
  },
```

Also update existing `getByTournament` and `getByUser` to use the normalizer:

```typescript
  async getByTournament(tournamentId: string): Promise<TournamentRegistration[]> {
    const snapshot = await getDocs(collection(firestore, 'tournaments', tournamentId, 'registrations'));
    return snapshot.docs.map((d) => normalizeRegistration({ id: d.id, ...d.data() }));
  },

  async getByUser(tournamentId: string, userId: string): Promise<TournamentRegistration | undefined> {
    const q = query(
      collection(firestore, 'tournaments', tournamentId, 'registrations'),
      where('userId', '==', userId),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return undefined;
    return normalizeRegistration({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
  },
```

Add import for `RegistrationStatus`:

```typescript
import type { TournamentRegistration, RegistrationStatus } from '../types';
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/data/firebase/__tests__/firestoreRegistrationRepository.access.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreRegistrationRepository.ts src/data/firebase/__tests__/firestoreRegistrationRepository.access.test.ts
git commit -m "feat: add status-aware registration methods with writeBatch

saveWithStatus uses userId as doc ID, increments counters atomically.
updateRegistrationStatus and batchUpdateStatus for status transitions."
```

---

## Task 6: Update Invitation Repository (userId-keyed docs)

**Files:**
- Modify: `src/data/firebase/firestoreInvitationRepository.ts`

**Step 1: Update create method to use userId as doc ID**

Change the `create` method to use `invitation.invitedUserId` as the doc ID:

```typescript
  async create(invitation: TournamentInvitation): Promise<void> {
    const ref = doc(firestore, 'tournaments', invitation.tournamentId, 'invitations', invitation.invitedUserId);
    await setDoc(ref, { ...invitation, updatedAt: serverTimestamp() });
  },
```

**Step 2: Update updateStatus to use userId path**

```typescript
  async updateStatus(tournamentId: string, userId: string, status: 'accepted' | 'declined'): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'invitations', userId);
    await updateDoc(ref, { status, respondedAt: Date.now(), updatedAt: serverTimestamp() });
  },
```

**Step 3: Run tests**

```bash
npx vitest run && npx tsc --noEmit
```

Note: Existing callers of `updateStatus` that pass `invitationId` need to be updated to pass `userId`. Check `InvitationInbox.tsx` and fix the call site.

**Step 4: Commit**

```bash
git add src/data/firebase/firestoreInvitationRepository.ts
git commit -m "feat: key invitation docs by userId instead of UUID

Breaking change: invitation doc ID is now invitedUserId. Enables
exists() checks in Firestore security rules."
```

---

## Task 7: Update Constants

**Files:**
- Modify: `src/features/tournaments/constants.ts`

**Step 1: Add access mode labels and colors**

```typescript
export const accessModeLabels: Record<string, string> = {
  open: 'Open',
  approval: 'Approval Required',
  'invite-only': 'Invite Only',
  group: 'Buddy Group',
};

export const accessModeBadgeColors: Record<string, string> = {
  approval: 'bg-amber-500/20 text-amber-400',
  'invite-only': 'bg-purple-500/20 text-purple-400',
  group: 'bg-blue-500/20 text-blue-400',
};

export const registrationStatusLabels: Record<string, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
};
```

**Step 2: Commit**

```bash
git add src/features/tournaments/constants.ts
git commit -m "feat: add access mode and registration status constants"
```

---

## Task 8: Update Discovery Filter Engine

**Files:**
- Modify: `src/features/tournaments/engine/discoveryFilters.ts`
- Modify: `src/features/tournaments/engine/__tests__/discoveryFilters.test.ts`

**Step 1: Write failing tests for access mode awareness**

Add to the existing test file:

```typescript
describe('filterPublicTournaments - access mode', () => {
  it('includes all access modes when no accessMode filter', () => {
    const tournaments = [
      makeTournament({ id: 't1', accessMode: 'open', listed: true }),
      makeTournament({ id: 't2', accessMode: 'approval', listed: true }),
      makeTournament({ id: 't3', accessMode: 'invite-only', listed: true }),
    ];
    const result = filterPublicTournaments(tournaments, {});
    expect(result).toHaveLength(3);
  });
});
```

Note: Since `filterPublicTournaments` doesn't filter by accessMode (it filters the already-fetched public tournaments), this test should already pass once the Tournament type has `accessMode`. The main change is to `BrowseFilters` and `MyTournamentEntry` types.

**Step 2: Update the types to include accessMode awareness**

In `discoveryFilters.ts`, add `accessMode` to `BrowseFilters` (optional, for future use):

```typescript
export interface BrowseFilters {
  status?: BrowseStatusFilter;
  format?: TournamentFormat;
  search?: string;
  accessMode?: TournamentAccessMode;
}
```

Add the `accessMode` filter branch in `filterPublicTournaments`:

```typescript
    // Access mode filter
    if (filters.accessMode && t.accessMode !== filters.accessMode) return false;
```

**Step 3: Run tests**

```bash
npx vitest run src/features/tournaments/engine/__tests__/discoveryFilters.test.ts
```

Expected: All tests PASS.

**Step 4: Commit**

```bash
git add src/features/tournaments/engine/discoveryFilters.ts src/features/tournaments/engine/__tests__/discoveryFilters.test.ts
git commit -m "feat: add accessMode filter support to discovery engine"
```

---

## Task 9: Update Firestore Indexes

**Files:**
- Modify: `firestore.indexes.json`

**Step 1: Add new indexes**

Add to the `indexes` array:

```json
{
  "collectionGroup": "registrations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "registeredAt", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "registrations",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "tournaments",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "listed", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "invitations",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "invitedUserId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

**Step 2: Commit**

```bash
git add firestore.indexes.json
git commit -m "chore: add Firestore indexes for access control queries

Approval queue (registrations status+registeredAt), player pending
registrations (collection group userId+status), listed tournaments,
invitation inbox (collection group invitedUserId+status)."
```

---

## Task 10: Update Firestore Security Rules

**Files:**
- Modify: `firestore.rules`

**Step 1: Add tournament data helper function**

Add at the top of the rules file (after the `match /databases/{database}/documents` block opens):

```
    // Helper: read tournament data (cached per rule evaluation)
    function tournamentData(tournamentId) {
      return get(/databases/$(database)/documents/tournaments/$(tournamentId)).data;
    }
```

**Step 2: Update tournament create rules**

Add the new fields to the tournament create validation (after existing field checks):

```
        && request.resource.data.accessMode in ['open', 'approval', 'invite-only', 'group']
        && request.resource.data.listed is bool
        && (request.resource.data.accessMode in ['open', 'approval'] ? request.resource.data.listed == true : true)
        && (request.resource.data.listed == true ? request.resource.data.visibility == 'public' : request.resource.data.visibility == 'private')
        && (request.resource.data.accessMode != 'group'
            || (request.resource.data.buddyGroupId is string
                && exists(/databases/$(database)/documents/buddyGroups/$(request.resource.data.buddyGroupId))
                && exists(/databases/$(database)/documents/buddyGroups/$(request.resource.data.buddyGroupId)/members/$(request.auth.uid))))
```

**Step 3: Update registration create rules**

Replace the existing registration create rule with mode-aware logic:

```
      // Registration create: mode-aware
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid
        && (
          // OPEN mode: anyone, status must be confirmed
          (tournamentData(tournamentId).accessMode == 'open'
            && request.resource.data.status == 'confirmed')
          // APPROVAL mode: anyone, status must be pending
          || (tournamentData(tournamentId).accessMode == 'approval'
            && request.resource.data.status == 'pending')
          // INVITE-ONLY: only invited users, confirmed
          || (tournamentData(tournamentId).accessMode == 'invite-only'
            && exists(/databases/$(database)/documents/tournaments/$(tournamentId)/invitations/$(request.auth.uid))
            && request.resource.data.status == 'confirmed')
          // GROUP: only group members, confirmed
          || (tournamentData(tournamentId).accessMode == 'group'
            && exists(/databases/$(database)/documents/buddyGroups/$(tournamentData(tournamentId).buddyGroupId)/members/$(request.auth.uid))
            && request.resource.data.status == 'confirmed')
          // LEGACY: no accessMode field, fallback to visibility
          || (!('accessMode' in tournamentData(tournamentId))
            && tournamentData(tournamentId).visibility == 'public'
            && request.resource.data.status == 'confirmed')
        );
```

**Step 4: Update registration update rules**

```
      // Registration update: status transitions
      allow update: if request.auth != null
        && (
          // Organizer can approve/decline/withdraw
          (request.auth.uid == tournamentData(tournamentId).organizerId
            && request.resource.data.status in ['confirmed', 'declined', 'withdrawn'])
          // Player can withdraw own registration
          || (request.auth.uid == resource.data.userId
            && request.resource.data.status == 'withdrawn'
            && resource.data.status in ['confirmed', 'pending'])
          // Player can re-confirm declined registration IF invited
          || (request.auth.uid == resource.data.userId
            && resource.data.status == 'declined'
            && request.resource.data.status == 'confirmed'
            && exists(/databases/$(database)/documents/tournaments/$(tournamentId)/invitations/$(request.auth.uid)))
        );

      // Registration delete: never (use withdrawn status)
      allow delete: if false;
```

**Step 5: Commit**

```bash
git add firestore.rules
git commit -m "feat: add mode-aware Firestore security rules for registrations

Registration creates validated per access mode. Status transitions
restricted to organizer (approve/decline) and player (withdraw).
Re-invitation flow: declined->confirmed with invitation exists check."
```

---

## Task 11: AccessModeBadge Component

**Files:**
- Create: `src/features/tournaments/components/AccessModeBadge.tsx`
- Create: `src/features/tournaments/components/__tests__/AccessModeBadge.test.tsx`

**Step 1: Write failing tests**

Create `src/features/tournaments/components/__tests__/AccessModeBadge.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import AccessModeBadge from '../AccessModeBadge';

describe('AccessModeBadge', () => {
  it('renders nothing for open mode', () => {
    const { container } = render(() => <AccessModeBadge accessMode="open" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders "Approval Required" for approval mode', () => {
    render(() => <AccessModeBadge accessMode="approval" />);
    expect(screen.getByText('Approval Required')).toBeTruthy();
  });

  it('renders "Invite Only" for invite-only mode', () => {
    render(() => <AccessModeBadge accessMode="invite-only" />);
    expect(screen.getByText('Invite Only')).toBeTruthy();
  });

  it('renders group name for group mode', () => {
    render(() => <AccessModeBadge accessMode="group" groupName="Tuesday Crew" />);
    expect(screen.getByText('Tuesday Crew')).toBeTruthy();
  });

  it('truncates long group names', () => {
    render(() => <AccessModeBadge accessMode="group" groupName="Wednesday Night Warriors League" />);
    expect(screen.getByText('Wednesday Night W...')).toBeTruthy();
  });

  it('falls back to "Group" when no group name', () => {
    render(() => <AccessModeBadge accessMode="group" />);
    expect(screen.getByText('Group')).toBeTruthy();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/tournaments/components/__tests__/AccessModeBadge.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement**

Create `src/features/tournaments/components/AccessModeBadge.tsx`:

```typescript
import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import type { TournamentAccessMode } from '../../../data/types';
import { accessModeBadgeColors } from '../constants';

interface Props {
  accessMode: TournamentAccessMode;
  groupName?: string;
}

const MAX_GROUP_NAME_LENGTH = 18;

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

const AccessModeBadge: Component<Props> = (props) => {
  const label = () => {
    if (props.accessMode === 'open') return null;
    if (props.accessMode === 'approval') return 'Approval Required';
    if (props.accessMode === 'invite-only') return 'Invite Only';
    if (props.accessMode === 'group') {
      return props.groupName ? truncate(props.groupName, MAX_GROUP_NAME_LENGTH) : 'Group';
    }
    return null;
  };

  const colorClass = () => accessModeBadgeColors[props.accessMode] ?? '';

  return (
    <Show when={label()}>
      {(text) => (
        <span class={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${colorClass()}`}>
          {text()}
        </span>
      )}
    </Show>
  );
};

export default AccessModeBadge;
```

**Step 4: Run tests**

```bash
npx vitest run src/features/tournaments/components/__tests__/AccessModeBadge.test.tsx
```

Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/components/AccessModeBadge.tsx src/features/tournaments/components/__tests__/AccessModeBadge.test.tsx
git commit -m "feat: add AccessModeBadge component for BrowseCard"
```

---

## Task 12: Update BrowseCard with Access Mode Badge

**Files:**
- Modify: `src/features/tournaments/components/BrowseCard.tsx`
- Modify: `src/features/tournaments/components/__tests__/BrowseCard.test.tsx`

**Step 1: Add failing test**

Add to existing BrowseCard tests:

```typescript
  it('shows access mode badge for approval tournaments', () => {
    renderCard(makeTournament({ accessMode: 'approval', listed: true }));
    expect(screen.getByText('Approval Required')).toBeTruthy();
  });

  it('shows no access mode badge for open tournaments', () => {
    renderCard(makeTournament({ accessMode: 'open', listed: true }));
    expect(screen.queryByText('Approval Required')).toBeNull();
    expect(screen.queryByText('Invite Only')).toBeNull();
  });

  it('shows pending count for approval mode', () => {
    renderCard(makeTournament({
      accessMode: 'approval',
      listed: true,
      registrationCounts: { confirmed: 12, pending: 3 },
    }));
    expect(screen.getByText('12 registered, 3 pending')).toBeTruthy();
  });
```

Update `makeTournament` helper in the test to include the new required fields:

```typescript
    accessMode: 'open' as const,
    listed: true,
    buddyGroupId: null,
    buddyGroupName: null,
    registrationCounts: { confirmed: 0, pending: 0 },
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/tournaments/components/__tests__/BrowseCard.test.tsx
```

**Step 3: Update BrowseCard**

Add import:

```typescript
import AccessModeBadge from './AccessModeBadge';
```

Update the registration label logic:

```typescript
  const registrationLabel = () => {
    const counts = props.tournament.registrationCounts ?? { confirmed: 0, pending: 0 };
    const confirmed = counts.confirmed;
    const pending = counts.pending;

    if (props.tournament.accessMode === 'approval' && pending > 0) {
      return `${confirmed} registered, ${pending} pending`;
    }
    if (props.tournament.accessMode === 'invite-only') {
      return `${confirmed} invited`;
    }
    if (props.tournament.maxPlayers) {
      return `${confirmed}/${props.tournament.maxPlayers} registered`;
    }
    return `${confirmed} registered`;
  };
```

Add the AccessModeBadge in the badges row (after the format badge):

```typescript
<AccessModeBadge
  accessMode={props.tournament.accessMode ?? 'open'}
  groupName={props.tournament.buddyGroupName ?? undefined}
/>
```

**Step 4: Run tests**

```bash
npx vitest run src/features/tournaments/components/__tests__/BrowseCard.test.tsx
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/components/BrowseCard.tsx src/features/tournaments/components/__tests__/BrowseCard.test.tsx
git commit -m "feat: add access mode badge and adapted count copy to BrowseCard"
```

---

## Task 13: AccessModeSelector Component

**Files:**
- Create: `src/features/tournaments/components/AccessModeSelector.tsx`
- Create: `src/features/tournaments/components/__tests__/AccessModeSelector.test.tsx`

**Step 1: Write failing tests**

Create `src/features/tournaments/components/__tests__/AccessModeSelector.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import AccessModeSelector from '../AccessModeSelector';

describe('AccessModeSelector', () => {
  const defaultProps = {
    accessMode: 'open' as const,
    listed: true,
    buddyGroupId: null as string | null,
    buddyGroupName: null as string | null,
    buddyGroups: [] as Array<{ id: string; name: string }>,
    onAccessModeChange: vi.fn(),
    onListedChange: vi.fn(),
    onGroupChange: vi.fn(),
  };

  it('renders four option cards', () => {
    render(() => <AccessModeSelector {...defaultProps} />);
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByText('Approval Required')).toBeTruthy();
    expect(screen.getByText('Invite Only')).toBeTruthy();
    expect(screen.getByText('Buddy Group')).toBeTruthy();
  });

  it('does not show listed toggle for open mode', () => {
    render(() => <AccessModeSelector {...defaultProps} accessMode="open" />);
    expect(screen.queryByText('Let players find this')).toBeNull();
  });

  it('shows listed toggle for invite-only mode', () => {
    render(() => <AccessModeSelector {...defaultProps} accessMode="invite-only" />);
    expect(screen.getByText('Let players find this')).toBeTruthy();
  });

  it('shows group dropdown for group mode', () => {
    render(() => (
      <AccessModeSelector
        {...defaultProps}
        accessMode="group"
        buddyGroups={[{ id: 'g1', name: 'Tuesday Crew' }]}
      />
    ));
    expect(screen.getByLabelText('Select Group')).toBeTruthy();
  });

  it('shows inline group creation when no groups exist', () => {
    render(() => <AccessModeSelector {...defaultProps} accessMode="group" buddyGroups={[]} />);
    expect(screen.getByPlaceholderText('Name your group')).toBeTruthy();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/tournaments/components/__tests__/AccessModeSelector.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement AccessModeSelector**

Create `src/features/tournaments/components/AccessModeSelector.tsx`:

```typescript
import { createSignal, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { Unlock, ShieldCheck, Ticket, Users } from 'lucide-solid';
import type { TournamentAccessMode } from '../../../data/types';

interface Props {
  accessMode: TournamentAccessMode;
  listed: boolean;
  buddyGroupId: string | null;
  buddyGroupName: string | null;
  buddyGroups: Array<{ id: string; name: string }>;
  onAccessModeChange: (mode: TournamentAccessMode) => void;
  onListedChange: (listed: boolean) => void;
  onGroupChange: (groupId: string, groupName: string) => void;
  onInlineGroupCreate?: (name: string) => Promise<{ id: string; name: string }>;
  disabled?: boolean;
}

const modes: Array<{
  value: TournamentAccessMode;
  label: string;
  subtitle: string;
  icon: typeof Unlock;
}> = [
  { value: 'open', label: 'Open', subtitle: 'Anyone can join', icon: Unlock },
  { value: 'approval', label: 'Approval Required', subtitle: 'You approve each player', icon: ShieldCheck },
  { value: 'invite-only', label: 'Invite Only', subtitle: 'Only players you invite', icon: Ticket },
  { value: 'group', label: 'Buddy Group', subtitle: 'Open to a specific group', icon: Users },
];

const AccessModeSelector: Component<Props> = (props) => {
  const [newGroupName, setNewGroupName] = createSignal('');
  const [creatingGroup, setCreatingGroup] = createSignal(false);

  const showListedToggle = () =>
    props.accessMode === 'invite-only' || props.accessMode === 'group';

  const showGroupSelector = () => props.accessMode === 'group';

  const handleCreateGroup = async () => {
    const name = newGroupName().trim();
    if (!name || !props.onInlineGroupCreate) return;
    setCreatingGroup(true);
    try {
      const group = await props.onInlineGroupCreate(name);
      props.onGroupChange(group.id, group.name);
      setNewGroupName('');
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <fieldset class="space-y-3" disabled={props.disabled}>
      <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
        Who Can Join?
      </legend>

      {/* 2x2 OptionCard grid */}
      <div class="grid grid-cols-2 gap-3">
        <For each={modes}>
          {(mode) => {
            const Icon = mode.icon;
            const isSelected = () => props.accessMode === mode.value;
            return (
              <button
                type="button"
                onClick={() => props.onAccessModeChange(mode.value)}
                class={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                  isSelected()
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface-light text-on-surface-muted hover:border-on-surface-muted/50'
                }`}
              >
                <Icon size={20} />
                <span class="text-sm font-bold">{mode.label}</span>
                <span class="text-[11px] leading-tight opacity-80">{mode.subtitle}</span>
              </button>
            );
          }}
        </For>
      </div>

      {/* Conditional: Group selector (appears first for group mode) */}
      <Show when={showGroupSelector()}>
        <div class="bg-surface-lighter rounded-lg p-3 border-l-4 border-blue-400 space-y-2">
          <Show
            when={props.buddyGroups.length > 0}
            fallback={
              <div class="space-y-2">
                <p class="text-xs text-on-surface-muted">You don't have any groups yet. Create one to get started.</p>
                <div class="flex gap-2">
                  <input
                    type="text"
                    placeholder="Name your group"
                    value={newGroupName()}
                    onInput={(e) => setNewGroupName(e.currentTarget.value)}
                    class="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-muted"
                  />
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={!newGroupName().trim() || creatingGroup()}
                    class="px-3 py-2 bg-surface-light border border-border text-on-surface text-sm font-semibold rounded-lg disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            }
          >
            <label class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider">
              Select Group
              <select
                aria-label="Select Group"
                value={props.buddyGroupId ?? ''}
                onChange={(e) => {
                  const g = props.buddyGroups.find((g) => g.id === e.currentTarget.value);
                  if (g) props.onGroupChange(g.id, g.name);
                }}
                class="mt-1 w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-on-surface appearance-none cursor-pointer"
              >
                <option value="">Choose a group...</option>
                <For each={props.buddyGroups}>
                  {(g) => <option value={g.id}>{g.name}</option>}
                </For>
              </select>
            </label>
            <Show when={props.buddyGroupName}>
              <p class="text-xs text-on-surface-muted">
                Members of '{props.buddyGroupName}' can join.
              </p>
            </Show>
          </Show>
        </div>
      </Show>

      {/* Conditional: Listed toggle */}
      <Show when={showListedToggle()}>
        <div class="bg-surface-lighter rounded-lg p-3 border-l-4 border-primary/50">
          <label class="flex items-center justify-between cursor-pointer">
            <div>
              <span class="text-sm font-semibold text-on-surface">Let players find this</span>
              <p class="text-xs text-on-surface-muted mt-0.5">
                Your tournament will appear in search results
              </p>
            </div>
            <input
              type="checkbox"
              checked={props.listed}
              onChange={(e) => props.onListedChange(e.currentTarget.checked)}
              class="w-10 h-5 rounded-full appearance-none bg-surface-lighter border border-border checked:bg-primary relative cursor-pointer
                after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-transform
                checked:after:translate-x-5"
            />
          </label>
        </div>
      </Show>
    </fieldset>
  );
};

export default AccessModeSelector;
```

**Step 4: Run tests**

```bash
npx vitest run src/features/tournaments/components/__tests__/AccessModeSelector.test.tsx
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/components/AccessModeSelector.tsx src/features/tournaments/components/__tests__/AccessModeSelector.test.tsx
git commit -m "feat: add AccessModeSelector component

2x2 OptionCard grid with conditional reveals for listed toggle
and group selector. Inline group creation for zero-group state."
```

---

## Task 14: Update TournamentCreatePage

**Files:**
- Modify: `src/features/tournaments/TournamentCreatePage.tsx`

**Step 1: Add access mode state signals**

Add after existing signals (around line 37):

```typescript
const [accessMode, setAccessMode] = createSignal<TournamentAccessMode>('open');
const [listed, setListed] = createSignal(true);
const [buddyGroupId, setBuddyGroupId] = createSignal<string | null>(null);
const [buddyGroupName, setBuddyGroupName] = createSignal<string | null>(null);
const [buddyGroups, setBuddyGroups] = createSignal<Array<{ id: string; name: string }>>([]);
```

Add import for the type and component:

```typescript
import type { TournamentAccessMode } from '../../data/types';
import AccessModeSelector from './components/AccessModeSelector';
```

**Step 2: Load buddy groups on mount**

```typescript
createResource(
  () => user()?.uid,
  async (uid) => {
    if (!uid) return;
    const groups = await firestoreBuddyGroupRepository.getByCreator(uid);
    setBuddyGroups(groups.map((g) => ({ id: g.id, name: g.name })));
  },
);
```

**Step 3: Handle accessMode changes**

```typescript
const handleAccessModeChange = (mode: TournamentAccessMode) => {
  setAccessMode(mode);
  if (mode === 'open' || mode === 'approval') {
    setListed(true);
  }
  if (mode !== 'group') {
    setBuddyGroupId(null);
    setBuddyGroupName(null);
  }
};
```

**Step 4: Add the selector to the form (after Location, before Format)**

```tsx
{/* Access section divider */}
<div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mt-6 mb-2">Access</div>

<AccessModeSelector
  accessMode={accessMode()}
  listed={listed()}
  buddyGroupId={buddyGroupId()}
  buddyGroupName={buddyGroupName()}
  buddyGroups={buddyGroups()}
  onAccessModeChange={handleAccessModeChange}
  onListedChange={setListed}
  onGroupChange={(id, name) => { setBuddyGroupId(id); setBuddyGroupName(name); }}
/>

{/* Game Rules section divider */}
<div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mt-6 mb-2">Game Rules</div>
```

**Step 5: Update tournament assembly on save** (around line 59-85)

Add the new fields to the tournament object:

```typescript
    accessMode: accessMode(),
    listed: listed(),
    visibility: listed() ? 'public' as const : 'private' as const,
    shareCode: crypto.randomUUID().slice(0, 8).toUpperCase(),
    buddyGroupId: accessMode() === 'group' ? buddyGroupId() : null,
    buddyGroupName: accessMode() === 'group' ? buddyGroupName() : null,
    registrationCounts: { confirmed: 0, pending: 0 },
```

Note: `shareCode` is now always generated (not null), and `visibility` is derived from `listed`.

**Step 6: Run type check + tests**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 7: Commit**

```bash
git add src/features/tournaments/TournamentCreatePage.tsx
git commit -m "feat: integrate AccessModeSelector into tournament create page

Access mode selection with listed toggle, group selector, and inline
group creation. Tournament assembly includes all new fields."
```

---

## Task 15: ApprovalQueue Component

**Files:**
- Create: `src/features/tournaments/components/ApprovalQueue.tsx`
- Create: `src/features/tournaments/components/__tests__/ApprovalQueue.test.tsx`

**Step 1: Write failing tests**

Create `src/features/tournaments/components/__tests__/ApprovalQueue.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import ApprovalQueue from '../ApprovalQueue';
import type { TournamentRegistration } from '../../../../data/types';

function makePendingReg(userId: string, name: string, daysAgo: number): TournamentRegistration {
  return {
    id: userId,
    tournamentId: 't1',
    userId,
    playerName: name,
    teamId: null,
    paymentStatus: 'unpaid',
    paymentNote: '',
    lateEntry: false,
    skillRating: null,
    partnerId: null,
    partnerName: null,
    profileComplete: false,
    registeredAt: Date.now() - daysAgo * 86400000,
    status: 'pending',
    declineReason: null,
    statusUpdatedAt: null,
  };
}

describe('ApprovalQueue', () => {
  const defaultProps = {
    tournamentId: 't1',
    pendingRegistrations: [
      makePendingReg('u1', 'Alice', 1),
      makePendingReg('u2', 'Bob', 3),
    ],
    onApprove: vi.fn(),
    onDecline: vi.fn(),
    onApproveAll: vi.fn(),
  };

  it('renders pending count header', () => {
    render(() => <ApprovalQueue {...defaultProps} />);
    expect(screen.getByText('Pending Requests (2)')).toBeTruthy();
  });

  it('renders player names', () => {
    render(() => <ApprovalQueue {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('renders approve buttons', () => {
    render(() => <ApprovalQueue {...defaultProps} />);
    const approveButtons = screen.getAllByText('Approve');
    expect(approveButtons).toHaveLength(2);
  });

  it('shows Approve All when 5+ pending', () => {
    const manyRegs = Array.from({ length: 6 }, (_, i) =>
      makePendingReg(`u${i}`, `Player ${i}`, i),
    );
    render(() => <ApprovalQueue {...defaultProps} pendingRegistrations={manyRegs} />);
    expect(screen.getByText('Approve All')).toBeTruthy();
  });

  it('renders nothing when no pending registrations', () => {
    const { container } = render(() => <ApprovalQueue {...defaultProps} pendingRegistrations={[]} />);
    expect(container.textContent).toBe('');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/tournaments/components/__tests__/ApprovalQueue.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Implement ApprovalQueue**

Create `src/features/tournaments/components/ApprovalQueue.tsx`:

```typescript
import { createSignal, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { Check, X } from 'lucide-solid';
import type { TournamentRegistration } from '../../../data/types';

interface Props {
  tournamentId: string;
  pendingRegistrations: TournamentRegistration[];
  onApprove: (userId: string) => void;
  onDecline: (userId: string, reason?: string) => void;
  onApproveAll: () => void;
}

const MAX_VISIBLE = 10;

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ApprovalQueue: Component<Props> = (props) => {
  const [expanded, setExpanded] = createSignal(false);
  const [decliningUserId, setDecliningUserId] = createSignal<string | null>(null);
  const [declineReason, setDeclineReason] = createSignal('');

  const visibleRegs = () => {
    const all = props.pendingRegistrations;
    if (expanded() || all.length <= MAX_VISIBLE) return all;
    return all.slice(0, MAX_VISIBLE);
  };

  const handleDeclineConfirm = (userId: string) => {
    props.onDecline(userId, declineReason().trim() || undefined);
    setDecliningUserId(null);
    setDeclineReason('');
  };

  return (
    <Show when={props.pendingRegistrations.length > 0}>
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-bold text-amber-400">
            Pending Requests ({props.pendingRegistrations.length})
          </h3>
          <Show when={props.pendingRegistrations.length >= 5}>
            <div class="flex gap-2">
              <button
                type="button"
                onClick={() => props.onApproveAll()}
                class="text-xs font-semibold text-primary hover:underline"
              >
                Approve All
              </button>
            </div>
          </Show>
        </div>

        <ul class="space-y-2 list-none p-0 m-0">
          <For each={visibleRegs()}>
            {(reg) => (
              <li class="bg-surface-light border-l-4 border-amber-400 rounded-r-lg p-3">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-sm font-semibold text-on-surface">
                      {reg.playerName ?? 'Unknown Player'}
                    </span>
                    <span class="text-xs text-on-surface-muted ml-2">
                      Requested {timeAgo(reg.registeredAt)}
                    </span>
                  </div>
                  <div class="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => props.onApprove(reg.userId)}
                      class="flex items-center gap-1 px-2.5 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-lg active:scale-95 transition-transform"
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecliningUserId(reg.userId)}
                      class="flex items-center gap-1 px-2.5 py-1 bg-surface-lighter text-on-surface-muted text-xs font-semibold rounded-lg active:scale-95 transition-transform"
                    >
                      <X size={12} /> Decline
                    </button>
                  </div>
                </div>

                {/* Decline reason inline (shown when declining this player) */}
                <Show when={decliningUserId() === reg.userId}>
                  <div class="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      maxLength={100}
                      value={declineReason()}
                      onInput={(e) => setDeclineReason(e.currentTarget.value)}
                      class="flex-1 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-on-surface placeholder:text-on-surface-muted"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeclineConfirm(reg.userId)}
                      class="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDecliningUserId(null); setDeclineReason(''); }}
                      class="px-2 py-1.5 text-on-surface-muted text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </Show>
              </li>
            )}
          </For>
        </ul>

        <Show when={!expanded() && props.pendingRegistrations.length > MAX_VISIBLE}>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            class="mt-2 text-xs text-primary font-semibold hover:underline"
          >
            Show all {props.pendingRegistrations.length}
          </button>
        </Show>
      </div>
    </Show>
  );
};

export default ApprovalQueue;
```

**Step 4: Run tests**

```bash
npx vitest run src/features/tournaments/components/__tests__/ApprovalQueue.test.tsx
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/components/ApprovalQueue.tsx src/features/tournaments/components/__tests__/ApprovalQueue.test.tsx
git commit -m "feat: add ApprovalQueue component for organizer dashboard

Pending requests with approve/decline per row, inline decline reason,
Approve All shortcut at 5+, capped at 10 visible with expand."
```

---

## Task 16: Update RegistrationForm (Mode-Aware CTA + States)

**Files:**
- Modify: `src/features/tournaments/components/RegistrationForm.tsx`

**Step 1: Add accessMode awareness to the form**

The form needs to:
1. Show different CTA text based on mode + eligibility
2. Show different success states (confirmed vs pending)
3. Show restriction messages for ineligible users
4. Show "full tournament" state
5. Show decline/withdrawal/expiration states for returning players

Add the new props:

```typescript
interface Props {
  tournament: Tournament;
  existingRegistration: TournamentRegistration | undefined;
  onRegistered: () => void;
  isInvited?: boolean;
  isGroupMember?: boolean;
}
```

Update the CTA button text:

```typescript
  const ctaText = () => {
    const mode = props.tournament.accessMode ?? 'open';
    if (mode === 'approval') return 'Ask to Join';
    if (mode === 'invite-only' && props.isInvited) return 'Join Tournament';
    if (mode === 'group' && props.isGroupMember) return 'Join Tournament';
    return 'Join Tournament';
  };

  const registrationStatus = () => {
    const mode = props.tournament.accessMode ?? 'open';
    if (mode === 'open') return 'confirmed' as const;
    if (mode === 'approval') return 'pending' as const;
    if (mode === 'invite-only') return 'confirmed' as const;
    if (mode === 'group') return 'confirmed' as const;
    return 'confirmed' as const;
  };
```

Update the registration object to include status:

```typescript
    status: registrationStatus(),
    declineReason: null,
    statusUpdatedAt: null,
```

Change doc ID from `crypto.randomUUID()` to `currentUser.uid`:

```typescript
    id: currentUser.uid,
```

Add restriction message for ineligible users:

```typescript
  const restrictionMessage = () => {
    const mode = props.tournament.accessMode ?? 'open';
    if (mode === 'invite-only' && !props.isInvited) {
      return `This tournament is invite only. Organized by ${props.tournament.organizerName ?? 'the organizer'}.`;
    }
    if (mode === 'group' && !props.isGroupMember) {
      return `This tournament is open to members of ${props.tournament.buddyGroupName ?? 'a buddy group'}. Organized by ${props.tournament.organizerName ?? 'the organizer'}.`;
    }
    return null;
  };
```

Update the success/status display for existing registrations:

```typescript
  // Show different states for existing registrations
  const existingStatus = () => props.existingRegistration?.status;

  // In the JSX, replace the existing "You're Registered" fallback:
  <Switch>
    <Match when={existingStatus() === 'confirmed'}>
      <div class="text-center py-6">
        <p class="text-green-400 font-bold text-lg">You're In!</p>
        {/* payment status etc */}
      </div>
    </Match>
    <Match when={existingStatus() === 'pending'}>
      <div class="text-center py-6">
        <p class="text-amber-400 font-bold text-lg">Request Submitted</p>
        <p class="text-sm text-on-surface-muted mt-1">Check back here for updates from the organizer.</p>
        <button
          type="button"
          onClick={handleWithdraw}
          class="mt-3 text-xs text-on-surface-muted hover:underline"
        >
          Withdraw Request
        </button>
      </div>
    </Match>
    <Match when={existingStatus() === 'declined'}>
      <div class="text-center py-6">
        <p class="text-red-400 font-bold">Your request was not approved.</p>
        <Show when={props.existingRegistration?.declineReason}>
          <p class="text-sm text-on-surface-muted mt-1">{props.existingRegistration!.declineReason}</p>
        </Show>
      </div>
    </Match>
    <Match when={existingStatus() === 'withdrawn'}>
      <div class="text-center py-6">
        <p class="text-on-surface-muted">You withdrew your request.</p>
        <button type="button" onClick={() => {/* re-show form */}} class="mt-2 text-primary text-sm font-semibold">
          Ask to Join
        </button>
      </div>
    </Match>
    <Match when={existingStatus() === 'expired'}>
      <div class="text-center py-6">
        <p class="text-on-surface-muted">Your request expired. You can ask to join again.</p>
        <button type="button" onClick={() => {/* re-show form */}} class="mt-2 text-primary text-sm font-semibold">
          Ask to Join
        </button>
      </div>
    </Match>
  </Switch>
```

Use `saveWithStatus` instead of `save`:

```typescript
await firestoreRegistrationRepository.saveWithStatus(reg, props.tournament.id);
```

**Step 2: Run tests + type check**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 3: Commit**

```bash
git add src/features/tournaments/components/RegistrationForm.tsx
git commit -m "feat: mode-aware RegistrationForm with status states

CTA adapts per mode (Join/Ask to Join), success states for
confirmed/pending/declined/withdrawn/expired. userId-keyed doc IDs.
Restriction messages for ineligible users."
```

---

## Task 17: Update ShareTournamentModal

**Files:**
- Modify: `src/features/tournaments/components/ShareTournamentModal.tsx`

**Step 1: Replace visibility toggle with contextual help text**

Remove the `onToggleVisibility` prop and the toggle button. Replace with access mode context.

Update props:

```typescript
interface Props {
  open: boolean;
  tournamentId: string;
  tournamentName: string;
  tournamentDate: string;
  tournamentLocation: string;
  accessMode: TournamentAccessMode;
  shareCode: string | null;
  organizerId: string;
  registeredUserIds: string[];
  onClose: () => void;
}
```

Add contextual help text map:

```typescript
const accessModeHelpText: Record<TournamentAccessMode, string> = {
  open: 'Anyone with this link can join immediately.',
  approval: 'Anyone with this link can request to join. You\'ll approve each one.',
  'invite-only': 'Only players you invite can join. Others will see this is invite-only.',
  group: 'Only group members can join.',
};
```

Replace the visibility toggle section with:

```tsx
<div class="bg-surface-lighter rounded-lg p-3 text-sm text-on-surface-muted">
  {accessModeHelpText[props.accessMode ?? 'open']}
</div>
```

Always show the share link and QR code (remove `<Show when={props.visibility === 'public' && shareUrl()}>` guards).

Always show the PlayerSearch section (remove visibility guard).

Add "Change access settings" link at bottom:

```tsx
<A href={`/tournaments/${props.tournamentId}`} class="text-xs text-primary hover:underline">
  Change access settings →
</A>
```

**Step 2: Update all callers of ShareTournamentModal**

In `TournamentDashboardPage.tsx`, update the props passed to the modal to use `accessMode` instead of `visibility` and remove `onToggleVisibility`.

**Step 3: Run tests + type check**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 4: Commit**

```bash
git add src/features/tournaments/components/ShareTournamentModal.tsx src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat: update ShareTournamentModal for access control

Remove visibility toggle. Always show share link, QR, and player
search. Add contextual help text per access mode."
```

---

## Task 18: Integrate ApprovalQueue into OrganizerPlayerManager

**Files:**
- Modify: `src/features/tournaments/components/OrganizerPlayerManager.tsx`

**Step 1: Add ApprovalQueue above existing player list**

Import and add the component:

```typescript
import ApprovalQueue from './ApprovalQueue';
```

Split registrations by status:

```typescript
const pendingRegs = () => props.registrations.filter((r) => r.status === 'pending');
const confirmedRegs = () => props.registrations.filter((r) => (r.status ?? 'confirmed') === 'confirmed');
```

Add handlers:

```typescript
const handleApprove = async (userId: string) => {
  await firestoreRegistrationRepository.updateRegistrationStatus(
    props.tournament.id, userId, 'pending', 'confirmed',
  );
  props.onUpdated();
};

const handleDecline = async (userId: string, reason?: string) => {
  await firestoreRegistrationRepository.updateRegistrationStatus(
    props.tournament.id, userId, 'pending', 'declined', reason,
  );
  props.onUpdated();
};

const handleApproveAll = async () => {
  const userIds = pendingRegs().map((r) => r.userId);
  await firestoreRegistrationRepository.batchUpdateStatus(
    props.tournament.id, userIds, 'pending', 'confirmed',
  );
  props.onUpdated();
};
```

Add in the JSX (before the existing player list):

```tsx
<ApprovalQueue
  tournamentId={props.tournament.id}
  pendingRegistrations={pendingRegs()}
  onApprove={handleApprove}
  onDecline={handleDecline}
  onApproveAll={handleApproveAll}
/>

<h3 class="text-sm font-bold text-on-surface mb-2">
  Registered Players ({confirmedRegs().length})
</h3>
```

Update the existing player list to use `confirmedRegs()` instead of `props.registrations`.

**Step 2: Run tests + type check**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 3: Commit**

```bash
git add src/features/tournaments/components/OrganizerPlayerManager.tsx
git commit -m "feat: integrate ApprovalQueue into OrganizerPlayerManager

Pending requests shown above confirmed players with approve/decline
actions. Approve All for batch approval."
```

---

## Task 19: Add Pending Badge to Dashboard Status Card

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

**Step 1: Add amber pending pill next to status badge**

Find the status badge area and add:

```tsx
<Show when={(t().registrationCounts?.pending ?? 0) > 0}>
  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
    {t().registrationCounts!.pending} pending
  </span>
</Show>
```

**Step 2: Run tests**

```bash
npx vitest run
```

**Step 3: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat: add pending request count pill to dashboard status card"
```

---

## Task 20: Update MyTournamentsTab with Pending Badges

**Files:**
- Modify: `src/features/tournaments/components/MyTournamentsTab.tsx`

**Step 1: Add pending badge to tournament cards**

In the tournament card rendering, check for pending registrations and show an amber badge:

```tsx
<Show when={(entry.tournament.registrationCounts?.pending ?? 0) > 0 && entry.role === 'organizer'}>
  <span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
    {entry.tournament.registrationCounts!.pending} pending
  </span>
</Show>
```

**Step 2: Commit**

```bash
git add src/features/tournaments/components/MyTournamentsTab.tsx
git commit -m "feat: show pending request badge on organizer's tournament cards"
```

---

## Task 21: Fix All Remaining Type Errors

**Files:** Multiple — any file that constructs Tournament or Registration objects

**Step 1: Run type check to find all errors**

```bash
npx tsc --noEmit 2>&1 | head -100
```

**Step 2: Fix each file**

Common fixes:
- Add new required fields when constructing Tournament objects (tests, create page, dashboard)
- Add new required fields when constructing Registration objects (tests, form, player manager)
- Update mock helpers (makeTournament, makeRegistration) in test files

For each test helper that creates a Tournament, add:

```typescript
accessMode: 'open' as const,
listed: true,
buddyGroupId: null,
buddyGroupName: null,
registrationCounts: { confirmed: 0, pending: 0 },
```

For each test helper that creates a Registration, add:

```typescript
status: 'confirmed' as const,
declineReason: null,
statusUpdatedAt: null,
```

**Step 3: Run type check + full test suite**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: All pass.

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: add new required fields to all Tournament and Registration constructors

Updates test helpers, mock data, and production code to include
accessMode, listed, registrationCounts, status, etc."
```

---

## Task 22: Final Verification

**Files:** None (verification only)

**Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Build**

```bash
npx vite build
```

Expected: Build succeeds.

**Step 4: Verify clean state**

```bash
git status
git log --oneline -20
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | Feature branch | — | — |
| 2 | Data types | — | `types.ts` |
| 3 | Normalizer | `tournamentNormalizer.ts`, test | — |
| 4 | Tournament repo | — | `firestoreTournamentRepository.ts` |
| 5 | Registration repo | test | `firestoreRegistrationRepository.ts` |
| 6 | Invitation repo | — | `firestoreInvitationRepository.ts` |
| 7 | Constants | — | `constants.ts` |
| 8 | Discovery filters | — | `discoveryFilters.ts`, test |
| 9 | Firestore indexes | — | `firestore.indexes.json` |
| 10 | Firestore rules | — | `firestore.rules` |
| 11 | AccessModeBadge | component, test | — |
| 12 | BrowseCard update | — | `BrowseCard.tsx`, test |
| 13 | AccessModeSelector | component, test | — |
| 14 | Create page | — | `TournamentCreatePage.tsx` |
| 15 | ApprovalQueue | component, test | — |
| 16 | RegistrationForm | — | `RegistrationForm.tsx` |
| 17 | ShareTournamentModal | — | `ShareTournamentModal.tsx`, `TournamentDashboardPage.tsx` |
| 18 | OrganizerPlayerManager | — | `OrganizerPlayerManager.tsx` |
| 19 | Dashboard pending pill | — | `TournamentDashboardPage.tsx` |
| 20 | MyTournamentsTab badges | — | `MyTournamentsTab.tsx` |
| 21 | Fix type errors | — | Multiple |
| 22 | Final verification | — | — |
