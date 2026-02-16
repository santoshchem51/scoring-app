# Player Buddies Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a "Player Buddies" feature that lets pickleball players organize pickup games through buddy groups — replacing WhatsApp coordination with in-app sessions, RSVP, time-slot voting, day-of check-ins, open calls, and share links.

**Architecture:** Hybrid model — BuddyGroups provide social identity, GameSessions are the actions. Sessions are top-level Firestore documents (not nested under groups) to enable open-call discovery queries. New feature folder at `src/features/buddies/` with engine (pure functions), components, hooks, and repositories.

**Tech Stack:** SolidJS 1.9, TypeScript, Firebase Firestore, Tailwind CSS v4, Vitest, existing share code utility.

**Design doc:** `docs/plans/2026-02-16-player-buddies-design.md`

---

## Wave 1: Data Types & Engine Foundation

### Task 1: Add Player Buddies types

**Files:**
- Modify: `src/data/types.ts`

**Step 1: Add all new types at the end of `src/data/types.ts`**

After the existing `TournamentInvitation` interface, add:

```typescript
// --- Player Buddies types ---

export type BuddyGroupVisibility = 'private' | 'public';
export type BuddyGroupMemberRole = 'admin' | 'member';
export type GameSessionStatus = 'proposed' | 'confirmed' | 'cancelled' | 'completed';
export type GameSessionVisibility = 'group' | 'open';
export type RsvpStyle = 'simple' | 'voting';
export type RsvpResponse = 'in' | 'out' | 'maybe';
export type DayOfStatus = 'none' | 'on-my-way' | 'here' | 'cant-make-it';
export type BuddyNotificationType =
  | 'session_proposed'
  | 'session_confirmed'
  | 'session_cancelled'
  | 'spot_opened'
  | 'player_joined'
  | 'group_invite'
  | 'voting_reminder';

export interface BuddyGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  defaultLocation: string | null;
  defaultDay: string | null;
  defaultTime: string | null;
  memberCount: number;
  visibility: BuddyGroupVisibility;
  shareCode: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface BuddyGroupMember {
  userId: string;
  displayName: string;
  photoURL: string | null;
  role: BuddyGroupMemberRole;
  joinedAt: number;
}

export interface TimeSlot {
  id: string;
  date: number;
  startTime: string;
  endTime: string;
  voteCount: number;
}

export interface GameSession {
  id: string;
  groupId: string | null;
  createdBy: string;
  title: string;
  location: string;
  courtsAvailable: number;
  spotsTotal: number;
  spotsConfirmed: number;
  scheduledDate: number | null;
  timeSlots: TimeSlot[] | null;
  confirmedSlot: TimeSlot | null;
  rsvpStyle: RsvpStyle;
  rsvpDeadline: number | null;
  visibility: GameSessionVisibility;
  shareCode: string;
  autoOpenOnDropout: boolean;
  minPlayers: number;
  status: GameSessionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SessionRsvp {
  userId: string;
  displayName: string;
  photoURL: string | null;
  response: RsvpResponse;
  dayOfStatus: DayOfStatus;
  selectedSlotIds: string[];
  respondedAt: number;
  statusUpdatedAt: number | null;
}

export interface BuddyNotification {
  id: string;
  userId: string;
  type: BuddyNotificationType;
  sessionId: string | null;
  groupId: string | null;
  actorName: string;
  message: string;
  read: boolean;
  createdAt: number;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd Projects/ScoringApp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/data/types.ts
git commit -m "feat(buddies): add Player Buddies data types"
```

---

### Task 2: Create session engine — pure helper functions

**Files:**
- Create: `src/features/buddies/engine/sessionHelpers.ts`
- Create: `src/features/buddies/engine/__tests__/sessionHelpers.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/features/buddies/engine/__tests__/sessionHelpers.test.ts
import { describe, it, expect } from 'vitest';
import {
  canRsvp,
  canUpdateDayOfStatus,
  isSessionFull,
  needsMorePlayers,
  shouldAutoOpen,
  getWinningSlot,
  getSessionDisplayStatus,
} from '../sessionHelpers';
import type { GameSession, SessionRsvp, TimeSlot } from '../../../../data/types';

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: 's1',
    groupId: 'g1',
    createdBy: 'u1',
    title: 'Test Session',
    location: 'Park',
    courtsAvailable: 1,
    spotsTotal: 4,
    spotsConfirmed: 0,
    scheduledDate: Date.now() + 86400000,
    timeSlots: null,
    confirmedSlot: null,
    rsvpStyle: 'simple',
    rsvpDeadline: null,
    visibility: 'group',
    shareCode: 'ABC123',
    autoOpenOnDropout: false,
    minPlayers: 4,
    status: 'proposed',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeRsvp(overrides: Partial<SessionRsvp> = {}): SessionRsvp {
  return {
    userId: 'u1',
    displayName: 'Test User',
    photoURL: null,
    response: 'in',
    dayOfStatus: 'none',
    selectedSlotIds: [],
    respondedAt: Date.now(),
    statusUpdatedAt: null,
    ...overrides,
  };
}

describe('canRsvp', () => {
  it('returns true for proposed session', () => {
    expect(canRsvp(makeSession({ status: 'proposed' }))).toBe(true);
  });

  it('returns true for confirmed session', () => {
    expect(canRsvp(makeSession({ status: 'confirmed' }))).toBe(true);
  });

  it('returns false for cancelled session', () => {
    expect(canRsvp(makeSession({ status: 'cancelled' }))).toBe(false);
  });

  it('returns false for completed session', () => {
    expect(canRsvp(makeSession({ status: 'completed' }))).toBe(false);
  });

  it('returns false when past RSVP deadline', () => {
    const session = makeSession({ rsvpDeadline: Date.now() - 1000 });
    expect(canRsvp(session)).toBe(false);
  });
});

describe('canUpdateDayOfStatus', () => {
  it('returns true for confirmed session with "in" RSVP', () => {
    const session = makeSession({ status: 'confirmed' });
    const rsvp = makeRsvp({ response: 'in' });
    expect(canUpdateDayOfStatus(session, rsvp)).toBe(true);
  });

  it('returns false for proposed session', () => {
    const session = makeSession({ status: 'proposed' });
    const rsvp = makeRsvp({ response: 'in' });
    expect(canUpdateDayOfStatus(session, rsvp)).toBe(false);
  });

  it('returns false if RSVP is "out"', () => {
    const session = makeSession({ status: 'confirmed' });
    const rsvp = makeRsvp({ response: 'out' });
    expect(canUpdateDayOfStatus(session, rsvp)).toBe(false);
  });
});

describe('isSessionFull', () => {
  it('returns true when spotsConfirmed >= spotsTotal', () => {
    expect(isSessionFull(makeSession({ spotsConfirmed: 4, spotsTotal: 4 }))).toBe(true);
  });

  it('returns false when spots remain', () => {
    expect(isSessionFull(makeSession({ spotsConfirmed: 3, spotsTotal: 4 }))).toBe(false);
  });
});

describe('needsMorePlayers', () => {
  it('returns true when below minPlayers', () => {
    expect(needsMorePlayers(makeSession({ spotsConfirmed: 2, minPlayers: 4 }))).toBe(true);
  });

  it('returns false when at or above minPlayers', () => {
    expect(needsMorePlayers(makeSession({ spotsConfirmed: 4, minPlayers: 4 }))).toBe(false);
  });
});

describe('shouldAutoOpen', () => {
  it('returns true when autoOpen enabled, group visibility, and needs players', () => {
    const session = makeSession({
      autoOpenOnDropout: true,
      visibility: 'group',
      spotsConfirmed: 3,
      minPlayers: 4,
    });
    expect(shouldAutoOpen(session)).toBe(true);
  });

  it('returns false when already open', () => {
    const session = makeSession({
      autoOpenOnDropout: true,
      visibility: 'open',
      spotsConfirmed: 3,
      minPlayers: 4,
    });
    expect(shouldAutoOpen(session)).toBe(false);
  });

  it('returns false when autoOpen disabled', () => {
    const session = makeSession({
      autoOpenOnDropout: false,
      visibility: 'group',
      spotsConfirmed: 3,
      minPlayers: 4,
    });
    expect(shouldAutoOpen(session)).toBe(false);
  });
});

describe('getWinningSlot', () => {
  it('returns the slot with most votes', () => {
    const slots: TimeSlot[] = [
      { id: 'a', date: 1, startTime: '09:00', endTime: '11:00', voteCount: 2 },
      { id: 'b', date: 1, startTime: '14:00', endTime: '16:00', voteCount: 5 },
      { id: 'c', date: 2, startTime: '09:00', endTime: '11:00', voteCount: 3 },
    ];
    expect(getWinningSlot(slots)).toEqual(slots[1]);
  });

  it('returns first slot on tie', () => {
    const slots: TimeSlot[] = [
      { id: 'a', date: 1, startTime: '09:00', endTime: '11:00', voteCount: 3 },
      { id: 'b', date: 1, startTime: '14:00', endTime: '16:00', voteCount: 3 },
    ];
    expect(getWinningSlot(slots)).toEqual(slots[0]);
  });

  it('returns null for empty slots', () => {
    expect(getWinningSlot([])).toBeNull();
  });
});

describe('getSessionDisplayStatus', () => {
  it('returns "Need X more" when below min', () => {
    const session = makeSession({ spotsConfirmed: 2, minPlayers: 4 });
    expect(getSessionDisplayStatus(session)).toBe('Need 2 more');
  });

  it('returns "X/Y confirmed" when above min but not full', () => {
    const session = makeSession({ spotsConfirmed: 5, spotsTotal: 8, minPlayers: 4 });
    expect(getSessionDisplayStatus(session)).toBe('5/8 confirmed');
  });

  it('returns "Full" when all spots taken', () => {
    const session = makeSession({ spotsConfirmed: 4, spotsTotal: 4 });
    expect(getSessionDisplayStatus(session)).toBe('Full');
  });

  it('returns "Cancelled" for cancelled session', () => {
    const session = makeSession({ status: 'cancelled' });
    expect(getSessionDisplayStatus(session)).toBe('Cancelled');
  });

  it('returns "Completed" for completed session', () => {
    const session = makeSession({ status: 'completed' });
    expect(getSessionDisplayStatus(session)).toBe('Completed');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd Projects/ScoringApp && npx vitest run src/features/buddies/engine/__tests__/sessionHelpers.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/features/buddies/engine/sessionHelpers.ts
import type { GameSession, SessionRsvp, TimeSlot } from '../../../data/types';

export function canRsvp(session: GameSession): boolean {
  if (session.status === 'cancelled' || session.status === 'completed') return false;
  if (session.rsvpDeadline && Date.now() > session.rsvpDeadline) return false;
  return true;
}

export function canUpdateDayOfStatus(session: GameSession, rsvp: SessionRsvp): boolean {
  if (session.status !== 'confirmed') return false;
  if (rsvp.response !== 'in') return false;
  return true;
}

export function isSessionFull(session: GameSession): boolean {
  return session.spotsConfirmed >= session.spotsTotal;
}

export function needsMorePlayers(session: GameSession): boolean {
  return session.spotsConfirmed < session.minPlayers;
}

export function shouldAutoOpen(session: GameSession): boolean {
  return session.autoOpenOnDropout && session.visibility === 'group' && needsMorePlayers(session);
}

export function getWinningSlot(slots: TimeSlot[]): TimeSlot | null {
  if (slots.length === 0) return null;
  return slots.reduce((best, slot) => (slot.voteCount > best.voteCount ? slot : best));
}

export function getSessionDisplayStatus(session: GameSession): string {
  if (session.status === 'cancelled') return 'Cancelled';
  if (session.status === 'completed') return 'Completed';
  if (isSessionFull(session)) return 'Full';
  if (needsMorePlayers(session)) return `Need ${session.minPlayers - session.spotsConfirmed} more`;
  return `${session.spotsConfirmed}/${session.spotsTotal} confirmed`;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd Projects/ScoringApp && npx vitest run src/features/buddies/engine/__tests__/sessionHelpers.test.ts`
Expected: All 16 tests PASS

**Step 5: Commit**

```bash
git add src/features/buddies/engine/sessionHelpers.ts src/features/buddies/engine/__tests__/sessionHelpers.test.ts
git commit -m "feat(buddies): add session engine helper functions with tests"
```

---

### Task 3: Create group engine — pure helper functions

**Files:**
- Create: `src/features/buddies/engine/groupHelpers.ts`
- Create: `src/features/buddies/engine/__tests__/groupHelpers.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/features/buddies/engine/__tests__/groupHelpers.test.ts
import { describe, it, expect } from 'vitest';
import {
  canManageGroup,
  canJoinGroup,
  createDefaultSession,
  validateGroupName,
} from '../groupHelpers';
import type { BuddyGroup, BuddyGroupMember } from '../../../../data/types';

function makeGroup(overrides: Partial<BuddyGroup> = {}): BuddyGroup {
  return {
    id: 'g1',
    name: 'Test Group',
    description: 'A test group',
    createdBy: 'u1',
    defaultLocation: 'Park',
    defaultDay: 'tuesday',
    defaultTime: '18:00',
    memberCount: 3,
    visibility: 'private',
    shareCode: 'GRP123',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeMember(overrides: Partial<BuddyGroupMember> = {}): BuddyGroupMember {
  return {
    userId: 'u1',
    displayName: 'Test User',
    photoURL: null,
    role: 'member',
    joinedAt: Date.now(),
    ...overrides,
  };
}

describe('canManageGroup', () => {
  it('returns true for admin', () => {
    expect(canManageGroup(makeMember({ role: 'admin' }))).toBe(true);
  });

  it('returns false for regular member', () => {
    expect(canManageGroup(makeMember({ role: 'member' }))).toBe(false);
  });
});

describe('canJoinGroup', () => {
  it('returns true for public group when not a member', () => {
    const group = makeGroup({ visibility: 'public' });
    expect(canJoinGroup(group, false)).toBe(true);
  });

  it('returns false when already a member', () => {
    const group = makeGroup({ visibility: 'public' });
    expect(canJoinGroup(group, true)).toBe(false);
  });

  it('returns false for private group without share code', () => {
    const group = makeGroup({ visibility: 'private' });
    expect(canJoinGroup(group, false)).toBe(false);
  });

  it('returns true for private group with matching share code', () => {
    const group = makeGroup({ visibility: 'private', shareCode: 'GRP123' });
    expect(canJoinGroup(group, false, 'GRP123')).toBe(true);
  });

  it('returns false for private group with wrong share code', () => {
    const group = makeGroup({ visibility: 'private', shareCode: 'GRP123' });
    expect(canJoinGroup(group, false, 'WRONG')).toBe(false);
  });
});

describe('createDefaultSession', () => {
  it('pre-fills from group defaults', () => {
    const group = makeGroup({
      defaultLocation: 'Riverside Park',
      defaultDay: 'tuesday',
      defaultTime: '18:00',
    });
    const result = createDefaultSession(group);
    expect(result.location).toBe('Riverside Park');
    expect(result.groupId).toBe('g1');
  });

  it('uses empty string when no default location', () => {
    const group = makeGroup({ defaultLocation: null });
    const result = createDefaultSession(group);
    expect(result.location).toBe('');
  });
});

describe('validateGroupName', () => {
  it('returns null for valid name', () => {
    expect(validateGroupName('Tuesday Crew')).toBeNull();
  });

  it('returns error for empty name', () => {
    expect(validateGroupName('')).toBe('Group name is required');
  });

  it('returns error for whitespace-only name', () => {
    expect(validateGroupName('   ')).toBe('Group name is required');
  });

  it('returns error for name over 50 characters', () => {
    expect(validateGroupName('A'.repeat(51))).toBe('Group name must be 50 characters or less');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd Projects/ScoringApp && npx vitest run src/features/buddies/engine/__tests__/groupHelpers.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/features/buddies/engine/groupHelpers.ts
import type { BuddyGroup, BuddyGroupMember } from '../../../data/types';

export function canManageGroup(member: BuddyGroupMember): boolean {
  return member.role === 'admin';
}

export function canJoinGroup(group: BuddyGroup, isMember: boolean, shareCode?: string): boolean {
  if (isMember) return false;
  if (group.visibility === 'public') return true;
  if (shareCode && group.shareCode === shareCode) return true;
  return false;
}

export function createDefaultSession(group: BuddyGroup): { groupId: string; location: string } {
  return {
    groupId: group.id,
    location: group.defaultLocation ?? '',
  };
}

export function validateGroupName(name: string): string | null {
  if (!name.trim()) return 'Group name is required';
  if (name.length > 50) return 'Group name must be 50 characters or less';
  return null;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd Projects/ScoringApp && npx vitest run src/features/buddies/engine/__tests__/groupHelpers.test.ts`
Expected: All 9 tests PASS

**Step 5: Commit**

```bash
git add src/features/buddies/engine/groupHelpers.ts src/features/buddies/engine/__tests__/groupHelpers.test.ts
git commit -m "feat(buddies): add group engine helper functions with tests"
```

---

## Wave 2: Firestore Repositories

### Task 4: Create BuddyGroup repository

**Files:**
- Create: `src/data/firebase/firestoreBuddyGroupRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreBuddyGroupRepository.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/data/firebase/__tests__/firestoreBuddyGroupRepository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BuddyGroup, BuddyGroupMember } from '../../types';

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  increment: vi.fn((n: number) => ({ _increment: n })),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
}));

vi.mock('../config', () => ({
  firestore: {},
}));

import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, collectionGroup, query, where } from 'firebase/firestore';
import { firestoreBuddyGroupRepository } from '../firestoreBuddyGroupRepository';

beforeEach(() => {
  vi.clearAllMocks();
  (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] });
  (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ exists: () => false, data: () => null });
});

describe('firestoreBuddyGroupRepository', () => {
  const group: BuddyGroup = {
    id: 'g1',
    name: 'Tuesday Crew',
    description: 'Park regulars',
    createdBy: 'u1',
    defaultLocation: 'Riverside Park',
    defaultDay: 'tuesday',
    defaultTime: '18:00',
    memberCount: 0,
    visibility: 'private',
    shareCode: 'GRP123',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('creates a group document', async () => {
    await firestoreBuddyGroupRepository.create(group);
    expect(setDoc).toHaveBeenCalledOnce();
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'buddyGroups', 'g1');
  });

  it('adds a member to a group', async () => {
    const member: BuddyGroupMember = {
      userId: 'u2',
      displayName: 'Player 2',
      photoURL: null,
      role: 'member',
      joinedAt: Date.now(),
    };
    await firestoreBuddyGroupRepository.addMember('g1', member);
    expect(setDoc).toHaveBeenCalledOnce();
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'buddyGroups', 'g1', 'members', 'u2');
  });

  it('removes a member from a group', async () => {
    await firestoreBuddyGroupRepository.removeMember('g1', 'u2');
    expect(deleteDoc).toHaveBeenCalledOnce();
  });

  it('gets group by share code', async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      docs: [{ id: 'g1', data: () => group }],
    });
    const result = await firestoreBuddyGroupRepository.getByShareCode('GRP123');
    expect(result).toBeTruthy();
    expect(where).toHaveBeenCalledWith('shareCode', '==', 'GRP123');
  });

  it('gets groups for a user via collection group query', async () => {
    await firestoreBuddyGroupRepository.getGroupsForUser('u1');
    expect(collectionGroup).toHaveBeenCalledWith(expect.anything(), 'members');
    expect(where).toHaveBeenCalledWith('userId', '==', 'u1');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd Projects/ScoringApp && npx vitest run src/data/firebase/__tests__/firestoreBuddyGroupRepository.test.ts`
Expected: FAIL

**Step 3: Write the repository**

```typescript
// src/data/firebase/firestoreBuddyGroupRepository.ts
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, collectionGroup, query, where, increment, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { BuddyGroup, BuddyGroupMember } from '../types';

export const firestoreBuddyGroupRepository = {
  async create(group: BuddyGroup): Promise<void> {
    const ref = doc(firestore, 'buddyGroups', group.id);
    await setDoc(ref, { ...group, updatedAt: serverTimestamp() });
  },

  async get(groupId: string): Promise<BuddyGroup | null> {
    const snap = await getDoc(doc(firestore, 'buddyGroups', groupId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as BuddyGroup;
  },

  async update(groupId: string, data: Partial<BuddyGroup>): Promise<void> {
    const ref = doc(firestore, 'buddyGroups', groupId);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  },

  async delete(groupId: string): Promise<void> {
    await deleteDoc(doc(firestore, 'buddyGroups', groupId));
  },

  async getByShareCode(code: string): Promise<BuddyGroup | null> {
    const q = query(collection(firestore, 'buddyGroups'), where('shareCode', '==', code));
    const snap = await getDocs(q);
    if (snap.docs.length === 0) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as BuddyGroup;
  },

  async addMember(groupId: string, member: BuddyGroupMember): Promise<void> {
    const ref = doc(firestore, 'buddyGroups', groupId, 'members', member.userId);
    await setDoc(ref, member);
    await updateDoc(doc(firestore, 'buddyGroups', groupId), { memberCount: increment(1), updatedAt: serverTimestamp() });
  },

  async removeMember(groupId: string, userId: string): Promise<void> {
    await deleteDoc(doc(firestore, 'buddyGroups', groupId, 'members', userId));
    await updateDoc(doc(firestore, 'buddyGroups', groupId), { memberCount: increment(-1), updatedAt: serverTimestamp() });
  },

  async getMembers(groupId: string): Promise<BuddyGroupMember[]> {
    const snap = await getDocs(collection(firestore, 'buddyGroups', groupId, 'members'));
    return snap.docs.map((d) => d.data() as BuddyGroupMember);
  },

  async getMember(groupId: string, userId: string): Promise<BuddyGroupMember | null> {
    const snap = await getDoc(doc(firestore, 'buddyGroups', groupId, 'members', userId));
    if (!snap.exists()) return null;
    return snap.data() as BuddyGroupMember;
  },

  async getGroupsForUser(userId: string): Promise<string[]> {
    const q = query(collectionGroup(firestore, 'members'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.ref.parent.parent!.id);
  },
};
```

**Step 4: Run tests to verify they pass**

Run: `cd Projects/ScoringApp && npx vitest run src/data/firebase/__tests__/firestoreBuddyGroupRepository.test.ts`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreBuddyGroupRepository.ts src/data/firebase/__tests__/firestoreBuddyGroupRepository.test.ts
git commit -m "feat(buddies): add BuddyGroup Firestore repository with tests"
```

---

### Task 5: Create GameSession repository

**Files:**
- Create: `src/data/firebase/firestoreGameSessionRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreGameSessionRepository.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/data/firebase/__tests__/firestoreGameSessionRepository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameSession, SessionRsvp } from '../../types';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  increment: vi.fn((n: number) => ({ _increment: n })),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
}));

vi.mock('../config', () => ({
  firestore: {},
}));

import { setDoc, getDoc, getDocs, updateDoc, doc, where, orderBy } from 'firebase/firestore';
import { firestoreGameSessionRepository } from '../firestoreGameSessionRepository';

beforeEach(() => {
  vi.clearAllMocks();
  (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] });
  (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ exists: () => false, data: () => null });
});

describe('firestoreGameSessionRepository', () => {
  it('creates a session document', async () => {
    const session = { id: 's1', groupId: 'g1', title: 'Test' } as GameSession;
    await firestoreGameSessionRepository.create(session);
    expect(setDoc).toHaveBeenCalledOnce();
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'gameSessions', 's1');
  });

  it('gets sessions for a group', async () => {
    await firestoreGameSessionRepository.getByGroup('g1');
    expect(where).toHaveBeenCalledWith('groupId', '==', 'g1');
  });

  it('gets open sessions', async () => {
    await firestoreGameSessionRepository.getOpenSessions();
    expect(where).toHaveBeenCalledWith('visibility', '==', 'open');
  });

  it('submits an RSVP', async () => {
    const rsvp: SessionRsvp = {
      userId: 'u1',
      displayName: 'Test',
      photoURL: null,
      response: 'in',
      dayOfStatus: 'none',
      selectedSlotIds: [],
      respondedAt: Date.now(),
      statusUpdatedAt: null,
    };
    await firestoreGameSessionRepository.submitRsvp('s1', rsvp);
    expect(setDoc).toHaveBeenCalledOnce();
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'gameSessions', 's1', 'rsvps', 'u1');
  });

  it('updates day-of status', async () => {
    await firestoreGameSessionRepository.updateDayOfStatus('s1', 'u1', 'here');
    expect(updateDoc).toHaveBeenCalledOnce();
  });

  it('gets session by share code', async () => {
    await firestoreGameSessionRepository.getByShareCode('ABC123');
    expect(where).toHaveBeenCalledWith('shareCode', '==', 'ABC123');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd Projects/ScoringApp && npx vitest run src/data/firebase/__tests__/firestoreGameSessionRepository.test.ts`
Expected: FAIL

**Step 3: Write the repository**

```typescript
// src/data/firebase/firestoreGameSessionRepository.ts
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where, orderBy, increment, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { DayOfStatus, GameSession, RsvpResponse, SessionRsvp } from '../types';

export const firestoreGameSessionRepository = {
  async create(session: GameSession): Promise<void> {
    const ref = doc(firestore, 'gameSessions', session.id);
    await setDoc(ref, { ...session, updatedAt: serverTimestamp() });
  },

  async get(sessionId: string): Promise<GameSession | null> {
    const snap = await getDoc(doc(firestore, 'gameSessions', sessionId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as GameSession;
  },

  async update(sessionId: string, data: Partial<GameSession>): Promise<void> {
    const ref = doc(firestore, 'gameSessions', sessionId);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  },

  async delete(sessionId: string): Promise<void> {
    await deleteDoc(doc(firestore, 'gameSessions', sessionId));
  },

  async getByGroup(groupId: string): Promise<GameSession[]> {
    const q = query(
      collection(firestore, 'gameSessions'),
      where('groupId', '==', groupId),
      orderBy('scheduledDate', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GameSession);
  },

  async getOpenSessions(): Promise<GameSession[]> {
    const q = query(
      collection(firestore, 'gameSessions'),
      where('visibility', '==', 'open'),
      where('status', 'in', ['proposed', 'confirmed']),
      orderBy('scheduledDate', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GameSession);
  },

  async getByShareCode(code: string): Promise<GameSession | null> {
    const q = query(collection(firestore, 'gameSessions'), where('shareCode', '==', code));
    const snap = await getDocs(q);
    if (snap.docs.length === 0) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as GameSession;
  },

  async submitRsvp(sessionId: string, rsvp: SessionRsvp): Promise<void> {
    const ref = doc(firestore, 'gameSessions', sessionId, 'rsvps', rsvp.userId);
    await setDoc(ref, rsvp);
  },

  async getRsvps(sessionId: string): Promise<SessionRsvp[]> {
    const snap = await getDocs(collection(firestore, 'gameSessions', sessionId, 'rsvps'));
    return snap.docs.map((d) => d.data() as SessionRsvp);
  },

  async updateDayOfStatus(sessionId: string, userId: string, status: DayOfStatus): Promise<void> {
    const ref = doc(firestore, 'gameSessions', sessionId, 'rsvps', userId);
    await updateDoc(ref, { dayOfStatus: status, statusUpdatedAt: Date.now() });
  },

  async updateRsvpResponse(sessionId: string, userId: string, response: RsvpResponse, spotsIncrement: number): Promise<void> {
    const rsvpRef = doc(firestore, 'gameSessions', sessionId, 'rsvps', userId);
    await updateDoc(rsvpRef, { response, respondedAt: Date.now() });
    if (spotsIncrement !== 0) {
      const sessionRef = doc(firestore, 'gameSessions', sessionId);
      await updateDoc(sessionRef, { spotsConfirmed: increment(spotsIncrement), updatedAt: serverTimestamp() });
    }
  },
};
```

**Step 4: Run tests to verify they pass**

Run: `cd Projects/ScoringApp && npx vitest run src/data/firebase/__tests__/firestoreGameSessionRepository.test.ts`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreGameSessionRepository.ts src/data/firebase/__tests__/firestoreGameSessionRepository.test.ts
git commit -m "feat(buddies): add GameSession Firestore repository with tests"
```

---

### Task 6: Create BuddyNotification repository

**Files:**
- Create: `src/data/firebase/firestoreBuddyNotificationRepository.ts`
- Create: `src/data/firebase/__tests__/firestoreBuddyNotificationRepository.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/data/firebase/__tests__/firestoreBuddyNotificationRepository.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BuddyNotification } from '../../types';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn() })),
}));

vi.mock('../config', () => ({
  firestore: {},
}));

import { setDoc, getDocs, doc, where, orderBy } from 'firebase/firestore';
import { firestoreBuddyNotificationRepository } from '../firestoreBuddyNotificationRepository';

beforeEach(() => {
  vi.clearAllMocks();
  (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] });
});

describe('firestoreBuddyNotificationRepository', () => {
  it('creates a notification', async () => {
    const notif: BuddyNotification = {
      id: 'n1',
      userId: 'u1',
      type: 'session_proposed',
      sessionId: 's1',
      groupId: 'g1',
      actorName: 'Raj',
      message: 'Raj proposed a session',
      read: false,
      createdAt: Date.now(),
    };
    await firestoreBuddyNotificationRepository.create(notif);
    expect(setDoc).toHaveBeenCalledOnce();
  });

  it('gets unread notifications for a user', async () => {
    await firestoreBuddyNotificationRepository.getUnread('u1');
    expect(where).toHaveBeenCalledWith('read', '==', false);
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  });

  it('marks a notification as read', async () => {
    await firestoreBuddyNotificationRepository.markRead('u1', 'n1');
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'u1', 'buddyNotifications', 'n1');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd Projects/ScoringApp && npx vitest run src/data/firebase/__tests__/firestoreBuddyNotificationRepository.test.ts`
Expected: FAIL

**Step 3: Write the repository**

```typescript
// src/data/firebase/firestoreBuddyNotificationRepository.ts
import { doc, setDoc, getDocs, updateDoc, deleteDoc, collection, query, where, orderBy, limit, writeBatch, serverTimestamp } from 'firebase/firestore';
import { firestore } from './config';
import type { BuddyNotification } from '../types';

export const firestoreBuddyNotificationRepository = {
  async create(notification: BuddyNotification): Promise<void> {
    const ref = doc(firestore, 'users', notification.userId, 'buddyNotifications', notification.id);
    await setDoc(ref, notification);
  },

  async getUnread(userId: string): Promise<BuddyNotification[]> {
    const q = query(
      collection(firestore, 'users', userId, 'buddyNotifications'),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BuddyNotification);
  },

  async getAll(userId: string): Promise<BuddyNotification[]> {
    const q = query(
      collection(firestore, 'users', userId, 'buddyNotifications'),
      orderBy('createdAt', 'desc'),
      limit(100),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BuddyNotification);
  },

  async markRead(userId: string, notificationId: string): Promise<void> {
    const ref = doc(firestore, 'users', userId, 'buddyNotifications', notificationId);
    await updateDoc(ref, { read: true });
  },

  async markAllRead(userId: string): Promise<void> {
    const unread = await this.getUnread(userId);
    if (unread.length === 0) return;
    const batch = writeBatch(firestore);
    for (const n of unread) {
      const ref = doc(firestore, 'users', userId, 'buddyNotifications', n.id);
      batch.update(ref, { read: true });
    }
    await batch.commit();
  },
};
```

**Step 4: Run tests to verify they pass**

Run: `cd Projects/ScoringApp && npx vitest run src/data/firebase/__tests__/firestoreBuddyNotificationRepository.test.ts`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreBuddyNotificationRepository.ts src/data/firebase/__tests__/firestoreBuddyNotificationRepository.test.ts
git commit -m "feat(buddies): add BuddyNotification Firestore repository with tests"
```

---

### Task 7: Update Firestore security rules & indexes

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`

**Step 1: Add buddy group rules to `firestore.rules`**

After the tournament section (before the collection group rule for invitations), add:

```firestore
    // ── Buddy Groups (/buddyGroups/{groupId}) ─────────────────────────
    match /buddyGroups/{groupId} {

      // Public groups readable by anyone authenticated
      allow read: if request.auth != null
        && (resource.data.visibility == 'public'
            || exists(/databases/$(database)/documents/buddyGroups/$(groupId)/members/$(request.auth.uid)));

      // Any authenticated user can create a group
      allow create: if request.auth != null
        && request.resource.data.createdBy == request.auth.uid
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 50
        && request.resource.data.memberCount == 0
        && request.resource.data.visibility in ['private', 'public'];

      // Only admin can update group
      allow update: if request.auth != null
        && exists(/databases/$(database)/documents/buddyGroups/$(groupId)/members/$(request.auth.uid))
        && get(/databases/$(database)/documents/buddyGroups/$(groupId)/members/$(request.auth.uid)).data.role == 'admin'
        && request.resource.data.createdBy == resource.data.createdBy;

      // Only admin can delete
      allow delete: if request.auth != null
        && get(/databases/$(database)/documents/buddyGroups/$(groupId)/members/$(request.auth.uid)).data.role == 'admin';

      // ── Members (/buddyGroups/{gid}/members/{userId}) ──────────
      match /members/{userId} {
        // Any group member can read members list
        allow read: if request.auth != null
          && exists(/databases/$(database)/documents/buddyGroups/$(groupId)/members/$(request.auth.uid));

        // Admin can add anyone; user can add themselves
        allow create: if request.auth != null
          && (request.auth.uid == userId
              || get(/databases/$(database)/documents/buddyGroups/$(groupId)/members/$(request.auth.uid)).data.role == 'admin')
          && request.resource.data.userId == userId;

        // Admin can remove anyone; user can remove themselves
        allow delete: if request.auth != null
          && (request.auth.uid == userId
              || get(/databases/$(database)/documents/buddyGroups/$(groupId)/members/$(request.auth.uid)).data.role == 'admin');
      }
    }

    // ── Game Sessions (/gameSessions/{sessionId}) ────────────────────
    match /gameSessions/{sessionId} {

      // Open sessions are readable by anyone authenticated
      allow read: if request.auth != null
        && (resource.data.visibility == 'open'
            || (resource.data.groupId != null
                && exists(/databases/$(database)/documents/buddyGroups/$(resource.data.groupId)/members/$(request.auth.uid))));

      // Any authenticated user can create (standalone or in their group)
      allow create: if request.auth != null
        && request.resource.data.createdBy == request.auth.uid
        && request.resource.data.status == 'proposed'
        && request.resource.data.spotsConfirmed == 0;

      // Creator can update session fields
      allow update: if request.auth != null
        && resource.data.createdBy == request.auth.uid
        && request.resource.data.createdBy == resource.data.createdBy;

      // Creator can delete
      allow delete: if request.auth != null
        && resource.data.createdBy == request.auth.uid;

      // ── RSVPs (/gameSessions/{sid}/rsvps/{userId}) ─────────────
      match /rsvps/{userId} {
        // Anyone who can read session can read RSVPs
        allow read: if request.auth != null;

        // Users can create/update/delete their own RSVP
        allow create: if request.auth != null && request.auth.uid == userId
          && request.resource.data.userId == userId;
        allow update: if request.auth != null && request.auth.uid == userId;
        allow delete: if request.auth != null && request.auth.uid == userId;
      }
    }

    // ── Buddy Notifications (/users/{userId}/buddyNotifications/{nid}) ─
    match /users/{userId}/buddyNotifications/{notifId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }

    // ── Collection Group: Members (for "my groups" query) ──────────────
    match /{path=**}/members/{userId} {
      allow read: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }
```

**Step 2: Add composite indexes to `firestore.indexes.json`**

Add to the `indexes` array:

```json
{
  "collectionGroup": "gameSessions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "groupId", "order": "ASCENDING" },
    { "fieldPath": "scheduledDate", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "gameSessions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "visibility", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "scheduledDate", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "gameSessions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "createdBy", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "buddyGroups",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "visibility", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**Step 3: Verify TypeScript still compiles**

Run: `cd Projects/ScoringApp && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add firestore.rules firestore.indexes.json
git commit -m "feat(buddies): add Firestore security rules and indexes for Player Buddies"
```

---

## Wave 3: SolidJS Hooks (Real-time Data)

### Task 8: Create useBuddyGroups hook

**Files:**
- Create: `src/features/buddies/hooks/useBuddyGroups.ts`

**Step 1: Write the hook**

```typescript
// src/features/buddies/hooks/useBuddyGroups.ts
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { collection, collectionGroup, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { BuddyGroup } from '../../../data/types';

export function useBuddyGroups(userId: () => string | undefined) {
  const [groups, setGroups] = createSignal<BuddyGroup[]>([]);
  const [loading, setLoading] = createSignal(true);

  let unsubscribe: (() => void) | null = null;

  createEffect(() => {
    const uid = userId();
    if (!uid) {
      unsubscribe?.();
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Listen to membership changes via collection group
    const q = query(collectionGroup(firestore, 'members'), where('userId', '==', uid));
    unsubscribe = onSnapshot(q, async (snapshot) => {
      const groupIds = snapshot.docs.map((d) => d.ref.parent.parent!.id);
      if (groupIds.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // Fetch group docs
      const groupDocs = await Promise.all(
        groupIds.map((id) => getDoc(doc(firestore, 'buddyGroups', id))),
      );
      const result = groupDocs
        .filter((d) => d.exists())
        .map((d) => ({ id: d.id, ...d.data() }) as BuddyGroup);
      setGroups(result);
      setLoading(false);
    });
  });

  onCleanup(() => unsubscribe?.());

  return { groups, loading };
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd Projects/ScoringApp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/buddies/hooks/useBuddyGroups.ts
git commit -m "feat(buddies): add useBuddyGroups real-time hook"
```

---

### Task 9: Create useGameSession hook

**Files:**
- Create: `src/features/buddies/hooks/useGameSession.ts`

**Step 1: Write the hook**

```typescript
// src/features/buddies/hooks/useGameSession.ts
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { GameSession, SessionRsvp } from '../../../data/types';

export function useGameSession(sessionId: () => string | undefined) {
  const [session, setSession] = createSignal<GameSession | null>(null);
  const [rsvps, setRsvps] = createSignal<SessionRsvp[]>([]);
  const [loading, setLoading] = createSignal(true);

  const unsubs: (() => void)[] = [];

  createEffect(() => {
    const sid = sessionId();
    unsubs.forEach((u) => u());
    unsubs.length = 0;

    if (!sid) {
      setSession(null);
      setRsvps([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Listen to session doc
    unsubs.push(
      onSnapshot(doc(firestore, 'gameSessions', sid), (snap) => {
        if (snap.exists()) {
          setSession({ id: snap.id, ...snap.data() } as GameSession);
        } else {
          setSession(null);
        }
        setLoading(false);
      }),
    );

    // Listen to RSVPs sub-collection
    unsubs.push(
      onSnapshot(collection(firestore, 'gameSessions', sid, 'rsvps'), (snap) => {
        setRsvps(snap.docs.map((d) => d.data() as SessionRsvp));
      }),
    );
  });

  onCleanup(() => unsubs.forEach((u) => u()));

  return { session, rsvps, loading };
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd Projects/ScoringApp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/buddies/hooks/useGameSession.ts
git commit -m "feat(buddies): add useGameSession real-time hook"
```

---

### Task 10: Create useBuddyNotifications hook

**Files:**
- Create: `src/features/buddies/hooks/useBuddyNotifications.ts`

**Step 1: Write the hook**

```typescript
// src/features/buddies/hooks/useBuddyNotifications.ts
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { BuddyNotification } from '../../../data/types';

export function useBuddyNotifications(userId: () => string | undefined) {
  const [notifications, setNotifications] = createSignal<BuddyNotification[]>([]);
  const [unreadCount, setUnreadCount] = createSignal(0);

  let unsubscribe: (() => void) | null = null;

  createEffect(() => {
    const uid = userId();
    unsubscribe?.();

    if (!uid) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(firestore, 'users', uid, 'buddyNotifications'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    unsubscribe = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BuddyNotification);
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    });
  });

  onCleanup(() => unsubscribe?.());

  return { notifications, unreadCount };
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd Projects/ScoringApp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/buddies/hooks/useBuddyNotifications.ts
git commit -m "feat(buddies): add useBuddyNotifications real-time hook"
```

---

## Wave 4: Core UI — Pages & Routing

### Task 11: Create BuddiesPage (group list)

**Files:**
- Create: `src/features/buddies/BuddiesPage.tsx`

**Step 1: Write the component**

```typescript
// src/features/buddies/BuddiesPage.tsx
import { Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { useAuth } from '../../shared/hooks/useAuth';
import { useBuddyGroups } from './hooks/useBuddyGroups';
import type { BuddyGroup } from '../../data/types';

function GroupCard(props: { group: BuddyGroup }) {
  return (
    <A href={`/buddies/${props.group.id}`} class="block bg-surface-light rounded-2xl p-4 active:scale-[0.98] transition-transform">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-on-surface text-lg">{props.group.name}</h3>
          <p class="text-on-surface-muted text-sm mt-0.5">{props.group.description}</p>
        </div>
        <div class="flex items-center gap-1 text-on-surface-muted text-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span>{props.group.memberCount}</span>
        </div>
      </div>
      <Show when={props.group.defaultLocation}>
        <p class="text-on-surface-muted text-xs mt-2 flex items-center gap-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          {props.group.defaultLocation}
        </p>
      </Show>
    </A>
  );
}

const BuddiesPage: Component = () => {
  const { user } = useAuth();
  const { groups, loading } = useBuddyGroups(() => user()?.uid);

  return (
    <div class="max-w-lg mx-auto px-4 pt-4 pb-24">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-on-surface font-display">Buddies</h1>
        <A href="/buddies/new" class="bg-primary text-surface px-4 py-2 rounded-xl font-semibold text-sm active:scale-95 transition-transform">
          + New Group
        </A>
      </div>

      <Show when={!loading()} fallback={
        <div class="space-y-3">
          <For each={[1, 2, 3]}>
            {() => <div class="bg-surface-light rounded-2xl h-24 animate-pulse" />}
          </For>
        </div>
      }>
        <Show when={groups().length > 0} fallback={
          <div class="text-center py-16">
            <div class="text-5xl mb-4">🏓</div>
            <h2 class="text-lg font-bold text-on-surface mb-2">No groups yet</h2>
            <p class="text-on-surface-muted text-sm mb-6">Create a group to start organizing games with your crew</p>
            <A href="/buddies/new" class="inline-block bg-primary text-surface px-6 py-3 rounded-xl font-semibold active:scale-95 transition-transform">
              Create Your First Group
            </A>
          </div>
        }>
          <div class="space-y-3">
            <For each={groups()}>
              {(group) => <GroupCard group={group} />}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default BuddiesPage;
```

**Step 2: Verify TypeScript compiles**

Run: `cd Projects/ScoringApp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/buddies/BuddiesPage.tsx
git commit -m "feat(buddies): add BuddiesPage with group list, loading skeleton, and empty state"
```

---

### Task 12: Create CreateGroupPage

**Files:**
- Create: `src/features/buddies/CreateGroupPage.tsx`

**Step 1: Write the component**

```typescript
// src/features/buddies/CreateGroupPage.tsx
import { createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreBuddyGroupRepository } from '../../data/firebase/firestoreBuddyGroupRepository';
import { generateShareCode } from '../tournaments/engine/shareCode';
import { validateGroupName } from './engine/groupHelpers';
import type { BuddyGroup, BuddyGroupMember } from '../../data/types';

const CreateGroupPage: Component = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [defaultLocation, setDefaultLocation] = createSignal('');
  const [defaultDay, setDefaultDay] = createSignal('');
  const [defaultTime, setDefaultTime] = createSignal('');
  const [visibility, setVisibility] = createSignal<'private' | 'public'>('private');
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const nameErr = validateGroupName(name());
    if (nameErr) { setError(nameErr); return; }

    const u = user();
    if (!u) return;

    setSaving(true);
    setError('');

    const groupId = crypto.randomUUID();
    const group: BuddyGroup = {
      id: groupId,
      name: name().trim(),
      description: description().trim(),
      createdBy: u.uid,
      defaultLocation: defaultLocation().trim() || null,
      defaultDay: defaultDay() || null,
      defaultTime: defaultTime() || null,
      memberCount: 0,
      visibility: visibility(),
      shareCode: generateShareCode(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const member: BuddyGroupMember = {
      userId: u.uid,
      displayName: u.displayName ?? 'Player',
      photoURL: u.photoURL ?? null,
      role: 'admin',
      joinedAt: Date.now(),
    };

    try {
      await firestoreBuddyGroupRepository.create(group);
      await firestoreBuddyGroupRepository.addMember(groupId, member);
      navigate(`/buddies/${groupId}`);
    } catch {
      setError('Failed to create group. Please try again.');
      setSaving(false);
    }
  };

  const days = [
    { value: '', label: 'No fixed day' },
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
  ];

  return (
    <div class="max-w-lg mx-auto px-4 pt-4 pb-24">
      <h1 class="text-2xl font-bold text-on-surface font-display mb-6">New Group</h1>

      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-on-surface mb-1">Group Name *</label>
          <input
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="Tuesday Evening Crew"
            class="w-full bg-surface-light text-on-surface rounded-xl px-4 py-3 border border-surface-lighter focus:border-primary focus:outline-none"
            maxLength={50}
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-on-surface mb-1">Description</label>
          <input
            type="text"
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            placeholder="We play at Riverside Park"
            class="w-full bg-surface-light text-on-surface rounded-xl px-4 py-3 border border-surface-lighter focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-on-surface mb-1">Default Location</label>
          <input
            type="text"
            value={defaultLocation()}
            onInput={(e) => setDefaultLocation(e.currentTarget.value)}
            placeholder="Riverside Park Courts"
            class="w-full bg-surface-light text-on-surface rounded-xl px-4 py-3 border border-surface-lighter focus:border-primary focus:outline-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-on-surface mb-1">Regular Day</label>
            <select
              value={defaultDay()}
              onChange={(e) => setDefaultDay(e.currentTarget.value)}
              class="w-full bg-surface-light text-on-surface rounded-xl px-4 py-3 border border-surface-lighter focus:border-primary focus:outline-none"
            >
              {days.map((d) => <option value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-on-surface mb-1">Regular Time</label>
            <input
              type="time"
              value={defaultTime()}
              onInput={(e) => setDefaultTime(e.currentTarget.value)}
              class="w-full bg-surface-light text-on-surface rounded-xl px-4 py-3 border border-surface-lighter focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-on-surface mb-1">Visibility</label>
          <div class="flex gap-3">
            <button
              type="button"
              onClick={() => setVisibility('private')}
              class={`flex-1 py-3 rounded-xl font-medium text-sm border transition-colors ${visibility() === 'private' ? 'bg-primary text-surface border-primary' : 'bg-surface-light text-on-surface-muted border-surface-lighter'}`}
            >
              Private
            </button>
            <button
              type="button"
              onClick={() => setVisibility('public')}
              class={`flex-1 py-3 rounded-xl font-medium text-sm border transition-colors ${visibility() === 'public' ? 'bg-primary text-surface border-primary' : 'bg-surface-light text-on-surface-muted border-surface-lighter'}`}
            >
              Public
            </button>
          </div>
          <p class="text-xs text-on-surface-muted mt-1">
            {visibility() === 'private' ? 'Only people with the invite link can join' : 'Anyone can discover and join this group'}
          </p>
        </div>

        {error() && <p class="text-red-400 text-sm">{error()}</p>}

        <button
          type="submit"
          disabled={saving()}
          class="w-full bg-primary text-surface font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {saving() ? 'Creating...' : 'Create Group'}
        </button>
      </form>
    </div>
  );
};

export default CreateGroupPage;
```

**Step 2: Verify TypeScript compiles**

Run: `cd Projects/ScoringApp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/features/buddies/CreateGroupPage.tsx
git commit -m "feat(buddies): add CreateGroupPage with form, validation, and Firestore create"
```

---

### Task 13: Create GroupDetailPage

**Files:**
- Create: `src/features/buddies/GroupDetailPage.tsx`

This is a larger component. It shows group members, upcoming sessions, and has a "New Session" button. The full implementation should include:

- Group header (name, description, member count, share button)
- Members section (avatar row)
- Upcoming sessions list with inline RSVP buttons
- FAB for "New Session"
- Past sessions (collapsed)

**Step 1: Write the component**

The component uses `useParams` to get the groupId, then:
- Fetches group doc via `firestoreBuddyGroupRepository.get()`
- Listens to members via `onSnapshot` on the members sub-collection
- Listens to sessions via `onSnapshot` on gameSessions filtered by groupId
- Renders group header, members, sessions

_Full code: Build this following the exact patterns from BuddiesPage (Show/For, class not className, no destructured props). Use `createResource` for the initial group fetch, `onSnapshot` for real-time members and sessions. Include share button that copies the group invite link (`/g/{shareCode}`) to clipboard._

**Step 2: Verify TypeScript compiles**

Run: `cd Projects/ScoringApp && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/features/buddies/GroupDetailPage.tsx
git commit -m "feat(buddies): add GroupDetailPage with members, sessions, and share link"
```

---

### Task 14: Create SessionDetailPage

**Files:**
- Create: `src/features/buddies/SessionDetailPage.tsx`

Shows the session detail view with:
- Session header (title, date/time, location)
- Spots tracker ("4 of 8 confirmed") with avatar pills
- RSVP buttons (In / Out / Maybe) for simple style
- Time-slot voting grid for voting style
- Day-of status buttons (when session is confirmed and it's game day)
- Who's playing list with color-coded statuses
- Share button
- "Open to community" toggle (for creator)

**Step 1: Write the component**

Uses `useGameSession` hook for real-time data. RSVP tap calls `firestoreGameSessionRepository.submitRsvp()`. Day-of status tap calls `firestoreGameSessionRepository.updateDayOfStatus()`.

_Full code: Follow existing component patterns. Key interaction: RSVP buttons should be one-tap inline (not modals). Use WAAPI for button press animations. Color code statuses: green (here), blue (on-my-way), amber (maybe), gray (out/can't-make-it)._

**Step 2: Verify TypeScript compiles**

Run: `cd Projects/ScoringApp && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/features/buddies/SessionDetailPage.tsx
git commit -m "feat(buddies): add SessionDetailPage with RSVP, voting, day-of status, and sharing"
```

---

### Task 15: Create CreateSessionPage

**Files:**
- Create: `src/features/buddies/CreateSessionPage.tsx`

Session creation form that:
- Pre-fills from group defaults (location, calculates next occurrence of defaultDay)
- Lets user toggle between "Simple RSVP" and "Find a time" modes
- Simple mode: pick date + time
- Voting mode: add 2-4 time slots
- Set courts, spots, min players
- Auto-open on dropout toggle

**Step 1: Write the component**

_Full code: Two-mode form controlled by `rsvpStyle` signal. Pre-fill logic from `createDefaultSession()` helper. Time slot editor: add/remove slots with date + start/end time inputs. Submit creates GameSession via `firestoreGameSessionRepository.create()` with `generateShareCode()`._

**Step 2: Verify TypeScript compiles**

Run: `cd Projects/ScoringApp && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/features/buddies/CreateSessionPage.tsx
git commit -m "feat(buddies): add CreateSessionPage with simple RSVP and time-slot voting modes"
```

---

### Task 16: Wire up routes and BottomNav

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/shared/components/BottomNav.tsx`

**Step 1: Add routes to `router.tsx`**

Add lazy imports at the top:

```typescript
const BuddiesPage = lazy(() => import('../features/buddies/BuddiesPage'));
const CreateGroupPage = lazy(() => import('../features/buddies/CreateGroupPage'));
const GroupDetailPage = lazy(() => import('../features/buddies/GroupDetailPage'));
const CreateSessionPage = lazy(() => import('../features/buddies/CreateSessionPage'));
const SessionDetailPage = lazy(() => import('../features/buddies/SessionDetailPage'));
const PublicSessionPage = lazy(() => import('../features/buddies/PublicSessionPage'));
const GroupInvitePage = lazy(() => import('../features/buddies/GroupInvitePage'));
const OpenPlayPage = lazy(() => import('../features/buddies/OpenPlayPage'));
```

Add routes (before the settings route):

```typescript
<Route path="/buddies" component={RequireAuth}>
  <Route path="/" component={BuddiesPage} />
  <Route path="/new" component={CreateGroupPage} />
  <Route path="/:groupId" component={GroupDetailPage} />
  <Route path="/:groupId/session/new" component={CreateSessionPage} />
</Route>
<Route path="/session/:sessionId" component={RequireAuth}>
  <Route path="/" component={SessionDetailPage} />
</Route>
<Route path="/play" component={RequireAuth}>
  <Route path="/" component={OpenPlayPage} />
</Route>
<Route path="/s/:code" component={PublicSessionPage} />
<Route path="/g/:code" component={GroupInvitePage} />
```

**Step 2: Add Buddies tab to `BottomNav.tsx`**

After the Tournaments tab `</Show>`, add:

```typescript
<Show when={user()}>
  <A href="/buddies" class={linkClass('/buddies')} aria-current={isActive('/buddies') ? 'page' : undefined} aria-label="Buddies">
    <Show when={isActive('/buddies')}>
      <div class="absolute inset-x-1 top-0.5 bottom-0.5 bg-primary/10 rounded-xl" style={{ animation: 'nav-pill-in 200ms ease-out' }} />
    </Show>
    <svg aria-hidden="true" class="relative w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
    <span class="relative">Buddies</span>
  </A>
</Show>
```

**Step 3: Verify TypeScript compiles**

Run: `cd Projects/ScoringApp && npx tsc --noEmit`
Expected: May fail if PublicSessionPage, GroupInvitePage, or OpenPlayPage don't exist yet — create minimal stubs first.

**Step 4: Create stub pages for remaining routes**

Create minimal placeholder components for `PublicSessionPage`, `GroupInvitePage`, and `OpenPlayPage` so routing compiles. These will be fleshed out in later waves.

**Step 5: Commit**

```bash
git add src/app/router.tsx src/shared/components/BottomNav.tsx src/features/buddies/PublicSessionPage.tsx src/features/buddies/GroupInvitePage.tsx src/features/buddies/OpenPlayPage.tsx
git commit -m "feat(buddies): wire up routes and add Buddies tab to BottomNav"
```

---

## Wave 5: Open Play & Sharing

### Task 17: Build OpenPlayPage

**Files:**
- Modify: `src/features/buddies/OpenPlayPage.tsx` (replace stub)

Shows open sessions from the community. Lists sessions where `visibility === 'open'` and `status` is `proposed` or `confirmed`. Includes a "Create Open Session" button for standalone sessions (no group).

**Step 1: Write the component**

Uses `firestoreGameSessionRepository.getOpenSessions()` or a real-time `onSnapshot` query. Renders session cards with location, date, spots tracker, and "Join" button.

**Step 2: Verify TypeScript compiles, then commit**

```bash
git add src/features/buddies/OpenPlayPage.tsx
git commit -m "feat(buddies): build OpenPlayPage with community session discovery"
```

---

### Task 18: Build PublicSessionPage (share link landing)

**Files:**
- Modify: `src/features/buddies/PublicSessionPage.tsx` (replace stub)

Public page at `/s/:code` — viewable without auth. Shows session details, spots tracker, who's playing. CTA button: "Join on PickleScore" which triggers sign-in then redirects to the session detail page.

**Step 1: Write the component**

Uses `useParams().code` to call `firestoreGameSessionRepository.getByShareCode()`. No auth required for viewing. RSVP requires sign-in.

**Step 2: Verify, then commit**

```bash
git add src/features/buddies/PublicSessionPage.tsx
git commit -m "feat(buddies): build PublicSessionPage for shareable session links"
```

---

### Task 19: Build GroupInvitePage (group share link landing)

**Files:**
- Modify: `src/features/buddies/GroupInvitePage.tsx` (replace stub)

Public page at `/g/:code` — shows group info and "Join Group" CTA. Requires sign-in to join.

**Step 1: Write the component**

Uses `firestoreBuddyGroupRepository.getByShareCode()` to load group. Join button adds user as member.

**Step 2: Verify, then commit**

```bash
git add src/features/buddies/GroupInvitePage.tsx
git commit -m "feat(buddies): build GroupInvitePage for group invite links"
```

---

### Task 20: Add share sheet component

**Files:**
- Create: `src/features/buddies/components/ShareSheet.tsx`

Reusable share sheet with:
- Copy link button
- Share to WhatsApp button (using `https://wa.me/?text=...` URL)
- Native share (Web Share API with fallback)

**Step 1: Write the component**

```typescript
// Props: { url: string; text: string; onClose: () => void }
// Three buttons: Copy, WhatsApp, Share (if navigator.share available)
```

**Step 2: Verify, then commit**

```bash
git add src/features/buddies/components/ShareSheet.tsx
git commit -m "feat(buddies): add ShareSheet component with copy, WhatsApp, and native share"
```

---

## Wave 6: Notifications

### Task 21: Create notification trigger helpers

**Files:**
- Create: `src/features/buddies/engine/notificationHelpers.ts`
- Create: `src/features/buddies/engine/__tests__/notificationHelpers.test.ts`

Pure functions that create `BuddyNotification` objects for each trigger type. These are called by the UI actions (session creation, RSVP, etc.) and then saved via the notification repo.

**Step 1: Write failing tests for notification creation helpers**

Test that `createSessionProposedNotification()`, `createSpotOpenedNotification()`, etc. return correctly structured `BuddyNotification` objects.

**Step 2: Write the implementations**

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git add src/features/buddies/engine/notificationHelpers.ts src/features/buddies/engine/__tests__/notificationHelpers.test.ts
git commit -m "feat(buddies): add notification trigger helper functions with tests"
```

---

### Task 22: Wire notifications into session actions

**Files:**
- Modify: `src/features/buddies/SessionDetailPage.tsx`
- Modify: `src/features/buddies/CreateSessionPage.tsx`

After creating a session, send `session_proposed` notifications to all group members. After RSVP changes that fill spots, send `session_confirmed`. After a bail-out that opens a spot, send `spot_opened` to the creator.

**Step 1: Add notification calls after Firestore writes**

**Step 2: Verify manually, then commit**

```bash
git add src/features/buddies/SessionDetailPage.tsx src/features/buddies/CreateSessionPage.tsx
git commit -m "feat(buddies): wire notification triggers into session creation and RSVP actions"
```

---

### Task 23: Add notification badge to BottomNav

**Files:**
- Modify: `src/shared/components/BottomNav.tsx`

Add unread count badge to the Buddies tab icon using `useBuddyNotifications` hook.

**Step 1: Import hook and render badge**

Small red dot or count badge positioned absolute on the Buddies nav icon.

**Step 2: Verify, then commit**

```bash
git add src/shared/components/BottomNav.tsx
git commit -m "feat(buddies): add notification badge to Buddies tab in BottomNav"
```

---

## Wave 7: UX Polish

### Task 24: Add RSVP animations and haptics

**Files:**
- Modify: `src/features/buddies/SessionDetailPage.tsx`

Add WAAPI animations on RSVP button tap (scale pulse, color transition). Add haptic feedback via `navigator.vibrate(10)`. Match the existing scoring experience feel.

**Step 1: Add animations**

Use the same pattern as score animations in the scoring feature:
- Button scale: `element.animate([{ transform: 'scale(0.95)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 200 })`
- Avatar slide-in when new RSVP appears

**Step 2: Verify visually, then commit**

```bash
git add src/features/buddies/SessionDetailPage.tsx
git commit -m "feat(buddies): add RSVP animations and haptic feedback"
```

---

### Task 25: Add celebration when all spots fill

**Files:**
- Modify: `src/features/buddies/SessionDetailPage.tsx`

When `spotsConfirmed === spotsTotal`, trigger a celebration (confetti or similar animation). Reuse the existing confetti pattern from match completion if available.

**Step 1: Add confetti trigger on spots full**

**Step 2: Verify visually, then commit**

```bash
git add src/features/buddies/SessionDetailPage.tsx
git commit -m "feat(buddies): add celebration animation when all session spots are filled"
```

---

### Task 26: Add smooth page transitions

**Files:**
- Modify relevant page components

Use `solid-transition-group` for page enter/exit transitions, matching the existing app patterns.

**Step 1: Wrap page content in transition components**

**Step 2: Verify visually, then commit**

```bash
git commit -m "feat(buddies): add smooth page transitions for buddies pages"
```

---

### Task 27: Color-coded status avatars

**Files:**
- Create: `src/features/buddies/components/StatusAvatar.tsx`

Reusable avatar component with color ring based on day-of status:
- Green ring: `here`
- Blue ring: `on-my-way`
- Amber ring: `maybe`
- Gray ring: `out` / `cant-make-it`
- No ring: `in` (confirmed, no day-of update yet)

**Step 1: Write the component**

**Step 2: Use in SessionDetailPage, then commit**

```bash
git add src/features/buddies/components/StatusAvatar.tsx
git commit -m "feat(buddies): add StatusAvatar component with color-coded status rings"
```

---

## Wave 8: Integration Testing & Cleanup

### Task 28: Run full test suite

**Step 1: Run all tests**

Run: `cd Projects/ScoringApp && npx vitest run`
Expected: All existing tests + new buddies tests pass

**Step 2: Fix any failures**

**Step 3: Commit if fixes needed**

---

### Task 29: Run TypeScript check

**Step 1: Full type check**

Run: `cd Projects/ScoringApp && npx tsc --noEmit`
Expected: No errors

---

### Task 30: Build check

**Step 1: Production build**

Run: `cd Projects/ScoringApp && npx vite build`
Expected: Build succeeds

---

### Task 31: Deploy Firestore rules and indexes

**Step 1: Deploy to Firebase emulator for testing**

Run: `cd Projects/ScoringApp && npx firebase deploy --only firestore:rules,firestore:indexes`

_Or test against emulator if available._

**Step 2: Commit any adjustments**

---

### Task 32: Final commit and summary

**Step 1: Verify all tests pass**

Run: `cd Projects/ScoringApp && npx vitest run`

**Step 2: Verify build succeeds**

Run: `cd Projects/ScoringApp && npx vite build`

**Step 3: Final commit if needed, then summarize**

```bash
git log --oneline feature/player-buddies ^main
```

---

## Summary

| Wave | Tasks | What it delivers |
|------|-------|------------------|
| **1: Data & Engine** | 1-3 | Types, session helpers, group helpers (all with tests) |
| **2: Repositories** | 4-7 | Firestore CRUD for groups, sessions, notifications + security rules |
| **3: Hooks** | 8-10 | Real-time data hooks for groups, sessions, notifications |
| **4: Core UI** | 11-16 | BuddiesPage, CreateGroup, GroupDetail, SessionDetail, CreateSession, routing, BottomNav |
| **5: Open Play & Sharing** | 17-20 | OpenPlayPage, public session/group pages, share sheet |
| **6: Notifications** | 21-23 | Notification helpers, wiring, badge on nav |
| **7: UX Polish** | 24-27 | Animations, haptics, celebrations, transitions, status avatars |
| **8: Integration** | 28-32 | Full test suite, type check, build, deploy rules |

**Total: 32 tasks across 8 waves.**
