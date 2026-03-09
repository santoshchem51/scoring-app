# Architecture

## System Overview

PickleScore is an offline-first PWA for pickleball scoring and tournament management. The app works entirely offline using IndexedDB (via Dexie.js) and syncs to Firebase Firestore when online.

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────────┐ │
│  │ SolidJS  │──▶│  Stores  │──▶│   Dexie.js   │ │
│  │   UI     │   │ (Signals)│   │  (IndexedDB) │ │
│  └──────────┘   └──────────┘   └──────┬───────┘ │
│       │                               │          │
│       │         ┌──────────┐          │          │
│       └────────▶│  XState  │          │          │
│                 │ (Scoring)│   ┌──────▼───────┐  │
│                 └──────────┘   │  Sync Queue  │  │
│                                │  (Dexie tbl) │  │
│                                └──────┬───────┘  │
│                                       │          │
└───────────────────────────────────────┼──────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  Firebase Cloud    │
                              │  ┌─────────────┐   │
                              │  │  Firestore   │   │
                              │  └─────────────┘   │
                              │  ┌─────────────┐   │
                              │  │    Auth      │   │
                              │  └─────────────┘   │
                              └────────────────────┘
```

## Feature Module Pattern

All features live under `src/features/`. Each feature is a self-contained module:

```
src/features/{feature}/
├── components/     UI components specific to this feature
├── engine/         Pure logic (state machines, calculations)
├── hooks/          SolidJS hooks (data fetching, reactive state)
├── helpers/        Utility functions
├── repository/     Data access (if feature-specific)
├── store/          Feature-level stores (signals)
└── {Feature}Page.tsx   Page-level entry component
```

Not every feature has every subdirectory — only what it needs.

The 11 feature modules are: `scoring`, `tournaments`, `players`, `buddies`, `history`, `leaderboard`, `notifications`, `achievements`, `profile`, `settings`, `landing`.

## State Management

PickleScore uses three state management approaches, each for a different purpose:

| Approach | Used For | Location |
|----------|----------|----------|
| **XState v5** | Scoring state machine (game flow, serving, win detection) | `src/features/scoring/engine/pickleballMachine.ts` |
| **SolidJS signals** | All other reactive state (settings, notifications, achievements, UI state) | `src/stores/`, feature `store/` dirs |
| **Dexie.js live queries** | Reactive database reads (match lists, player lists) | Via `useLiveQuery` hook |

> **Note**: `zustand` appears in `package.json` but is not imported anywhere. All stores use SolidJS signals directly.

### XState Scoring Machine

The scoring engine (`pickleballMachine.ts`) manages the full game lifecycle:

- **Input config**: game type (singles/doubles), scoring mode (rally/sideout), match format (single/best-of-3/best-of-5), points to win
- **Guards**: `canScore` (sideout: only serving team), `isGameWon` (win-by-2 rule), `isMatchWon`
- **State flow**: `idle` → `playing` → `gameOver` → `matchOver`

### Settings Store Pattern

The settings store (`src/stores/settingsStore.ts`) merges defaults with localStorage:

```typescript
// DEFAULTS has every field. localStorage may have only some.
const settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('settings')) }
```

**Critical rule**: Always add new settings fields to `DEFAULTS`. Existing users' localStorage won't have them.

## Data Layer: Offline-First with Cloud Sync

### Local Database (Dexie.js / IndexedDB)

All data is stored locally first. See [Data Model](data-model.md) for full schema.

### Sync Queue

The sync queue bridges local and cloud data. When data changes:

1. A `SyncJob` is enqueued in the `syncQueue` Dexie table
2. The sync processor polls for pending jobs
3. Jobs are executed against Firestore with retry logic
4. Completed jobs are pruned after 24 hours

Key properties:
- **Deterministic IDs**: `${type}:${entityId}` — re-enqueueing the same entity updates the existing job
- **Dependency tracking**: `playerStats` jobs wait for their `match` job to complete
- **Error classification**: retryable, rate-limited, auth-dependent, fatal (see [Data Model](data-model.md#sync-queue))
- **Exponential backoff with jitter**: prevents thundering herd on recovery

### Cloud Sync Orchestration

`src/data/firebase/cloudSync.ts` coordinates bidirectional sync:

- **Push**: `syncMatchToCloud()` enqueues match for sync (fire-and-forget)
- **Pull on sign-in**: `pullCloudMatchesToLocal()` hydrates Dexie from Firestore
- **Conflict resolution**: In-progress local matches are never overwritten; owned matches take precedence over shared

## Auth Flow

1. User clicks "Sign in with Google" on Settings page
2. Firebase Auth handles OAuth flow
3. `useAuth` hook (global singleton) updates reactive signals: `user`, `loading`, `syncing`
4. On successful sign-in, `pullCloudMatchesToLocal()` runs
5. All subsequent data writes enqueue sync jobs
6. On sign-out, sync stops but local data persists

Auth state is shared app-wide via `src/shared/hooks/useAuth.ts` (module-level signals, not a provider).

## PWA Architecture

- **Service worker**: Generated by `vite-plugin-pwa` (Workbox)
- **Manifest**: Auto-generated with app icons
- **Offline**: Full offline support via IndexedDB (Dexie) — the app works without network
- **Install prompt**: Standard PWA install banner

## Related Docs

- [Data Model](data-model.md) — Dexie tables, Firestore collections, sync queue schema
- [Features](features.md) — Detailed guide to each feature module
- [Testing Guide](testing-guide.md) — How to run tests against this architecture
- [Debugging](debugging.md) — How to inspect state, sync queue, and IndexedDB at runtime
