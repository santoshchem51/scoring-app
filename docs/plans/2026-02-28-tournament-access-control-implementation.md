# Tournament Access Control — Implementation Plan (Revised)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add four tournament access modes (open, approval, invite-only, group) with an independent listed toggle, approval queue, and registration status tracking.

**Architecture:** Two-dimensional access control (accessMode + listed) with denormalized visibility for backward compat. Registration and invitation docs keyed by userId (breaking change). Registration status transitions enforced in Firestore rules. Denormalized registrationCounts on tournament doc updated via writeBatch.

**Tech Stack:** SolidJS 1.9 + TypeScript + Firestore + Tailwind CSS v4 (no new dependencies)

**Design doc:** `docs/plans/2026-02-28-tournament-access-control-design.md`

**Revision notes:** Incorporates all findings from architecture + UI specialist reviews. Changes from v1:
- **5 blockers fixed:** security rules, invitation backfill, getByShareCode, handleWithdraw, truncation test
- **9 important issues fixed:** partial registrationCounts normalization, batch limits, BrowseCard prop cleanup, OptionCard reuse, missing imports, Decline All, full-tournament state, group help text, handleAddPlayer
- **6 new tasks added:** buddy group query (T4), invitation backfill (T7), lazy expiry (T17), InvitationInbox update (T21), isInvited/isGroupMember wiring (T18), player pending badges (T22)
- **Deferred to follow-up:** tournament edit page integration, mode-change confirmation dialogs, Firestore emulator rule tests

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
- **OptionCard:** `src/shared/components/OptionCard.tsx` (reuse for AccessModeSelector)

### Test Commands
- **Run all tests:** `npx vitest run`
- **Run specific test:** `npx vitest run src/path/to/test.test.ts`
- **Type check:** `npx tsc --noEmit`
- **Build:** `npx vite build`

### Existing Patterns
- **writeBatch:** See `firestoreBuddyGroupRepository.ts:addMember()` — batch.set + batch.update with increment()
- **Mocks:** Use `vi.hoisted()` for mock functions, `vi.mock()` for modules, import after mocks
- **OptionCard:** `src/shared/components/OptionCard.tsx` — has `aria-pressed`, `bg-primary/20 border-2 border-primary` selected style
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

Add below the existing `TournamentVisibility` type (around line 89):

```typescript
export type TournamentAccessMode = 'open' | 'approval' | 'invite-only' | 'group';
export type RegistrationStatus = 'confirmed' | 'pending' | 'declined' | 'withdrawn' | 'expired';
```

Add new fields to the `Tournament` interface (after `shareCode: string | null;`):

```typescript
  accessMode: TournamentAccessMode;
  listed: boolean;
  buddyGroupId: string | null;
  buddyGroupName: string | null;
  registrationCounts: { confirmed: number; pending: number };
```

Add new fields to the `TournamentRegistration` interface (after `registeredAt: number;`):

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

  it('fills missing pending field in partial registrationCounts', () => {
    const raw = { id: 't1', registrationCounts: { confirmed: 5 } };
    const result = normalizeTournament(raw as any);
    expect(result.registrationCounts).toEqual({ confirmed: 5, pending: 0 });
  });

  it('fills missing confirmed field in partial registrationCounts', () => {
    const raw = { id: 't1', registrationCounts: { pending: 3 } };
    const result = normalizeTournament(raw as any);
    expect(result.registrationCounts).toEqual({ confirmed: 0, pending: 3 });
  });

  it('defaults buddyGroupId and buddyGroupName to null when missing', () => {
    const raw = { id: 't1' };
    const result = normalizeTournament(raw as any);
    expect(result.buddyGroupId).toBeNull();
    expect(result.buddyGroupName).toBeNull();
  });

  it('handles listed explicitly set with visibility missing', () => {
    const raw = { id: 't1', listed: true };
    const result = normalizeTournament(raw as any);
    expect(result.listed).toBe(true);
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
  const rawCounts = t.registrationCounts as { confirmed?: number; pending?: number } | undefined;
  return {
    ...t,
    accessMode: t.accessMode ?? 'open',
    listed: t.listed ?? (t.visibility === 'public'),
    buddyGroupId: t.buddyGroupId ?? null,
    buddyGroupName: t.buddyGroupName ?? null,
    registrationCounts: {
      confirmed: rawCounts?.confirmed ?? 0,
      pending: rawCounts?.pending ?? 0,
    },
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

Expected: All 13 tests PASS.

**Step 5: Commit**

```bash
git add src/data/firebase/tournamentNormalizer.ts src/data/firebase/__tests__/tournamentNormalizer.test.ts
git commit -m "feat: add backward-compat normalization for tournament and registration docs

Runtime defaults for missing fields. Handles partial registrationCounts
objects (e.g. missing pending sub-field)."
```

---

## Task 4: Add getGroupsByUser to Buddy Group Repository

**Files:**
- Modify: `src/data/firebase/firestoreBuddyGroupRepository.ts`

**Why:** Task 15 (TournamentCreatePage) needs to load the user's buddy groups with `id` and `name`. The existing `getGroupsForUser()` returns only group IDs. We need a method that returns full group objects.

**Step 1: Add getGroupsByUser method**

Add to `firestoreBuddyGroupRepository` (after `getGroupsForUser`):

```typescript
  async getGroupsByUser(userId: string): Promise<BuddyGroup[]> {
    const groupIds = await this.getGroupsForUser(userId);
    if (groupIds.length === 0) return [];
    const groups = await Promise.all(
      groupIds.map((id) => this.get(id)),
    );
    return groups.filter((g): g is BuddyGroup => g !== null);
  },
```

**Step 2: Run tests**

```bash
npx vitest run && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/data/firebase/firestoreBuddyGroupRepository.ts
git commit -m "feat: add getGroupsByUser to buddy group repository

Returns full BuddyGroup objects for a user (uses getGroupsForUser + batch get)."
```

---

## Task 5: Update Tournament Repository

**Files:**
- Modify: `src/data/firebase/firestoreTournamentRepository.ts`

**Step 1: Integrate normalizer into all read paths**

Add import at top:

```typescript
import { normalizeTournament } from './tournamentNormalizer';
```

Update every method that reads tournament docs. Replace all `{ id: d.id, ...d.data() } as Tournament` with `normalizeTournament({ id: d.id, ...d.data() })`. This affects:

- `getById` (~line 23): `return normalizeTournament({ id: snap.id, ...snap.data() });`
- `getByOrganizer` (~line 33): `snapshot.docs.map((d) => normalizeTournament({ id: d.id, ...d.data() }))`
- `getByShareCode` (~line 46): `return normalizeTournament({ id: snap.docs[0].id, ...snap.docs[0].data() });`
- `getPublicTournaments` (~line 77): `snapshot.docs.map((d) => normalizeTournament({ id: d.id, ...d.data() }))`
- `getByScorekeeper` (~line 96): `snapshot.docs.map((d) => normalizeTournament({ id: d.id, ...d.data() }))`

**Step 2: Fix getByShareCode — remove visibility filter** *(BLOCKER FIX)*

The current code has `where('visibility', '==', 'public')` which blocks unlisted invite-only/group tournaments from being accessed via share link. Remove it:

```typescript
  async getByShareCode(shareCode: string): Promise<Tournament | undefined> {
    const q = query(
      collection(firestore, 'tournaments'),
      where('shareCode', '==', shareCode),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return undefined;
    const d = snapshot.docs[0];
    return normalizeTournament({ id: d.id, ...d.data() });
  },
```

This is safe because share codes are randomly generated and unguessable.

**Step 3: Add updateAccessMode method**

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

**Step 4: Run full test suite + type check**

```bash
npx vitest run && npx tsc --noEmit
```

Note: Type errors may still exist in other files. That's expected.

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreTournamentRepository.ts
git commit -m "feat: integrate normalizer into tournament repository reads

All read paths now normalize legacy docs. Removed visibility filter from
getByShareCode (share links work for all modes). Added updateAccessMode."
```

---

## Task 6: Update Registration Repository (userId-keyed docs + status)

**Files:**
- Modify: `src/data/firebase/firestoreRegistrationRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreRegistrationRepository.access.test.ts`

**Step 1: Write failing tests for new methods**

Create `src/data/firebase/__tests__/firestoreRegistrationRepository.access.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const batchInstance = vi.hoisted(() => ({
  set: vi.fn(),
  update: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));

const { mockDoc, mockSetDoc, mockGetDoc, mockGetDocs, mockUpdateDoc, mockCollection, mockQuery, mockWhere, mockWriteBatch } = vi.hoisted(() => ({
  mockDoc: vi.fn((...args: unknown[]) => ({ _doc: args })),
  mockSetDoc: vi.fn().mockResolvedValue(undefined),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
  mockCollection: vi.fn((...args: unknown[]) => ({ _collection: args })),
  mockQuery: vi.fn((...args: unknown[]) => ({ _query: args })),
  mockWhere: vi.fn((...args: unknown[]) => ({ _where: args })),
  mockWriteBatch: vi.fn(() => batchInstance),
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
    batchInstance.set.mockClear();
    batchInstance.update.mockClear();
    batchInstance.commit.mockClear().mockResolvedValue(undefined);
  });

  describe('saveWithStatus', () => {
    it('uses userId as doc ID', async () => {
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

      // Doc path uses userId, not the reg.id
      expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 't1', 'registrations', 'user-1');
    });

    it('increments pending count for pending status', async () => {
      const reg = {
        tournamentId: 't1',
        userId: 'user-1',
        status: 'pending' as const,
      };

      await firestoreRegistrationRepository.saveWithStatus(reg as any, 't1');

      // batch.set for the reg doc
      expect(batchInstance.set).toHaveBeenCalledTimes(1);
      // batch.update for the tournament counter
      expect(batchInstance.update).toHaveBeenCalledTimes(1);
      expect(batchInstance.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ 'registrationCounts.pending': { _increment: 1 } }),
      );
      expect(batchInstance.commit).toHaveBeenCalled();
    });

    it('increments confirmed count for confirmed status', async () => {
      const reg = {
        tournamentId: 't1',
        userId: 'user-1',
        status: 'confirmed' as const,
      };

      await firestoreRegistrationRepository.saveWithStatus(reg as any, 't1');

      expect(batchInstance.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ 'registrationCounts.confirmed': { _increment: 1 } }),
      );
    });
  });

  describe('updateRegistrationStatus', () => {
    it('updates status and adjusts counts in a batch', async () => {
      await firestoreRegistrationRepository.updateRegistrationStatus(
        't1', 'user-1', 'pending', 'confirmed',
      );

      // 2 updates: reg doc + tournament counter
      expect(batchInstance.update).toHaveBeenCalledTimes(2);
      expect(batchInstance.commit).toHaveBeenCalled();
    });

    it('includes declineReason when provided', async () => {
      await firestoreRegistrationRepository.updateRegistrationStatus(
        't1', 'user-1', 'pending', 'declined', 'Tournament is full',
      );

      expect(batchInstance.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'declined',
          declineReason: 'Tournament is full',
        }),
      );
    });
  });

  describe('batchUpdateStatus', () => {
    it('updates all userIds and adjusts counts', async () => {
      await firestoreRegistrationRepository.batchUpdateStatus(
        't1', ['u1', 'u2', 'u3'], 'pending', 'confirmed',
      );

      // 3 reg updates + 1 tournament counter = 4
      expect(batchInstance.update).toHaveBeenCalledTimes(4);
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

Update imports in `src/data/firebase/firestoreRegistrationRepository.ts`:

```typescript
import { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { normalizeRegistration } from './tournamentNormalizer';
import type { TournamentRegistration, PaymentStatus, RegistrationStatus } from '../types';
```

Update existing `getByTournament` and `getByUser` to use normalizer:

```typescript
  async getByTournament(tournamentId: string): Promise<TournamentRegistration[]> {
    const snapshot = await getDocs(collection(firestore, 'tournaments', tournamentId, 'registrations'));
    return snapshot.docs.map((d) => normalizeRegistration({ id: d.id, ...d.data() }));
  },

  async getByUser(tournamentId: string, userId: string): Promise<TournamentRegistration | undefined> {
    // Try userId-keyed doc first (new format)
    const directRef = doc(firestore, 'tournaments', tournamentId, 'registrations', userId);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      return normalizeRegistration({ id: directSnap.id, ...directSnap.data() });
    }
    // Fallback: query for legacy UUID-keyed doc
    const q = query(
      collection(firestore, 'tournaments', tournamentId, 'registrations'),
      where('userId', '==', userId),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return undefined;
    return normalizeRegistration({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
  },
```

Add new methods:

```typescript
  async saveWithStatus(reg: TournamentRegistration, tournamentId: string): Promise<void> {
    const batch = writeBatch(firestore);
    const regRef = doc(firestore, 'tournaments', tournamentId, 'registrations', reg.userId);
    const tournamentRef = doc(firestore, 'tournaments', tournamentId);

    batch.set(regRef, { ...reg, id: reg.userId, updatedAt: serverTimestamp() });

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
    const counterUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (fromStatus === 'confirmed') counterUpdates['registrationCounts.confirmed'] = increment(-1);
    if (fromStatus === 'pending') counterUpdates['registrationCounts.pending'] = increment(-1);
    if (toStatus === 'confirmed') counterUpdates['registrationCounts.confirmed'] = increment(1);
    if (toStatus === 'pending') counterUpdates['registrationCounts.pending'] = increment(1);

    batch.update(tournamentRef, counterUpdates);

    await batch.commit();
  },

  async batchUpdateStatus(
    tournamentId: string,
    userIds: string[],
    fromStatus: RegistrationStatus,
    toStatus: RegistrationStatus,
  ): Promise<void> {
    // Firestore batches are limited to 500 ops. Reserve 1 for tournament counter.
    const CHUNK_SIZE = 499;

    for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
      const chunk = userIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(firestore);
      const tournamentRef = doc(firestore, 'tournaments', tournamentId);

      for (const userId of chunk) {
        const regRef = doc(firestore, 'tournaments', tournamentId, 'registrations', userId);
        batch.update(regRef, {
          status: toStatus,
          statusUpdatedAt: Date.now(),
          updatedAt: serverTimestamp(),
        });
      }

      const counterUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (fromStatus === 'pending') counterUpdates['registrationCounts.pending'] = increment(-chunk.length);
      if (fromStatus === 'confirmed') counterUpdates['registrationCounts.confirmed'] = increment(-chunk.length);
      if (toStatus === 'confirmed') counterUpdates['registrationCounts.confirmed'] = increment(chunk.length);
      if (toStatus === 'pending') counterUpdates['registrationCounts.pending'] = increment(chunk.length);

      batch.update(tournamentRef, counterUpdates);
      await batch.commit();
    }
  },
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
updateRegistrationStatus and batchUpdateStatus for status transitions.
getByUser tries direct doc fetch first, falls back to query for legacy.
Batch chunking for 500-op Firestore limit."
```

---

## Task 7: Update Invitation Repository (userId-keyed docs + backfill)

**Files:**
- Modify: `src/data/firebase/firestoreInvitationRepository.ts`

**Step 1: Update create method to use userId as doc ID**

```typescript
  async create(invitation: TournamentInvitation): Promise<void> {
    const ref = doc(firestore, 'tournaments', invitation.tournamentId, 'invitations', invitation.invitedUserId);
    await setDoc(ref, { ...invitation, id: invitation.invitedUserId, updatedAt: serverTimestamp() });
  },
```

**Step 2: Update updateStatus to accept userId**

Change parameter name from `invitationId` to `userId` and add legacy fallback:

```typescript
  async updateStatus(tournamentId: string, userId: string, status: 'accepted' | 'declined'): Promise<void> {
    const ref = doc(firestore, 'tournaments', tournamentId, 'invitations', userId);
    await updateDoc(ref, { status, respondedAt: Date.now(), updatedAt: serverTimestamp() });
  },
```

**Step 3: Add backfill helper for legacy UUID-keyed docs**

This is critical — without it, legacy invitations break `exists(invitations/{uid})` security rules.

Add imports:

```typescript
import { doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, collection, collectionGroup, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
```

Add method:

```typescript
  async backfillToUserIdKeys(tournamentId: string): Promise<number> {
    const invitations = await this.getByTournament(tournamentId);
    let migrated = 0;

    for (const inv of invitations) {
      // If doc ID already equals invitedUserId, skip
      if (inv.id === inv.invitedUserId) continue;

      const batch = writeBatch(firestore);
      // Create new doc keyed by userId
      const newRef = doc(firestore, 'tournaments', tournamentId, 'invitations', inv.invitedUserId);
      batch.set(newRef, { ...inv, id: inv.invitedUserId, updatedAt: serverTimestamp() });
      // Delete old UUID-keyed doc
      const oldRef = doc(firestore, 'tournaments', tournamentId, 'invitations', inv.id);
      batch.delete(oldRef);
      await batch.commit();
      migrated++;
    }
    return migrated;
  },
```

**Step 4: Run tests**

```bash
npx vitest run && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreInvitationRepository.ts
git commit -m "feat: key invitation docs by userId + add backfill helper

Breaking change: invitation doc ID is now invitedUserId. Enables
exists() checks in Firestore security rules. backfillToUserIdKeys()
migrates legacy UUID-keyed docs on demand."
```

---

## Task 8: Update Constants

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

## Task 9: Update Discovery Filter Engine

**Files:**
- Modify: `src/features/tournaments/engine/discoveryFilters.ts`
- Modify: `src/features/tournaments/engine/__tests__/discoveryFilters.test.ts`

**Step 1: Write failing test for access mode filter**

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

  it('filters by accessMode when provided', () => {
    const tournaments = [
      makeTournament({ id: 't1', accessMode: 'open', listed: true }),
      makeTournament({ id: 't2', accessMode: 'approval', listed: true }),
    ];
    const result = filterPublicTournaments(tournaments, { accessMode: 'approval' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });
});
```

Update the `makeTournament` helper to include new required fields:

```typescript
accessMode: 'open' as const,
listed: true,
buddyGroupId: null,
buddyGroupName: null,
registrationCounts: { confirmed: 0, pending: 0 },
```

**Step 2: Update the filter engine**

Add import:

```typescript
import type { TournamentAccessMode } from '../../../data/types';
```

Add `accessMode` to `BrowseFilters`:

```typescript
export interface BrowseFilters {
  status?: BrowseStatusFilter;
  format?: TournamentFormat;
  search?: string;
  accessMode?: TournamentAccessMode;
}
```

Add the filter branch in `filterPublicTournaments`:

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

## Task 10: Update Firestore Indexes

**Files:**
- Modify: `firestore.indexes.json`

**Step 1: Add new indexes**

Add to the `indexes` array (keep existing indexes unchanged):

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
  "collectionGroup": "invitations",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "invitedUserId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

Note: Do NOT remove the existing single-field `registrations` collection group index on `userId` — it is still used by `getByParticipant`.

Note: The existing `(visibility, date)` index already covers the Browse query. No `(listed, date)` index needed.

**Step 2: Commit**

```bash
git add firestore.indexes.json
git commit -m "chore: add Firestore indexes for access control queries

Approval queue (registrations status+registeredAt), player pending
registrations (collection group userId+status), invitation inbox
(collection group invitedUserId+status)."
```

---

## Task 11: Update Firestore Security Rules

**Files:**
- Modify: `firestore.rules`

This is the most critical task. Changes are detailed and must be applied precisely.

**Step 1: Add tournamentData helper function**

Add right after `match /tournaments/{tournamentId} {` opens (line 92), before the read rules:

```
      // Helper: read tournament data (cached per rule evaluation)
      function tournamentData() {
        return get(/databases/$(database)/documents/tournaments/$(tournamentId)).data;
      }
```

**Step 2: Update tournament CREATE rule**

Add after existing `&& request.resource.data.visibility in ['private', 'public'];` (line 116). Replace the closing `;` with `&&` and add:

```
        && request.resource.data.accessMode in ['open', 'approval', 'invite-only', 'group']
        && request.resource.data.listed is bool
        && (request.resource.data.accessMode in ['open', 'approval'] ? request.resource.data.listed == true : true)
        && (request.resource.data.listed == true ? request.resource.data.visibility == 'public' : request.resource.data.visibility == 'private')
        && request.resource.data.registrationCounts.confirmed == 0
        && request.resource.data.registrationCounts.pending == 0
        && (request.resource.data.accessMode != 'group'
            || (request.resource.data.buddyGroupId is string
                && exists(/databases/$(database)/documents/buddyGroups/$(request.resource.data.buddyGroupId))
                && exists(/databases/$(database)/documents/buddyGroups/$(request.resource.data.buddyGroupId)/members/$(request.auth.uid))));
```

**Step 3: Update tournament UPDATE rule**

Add to the existing update rule (after the status transition block, around line 139) within the outer `&&`:

```
        && request.resource.data.visibility in ['private', 'public']
        && (
          // If accessMode hasn't changed, allow (backward compat for old tournaments)
          !('accessMode' in resource.data) && !('accessMode' in request.resource.data)
          // If accessMode is present, validate invariants
          || (request.resource.data.accessMode in ['open', 'approval', 'invite-only', 'group']
              && request.resource.data.listed is bool
              && (request.resource.data.listed == true ? request.resource.data.visibility == 'public' : request.resource.data.visibility == 'private'))
          // Allow counter-only updates (registration changes) — only registrationCounts changed
          || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['registrationCounts', 'updatedAt'])
        )
```

**Step 4: Replace registration CREATE rules (lines 231-246)**

Replace both existing registration create rules with:

```
        // Player self-registration: mode-aware
        allow create: if request.auth != null
          && regId == request.auth.uid
          && request.resource.data.userId == request.auth.uid
          && request.resource.data.tournamentId == tournamentId
          && tournamentData().status in ['setup', 'registration']
          && (
            // OPEN mode: anyone, status must be confirmed
            (tournamentData().accessMode == 'open'
              && request.resource.data.status == 'confirmed')
            // APPROVAL mode: anyone, status must be pending
            || (tournamentData().accessMode == 'approval'
              && request.resource.data.status == 'pending')
            // INVITE-ONLY: only invited users, confirmed
            || (tournamentData().accessMode == 'invite-only'
              && exists(/databases/$(database)/documents/tournaments/$(tournamentId)/invitations/$(request.auth.uid))
              && request.resource.data.status == 'confirmed')
            // GROUP: only group members, confirmed
            || (tournamentData().accessMode == 'group'
              && exists(/databases/$(database)/documents/buddyGroups/$(tournamentData().buddyGroupId)/members/$(request.auth.uid))
              && request.resource.data.status == 'confirmed')
            // LEGACY: no accessMode field, fallback to existing behavior
            || (!('accessMode' in tournamentData())
              && request.resource.data.status == 'confirmed')
          );

        // Organizer can add players on their behalf (manual registration)
        allow create: if request.auth != null
          && tournamentData().organizerId == request.auth.uid
          && request.resource.data.tournamentId == tournamentId
          && request.resource.data.status == 'confirmed'
          && tournamentData().status in ['setup', 'registration'];
```

**Step 5: Replace registration UPDATE rules (lines 249-260)**

Replace both existing update rules with:

```
        // Organizer: approve, decline, expire, or withdraw any registration
        allow update: if request.auth != null
          && tournamentData().organizerId == request.auth.uid
          && request.resource.data.userId == resource.data.userId
          && request.resource.data.tournamentId == resource.data.tournamentId
          && (
            // Approve: pending -> confirmed
            (resource.data.status == 'pending' && request.resource.data.status == 'confirmed')
            // Decline: pending -> declined
            || (resource.data.status == 'pending' && request.resource.data.status == 'declined')
            // Expire: pending -> expired
            || (resource.data.status == 'pending' && request.resource.data.status == 'expired')
            // Withdraw anyone
            || request.resource.data.status == 'withdrawn'
            // Payment updates (backward compat) — status unchanged
            || (request.resource.data.status == resource.data.status
                && request.resource.data.paymentStatus in ['unpaid', 'paid', 'waived'])
          );

        // Player: withdraw own registration or update own profile fields
        allow update: if request.auth != null
          && resource.data.userId == request.auth.uid
          && request.resource.data.userId == resource.data.userId
          && request.resource.data.tournamentId == resource.data.tournamentId
          && (
            // Withdraw: confirmed or pending -> withdrawn
            (request.resource.data.status == 'withdrawn'
              && resource.data.status in ['confirmed', 'pending'])
            // Profile updates: status unchanged, payment unchanged
            || (request.resource.data.status == resource.data.status
                && request.resource.data.paymentStatus == resource.data.paymentStatus
                && request.resource.data.paymentNote == resource.data.paymentNote)
          );

        // Registration delete: never (use withdrawn status)
        allow delete: if false;
```

Note: This removes the old delete rule. Registrations are now soft-deleted via `withdrawn` status.

**Step 6: Commit**

```bash
git add firestore.rules
git commit -m "feat: add mode-aware Firestore security rules for registrations

Registration creates validated per access mode with regId==uid enforcement.
Status transitions restricted: organizer (approve/decline/expire/withdraw),
player (withdraw own, profile updates). Legacy backward compat preserved.
Tournament create/update validate new access control fields."
```

---

## Task 12: AccessModeBadge Component

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

  it('truncates long group names at 20 chars', () => {
    render(() => <AccessModeBadge accessMode="group" groupName="Wednesday Night Warriors League" />);
    // 20 chars max: "Wednesday Night W..." (17 + "...")
    expect(screen.getByText('Wednesday Night W...')).toBeTruthy();
  });

  it('falls back to "Group" when no group name', () => {
    render(() => <AccessModeBadge accessMode="group" />);
    expect(screen.getByText('Group')).toBeTruthy();
  });

  it('has aria-label with full group name on truncated badge', () => {
    render(() => <AccessModeBadge accessMode="group" groupName="Wednesday Night Warriors League" />);
    expect(screen.getByLabelText('Group: Wednesday Night Warriors League')).toBeTruthy();
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

const MAX_GROUP_NAME_LENGTH = 20;

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

  const fullLabel = () => {
    if (props.accessMode === 'group' && props.groupName) return `Group: ${props.groupName}`;
    return undefined;
  };

  const colorClass = () => accessModeBadgeColors[props.accessMode] ?? '';

  return (
    <Show when={label()}>
      {(text) => (
        <span
          class={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${colorClass()}`}
          aria-label={fullLabel()}
        >
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

Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/components/AccessModeBadge.tsx src/features/tournaments/components/__tests__/AccessModeBadge.test.tsx
git commit -m "feat: add AccessModeBadge component for BrowseCard"
```

---

## Task 13: Update BrowseCard with Access Mode Badge

**Files:**
- Modify: `src/features/tournaments/components/BrowseCard.tsx`
- Modify: `src/features/tournaments/components/__tests__/BrowseCard.test.tsx`

**Step 1: Update test helper and add failing tests**

Update the `makeTournament` helper in the test to include new required fields:

```typescript
accessMode: 'open' as const,
listed: true,
buddyGroupId: null,
buddyGroupName: null,
registrationCounts: { confirmed: 0, pending: 0 },
```

Add new tests:

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

If `renderCard` doesn't exist yet, define it:

```typescript
function renderCard(tournament: Tournament) {
  return render(() => <BrowseCard tournament={tournament} />);
}
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

Remove the old `registrationCount?: number` prop from the BrowseCard props interface (if present). Remove any `registrationText()` function that uses it.

Add new registration label logic:

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

```tsx
<AccessModeBadge
  accessMode={props.tournament.accessMode ?? 'open'}
  groupName={props.tournament.buddyGroupName ?? undefined}
/>
```

Replace the old registration count display with:

```tsx
<p class="text-xs text-on-surface-muted mt-2">{registrationLabel()}</p>
```

**Step 4: Run tests**

```bash
npx vitest run src/features/tournaments/components/__tests__/BrowseCard.test.tsx
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/components/BrowseCard.tsx src/features/tournaments/components/__tests__/BrowseCard.test.tsx
git commit -m "feat: add access mode badge and adapted count copy to BrowseCard

Removed old registrationCount prop. Count label adapts per mode
(shows pending for approval, 'invited' for invite-only)."
```

---

## Task 14: AccessModeSelector Component

**Files:**
- Create: `src/features/tournaments/components/AccessModeSelector.tsx`
- Create: `src/features/tournaments/components/__tests__/AccessModeSelector.test.tsx`

**Step 1: Write failing tests**

Create `src/features/tournaments/components/__tests__/AccessModeSelector.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
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

  it('marks open as selected with aria-pressed', () => {
    render(() => <AccessModeSelector {...defaultProps} accessMode="open" />);
    const openButton = screen.getByText('Open').closest('button');
    expect(openButton?.getAttribute('aria-pressed')).toBe('true');
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

      {/* 2x2 grid — matches OptionCard selected/unselected styles */}
      <div class="grid grid-cols-2 gap-3">
        <For each={modes}>
          {(mode) => {
            const Icon = mode.icon;
            const isSelected = () => props.accessMode === mode.value;
            return (
              <button
                type="button"
                aria-pressed={isSelected()}
                onClick={() => props.onAccessModeChange(mode.value)}
                class={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all active:scale-[0.97] hover-lift ${
                  isSelected()
                    ? 'border-primary bg-primary/20 text-on-surface'
                    : 'border-surface-lighter bg-surface-light text-on-surface-muted hover:border-on-surface-muted'
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

      {/* Conditional: Group selector */}
      <Show when={showGroupSelector()}>
        <div class="bg-surface-light rounded-lg p-3 border-l-4 border-blue-400 space-y-2">
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
        <div class="bg-surface-light rounded-lg p-3 border-l-4 border-primary/50">
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
              class="w-10 h-5 rounded-full appearance-none bg-surface border border-border checked:bg-primary relative cursor-pointer
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

Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/components/AccessModeSelector.tsx src/features/tournaments/components/__tests__/AccessModeSelector.test.tsx
git commit -m "feat: add AccessModeSelector component

2x2 grid with aria-pressed, matches OptionCard selected/unselected styles.
Conditional listed toggle and group selector with inline group creation."
```

---

## Task 15: Update TournamentCreatePage

**Files:**
- Modify: `src/features/tournaments/TournamentCreatePage.tsx`

**Step 1: Add imports**

```typescript
import { createSignal, createResource, Show } from 'solid-js';
import type { TournamentAccessMode } from '../../data/types';
import AccessModeSelector from './components/AccessModeSelector';
import { firestoreBuddyGroupRepository } from '../../data/firebase/firestoreBuddyGroupRepository';
```

**Step 2: Add access mode state signals**

Add after existing signals:

```typescript
const [accessMode, setAccessMode] = createSignal<TournamentAccessMode>('open');
const [listed, setListed] = createSignal(true);
const [buddyGroupId, setBuddyGroupId] = createSignal<string | null>(null);
const [buddyGroupName, setBuddyGroupName] = createSignal<string | null>(null);
const [buddyGroups, setBuddyGroups] = createSignal<Array<{ id: string; name: string }>>([]);
```

**Step 3: Load buddy groups on mount**

```typescript
createResource(
  () => user()?.uid,
  async (uid) => {
    const groups = await firestoreBuddyGroupRepository.getGroupsByUser(uid);
    setBuddyGroups(groups.map((g) => ({ id: g.id, name: g.name })));
  },
);
```

Note: `createResource` skips the fetcher when source is falsy (undefined), so no `if (!uid)` guard needed.

**Step 4: Handle accessMode changes**

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

**Step 5: Add group validation to submit handler**

In the existing `handleCreate` function, add before tournament save:

```typescript
if (accessMode() === 'group' && !buddyGroupId()) {
  setError('Select a group before continuing.');
  return;
}
```

**Step 6: Add the selector to the form (after Location, before Format)**

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

**Step 7: Update tournament assembly on save**

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

**Step 8: Run type check + tests**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 9: Commit**

```bash
git add src/features/tournaments/TournamentCreatePage.tsx
git commit -m "feat: integrate AccessModeSelector into tournament create page

Access mode selection with listed toggle, group selector, and inline
group creation. Group validation at submit. Tournament assembly includes
all new fields."
```

---

## Task 16: ApprovalQueue Component

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
    onDeclineAll: vi.fn(),
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

  it('shows Approve All and Decline All when 5+ pending', () => {
    const manyRegs = Array.from({ length: 6 }, (_, i) =>
      makePendingReg(`u${i}`, `Player ${i}`, i),
    );
    render(() => <ApprovalQueue {...defaultProps} pendingRegistrations={manyRegs} />);
    expect(screen.getByText('Approve All')).toBeTruthy();
    expect(screen.getByText('Decline All')).toBeTruthy();
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
  onDeclineAll?: () => void;
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
  const [processingUserId, setProcessingUserId] = createSignal<string | null>(null);

  const visibleRegs = () => {
    const all = props.pendingRegistrations;
    if (expanded() || all.length <= MAX_VISIBLE) return all;
    return all.slice(0, MAX_VISIBLE);
  };

  const handleApprove = async (userId: string) => {
    setProcessingUserId(userId);
    try {
      await Promise.resolve(props.onApprove(userId));
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleDeclineConfirm = async (userId: string) => {
    setProcessingUserId(userId);
    try {
      await Promise.resolve(props.onDecline(userId, declineReason().trim() || undefined));
    } finally {
      setProcessingUserId(null);
      setDecliningUserId(null);
      setDeclineReason('');
    }
  };

  return (
    <Show when={props.pendingRegistrations.length > 0}>
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-bold text-amber-400">
            Pending Requests ({props.pendingRegistrations.length})
          </h3>
          <Show when={props.pendingRegistrations.length >= 5}>
            <div class="flex gap-3">
              <button
                type="button"
                onClick={() => props.onApproveAll()}
                disabled={processingUserId() !== null}
                class="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                Approve All
              </button>
              <Show when={props.onDeclineAll}>
                <button
                  type="button"
                  onClick={() => props.onDeclineAll?.()}
                  disabled={processingUserId() !== null}
                  class="text-xs font-semibold text-on-surface-muted hover:underline disabled:opacity-50"
                >
                  Decline All
                </button>
              </Show>
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
                      onClick={() => handleApprove(reg.userId)}
                      disabled={processingUserId() !== null}
                      class="flex items-center gap-1 px-2.5 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-lg active:scale-95 transition-transform disabled:opacity-50"
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecliningUserId(reg.userId)}
                      disabled={processingUserId() !== null}
                      class="flex items-center gap-1 px-2.5 py-1 bg-surface text-on-surface-muted text-xs font-semibold rounded-lg active:scale-95 transition-transform disabled:opacity-50"
                    >
                      <X size={12} /> Decline
                    </button>
                  </div>
                </div>

                {/* Decline reason inline */}
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
                      disabled={processingUserId() !== null}
                      class="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg disabled:opacity-50"
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
Approve All + Decline All at 5+, loading states, capped at 10 with expand."
```

---

## Task 17: Add Lazy Expiry Processing

**Files:**
- Create: `src/features/tournaments/engine/registrationExpiry.ts`
- Create: `src/features/tournaments/engine/__tests__/registrationExpiry.test.ts`

**Step 1: Write failing tests**

Create `src/features/tournaments/engine/__tests__/registrationExpiry.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getExpiredRegistrationUserIds, EXPIRY_DAYS } from '../registrationExpiry';
import type { TournamentRegistration } from '../../../../data/types';

function makeReg(userId: string, daysAgo: number, status: string): TournamentRegistration {
  return {
    id: userId,
    tournamentId: 't1',
    userId,
    playerName: `Player ${userId}`,
    teamId: null,
    paymentStatus: 'unpaid',
    paymentNote: '',
    lateEntry: false,
    skillRating: null,
    partnerId: null,
    partnerName: null,
    profileComplete: false,
    registeredAt: Date.now() - daysAgo * 86400000,
    status: status as any,
    declineReason: null,
    statusUpdatedAt: null,
  };
}

describe('getExpiredRegistrationUserIds', () => {
  it('returns pending registrations older than 14 days', () => {
    const regs = [
      makeReg('u1', 15, 'pending'),
      makeReg('u2', 1, 'pending'),
      makeReg('u3', 20, 'pending'),
    ];
    const expired = getExpiredRegistrationUserIds(regs);
    expect(expired).toEqual(['u1', 'u3']);
  });

  it('ignores non-pending registrations', () => {
    const regs = [
      makeReg('u1', 20, 'confirmed'),
      makeReg('u2', 20, 'declined'),
    ];
    const expired = getExpiredRegistrationUserIds(regs);
    expect(expired).toEqual([]);
  });

  it('returns empty array when no expired', () => {
    const regs = [
      makeReg('u1', 5, 'pending'),
    ];
    const expired = getExpiredRegistrationUserIds(regs);
    expect(expired).toEqual([]);
  });

  it('exports EXPIRY_DAYS as 14', () => {
    expect(EXPIRY_DAYS).toBe(14);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/tournaments/engine/__tests__/registrationExpiry.test.ts
```

**Step 3: Implement**

Create `src/features/tournaments/engine/registrationExpiry.ts`:

```typescript
import type { TournamentRegistration } from '../../../data/types';

export const EXPIRY_DAYS = 14;
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export function getExpiredRegistrationUserIds(registrations: TournamentRegistration[]): string[] {
  const now = Date.now();
  return registrations
    .filter((r) => r.status === 'pending' && (now - r.registeredAt) > EXPIRY_MS)
    .map((r) => r.userId);
}
```

**Step 4: Run tests**

```bash
npx vitest run src/features/tournaments/engine/__tests__/registrationExpiry.test.ts
```

Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/registrationExpiry.ts src/features/tournaments/engine/__tests__/registrationExpiry.test.ts
git commit -m "feat: add lazy expiry detection for pending registrations

Pure function: getExpiredRegistrationUserIds filters pending regs
older than 14 days. Called from OrganizerPlayerManager on load."
```

---

## Task 18: Update RegistrationForm (Mode-Aware CTA + States)

**Files:**
- Modify: `src/features/tournaments/components/RegistrationForm.tsx`

**Step 1: Update imports**

```typescript
import { createSignal, Show, Switch, Match } from 'solid-js';
import type { Component } from 'solid-js';
import type { TournamentRegistration, Tournament } from '../../../data/types';
```

**Step 2: Update Props interface**

```typescript
interface Props {
  tournament: Tournament;
  existingRegistration: TournamentRegistration | undefined;
  onRegistered: () => void;
  isInvited?: boolean;
  isGroupMember?: boolean;
}
```

**Step 3: Add mode-aware computed values**

Add inside the component:

```typescript
  const accessMode = () => props.tournament.accessMode ?? 'open';

  const ctaText = () => {
    const mode = accessMode();
    if (mode === 'approval') return 'Ask to Join';
    return 'Join Tournament';
  };

  const registrationStatus = () => {
    const mode = accessMode();
    if (mode === 'approval') return 'pending' as const;
    return 'confirmed' as const;
  };

  const isFull = () => {
    const max = props.tournament.maxPlayers;
    if (!max) return false;
    const confirmed = props.tournament.registrationCounts?.confirmed ?? 0;
    return confirmed >= max;
  };

  const restrictionMessage = () => {
    const mode = accessMode();
    if (mode === 'invite-only' && !props.isInvited) {
      return 'This tournament is invite only.';
    }
    if (mode === 'group' && !props.isGroupMember) {
      return `This tournament is open to members of ${props.tournament.buddyGroupName ?? 'a buddy group'}.`;
    }
    return null;
  };

  const canRegister = () => {
    const mode = accessMode();
    if (mode === 'open' || mode === 'approval') return true;
    if (mode === 'invite-only') return !!props.isInvited;
    if (mode === 'group') return !!props.isGroupMember;
    return true;
  };

  const existingStatus = () => props.existingRegistration?.status;
```

**Step 4: Add handleWithdraw function**

```typescript
  const handleWithdraw = async () => {
    const currentUser = user();
    if (!currentUser || saving()) return;
    setSaving(true);
    try {
      await firestoreRegistrationRepository.updateRegistrationStatus(
        props.tournament.id, currentUser.uid,
        existingStatus()!,
        'withdrawn',
      );
      props.onRegistered();
    } catch (err) {
      console.error('Withdraw failed:', err);
      setError('Failed to withdraw. Please try again.');
    } finally {
      setSaving(false);
    }
  };
```

**Step 5: Update handleRegister**

Change the registration object to use userId as doc ID and include status:

```typescript
      const reg: TournamentRegistration = {
        id: currentUser.uid,
        tournamentId: props.tournament.id,
        userId: currentUser.uid,
        playerName: currentUser.displayName || null,
        teamId: null,
        paymentStatus: 'unpaid',
        paymentNote: '',
        lateEntry: false,
        skillRating: skillRating() ? parseFloat(skillRating()) : null,
        partnerId: null,
        partnerName: partnerName().trim() || null,
        profileComplete: !!(skillRating() && (props.tournament.teamFormation !== 'byop' || partnerName().trim())),
        registeredAt: Date.now(),
        status: registrationStatus(),
        declineReason: null,
        statusUpdatedAt: null,
      };
      await firestoreRegistrationRepository.saveWithStatus(reg, props.tournament.id);
```

**Step 6: Replace the JSX with status-aware rendering**

Replace the existing `Show when={!isAlreadyRegistered()} fallback={...}` block with:

```tsx
    <div class="bg-surface-light rounded-xl p-4 space-y-4">
      {/* Existing registration states */}
      <Show when={isAlreadyRegistered()}>
        <Switch>
          <Match when={existingStatus() === 'confirmed'}>
            <div class="text-center py-4">
              <div class="text-primary font-bold text-lg mb-1">You're In!</div>
              <div class="text-sm text-on-surface-muted">
                Payment: {props.existingRegistration?.paymentStatus}
              </div>
            </div>
          </Match>
          <Match when={existingStatus() === 'pending'}>
            <div class="text-center py-6">
              <p class="text-amber-400 font-bold text-lg">Request Submitted</p>
              <p class="text-sm text-on-surface-muted mt-1">Check back here for updates from the organizer.</p>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={saving()}
                class="mt-3 text-xs text-on-surface-muted hover:underline disabled:opacity-50"
              >
                {saving() ? 'Withdrawing...' : 'Withdraw Request'}
              </button>
            </div>
          </Match>
          <Match when={existingStatus() === 'declined'}>
            <div class="text-center py-6">
              <p class="text-red-400 font-bold">Your request was not approved.</p>
              <Show when={props.existingRegistration?.declineReason}>
                {(reason) => <p class="text-sm text-on-surface-muted mt-1">{reason()}</p>}
              </Show>
            </div>
          </Match>
          <Match when={existingStatus() === 'withdrawn'}>
            <div class="text-center py-6">
              <p class="text-on-surface-muted">You withdrew your registration.</p>
            </div>
          </Match>
          <Match when={existingStatus() === 'expired'}>
            <div class="text-center py-6">
              <p class="text-on-surface-muted">Your request expired.</p>
            </div>
          </Match>
        </Switch>
      </Show>

      {/* New registration flow */}
      <Show when={!isAlreadyRegistered()}>
        <Show when={isFull()}>
          <div class="text-center py-6">
            <p class="text-on-surface-muted font-semibold">This tournament is full.</p>
          </div>
        </Show>

        <Show when={!isFull()}>
          <Show when={restrictionMessage()}>
            {(msg) => <p class="text-sm text-on-surface-muted text-center py-4">{msg()}</p>}
          </Show>

          <Show when={canRegister()}>
            <Show
              when={user()}
              fallback={
                <div class="space-y-3">
                  <p class="text-sm text-on-surface-muted">Sign in to register for this tournament.</p>
                  <button type="button" onClick={() => signIn()}
                    class="w-full bg-white text-gray-800 font-semibold text-sm py-3 rounded-lg active:scale-95 transition-transform">
                    Sign in with Google
                  </button>
                </div>
              }
            >
              <Show
                when={isRegistrationOpen()}
                fallback={<p class="text-sm text-on-surface-muted text-center py-2">Registration is not open.</p>}
              >
                {/* ...existing skill rating, partner name fields... */}

                <Show when={error()}>
                  <p class="text-red-500 text-sm text-center mb-2">{error()}</p>
                </Show>

                <button type="button" onClick={handleRegister}
                  disabled={saving()}
                  class={`w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl transition-transform ${!saving() ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}>
                  {saving() ? 'Registering...' : ctaText()}
                </button>
              </Show>
            </Show>
          </Show>
        </Show>
      </Show>
    </div>
```

**Step 7: Run tests + type check**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 8: Commit**

```bash
git add src/features/tournaments/components/RegistrationForm.tsx
git commit -m "feat: mode-aware RegistrationForm with status states

CTA adapts per mode (Join/Ask to Join). Status display for
confirmed/pending/declined/withdrawn/expired. Full-tournament state.
Restriction messages for ineligible users. Withdraw support."
```

---

## Task 19: Wire isInvited/isGroupMember to RegistrationForm from Dashboard

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

**Step 1: Add resource fetches for invitation and group membership**

Add imports:

```typescript
import { firestoreInvitationRepository } from '../../data/firebase/firestoreInvitationRepository';
import { firestoreBuddyGroupRepository } from '../../data/firebase/firestoreBuddyGroupRepository';
```

Add resources after the existing `existingRegistration` resource (~line 97):

```typescript
  // Check if user is invited to this tournament
  const [isInvited] = createResource(
    () => {
      const u = user();
      const t = live.tournament();
      if (!u || !t || t.accessMode !== 'invite-only') return null;
      return { tournamentId: t.id, userId: u.uid };
    },
    async (source) => {
      if (!source) return false;
      const invitations = await firestoreInvitationRepository.getByTournament(source.tournamentId);
      return invitations.some((inv) => inv.invitedUserId === source.userId);
    },
  );

  // Check if user is a member of the tournament's buddy group
  const [isGroupMember] = createResource(
    () => {
      const u = user();
      const t = live.tournament();
      if (!u || !t || t.accessMode !== 'group' || !t.buddyGroupId) return null;
      return { groupId: t.buddyGroupId, userId: u.uid };
    },
    async (source) => {
      if (!source) return false;
      const member = await firestoreBuddyGroupRepository.getMember(source.groupId, source.userId);
      return member !== null;
    },
  );
```

**Step 2: Update RegistrationForm call site**

Change the RegistrationForm props (around line 639-643):

```tsx
                  <RegistrationForm
                    tournament={t()}
                    existingRegistration={existingRegistration()}
                    onRegistered={handleRegistered}
                    isInvited={isInvited() ?? false}
                    isGroupMember={isGroupMember() ?? false}
                  />
```

**Step 3: Run tests + type check**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 4: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat: wire isInvited/isGroupMember to RegistrationForm

Dashboard fetches invitation status and group membership for the current
user, passes to RegistrationForm for eligibility checks."
```

---

## Task 20: Update ShareTournamentModal

**Files:**
- Modify: `src/features/tournaments/components/ShareTournamentModal.tsx`
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

**Step 1: Update ShareTournamentModal props**

Replace the Props interface:

```typescript
import type { TournamentAccessMode } from '../../../data/types';

interface Props {
  open: boolean;
  tournamentId: string;
  tournamentName: string;
  tournamentDate: string;
  tournamentLocation: string;
  accessMode: TournamentAccessMode;
  buddyGroupName: string | null;
  shareCode: string | null;
  organizerId: string;
  registeredUserIds: string[];
  onClose: () => void;
}
```

**Step 2: Replace visibility toggle with help text**

Remove `handleToggleVisibility` function and `toggling` signal.

Add reactive help text:

```typescript
  const helpText = () => {
    const mode = props.accessMode ?? 'open';
    if (mode === 'open') return 'Anyone with this link can join immediately.';
    if (mode === 'approval') return "Anyone with this link can request to join. You'll approve each one.";
    if (mode === 'invite-only') return 'Only players you invite can join. Others will see this is invite-only.';
    if (mode === 'group') return `Only members of ${props.buddyGroupName ?? 'the group'} can join.`;
    return '';
  };
```

Replace the Visibility section (Section 1) with:

```tsx
            {/* Section 1: Access Mode Info */}
            <div class="bg-surface-light rounded-lg p-3 text-sm text-on-surface-muted">
              {helpText()}
            </div>
```

**Step 3: Always show share link, QR, and PlayerSearch**

Remove the `<Show when={props.visibility === 'public' && shareUrl()}>` guards on Sections 2, 3, and 4. Keep the content, but wrap in `<Show when={shareUrl()}>` (link is available when shareCode exists).

**Step 4: Update dashboard call site**

In `TournamentDashboardPage.tsx`, update the ShareTournamentModal props (~line 752):

```tsx
                  <ShareTournamentModal
                    open={showShareModal()}
                    tournamentId={t().id}
                    tournamentName={t().name}
                    tournamentDate={new Date(t().date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    tournamentLocation={t().location || 'TBD'}
                    accessMode={t().accessMode ?? 'open'}
                    buddyGroupName={t().buddyGroupName ?? null}
                    shareCode={t().shareCode ?? null}
                    organizerId={t().organizerId}
                    registeredUserIds={live.registrations().map((r) => r.userId)}
                    onClose={() => setShowShareModal(false)}
                  />
```

Remove the `handleToggleVisibility` function from the dashboard (~line 455-466).

**Step 5: Run tests + type check**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 6: Commit**

```bash
git add src/features/tournaments/components/ShareTournamentModal.tsx src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat: update ShareTournamentModal for access control

Remove visibility toggle. Always show share link, QR, and player
search. Add contextual help text per access mode with group name."
```

---

## Task 21: Integrate ApprovalQueue + Expiry into OrganizerPlayerManager

**Files:**
- Modify: `src/features/tournaments/components/OrganizerPlayerManager.tsx`

**Step 1: Add imports**

```typescript
import ApprovalQueue from './ApprovalQueue';
import { getExpiredRegistrationUserIds } from '../engine/registrationExpiry';
import type { RegistrationStatus } from '../../../data/types';
```

**Step 2: Split registrations by status and process expiry**

Add computed values:

```typescript
  const pendingRegs = () => props.registrations.filter((r) => r.status === 'pending');
  const confirmedRegs = () => props.registrations.filter((r) => (r.status ?? 'confirmed') === 'confirmed');
```

Add expiry processing on load (runs once when registrations first load):

```typescript
  // Lazy expiry: batch-expire stale pending registrations on load
  const [expiryProcessed, setExpiryProcessed] = createSignal(false);
  createEffect(() => {
    if (expiryProcessed()) return;
    const expired = getExpiredRegistrationUserIds(props.registrations);
    if (expired.length > 0) {
      firestoreRegistrationRepository.batchUpdateStatus(
        props.tournament.id, expired, 'pending', 'expired',
      ).then(() => {
        setExpiryProcessed(true);
        props.onUpdated();
      });
    } else {
      setExpiryProcessed(true);
    }
  });
```

Add `createEffect` to imports:

```typescript
import { createSignal, createEffect, Show, For } from 'solid-js';
```

**Step 3: Add approval handlers**

```typescript
  const handleApprove = async (userId: string) => {
    try {
      await firestoreRegistrationRepository.updateRegistrationStatus(
        props.tournament.id, userId, 'pending', 'confirmed',
      );
      props.onUpdated();
    } catch (err) {
      console.error('Failed to approve registration:', err);
    }
  };

  const handleDecline = async (userId: string, reason?: string) => {
    try {
      await firestoreRegistrationRepository.updateRegistrationStatus(
        props.tournament.id, userId, 'pending', 'declined', reason,
      );
      props.onUpdated();
    } catch (err) {
      console.error('Failed to decline registration:', err);
    }
  };

  const handleApproveAll = async () => {
    try {
      const userIds = pendingRegs().map((r) => r.userId);
      await firestoreRegistrationRepository.batchUpdateStatus(
        props.tournament.id, userIds, 'pending', 'confirmed',
      );
      props.onUpdated();
    } catch (err) {
      console.error('Failed to approve all:', err);
    }
  };

  const handleDeclineAll = async () => {
    try {
      const userIds = pendingRegs().map((r) => r.userId);
      await firestoreRegistrationRepository.batchUpdateStatus(
        props.tournament.id, userIds, 'pending', 'declined',
      );
      props.onUpdated();
    } catch (err) {
      console.error('Failed to decline all:', err);
    }
  };
```

**Step 4: Update handleAddPlayer to use saveWithStatus**

Change the registration object in `handleAddPlayer`:

```typescript
      const manualId = `manual-${crypto.randomUUID()}`;
      const reg: TournamentRegistration = {
        id: manualId,
        tournamentId: props.tournament.id,
        userId: manualId,
        playerName: name,
        teamId: null,
        paymentStatus: 'unpaid',
        paymentNote: '',
        lateEntry: false,
        skillRating: skillRating() ? parseFloat(skillRating()) : null,
        partnerId: null,
        partnerName: partnerName().trim() || null,
        profileComplete: !!(skillRating() && (props.tournament.teamFormation !== 'byop' || partnerName().trim())),
        registeredAt: Date.now(),
        status: 'confirmed',
        declineReason: null,
        statusUpdatedAt: null,
      };
      await firestoreRegistrationRepository.saveWithStatus(reg, props.tournament.id);
```

**Step 5: Update JSX — add ApprovalQueue above player list**

```tsx
      <ApprovalQueue
        tournamentId={props.tournament.id}
        pendingRegistrations={pendingRegs()}
        onApprove={handleApprove}
        onDecline={handleDecline}
        onApproveAll={handleApproveAll}
        onDeclineAll={handleDeclineAll}
      />

      {/* Registered Players List */}
      <div class="bg-surface-light rounded-xl p-4">
        <div class="text-xs text-on-surface-muted uppercase tracking-wider mb-3">
          Registered Players ({confirmedRegs().length})
        </div>
```

Update the existing player list to use `confirmedRegs()` instead of `props.registrations`.

**Step 6: Run tests + type check**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 7: Commit**

```bash
git add src/features/tournaments/components/OrganizerPlayerManager.tsx
git commit -m "feat: integrate ApprovalQueue and lazy expiry into player manager

Pending requests shown above confirmed players. Approve/decline per row
and in batch. Lazy expiry processes stale pending regs on load.
Manual add player uses saveWithStatus."
```

---

## Task 22: Update InvitationInbox (call site fix)

**Files:**
- Modify: `src/features/tournaments/components/InvitationInbox.tsx`

**Step 1: Fix updateStatus call site** *(BLOCKER FIX)*

The existing code passes `item.invitation.id` (which is the doc ID). For legacy UUID-keyed docs, this is the UUID. For new userId-keyed docs, this is the userId.

Since we want to work with both old and new docs, change to pass `item.invitation.invitedUserId`:

In `handleAccept` (~line 44-51):

```typescript
  const handleAccept = async (item: InvitationWithContext) => {
    await firestoreInvitationRepository.updateStatus(
      item.invitation.tournamentId,
      item.invitation.invitedUserId,
      'accepted',
    );
    navigate(`/tournaments/${item.invitation.tournamentId}`);
  };
```

In `handleDecline` (~line 53-60):

```typescript
  const handleDecline = async (item: InvitationWithContext) => {
    await firestoreInvitationRepository.updateStatus(
      item.invitation.tournamentId,
      item.invitation.invitedUserId,
      'declined',
    );
    refetch();
  };
```

Wait — for legacy docs where `doc.id !== invitedUserId`, this will try to update `invitations/{userId}` which doesn't exist yet (the old doc is at `invitations/{uuid}`). We need the backfill (Task 7) to have run, OR we need a fallback.

For safety, use the doc ID directly (it works for both old and new):

```typescript
  const handleAccept = async (item: InvitationWithContext) => {
    await firestoreInvitationRepository.updateStatus(
      item.invitation.tournamentId,
      item.invitation.id,  // doc ID — works for both UUID and userId-keyed
      'accepted',
    );
    navigate(`/tournaments/${item.invitation.tournamentId}`);
  };

  const handleDecline = async (item: InvitationWithContext) => {
    await firestoreInvitationRepository.updateStatus(
      item.invitation.tournamentId,
      item.invitation.id,  // doc ID
      'declined',
    );
    refetch();
  };
```

This is safe because `invitation.id` is the actual Firestore doc ID — it's the UUID for old docs and the userId for new docs. The `updateStatus` method just needs the doc ID to build the ref.

**Step 2: Run tests**

```bash
npx vitest run && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/features/tournaments/components/InvitationInbox.tsx
git commit -m "fix: InvitationInbox uses doc ID for updateStatus

Works correctly for both legacy UUID-keyed and new userId-keyed docs."
```

---

## Task 23: Add Pending Badges to Dashboard + MyTournamentsTab

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`
- Modify: `src/features/tournaments/components/MyTournamentsTab.tsx`

**Step 1: Add amber pending pill to dashboard status card**

Find the status badge area in the dashboard and add:

```tsx
<Show when={(t().registrationCounts?.pending ?? 0) > 0}>
  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
    {t().registrationCounts?.pending ?? 0} pending
  </span>
</Show>
```

**Step 2: Add pending badge to MyTournamentsTab for BOTH organizers and players**

For organizer cards:

```tsx
<Show when={(entry.tournament.registrationCounts?.pending ?? 0) > 0 && entry.role === 'organizer'}>
  <span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
    {entry.tournament.registrationCounts?.pending ?? 0} pending
  </span>
</Show>
```

For player cards with pending registration status:

```tsx
<Show when={entry.role === 'player' && entry.registrationStatus === 'pending'}>
  <span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
    Pending
  </span>
</Show>
```

Note: `entry.registrationStatus` may need to be plumbed through from the MyTournamentEntry type. If the existing type doesn't have this field, add it as an optional `registrationStatus?: RegistrationStatus` and populate it during the merge step in `mergeTournamentEntries`.

**Step 3: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx src/features/tournaments/components/MyTournamentsTab.tsx
git commit -m "feat: show pending badges on dashboard and My Tournaments

Organizer sees pending count on their tournaments. Players see
'Pending' badge when their registration is awaiting approval."
```

---

## Task 24: Fix All Remaining Type Errors

**Files:** Multiple — any file that constructs Tournament or Registration objects

**Step 1: Run type check to find all errors**

```bash
npx tsc --noEmit 2>&1 | head -100
```

**Step 2: Fix each file**

Common fixes — for each test helper that creates a Tournament, add:

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
git add src/ firestore.rules firestore.indexes.json
git commit -m "fix: add new required fields to all Tournament and Registration constructors

Updates test helpers, mock data, and production code to include
accessMode, listed, registrationCounts, status, etc."
```

---

## Task 25: Final Verification

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
git log --oneline -25
```

---

## Deferred Items (follow-up tasks, not in this plan)

1. **Tournament edit page integration** — AccessModeSelector in edit flow with mode-change confirmation dialogs ("Approve all now?" when switching from approval to open)
2. **Firestore emulator rule tests** — Comprehensive test suite for all security rule changes using Firebase emulator
3. **Stale approval nudges** — "48h nudge" and "day 12 escalated nudge" for organizers with pending requests
4. **Push notifications** — Replace dashboard-only notification surface with actual push notifications (P3 layer)

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | Feature branch | — | — |
| 2 | Data types | — | `types.ts` |
| 3 | Normalizer | `tournamentNormalizer.ts`, test | — |
| 4 | Buddy group query | — | `firestoreBuddyGroupRepository.ts` |
| 5 | Tournament repo | — | `firestoreTournamentRepository.ts` |
| 6 | Registration repo | test | `firestoreRegistrationRepository.ts` |
| 7 | Invitation repo + backfill | — | `firestoreInvitationRepository.ts` |
| 8 | Constants | — | `constants.ts` |
| 9 | Discovery filters | — | `discoveryFilters.ts`, test |
| 10 | Firestore indexes | — | `firestore.indexes.json` |
| 11 | Firestore rules | — | `firestore.rules` |
| 12 | AccessModeBadge | component, test | — |
| 13 | BrowseCard update | — | `BrowseCard.tsx`, test |
| 14 | AccessModeSelector | component, test | — |
| 15 | Create page | — | `TournamentCreatePage.tsx` |
| 16 | ApprovalQueue | component, test | — |
| 17 | Lazy expiry | `registrationExpiry.ts`, test | — |
| 18 | RegistrationForm | — | `RegistrationForm.tsx` |
| 19 | Wire isInvited/isGroupMember | — | `TournamentDashboardPage.tsx` |
| 20 | ShareTournamentModal | — | `ShareTournamentModal.tsx`, `TournamentDashboardPage.tsx` |
| 21 | OrganizerPlayerManager | — | `OrganizerPlayerManager.tsx` |
| 22 | InvitationInbox fix | — | `InvitationInbox.tsx` |
| 23 | Pending badges | — | `TournamentDashboardPage.tsx`, `MyTournamentsTab.tsx` |
| 24 | Fix type errors | — | Multiple |
| 25 | Final verification | — | — |
