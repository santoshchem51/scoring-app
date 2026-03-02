# Wave C: Leaderboards — Design Document

**Date:** 2026-03-02
**Layer:** 7 (Player Profiles & History)
**Status:** Approved

## Overview

Add leaderboards to PickleScore with Global and Friends scoping, composite score ranking, and two timeframes (All-Time + Last 30 Days). Leaderboard lives as a tab inside the existing `/players` page.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scoping | Global + Friends | Friends uses `uniqueOpponentUids` (no new infrastructure). Clubs deferred. |
| Tier display | Mixed board with tier badges | Avoids sparse per-tier boards with small user base |
| Ranking metric | Composite score (40% tier, 35% winRate, 25% activity) | Tier-heavy rewards skill; activity prevents stagnation |
| Timeframes | All-time + Last 30 days | Shows both consistent performance and recent form |
| Navigation | Tabs inside `/players` | No BottomNav bloat, natural "people hub" grouping, scales for Wave D |
| Min matches | 5 | Filters 1-match flukes while letting new players appear quickly |
| Data architecture | Top-level `/leaderboard/{uid}` collection | Firestore-native cross-user queries, avoids collection group complexity |

## Data Model

### Collection: `/leaderboard/{uid}`

```typescript
interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  tier: Tier;                    // 'beginner' | 'intermediate' | 'advanced' | 'expert'
  tierConfidence: TierConfidence; // 'low' | 'medium' | 'high'
  totalMatches: number;
  wins: number;
  winRate: number;               // 0.0–1.0
  currentStreak: { type: 'W' | 'L'; count: number };
  compositeScore: number;        // 0–100
  last30d: {
    totalMatches: number;
    wins: number;
    winRate: number;
    compositeScore: number;
  };
  lastPlayedAt: number;          // timestamp
  createdAt: number;             // timestamp, set once on first write
  updatedAt: number;             // timestamp
}
```

### Composite Score Formula

```
tierScore     = { beginner: 25, intermediate: 50, advanced: 75, expert: 100 }
activityScore = min(totalMatches / 50, 1) * 100   // caps at 50 matches
compositeScore = (0.40 × tierScore) + (0.35 × winRate × 100) + (0.25 × activityScore)
```

### "Last 30 Days" Computation

On each write, scan `recentResults` ring buffer (50 items max), filter entries with `timestamp > now - 30 days`, recompute wins/losses/winRate/compositeScore for that window. Note: limited to 50 most recent matches.

### Friends Definition

Top 30 most-frequent opponents from `uniqueOpponentUids`. Capped at 30 to stay within Firestore `in` query limit.

## Security Rules

```
match /leaderboard/{uid} {
  allow read: if request.auth != null;
  allow create, update: if request.auth != null
    && request.auth.uid == uid
    && request.resource.data.winRate is number
    && request.resource.data.winRate >= 0
    && request.resource.data.winRate <= 1
    && request.resource.data.compositeScore is number
    && request.resource.data.compositeScore >= 0
    && request.resource.data.compositeScore <= 100
    && request.resource.data.wins is number
    && request.resource.data.totalMatches is number
    && request.resource.data.wins <= request.resource.data.totalMatches;
  allow delete: if request.auth != null && request.auth.uid == uid;
}
```

## Firestore Indexes

Add to `firestore.indexes.json`:

1. `leaderboard` — `compositeScore DESC` (all-time global)
2. `leaderboard` — `last30d.compositeScore DESC` (30-day global)
3. `leaderboard` — `uid ASC, compositeScore DESC` (friends all-time)
4. `leaderboard` — `uid ASC, last30d.compositeScore DESC` (friends 30-day)

## Queries

| View | Query | Cost |
|------|-------|------|
| Global All-time | `orderBy('compositeScore', 'desc').limit(25)` | 25 reads |
| Global 30-day | `orderBy('last30d.compositeScore', 'desc').limit(25)` | 25 reads |
| Friends All-time | `where('uid', 'in', top30Uids).orderBy('compositeScore', 'desc')` | ≤30 reads |
| Friends 30-day | `where('uid', 'in', top30Uids).orderBy('last30d.compositeScore', 'desc')` | ≤30 reads |
| User rank | `where('compositeScore', '>', userScore).count()` | 1 read per 1000 users |
| User entry | `doc(uid).get()` | 1 read |

## Caching Strategy

- 5-minute stale-while-revalidate via SolidJS `createResource` with TTL wrapper
- Cache key: `leaderboard:{scope}:{timeframe}`
- Invalidate own cache on match completion

## Write Path

Atomic `writeBatch()` after match completion:

```
Match completes → computeStats() → computeLeaderboardEntry()
  → writeBatch():
      1. /users/{uid}/stats/summary       (existing)
      2. /users/{uid}/public/tier          (existing)
      3. /leaderboard/{uid}               (new — only if totalMatches >= 5)
  → batch.commit()
```

All three writes succeed or fail together. No partial state.

## UI Design

### Navigation

Players page (`/players`) gains two tabs:
- **Players** tab (default) — existing local player list
- **Leaderboard** tab — new

Tab bar: sticky below TopNav, underline-style active indicator.

### Leaderboard Tab Layout

1. **Scope toggle:** "Global" | "Friends" pill buttons (Friends requires auth)
2. **Timeframe toggle:** "All Time" | "Last 30 Days" pill buttons
3. **Podium (top 3):** Three cards with rank medals (gold/silver/bronze), avatar, name, tier badge, composite score. 1st place card slightly larger.
4. **Your position card:** Highlighted, always visible. Shows "Play X more matches to qualify" if < 5 matches.
5. **Rankings list (4–25):** Compact rows — rank, avatar, name, tier badge, composite score, win rate, streak indicator.

### Empty States

- Not signed in → "Sign in to see leaderboards"
- Under 5 matches → "Play 5 matches to appear on the leaderboard"
- Friends view, no opponents → "Play against others to build your friends leaderboard"

### Design System

- Cards: `bg-surface-light rounded-xl p-4 shadow-md border border-border`
- Tier colors: reuse `TIER_COLORS` from `TierBadge`
- Icons: Lucide Solid (Trophy, Medal, Crown, TrendingUp, Users)
- Animations: entrance stagger for list items, press feedback on cards

## New Modules

| Module | Path | Purpose |
|--------|------|---------|
| Leaderboard scoring | `src/shared/utils/leaderboardScoring.ts` | `computeCompositeScore()`, `computeLast30dStats()`, `buildLeaderboardEntry()` |
| Firestore repo | `src/data/firebase/firestoreLeaderboardRepository.ts` | `getGlobalLeaderboard()`, `getFriendsLeaderboard()`, `getUserRank()`, `getUserEntry()` |
| Hook | `src/features/leaderboard/hooks/useLeaderboard.ts` | State management, caching, scope/timeframe toggles |
| Leaderboard tab | `src/features/leaderboard/components/LeaderboardTab.tsx` | Main leaderboard UI |
| Podium | `src/features/leaderboard/components/Podium.tsx` | Top 3 visual treatment |
| Rankings list | `src/features/leaderboard/components/RankingsList.tsx` | Positions 4–25 |
| Rank card | `src/features/leaderboard/components/UserRankCard.tsx` | Current user position |

## Testing Strategy

### Unit Tests (pure functions)
- `computeCompositeScore` — all tiers, boundary winRates (0, 0.5, 1.0), 0/50+ matches
- `computeLast30dStats` — empty buffer, all-within-30d, none-within-30d, mixed timestamps
- `buildLeaderboardEntry` — threshold (< 5 matches → null), field correctness

### Repository Tests (mocked Firestore)
- Global query sorted correctly
- Friends query filters by uid list
- Rank calculation via count() aggregation
- Cache TTL expiration and invalidation

### Component Tests
- Tab switching (Players ↔ Leaderboard)
- Scope toggle (Global ↔ Friends)
- Timeframe toggle (All Time ↔ Last 30 Days)
- Podium renders top 3 with correct medals
- Current user highlighted in rankings
- Empty states per scenario
- Auth gate for Friends view

### E2E Tests (Playwright)
- Sign in → play 5 matches → leaderboard entry appears → verify rank
- Friends view shows only opponents played against

## Scalability Notes

- Design works well up to ~5,000 users without modifications
- At 10K+ users: consider pre-computed ranks via Cloud Function
- Friends list capped at 30 per Firestore `in` query limit
- Inactive players (30+ days no play): consider visual "inactive" indicator in future
- Ring buffer limits `last30d` to 50 most recent matches

## Specialist Reviews

- **Firestore modeling review:** Completed. P0 issues (security validation, atomic writes) addressed in design. See security rules and write path sections.
- **UX navigation review:** Completed. Tabs in `/players` recommended over new route or profile embedding.
