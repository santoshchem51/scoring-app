# Layer 7 Wave B: Profile Page — Design

**Date:** 2026-03-01
**Status:** Approved
**Depends on:** Wave A (complete)

---

## Scope

A single `/profile` page showing the signed-in user's identity, stats dashboard, and recent match history. Self-only (no viewing other players). No personal data collection beyond what Google Sign-In provides.

---

## 1. Navigation Changes

### TopNav Avatar Menu (two states)

**Signed out:**
- "Sign in with Google" (triggers auth)
- "Settings" (links to `/settings`)

**Signed in:**
- "My Profile" (links to `/profile`)
- "Settings" (links to `/settings`)
- "Sign out" (triggers sign-out)

### BottomNav

Remove the Settings tab. Remaining tabs: New, History, Players, Tournaments, Buddies (auth-gated). Drops from 6-7 to 5-6 tabs.

### Route

`/profile` — auth-gated. Unauthenticated access shows EmptyState with sign-in CTA (same pattern as `/buddies`).

---

## 2. Page Layout

Single vertical scroll. Three sections, each a separate component:

### Section 1: ProfileHeader

- Google avatar (64px circle with `ring-2 ring-surface-light`)
- Display name (bold, `<h1>`) with TierBadge inline
- Email (muted text)
- "Member since [short month year]" (muted text)

**TierBadge** (own component, reusable):
- Pill-shaped: `rounded-full px-3 py-1`
- Color-coded by tier: beginner=slate, intermediate=green, advanced=orange, expert=gold
- Background at 20% opacity, text in full tier color
- Confidence shown as 1-3 dots (opacity-varying), not text
- Hidden in empty state (0 matches)

### Section 2: StatsOverview

**Win Rate card** (full width, visually dominant):
- Tinted green background (`bg-green-500/10`)
- Win rate percentage in `text-2xl text-green-400 font-bold`
- Singles W-L and Doubles W-L as muted subtext

**Three stat cards** (row of 3):
- Matches (total count)
- Current Streak (W/L + count, colored letter)
- Best Streak (count)
- Standard `bg-surface-light rounded-xl p-4`
- Each card: label in `text-xs text-muted uppercase`, value in `text-xl font-semibold`
- Each card: `aria-label` with full description (e.g., "Total matches: 24")

### Section 3: RecentMatches

- Section header: "Recent Matches" (`text-sm font-semibold text-muted uppercase`)
- Container card (`bg-surface rounded-xl p-4`) wrapping all rows
- Each row: W/L colored badge (small square), opponent name, score, relative date
- Rows are `<a>` elements (tappable, navigates to match detail)
- Row min-height: 48px, gap between rows: 8px+
- W/L badge: `w-6 h-6 rounded` with letter (not emoji) + `aria-hidden` icon + `sr-only` text
- Relative dates: "2d", "1w", "3w" format
- "Load More" button at bottom (ghost/text style)
- Initially shows last 10 matches

### Empty State (0 matches)

- ProfileHeader shows (Google info always available), tier badge hidden
- Stats and Match sections replaced with single EmptyState card:
  - "No matches recorded yet"
  - "Record your first match to see your stats and track progress"
  - CTA button → `/new`
- No zeroed-out stat cards

### Loading State

- Full-page skeleton shimmer using existing `Skeleton` component
- Three skeleton sections matching the layout proportions

---

## 3. Data Layer

### New Read Methods

Add to `firestorePlayerStatsRepository`:

```typescript
async getStatsSummary(uid: string): Promise<StatsSummary | null>
async getRecentMatchRefs(uid: string, limit?: number, startAfterDate?: number): Promise<MatchRef[]>
```

### Data Hook: useProfileData

```typescript
useProfileData(userId: () => string | undefined) → {
  data: Resource<ProfileBundle>,
  extraMatches: Accessor<MatchRef[]>,
  loadMore: () => Promise<void>,
  refetch: () => void
}
```

- Uses `createResource` with reactive `userId` source
- Fetches profile + stats + matchRefs in parallel via `Promise.allSettled`
- Partial failure: each section renders independently (if stats fail, header still shows)
- Pagination: `extraMatches` signal appended via "Load More", uses `startAfter` cursor
- Combined matches: `createMemo` merging initial + extra matches

### No Dexie Caching (v1)

Profile data is cloud-only (requires auth). Rely on Firestore SDK cache for repeat visits. Local caching deferred.

---

## 4. Component Structure

```
src/features/profile/
├── ProfilePage.tsx
├── hooks/
│   └── useProfileData.ts
├── components/
│   ├── ProfileHeader.tsx
│   ├── StatsOverview.tsx
│   ├── RecentMatches.tsx
│   └── TierBadge.tsx
└── __tests__/
    ├── ProfilePage.test.tsx
    └── useProfileData.test.ts
```

### SolidJS Patterns

- Props only (no context) — max 2 levels deep
- Pass accessors as props (not unwrapped values)
- `createMemo` for derived values (winRate, allMatches)
- `Show` with `keyed` callback for narrowed non-null access
- `For` for match list rendering
- `on()` for explicit signal tracking in effects
- Never destructure props

---

## 5. Accessibility

### Contrast
- Use `orange-400` and `red-400` (not 500) on dark surfaces for AA compliance
- Muted text on `surface-light` stays at 14px+ minimum

### Screen Readers
- Stat cards: `role="group"` with `aria-label` (e.g., "Win rate: 67 percent")
- Tier badge: `aria-label="Skill tier: Intermediate, confidence: low"`
- Streak jargon: `aria-label="Current win streak: 3"` (not "W3")
- Match rows: `<a>` with comprehensive `aria-label` combining result, opponent, score, date
- Match list: `<ul role="list">` for count announcement
- "Load More": `aria-live="polite"` region announces loaded count

### Touch & Focus
- Match rows: min 48px height, 8px+ inter-row spacing
- Visible focus indicators: `focus-visible:outline-2 focus-visible:outline-[#22c55e]`
- After "Load More": focus moves to first newly loaded row

### Motion
- Respect `prefers-reduced-motion` for all animations
- No counting/number animations

---

## 6. Files Changed

### New Files (~8)
- `src/features/profile/ProfilePage.tsx`
- `src/features/profile/hooks/useProfileData.ts`
- `src/features/profile/components/ProfileHeader.tsx`
- `src/features/profile/components/StatsOverview.tsx`
- `src/features/profile/components/RecentMatches.tsx`
- `src/features/profile/components/TierBadge.tsx`
- `src/features/profile/__tests__/ProfilePage.test.tsx`
- `src/features/profile/__tests__/useProfileData.test.ts`

### Modified Files (~4)
- `src/app/router.tsx` — add `/profile` route
- `src/shared/components/TopNav.tsx` — avatar dropdown becomes menu
- `src/shared/components/BottomNav.tsx` — remove Settings tab
- `src/data/firebase/firestorePlayerStatsRepository.ts` — add read methods

### New Tests for Read Methods
- `src/data/firebase/__tests__/firestorePlayerStatsRepository.test.ts` — add tests for `getStatsSummary` and `getRecentMatchRefs`

---

## 7. Out of Scope (Deferred)

- Viewing other players' profiles (Wave C with leaderboards)
- Profile editing (bio, visibility — no personal data collection)
- Dexie caching for offline profile access
- Achievement badges section (Wave D)
- Real-time stats updates (load-once-on-mount is correct)
