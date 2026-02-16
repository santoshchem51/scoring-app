# Player Buddies — Review & Test Plan

**Date:** 2026-02-16
**Author:** Engineering Lead (synthesized from code review + test plan + source verification)

---

## Executive Summary

The Player Buddies feature is architecturally sound — clean engine/repository/UI layering, thorough engine tests, and faithful adherence to SolidJS conventions. However, **three critical bugs will cause runtime failures or data corruption**: `spotsConfirmed` is never incremented on first RSVP, `memberCount: 1` in group creation violates the security rule requiring `memberCount == 0`, and notification creation rules are wide open. Additionally, session links from two pages point to non-existent routes. Test coverage is ~30%: engine and repository layers are well-tested, but hooks, components, security rules, and integration flows have zero tests.

**Biggest risks:** I1 (group creation silently fails at runtime) and C1 (RSVP counter never updates) will break the two core flows. These must be fixed before any testing is meaningful.

---

## Implementation Quality

**Stats:** 24 files reviewed, ~2,800 lines of production code, 6 test files with ~65 tests covering engine helpers and repositories. SolidJS conventions followed correctly throughout (class not className, no prop destructuring, proper flow components). Design doc compliance is high — all data model interfaces match field-for-field, all specified routes exist, all 6 Firestore indexes present.

**Pattern compliance:** Repositories use the project's established Firestore patterns. Engine helpers are pure functions with no side effects. Components follow the premium UX bar (WAAPI animations, haptics, confetti, skeleton states). Real-time subscriptions use `onSnapshot` with `onCleanup`.

---

## Critical Bug Fixes (must fix before testing)

### BUG-1: Group creation fails at runtime (I1 — verified)

**File:** `src/features/buddies/CreateGroupPage.tsx:54`
**Problem:** The group object is constructed with `memberCount: 1`, but `firestore.rules:319` requires `request.resource.data.memberCount == 0`. Every group creation attempt will fail with a Firestore permission error.
**Fix:** Change `memberCount: 1` to `memberCount: 0`. The subsequent `addMember` call on line 71 will atomically increment it to 1.
**Severity:** BLOCKER — entire group creation flow is broken.

### BUG-2: spotsConfirmed never incremented on RSVP (C1 — verified)

**File:** `src/features/buddies/SessionDetailPage.tsx:379` + `src/data/firebase/firestoreGameSessionRepository.ts:55-57`
**Problem:** `handleRsvp` calls `submitRsvp`, which does a `setDoc` on the RSVP doc only. It never touches `spotsConfirmed` on the session. The `updateRsvpResponse` method (which does increment) is never called from any UI code. Result: the "4/8 confirmed" tracker never updates, the celebration trigger never fires, and the "Full" status badge never appears.
**Fix:** Two-part fix:
1. When a user RSVPs for the first time, call `submitRsvp` AND atomically increment `spotsConfirmed` when response is 'in'.
2. When a user changes their RSVP (has existing doc), call `updateRsvpResponse` with the correct delta (+1 for switching to 'in', -1 for switching away from 'in').
3. Ideally wrap both writes in a Firestore `writeBatch` or transaction to prevent drift.
**Severity:** CRITICAL — core RSVP tracking is non-functional.

### BUG-3: RSVP overwrites dayOfStatus and selectedSlotIds (I2 — verified)

**File:** `src/features/buddies/SessionDetailPage.tsx:368-377`
**Problem:** Every RSVP tap constructs a fresh `SessionRsvp` with `dayOfStatus: 'none'` and `statusUpdatedAt: null`. Since `submitRsvp` does `setDoc` (full overwrite), if a user already has an RSVP with day-of status or slot votes, those are wiped.
**Fix:** Check for existing RSVP before deciding which method to call. If the user already has an RSVP, use `updateRsvpResponse` to update only the `response` field and `spotsConfirmed`. This also resolves BUG-2's logic.
**Severity:** CRITICAL — data loss on re-RSVP.

### BUG-4: Session links navigate to non-existent routes (I6 — verified)

**File:** `src/features/buddies/GroupDetailPage.tsx:57` and `src/features/buddies/OpenPlayPage.tsx:23`
**Problem:** Both use `href={/buddies/session/${props.session.id}}`. No route `/buddies/session/:id` exists in `router.tsx`. The correct route is `/session/:sessionId` (line 55).
**Fix:** Change both to `href={/session/${props.session.id}}`.
**Severity:** HIGH — clicking any session card leads to a 404.

### BUG-5: Share URL uses shareCode as session ID (I5 — verified)

**File:** `src/features/buddies/SessionDetailPage.tsx:462`
**Problem:** `const shareUrl = ${window.location.origin}/session/${s.shareCode}` generates a URL like `/session/ABC123`. The `/session/:sessionId` route expects a UUID session ID, not a share code. The public route `/s/:code` (line 61 of router.tsx) is what resolves share codes.
**Fix:** Change to `const shareUrl = ${window.location.origin}/s/${s.shareCode}`.
**Severity:** HIGH — shared links are broken.

### BUG-6: Notification creation is wide open (C2 — verified)

**File:** `firestore.rules:391`
**Problem:** `allow create: if request.auth != null;` — any authenticated user can write arbitrary notification data into any other user's `buddyNotifications` subcollection. No validation on notification type, structure, or target user.
**Fix:** Either:
1. **(Recommended)** Remove the client-side `create` rule entirely. Move notification creation to Cloud Functions triggered by Firestore writes. This eliminates the security surface and guarantees delivery.
2. **(Quick fix)** Add validation: restrict `type` to the allowed enum, require `userId` in the doc to match the path's `{userId}`, and require `actorName` and `message` to be non-empty strings. This is still weak — it prevents random data injection but can't verify legitimacy.
**Severity:** CRITICAL — security vulnerability.

### BUG-7: addMember/removeMember are non-atomic (C3 — verified)

**File:** `src/data/firebase/firestoreBuddyGroupRepository.ts:34-37, 40-42`
**Problem:** Two sequential writes (member doc + group memberCount). If the first succeeds and the second fails, `memberCount` drifts from reality.
**Fix:** Use `writeBatch`:
```typescript
const batch = writeBatch(firestore);
batch.set(memberRef, member);
batch.update(groupRef, { memberCount: increment(1), updatedAt: serverTimestamp() });
await batch.commit();
```
**Severity:** HIGH — data inconsistency under failure conditions.

---

## Code Review Findings (remaining)

### Important Issues

| ID | Issue | File | Notes |
|----|-------|------|-------|
| I3 | Time-slot voteCount never updated | `SessionDetailPage.tsx:417-439` | `handleSlotVote` updates RSVP's `selectedSlotIds` but never adjusts `voteCount` on the `TimeSlot` objects. Voting display always shows 0. |
| I4 | `getByGroup` fetches all statuses | `firestoreGameSessionRepository.ts:26-34` | Works fine for small datasets; client-side split in GroupDetailPage handles it. Low priority. |
| I7 | No `onSnapshot` error callbacks | `useBuddyGroups.ts`, `useGameSession.ts`, `useBuddyNotifications.ts`, `GroupDetailPage.tsx`, `OpenPlayPage.tsx` | Loading state hangs forever on listener failure. |
| I8 | `canRsvp` doesn't check session full | `sessionHelpers.ts:3-7` | User can RSVP "in" to a full session, pushing `spotsConfirmed` above `spotsTotal`. |

### Minor Issues

| ID | Issue | File | Notes |
|----|-------|------|-------|
| M1 | Duplicated `formatSessionDate` | `GroupDetailPage.tsx:10-18`, `OpenPlayPage.tsx:9-17` | Extract to shared utility. |
| M2 | `.map()` instead of `<For>` for static array | `CreateGroupPage.tsx:147` | Works fine; `<For>` would be more idiomatic. |
| M3 | Side-effect in render via `groupData()` | `CreateSessionPage.tsx:72-76` | `createEffect` watching `group()` would be cleaner. |
| M4 | `statusUpdatedAt` uses `Date.now()` | `firestoreGameSessionRepository.ts:67` | Should use `serverTimestamp()` for consistency. |
| M5 | Missing `aria-label` on visibility toggles | `CreateGroupPage.tsx:172-185` | Accessibility gap. |
| M6 | Share code comparison is case-sensitive | `groupHelpers.ts:10` | User typing lowercase will fail. |
| M7 | Emoji characters in JSX | `PublicSessionPage.tsx:127`, `GroupInvitePage.tsx:104,123` | Per project rules, emojis only when explicitly requested. |

### Design Doc Gaps

| Item | Status |
|------|--------|
| `session_cancelled` notification | Factory exists, no UI trigger |
| `group_invite` notification | Factory exists, no UI trigger |
| `voting_reminder` notification | Factory exists, needs Cloud Function |
| `StatusAvatar` component | Built but not integrated into SessionDetailPage |

---

## Comprehensive Test Plan

### Phase 0: Fix Critical Bugs

All 7 bugs listed above must be fixed before testing can be meaningful. Tests written against broken code will either fail for the wrong reason or pass when they shouldn't.

**Execution order:**
1. BUG-1 (memberCount: 0) — 2 min, one-line change
2. BUG-4 (session link routes) — 2 min, two-line change
3. BUG-5 (share URL) — 2 min, one-line change
4. BUG-7 (atomic addMember/removeMember) — 10 min, writeBatch refactor
5. BUG-2 + BUG-3 (RSVP flow rewrite) — 30 min, refactor handleRsvp logic
6. BUG-6 (notification rules) — 15 min, add validation to firestore.rules

**Total Phase 0:** ~1 hour

### Phase 1: Security Rule Tests (P0)

**Infrastructure needed:**
- Create `test/rules/` directory
- Firebase emulator running (`firebase emulators:start --only firestore`)
- Uses existing `@firebase/rules-unit-testing@5.0.0` and `vitest.rules.config.ts`

#### 1.1 BuddyGroup Rules

**File:** `test/rules/buddyGroups.test.ts` (create)

Tests (~12 cases):
- Authenticated user can create group with valid fields
- Rejects creation with wrong `createdBy`
- Rejects creation with `memberCount != 0`
- Rejects creation with empty or >50 char name
- Members can read their group
- Non-members blocked from reading private groups
- Anyone can read public groups
- Admin can update group
- Regular member cannot update group
- Admin can delete group
- Regular member cannot delete
- `createdBy` field is immutable on update

#### 1.2 BuddyGroup Members Rules

**File:** `test/rules/buddyGroupMembers.test.ts` (create)

Tests (~9 cases):
- Admin can add any member
- User can add themselves
- Non-admin cannot add someone else
- Admin can remove any member
- User can remove themselves
- Non-admin cannot remove someone else
- Members can read members list
- Non-members cannot read members list
- `userId` field must match document ID

#### 1.3 GameSession Rules

**File:** `test/rules/gameSessions.test.ts` (create)

Tests (~11 cases):
- Authenticated user can create session with correct fields
- Rejects creation with wrong `createdBy`
- Rejects creation with `spotsConfirmed != 0`
- Rejects creation with `status != 'proposed'`
- Group members can read group sessions
- Anyone can read open sessions
- Non-members blocked from group sessions
- Creator can update session
- Creator can delete session
- `createdBy` is immutable on update
- Unauthenticated access blocked

#### 1.4 Session RSVP Rules

**File:** `test/rules/sessionRsvps.test.ts` (create)

Tests (~8 cases):
- User can create own RSVP
- Blocked from creating RSVP for someone else
- `userId` field must match document ID
- User can update own RSVP
- Blocked from updating others' RSVPs
- User can delete own RSVP
- Blocked from deleting others' RSVPs
- Any authenticated user can read RSVPs

#### 1.5 BuddyNotification Rules

**File:** `test/rules/buddyNotifications.test.ts` (create)

Tests (~7 cases, updated post-BUG-6 fix):
- Validates notification create rule (whatever the fix implements)
- User can read own notifications
- Blocked from reading others' notifications
- User can update (mark read) own notifications
- Blocked from updating others' notifications
- User can delete own notifications
- Unauthenticated access blocked

**Priority:** P0
**Effort:** ~4.5 hours total
**Validates:** BUG-1 (memberCount rule), BUG-6 (notification create rule), all security claims

### Phase 2: Unit Test Gaps (P0)

#### 2.1 Session Helper Edge Cases

**File:** `src/features/buddies/engine/__tests__/sessionHelpers.test.ts` (modify)

Add tests for:
- `canRsvp` with null deadline (returns true)
- `canRsvp` with future deadline (returns true)
- `canUpdateDayOfStatus` with 'maybe' response (returns false)
- `isSessionFull` with overbooked state (returns true)
- `getWinningSlot` with single slot
- `shouldAutoOpen` when `spotsConfirmed >= minPlayers` (returns false)
- `getSessionDisplayStatus` at exact `minPlayers` threshold

**Effort:** 15 min

#### 2.2 Group Helper Edge Cases

**File:** `src/features/buddies/engine/__tests__/groupHelpers.test.ts` (modify)

Add tests for:
- `canJoinGroup` with null shareCode and private group
- `createDefaultSession` includes correct groupId
- `validateGroupName` at exactly 50 characters (passes)
- `validateGroupName` with non-alphanumeric but non-empty string

**Effort:** 10 min

#### 2.3 Repository: updateRsvpResponse with negative increment

**File:** `src/data/firebase/__tests__/firestoreGameSessionRepository.test.ts` (modify)

Add test for decrement path (player cancels, increment = -1).

**Effort:** 10 min

#### 2.4 Repository: updateRsvpResponse with zero increment

Verify that when `spotsIncrement` is 0, the session doc is not updated (tests the `if (spotsIncrement !== 0)` guard at line 73).

**Effort:** 5 min

**Priority:** P0
**Total Effort:** ~40 min

### Phase 3: Component Tests (P1)

**Infrastructure needed:**
- Create `src/test-setup.ts` with `import '@testing-library/jest-dom/vitest';`
- Verify `vitest.config.ts` references it in `setupFiles`

#### 3.1 StatusAvatar Component

**File:** `src/features/buddies/components/__tests__/StatusAvatar.test.tsx` (create)

Tests: renders initial letter, renders img with photoURL, applies opacity for "out", shows indicator for "here", default size.

**Effort:** 30 min

#### 3.2 ShareSheet Component

**File:** `src/features/buddies/components/__tests__/ShareSheet.test.tsx` (create)

Tests: renders share options, calls onClose on backdrop click, calls onClose on cancel, copies URL to clipboard.

**Effort:** 30 min

#### 3.3 BuddiesPage Component

**File:** `src/features/buddies/__tests__/BuddiesPage.test.tsx` (create)

Tests: renders empty state, renders page title, renders "+ New Group" button.

**Effort:** 30 min

#### 3.4 CreateGroupPage — Form Validation

**File:** `src/features/buddies/__tests__/CreateGroupPage.test.tsx` (create)

Tests: shows validation error on empty name submit, renders all form fields, has visibility toggle.

**Effort:** 30 min

**Priority:** P1
**Total Effort:** ~2 hours

### Phase 4: Hook Tests (P1)

#### 4.1 useBuddyGroups

**File:** `src/features/buddies/hooks/__tests__/useBuddyGroups.test.ts` (create)

Tests: returns empty when userId undefined, subscribes to collectionGroup when userId provided, cleans up on unmount.

**Effort:** 45 min

#### 4.2 useGameSession

**File:** `src/features/buddies/hooks/__tests__/useGameSession.test.ts` (create)

Tests: returns null session when sessionId undefined, creates 2 subscriptions (session + rsvps), cleans up both on unmount.

**Effort:** 30 min

#### 4.3 useBuddyNotifications

**File:** `src/features/buddies/hooks/__tests__/useBuddyNotifications.test.ts` (create)

Tests: returns empty when userId undefined, subscribes when userId provided, computes unreadCount correctly.

**Effort:** 30 min

**Priority:** P1
**Total Effort:** ~1.75 hours

### Phase 5: Integration Tests (P1)

#### 5.1 RSVP Flow Integration

**File:** `src/features/buddies/engine/__tests__/rsvpFlow.integration.test.ts` (create)

Tests the logical chain: `canRsvp` -> RSVP response -> `isSessionFull` -> `shouldAutoOpen` -> notification creation. Pure functions only, no mocks needed.

**Effort:** 30 min

#### 5.2 Group Join Flow Integration

**File:** `src/features/buddies/engine/__tests__/groupJoinFlow.integration.test.ts` (create)

Tests: `validateGroupName` -> `canJoinGroup` with share code -> `createGroupInviteNotification`.

**Effort:** 15 min

**Priority:** P1
**Total Effort:** ~45 min

### Phase 6: E2E Tests (P2)

**Infrastructure needed:**
- Create `e2e/` directory
- Firebase emulator setup with test data seeding
- Playwright already configured in `playwright.config.ts`

#### 6.1 RSVP Journey — user RSVPs and sees status update
#### 6.2 Group Creation Journey — create group, see it on buddies page
#### 6.3 Share Link Journey — public pages work without auth

**Priority:** P2
**Total Effort:** ~4 hours (including emulator setup and test data seeding)

---

## Infrastructure Setup

### Already Installed (no action)
- `vitest@4.0.18` — test runner
- `@solidjs/testing-library@0.8.10` — component + hook testing
- `@testing-library/jest-dom@6.9.1` — DOM matchers
- `@firebase/rules-unit-testing@5.0.0` — security rule tests
- `@playwright/test@1.58.2` — E2E tests
- `jsdom@28.0.0` — browser environment

### Must Create
1. **`src/test-setup.ts`** — `import '@testing-library/jest-dom/vitest';` (blocks Phase 3)
2. **`test/rules/` directory** — for security rule test files (blocks Phase 1)
3. **Firebase emulator** — `firebase emulators:start --only firestore` (blocks Phase 1 and Phase 6)

### Recommended Refactors (to enable testing, optional)
These improve testability without changing behavior. Skip if time-constrained:
1. Extract `statusColor`, `statusLabel`, `statusTextColor` from `SessionDetailPage.tsx` to `engine/rsvpDisplayHelpers.ts`
2. Extract `getNextOccurrence` from `CreateSessionPage.tsx` to `engine/dateHelpers.ts`
3. Extract helper functions from `StatusAvatar.tsx` to `statusAvatarHelpers.ts`

---

## Execution Order & Parallelization

```
Phase 0: Fix Critical Bugs (1 hr)
   |
   v
Phase 1: Security Rules    Phase 2: Unit Test Gaps
(4.5 hr, needs emulator)   (40 min, no deps)
   |                           |
   v                           v
Phase 3: Component Tests   Phase 4: Hook Tests
(2 hr, needs test-setup)   (1.75 hr, needs test-setup)
   |                           |
   +---------- + -------------+
               |
               v
        Phase 5: Integration Tests (45 min)
               |
               v
        Phase 6: E2E Tests (4 hr, lowest priority)
```

**Parallelization opportunities:**
- Phase 1 and Phase 2 are fully independent and can run in parallel
- Phase 3 and Phase 4 are independent and can run in parallel
- Phase 5 can start as soon as Phase 2 is done (pure function tests)
- Phase 6 is independent of everything except Phase 0

---

## Estimated Effort

| Phase | Hours | Tests Added | What It Validates |
|-------|-------|-------------|-------------------|
| Phase 0: Bug Fixes | 1.0 | 0 | Unblocks everything |
| Phase 1: Security Rules | 4.5 | ~47 tests | BUG-1, BUG-6, all auth/access control |
| Phase 2: Unit Gaps | 0.7 | ~12 tests | Edge cases in engine helpers + repos |
| Phase 3: Components | 2.0 | ~16 tests | UI rendering correctness |
| Phase 4: Hooks | 1.75 | ~9 tests | Reactive data binding |
| Phase 5: Integration | 0.75 | ~8 tests | Cross-module flow correctness |
| Phase 6: E2E | 4.0 | ~6 tests | Full user journeys |
| **Total** | **~14.7 hr** | **~98 tests** | **~80% estimated coverage** |

**Recommended cutoff for MVP:** Phase 0 + Phase 1 + Phase 2 = ~6.2 hours for the highest-impact coverage. This fixes all blockers and validates security + edge cases. Phases 3-6 are important but can be done incrementally.
