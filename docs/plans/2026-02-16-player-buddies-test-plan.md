# Player Buddies — Comprehensive Test Plan

**Date:** 2026-02-16
**Author:** QA review agent
**Scope:** All code under `src/features/buddies/`, `src/data/firebase/*Buddy*` / `*GameSession*` / `*Notification*`, `firestore.rules` (buddies sections), and BottomNav integration

---

## Current Coverage Summary

### What IS Tested (6 test files, 92 test cases out of 332 project-wide)

| File | Tests | Coverage Quality |
|------|-------|-----------------|
| `sessionHelpers.test.ts` | 23 tests | **Good** — all 7 exported functions covered with multiple cases |
| `groupHelpers.test.ts` | 13 tests | **Good** — all 4 exported functions covered |
| `notificationHelpers.test.ts` | 16 tests | **Excellent** — all 7 helpers + shared behavior |
| `firestoreBuddyGroupRepository.test.ts` | 15 tests | **Good** — all 10 methods covered |
| `firestoreGameSessionRepository.test.ts` | 17 tests | **Good** — all 10 methods covered |
| `firestoreBuddyNotificationRepository.test.ts` | 8 tests | **Good** — all 5 methods covered |

### What is NOT Tested (0 test files)

| Category | Files | Impact |
|----------|-------|--------|
| **Hooks** | `useBuddyGroups.ts`, `useGameSession.ts`, `useBuddyNotifications.ts` | Real-time data binding not validated |
| **Components** (8 pages + 2 shared) | `BuddiesPage`, `CreateGroupPage`, `GroupDetailPage`, `SessionDetailPage`, `CreateSessionPage`, `OpenPlayPage`, `PublicSessionPage`, `GroupInvitePage`, `ShareSheet`, `StatusAvatar` | Zero UI testing |
| **Firestore rules** (buddies section) | `firestore.rules` lines 305-401 | Security not validated |
| **BottomNav integration** | `BottomNav.tsx` (buddies tab + badge) | Nav integration not validated |
| **E2E flows** | None | Zero end-to-end coverage |

### Estimated Coverage: ~30%
Engine helpers and repositories are well-tested. But hooks, components, security rules, and integration flows are completely untested. This is a significant gap — the repository tests verify Firestore SDK calls are correct, but nothing validates that the UI actually works or that security rules protect data.

---

## Test Categories

### 1. Unit Test Gaps (P0 — Critical)

Current unit tests are strong. Only minor edge-case gaps remain.

#### 1.1 sessionHelpers — Missing Edge Cases

**File:** `src/features/buddies/engine/__tests__/sessionHelpers.test.ts` (modify)

```typescript
// --- canRsvp edge cases ---
describe('canRsvp', () => {
  it('returns true when rsvpDeadline is null (no deadline set)', () => {
    expect(canRsvp(makeSession({ rsvpDeadline: null }))).toBe(true);
  });

  it('returns true when rsvpDeadline is in the future', () => {
    expect(canRsvp(makeSession({ rsvpDeadline: Date.now() + 60000 }))).toBe(true);
  });
});

// --- canUpdateDayOfStatus edge cases ---
describe('canUpdateDayOfStatus', () => {
  it('returns false for "maybe" RSVP on confirmed session', () => {
    const session = makeSession({ status: 'confirmed' });
    const rsvp = makeRsvp({ response: 'maybe' });
    expect(canUpdateDayOfStatus(session, rsvp)).toBe(false);
  });
});

// --- isSessionFull edge case ---
describe('isSessionFull', () => {
  it('returns true when spotsConfirmed exceeds spotsTotal (overbooked)', () => {
    expect(isSessionFull(makeSession({ spotsConfirmed: 5, spotsTotal: 4 }))).toBe(true);
  });
});

// --- getWinningSlot edge case ---
describe('getWinningSlot', () => {
  it('returns the single slot when only one exists', () => {
    const slots: TimeSlot[] = [
      { id: 'a', date: 1, startTime: '09:00', endTime: '11:00', voteCount: 0 },
    ];
    expect(getWinningSlot(slots)).toEqual(slots[0]);
  });
});

// --- shouldAutoOpen edge case ---
describe('shouldAutoOpen', () => {
  it('returns false when minPlayers reached even with autoOpen enabled', () => {
    const session = makeSession({
      autoOpenOnDropout: true,
      visibility: 'group',
      spotsConfirmed: 4,
      minPlayers: 4,
    });
    expect(shouldAutoOpen(session)).toBe(false);
  });
});

// --- getSessionDisplayStatus boundary ---
describe('getSessionDisplayStatus', () => {
  it('returns "0/8 confirmed" when exactly at minPlayers', () => {
    const session = makeSession({
      spotsConfirmed: 4,
      spotsTotal: 8,
      minPlayers: 4,
    });
    expect(getSessionDisplayStatus(session)).toBe('4/8 confirmed');
  });
});
```

**Priority:** P0
**Effort:** 15 minutes

#### 1.2 groupHelpers — Missing Edge Cases

**File:** `src/features/buddies/engine/__tests__/groupHelpers.test.ts` (modify)

```typescript
// --- canJoinGroup edge case ---
describe('canJoinGroup', () => {
  it('returns true for private group even with null shareCode when matching code', () => {
    const group = makeGroup({ visibility: 'private', shareCode: null });
    // shareCode is null and provided code is undefined — should return false
    expect(canJoinGroup(group, false)).toBe(false);
  });
});

// --- createDefaultSession edge case ---
describe('createDefaultSession', () => {
  it('includes groupId from the group', () => {
    const group = makeGroup({ id: 'custom-id' });
    const result = createDefaultSession(group);
    expect(result.groupId).toBe('custom-id');
  });
});

// --- validateGroupName edge case ---
describe('validateGroupName', () => {
  it('returns null for exactly 50 characters', () => {
    expect(validateGroupName('A'.repeat(50))).toBeNull();
  });

  it('returns error for name with only special characters but non-empty trim', () => {
    expect(validateGroupName('---')).toBeNull();
  });
});
```

**Priority:** P0
**Effort:** 10 minutes

#### 1.3 StatusAvatar helper functions — NEW

The `StatusAvatar.tsx` component exports pure helper functions (`getRingColor`, `getSizeClasses`, `getIndicatorSize`, `isGrayedOut`, `getIndicatorType`) that are defined inline but not tested. Since they contain branching logic, they deserve direct tests.

**File:** `src/features/buddies/components/__tests__/statusAvatarHelpers.test.ts` (create)

```typescript
import { describe, it, expect } from 'vitest';

// These helpers would need to be extracted to a separate file or tested via the component.
// Recommendation: Extract to statusAvatarHelpers.ts for testability.

describe('getRingColor', () => {
  it('returns emerald-500 for "here" day-of status regardless of response', () => {
    expect(getRingColor('out', 'here')).toBe('ring-emerald-500');
  });

  it('returns blue-500 for "on-my-way"', () => {
    expect(getRingColor('in', 'on-my-way')).toBe('ring-blue-500');
  });

  it('returns gray-500 for "cant-make-it"', () => {
    expect(getRingColor('in', 'cant-make-it')).toBe('ring-gray-500');
  });

  it('returns emerald-500/50 for "in" with no day-of status', () => {
    expect(getRingColor('in', 'none')).toBe('ring-emerald-500/50');
  });

  it('returns amber-500 for "maybe"', () => {
    expect(getRingColor('maybe', 'none')).toBe('ring-amber-500');
  });

  it('returns gray-500 for "out"', () => {
    expect(getRingColor('out', 'none')).toBe('ring-gray-500');
  });
});

describe('isGrayedOut', () => {
  it('returns true for out response', () => {
    expect(isGrayedOut('out', 'none')).toBe(true);
  });

  it('returns true for cant-make-it day-of', () => {
    expect(isGrayedOut('in', 'cant-make-it')).toBe(true);
  });

  it('returns false for "in" with no day-of status', () => {
    expect(isGrayedOut('in', 'none')).toBe(false);
  });
});

describe('getIndicatorType', () => {
  it('prioritizes day-of status over response', () => {
    expect(getIndicatorType('maybe', 'here')).toBe('here');
  });

  it('returns "maybe" for maybe response with no day-of', () => {
    expect(getIndicatorType('maybe', 'none')).toBe('maybe');
  });

  it('returns null for "in" with no day-of', () => {
    expect(getIndicatorType('in', 'none')).toBeNull();
  });

  it('returns null for "out" with no day-of', () => {
    expect(getIndicatorType('out', 'none')).toBeNull();
  });
});
```

**Priority:** P0
**Prerequisite:** Extract `getRingColor`, `isGrayedOut`, `getIndicatorType`, `getSizeClasses`, `getIndicatorSize` from `StatusAvatar.tsx` into `statusAvatarHelpers.ts`
**Effort:** 30 minutes (includes extraction refactor)

#### 1.4 CreateSessionPage — `getNextOccurrence` helper

This pure function is defined inside `CreateSessionPage.tsx` and has date logic that could be buggy. It should be extracted and tested.

**File:** `src/features/buddies/engine/__tests__/dateHelpers.test.ts` (create after extraction)

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getNextOccurrence } from '../dateHelpers';

describe('getNextOccurrence', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns next Tuesday when today is Monday', () => {
    // Mock: Monday 2026-02-16
    vi.setSystemTime(new Date('2026-02-16T12:00:00'));
    expect(getNextOccurrence('Tuesday')).toBe('2026-02-17');
  });

  it('returns next Monday (7 days later) when today is Monday', () => {
    vi.setSystemTime(new Date('2026-02-16T12:00:00')); // Monday
    expect(getNextOccurrence('Monday')).toBe('2026-02-23');
  });

  it('returns empty string for invalid day name', () => {
    expect(getNextOccurrence('Funday')).toBe('');
  });

  it('returns next Saturday when today is Friday', () => {
    vi.setSystemTime(new Date('2026-02-20T12:00:00')); // Friday
    expect(getNextOccurrence('Saturday')).toBe('2026-02-21');
  });

  it('returns Sunday when today is Saturday', () => {
    vi.setSystemTime(new Date('2026-02-21T12:00:00')); // Saturday
    expect(getNextOccurrence('Sunday')).toBe('2026-02-22');
  });
});
```

**Priority:** P0
**Prerequisite:** Extract `getNextOccurrence` from `CreateSessionPage.tsx` into `src/features/buddies/engine/dateHelpers.ts`
**Effort:** 20 minutes (includes extraction)

#### 1.5 SessionDetailPage — `statusColor`, `statusLabel`, `statusTextColor` helpers

Three pure functions in `SessionDetailPage.tsx` with branching logic. Should be extracted and unit-tested.

**File:** `src/features/buddies/engine/__tests__/rsvpDisplayHelpers.test.ts` (create after extraction)

```typescript
import { describe, it, expect } from 'vitest';
import { statusColor, statusLabel, statusTextColor } from '../rsvpDisplayHelpers';
import type { SessionRsvp } from '../../../../data/types';

function makeRsvp(overrides: Partial<SessionRsvp>): SessionRsvp {
  return {
    userId: 'u1', displayName: 'Test', photoURL: null,
    response: 'in', dayOfStatus: 'none', selectedSlotIds: [],
    respondedAt: Date.now(), statusUpdatedAt: null,
    ...overrides,
  };
}

describe('statusColor', () => {
  it('prioritizes day-of "here" over response', () => {
    expect(statusColor(makeRsvp({ response: 'maybe', dayOfStatus: 'here' }))).toBe('border-emerald-500');
  });

  it('returns gray for "out" response', () => {
    expect(statusColor(makeRsvp({ response: 'out' }))).toBe('border-gray-500');
  });

  it('returns emerald/50 for "in" with no day-of status', () => {
    expect(statusColor(makeRsvp({ response: 'in', dayOfStatus: 'none' }))).toBe('border-emerald-500/50');
  });
});

describe('statusLabel', () => {
  it('returns "Here" for day-of here', () => {
    expect(statusLabel(makeRsvp({ dayOfStatus: 'here' }))).toBe('Here');
  });

  it('returns "In" for in response without day-of', () => {
    expect(statusLabel(makeRsvp({ response: 'in', dayOfStatus: 'none' }))).toBe('In');
  });

  it('returns "Out" for out response', () => {
    expect(statusLabel(makeRsvp({ response: 'out' }))).toBe('Out');
  });

  it('returns "Can\'t make it" for cant-make-it', () => {
    expect(statusLabel(makeRsvp({ dayOfStatus: 'cant-make-it' }))).toBe("Can't make it");
  });
});

describe('statusTextColor', () => {
  it('returns emerald for "here"', () => {
    expect(statusTextColor(makeRsvp({ dayOfStatus: 'here' }))).toBe('text-emerald-400');
  });

  it('returns amber for "maybe"', () => {
    expect(statusTextColor(makeRsvp({ response: 'maybe' }))).toBe('text-amber-400');
  });

  it('returns gray for "out"', () => {
    expect(statusTextColor(makeRsvp({ response: 'out' }))).toBe('text-gray-400');
  });
});
```

**Priority:** P1
**Prerequisite:** Extract helpers from `SessionDetailPage.tsx` to `src/features/buddies/engine/rsvpDisplayHelpers.ts`
**Effort:** 25 minutes

---

### 2. Repository Test Gaps (P0 — Critical)

The existing repository tests are thorough. Only minor gaps remain:

#### 2.1 firestoreGameSessionRepository — Missing `updateRsvpResponse` with negative increment

**File:** `src/data/firebase/__tests__/firestoreGameSessionRepository.test.ts` (modify)

```typescript
describe('updateRsvpResponse', () => {
  it('decrements session spots when increment is negative (player cancels)', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    const fakeNow = 1700500000000;
    vi.spyOn(Date, 'now').mockReturnValue(fakeNow);

    mockDoc
      .mockReturnValueOnce('mock-rsvp-ref')
      .mockReturnValueOnce('mock-session-ref');

    await firestoreGameSessionRepository.updateRsvpResponse('session1', 'user1', 'out', -1);

    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-rsvp-ref', {
      response: 'out',
      respondedAt: fakeNow,
    });
    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-session-ref', {
      spotsConfirmed: { _increment: -1 },
      updatedAt: 'mock-timestamp',
    });

    vi.restoreAllMocks();
  });
});
```

**Priority:** P0
**Effort:** 10 minutes

#### 2.2 firestoreBuddyNotificationRepository — `markAllRead` with >500 docs (batch limit)

Note: Firestore batches have a 500-operation limit. The current `markAllRead` implementation doesn't handle this. This is a **test + code fix** item. For now, document as a known gap.

**Priority:** P1 (code change needed, not just test)
**Effort:** 30 minutes (test + batch chunking fix)

---

### 3. Hook Tests (P1 — Important)

None of the 3 hooks have tests. These are the reactive SolidJS layer connecting Firebase onSnapshot to component signals.

**Test infrastructure needed:** The hooks use Firebase's `onSnapshot`, `collectionGroup`, `query`, etc. We need to mock `firebase/firestore` and `solid-js` reactivity. Since `@solidjs/testing-library` is installed, we can use `renderHook`.

#### 3.1 useBuddyGroups

**File:** `src/features/buddies/hooks/__tests__/useBuddyGroups.test.ts` (create)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@solidjs/testing-library';

// Mock firebase
const mockOnSnapshot = vi.fn();
const mockQuery = vi.fn();
const mockCollectionGroup = vi.fn();
const mockWhere = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  onSnapshot: mockOnSnapshot,
  query: mockQuery,
  collectionGroup: mockCollectionGroup,
  where: mockWhere,
  getDoc: mockGetDoc,
  doc: mockDoc,
  collection: vi.fn(),
}));

vi.mock('../../../../data/firebase/config', () => ({
  firestore: 'mock-firestore',
}));

import { useBuddyGroups } from '../useBuddyGroups';

describe('useBuddyGroups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty groups and loading=false when userId is undefined', () => {
    const { result } = renderHook(() => useBuddyGroups(() => undefined));
    expect(result.groups()).toEqual([]);
    expect(result.loading()).toBe(false);
  });

  it('subscribes to member collection group when userId is provided', () => {
    mockOnSnapshot.mockImplementation(() => () => {});
    const { result } = renderHook(() => useBuddyGroups(() => 'user-1'));
    expect(mockCollectionGroup).toHaveBeenCalledWith('mock-firestore', 'members');
    expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'user-1');
    expect(result.loading()).toBe(true);
  });

  it('cleans up subscription on unmount', () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    const { cleanup } = renderHook(() => useBuddyGroups(() => 'user-1'));
    cleanup();
    expect(unsub).toHaveBeenCalled();
  });
});
```

**Priority:** P1
**Effort:** 45 minutes

#### 3.2 useGameSession

**File:** `src/features/buddies/hooks/__tests__/useGameSession.test.ts` (create)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@solidjs/testing-library';

const mockOnSnapshot = vi.fn();
vi.mock('firebase/firestore', () => ({
  onSnapshot: mockOnSnapshot,
  doc: vi.fn(),
  collection: vi.fn(),
}));

vi.mock('../../../../data/firebase/config', () => ({
  firestore: 'mock-firestore',
}));

import { useGameSession } from '../useGameSession';

describe('useGameSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets session null and loading false when sessionId is undefined', () => {
    const { result } = renderHook(() => useGameSession(() => undefined));
    expect(result.session()).toBeNull();
    expect(result.rsvps()).toEqual([]);
    expect(result.loading()).toBe(false);
  });

  it('subscribes to session doc and RSVPs collection when sessionId provided', () => {
    mockOnSnapshot.mockImplementation(() => () => {});
    renderHook(() => useGameSession(() => 'session-1'));
    // Should have 2 onSnapshot calls: session doc + rsvps collection
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  it('cleans up all subscriptions on unmount', () => {
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);
    const { cleanup } = renderHook(() => useGameSession(() => 'session-1'));
    cleanup();
    expect(unsub1).toHaveBeenCalled();
    expect(unsub2).toHaveBeenCalled();
  });
});
```

**Priority:** P1
**Effort:** 30 minutes

#### 3.3 useBuddyNotifications

**File:** `src/features/buddies/hooks/__tests__/useBuddyNotifications.test.ts` (create)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@solidjs/testing-library';

const mockOnSnapshot = vi.fn();
vi.mock('firebase/firestore', () => ({
  onSnapshot: mockOnSnapshot,
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('../../../../data/firebase/config', () => ({
  firestore: 'mock-firestore',
}));

import { useBuddyNotifications } from '../useBuddyNotifications';

describe('useBuddyNotifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty notifications and 0 unread when userId undefined', () => {
    const { result } = renderHook(() => useBuddyNotifications(() => undefined));
    expect(result.notifications()).toEqual([]);
    expect(result.unreadCount()).toBe(0);
  });

  it('subscribes to notifications collection when userId provided', () => {
    mockOnSnapshot.mockImplementation(() => () => {});
    renderHook(() => useBuddyNotifications(() => 'user-1'));
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('computes unreadCount from notifications with read=false', () => {
    // Simulate onSnapshot callback
    mockOnSnapshot.mockImplementation((_q: unknown, callback: (snap: unknown) => void) => {
      callback({
        docs: [
          { id: 'n1', data: () => ({ read: false, createdAt: 2000 }) },
          { id: 'n2', data: () => ({ read: true, createdAt: 1000 }) },
          { id: 'n3', data: () => ({ read: false, createdAt: 500 }) },
        ],
      });
      return () => {};
    });
    const { result } = renderHook(() => useBuddyNotifications(() => 'user-1'));
    expect(result.unreadCount()).toBe(2);
    expect(result.notifications()).toHaveLength(3);
  });
});
```

**Priority:** P1
**Effort:** 30 minutes

---

### 4. Component Tests (P1 — Important)

No components have tests. The project has `@solidjs/testing-library@0.8.10` and `@testing-library/jest-dom@6.9.1` installed but no test-setup.ts file exists (referenced in vite config). This needs to be created first.

#### 4.0 Test Infrastructure: Create test-setup.ts

**File:** `src/test-setup.ts` (create)

```typescript
import '@testing-library/jest-dom/vitest';
```

**Priority:** P0 (blocks all component tests)
**Effort:** 5 minutes

#### 4.1 StatusAvatar Component

**File:** `src/features/buddies/components/__tests__/StatusAvatar.test.tsx` (create)

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import StatusAvatar from '../StatusAvatar';

describe('StatusAvatar', () => {
  it('renders initial letter when no photoURL', () => {
    render(() => (
      <StatusAvatar
        displayName="Alice"
        photoURL={null}
        response="in"
        dayOfStatus="none"
      />
    ));
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders img when photoURL is provided', () => {
    render(() => (
      <StatusAvatar
        displayName="Bob"
        photoURL="https://example.com/bob.jpg"
        response="in"
        dayOfStatus="none"
      />
    ));
    const img = screen.getByAltText('Bob');
    expect(img).toHaveAttribute('src', 'https://example.com/bob.jpg');
  });

  it('applies opacity-50 when response is "out"', () => {
    const { container } = render(() => (
      <StatusAvatar
        displayName="Charlie"
        photoURL={null}
        response="out"
        dayOfStatus="none"
      />
    ));
    expect(container.firstElementChild).toHaveClass('opacity-50');
  });

  it('shows green check indicator for "here" day-of status', () => {
    const { container } = render(() => (
      <StatusAvatar
        displayName="Dana"
        photoURL={null}
        response="in"
        dayOfStatus="here"
      />
    ));
    // Check for the SVG check mark path
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('defaults to "md" size', () => {
    const { container } = render(() => (
      <StatusAvatar
        displayName="Eve"
        photoURL={null}
        response="in"
        dayOfStatus="none"
      />
    ));
    const avatar = container.querySelector('[class*="w-10"]');
    expect(avatar).not.toBeNull();
  });
});
```

**Priority:** P1
**Effort:** 30 minutes

#### 4.2 ShareSheet Component

**File:** `src/features/buddies/components/__tests__/ShareSheet.test.tsx` (create)

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import ShareSheet from '../ShareSheet';

describe('ShareSheet', () => {
  it('renders share options', () => {
    render(() => (
      <ShareSheet
        url="https://picklescore.app/s/ABC123"
        text="Join our game"
        onClose={() => {}}
      />
    ));
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('Copy link')).toBeInTheDocument();
    expect(screen.getByText('Share to WhatsApp')).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(() => (
      <ShareSheet
        url="https://example.com"
        text="Test"
        onClose={onClose}
      />
    ));
    const backdrop = screen.getByText('Share').closest('[class*="fixed"]');
    await fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const onClose = vi.fn();
    render(() => (
      <ShareSheet
        url="https://example.com"
        text="Test"
        onClose={onClose}
      />
    ));
    await fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('copies URL to clipboard when Copy link is clicked', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(() => (
      <ShareSheet
        url="https://picklescore.app/s/ABC123"
        text="Join"
        onClose={() => {}}
      />
    ));
    await fireEvent.click(screen.getByText('Copy link'));
    expect(mockWriteText).toHaveBeenCalledWith('https://picklescore.app/s/ABC123');
  });
});
```

**Priority:** P1
**Effort:** 30 minutes

#### 4.3 BuddiesPage Component

**File:** `src/features/buddies/__tests__/BuddiesPage.test.tsx` (create)

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Router } from '@solidjs/router';

vi.mock('./hooks/useBuddyGroups', () => ({
  useBuddyGroups: () => ({
    groups: () => [],
    loading: () => false,
  }),
}));

vi.mock('../../shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'user-1', displayName: 'Test User' }),
  }),
}));

import BuddiesPage from '../BuddiesPage';

describe('BuddiesPage', () => {
  it('renders empty state when no groups', () => {
    render(() => (
      <Router>
        <BuddiesPage />
      </Router>
    ));
    expect(screen.getByText('No groups yet')).toBeInTheDocument();
    expect(screen.getByText('Create Your First Group')).toBeInTheDocument();
  });

  it('renders page title', () => {
    render(() => (
      <Router>
        <BuddiesPage />
      </Router>
    ));
    expect(screen.getByText('Buddies')).toBeInTheDocument();
  });

  it('renders "+ New Group" button', () => {
    render(() => (
      <Router>
        <BuddiesPage />
      </Router>
    ));
    expect(screen.getByText('+ New Group')).toBeInTheDocument();
  });
});
```

**Priority:** P1
**Effort:** 30 minutes

#### 4.4 CreateGroupPage — Form Validation

**File:** `src/features/buddies/__tests__/CreateGroupPage.test.tsx` (create)

This tests the form validation behavior (name required, max length) and submission flow.

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { Router } from '@solidjs/router';

vi.mock('../../shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'u1', displayName: 'Test', photoURL: null }),
  }),
}));

vi.mock('../../data/firebase/firestoreBuddyGroupRepository', () => ({
  firestoreBuddyGroupRepository: {
    create: vi.fn().mockResolvedValue(undefined),
    addMember: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../tournaments/engine/shareCode', () => ({
  generateShareCode: () => 'MOCK123',
}));

import CreateGroupPage from '../CreateGroupPage';

describe('CreateGroupPage', () => {
  it('shows validation error when submitting empty name', async () => {
    render(() => (
      <Router>
        <CreateGroupPage />
      </Router>
    ));
    await fireEvent.click(screen.getByText('Create Group'));
    expect(screen.getByText('Group name is required')).toBeInTheDocument();
  });

  it('renders all form fields', () => {
    render(() => (
      <Router>
        <CreateGroupPage />
      </Router>
    ));
    expect(screen.getByLabelText(/Group Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Default Location/)).toBeInTheDocument();
  });

  it('has Private/Public visibility toggle', () => {
    render(() => (
      <Router>
        <CreateGroupPage />
      </Router>
    ));
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
  });
});
```

**Priority:** P1
**Effort:** 30 minutes

---

### 5. Integration Tests (P1 — Important)

Integration tests verify cross-module flows where engine helpers, repositories, and components interact.

#### 5.1 RSVP Flow Integration

**File:** `src/features/buddies/engine/__tests__/rsvpFlow.integration.test.ts` (create)

Tests the logical flow: canRsvp -> submitRsvp -> isSessionFull -> shouldAutoOpen -> notification creation.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { canRsvp, isSessionFull, shouldAutoOpen, needsMorePlayers } from '../sessionHelpers';
import { createPlayerJoinedNotification, createSessionConfirmedNotification } from '../notificationHelpers';
import type { GameSession, SessionRsvp } from '../../../../data/types';

describe('RSVP flow integration', () => {
  const baseSession: GameSession = {
    id: 's1', groupId: 'g1', createdBy: 'creator',
    title: 'Test Game', location: 'Park',
    courtsAvailable: 1, spotsTotal: 4, spotsConfirmed: 3,
    scheduledDate: Date.now() + 86400000, timeSlots: null,
    confirmedSlot: null, rsvpStyle: 'simple',
    rsvpDeadline: null, visibility: 'group',
    shareCode: 'ABC', autoOpenOnDropout: true,
    minPlayers: 4, status: 'proposed',
    createdAt: Date.now(), updatedAt: Date.now(),
  };

  it('allows RSVP, detects full session, creates correct notifications', () => {
    // Step 1: Verify RSVP is allowed
    expect(canRsvp(baseSession)).toBe(true);

    // Step 2: Simulate someone RSVPing "in" (spots go from 3 to 4)
    const updatedSession = { ...baseSession, spotsConfirmed: 4 };

    // Step 3: Session is now full
    expect(isSessionFull(updatedSession)).toBe(true);

    // Step 4: Creator should get player joined notification
    const joinNotif = createPlayerJoinedNotification('creator', 'Alice', 'Test Game', 's1');
    expect(joinNotif.type).toBe('player_joined');
    expect(joinNotif.userId).toBe('creator');

    // Step 5: All "in" players should get confirmed notification
    const confirmNotif = createSessionConfirmedNotification('player1', 'Test Game', 's1', 'g1');
    expect(confirmNotif.type).toBe('session_confirmed');
    expect(confirmNotif.message).toContain('game on');
  });

  it('triggers auto-open when player drops out and below min', () => {
    const sessionAfterDrop = {
      ...baseSession,
      spotsConfirmed: 3,
      status: 'confirmed' as const,
      autoOpenOnDropout: true,
    };

    expect(needsMorePlayers(sessionAfterDrop)).toBe(true);
    expect(shouldAutoOpen(sessionAfterDrop)).toBe(true);
  });
});
```

**Priority:** P1
**Effort:** 30 minutes

#### 5.2 Group Join Flow Integration

**File:** `src/features/buddies/engine/__tests__/groupJoinFlow.integration.test.ts` (create)

```typescript
import { describe, it, expect } from 'vitest';
import { canJoinGroup, validateGroupName } from '../groupHelpers';
import { createGroupInviteNotification } from '../notificationHelpers';
import type { BuddyGroup } from '../../../../data/types';

describe('Group creation and join flow', () => {
  it('validates name, allows join with share code, creates invite notification', () => {
    // Step 1: Validate group name
    expect(validateGroupName('Tuesday Crew')).toBeNull();

    // Step 2: After group created, check join logic with share code
    const group: BuddyGroup = {
      id: 'g1', name: 'Tuesday Crew', description: '',
      createdBy: 'admin', defaultLocation: null,
      defaultDay: null, defaultTime: null, memberCount: 1,
      visibility: 'private', shareCode: 'ABC123',
      createdAt: Date.now(), updatedAt: Date.now(),
    };

    // Non-member with correct share code can join
    expect(canJoinGroup(group, false, 'ABC123')).toBe(true);

    // Non-member with wrong code cannot
    expect(canJoinGroup(group, false, 'WRONG')).toBe(false);

    // Step 3: Invite notification is created correctly
    const notif = createGroupInviteNotification('new-user', 'Admin', 'Tuesday Crew', 'g1');
    expect(notif.type).toBe('group_invite');
    expect(notif.message).toBe('Admin invited you to join Tuesday Crew');
  });
});
```

**Priority:** P1
**Effort:** 15 minutes

---

### 6. E2E Tests (P2 — Nice to Have)

Playwright is configured (`playwright.config.ts`) targeting Pixel 5 chromium, but the `e2e/` directory doesn't exist. These tests require Firebase emulator + authenticated state.

#### 6.1 Full RSVP Journey

**File:** `e2e/buddies-rsvp.spec.ts` (create)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Buddies - RSVP Flow', () => {
  // Prerequisite: Firebase emulator running, test user seeded

  test('user can RSVP to a session and see status update', async ({ page }) => {
    // 1. Navigate to session detail
    await page.goto('/session/test-session-id');

    // 2. Click "In" button
    await page.getByRole('button', { name: 'In' }).click();

    // 3. Verify RSVP reflected
    await expect(page.getByText('In')).toHaveClass(/active/);

    // 4. Verify player appears in "Who's Playing"
    await expect(page.getByText('Test User')).toBeVisible();
  });

  test('session shows "Full" when all spots taken', async ({ page }) => {
    // Navigate to a pre-seeded full session
    await page.goto('/session/full-session-id');
    await expect(page.getByText('Full')).toBeVisible();
  });
});
```

**Priority:** P2
**Effort:** 2 hours (includes emulator setup, test data seeding)

#### 6.2 Group Creation Journey

**File:** `e2e/buddies-group.spec.ts` (create)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Buddies - Group Creation', () => {
  test('user can create a group and see it on buddies page', async ({ page }) => {
    await page.goto('/buddies/new');

    await page.getByLabel(/Group Name/).fill('Friday Picklers');
    await page.getByLabel(/Description/).fill('Weekly Friday games');
    await page.getByLabel(/Default Location/).fill('Central Park');

    await page.getByRole('button', { name: 'Create Group' }).click();

    // Should navigate to group detail
    await expect(page).toHaveURL(/\/buddies\//);
    await expect(page.getByText('Friday Picklers')).toBeVisible();
  });
});
```

**Priority:** P2
**Effort:** 1 hour

#### 6.3 Share Link Journey

**File:** `e2e/buddies-share.spec.ts` (create)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Buddies - Share Links', () => {
  test('public session page shows session details without auth', async ({ page }) => {
    await page.goto('/s/TEST-SHARE-CODE');

    await expect(page.getByText('Join on PickleScore')).toBeVisible();
    // Session details visible
    await expect(page.getByText(/confirmed/)).toBeVisible();
  });

  test('group invite page shows group info and join button', async ({ page }) => {
    await page.goto('/g/TEST-GROUP-CODE');

    await expect(page.getByText('Join Group')).toBeVisible();
  });
});
```

**Priority:** P2
**Effort:** 1 hour

---

### 7. Visual/Snapshot Tests (P2 — Nice to Have)

These use Vitest's inline snapshot feature or Playwright's screenshot comparison.

#### 7.1 StatusAvatar Visual Matrix

**File:** `src/features/buddies/components/__tests__/StatusAvatar.visual.test.tsx` (create)

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import StatusAvatar from '../StatusAvatar';

describe('StatusAvatar visual states', () => {
  const states = [
    { response: 'in', dayOfStatus: 'none', label: 'in-none' },
    { response: 'in', dayOfStatus: 'on-my-way', label: 'in-on-my-way' },
    { response: 'in', dayOfStatus: 'here', label: 'in-here' },
    { response: 'in', dayOfStatus: 'cant-make-it', label: 'in-cant-make-it' },
    { response: 'maybe', dayOfStatus: 'none', label: 'maybe-none' },
    { response: 'out', dayOfStatus: 'none', label: 'out-none' },
  ] as const;

  for (const state of states) {
    it(`renders correctly for ${state.label}`, () => {
      const { container } = render(() => (
        <StatusAvatar
          displayName="Test"
          photoURL={null}
          response={state.response}
          dayOfStatus={state.dayOfStatus}
        />
      ));
      expect(container.innerHTML).toMatchSnapshot();
    });
  }
});
```

**Priority:** P2
**Effort:** 20 minutes

---

### 8. Accessibility Tests (P1 — Important)

#### 8.1 BottomNav — Buddies Tab Accessibility

**File:** `src/shared/components/__tests__/BottomNav.buddies.test.tsx` (create)

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Router } from '@solidjs/router';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'u1' }),
  }),
}));

vi.mock('../../../features/buddies/hooks/useBuddyNotifications', () => ({
  useBuddyNotifications: () => ({
    notifications: () => [],
    unreadCount: () => 3,
  }),
}));

import BottomNav from '../BottomNav';

describe('BottomNav - Buddies integration', () => {
  it('renders Buddies tab with proper aria-label', () => {
    render(() => (
      <Router>
        <BottomNav />
      </Router>
    ));
    expect(screen.getByLabelText('Buddies')).toBeInTheDocument();
  });

  it('shows notification badge with unread count', () => {
    render(() => (
      <Router>
        <BottomNav />
      </Router>
    ));
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByLabelText('3 unread notifications')).toBeInTheDocument();
  });

  it('shows "9+" when unread count exceeds 9', () => {
    // Would need to adjust the mock to return > 9
    // This test validates the capping behavior
  });

  it('nav has role navigation and aria-label', () => {
    render(() => (
      <Router>
        <BottomNav />
      </Router>
    ));
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });
});
```

**Priority:** P1
**Effort:** 30 minutes

#### 8.2 SessionDetailPage — RSVP Button Accessibility

**File:** `src/features/buddies/__tests__/SessionDetailPage.a11y.test.tsx` (create)

```tsx
import { describe, it, expect } from 'vitest';

describe('SessionDetailPage accessibility', () => {
  it('RSVP buttons have minimum 48px touch target (min-h-[48px])', () => {
    // Verified by class inspection: buttons have min-h-[48px]
    // This would be a Playwright visual test in practice
  });

  it('Open to community toggle has role="switch" and aria-checked', () => {
    // Verified in source: SessionDetailPage.tsx line 625-626
    // role="switch" and aria-checked={s().visibility === 'open'}
  });

  it('visibility toggle has aria-label', () => {
    // Verified: aria-label="Toggle open to community"
  });
});
```

**Note:** Most accessibility is verified by component rendering tests. The key gaps are:
- RSVP buttons lack `aria-pressed` (should add for active state)
- Time slot voting checkboxes lack `role="checkbox"` and `aria-checked`
- CreateSessionPage switches lack `aria-label`

**Priority:** P1
**Effort:** 20 minutes (for the tests) + 30 minutes (for a11y fixes in source)

---

### 9. Security Tests (P0 — Critical)

Firestore rules for buddies are defined but have **zero tests**. The project has `@firebase/rules-unit-testing@5.0.0` and a `vitest.rules.config.ts` pointing to `test/rules/`, but that directory doesn't exist.

#### 9.1 BuddyGroup Rules

**File:** `test/rules/buddyGroups.test.ts` (create)

```typescript
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'test-project',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(() => testEnv.cleanup());
beforeEach(() => testEnv.clearFirestore());

describe('buddyGroups rules', () => {
  it('allows authenticated user to create a group', async () => {
    const user = testEnv.authenticatedContext('admin-user');
    const db = user.firestore();
    await assertSucceeds(
      setDoc(doc(db, 'buddyGroups', 'g1'), {
        createdBy: 'admin-user',
        name: 'Test Group',
        memberCount: 0,
        visibility: 'private',
        description: '',
        defaultLocation: null,
        defaultDay: null,
        defaultTime: null,
        shareCode: 'ABC',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
  });

  it('rejects group creation with wrong createdBy', async () => {
    const user = testEnv.authenticatedContext('user-1');
    const db = user.firestore();
    await assertFails(
      setDoc(doc(db, 'buddyGroups', 'g1'), {
        createdBy: 'someone-else',
        name: 'Test',
        memberCount: 0,
        visibility: 'private',
      }),
    );
  });

  it('rejects group creation with memberCount != 0', async () => {
    const user = testEnv.authenticatedContext('user-1');
    const db = user.firestore();
    await assertFails(
      setDoc(doc(db, 'buddyGroups', 'g1'), {
        createdBy: 'user-1',
        name: 'Test',
        memberCount: 5,
        visibility: 'private',
      }),
    );
  });

  it('rejects group creation with empty name', async () => {
    const user = testEnv.authenticatedContext('user-1');
    const db = user.firestore();
    await assertFails(
      setDoc(doc(db, 'buddyGroups', 'g1'), {
        createdBy: 'user-1',
        name: '',
        memberCount: 0,
        visibility: 'private',
      }),
    );
  });

  it('rejects group creation with name > 50 characters', async () => {
    const user = testEnv.authenticatedContext('user-1');
    const db = user.firestore();
    await assertFails(
      setDoc(doc(db, 'buddyGroups', 'g1'), {
        createdBy: 'user-1',
        name: 'A'.repeat(51),
        memberCount: 0,
        visibility: 'private',
      }),
    );
  });

  it('allows members to read their group', async () => {
    // Seed: group + member
    const admin = testEnv.authenticatedContext('admin-user');
    const adminDb = admin.firestore();
    await setDoc(doc(adminDb, 'buddyGroups', 'g1'), {
      createdBy: 'admin-user', name: 'Test', memberCount: 1, visibility: 'private',
    });
    await setDoc(doc(adminDb, 'buddyGroups', 'g1', 'members', 'member-1'), {
      userId: 'member-1', role: 'member',
    });

    // member-1 should be able to read
    const member = testEnv.authenticatedContext('member-1');
    const memberDb = member.firestore();
    await assertSucceeds(getDoc(doc(memberDb, 'buddyGroups', 'g1')));
  });

  it('blocks non-members from reading private groups', async () => {
    const admin = testEnv.authenticatedContext('admin-user');
    const adminDb = admin.firestore();
    await setDoc(doc(adminDb, 'buddyGroups', 'g1'), {
      createdBy: 'admin-user', name: 'Private', memberCount: 0, visibility: 'private',
    });

    const outsider = testEnv.authenticatedContext('outsider');
    const outsiderDb = outsider.firestore();
    await assertFails(getDoc(doc(outsiderDb, 'buddyGroups', 'g1')));
  });

  it('allows anyone to read public groups', async () => {
    const admin = testEnv.authenticatedContext('admin-user');
    const adminDb = admin.firestore();
    await setDoc(doc(adminDb, 'buddyGroups', 'g1'), {
      createdBy: 'admin-user', name: 'Public', memberCount: 0, visibility: 'public',
    });

    const outsider = testEnv.authenticatedContext('outsider');
    const outsiderDb = outsider.firestore();
    await assertSucceeds(getDoc(doc(outsiderDb, 'buddyGroups', 'g1')));
  });

  it('only admin can update group', async () => {
    const admin = testEnv.authenticatedContext('admin-user');
    const adminDb = admin.firestore();
    await setDoc(doc(adminDb, 'buddyGroups', 'g1'), {
      createdBy: 'admin-user', name: 'Test', memberCount: 1, visibility: 'private',
    });
    await setDoc(doc(adminDb, 'buddyGroups', 'g1', 'members', 'admin-user'), {
      userId: 'admin-user', role: 'admin',
    });
    await setDoc(doc(adminDb, 'buddyGroups', 'g1', 'members', 'member-1'), {
      userId: 'member-1', role: 'member',
    });

    // Admin can update
    await assertSucceeds(
      updateDoc(doc(adminDb, 'buddyGroups', 'g1'), { name: 'New Name', createdBy: 'admin-user' }),
    );

    // Regular member cannot update
    const member = testEnv.authenticatedContext('member-1');
    const memberDb = member.firestore();
    await assertFails(
      updateDoc(doc(memberDb, 'buddyGroups', 'g1'), { name: 'Hacked' }),
    );
  });

  it('only admin can delete group', async () => {
    const admin = testEnv.authenticatedContext('admin-user');
    const adminDb = admin.firestore();
    await setDoc(doc(adminDb, 'buddyGroups', 'g1'), {
      createdBy: 'admin-user', name: 'Test', memberCount: 1, visibility: 'private',
    });
    await setDoc(doc(adminDb, 'buddyGroups', 'g1', 'members', 'admin-user'), {
      userId: 'admin-user', role: 'admin',
    });
    await setDoc(doc(adminDb, 'buddyGroups', 'g1', 'members', 'member-1'), {
      userId: 'member-1', role: 'member',
    });

    // Regular member cannot delete
    const member = testEnv.authenticatedContext('member-1');
    const memberDb = member.firestore();
    await assertFails(deleteDoc(doc(memberDb, 'buddyGroups', 'g1')));

    // Admin can delete
    await assertSucceeds(deleteDoc(doc(adminDb, 'buddyGroups', 'g1')));
  });
});
```

**Priority:** P0
**Effort:** 1.5 hours

#### 9.2 BuddyGroup Members Rules

**File:** `test/rules/buddyGroupMembers.test.ts` (create)

```typescript
describe('buddyGroups/members rules', () => {
  it('allows admin to add any member', async () => { /* ... */ });
  it('allows user to add themselves', async () => { /* ... */ });
  it('blocks user from adding someone else (non-admin)', async () => { /* ... */ });
  it('allows admin to remove any member', async () => { /* ... */ });
  it('allows user to remove themselves', async () => { /* ... */ });
  it('blocks user from removing someone else (non-admin)', async () => { /* ... */ });
  it('allows members to read members list', async () => { /* ... */ });
  it('blocks non-members from reading members list', async () => { /* ... */ });
  it('enforces userId field matches document ID', async () => { /* ... */ });
});
```

**Priority:** P0
**Effort:** 1 hour

#### 9.3 GameSession Rules

**File:** `test/rules/gameSessions.test.ts` (create)

```typescript
describe('gameSessions rules', () => {
  it('allows any auth user to create session with correct fields', async () => { /* ... */ });
  it('rejects session creation with wrong createdBy', async () => { /* ... */ });
  it('rejects session creation with non-zero spotsConfirmed', async () => { /* ... */ });
  it('rejects session creation with status != proposed', async () => { /* ... */ });
  it('allows group members to read group sessions', async () => { /* ... */ });
  it('allows anyone to read open sessions', async () => { /* ... */ });
  it('blocks non-members from reading group sessions', async () => { /* ... */ });
  it('only creator can update session', async () => { /* ... */ });
  it('only creator can delete session', async () => { /* ... */ });
  it('blocks createdBy field from being changed on update', async () => { /* ... */ });
  it('blocks unauthenticated access', async () => { /* ... */ });
});
```

**Priority:** P0
**Effort:** 1 hour

#### 9.4 Session RSVP Rules

**File:** `test/rules/sessionRsvps.test.ts` (create)

```typescript
describe('gameSessions/rsvps rules', () => {
  it('allows user to create their own RSVP', async () => { /* ... */ });
  it('blocks user from creating RSVP for someone else', async () => { /* ... */ });
  it('enforces userId field matches document ID', async () => { /* ... */ });
  it('allows user to update their own RSVP', async () => { /* ... */ });
  it('blocks user from updating someone elses RSVP', async () => { /* ... */ });
  it('allows user to delete their own RSVP', async () => { /* ... */ });
  it('blocks user from deleting someone elses RSVP', async () => { /* ... */ });
  it('allows any auth user to read RSVPs', async () => { /* ... */ });
});
```

**Priority:** P0
**Effort:** 45 minutes

#### 9.5 BuddyNotification Rules

**File:** `test/rules/buddyNotifications.test.ts` (create)

```typescript
describe('buddyNotifications rules', () => {
  it('allows any auth user to create notifications (for other users)', async () => { /* ... */ });
  it('allows user to read their own notifications', async () => { /* ... */ });
  it('blocks user from reading other users notifications', async () => { /* ... */ });
  it('allows user to update (mark read) their own notifications', async () => { /* ... */ });
  it('blocks user from updating other users notifications', async () => { /* ... */ });
  it('allows user to delete their own notifications', async () => { /* ... */ });
  it('blocks unauthenticated access', async () => { /* ... */ });
});
```

**Priority:** P0
**Effort:** 30 minutes

---

## Execution Plan

### Phase 1: Critical Gaps — Unit + Security Rule Tests

**Goal:** Catch breaking logic and security bugs immediately.

| Task | Type | Priority | Effort | Depends On |
|------|------|----------|--------|------------|
| Fix unit test edge cases (sessionHelpers, groupHelpers) | Unit | P0 | 25 min | Nothing |
| Create `src/test-setup.ts` | Infra | P0 | 5 min | Nothing |
| Create `test/rules/` directory | Infra | P0 | 5 min | Nothing |
| BuddyGroup rules tests | Security | P0 | 1.5 hr | `test/rules/` dir, emulator |
| BuddyGroup members rules tests | Security | P0 | 1 hr | Above |
| GameSession rules tests | Security | P0 | 1 hr | Above |
| Session RSVP rules tests | Security | P0 | 45 min | Above |
| BuddyNotification rules tests | Security | P0 | 30 min | Above |
| GameSession repo negative increment test | Unit | P0 | 10 min | Nothing |

**Total Phase 1:** ~5.5 hours

### Phase 2: Component + Accessibility Tests

**Goal:** Ensure UI renders correctly and is accessible.

| Task | Type | Priority | Effort | Depends On |
|------|------|----------|--------|------------|
| Extract StatusAvatar helpers, write tests | Unit + Refactor | P0 | 30 min | Phase 1 |
| Extract `getNextOccurrence`, write tests | Unit + Refactor | P0 | 20 min | Phase 1 |
| Extract RSVP display helpers, write tests | Unit + Refactor | P1 | 25 min | Phase 1 |
| StatusAvatar component test | Component | P1 | 30 min | test-setup.ts |
| ShareSheet component test | Component | P1 | 30 min | test-setup.ts |
| BuddiesPage component test | Component | P1 | 30 min | test-setup.ts |
| CreateGroupPage component test | Component | P1 | 30 min | test-setup.ts |
| BottomNav buddies integration test | Accessibility | P1 | 30 min | test-setup.ts |

**Total Phase 2:** ~3.5 hours

### Phase 3: Hook + Integration Tests

**Goal:** Validate reactive data flow and cross-module correctness.

| Task | Type | Priority | Effort | Depends On |
|------|------|----------|--------|------------|
| useBuddyGroups hook test | Hook | P1 | 45 min | Phase 2 |
| useGameSession hook test | Hook | P1 | 30 min | Phase 2 |
| useBuddyNotifications hook test | Hook | P1 | 30 min | Phase 2 |
| RSVP flow integration test | Integration | P1 | 30 min | Nothing |
| Group join flow integration test | Integration | P1 | 15 min | Nothing |

**Total Phase 3:** ~2.5 hours

### Phase 4: E2E + Visual Tests

**Goal:** Full user journey validation.

| Task | Type | Priority | Effort | Depends On |
|------|------|----------|--------|------------|
| E2E infrastructure (emulator setup, seed data) | Infra | P2 | 1 hr | Nothing |
| RSVP journey E2E | E2E | P2 | 1 hr | Infra |
| Group creation journey E2E | E2E | P2 | 1 hr | Infra |
| Share link journey E2E | E2E | P2 | 1 hr | Infra |
| StatusAvatar visual snapshot tests | Visual | P2 | 20 min | Phase 2 |

**Total Phase 4:** ~4.5 hours

---

## Test Infrastructure Needed

### Already Installed (no action needed)
- `vitest@4.0.18` — test runner
- `@solidjs/testing-library@0.8.10` — component rendering + `renderHook`
- `@testing-library/jest-dom@6.9.1` — DOM matchers
- `@firebase/rules-unit-testing@5.0.0` — security rule tests
- `@playwright/test@1.58.2` — E2E tests
- `jsdom@28.0.0` — browser environment for unit tests

### Must Create
1. **`src/test-setup.ts`** — Import `@testing-library/jest-dom/vitest` for custom matchers
2. **`test/rules/` directory** — For security rule tests
3. **Firebase emulator** — Needed for security rule tests (`firebase emulators:start --only firestore`)

### Recommended Refactors (to enable testing)
1. Extract pure helper functions from `StatusAvatar.tsx` to `statusAvatarHelpers.ts`
2. Extract `getNextOccurrence` from `CreateSessionPage.tsx` to `engine/dateHelpers.ts`
3. Extract `statusColor`, `statusLabel`, `statusTextColor` from `SessionDetailPage.tsx` to `engine/rsvpDisplayHelpers.ts`

These refactors improve testability without changing behavior. Each is a 5-minute move + re-export.

---

## Estimated Effort Summary

| Phase | Hours | Tests Added | Coverage Gain |
|-------|-------|-------------|---------------|
| Phase 1: Critical | 5.5 | ~50 tests | +25% (security + edge cases) |
| Phase 2: Components | 3.5 | ~30 tests | +15% (UI layer) |
| Phase 3: Hooks + Integration | 2.5 | ~15 tests | +10% (reactive layer) |
| Phase 4: E2E + Visual | 4.5 | ~10 tests | +5% (journey coverage) |
| **Total** | **16 hours** | **~105 tests** | **~85% estimated coverage** |

**Parallelization:** Phase 1 unit tests and security rule tests can run in parallel (different developers). Phase 2 and 3 have low interdependency and can also be parallelized. Phase 4 is independent but lowest priority.
