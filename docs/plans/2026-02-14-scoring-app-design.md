# Multi-Sport Scoring App - Design Document

**Date**: 2026-02-14
**Status**: Approved
**Target**: Pickleball MVP (product for the pickleball community)

---

## Product Vision

A Progressive Web App for live scoring and match history tracking, starting with Pickleball. Intended as a real product targeting recreational pickleball players who want easy scorekeeping and statistics.

## Key Decisions

### User Requirements (from brainstorming)

- **Product idea** targeting the broader pickleball community
- **Offline-first with optional cloud** — works offline by default, architecture ready for cloud sync
- **Both scoring modes** — traditional side-out and rally scoring from day one
- **All match formats** — single game (11/15/21), best of 3, best of 5
- **Both UI modes** — Simple (big buttons, fast) and Detailed (serves, errors, point types)
- **Full stats from day one** — win/loss, streaks, head-to-head, serving stats
- **Dark & sporty** visual design

---

## Technology Stack

| Component | Choice | Rationale |
|---|---|---|
| **Framework** | SolidJS + TypeScript | 7KB bundle, direct DOM updates, JSX syntax. Optimal for tap-heavy mobile scoring UI. |
| **Build Tool** | Vite 6 | Industry standard for SPA builds. Best PWA plugin ecosystem. |
| **Styling** | Tailwind CSS v4 | Mobile-first, dark theme support, zero runtime cost, utility-first. |
| **State: Scoring** | XState v5 | Pickleball scoring is a textbook state machine. Prevents illegal states, enables visual modeling, provides event history for undo. |
| **State: App data** | Zustand with `persist` | Lightweight store for match history, player profiles, settings, UI state. IndexedDB persistence via middleware. |
| **Storage** | Dexie.js (IndexedDB) | Most mature IndexedDB wrapper. liveQuery for reactive UI. Battle-tested on iOS Safari. |
| **PWA** | vite-plugin-pwa (Workbox) | Most mature Vite PWA integration. Start with generateSW, migrate to injectManifest. |
| **Routing** | @solidjs/router | SolidJS-native routing with lazy loading support. |
| **Icons** | Lucide (or similar) | Lightweight icon set. |

### Validated Against Alternatives

Each choice was validated by independent research agents:

- **SolidJS over React**: Smaller bundle (7KB vs 45KB), direct DOM updates without virtual DOM overhead. Better for a tap-heavy scoring interface where responsiveness is critical. Smaller ecosystem is acceptable since scoring apps need few external libraries.
- **XState over Zustand-only**: Pickleball scoring has strict state transitions (serve rotation, side-outs, server numbers, win-by-2). XState makes illegal states impossible, provides visual state diagrams, and gives event history for undo/redo. Zustand handles the simpler CRUD/UI state.
- **Dexie.js over RxDB/PouchDB/SQLite**: Pragmatic choice. PouchDB is declining, RxDB is overkill (premium plugins), SQLite/OPFS is technically superior for complex queries but higher risk. Dexie's liveQuery integrates well with reactive UI.
- **Pure PWA over Capacitor**: No native APIs needed for scoring. PWA gives instant updates, zero app store tax, works everywhere. Capacitor can be added later (1-2 day migration) if users demand app store presence.

---

## Architecture

### Feature-Based Modular Structure

```
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
  features/
    scoring/
      components/
        Scoreboard.tsx
        ServeIndicator.tsx
        ScoreControls.tsx
      hooks/
      engine/
        pickleballEngine.ts       # XState state machine (pure, no UI)
        pickleballEngine.test.ts
      types.ts
      ScoringPage.tsx
      index.ts
    history/
      components/
      hooks/
      types.ts
      HistoryPage.tsx
      index.ts
    players/
      components/
      hooks/
      types.ts
      PlayersPage.tsx
      index.ts
  data/
    db.ts                         # Dexie database definition
    repositories/
      matchRepository.ts
      playerRepository.ts
  shared/
    components/
    hooks/
    utils/
    types/
```

### Key Architecture Principles

1. **Hardcode Pickleball** — No sport abstraction until sport #2 arrives. The scoring engine is a pure XState machine that can be swapped later.

2. **Thin Repository Pattern** — Plain exported objects with async functions. No interfaces, no classes, no DI containers. Dexie calls live inside repositories. When cloud sync arrives, swap implementations without touching UI code.

   ```typescript
   export const matchRepository = {
     async getMatch(id: string): Promise<Match | null> {
       return db.matches.get(id);
     },
     async saveMatch(match: Match): Promise<void> {
       await db.matches.put(match);
     },
   };
   ```

3. **Event Sourcing for Scores** — Store every scoring action as an event, not just current score. Enables undo/redo, audit trail, crash recovery, and conflict resolution for future sync.

   ```typescript
   interface ScoreEvent {
     id: string;
     matchId: string;
     timestamp: number;
     type: 'POINT_SCORED' | 'SIDE_OUT' | 'UNDO';
     team: 1 | 2;
     synced: boolean;
   }
   ```

4. **Persist on Every Action** — Every score change hits IndexedDB before updating UI. Never rely on in-memory state alone.

### State Management Split

| Domain | Library | Persistence |
|---|---|---|
| Live scoring engine | XState v5 | Events persisted to IndexedDB per action |
| Match history | Zustand + persist | IndexedDB via Dexie |
| Player profiles | Zustand + persist | IndexedDB via Dexie |
| UI state | Zustand | None (ephemeral) |
| Settings/preferences | Zustand + persist | IndexedDB via Dexie |

### PWA Strategy

- **Service Worker**: Workbox via vite-plugin-pwa
- **Initial strategy**: `generateSW` (quick start), migrate to `injectManifest` before production
- **Update strategy**: `registerType: 'prompt'` — never auto-update during a live match
- **Display mode**: `standalone` (no browser chrome)
- **Wake Lock API**: Prevent screen sleep during active matches
- **iOS considerations**: Use IndexedDB (not localStorage), implement export/backup as safety net

### Scoring Engine (XState)

The scoring engine handles:
- Traditional side-out scoring (only serving team scores)
- Rally scoring (point on every rally)
- Doubles serve rotation (server #1 -> server #2 -> side-out)
- First-serve rule (team starting gets only one server)
- Win-by-2 enforcement
- Game/match progression (best of 3/5)
- Undo/redo via event replay

States: `pregame -> serving -> checkWin -> gameOver -> betweenGames -> matchOver`

### Visual Design

- **Dark-first theme** with bold, sporty accents
- **Large touch targets** for courtside use (minimum 48px tap targets)
- **High contrast** scores for outdoor readability
- `active:scale-95 transition-transform` for tactile button feedback

---

## MVP Scope

### In Scope
1. Start a quick game (singles/doubles, anonymous or tracked players)
2. Live scoring with both modes (side-out + rally)
3. All match formats (single game 11/15/21, best of 3/5)
4. Simple and Detailed scoring UI modes
5. Save completed matches to history
6. View match history
7. Create player profiles
8. Full statistics (win/loss, streaks, head-to-head, serving stats)
9. Offline-first with PWA installability
10. Dark sporty theme

### Out of Scope (Future)
- Cloud sync / user accounts
- Push notifications
- App store distribution (Capacitor)
- Other sports (table tennis, tennis, badminton)
- Social/sharing features
- Tournament bracket management
