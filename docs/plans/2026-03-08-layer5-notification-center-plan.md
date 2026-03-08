# Layer 5: In-App Notification Center — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified in-app notification center with a bell icon dropdown in TopNav, consolidating buddy notifications, tournament invitations, achievements, and stats changes into a single system with ~120 tests.

**Architecture:** Module-level SolidJS signal store (like achievementStore.ts) with Firestore `onSnapshot` listener on `users/{uid}/notifications/{id}`. Dropdown panel mirrors the existing TopNav avatar dropdown pattern. Security rules enforce group membership for buddy notifications and organizer checks for tournament notifications. Achievement/stats are self-write. Client-side preference filtering via `createMemo`.

**Tech Stack:** SolidJS 1.9, TypeScript, Firestore, Dexie.js, Tailwind CSS v4, Vitest, Playwright

**Design doc:** `docs/plans/2026-03-08-layer5-notification-center-design.md`

**Revision notes:** Revised after 3 specialist reviews (architecture, TDD, codebase fit). Key changes from v1:
- Fixed all `actionUrl` routes to match actual router config
- Added missing write-site migration task (CreateSessionPage, SessionDetailPage)
- Added Settings UI notification preferences task
- Fixed BottomNav to use category-specific `buddyUnreadCount` (not global count)
- Added tests to Tasks 1, 5, 10, 13 (TDD discipline for every task)
- Moved security rules earlier (Task 3 → fail fast on riskiest piece)
- Added `expiresAt is number` validation to all security rules
- Provided security rules test skeleton with representative examples
- Fixed `makeSnapshotDocs` mock to exclude `id` from `data()` (matches real Firestore)
- Fixed hardcoded hex colors → Tailwind theme tokens
- Fixed `firestore.indexes.json` to append (not overwrite existing 14 indexes)
- Removed `actorId: undefined` (Firestore drops undefined fields)
- Added `buddyUnreadCount` derived signal for BottomNav
- Documented `player_joined` / `voting_reminder` removal decisions

---

## Actual Routes (from `src/app/router.tsx`)

Reference for all `actionUrl` values:

| Destination | Route |
|-------------|-------|
| Session detail | `/session/{sessionId}` |
| Group detail | `/buddies/{groupId}` |
| Tournament dashboard | `/tournaments/{id}` |
| Profile | `/profile` |

---

## Task 1: AppNotification Types + Settings Defaults

**Files:**
- Modify: `src/data/types.ts` (add after BuddyNotification, ~line 433)
- Modify: `src/stores/settingsStore.ts`
- Create: `src/stores/__tests__/settingsStore.notify.test.ts`

**Step 1: Write the failing test**

Create `src/stores/__tests__/settingsStore.notify.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('settingsStore notification defaults', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('settings() includes notification preferences with true defaults', async () => {
    const { settings } = await import('../settingsStore');
    const s = settings();
    expect(s.notifyBuddy).toBe(true);
    expect(s.notifyTournament).toBe(true);
    expect(s.notifyAchievement).toBe(true);
    expect(s.notifyStats).toBe(true);
  });

  it('existing localStorage without notify fields gets defaults merged in', async () => {
    localStorage.setItem('pickle-score-settings', JSON.stringify({
      defaultScoringMode: 'rally',
    }));
    const { settings } = await import('../settingsStore');
    const s = settings();
    expect(s.defaultScoringMode).toBe('rally');
    expect(s.notifyBuddy).toBe(true);
    expect(s.notifyTournament).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/stores/__tests__/settingsStore.notify.test.ts
```

Expected: FAIL — `notifyBuddy` is undefined

**Step 3: Add types to `src/data/types.ts`**

Add after the `BuddyNotification` interface (line 433):

```typescript
// --- Unified Notification types (Layer 5) ---

export type NotificationCategory = 'buddy' | 'tournament' | 'achievement' | 'stats';

export type NotificationType =
  | 'session_proposed'
  | 'session_confirmed'
  | 'session_cancelled'
  | 'session_reminder'
  | 'spot_opened'
  | 'group_invite'
  | 'tournament_invitation'
  | 'match_upcoming'
  | 'match_result_recorded'
  | 'achievement_unlocked'
  | 'tier_up'
  | 'tier_down';

export interface NotificationPayload {
  sessionId?: string;
  groupId?: string;
  tournamentId?: string;
  matchId?: string;
  achievementId?: string;
  actorId?: string;
  actorName?: string;
  actorPhotoURL?: string | null;
  tierFrom?: string;
  tierTo?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  type: NotificationType;
  message: string;
  actionUrl?: string;
  payload: NotificationPayload;
  read: boolean;
  createdAt: number;
  expiresAt: number;
}
```

**Step 4: Add notification preferences to settingsStore.ts**

In `src/stores/settingsStore.ts`, add to the `Settings` interface:

```typescript
  notifyBuddy: boolean;
  notifyTournament: boolean;
  notifyAchievement: boolean;
  notifyStats: boolean;
```

And add to `DEFAULTS`:

```typescript
  notifyBuddy: true,
  notifyTournament: true,
  notifyAchievement: true,
  notifyStats: true,
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run src/stores/__tests__/settingsStore.notify.test.ts
```

Expected: PASS

**Step 6: Run type check**

```bash
npx tsc --noEmit
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/data/types.ts src/stores/settingsStore.ts src/stores/__tests__/settingsStore.notify.test.ts
git commit -m "feat(notifications): add AppNotification types and notification preferences"
```

---

## Task 2: Notification Helper Factories + Tests

**Files:**
- Create: `src/features/notifications/engine/notificationHelpers.ts`
- Create: `src/features/notifications/engine/__tests__/notificationHelpers.test.ts`

**Step 1: Write the failing tests**

Create `src/features/notifications/engine/__tests__/notificationHelpers.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AppNotification } from '../../../../data/types';
import {
  createSessionProposedNotif,
  createSessionConfirmedNotif,
  createSessionCancelledNotif,
  createSessionReminderNotif,
  createSpotOpenedNotif,
  createGroupInviteNotif,
  createTournamentInvitationNotif,
  createMatchUpcomingNotif,
  createMatchResultRecordedNotif,
  createAchievementUnlockedNotif,
  createTierUpNotif,
  createTierDownNotif,
  EXPIRY_DAYS,
} from '../notificationHelpers';

const FIXED_UUID = 'test-uuid-1234';
const FIXED_NOW = 1700000000000;
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_UUID as `${string}-${string}-${string}-${string}-${string}`);
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Table-driven: every type maps to correct category, actionUrl pattern, and expiresAt ──

const TYPE_MAP: Array<{
  name: string;
  factory: () => AppNotification;
  expectedCategory: string;
  expectedType: string;
  expectedActionUrlPattern: RegExp | null;
  expectedExpiryDays: number;
}> = [
  {
    name: 'session_proposed',
    factory: () => createSessionProposedNotif('u1', 'Alice', 'Tue Doubles', 's1', 'g1'),
    expectedCategory: 'buddy',
    expectedType: 'session_proposed',
    expectedActionUrlPattern: /\/session\/s1/,
    expectedExpiryDays: 30,
  },
  {
    name: 'session_confirmed',
    factory: () => createSessionConfirmedNotif('u1', 'Tue Doubles', 's1', 'g1'),
    expectedCategory: 'buddy',
    expectedType: 'session_confirmed',
    expectedActionUrlPattern: /\/session\/s1/,
    expectedExpiryDays: 30,
  },
  {
    name: 'session_cancelled',
    factory: () => createSessionCancelledNotif('u1', 'Tue Doubles', 's1', 'g1'),
    expectedCategory: 'buddy',
    expectedType: 'session_cancelled',
    expectedActionUrlPattern: /\/session\/s1/,
    expectedExpiryDays: 30,
  },
  {
    name: 'session_reminder',
    factory: () => createSessionReminderNotif('u1', 'Tue Doubles', 's1'),
    expectedCategory: 'buddy',
    expectedType: 'session_reminder',
    expectedActionUrlPattern: /\/session\/s1/,
    expectedExpiryDays: 7,
  },
  {
    name: 'spot_opened',
    factory: () => createSpotOpenedNotif('u1', 'Bob', 'Tue Doubles', 's1'),
    expectedCategory: 'buddy',
    expectedType: 'spot_opened',
    expectedActionUrlPattern: /\/session\/s1/,
    expectedExpiryDays: 7,
  },
  {
    name: 'group_invite',
    factory: () => createGroupInviteNotif('u1', 'Alice', 'Friday Group', 'g1'),
    expectedCategory: 'buddy',
    expectedType: 'group_invite',
    expectedActionUrlPattern: /\/buddies\/g1/,
    expectedExpiryDays: 30,
  },
  {
    name: 'tournament_invitation',
    factory: () => createTournamentInvitationNotif('u1', 'Organizer', 'Spring Open', 't1'),
    expectedCategory: 'tournament',
    expectedType: 'tournament_invitation',
    expectedActionUrlPattern: /\/tournaments\/t1/,
    expectedExpiryDays: 30,
  },
  {
    name: 'match_upcoming',
    factory: () => createMatchUpcomingNotif('u1', 'Spring Open', 't1', 'm1'),
    expectedCategory: 'tournament',
    expectedType: 'match_upcoming',
    expectedActionUrlPattern: /\/tournaments\/t1/,
    expectedExpiryDays: 1,
  },
  {
    name: 'match_result_recorded',
    factory: () => createMatchResultRecordedNotif('u1', 'Scorer', 'Spring Open', 't1', 'm1'),
    expectedCategory: 'tournament',
    expectedType: 'match_result_recorded',
    expectedActionUrlPattern: /\/tournaments\/t1/,
    expectedExpiryDays: 30,
  },
  {
    name: 'achievement_unlocked',
    factory: () => createAchievementUnlockedNotif('u1', 'Century Club', 'Play 100 matches', 'century_club'),
    expectedCategory: 'achievement',
    expectedType: 'achievement_unlocked',
    expectedActionUrlPattern: /\/profile/,
    expectedExpiryDays: 90,
  },
  {
    name: 'tier_up',
    factory: () => createTierUpNotif('u1', 'intermediate', 'advanced'),
    expectedCategory: 'stats',
    expectedType: 'tier_up',
    expectedActionUrlPattern: /\/profile/,
    expectedExpiryDays: 30,
  },
  {
    name: 'tier_down',
    factory: () => createTierDownNotif('u1', 'advanced', 'intermediate'),
    expectedCategory: 'stats',
    expectedType: 'tier_down',
    expectedActionUrlPattern: /\/profile/,
    expectedExpiryDays: 30,
  },
];

describe('notification helpers', () => {
  describe.each(TYPE_MAP)('$name', ({ factory, expectedCategory, expectedType, expectedActionUrlPattern, expectedExpiryDays }) => {
    it('sets correct category', () => {
      expect(factory().category).toBe(expectedCategory);
    });

    it('sets correct type', () => {
      expect(factory().type).toBe(expectedType);
    });

    it('sets actionUrl matching expected pattern', () => {
      const result = factory();
      if (expectedActionUrlPattern) {
        expect(result.actionUrl).toMatch(expectedActionUrlPattern);
      }
    });

    it('sets expiresAt to correct number of days from now', () => {
      expect(factory().expiresAt).toBe(FIXED_NOW + expectedExpiryDays * DAY_MS);
    });
  });

  describe('shared behavior', () => {
    it('every helper generates a unique id via crypto.randomUUID()', () => {
      for (const { factory } of TYPE_MAP) {
        expect(factory().id).toBe(FIXED_UUID);
      }
      expect(crypto.randomUUID).toHaveBeenCalledTimes(TYPE_MAP.length);
    });

    it('every helper sets read to false', () => {
      for (const { factory } of TYPE_MAP) {
        expect(factory().read).toBe(false);
      }
    });

    it('every helper sets createdAt to Date.now()', () => {
      for (const { factory } of TYPE_MAP) {
        expect(factory().createdAt).toBe(FIXED_NOW);
      }
    });

    it('every helper sets userId to the provided value', () => {
      for (const { factory } of TYPE_MAP) {
        expect(factory().userId).toBe('u1');
      }
    });

    it('every helper sets a non-empty message string', () => {
      for (const { factory } of TYPE_MAP) {
        const result = factory();
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Specific message formatting ──

  it('session_proposed includes actor name and session title', () => {
    const result = createSessionProposedNotif('u1', 'Alice', 'Tue Doubles', 's1', 'g1');
    expect(result.message).toBe('Alice proposed a session: Tue Doubles');
  });

  it('session_confirmed includes session title', () => {
    const result = createSessionConfirmedNotif('u1', 'Tue Doubles', 's1', 'g1');
    expect(result.message).toContain('Tue Doubles');
    expect(result.message).toContain('confirmed');
  });

  it('session_cancelled includes session title', () => {
    const result = createSessionCancelledNotif('u1', 'Tue Doubles', 's1', 'g1');
    expect(result.message).toContain('Tue Doubles');
    expect(result.message).toContain('cancelled');
  });

  it('session_reminder includes session title', () => {
    const result = createSessionReminderNotif('u1', 'Tue Doubles', 's1');
    expect(result.message).toContain('Tue Doubles');
  });

  it('spot_opened includes actor name and session title', () => {
    const result = createSpotOpenedNotif('u1', 'Bob', 'Tue Doubles', 's1');
    expect(result.message).toContain('Bob');
    expect(result.message).toContain('Tue Doubles');
  });

  it('group_invite includes actor name and group name', () => {
    const result = createGroupInviteNotif('u1', 'Alice', 'Friday Group', 'g1');
    expect(result.message).toContain('Alice');
    expect(result.message).toContain('Friday Group');
  });

  it('tournament_invitation includes organizer and tournament name', () => {
    const result = createTournamentInvitationNotif('u1', 'Organizer', 'Spring Open', 't1');
    expect(result.message).toContain('Organizer');
    expect(result.message).toContain('Spring Open');
  });

  it('match_upcoming includes tournament name', () => {
    const result = createMatchUpcomingNotif('u1', 'Spring Open', 't1', 'm1');
    expect(result.message).toContain('Spring Open');
  });

  it('match_result_recorded includes scorer and tournament', () => {
    const result = createMatchResultRecordedNotif('u1', 'Scorer', 'Spring Open', 't1', 'm1');
    expect(result.message).toContain('Scorer');
    expect(result.message).toContain('Spring Open');
  });

  it('achievement_unlocked includes achievement name', () => {
    const result = createAchievementUnlockedNotif('u1', 'Century Club', 'Play 100 matches', 'century_club');
    expect(result.message).toContain('Century Club');
  });

  it('tier_up includes old and new tier', () => {
    const result = createTierUpNotif('u1', 'intermediate', 'advanced');
    expect(result.message).toContain('advanced');
    expect(result.payload.tierFrom).toBe('intermediate');
    expect(result.payload.tierTo).toBe('advanced');
  });

  it('tier_down includes old and new tier', () => {
    const result = createTierDownNotif('u1', 'advanced', 'intermediate');
    expect(result.message).toContain('intermediate');
    expect(result.payload.tierFrom).toBe('advanced');
    expect(result.payload.tierTo).toBe('intermediate');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/notifications/engine/__tests__/notificationHelpers.test.ts
```

Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/features/notifications/engine/notificationHelpers.ts`:

```typescript
import type { AppNotification } from '../../../data/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const EXPIRY_DAYS = {
  short: 1,
  week: 7,
  standard: 30,
  long: 90,
} as const;

function makeNotif(
  userId: string,
  category: AppNotification['category'],
  type: AppNotification['type'],
  message: string,
  actionUrl: string,
  payload: AppNotification['payload'],
  expiryDays: number,
): AppNotification {
  return {
    id: crypto.randomUUID(),
    userId,
    category,
    type,
    message,
    actionUrl,
    payload,
    read: false,
    createdAt: Date.now(),
    expiresAt: Date.now() + expiryDays * DAY_MS,
  };
}

// ── Buddy ──

export function createSessionProposedNotif(
  userId: string, actorName: string, sessionTitle: string, sessionId: string, groupId: string,
): AppNotification {
  return makeNotif(userId, 'buddy', 'session_proposed',
    `${actorName} proposed a session: ${sessionTitle}`,
    `/session/${sessionId}`,
    { sessionId, groupId, actorName },
    EXPIRY_DAYS.standard);
}

export function createSessionConfirmedNotif(
  userId: string, sessionTitle: string, sessionId: string, groupId: string | null,
): AppNotification {
  return makeNotif(userId, 'buddy', 'session_confirmed',
    `${sessionTitle} is confirmed — game on!`,
    `/session/${sessionId}`,
    { sessionId, groupId: groupId ?? undefined },
    EXPIRY_DAYS.standard);
}

export function createSessionCancelledNotif(
  userId: string, sessionTitle: string, sessionId: string, groupId: string | null,
): AppNotification {
  return makeNotif(userId, 'buddy', 'session_cancelled',
    `${sessionTitle} has been cancelled`,
    `/session/${sessionId}`,
    { sessionId, groupId: groupId ?? undefined },
    EXPIRY_DAYS.standard);
}

export function createSessionReminderNotif(
  userId: string, sessionTitle: string, sessionId: string,
): AppNotification {
  return makeNotif(userId, 'buddy', 'session_reminder',
    `${sessionTitle} starts in 1 hour`,
    `/session/${sessionId}`,
    { sessionId },
    EXPIRY_DAYS.week);
}

export function createSpotOpenedNotif(
  userId: string, actorName: string, sessionTitle: string, sessionId: string,
): AppNotification {
  return makeNotif(userId, 'buddy', 'spot_opened',
    `${actorName} dropped out of ${sessionTitle} — spot available!`,
    `/session/${sessionId}`,
    { sessionId, actorName },
    EXPIRY_DAYS.week);
}

export function createGroupInviteNotif(
  userId: string, actorName: string, groupName: string, groupId: string,
): AppNotification {
  return makeNotif(userId, 'buddy', 'group_invite',
    `${actorName} invited you to join ${groupName}`,
    `/buddies/${groupId}`,
    { groupId, actorName },
    EXPIRY_DAYS.standard);
}

// ── Tournament ──

export function createTournamentInvitationNotif(
  userId: string, organizerName: string, tournamentName: string, tournamentId: string,
): AppNotification {
  return makeNotif(userId, 'tournament', 'tournament_invitation',
    `${organizerName} invited you to ${tournamentName}`,
    `/tournaments/${tournamentId}`,
    { tournamentId, actorName: organizerName },
    EXPIRY_DAYS.standard);
}

export function createMatchUpcomingNotif(
  userId: string, tournamentName: string, tournamentId: string, matchId: string,
): AppNotification {
  return makeNotif(userId, 'tournament', 'match_upcoming',
    `Your next match in ${tournamentName} is about to start`,
    `/tournaments/${tournamentId}`,
    { tournamentId, matchId },
    EXPIRY_DAYS.short);
}

export function createMatchResultRecordedNotif(
  userId: string, scorerName: string, tournamentName: string, tournamentId: string, matchId: string,
): AppNotification {
  return makeNotif(userId, 'tournament', 'match_result_recorded',
    `${scorerName} recorded your match result in ${tournamentName}`,
    `/tournaments/${tournamentId}`,
    { tournamentId, matchId, actorName: scorerName },
    EXPIRY_DAYS.standard);
}

// ── Achievement ──

export function createAchievementUnlockedNotif(
  userId: string, achievementName: string, description: string, achievementId: string,
): AppNotification {
  return makeNotif(userId, 'achievement', 'achievement_unlocked',
    `Achievement unlocked: ${achievementName}`,
    '/profile',
    { achievementId },
    EXPIRY_DAYS.long);
}

// ── Stats ──

export function createTierUpNotif(
  userId: string, fromTier: string, toTier: string,
): AppNotification {
  return makeNotif(userId, 'stats', 'tier_up',
    `You've been promoted to ${toTier}!`,
    '/profile',
    { tierFrom: fromTier, tierTo: toTier },
    EXPIRY_DAYS.standard);
}

export function createTierDownNotif(
  userId: string, fromTier: string, toTier: string,
): AppNotification {
  return makeNotif(userId, 'stats', 'tier_down',
    `Your tier has changed to ${toTier}`,
    '/profile',
    { tierFrom: fromTier, tierTo: toTier },
    EXPIRY_DAYS.standard);
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/notifications/engine/__tests__/notificationHelpers.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/features/notifications/
git commit -m "feat(notifications): add notification helper factories with tests"
```

---

## Task 3: Firestore Security Rules + Tests

> **Moved earlier** (was Task 5 in v1). Security rules are the riskiest integration piece — fail fast.

**Files:**
- Modify: `firestore.rules` (add after buddyNotifications rules, ~line 466)
- Modify: `test/rules/helpers.ts` (add `makeNotification` factory)
- Create: `test/rules/notifications.test.ts`

**Step 1: Add `makeNotification` factory to `test/rules/helpers.ts`**

Add after `makeBuddyNotification`:

```typescript
export function makeNotification(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-notif-1',
    userId,
    category: 'buddy',
    type: 'session_proposed',
    message: 'Test notification',
    actionUrl: '/session/s1',
    payload: { sessionId: 's1', groupId: 'g1' },
    read: false,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}
```

**Step 2: Write security rules tests**

Create `test/rules/notifications.test.ts`. Structure below with representative tests per category; the implementing agent fills in remaining tests following the pattern:

```typescript
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  setupTestEnv,
  teardownTestEnv,
  clearFirestore,
  authedContext,
  unauthedContext,
  getTestEnv,
  makeNotification,
  makeTournament,
  makeBuddyMember,
} from './helpers';

beforeAll(async () => {
  await setupTestEnv();
});

afterAll(async () => {
  await teardownTestEnv();
});

beforeEach(async () => {
  await clearFirestore();
});

async function seedDoc(path: string, data: Record<string, unknown>) {
  await getTestEnv().withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, path), data);
  });
}

const userId = 'user-1';
const otherUserId = 'user-2';
const organizerId = 'organizer-1';
const groupId = 'g1';
const tournamentId = 't1';
const notifPath = (uid: string, nid = 'n1') => `users/${uid}/notifications/${nid}`;

// ═══════════════════════════════════════════════════════════════
// 1. READ RULES (~3 tests)
// ═══════════════════════════════════════════════════════════════

describe('Read', () => {
  it('allows owner to read own notification', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertSucceeds(getDoc(doc(db, notifPath(userId))));
  });

  it('denies reading another user notification', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(otherUserId).firestore();
    await assertFails(getDoc(doc(db, notifPath(userId))));
  });

  it('denies unauthenticated read', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, notifPath(userId))));
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. UPDATE RULES — only 'read' field, only false→true (~8 tests)
// ═══════════════════════════════════════════════════════════════

describe('Update (mark as read)', () => {
  it('allows owner to set read: true', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertSucceeds(updateDoc(doc(db, notifPath(userId)), { read: true }));
  });

  it('denies setting read: false (un-reading)', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId, { read: true }));
    const db = authedContext(userId).firestore();
    await assertFails(updateDoc(doc(db, notifPath(userId)), { read: false }));
  });

  it('denies updating message field', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertFails(updateDoc(doc(db, notifPath(userId)), { read: true, message: 'hacked' }));
  });

  it('denies other user updating', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(otherUserId).firestore();
    await assertFails(updateDoc(doc(db, notifPath(userId)), { read: true }));
  });

  // Implementing agent: add tests for updating type, category, payload, createdAt, expiresAt (all denied)
});

// ═══════════════════════════════════════════════════════════════
// 3. DELETE RULES (~3 tests)
// ═══════════════════════════════════════════════════════════════

describe('Delete', () => {
  it('allows owner to delete own notification', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertSucceeds(deleteDoc(doc(db, notifPath(userId))));
  });

  it('denies deleting another user notification', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(otherUserId).firestore();
    await assertFails(deleteDoc(doc(db, notifPath(userId))));
  });

  it('denies unauthenticated delete', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = unauthedContext().firestore();
    await assertFails(deleteDoc(doc(db, notifPath(userId))));
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. BUDDY CREATE — bidirectional group membership (~10 tests)
// ═══════════════════════════════════════════════════════════════

describe('Buddy create (with group membership)', () => {
  beforeEach(async () => {
    // Seed group membership for both users
    await seedDoc(`buddyGroups/${groupId}/members/${otherUserId}`, makeBuddyMember(otherUserId));
    await seedDoc(`buddyGroups/${groupId}/members/${userId}`, makeBuddyMember(userId));
  });

  it('allows member to create buddy notification for another member', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'session_proposed',
      payload: { sessionId: 's1', groupId },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create when writer is NOT a group member', async () => {
    const outsider = 'outsider';
    const db = authedContext(outsider).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'session_proposed',
      payload: { sessionId: 's1', groupId },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create when recipient is NOT a group member', async () => {
    const nonMember = 'non-member';
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(nonMember, {
      category: 'buddy',
      type: 'session_proposed',
      payload: { sessionId: 's1', groupId },
    });
    await assertFails(setDoc(doc(db, `users/${nonMember}/notifications/n1`), notif));
  });

  it('denies self-write for buddy notification', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'session_proposed',
      payload: { sessionId: 's1', groupId },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create with read: true', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, { read: true, payload: { sessionId: 's1', groupId } });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create with empty message', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, { message: '', payload: { sessionId: 's1', groupId } });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create with message > 500 chars', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, { message: 'x'.repeat(501), payload: { sessionId: 's1', groupId } });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create with extra fields (field injection)', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = { ...makeNotification(userId, { payload: { sessionId: 's1', groupId } }), isAdmin: true };
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  // Implementing agent: add tests for missing payload.groupId, non-string message, missing createdAt
});

// ═══════════════════════════════════════════════════════════════
// 5. GROUP_INVITE — no group membership required (~3 tests)
// ═══════════════════════════════════════════════════════════════

describe('group_invite create', () => {
  it('allows any authenticated user to send group invite', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      type: 'group_invite',
      payload: { groupId },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies unauthenticated group_invite', async () => {
    const db = unauthedContext().firestore();
    const notif = makeNotification(userId, { type: 'group_invite', payload: { groupId } });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies self-invite', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, { type: 'group_invite', payload: { groupId } });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. TOURNAMENT CREATE — organizer check (~5 tests)
// ═══════════════════════════════════════════════════════════════

describe('Tournament notification create (organizer check)', () => {
  beforeEach(async () => {
    await seedDoc(`tournaments/${tournamentId}`, makeTournament(organizerId));
  });

  it('allows organizer to create tournament_invitation', async () => {
    const db = authedContext(organizerId).firestore();
    const notif = makeNotification(userId, {
      category: 'tournament',
      type: 'tournament_invitation',
      payload: { tournamentId },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies non-organizer creating tournament notification', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'tournament',
      type: 'tournament_invitation',
      payload: { tournamentId },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('allows organizer to create match_upcoming', async () => {
    const db = authedContext(organizerId).firestore();
    const notif = makeNotification(userId, {
      category: 'tournament',
      type: 'match_upcoming',
      payload: { tournamentId, matchId: 'm1' },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies tournament notification with missing tournamentId', async () => {
    const db = authedContext(organizerId).firestore();
    const notif = makeNotification(userId, {
      category: 'tournament',
      type: 'tournament_invitation',
      payload: {},
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  // Implementing agent: add test for match_result_recorded, spoofed tournamentId
});

// ═══════════════════════════════════════════════════════════════
// 7. ACHIEVEMENT / STATS — self-write only (~6 tests)
// ═══════════════════════════════════════════════════════════════

describe('Achievement/stats self-write', () => {
  it('allows self-write for achievement_unlocked', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'achievement',
      type: 'achievement_unlocked',
      payload: { achievementId: 'century_club' },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('allows self-write for tier_up', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'stats',
      type: 'tier_up',
      payload: { tierFrom: 'beginner', tierTo: 'intermediate' },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies other-user write for achievement', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'achievement',
      type: 'achievement_unlocked',
      payload: { achievementId: 'century_club' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies self-write with wrong category/type combo', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'achievement',
      type: 'session_proposed',
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  // Implementing agent: add tests for tier_down self-write, stats with read:true
});

// ═══════════════════════════════════════════════════════════════
// 8. ATTACK VECTOR TESTS (~8 tests)
// ═══════════════════════════════════════════════════════════════

describe('Attack vectors', () => {
  it('denies spam: writing to another user without group membership', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      payload: { sessionId: 's1', groupId: 'nonexistent-group' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies field injection: extra fields beyond allowlist', async () => {
    await seedDoc(`buddyGroups/${groupId}/members/${otherUserId}`, makeBuddyMember(otherUserId));
    await seedDoc(`buddyGroups/${groupId}/members/${userId}`, makeBuddyMember(userId));
    const db = authedContext(otherUserId).firestore();
    const notif = {
      ...makeNotification(userId, { payload: { sessionId: 's1', groupId } }),
      adminOverride: true,
    };
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies privilege escalation: buddy user writes tournament notification', async () => {
    await seedDoc(`buddyGroups/${groupId}/members/${otherUserId}`, makeBuddyMember(otherUserId));
    await seedDoc(`buddyGroups/${groupId}/members/${userId}`, makeBuddyMember(userId));
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'tournament',
      type: 'tournament_invitation',
      payload: { tournamentId: 't1' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  // Implementing agent: add tests for userId mismatch, non-string message, type not in allowed list,
  // payload missing required groupId for buddy types, mismatched category/type combos,
  // message exactly 500 chars (allowed), message exactly 501 chars (denied)
});
```

**NOTE:** Add `import { assertSucceeds, assertFails } from './helpers';` at the top (already re-exported from helpers). The implementing agent should fill in the remaining `// Implementing agent:` comments to reach ~60 total tests.

**Step 3: Run tests to verify they fail**

```bash
npx vitest run test/rules/notifications.test.ts
```

Expected: FAIL — rules don't exist yet

**Step 4: Add the security rules**

In `firestore.rules`, add after the buddyNotifications rules block (after line 466):

```
    // ── Unified Notifications (/users/{userId}/notifications/{nid}) ──
    match /users/{userId}/notifications/{notifId} {
      // Owner reads own notifications
      allow read: if request.auth != null && request.auth.uid == userId;

      // Owner marks as read (only 'read' field, only false→true)
      allow update: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read'])
        && request.resource.data.read == true;

      // Owner deletes own notifications
      allow delete: if request.auth != null && request.auth.uid == userId;

      // Buddy notifications (except group_invite): bidirectional group membership
      allow create: if request.auth != null
        && request.auth.uid != userId
        && request.resource.data.keys().hasOnly(['id','userId','category','type','message','actionUrl','payload','read','createdAt','expiresAt'])
        && request.resource.data.userId == userId
        && request.resource.data.category == 'buddy'
        && request.resource.data.type in ['session_proposed','session_confirmed','session_cancelled','session_reminder','spot_opened']
        && request.resource.data.message is string
        && request.resource.data.message.size() > 0
        && request.resource.data.message.size() <= 500
        && request.resource.data.read == false
        && request.resource.data.payload is map
        && request.resource.data.createdAt is number
        && request.resource.data.expiresAt is number
        && request.resource.data.payload.groupId is string
        && exists(/databases/$(database)/documents/buddyGroups/$(request.resource.data.payload.groupId)/members/$(request.auth.uid))
        && exists(/databases/$(database)/documents/buddyGroups/$(request.resource.data.payload.groupId)/members/$(userId));

      // group_invite: any authenticated user can send
      allow create: if request.auth != null
        && request.auth.uid != userId
        && request.resource.data.keys().hasOnly(['id','userId','category','type','message','actionUrl','payload','read','createdAt','expiresAt'])
        && request.resource.data.userId == userId
        && request.resource.data.category == 'buddy'
        && request.resource.data.type == 'group_invite'
        && request.resource.data.message is string
        && request.resource.data.message.size() > 0
        && request.resource.data.message.size() <= 500
        && request.resource.data.read == false
        && request.resource.data.payload is map
        && request.resource.data.createdAt is number
        && request.resource.data.expiresAt is number;

      // Tournament notifications: writer must be organizer
      allow create: if request.auth != null
        && request.auth.uid != userId
        && request.resource.data.keys().hasOnly(['id','userId','category','type','message','actionUrl','payload','read','createdAt','expiresAt'])
        && request.resource.data.userId == userId
        && request.resource.data.category == 'tournament'
        && request.resource.data.type in ['tournament_invitation', 'match_upcoming', 'match_result_recorded']
        && request.resource.data.message is string
        && request.resource.data.read == false
        && request.resource.data.payload is map
        && request.resource.data.createdAt is number
        && request.resource.data.expiresAt is number
        && request.resource.data.payload.tournamentId is string
        && get(/databases/$(database)/documents/tournaments/$(request.resource.data.payload.tournamentId)).data.organizerId == request.auth.uid;

      // Achievement/stats: self-write only (temporary — migrate to Cloud Functions later)
      allow create: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.keys().hasOnly(['id','userId','category','type','message','actionUrl','payload','read','createdAt','expiresAt'])
        && request.resource.data.userId == userId
        && request.resource.data.category in ['achievement', 'stats']
        && request.resource.data.type in ['achievement_unlocked', 'tier_up', 'tier_down']
        && request.resource.data.message is string
        && request.resource.data.read == false
        && request.resource.data.payload is map
        && request.resource.data.createdAt is number
        && request.resource.data.expiresAt is number;
    }
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run test/rules/notifications.test.ts
```

Expected: PASS (all tests)

**Step 6: Commit**

```bash
git add firestore.rules test/rules/notifications.test.ts test/rules/helpers.ts
git commit -m "feat(notifications): add unified notification security rules with tests"
```

---

## Task 4: Notification Store + Tests

**Files:**
- Create: `src/features/notifications/store/notificationStore.ts`
- Create: `src/features/notifications/store/__tests__/notificationStore.test.ts`

**Step 1: Write the failing tests**

Create `src/features/notifications/store/__tests__/notificationStore.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AppNotification } from '../../../../data/types';

// Mock Firestore — use vi.hoisted for stable references across vi.resetModules()
const { mockOnSnapshot, mockUpdateDoc, mockGetDocs, mockDeleteDoc, mockWriteBatch,
  mockDoc, mockCollection, mockQuery, mockWhere, mockOrderBy, mockLimit } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockWriteBatch: vi.fn(() => ({
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
  mockDoc: vi.fn((...args: unknown[]) => args.join('/')),
  mockCollection: vi.fn((...args: unknown[]) => args.join('/')),
  mockQuery: vi.fn((...args: unknown[]) => args[0]),
  mockWhere: vi.fn(),
  mockOrderBy: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
}));

vi.mock('../../../../data/firebase/config', () => ({
  firestore: {},
}));

vi.mock('../../../../stores/settingsStore', () => ({
  settings: () => ({
    notifyBuddy: true,
    notifyTournament: true,
    notifyAchievement: true,
    notifyStats: true,
  }),
}));

function makeTestNotif(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    userId: 'u1',
    category: 'buddy',
    type: 'session_proposed',
    message: 'Test notification',
    actionUrl: '/session/s1',
    payload: { sessionId: 's1' },
    read: false,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

// Match real Firestore: data() does NOT include id
function makeSnapshotDocs(notifs: AppNotification[]) {
  return {
    docs: notifs.map((n) => {
      const { id, ...rest } = n;
      return { id, data: () => rest };
    }),
  };
}

describe('notificationStore', () => {
  let store: typeof import('../notificationStore');

  beforeEach(async () => {
    vi.resetModules();
    mockOnSnapshot.mockReset();
    mockUpdateDoc.mockReset();
    mockGetDocs.mockReset();
    mockDeleteDoc.mockReset();
    mockWriteBatch.mockClear();

    // Default: onSnapshot returns unsubscribe fn
    mockOnSnapshot.mockReturnValue(vi.fn());

    store = await import('../notificationStore');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Lifecycle ──

  it('starts with empty notifications and zero unread', () => {
    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
    expect(store.notificationsReady()).toBe(false);
  });

  it('startNotificationListener sets up onSnapshot on correct collection', () => {
    store.startNotificationListener('u1');
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    expect(mockCollection).toHaveBeenCalledWith({}, 'users', 'u1', 'notifications');
  });

  it('startNotificationListener populates signals on snapshot', () => {
    mockOnSnapshot.mockImplementation((q: unknown, cb: (snap: unknown) => void) => {
      cb(makeSnapshotDocs([
        makeTestNotif({ id: 'n1', read: false }),
        makeTestNotif({ id: 'n2', read: true }),
      ]));
      return vi.fn();
    });

    store.startNotificationListener('u1');

    expect(store.notifications().length).toBe(2);
    expect(store.unreadCount()).toBe(1);
    expect(store.notificationsReady()).toBe(true);
  });

  it('stopNotificationListener clears signals and calls unsubscribe', () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    store.startNotificationListener('u1');

    store.stopNotificationListener();

    expect(unsub).toHaveBeenCalledTimes(1);
    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
    expect(store.notificationsReady()).toBe(false);
  });

  it('stopNotificationListener called twice does not throw', () => {
    store.startNotificationListener('u1');
    store.stopNotificationListener();
    expect(() => store.stopNotificationListener()).not.toThrow();
  });

  it('startNotificationListener cleans up previous listener before starting new one', () => {
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

    store.startNotificationListener('u1');
    store.startNotificationListener('u2');

    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  // ── Real-time delta ──

  it('second snapshot replaces (not appends) notifications', () => {
    let snapshotCallback: (snap: unknown) => void;
    mockOnSnapshot.mockImplementation((q: unknown, cb: (snap: unknown) => void) => {
      snapshotCallback = cb;
      return vi.fn();
    });

    store.startNotificationListener('u1');
    snapshotCallback!(makeSnapshotDocs([makeTestNotif({ id: 'n1' })]));
    expect(store.notifications().length).toBe(1);

    snapshotCallback!(makeSnapshotDocs([
      makeTestNotif({ id: 'n1' }),
      makeTestNotif({ id: 'n2' }),
    ]));
    expect(store.notifications().length).toBe(2);
  });

  it('snapshot with additional unread increments unreadCount', () => {
    let snapshotCallback: (snap: unknown) => void;
    mockOnSnapshot.mockImplementation((q: unknown, cb: (snap: unknown) => void) => {
      snapshotCallback = cb;
      return vi.fn();
    });

    store.startNotificationListener('u1');
    snapshotCallback!(makeSnapshotDocs([makeTestNotif({ id: 'n1', read: false })]));
    expect(store.unreadCount()).toBe(1);

    snapshotCallback!(makeSnapshotDocs([
      makeTestNotif({ id: 'n1', read: false }),
      makeTestNotif({ id: 'n2', read: false }),
    ]));
    expect(store.unreadCount()).toBe(2);
  });

  // ── buddyUnreadCount ──

  it('buddyUnreadCount only counts unread buddy notifications', () => {
    mockOnSnapshot.mockImplementation((q: unknown, cb: (snap: unknown) => void) => {
      cb(makeSnapshotDocs([
        makeTestNotif({ id: 'n1', read: false, category: 'buddy' }),
        makeTestNotif({ id: 'n2', read: false, category: 'tournament', type: 'tournament_invitation' }),
        makeTestNotif({ id: 'n3', read: true, category: 'buddy' }),
      ]));
      return vi.fn();
    });

    store.startNotificationListener('u1');

    expect(store.buddyUnreadCount()).toBe(1);
    expect(store.unreadCount()).toBe(2);
  });

  // ── Preference filtering ──

  it('filteredNotifications excludes disabled categories', async () => {
    vi.resetModules();

    vi.doMock('../../../../stores/settingsStore', () => ({
      settings: () => ({
        notifyBuddy: true,
        notifyTournament: false,
        notifyAchievement: true,
        notifyStats: true,
      }),
    }));

    const storeFiltered = await import('../notificationStore');
    let snapshotCallback: (snap: unknown) => void;
    mockOnSnapshot.mockImplementation((q: unknown, cb: (snap: unknown) => void) => {
      snapshotCallback = cb;
      return vi.fn();
    });

    storeFiltered.startNotificationListener('u1');
    snapshotCallback!(makeSnapshotDocs([
      makeTestNotif({ id: 'n1', category: 'buddy' }),
      makeTestNotif({ id: 'n2', category: 'tournament', type: 'tournament_invitation' }),
      makeTestNotif({ id: 'n3', category: 'achievement', type: 'achievement_unlocked' }),
    ]));

    expect(storeFiltered.filteredNotifications().length).toBe(2);
    expect(storeFiltered.filteredNotifications().map((n: AppNotification) => n.id)).toEqual(['n1', 'n3']);
  });

  it('filteredNotifications does not mutate raw notifications', () => {
    let snapshotCallback: (snap: unknown) => void;
    mockOnSnapshot.mockImplementation((q: unknown, cb: (snap: unknown) => void) => {
      snapshotCallback = cb;
      return vi.fn();
    });

    store.startNotificationListener('u1');
    snapshotCallback!(makeSnapshotDocs([
      makeTestNotif({ id: 'n1' }),
      makeTestNotif({ id: 'n2' }),
    ]));

    expect(store.filteredNotifications().length).toBe(2);
    expect(store.notifications().length).toBe(2);
  });

  // ── markRead ──

  it('markNotificationRead calls updateDoc with read: true', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await store.markNotificationRead('u1', 'n1');
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { read: true },
    );
  });

  it('markNotificationRead swallows errors', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('offline'));
    await expect(store.markNotificationRead('u1', 'n1')).resolves.toBeUndefined();
  });

  // ── markAllRead ──

  it('markAllNotificationsRead uses limit(500) not limit(50)', async () => {
    const batchMock = { update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    mockWriteBatch.mockReturnValue(batchMock);
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'n1', ref: 'ref1' },
        { id: 'n2', ref: 'ref2' },
      ],
    });

    await store.markAllNotificationsRead('u1');

    expect(mockLimit).toHaveBeenCalledWith(500);
    expect(batchMock.update).toHaveBeenCalledTimes(2);
    expect(batchMock.update).toHaveBeenCalledWith('ref1', { read: true });
    expect(batchMock.update).toHaveBeenCalledWith('ref2', { read: true });
  });

  it('markAllNotificationsRead skips if no unread', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await store.markAllNotificationsRead('u1');
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  // ── Expired cleanup ──

  it('cleanupExpiredNotifications deletes expired docs', async () => {
    const batchMock = { delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    mockWriteBatch.mockReturnValue(batchMock);
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'n1', ref: 'ref1' },
        { id: 'n2', ref: 'ref2' },
      ],
    });

    await store.cleanupExpiredNotifications('u1');

    expect(mockWhere).toHaveBeenCalledWith('expiresAt', '<=', expect.any(Number));
    expect(batchMock.delete).toHaveBeenCalledTimes(2);
    expect(batchMock.commit).toHaveBeenCalledTimes(1);
  });

  it('cleanupExpiredNotifications skips if nothing expired', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await store.cleanupExpiredNotifications('u1');
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  // ── onSnapshot error ──

  it('onSnapshot error callback resets notifications and does not throw', () => {
    let errorCallback: (err: unknown) => void;
    mockOnSnapshot.mockImplementation((q: unknown, success: unknown, error: (err: unknown) => void) => {
      errorCallback = error;
      return vi.fn();
    });

    store.startNotificationListener('u1');
    expect(() => errorCallback!(new Error('permission-denied'))).not.toThrow();
    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/features/notifications/store/__tests__/notificationStore.test.ts
```

Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/features/notifications/store/notificationStore.ts`:

```typescript
import { createSignal, createMemo } from 'solid-js';
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, updateDoc, getDocs, where, writeBatch,
} from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { AppNotification, NotificationCategory } from '../../../data/types';
import { settings } from '../../../stores/settingsStore';

// ── Module-level signals ──

const [notifications, setNotifications] = createSignal<AppNotification[]>([]);
const [unreadCount, setUnreadCount] = createSignal(0);
const [notificationsReady, setNotificationsReady] = createSignal(false);

export { notifications, unreadCount, notificationsReady };

// ── Preference-filtered view (createMemo — never mutates raw signal) ──

const CATEGORY_PREF_MAP: Record<NotificationCategory, string> = {
  buddy: 'notifyBuddy',
  tournament: 'notifyTournament',
  achievement: 'notifyAchievement',
  stats: 'notifyStats',
};

export const filteredNotifications = createMemo(() => {
  const prefs = settings() as Record<string, boolean>;
  return notifications().filter((n) => {
    const prefKey = CATEGORY_PREF_MAP[n.category];
    return prefs[prefKey] !== false;
  });
});

// ── Category-specific counts (for BottomNav badges) ──

export const buddyUnreadCount = createMemo(() =>
  notifications().filter((n) => !n.read && n.category === 'buddy').length,
);

// ── Listener lifecycle ──

let _unsubscribe: (() => void) | null = null;

export function startNotificationListener(uid: string): void {
  _unsubscribe?.();

  const q = query(
    collection(firestore, 'users', uid, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );

  _unsubscribe = onSnapshot(
    q,
    (snap) => {
      const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification);
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
      setNotificationsReady(true);
    },
    (err) => {
      console.warn('Notification listener error:', err);
      setNotifications([]);
      setUnreadCount(0);
    },
  );
}

export function stopNotificationListener(): void {
  _unsubscribe?.();
  _unsubscribe = null;
  setNotifications([]);
  setUnreadCount(0);
  setNotificationsReady(false);
}

// ── Read operations (fire-and-forget) ──

export async function markNotificationRead(uid: string, notifId: string): Promise<void> {
  try {
    const ref = doc(firestore, 'users', uid, 'notifications', notifId);
    await updateDoc(ref, { read: true });
  } catch {
    // Best-effort. The onSnapshot will eventually reflect truth.
  }
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const q = query(
    collection(firestore, 'users', uid, 'notifications'),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(500),
  );
  const snap = await getDocs(q);
  if (snap.docs.length === 0) return;

  const batch = writeBatch(firestore);
  for (const d of snap.docs) {
    batch.update(d.ref, { read: true });
  }
  await batch.commit();
}

// ── Expired notification cleanup ──

export async function cleanupExpiredNotifications(uid: string): Promise<void> {
  const q = query(
    collection(firestore, 'users', uid, 'notifications'),
    where('expiresAt', '<=', Date.now()),
    limit(100),
  );
  const snap = await getDocs(q);
  if (snap.docs.length === 0) return;

  const batch = writeBatch(firestore);
  for (const d of snap.docs) {
    batch.delete(d.ref);
  }
  await batch.commit();
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/notifications/store/__tests__/notificationStore.test.ts
```

Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add src/features/notifications/store/
git commit -m "feat(notifications): add notification store with onSnapshot listener"
```

---

## Task 5: Wire Store into useAuth Lifecycle + Tests

**Files:**
- Modify: `src/shared/hooks/useAuth.ts`
- Modify: `src/shared/hooks/__tests__/useAuth.test.ts` (if exists, else create)

**Step 1: Write the failing test**

Add tests verifying notification lifecycle wiring. If `useAuth.test.ts` exists, add to it. Otherwise create it. The test should mock the notification store module and verify calls:

```typescript
// In the test file, mock the notification store:
vi.mock('../../features/notifications/store/notificationStore', () => ({
  startNotificationListener: vi.fn(),
  stopNotificationListener: vi.fn(),
  cleanupExpiredNotifications: vi.fn().mockResolvedValue(undefined),
}));

// Test: startNotificationListener called with uid on sign-in
// Test: stopNotificationListener called on sign-out
// Test: cleanupExpiredNotifications called (non-blocking) on sign-in
```

**Step 2: Run tests to verify they fail**

**Step 3: Add imports to `useAuth.ts`**

After the existing imports (line 13), add:

```typescript
import { startNotificationListener, stopNotificationListener, cleanupExpiredNotifications } from '../../features/notifications/store/notificationStore';
```

**Step 4: Wire start on sign-in**

After `startProcessor();` (line 57), add:

```typescript
      // Start notification listener
      startNotificationListener(firebaseUser.uid);

      // Clean up expired notifications (non-blocking)
      cleanupExpiredNotifications(firebaseUser.uid).catch((err) => {
        console.warn('Notification cleanup failed:', err);
      });
```

**Step 5: Wire stop on sign-out**

After `stopProcessor();` (line 71), add:

```typescript
      stopNotificationListener();
```

**Step 6: Run tests to verify they pass**

```bash
npx tsc --noEmit && npx vitest run src/shared/hooks/__tests__/useAuth.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/shared/hooks/useAuth.ts src/shared/hooks/__tests__/
git commit -m "feat(notifications): wire notification store into auth lifecycle"
```

---

## Task 6: NotificationRow Component + Tests

**Files:**
- Create: `src/features/notifications/components/NotificationRow.tsx`
- Create: `src/features/notifications/components/__tests__/NotificationRow.test.tsx`

The implementing agent should:

1. Write tests first covering: renders message, renders relative time, unread dot visible when `read: false`, unread dot hidden when `read: true`, different font weight for read vs unread, click calls onRead callback, click does not navigate when actionUrl is empty, aria-label includes read/unread state.

2. Implement a `<li>` element with:
   - Two-line layout: `[avatar 36px] | [message 2-line clamp] [dot] / [time]`
   - 52px min-height
   - Unread: `bg-surface-lighter`, font-weight 500, orange dot
   - Read: `bg-surface-light`, font-weight 400, `text-on-surface-muted`, no dot
   - `<time dateTime>` with sr-only absolute date
   - `aria-label` including read/unread state
   - **Use Tailwind theme tokens** (NOT hardcoded hex colors) — `bg-surface-lighter`, `bg-surface-light`, `text-on-surface-muted`

**Step 5: Commit**

```bash
git add src/features/notifications/components/
git commit -m "feat(notifications): add NotificationRow component with tests"
```

---

## Task 7: NotificationPanel Component + Tests

**Files:**
- Create: `src/features/notifications/components/NotificationPanel.tsx`
- Create: `src/features/notifications/components/__tests__/NotificationPanel.test.tsx`

The implementing agent should:

1. Write tests first covering: renders with role="dialog", aria-modal="true", focus panel on open, Escape closes panel, mark-all-read button calls markAllNotificationsRead, mark-all-read disabled while in-flight, empty state rendering, loading skeleton when notificationsReady is false, hides mark-all-read when all are read.

2. Implement a panel component accepting `open`, `onClose`, `bellRef` props:
   - `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
   - `w-[calc(100vw-24px)] max-w-[340px]`, `max-h-[55vh]`, `overflow-y-auto`
   - Header: "Notifications" + mark-all-read ghost button
   - `<ul role="list">` with `<For each={filteredNotifications()}>` rendering NotificationRow
   - Focus panel on open via `queueMicrotask`
   - Return focus to `bellRef` on close
   - Escape key handler
   - **Use Tailwind theme tokens** for all colors

**Step 5: Commit**

```bash
git add src/features/notifications/components/
git commit -m "feat(notifications): add NotificationPanel component with tests"
```

---

## Task 8: Bell Icon in TopNav

**Files:**
- Modify: `src/shared/components/TopNav.tsx`
- Modify: `src/shared/components/__tests__/TopNav.sync.test.tsx` (or new test file)
- Modify: `firestore.indexes.json` (APPEND — do NOT overwrite existing indexes)

The implementing agent should:

1. Add tests for: bell badge hidden when unread is 0, bell shows count 1-9, bell shows "9+" at 10+, bell opens panel on click, bell has correct ARIA attributes.

2. Modify TopNav.tsx:
   - Import `Bell` from `lucide-solid`
   - Import `unreadCount` from notification store
   - Add bell button before avatar button (inside `<Show when={user()}>`)
   - Bell button: `aria-label="Notifications"`, `aria-expanded`, `aria-haspopup="dialog"`
   - Badge: red circle, number (1-9, "9+"), hidden when 0
   - `<Show when={notifPanelOpen()}>` with backdrop + `<NotificationPanel>`
   - Live region announcer for new notifications

3. **APPEND** notification indexes to existing `firestore.indexes.json` (which already has 14 indexes). Add these 3 to the `indexes` array:

```json
{
  "collectionGroup": "notifications",
  "queryScope": "COLLECTION",
  "fields": [
    {"fieldPath": "read", "order": "ASCENDING"},
    {"fieldPath": "createdAt", "order": "DESCENDING"}
  ]
},
{
  "collectionGroup": "notifications",
  "queryScope": "COLLECTION",
  "fields": [
    {"fieldPath": "category", "order": "ASCENDING"},
    {"fieldPath": "createdAt", "order": "DESCENDING"}
  ]
},
{
  "collectionGroup": "notifications",
  "queryScope": "COLLECTION",
  "fields": [
    {"fieldPath": "expiresAt", "order": "ASCENDING"}
  ]
}
```

**Step 5: Commit**

```bash
git add src/shared/components/TopNav.tsx src/shared/components/__tests__/ firestore.indexes.json
git commit -m "feat(notifications): add bell icon with dropdown panel to TopNav"
```

---

## Task 9: Settings Page Notification Preferences

> **NEW task** — not in v1. Required by design doc.

**Files:**
- Modify: `src/features/settings/SettingsPage.tsx`
- Create or modify: `src/features/settings/__tests__/SettingsPage.notify.test.tsx`

The implementing agent should:

1. Write tests first: toggles render with correct initial state, toggling updates settingsStore, all 4 categories present.

2. Add a "Notifications" section to SettingsPage with 4 toggle switches:
   - Buddy activity (key: `notifyBuddy`)
   - Tournament updates (key: `notifyTournament`)
   - Achievements (key: `notifyAchievement`)
   - Stats changes (key: `notifyStats`)
   - Use the existing `OptionCard` component pattern from the Settings page
   - Show only when user is signed in (`<Show when={user()}>`)

**Step 4: Commit**

```bash
git add src/features/settings/
git commit -m "feat(notifications): add notification preference toggles to Settings page"
```

---

## Task 10: Achievement Toast Coordination + Tests

**Files:**
- Modify: `src/features/achievements/store/achievementStore.ts`
- Modify: `src/shared/hooks/useAuth.ts`
- Add tests for the coordination

**Step 1: Write the failing tests**

Test that `onToastDismissed` callback is invoked when `dismissToast` is called:

```typescript
// In achievementStore test file:
it('dismissToast calls onToastDismissed callbacks with achievementId', () => {
  const cb = vi.fn();
  onToastDismissed(cb);

  enqueueToast({ achievementId: 'test', name: 'Test', description: 'Desc', icon: '🏆', tier: 'gold' });
  const toast = pendingToasts()[0];
  dismissToast(toast.id);

  expect(cb).toHaveBeenCalledWith('test');
});

it('multiple callbacks are all invoked', () => {
  const cb1 = vi.fn();
  const cb2 = vi.fn();
  onToastDismissed(cb1);
  onToastDismissed(cb2);

  enqueueToast({ achievementId: 'test', name: 'Test', description: 'Desc', icon: '🏆', tier: 'gold' });
  dismissToast(pendingToasts()[0].id);

  expect(cb1).toHaveBeenCalledWith('test');
  expect(cb2).toHaveBeenCalledWith('test');
});
```

**Step 2: Run tests to verify they fail**

**Step 3: Add callback registration to achievementStore.ts**

```typescript
type ToastDismissCallback = (achievementId: string) => void;
const _onDismissCallbacks: ToastDismissCallback[] = [];

export function onToastDismissed(cb: ToastDismissCallback): void {
  _onDismissCallbacks.push(cb);
}
```

Update `dismissToast` to call callbacks:

```typescript
export function dismissToast(id: string): void {
  const toast = pendingToasts().find(t => t.id === id);
  if (toast) {
    _onDismissCallbacks.forEach(cb => cb(toast.achievementId));
  }
  setPendingToasts(prev => prev.filter(t => t.id !== id));
}
```

**Step 4: Register callback in useAuth.ts**

In the sign-in block, add (with a one-time guard):

```typescript
import { onToastDismissed } from '../../features/achievements/store/achievementStore';
import { notifications, markNotificationRead } from '../../features/notifications/store/notificationStore';

let _toastCallbackRegistered = false;

// Inside sign-in block:
if (!_toastCallbackRegistered) {
  _toastCallbackRegistered = true;
  onToastDismissed((achievementId) => {
    const uid = user()?.uid;
    if (!uid) return;
    const notifs = notifications();
    const match = notifs.find(n => n.type === 'achievement_unlocked' && n.payload.achievementId === achievementId);
    if (match) {
      markNotificationRead(uid, match.id).catch(() => {});
    }
  });
}
```

**Step 5: Run tests to verify they pass**

**Step 6: Commit**

```bash
git add src/features/achievements/store/achievementStore.ts src/shared/hooks/useAuth.ts src/features/achievements/store/__tests__/
git commit -m "feat(notifications): coordinate achievement toast dismiss with notification read"
```

---

## Task 11: Migrate Buddy Notification Write Sites

> **NEW task** — not in v1. Critical: without this, the bell never shows buddy activity.

**Files:**
- Create: `src/features/notifications/engine/firestoreNotificationWriter.ts`
- Modify: `src/features/buddies/CreateSessionPage.tsx`
- Modify: `src/features/buddies/SessionDetailPage.tsx`

**Migration decisions (per design doc "Deferred Types"):**
- `player_joined` → **Remove**. Intentionally deferred due to O(n²) notification fatigue. Delete the call site in `SessionDetailPage.tsx` line 372-377.
- `voting_reminder` → **Keep old helper for now** (deferred; no call sites actively write it, so no migration needed).

**Step 1: Write the notification writer**

Create `src/features/notifications/engine/firestoreNotificationWriter.ts`:

```typescript
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from '../../../data/firebase/config';
import type { AppNotification } from '../../../data/types';

export async function writeNotification(notif: AppNotification): Promise<void> {
  const ref = doc(firestore, 'users', notif.userId, 'notifications', notif.id);
  await setDoc(ref, notif);
}
```

**Step 2: Update CreateSessionPage.tsx**

Replace:
```typescript
import { firestoreBuddyNotificationRepository } from '../../data/firebase/firestoreBuddyNotificationRepository';
import { createSessionProposedNotification } from '../buddies/engine/notificationHelpers';
```
With:
```typescript
import { writeNotification } from '../notifications/engine/firestoreNotificationWriter';
import { createSessionProposedNotif } from '../notifications/engine/notificationHelpers';
```

Replace the notification write call (~line 170):
```typescript
firestoreBuddyNotificationRepository.create(
  createSessionProposedNotification(m.userId, creatorName, session.title, session.id, params.groupId),
)
```
With:
```typescript
writeNotification(
  createSessionProposedNotif(m.userId, creatorName, session.title, session.id, params.groupId),
)
```

**Step 3: Update SessionDetailPage.tsx**

Replace imports similarly. Then:

- **Remove** the `player_joined` notification write (lines 372-377). This is intentionally deferred per design doc.
- **Update** `session_confirmed` write (~line 383-384) to use `createSessionConfirmedNotif` + `writeNotification`
- **Update** `spot_opened` write (~line 400-403) to use `createSpotOpenedNotif` + `writeNotification`

**Step 4: Run type check + all tests**

```bash
npx tsc --noEmit && npx vitest run
```

**Step 5: Commit**

```bash
git add src/features/notifications/engine/firestoreNotificationWriter.ts src/features/buddies/CreateSessionPage.tsx src/features/buddies/SessionDetailPage.tsx
git commit -m "feat(notifications): migrate buddy write sites to unified notification collection"
```

---

## Task 12: Migrate BottomNav + Delete useBuddyNotifications Hook

**Files:**
- Modify: `src/shared/components/BottomNav.tsx`
- Delete: `src/features/buddies/hooks/useBuddyNotifications.ts`
- Delete: `src/features/buddies/hooks/__tests__/useBuddyNotifications.test.ts` (if exists)

**Step 1: Update BottomNav imports**

Replace:
```typescript
import { useBuddyNotifications } from '../../features/buddies/hooks/useBuddyNotifications';
```
With:
```typescript
import { buddyUnreadCount } from '../../features/notifications/store/notificationStore';
```

Remove the hook call:
```typescript
const { unreadCount } = useBuddyNotifications(() => user()?.uid);
```

Update the badge usage: change `unreadCount()` to `buddyUnreadCount()` in the JSX (the signal is imported directly, no hook call needed).

**Step 2: Delete the hook files**

```bash
rm src/features/buddies/hooks/useBuddyNotifications.ts
```

Delete the test file if it exists.

**Step 3: Run all tests**

```bash
npx vitest run
```

Expected: PASS (all existing tests still pass, or update any that import the deleted hook)

**Step 4: Commit**

```bash
git rm src/features/buddies/hooks/useBuddyNotifications.ts
git add src/shared/components/BottomNav.tsx
git commit -m "refactor(notifications): migrate BottomNav to buddyUnreadCount, delete useBuddyNotifications hook"
```

---

## Task 13: Bug Fixes + Tests

**Files:**
- Modify: `src/data/firebase/firestoreBuddyNotificationRepository.ts`
- Modify: `src/data/firebase/firestorePlayerStatsRepository.ts`
- Modify corresponding test files

### Fix 1: markAllRead limit(50) → limit(500)

**Step 1: Write the failing test**

In `src/data/firebase/__tests__/firestoreBuddyNotificationRepository.test.ts`, add:

```typescript
it('markAllRead uses limit(500) for batch max coverage', async () => {
  // ... verify mockLimit is called with 500
});
```

**Step 2: Run test — expect FAIL (still uses 50)**

**Step 3: In `firestoreBuddyNotificationRepository.ts`, change `markAllRead` to use `limit(500)`:**

Replace the `markAllRead` method:

```typescript
async markAllRead(userId: string): Promise<void> {
  const q = query(
    collection(firestore, 'users', userId, 'buddyNotifications'),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(500),
  );
  const snap = await getDocs(q);
  if (snap.docs.length === 0) return;
  const batch = writeBatch(firestore);
  for (const d of snap.docs) {
    batch.update(d.ref, { read: true });
  }
  await batch.commit();
},
```

### Fix 2: Phantom achievement toast on write failure

**Step 1: Write the failing test**

In `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts`, add:

```typescript
it('does not enqueue toast when achievement write fails', async () => {
  // Mock firestoreAchievementRepository.create to reject
  // Verify enqueueToast is NOT called for the failed achievement
});
```

**Step 2: Run test — expect FAIL**

**Step 3: In `firestorePlayerStatsRepository.ts`, track successfully written achievements:**

```typescript
const written: typeof unlocked = [];
for (const a of unlocked) {
  try {
    await firestoreAchievementRepository.create(uid, a);
    await firestoreAchievementRepository.cacheInDexie(a);
    written.push(a);
  } catch (writeErr) {
    console.warn('Failed to write achievement:', a.achievementId, writeErr);
  }
}

// Only toast successfully written achievements
if (uid === currentUserUid) {
  for (const a of written) {
    // ... enqueueToast
  }
}
```

**Step 4: Run all tests**

```bash
npx vitest run
```

**Step 5: Commit**

```bash
git add src/data/firebase/firestoreBuddyNotificationRepository.ts src/data/firebase/firestorePlayerStatsRepository.ts src/data/firebase/__tests__/
git commit -m "fix: markAllRead limit(500) and prevent phantom achievement toasts"
```

---

## Task 14: Integration Tests

**Files:**
- Create: `test/integration/notificationStore.integration.test.ts`

> **Note:** Integration tests go in `test/integration/` (not `src/`) because they require the Firestore emulator. The `vite.config.ts` excludes `test/rules/**` from default runs; integration tests should follow the same pattern. Add `test/integration/**` to the exclude list in `vite.config.ts` if not already present.

These tests use the Firestore emulator directly (same pattern as `test/rules/` tests). They verify:

1. `onSnapshot populates signals within 2s of document creation`
2. `markRead round-trip: write → snapshot re-fires → signal updates`
3. `markAllNotificationsRead with multiple items completes`
4. `cleanupExpiredNotifications deletes expired docs`
5. `Preference filter wired into filteredNotifications correctly`

The implementing agent should use `@firebase/rules-unit-testing` with `setupTestEnv()` and seed documents via `withSecurityRulesDisabled`.

**Commit:**

```bash
git add test/integration/ vite.config.ts
git commit -m "test(notifications): add integration tests against Firestore emulator"
```

---

## Task 15: E2E Tests

**Files:**
- Create: `e2e/notifications/notification-center.spec.ts`

10 E2E tests using Playwright against Firebase emulators:

1. `bell badge shows unread count after notification created`
2. `bell badge hidden when count is zero`
3. `dropdown opens and closes correctly`
4. `tap row marks read and navigates to actionUrl`
5. `mark all read clears badge`
6. `real-time notification arrives while dropdown is open`
7. `achievement toast fires and notification is marked read`
8. `expired notification absent after sign-in`
9. `preference-disabled category absent from panel`
10. `sign-out then sign-in different user shows no stale notifications`

The implementing agent should:
- Use `authenticatedPage` fixture from `e2e/fixtures.ts`
- Use `seedFirestoreDocAdmin` to seed `users/{uid}/notifications` collection
- Use `getCurrentUserUid` for the authenticated user's UID
- Use `page.getByLabel()` / `page.getByRole()` for accessible locators
- Use `{ timeout: 15000 }` for Firestore latency

**Commit:**

```bash
git add e2e/notifications/
git commit -m "test(notifications): add E2E tests for notification center"
```

---

## Task 16: Update Roadmap + Memory

**Files:**
- Modify: `docs/ROADMAP.md`
- Modify (auto-memory): `scoringapp.md`

**Step 1: Update ROADMAP.md**

Move Layer 5 from "Up Next" to "Completed":

```markdown
### Layer 5: Notifications & Engagement (In-App)
- [x] Unified notification collection (`users/{uid}/notifications/{id}`)
- [x] 12 notification types across 4 categories
- [x] Bell icon dropdown in TopNav with unread badge
- [x] NotificationPanel with mark-all-read, focus management, a11y
- [x] Module-level notification store (replaces useBuddyNotifications hook)
- [x] Firestore security rules with group membership + organizer checks
- [x] Achievement toast → notification read coordination
- [x] Client-side notification preferences (Settings page toggles)
- [x] Expired notification cleanup on sign-in
- [x] Buddy notification write-site migration (CreateSessionPage, SessionDetailPage)
- [x] Bug fixes: markAllRead limit, phantom achievement toast
- [x] ~120 tests (60 security rules, 20 store, 15 helpers, 12 components, 5 integration, 10 E2E)
```

**Step 2: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark Layer 5 notification center as complete"
```
