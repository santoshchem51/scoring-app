# Layer 7 Wave D: Achievements System — Design Document

**Date:** 2026-03-07
**Status:** Approved
**Depends on:** Wave A (stats/tiers), Wave B (profile), Wave C (leaderboards)

---

## Overview

Add a ~23-badge achievement system to PickleScore that celebrates match milestones, streaks, improvement, social play, and special in-game moments. Achievements unlock with an in-game toast on the match result screen and are displayed in a Trophy Case section on the Profile page.

## Design Decisions

### Evaluation Architecture

**Approach: Synchronous evaluation in `processMatchCompletion`, outside the Firestore transaction.**

Badge evaluation runs after the stats transaction commits, following the same pattern as `writePublicTier`. A pure `badgeEngine.evaluate()` function receives both the updated stats and the match object, checks all 23 conditions, and returns newly unlocked achievements.

Rationale (confirmed by 4 specialist reviews):
- Badge checks are ~0.1ms for 23 conditions — negligible latency
- Immediate evaluation enables instant toast on the match result screen
- No new infrastructure (event bus, timers) needed
- Fits the existing orchestrator pattern (tierEngine, leaderboardScoring)

### Storage

- **Firestore:** `users/{uid}/achievements/{achievementId}` (subcollection, create-only)
- **Dexie:** `achievements` table with `achievementId` as primary key (cache + toast dedup)
- **Flow:** Write to Firestore first (inside processMatchCompletion), cache to Dexie after. Firestore refresh on profile load serves as recovery path for partial writes.

### Toast Delivery

Module-level SolidJS signal in `achievementStore.ts`. `enqueueToast()` pushes to a signal array; `dismissToast(id)` removes by UUID. Toast component mounts in `App.tsx` at root level (survives route changes). A separate `role="status"` sr-only live region is always in the DOM for screen reader announcements.

---

## Achievement Definitions (~23 badges)

All achievements are **one-time unlocks** — once earned, never revoked. Win-rate badges are evaluated at the moment the threshold is crossed; they are not rechecked or revoked if the rate drops later.

### Milestones (5)

| Badge | Condition | Tier |
|---|---|---|
| First Rally | `totalMatches >= 1` | Bronze |
| Warming Up | `totalMatches >= 10` | Bronze |
| Battle Tested | `totalMatches >= 25` | Silver |
| Half Century | `totalMatches >= 50` | Silver |
| Century Club | `totalMatches >= 100` | Gold |

### Streaks (3)

| Badge | Condition | Tier |
|---|---|---|
| Hat Trick | `bestWinStreak >= 3` | Bronze |
| On Fire | `bestWinStreak >= 5` | Silver |
| Unstoppable | `bestWinStreak >= 10` | Gold |

### Improvement (4)

| Badge | Condition | Tier |
|---|---|---|
| Moving Up | Promoted to Intermediate (`previousTier < intermediate && stats.tier >= intermediate`) | Bronze |
| Level Up | Promoted to Advanced | Silver |
| Elite | Promoted to Expert | Gold |
| Proven | `tierConfidence === 'high'` | Silver |

### Social (3)

| Badge | Condition | Tier |
|---|---|---|
| New Rival | `uniqueOpponentUids.length >= 5` | Bronze |
| Social Butterfly | `uniqueOpponentUids.length >= 15` | Silver |
| Community Pillar | `uniqueOpponentUids.length >= 30` | Gold |

### Moments (5)

| Badge | Condition | Tier |
|---|---|---|
| Shutout | Won a game with opponent scoring 0 | Silver |
| Comeback Kid | Lost game 1 but won match (best-of-3+ only) | Silver |
| Perfect Match | Won all games in a best-of-3+ match | Silver |
| Doubles Specialist | `doubles.wins >= 25` | Silver |
| Singles Ace | `singles.wins >= 25` | Silver |

### Consistency (3)

| Badge | Condition | Tier |
|---|---|---|
| First Win | `wins >= 1` | Bronze |
| Winning Ways | `winRate >= 0.6` AND `totalMatches >= 20` | Silver |
| Dominant Force | `winRate >= 0.75` AND `totalMatches >= 30` | Gold |

---

## Data Model

### Types (`types.ts`)

```typescript
export type AchievementTier = 'bronze' | 'silver' | 'gold';
export type AchievementCategory = 'milestones' | 'streaks' | 'improvement' | 'social' | 'moments' | 'consistency';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string; // emoji for v1
  check: (ctx: BadgeEvalContext) => boolean;
}

export interface UnlockedAchievement {
  achievementId: string;
  unlockedAt: number;         // Firestore Timestamp on write, epoch ms in Dexie
  triggerMatchId: string;
  triggerContext: AchievementTriggerContext;
}

export type AchievementTriggerContext =
  | { type: 'stats'; field: string; value: number }
  | { type: 'match'; matchScore: string; outcome: string }
  | { type: 'tier'; from: string; to: string };
```

### Dexie Schema (v4)

```typescript
// Add to db.ts — version 4
// Carry ALL existing tables forward exactly, then add:
achievements: 'achievementId'

// Row shape
interface CachedAchievement {
  achievementId: string;     // primary key
  unlockedAt: number;
  triggerMatchId: string;
  triggerContext: AchievementTriggerContext;
  toastShown: 0 | 1;        // no index needed — 23 rows, filter in JS
  syncedAt: number;
}
```

No secondary indexes — 23 rows max, full table scan is faster than index lookup.

### Achievement Definitions Storage

Stored in code as a `ACHIEVEMENT_DEFINITIONS` constant array. Not in Firestore. Versioning: if criteria change, use a new achievement ID (never redefine an existing ID's meaning).

---

## Architecture

### File Structure

```
src/features/achievements/
  engine/
    badgeEngine.ts              ← pure evaluate() + ACHIEVEMENT_DEFINITIONS
    badgeDefinitions.ts         ← badge metadata (name, description, icon, category, tier)
    achievementHelpers.ts       ← computeProgress() pure function
  repository/
    firestoreAchievementRepository.ts
  store/
    achievementStore.ts         ← module-level signal for toast queue
  hooks/
    useAchievements.ts          ← useLiveQuery on Dexie + background Firestore refresh
  components/
    AchievementToast.tsx        ← visual toast (mounted in App.tsx)
    TrophyCase.tsx              ← profile page section
    AchievementBadge.tsx        ← individual badge card
```

### Badge Engine (`badgeEngine.ts`)

```typescript
export interface BadgeEvalContext {
  stats: StatsSummary;
  match: Match;
  playerTeam: 1 | 2;
  result: 'win' | 'loss';
  existingIds: Set<string>;
  previousTier?: Tier;          // captured inside transaction before computeTier
}

export function evaluate(ctx: BadgeEvalContext): UnlockedAchievement[]
```

Pure function. No I/O. Filters `ACHIEVEMENT_DEFINITIONS` against `existingIds`, runs each `check(ctx)`, returns newly unlocked achievements with trigger context.

### Integration with `processMatchCompletion`

```
updatePlayerStats(uid, match, playerTeam, result, ...):
  1. [existing] Capture previousTier via closure (before computeTier)
  2. [existing] Capture committedStats via closure (after all mutations)
  3. [existing] runTransaction → write matchRef + stats + leaderboard
  4. [existing] writePublicTier (outside transaction)
  5. [NEW] Gate on tierUpdated (skip if idempotency check fired)
  6. [NEW] getUnlockedIds(uid) → Set<string>
  7. [NEW] evaluate({ committedStats, match, playerTeam, result, existingIds, previousTier })
  8. [NEW] Promise.all(unlocked.map(create)) → write to Firestore
  9. [NEW] Write to Dexie cache (toastShown: 0)
  10. [NEW] if (uid === currentUserUid) → enqueueToast() for each unlock
```

Key integration rules:
- **Error isolation:** Achievement block wrapped in its own try/catch. Never rethrows. Stats already committed.
- **Idempotency:** Gated on `tierUpdated` flag. If transaction was a no-op (match already processed), skip achievements entirely.
- **Parallel writes:** `Promise.all` for Firestore achievement creates, not sequential loop.
- **`currentUserUid`:** Read once from `auth.currentUser?.uid` at top of `processMatchCompletion`, passed as parameter. Not the same as `scorerUid` (tournament organizer edge case).
- **`previousTier`/`committedStats`:** Declared outside transaction, set inside via closure (same pattern as `newTier`/`tierUpdated`).

### Toast Store (`achievementStore.ts`)

Module-level SolidJS signals:

```typescript
const [pendingToasts, setPendingToasts] = createSignal<PendingToast[]>([]);

export function enqueueToast(toast: Omit<PendingToast, 'id'>): void
export function dismissToast(id: string): void
export { pendingToasts }
```

- Each toast gets a UUID via `crypto.randomUUID()`
- Auto-dismiss after 5s via `setTimeout`
- No side effects inside signal setters (read first, then mutate)
- Max queue cap of 10 (drop if backed up)

### `useAchievements` Hook

Uses `useLiveQuery` (Dexie subscription) + fire-and-forget Firestore refresh:

```typescript
export function useAchievements(userId: Accessor<string | undefined>) {
  const { data: unlocked } = useLiveQuery(() =>
    db.achievements.toArray(), userId
  );

  createEffect(() => {
    const uid = userId();
    if (!uid) return;
    firestoreAchievementRepository.refreshForUser(uid).catch(console.warn);
  });

  return { unlocked };
}
```

Firestore refresh must `bulkPut` back into Dexie, preserving local `toastShown` values.

### Startup Migration (Retroactive Unlocks)

On app init, if app version has changed:
1. Read current stats from Firestore
2. Read existing achievement IDs from Firestore
3. Evaluate all definitions against stats
4. Write any newly qualifying achievements to Firestore + Dexie
5. Store `lastAchievementMigrationVersion` in localStorage
6. Cap retroactive toasts at 3 per session; mark excess as `toastShown: 1`

Uses `bulkPut` (upsert), never `bulkAdd`, for idempotency.

---

## UI Design

### Trophy Case — Profile Page Section

**Placement:** Between `StatsOverview` and `RecentMatches`.

**Layout:**
- `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (2 per row on mobile)
- Grouped by category with `text-xs font-semibold text-on-surface-muted uppercase tracking-wider` headers

**Badge card (`AchievementBadge`):**
- Single component, discriminated by `item.unlocked`
- **Unlocked:** Emoji icon (aria-hidden), badge name, visible tier label ("Gold"), tier-colored left border (`border-l-4`)
- **Locked:** Explicit muted colors (`text-gray-400` on `bg-gray-900`, NOT opacity). Lock icon (aria-hidden), badge name visible, `aria-disabled="true"`
- 4px tier-colored progress bar on locked badges (thin bar, not text)
- Tier border colors: bronze = `amber-600`, silver = `#c0c0c0` (bright, not slate), gold = `yellow-400`

**Collapsed locked badges:**
- Only unlocked + next-achievable badge per category visible by default
- "Show X locked" disclosure button per category to expand remaining
- Prevents new-user overwhelm and excessive scroll

**Data flow:**
- `TrophyCase` receives `stats` as prop from ProfilePage (don't re-fetch)
- `useAchievements(uid)` provides unlocked list via `useLiveQuery`
- `createMemo` inside TrophyCase merges `ACHIEVEMENT_DEFINITIONS` with `unlocked` signal
- `<For>` renders with object identity from `createMemo`

**Accessibility:**
- `role="list"` on grid, `role="listitem"` on each badge
- `aria-hidden="true"` on all emojis
- `aria-disabled="true"` on locked badges
- Visible tier label (not color-only)
- Progress hint included in `aria-label`
- No `tabindex` on display-only badges (navigable via screen reader virtual cursor)

### Achievement Toast — Global Overlay

**Mount:** Always-mounted component in `App.tsx`, after Router, before BottomNav.

**Position:** `fixed`, below TopNav + safe area:
```
top: calc(env(safe-area-inset-top) + 56px + 8px)
left: 50%; transform: translateX(-50%)
z-index: 50
```

**Visual:**
- `bg-surface-light` with tier-colored `border-l-4`
- Row: large emoji (aria-hidden) | badge name + description stacked
- `rounded-xl shadow-lg max-w-sm w-[90vw]`
- Visible X dismiss button (32px touch target)

**Live region (accessibility):**
- Separate `role="status" aria-live="polite" aria-atomic="true"` sr-only div, always in DOM
- Visual toast is a separate element
- Clear live region content between sequential announcements (100ms gap for AT detection)

**Animation:**
- `motion-safe:` 200ms slide-down + fade
- `motion-reduce:` fade only, no translate
- Respects `prefers-reduced-motion`

**Timing:**
- 1.5s delay after match result screen
- 5s visible, auto-dismiss
- Tap or X to dismiss early
- Sequential: 3s gap between toasts
- Cap: 3 retroactive toasts per session (startup migration)

**Component internals:**
- `current()` signal gates rendering via `<Show when={current()}>` with accessor child
- `createEffect` watches `pendingToasts()` when `current()` is null
- `onCleanup` clears all timers
- `pointer-events: none` on wrapper, `pointer-events: auto` on toast card

---

## Firestore Security Rules

```javascript
match /users/{uid}/achievements/{achievementId} {
  // Owner-only read for now; widen to request.auth != null when social profiles ship
  allow read: if request.auth != null && request.auth.uid == uid;

  allow create: if request.auth.uid == uid
    && request.resource.data.achievementId == achievementId
    && request.resource.data.achievementId is string
    && request.resource.data.unlockedAt is timestamp
    && request.resource.data.triggerMatchId is string
    && request.resource.data.keys().hasAll(
         ['achievementId', 'unlockedAt', 'triggerMatchId'])
    && request.resource.data.keys().hasOnly(
         ['achievementId', 'unlockedAt', 'triggerMatchId', 'triggerContext'])
    && (!('triggerContext' in request.resource.data)
        || request.resource.data.triggerContext is map);

  // Achievements are permanent. Use admin SDK for corrections.
  allow update, delete: if false;
}
```

No achievement ID allowlist in rules — enforced in app code instead (avoids redeploy coupling).

---

## Testing Strategy

### Badge Engine (~23 test cases per badge + edge cases)
- `src/features/achievements/engine/__tests__/badgeEngine.test.ts`
- Factory: `makeCtx(overrides: Partial<BadgeEvalContext>)` using existing `makeMatch`/`makeStatsSummary` patterns
- Per-achievement: unlocks when condition met, does not unlock when condition not met, does not unlock if already owned
- Edge cases: single-game match for Comeback Kid (should not unlock), zero-score game detection for Shutout

### Repository
- `firestoreAchievementRepository.test.ts` — mock Firestore calls, verify paths and shapes
- Dexie cache tests — verify `bulkPut` preserves `toastShown`, refresh merges correctly

### Integration
- Mock `badgeEngine.evaluate` in stats repo test, assert correct context passed
- Verify error isolation (achievement failure doesn't affect stats)
- Verify idempotency (second call for same match skips achievements)

### Component
- TrophyCase: renders unlocked/locked states, progress bars, disclosure toggle
- AchievementToast: mount, timing, dismiss, sequential display, reduced motion
- achievementStore: enqueue/dismiss, queue cap, auto-dismiss

### Security Rules (~15 test cases)
- Owner create with valid data (pass)
- Cross-user write (fail)
- Missing required fields (fail)
- Extra fields (fail)
- Update/delete (fail)
- triggerContext as non-map (fail)

### E2E
- Score a match, verify achievement toast appears
- Visit profile, verify trophy case shows unlocked badge
