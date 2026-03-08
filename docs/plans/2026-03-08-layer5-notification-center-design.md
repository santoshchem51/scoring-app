# Layer 5: In-App Notification Center — Design

**Date:** 2026-03-08
**Status:** Approved

---

## Overview

A unified in-app notification center consolidating buddy notifications, tournament invitations, achievement unlocks, and stats changes into a single bell icon dropdown in the TopNav. Client-side only — no push notifications (FCM) or Cloud Functions.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Push notifications | Deferred | Requires Cloud Functions + Blaze plan. Client-side first. |
| Bell UI format | Dropdown panel | Matches existing TopNav avatar dropdown pattern. No new primitives. Upgrade to drawer later if needed. |
| Existing badges | Keep | Bell is additive — BottomNav badges on Buddies and Tournaments tabs stay. |
| Data model | Unified collection | Single `users/{uid}/notifications/{id}` collection replaces fragmented systems. |
| Tournament invitation | Mirror | Authoritative doc stays under `tournaments/`. Notification is display-only mirror. |
| Unread count | Derived from onSnapshot | No denormalized counter on user doc. Simpler, good enough at current scale. |
| Store pattern | Module-level signals | Like achievementStore.ts. NOT a hook. Delete useBuddyNotifications. |
| Notification writes | Direct Firestore | markRead/markAllRead are fire-and-forget. No sync queue. |
| Preferences | Client-side filtering | localStorage settingsStore. Filtering via createMemo, not in Firestore query. |

---

## Notification Types (12)

### Launch Types

| Category | Type | Trigger | Default |
|----------|------|---------|---------|
| buddy | `session_proposed` | Someone proposes a session | ON |
| buddy | `session_confirmed` | Session gets enough RSVPs | ON |
| buddy | `session_cancelled` | Session cancelled | ON |
| buddy | `session_reminder` | 1 hour before session start | ON |
| buddy | `spot_opened` | Spot opens up (waitlist context) | ON |
| buddy | `group_invite` | Invited to a buddy group | ON |
| tournament | `tournament_invitation` | Invited to a tournament (mirror) | ON |
| tournament | `match_upcoming` | Your next match is about to start (throttled) | ON |
| tournament | `match_result_recorded` | Someone scored your match | ON |
| achievement | `achievement_unlocked` | Badge earned (pre-read if toast shown) | ON |
| stats | `tier_up` | Tier promotion | ON |
| stats | `tier_down` | Tier demotion | ON |

### Deferred Types

- `player_joined` → threshold-based ("session almost full") in future
- `buddy_arriving` / `buddy_here` → stay in session view live status only, not in bell
- `leaderboard_change` → needs threshold logic (top 10 entry, 5+ position jump) before shipping
- `voting_reminder` → validate feature adoption first

### Type Design Rationale

- **`tier_up` / `tier_down` split** (not combined `tier_change`): opposite emotional valence requires different copy and tone
- **`buddy_arriving` / `buddy_here` excluded**: ephemeral real-time signals belong in session view, not notification center. Specialists unanimous.
- **`player_joined` excluded**: O(n²) fatigue in large groups. 10-person session = 9 notifs per member.
- **`session_reminder` added**: biggest retention driver per product specialist — "gets you out of bed"
- **`match_result_recorded` added**: trust/integrity when someone else scores your tournament match

---

## Data Model

### Collection Path

`users/{uid}/notifications/{id}`

### Schema

```typescript
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

### Retention Policy

| Category | Type | Retention |
|----------|------|-----------|
| buddy | session_reminder, spot_opened | 7 days |
| buddy | all others | 30 days |
| tournament | match_upcoming | 1 day after match |
| tournament | tournament_invitation, match_result_recorded | 30 days |
| achievement | achievement_unlocked | 90 days |
| stats | tier_up, tier_down | 30 days |

### Firestore Indexes

```json
[
  { "fields": [{"fieldPath": "read", "order": "ASCENDING"}, {"fieldPath": "createdAt", "order": "DESCENDING"}] },
  { "fields": [{"fieldPath": "category", "order": "ASCENDING"}, {"fieldPath": "createdAt", "order": "DESCENDING"}] },
  { "fields": [{"fieldPath": "expiresAt", "order": "ASCENDING"}] }
]
```

### Tournament Invitation Mirroring

Authoritative invitation stays at `tournaments/{tid}/invitations/{userId}` (used for access control and collectionGroup queries). A display-only notification mirror is written to `users/{uid}/notifications/{id}` in the same batch:

```typescript
const batch = writeBatch(firestore);
batch.set(invRef, invitation);        // authoritative
batch.set(notifRef, notification);    // mirror for inbox display
await batch.commit();
```

---

## Security Rules

### Core Rules

```javascript
match /users/{userId}/notifications/{notifId} {
  // Owner reads their own notifications
  allow read: if request.auth != null && request.auth.uid == userId;

  // Owner marks as read (only 'read' field, only false→true)
  allow update: if request.auth != null
    && request.auth.uid == userId
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read'])
    && request.resource.data.read == true;

  // Owner deletes their own notifications
  allow delete: if request.auth != null && request.auth.uid == userId;

  // Buddy notifications: writer must be group member, recipient must be group member
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
    && request.resource.data.payload.groupId is string
    && exists(/databases/$(database)/documents/buddyGroups/$(request.resource.data.payload.groupId)/members/$(request.auth.uid))
    && exists(/databases/$(database)/documents/buddyGroups/$(request.resource.data.payload.groupId)/members/$(userId));

  // group_invite: any authenticated user can send (inviter may not be in group yet)
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
    && request.resource.data.createdAt is number;

  // Tournament invitation: writer must be organizer
  allow create: if request.auth != null
    && request.auth.uid != userId
    && request.resource.data.keys().hasOnly(['id','userId','category','type','message','actionUrl','payload','read','createdAt','expiresAt'])
    && request.resource.data.userId == userId
    && request.resource.data.category == 'tournament'
    && request.resource.data.type in ['tournament_invitation', 'match_upcoming', 'match_result_recorded']
    && request.resource.data.message is string
    && request.resource.data.read == false
    && request.resource.data.payload is map
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
    && request.resource.data.createdAt is number;
}
```

---

## UI Design

### Bell Icon (TopNav)

- Position: right of sync indicator, left of avatar dropdown
- Icon: Bell from lucide-solid, 20-24px visual, 44x44px tap area
- Badge: red circle with white number (1-9, then "9+"), hidden when 0
- Badge position: top-right, slightly overlapping icon

### Dropdown Panel

- **Trigger**: tap bell icon
- **ARIA**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- **Width**: `w-[calc(100vw-24px)] max-w-[340px]` (fluid, caps on larger phones)
- **Height**: `max-h-[55vh]` (avoids BottomNav overlap on short phones)
- **Backdrop**: `fixed inset-0 z-40` (tap to dismiss)
- **Panel**: `absolute right-0 top-full z-50`, `overflow-y-auto`
- **Dismiss**: outside tap, Escape key, navigation

### Panel Contents

- **Header**: "Notifications" heading + "Mark all read" ghost button (checkmark icon, disabled while in-flight)
- **Notification rows** (52px min height, two-line layout):
  ```
  [avatar 36px] | [message text — 2-line clamp]  [unread dot 8px]
                | [relative time — 12px, muted]
  ```
- **Unread styling**: subtle background bump (#32334a vs #2a2a3e), message font-weight 500, orange dot
- **Read styling**: standard background, font-weight 400, muted text (#94a3b8), no dot
- **Tap behavior**: mark as read + navigate to actionUrl
- **Empty state**: "No notifications yet" with muted icon
- **Conditional "See all"**: full-width row at bottom when >10 items (links to future `/notifications` page)

### Accessibility

- Bell: `aria-label="Notifications"`, `aria-expanded`, `aria-haspopup="dialog"`
- Badge: `aria-label="${count} unread notifications"`, `aria-live="polite"`, `aria-atomic="true"`
- Panel: focus panel on open, return focus to bell on close
- Keyboard: Tab/Shift+Tab navigation (not arrow keys), Escape to close
- Unread dot: `aria-hidden="true"` (state conveyed via row aria-label "read"/"unread")
- Timestamps: `<time dateTime>` with sr-only absolute date, visual relative time
- Live region: `aria-live="assertive"` announcer for new notifications when panel is closed
- Mark all read: confirmation via `aria-live="polite"` status message

### Notification Preferences (Settings Page)

New "Notifications" section with per-category toggles:
- Buddy activity (default ON)
- Tournament updates (default ON)
- Achievements (default ON)
- Stats changes (default ON)

Stored in settingsStore (localStorage). Applied as client-side display filtering only — notifications are still written to Firestore regardless.

---

## Architecture

### Notification Store

Module-level signal store at `src/features/notifications/store/notificationStore.ts` (mirrors achievementStore pattern):

```typescript
const [notifications, setNotifications] = createSignal<AppNotification[]>([]);
const [unreadCount, setUnreadCount] = createSignal(0);
const [notificationsReady, setNotificationsReady] = createSignal(false);

export function startNotificationListener(uid: string): void { /* onSnapshot */ }
export function stopNotificationListener(): void { /* unsubscribe + reset signals */ }
export function markNotificationRead(uid: string, notifId: string): Promise<void> { /* fire-and-forget */ }
export function markAllNotificationsRead(uid: string): Promise<void> { /* batch, limit(500) */ }
```

### Lifecycle

- `startNotificationListener` called in `useAuth.ts` on sign-in (after `startProcessor()`)
- `stopNotificationListener` called in `useAuth.ts` on sign-out (alongside `stopProcessor()`)
- Guards against double-initialization and stale listeners

### Preference Filtering

```typescript
export const filteredNotifications = createMemo(() => {
  const prefs = getNotificationPreferences();
  return notifications().filter(n => prefs[n.category] !== false);
});
```

Filtering is a `createMemo` over the raw signal — never mutates the raw array.

### Achievement Toast Coordination

Callback registration pattern (no circular imports):

1. `achievementStore.ts` exports `onToastDismissed(callback)`
2. `useAuth.ts` registers callback on sign-in: when toast dismissed → call `markNotificationRead` for that achievement's notification
3. If toast is displayed and dismissed, notification is marked read (no badge increment for already-seen achievements)

### Migration from useBuddyNotifications

- Delete `src/features/buddies/hooks/useBuddyNotifications.ts` and its test file
- Update `BottomNav.tsx` to import `unreadCount` from notification store
- Update all buddy notification call sites to use new unified notification helpers

### Expired Notification Cleanup

Client-side cleanup on sign-in:

```typescript
const q = query(
  collection(firestore, 'users', uid, 'notifications'),
  where('expiresAt', '<=', Date.now()),
  limit(100)
);
const snap = await getDocs(q);
if (snap.size > 0) {
  const batch = writeBatch(firestore);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}
```

---

## Bug Fixes Included

### 1. markAllRead limit(50) → limit(500)

Current `markAllRead` calls `getUnread` with `limit(50)`, silently skipping items 51+. Fix: use `limit(500)` (Firestore batch max) for the markAllRead fetch path.

### 2. Phantom Achievement Toast on Write Failure

Current code enqueues toasts for all unlocked achievements regardless of whether the Firestore write succeeded. Fix: track successfully written achievements and only toast those.

---

## Testing Strategy (~120 tests)

### Unit Tests (~45)

**notificationStore.ts (~18)**
- start/stop listener lifecycle
- Listener detach on sign-out (userId → undefined)
- onSnapshot error callback handling
- Snapshot after cleanup doesn't throw
- Real-time delta (second snapshot increments count)
- Preference filter excludes disabled categories (createMemo)
- Preference filter does not mutate raw signal
- markRead optimistic update
- markAllRead issues individual updateDoc calls (not batch)
- markAllRead button disabled while in-flight
- Expired notification cleanup on sign-in
- stopListener called twice doesn't throw
- User switch (A sign-out → B sign-in) shows no stale data

**notificationHelpers.ts (~15)**
- Table-driven test: all 12 types produce correct category, actionUrl, expiresAt, message
- expiresAt uses Date.now() at call time
- Types with no expiry return appropriate value

**NotificationRow + NotificationPanel (~12)**
- Row renders read/unread states with correct styling
- Row click calls onRead before navigating
- Row does not navigate when actionUrl is null/empty
- Panel renders with role="dialog" and aria-label
- Panel focus trap
- Panel focus on open, return to bell on close
- Escape key closes panel
- Mark all read button absent when all read
- Mark all read disabled while in-flight
- Loading skeleton vs empty state distinction
- Badge hidden at count 0, shows "9+" at 10+

### Security Rules (~60)

- Authentication boundaries (read/update/delete): ~10
- Update field restriction (hasOnly): ~8
- Buddy create with membership verification: ~10
- group_invite exception: ~3
- General create validation (schema, field allowlist): ~10
- Tournament invitation organizer check: ~5
- Achievement/stats self-write: ~6
- Attack vector tests (spam, spoofed groupId, field injection, privilege escalation): ~8

### Integration Tests (~5)

- onSnapshot populates signals within 2s of document creation
- markRead round-trip (write → snapshot re-fires → signal updates)
- markAllRead with multiple items completes
- Expired cleanup deletes correct docs
- Preference filter wired into store correctly

### E2E Tests (~10)

- Bell badge shows unread count after notification created
- Bell badge hidden when count is zero
- Dropdown opens/closes correctly
- Tap row → marks read + navigates to actionUrl
- Mark all read clears badge
- Real-time notification arrives while dropdown is open
- Achievement toast → notification marked as read
- Expired notification absent after sign-in
- Preference-disabled category absent from panel
- Sign-out → sign-in different user → no stale notifications
