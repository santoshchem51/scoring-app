# Layer 10: Admin & Moderation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tiered roles (Owner/Admin/Moderator/Scorekeeper), dispute resolution, quick-add players, CSV export, tournament templates, and audit logging.

**Architecture:** Role map on Tournament document (`staff: Record<string, TournamentRole>` + `staffUids: string[]`). Audit log as immutable subcollection. Disputes as subcollection with simple flag→review→resolve flow. Templates in user-scoped Firestore collection.

**Tech Stack:** SolidJS 1.9, TypeScript, Vitest, @solidjs/testing-library, @firebase/rules-unit-testing, Firestore

**Design doc:** `docs/plans/2026-03-09-layer10-admin-moderation-design.md`

---

## Wave A: Role System (Foundation)

Everything else depends on this. Adds the 4-tier role model, updates role detection, migrates security rules.

### Task 1: Add Role Types and Update Tournament Interface

**Files:**
- Modify: `src/data/types.ts:194-198` (add TournamentRole, update Tournament)

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
Expected: FAIL — module not found

**Step 3: Add types to `src/data/types.ts`**

After line 198 (after `TournamentStatus`), add:

```typescript
export type TournamentRole = 'admin' | 'moderator' | 'scorekeeper';
```

Update the `Tournament` interface (around line 232-258). Replace `scorekeeperIds: string[];` with:

```typescript
  staff: Record<string, TournamentRole>;
  staffUids: string[];
```

**Step 4: Create `src/features/tournaments/engine/roleHelpers.ts`**

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

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/roleHelpers.test.ts`
Expected: PASS (all 12 tests)

**Step 6: Commit**

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

In `src/features/tournaments/engine/__tests__/roleDetection.test.ts`, update the `makeTournament` factory to use `staff` and `staffUids` instead of `scorekeeperIds`:

Replace `scorekeeperIds: ['sk-1', 'sk-2'],` (line 13) with:
```typescript
  staff: { 'sk-1': 'scorekeeper', 'sk-2': 'scorekeeper' },
  staffUids: ['sk-1', 'sk-2'],
```

Update the test "returns scorekeeper when userId is in scorekeeperIds" to say "returns scorekeeper when userId is in staff map".

Update the test "organizer takes priority over scorekeeper" — change `scorekeeperIds: ['org-1']` to `staff: { 'org-1': 'scorekeeper' }, staffUids: ['org-1']`.

Update the test "scorekeeper takes priority over player" — the factory already sets sk-1 as staff.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/engine/__tests__/roleDetection.test.ts`
Expected: FAIL — TypeScript errors (scorekeeperIds removed from Tournament)

**Step 3: Update roleDetection.ts**

Replace the full file `src/features/tournaments/engine/roleDetection.ts`:

```typescript
import type { Tournament, TournamentRegistration } from '../../../data/types';

export type ViewerRole = 'organizer' | 'scorekeeper' | 'player' | 'spectator';

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

Note: `detectViewerRole` maps all staff roles (admin, moderator, scorekeeper) to the legacy `ViewerRole` type. Components will gradually migrate to `hasMinRole()` from `roleHelpers.ts`, but `detectViewerRole` remains for backward compatibility during migration.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/engine/__tests__/roleDetection.test.ts`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add src/features/tournaments/engine/roleDetection.ts src/features/tournaments/engine/__tests__/roleDetection.test.ts
git commit -m "refactor(roles): update roleDetection to use staff map instead of scorekeeperIds"
```

---

### Task 3: Fix All TypeScript Compilation Errors from scorekeeperIds Removal

**Files:**
- Modify: Multiple files that reference `scorekeeperIds`

**Step 1: Find all references**

Run: `npx grep -rn 'scorekeeperIds' src/` — identify every file referencing the old field.

Expected files to update (based on codebase exploration):
- `src/data/firebase/firestoreTournamentRepository.ts` — `getByScorekeeper()` query
- `src/features/tournaments/TournamentCreatePage.tsx` — tournament creation
- `src/features/tournaments/TournamentDashboardPage.tsx` — role checks
- `src/features/tournaments/components/OrganizerControls.tsx` — scorekeeper management
- `src/features/tournaments/components/ScorekeeperMatchList.tsx` — match assignment
- `test/rules/helpers.ts` — test factory `makeTournament`

**Step 2: Update each file**

For each file, replace `scorekeeperIds` references:

- **`firestoreTournamentRepository.ts`**: Change `getByScorekeeper()` to query `where('staffUids', 'array-contains', userId)` instead of `where('scorekeeperIds', 'array-contains', userId)`.

- **`TournamentCreatePage.tsx`**: In the tournament creation object, replace `scorekeeperIds: []` with `staff: {}, staffUids: []`.

- **`TournamentDashboardPage.tsx`**: Where it checks `tournament.scorekeeperIds.includes(uid)`, use `tournament.staff[uid]` or `hasMinRole()`.

- **`OrganizerControls.tsx`**: If it manages scorekeepers, update to manage the `staff` map.

- **`test/rules/helpers.ts`**: Update `makeTournament` factory — replace `scorekeeperIds: []` with `staff: {}, staffUids: []`.

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: Some tests may fail due to factory changes — fix them.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(roles): migrate all scorekeeperIds references to staff map"
```

---

### Task 4: Update Firestore Security Rules for Role System

**Files:**
- Modify: `firestore.rules`

**Step 1: Write the failing security rules tests**

Create `test/rules/tournamentRoles.test.ts`:

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

  // --- Tournament Update: Settings ---
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
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'Mod Name' }));
    });

    it('scorekeeper cannot update name', async () => {
      await seedTournament();
      const db = authedContext(skId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'SK Name' }));
    });

    it('random user cannot update name', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'Random Name' }));
    });
  });

  // --- Tournament Delete: Owner only ---
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
  });

  // --- Staff map updates: admin+ only, no owner value, no self-promotion ---
  describe('staff map updates', () => {
    it('owner can add admin', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-admin`]: 'admin',
        staffUids: [adminId, modId, skId, 'new-admin'],
        updatedAt: Date.now(),
      }));
    });

    it('admin can add moderator', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-mod`]: 'moderator',
        staffUids: [adminId, modId, skId, 'new-mod'],
        updatedAt: Date.now(),
      }));
    });

    it('admin cannot add another admin', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-admin`]: 'admin',
        staffUids: [adminId, modId, skId, 'new-admin'],
      }));
    });

    it('moderator cannot modify staff', async () => {
      await seedTournament();
      const db = authedContext(modId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-sk`]: 'scorekeeper',
        staffUids: [adminId, modId, skId, 'new-sk'],
      }));
    });

    it('rejects owner value in staff map', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.bad`]: 'owner',
        staffUids: [adminId, modId, skId, 'bad'],
      }));
    });
  });

  // --- Tournament Creation: must have empty staff ---
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
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules/tournamentRoles.test.ts`
Expected: FAIL — current rules don't check staff roles

**Step 3: Update `firestore.rules`**

This is the most complex change. Update the tournament rules section:

- **Create rule**: Add `&& request.resource.data.staff is map && request.resource.data.staffUids is list`. Replace `scorekeeperIds is list` check. Add `&& request.resource.data.staffUids.size() == 0` to enforce empty staff on creation.

- **Update rule**: Replace the single organizer check with a role-based check. The main update rule (settings/status) should allow `admin+`:
  ```
  allow update: if request.auth != null
    && (request.auth.uid == resource.data.organizerId
        || (request.auth.uid in resource.data.staffUids
            && resource.data.staff[request.auth.uid] in ['admin']))
    && request.resource.data.organizerId == resource.data.organizerId
    // ... existing field validation ...
  ```

- **Staff map update rule**: Add a dedicated rule that allows admin+ to modify staff/staffUids, with validation that no 'owner' value appears and that non-owners can't set 'admin' values.

- **Counter-only update rule**: Keep as-is (any auth'd user).

- **Delete rule**: Change to owner-only (already is, just ensure it checks `organizerId`).

- **Subcollection rules**: Update all subcollection rules that check `resource.data.organizerId` to also check staff roles. For registrations (approve/decline), allow `moderator+`. For teams/pools/bracket, allow `admin+` for structural changes, `moderator+` for scoring.

**Step 4: Run security rules tests**

Run: `npx vitest run test/rules/tournamentRoles.test.ts`
Expected: PASS

**Step 5: Run existing security rules tests to ensure no regressions**

Run: `npx vitest run test/rules/`
Expected: Some may fail due to factory changes — fix them.

**Step 6: Commit**

```bash
git add firestore.rules test/rules/tournamentRoles.test.ts test/rules/helpers.ts
git commit -m "feat(roles): update Firestore security rules for 4-tier role system"
```

---

### Task 5: Staff Management Repository

**Files:**
- Create: `src/data/firebase/firestoreStaffRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreStaffRepository.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { addStaffMember, removeStaffMember, updateStaffRole } from '../firestoreStaffRepository';

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  arrayUnion: vi.fn((v) => ({ _arrayUnion: v })),
  arrayRemove: vi.fn((v) => ({ _arrayRemove: v })),
}));

vi.mock('../config', () => ({
  firestore: {},
}));

describe('firestoreStaffRepository', () => {
  it('addStaffMember sets staff role and adds to staffUids', async () => {
    const { updateDoc } = await import('firebase/firestore');
    await addStaffMember('tourney-1', 'user-1', 'moderator');
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'staff.user-1': 'moderator',
      }),
    );
  });

  it('removeStaffMember deletes staff entry and removes from staffUids', async () => {
    const { updateDoc } = await import('firebase/firestore');
    await removeStaffMember('tourney-1', 'user-1');
    expect(updateDoc).toHaveBeenCalled();
  });

  it('updateStaffRole changes existing staff role', async () => {
    const { updateDoc } = await import('firebase/firestore');
    await updateStaffRole('tourney-1', 'user-1', 'admin');
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'staff.user-1': 'admin',
      }),
    );
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
import type { TournamentRole } from '../../data/types';

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
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreStaffRepository.ts src/data/firebase/__tests__/firestoreStaffRepository.test.ts
git commit -m "feat(roles): add staff management repository"
```

---

### Task 6: Staff Management UI Component

**Files:**
- Create: `src/features/tournaments/components/StaffManager.tsx`
- Create: `src/features/tournaments/components/__tests__/StaffManager.test.tsx`

**Step 1: Write the failing test**

Create `src/features/tournaments/components/__tests__/StaffManager.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import StaffManager from '../StaffManager';
import type { Tournament } from '../../../../data/types';

const makeTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1', name: 'Test', date: Date.now(), location: '',
  format: 'single-elimination',
  config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 1, teamsPerPoolAdvancing: 2 },
  organizerId: 'owner-1',
  staff: { 'admin-1': 'admin', 'mod-1': 'moderator' },
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

describe('StaffManager', () => {
  it('renders staff list with role badges', () => {
    render(() => <StaffManager
      tournament={makeTournament()}
      currentUserId="owner-1"
      staffProfiles={[
        { uid: 'admin-1', displayName: 'Alice', photoURL: null },
        { uid: 'mod-1', displayName: 'Bob', photoURL: null },
      ]}
      onAddStaff={vi.fn()}
      onRemoveStaff={vi.fn()}
      onChangeRole={vi.fn()}
    />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();
    expect(screen.getByText('Moderator')).toBeTruthy();
  });

  it('shows remove button only for roles below the viewer', () => {
    render(() => <StaffManager
      tournament={makeTournament()}
      currentUserId="owner-1"
      staffProfiles={[
        { uid: 'admin-1', displayName: 'Alice', photoURL: null },
      ]}
      onAddStaff={vi.fn()}
      onRemoveStaff={vi.fn()}
      onChangeRole={vi.fn()}
    />);
    expect(screen.getByLabelText('Remove Alice')).toBeTruthy();
  });

  it('hides remove button when viewer is not admin+', () => {
    render(() => <StaffManager
      tournament={makeTournament()}
      currentUserId="mod-1"
      staffProfiles={[
        { uid: 'admin-1', displayName: 'Alice', photoURL: null },
      ]}
      onAddStaff={vi.fn()}
      onRemoveStaff={vi.fn()}
      onChangeRole={vi.fn()}
    />);
    expect(screen.queryByLabelText('Remove Alice')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/tournaments/components/__tests__/StaffManager.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement StaffManager component**

Create `src/features/tournaments/components/StaffManager.tsx` — a SolidJS component that:
- Lists staff members with name, role badge, and avatar
- Shows "Add Staff" button (uses existing user search pattern from PlayerSearch)
- Shows remove/change-role controls only for users the viewer can manage
- Uses `hasMinRole()` to determine what the current user can do

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/tournaments/components/__tests__/StaffManager.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/tournaments/components/StaffManager.tsx src/features/tournaments/components/__tests__/StaffManager.test.tsx
git commit -m "feat(roles): add StaffManager component"
```

---

### Task 7: Wire Staff Management into Tournament Dashboard

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

**Step 1: Add StaffManager to the dashboard**

In `TournamentDashboardPage.tsx`:
- Import `StaffManager` and `hasMinRole` from `roleHelpers`
- Add a "Staff" section/tab visible when `hasMinRole(tournament, uid, 'admin')`
- Fetch staff user profiles using `firestoreUserRepository.getByIds(tournament.staffUids)`
- Wire up `onAddStaff`, `onRemoveStaff`, `onChangeRole` handlers that call `firestoreStaffRepository`

**Step 2: Test manually**

Run: `npx vite --port 5199`
- Create a tournament
- Open dashboard → verify "Staff" section appears for organizer
- Add a staff member → verify they appear in the list

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat(roles): wire StaffManager into tournament dashboard"
```

---

### Task 8: Update Dashboard Role Checks to Use hasMinRole

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`
- Modify: `src/features/tournaments/components/OrganizerControls.tsx`
- Modify: `src/features/tournaments/components/OrganizerPlayerManager.tsx`

**Step 1: Replace role detection pattern**

Throughout the dashboard, replace patterns like:
```typescript
if (role() === 'organizer') { /* show admin controls */ }
```
with:
```typescript
if (hasMinRole(tournament(), uid, 'admin')) { /* show admin controls */ }
```

And for moderator-level features (approval, rescoring):
```typescript
if (hasMinRole(tournament(), uid, 'moderator')) { /* show moderation controls */ }
```

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add src/features/tournaments/TournamentDashboardPage.tsx src/features/tournaments/components/OrganizerControls.tsx src/features/tournaments/components/OrganizerPlayerManager.tsx
git commit -m "refactor(roles): update dashboard permission checks to use hasMinRole"
```

---

## Wave B: Audit Log

### Task 9: Audit Log Types

**Files:**
- Create: `src/features/tournaments/engine/auditTypes.ts`

**Step 1: Create types file**

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
  | { action: 'score_edit'; matchId: string; oldScores: number[][]; newScores: number[][] }
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
  timestamp: unknown; // serverTimestamp() — FieldValue on write, Timestamp on read
}
```

**Step 2: Commit**

```bash
git add src/features/tournaments/engine/auditTypes.ts
git commit -m "feat(audit): add audit log type definitions"
```

---

### Task 10: Audit Log Writer Helper

**Files:**
- Create: `src/data/firebase/firestoreAuditRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreAuditRepository.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createAuditEntry } from '../firestoreAuditRepository';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));
vi.mock('../config', () => ({ firestore: {} }));

describe('createAuditEntry', () => {
  it('creates a doc reference with correct fields', () => {
    const entry = createAuditEntry('tourney-1', {
      action: 'score_edit',
      actorId: 'user-1',
      actorName: 'Alice',
      actorRole: 'moderator',
      targetType: 'match',
      targetId: 'match-1',
      details: { action: 'score_edit', matchId: 'match-1', oldScores: [[11, 5]], newScores: [[11, 7]] },
    });
    expect(entry.action).toBe('score_edit');
    expect(entry.actorId).toBe('user-1');
    expect(entry.timestamp).toBe('SERVER_TS');
    expect(entry.id).toBeTruthy();
  });
});
```

**Step 2: Implement**

Create `src/data/firebase/firestoreAuditRepository.ts`:

```typescript
import { doc, collection, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
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

/** Create an audit entry object (for use in writeBatch). Does not write to Firestore. */
export function createAuditEntry(tournamentId: string, input: AuditInput): AuditLogEntry & { ref: ReturnType<typeof doc> } {
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

**Step 3: Run tests**

Run: `npx vitest run src/data/firebase/__tests__/firestoreAuditRepository.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/data/firebase/firestoreAuditRepository.ts src/data/firebase/__tests__/firestoreAuditRepository.test.ts
git commit -m "feat(audit): add audit log repository with create and query"
```

---

### Task 11: Audit Log Security Rules

**Files:**
- Modify: `firestore.rules`
- Create: `test/rules/auditLog.test.ts`

**Step 1: Write the failing tests**

Create `test/rules/auditLog.test.ts` with tests for:
- Staff can create audit entries with valid fields
- `actorId` must match `request.auth.uid`
- Non-staff cannot create audit entries
- Staff can read audit entries
- No one can update or delete audit entries
- Unauthenticated users cannot read or write

**Step 2: Add rules**

Add to `firestore.rules` inside the tournament match block:

```
match /auditLog/{logId} {
  allow create: if request.auth != null
    && (request.auth.uid == resource == null ? true : false)
    && (request.auth.uid in get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.staffUids
        || request.auth.uid == get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId)
    && request.resource.data.actorId == request.auth.uid
    && request.resource.data.timestamp == request.time
    && request.resource.data.keys().hasAll(['action', 'actorId', 'actorName', 'actorRole', 'targetType', 'targetId', 'details', 'timestamp']);

  allow read: if request.auth != null
    && (request.auth.uid in get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.staffUids
        || request.auth.uid == get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId);

  allow update, delete: if false;
}
```

**Step 3: Run tests, commit**

```bash
git add firestore.rules test/rules/auditLog.test.ts
git commit -m "feat(audit): add audit log security rules with tests"
```

---

### Task 12: Activity Log UI Component

**Files:**
- Create: `src/features/tournaments/components/ActivityLog.tsx`
- Create: `src/features/tournaments/components/__tests__/ActivityLog.test.tsx`

**Step 1: Write failing test, Step 2: Implement**

Component that:
- Fetches audit entries via `getAuditLog(tournamentId)`
- Renders chronological list with actor name, action description, relative timestamp
- Client-side filter dropdown by action type
- Human-readable action descriptions (e.g., "Alice edited match scores", "Bob flagged match as disputed")

**Step 3: Wire into dashboard (admin+ only)**

**Step 4: Commit**

```bash
git add src/features/tournaments/components/ActivityLog.tsx src/features/tournaments/components/__tests__/ActivityLog.test.tsx src/features/tournaments/TournamentDashboardPage.tsx
git commit -m "feat(audit): add Activity Log component and wire into dashboard"
```

---

## Wave C: Dispute Resolution

### Task 13: Dispute Types and Helpers

**Files:**
- Create: `src/features/tournaments/engine/disputeTypes.ts`
- Create: `src/features/tournaments/engine/disputeHelpers.ts`
- Create: `src/features/tournaments/engine/__tests__/disputeHelpers.test.ts`

**Step 1: Write failing tests for dispute helpers**

Test `createDispute()` factory, `canFlagDispute()` (checks if user is participant or moderator+), `canResolveDispute()` (checks moderator+).

**Step 2: Implement types and helpers**

`disputeTypes.ts`:
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
  createdAt: unknown;
  resolvedAt: unknown | null;
}
```

**Step 3: Run tests, commit**

```bash
git commit -m "feat(disputes): add dispute types and helper functions"
```

---

### Task 14: Dispute Repository

**Files:**
- Create: `src/data/firebase/firestoreDisputeRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreDisputeRepository.test.ts`

Functions: `flagDispute()`, `resolveDispute()`, `getDisputesByTournament()`, `getDisputesByMatch()`

Each function writes an audit log entry in the same batch.

**Commit:** `feat(disputes): add dispute repository with audit logging`

---

### Task 15: Dispute Security Rules

**Files:**
- Modify: `firestore.rules`
- Create: `test/rules/disputes.test.ts`

Rules for `tournaments/{id}/disputes/{disputeId}`:
- Create: any auth'd user (participants flag) or moderator+
- Update (resolve): moderator+ only, can only change status/resolvedBy/resolution/resolvedAt
- Read: staff can read all
- Delete: never

Also add a rule allowing moderator+ to set `disputed: true/false` on match documents.

**Commit:** `feat(disputes): add dispute security rules with tests`

---

### Task 16: Dispute UI Components

**Files:**
- Create: `src/features/tournaments/components/DisputeFlag.tsx` — button + reason input
- Create: `src/features/tournaments/components/DisputePanel.tsx` — list of open disputes for moderator+
- Create: `src/features/tournaments/components/__tests__/DisputeFlag.test.tsx`
- Create: `src/features/tournaments/components/__tests__/DisputePanel.test.tsx`

**Commit:** `feat(disputes): add DisputeFlag and DisputePanel components`

---

### Task 17: Wire Disputes into Dashboard and Match Cards

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx` — add dispute panel for moderator+
- Modify: Match card components — add warning badge when `disputed === true`, add "Flag" button

**Commit:** `feat(disputes): wire dispute UI into dashboard and match cards`

---

## Wave D: Quick Add Players + CSV Export

### Task 18: Add 'placeholder' RegistrationStatus

**Files:**
- Modify: `src/data/types.ts` — add `'placeholder'` to RegistrationStatus union
- Modify: `src/features/tournaments/constants.ts` — add label

**Step 1: Update types**

In `src/data/types.ts` line 196, change:
```typescript
export type RegistrationStatus = 'confirmed' | 'pending' | 'declined' | 'withdrawn' | 'expired' | 'placeholder';
```

In `src/features/tournaments/constants.ts`, add to `registrationStatusLabels`:
```typescript
placeholder: 'Placeholder',
```

**Step 2: Commit**

```bash
git commit -m "feat(quickadd): add placeholder registration status"
```

---

### Task 19: Quick Add Component

**Files:**
- Create: `src/features/tournaments/components/QuickAddPlayers.tsx`
- Create: `src/features/tournaments/components/__tests__/QuickAddPlayers.test.tsx`

**Step 1: Write failing tests**

Test: renders textarea, parses names (one per line), validates (1-100 chars, no empty lines, max 100 names), duplicate warning, calls onSubmit with parsed names array.

**Step 2: Implement**

SolidJS component with:
- Textarea for names (one per line)
- Live count display ("4 players")
- Validation errors shown inline
- "Add N Players" submit button
- Calls `onSubmit(names: string[])` prop

**Step 3: Commit**

```bash
git commit -m "feat(quickadd): add QuickAddPlayers component"
```

---

### Task 20: Quick Add Repository Logic

**Files:**
- Create: `src/data/firebase/firestoreQuickAddRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreQuickAddRepository.test.ts`

Function `quickAddPlayers(tournamentId, names, actorId, actorName, actorRole)`:
- Creates placeholder registrations in a batch
- Updates registration count atomically
- Writes audit log entry for `player_quick_add`

**Commit:** `feat(quickadd): add quick add repository with batch creation`

---

### Task 21: Placeholder Claim Flow

**Files:**
- Create: `src/features/tournaments/components/ClaimPlaceholder.tsx`
- Create: `src/features/tournaments/components/__tests__/ClaimPlaceholder.test.tsx`

Component shown after a new player registers in a tournament with placeholders:
- Lists unclaimed placeholder names
- Player taps their name → updates registration to link `claimedBy` and `userId`
- "None of these" option to skip

**Commit:** `feat(quickadd): add placeholder claim flow`

---

### Task 22: CSV Export

**Files:**
- Create: `src/features/tournaments/engine/csvExport.ts`
- Create: `src/features/tournaments/engine/__tests__/csvExport.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { registrationsToCsv, sanitizeCsvValue } from '../csvExport';

describe('sanitizeCsvValue', () => {
  it('strips leading formula characters', () => {
    expect(sanitizeCsvValue('=CMD()')).toBe('CMD()');
    expect(sanitizeCsvValue('+1234')).toBe('1234');
    expect(sanitizeCsvValue('-test')).toBe('test');
    expect(sanitizeCsvValue('@import')).toBe('import');
  });

  it('preserves normal values', () => {
    expect(sanitizeCsvValue('John Smith')).toBe('John Smith');
    expect(sanitizeCsvValue('john@email.com')).toBe('john@email.com');
  });
});

describe('registrationsToCsv', () => {
  it('generates CSV with header and rows', () => {
    const regs = [
      { playerName: 'Alice', userId: 'u1', status: 'confirmed', skillRating: 3.5, teamId: 'team-1', paymentStatus: 'paid', registeredAt: 1709942400000 },
    ];
    const csv = registrationsToCsv(regs);
    expect(csv).toContain('Name,Email,Skill Rating,Status,Team,Payment Status,Registered At');
    expect(csv).toContain('Alice');
    expect(csv).toContain('confirmed');
  });

  it('escapes commas in values', () => {
    const regs = [
      { playerName: 'Smith, John', userId: 'u1', status: 'confirmed', skillRating: null, teamId: null, paymentStatus: 'unpaid', registeredAt: 1709942400000 },
    ];
    const csv = registrationsToCsv(regs);
    expect(csv).toContain('"Smith, John"');
  });
});
```

**Step 2: Implement**

```typescript
export function sanitizeCsvValue(value: string): string {
  if (!value) return value;
  return value.replace(/^[\s]*[=+\-@\t\r]+/, '').trim();
}

export function registrationsToCsv(registrations: Array<Record<string, unknown>>): string {
  const headers = ['Name', 'Email', 'Skill Rating', 'Status', 'Team', 'Payment Status', 'Registered At'];
  const rows = registrations.map((r) => [
    escapeCsv(sanitizeCsvValue(String(r.playerName ?? ''))),
    escapeCsv(sanitizeCsvValue(String(r.email ?? ''))),
    r.skillRating ?? '',
    r.status ?? '',
    r.teamId ?? '',
    r.paymentStatus ?? '',
    r.registeredAt ? new Date(r.registeredAt as number).toISOString() : '',
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

**Step 3: Commit**

```bash
git commit -m "feat(export): add CSV export with sanitization"
```

---

### Task 23: Wire Quick Add + Export into Dashboard

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`
- Modify: `src/features/tournaments/components/OrganizerPlayerManager.tsx`

Add "Quick Add" and "Export CSV" buttons to the player management section (admin+ only). Wire up handlers.

**Commit:** `feat(quickadd): wire Quick Add and CSV Export into dashboard`

---

## Wave E: Tournament Templates

### Task 24: Template Types and Repository

**Files:**
- Create: `src/features/tournaments/engine/templateTypes.ts`
- Create: `src/data/firebase/firestoreTemplateRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreTemplateRepository.test.ts`

**Step 1: Define types**

```typescript
import type { TournamentFormat, TournamentConfig, TeamFormation, TournamentAccessMode, TournamentRules } from '../../../data/types';

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
```

**Step 2: Implement repository**

Functions: `saveTemplate()`, `getTemplates(userId)`, `deleteTemplate()`, `incrementUsageCount()`

Collection: `users/{uid}/templates/{id}`

**Step 3: Tests + commit**

```bash
git commit -m "feat(templates): add template types and repository"
```

---

### Task 25: Template Security Rules

**Files:**
- Modify: `firestore.rules`
- Create: `test/rules/templates.test.ts`

Simple rules: `allow read, write: if request.auth.uid == userId;`

**Commit:** `feat(templates): add template security rules with tests`

---

### Task 26: Save as Template UI

**Files:**
- Create: `src/features/tournaments/components/SaveTemplateModal.tsx`
- Create: `src/features/tournaments/components/__tests__/SaveTemplateModal.test.tsx`

Modal with name input + optional description. Extracts settings from current tournament, saves via repository.

**Commit:** `feat(templates): add Save as Template modal`

---

### Task 27: Create from Template UI

**Files:**
- Modify: `src/features/tournaments/TournamentCreatePage.tsx`

Add "From Template" dropdown at top of create form. When selected, pre-fills all form fields from template. Increment `usageCount` on successful creation.

**Commit:** `feat(templates): add From Template dropdown on create page`

---

### Task 28: Wire Templates into Dashboard

**Files:**
- Modify: `src/features/tournaments/TournamentDashboardPage.tsx`

Add "Save as Template" button (admin+ only) that opens `SaveTemplateModal`.

**Commit:** `feat(templates): wire Save as Template into dashboard`

---

## Wave F: Integration + Polish

### Task 29: Add Audit Logging to Existing Admin Actions

**Files:**
- Modify: `src/features/tournaments/components/OrganizerPlayerManager.tsx`
- Modify: `src/features/tournaments/components/OrganizerControls.tsx`
- Modify: `src/features/tournaments/components/ScoreEditModal.tsx` (or its parent handler)

Add audit log entries to existing admin actions:
- Registration approve/decline → `registration_approve`/`registration_decline`
- Player withdraw → `player_withdraw`
- Status change (pause/cancel/end) → `status_change`
- Score edit → `score_edit`
- Settings change → `settings_change`

Each uses `writeBatch` with the action + audit entry.

**Commit:** `feat(audit): add audit logging to existing admin actions`

---

### Task 30: Dispute Notifications

**Files:**
- Modify: `src/features/notifications/engine/notificationHelpers.ts`
- Modify: `src/data/firebase/firestoreDisputeRepository.ts`

Add notification factory functions:
- `createDisputeFlaggedNotif()` — sent to match participants + staff
- `createDisputeResolvedNotif()` — sent to flagger + participants

Wire into dispute flag/resolve flows using fire-and-forget pattern.

**Commit:** `feat(disputes): add dispute notifications`

---

### Task 31: E2E Tests

**Files:**
- Create: `e2e/layer10-admin.spec.ts`

End-to-end tests covering:
1. Owner adds admin → admin can edit settings
2. Admin adds moderator → moderator can approve registrations
3. Moderator cannot change tournament settings
4. Quick Add → placeholder registration → player claims spot
5. CSV export downloads a file
6. Save template → create from template pre-fills form
7. Dispute flag → resolve → match cleared

**Commit:** `test(e2e): add Layer 10 admin & moderation E2E tests`

---

### Task 32: Update Roadmap

**Files:**
- Modify: `docs/ROADMAP.md`

Move Layer 10 items to Completed section. Update "Up Next" to reflect P2 (Layer 8: Spectator Experience).

**Commit:** `docs: mark Layer 10 Admin & Moderation complete in roadmap`

---

## Summary

| Wave | Tasks | Focus |
|------|-------|-------|
| **A** | 1-8 | Role system (types, helpers, security rules, UI, migration) |
| **B** | 9-12 | Audit log (types, repository, security rules, UI) |
| **C** | 13-17 | Dispute resolution (types, repository, rules, UI, wiring) |
| **D** | 18-23 | Quick Add + CSV Export (types, components, repository, wiring) |
| **E** | 24-28 | Tournament templates (types, repository, rules, UI, wiring) |
| **F** | 29-32 | Integration (audit wiring, notifications, E2E, roadmap) |

**Total: 32 tasks across 6 waves.**
