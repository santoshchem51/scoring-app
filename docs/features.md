# Feature Modules

> This doc describes what each feature IS (structure, key files, how it works). For feature status and priorities, see [ROADMAP.md](ROADMAP.md).

## Module Index

| Module | Path | Purpose |
|--------|------|---------|
| [scoring](#scoring) | `src/features/scoring/` | Core match scoring (XState engine) |
| [tournaments](#tournaments) | `src/features/tournaments/` | Tournament creation, pools, brackets |
| [players](#players) | `src/features/players/` | Local player management |
| [buddies](#buddies) | `src/features/buddies/` | Casual play groups and game sessions |
| [history](#history) | `src/features/history/` | Match history browsing |
| [leaderboard](#leaderboard) | `src/features/leaderboard/` | Global + friends rankings |
| [notifications](#notifications) | `src/features/notifications/` | In-app notification center |
| [achievements](#achievements) | `src/features/achievements/` | Badge/achievement system |
| [profile](#profile) | `src/features/profile/` | User profile with stats dashboard |
| [settings](#settings) | `src/features/settings/` | App preferences |
| [landing](#landing) | `src/features/landing/` | Public marketing page |

## Inter-Feature Dependencies

```
scoring <-- tournaments (uses scoring engine for match play)
scoring <-- buddies (casual scoring with buddy picker)
scoring --> achievements (triggers badge evaluation after match)
scoring --> leaderboard (updates leaderboard entry after match)
scoring --> profile (updates player stats after match)
buddies --> notifications (sends buddy invites/RSVP notifications)
tournaments --> notifications (sends tournament updates)
achievements --> notifications (sends achievement unlocked)
```

## Feature Anatomy

Most features follow this pattern (not every feature has every subdirectory):

```
src/features/{feature}/
├── components/     <- UI components (SolidJS)
├── engine/         <- Pure logic (no framework deps, easy to test)
├── hooks/          <- SolidJS hooks (data fetching, reactive state)
├── helpers/        <- Utility functions
├── repository/     <- Feature-specific data access
├── store/          <- Module-level stores (SolidJS signals)
└── {Feature}Page.tsx  <- Page entry point (routed via @solidjs/router)
```

---

## scoring

**Path**: `src/features/scoring/`

The core of the app. Manages match flow from setup to completion.

**Key files:**
- `engine/pickleballMachine.ts` — XState v5 state machine (game flow, sideout/rally, win-by-2, best-of-N)
- `engine/types.ts` — `ScoringContext`, `ScoringEvent` types
- `GameSetupPage.tsx` — Match configuration (game type, format, teams, buddy picker)
- `ScoringPage.tsx` — Live scoring UI with team indicators
- `components/` — ScoreControls, Scoreboard
- `hooks/useScoreAnimation.ts` — Score change animations

**State**: XState machine (the only feature using XState).

## tournaments

**Path**: `src/features/tournaments/`

Full tournament lifecycle: create, configure pools/brackets, run matches, track standings.

**Key files:**
- `engine/poolGenerator.ts` — Round-robin pool generation
- `engine/bracketGenerator.ts` — Single/double elimination brackets
- `engine/standings.ts` — `calculateStandings()` from completed matches
- `engine/rescoring.ts` — Safe re-scoring with bracket safety checks
- `engine/bracketSeeding.ts` — Pool-to-bracket advancement
- `components/BracketView.tsx`, `PoolTable.tsx`, `LiveScoreCard.tsx`
- `TournamentCreatePage.tsx`, `TournamentDetailPage.tsx`, `DiscoverPage.tsx`

**Data**: Firestore subcollections under `tournaments/{id}/` (pools, brackets, teams, registrations).

## players

**Path**: `src/features/players/`

Local player management (name, creation).

**Key files:**
- `PlayersPage.tsx` — Player list with tabs (Players | Leaderboard)
- `components/AddPlayerForm.tsx`, `PlayerCard.tsx`

**Data**: Dexie `players` table.

## buddies

**Path**: `src/features/buddies/`

Casual play: create buddy groups, start game sessions, invite friends, RSVP.

**Key files:**
- `engine/groupHelpers.ts`, `sessionHelpers.ts`, `notificationHelpers.ts`
- `hooks/useGameSession.ts`, `useBuddyGroups.ts`
- `BuddiesPage.tsx`, `CreateGroupPage.tsx`, `GroupDetailPage.tsx`, `OpenPlayPage.tsx`

**Data**: Firestore `buddyGroups`, `gameSessions`, `buddyNotifications` collections.

## history

**Path**: `src/features/history/`

Browse completed matches with score cards.

**Key files:**
- `HistoryPage.tsx` — Match list
- `components/MatchCard.tsx` — Individual match display

**Data**: Dexie `matches` table (filtered by status).

## leaderboard

**Path**: `src/features/leaderboard/`

Global and friends-scoped leaderboards with composite scoring.

**Key files:**
- `components/` — Podium (top 3), RankingsList (4-25), UserRankCard
- `hooks/useLeaderboard.ts` — 5-minute cache + in-flight dedup

**Scoring**: 40% tier + 35% winRate + 25% activity (computed in `src/shared/utils/leaderboardScoring.ts`).

**Data**: Firestore `leaderboard` collection with atomic writes.

## notifications

**Path**: `src/features/notifications/`

Unified in-app notification center (12 notification types).

**Key files:**
- `store/` — Module-level store using SolidJS signals + Firestore `onSnapshot`
- `components/NotificationRow.tsx`, `NotificationPanel.tsx`
- `engine/` — Notification type definitions, helper factories

**Data**: Firestore `users/{uid}/notifications/{id}` subcollection. Client-side only (no FCM).

## achievements

**Path**: `src/features/achievements/`

Badge system with tier-based progression.

**Key files:**
- `engine/badgeEngine.ts` — Badge evaluation logic
- `engine/badgeDefinitions.ts` — Badge catalog
- `engine/achievementHelpers.ts` — Unlock checks
- `store/` — Toast queue for achievement popups
- `repository/` — Local achievement cache (Dexie)

**Data**: Dexie `achievements` table + Firestore cache.

## profile

**Path**: `src/features/profile/`

User profile page with stats dashboard and match history.

**Key files:**
- `ProfilePage.tsx` — Auth-gated profile at `/profile`
- `hooks/` — Stats aggregation

**Data**: Firestore `playerStats`, `users/{uid}/public/tier`.

## settings

**Path**: `src/features/settings/`

App preferences (scoring defaults, display, sound, haptics, voice, notifications).

**Key files:**
- `SettingsPage.tsx` — Settings UI
- `components/` — Setting toggles and selectors

**State**: `src/stores/settingsStore.ts` (DEFAULTS + localStorage merge pattern).

## landing

**Path**: `src/features/landing/`

Public marketing page with animations and scroll effects.

**Key files:**
- `LandingPage.tsx` — Marketing content
- `animations/` — heroAnimations, scrollAnimations, initLenis (smooth scroll), cursorEffects

**Dependencies**: GSAP, Lenis, canvas-confetti, open-simplex-noise.

## Related Docs

- [Architecture](architecture.md) — System-level view of how features interconnect
- [Data Model](data-model.md) — Schema for each feature's data
- [Testing Guide](testing-guide.md) — Where to find and how to write tests for each feature
