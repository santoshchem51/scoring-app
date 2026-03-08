# Fire-and-Forget Sync Redesign — Design Document

> **Status:** Implemented (March 2026). All components built and integrated.
> Hardening fixes applied via `docs/plans/2026-03-07-sync-hardening.md`.

**Goal:** Replace the current fire-and-forget cloud sync (`.catch(console.warn)` with no retry) with a Dexie-backed sync queue that retries on failure, makes sign-in sync non-blocking, and surfaces sync status to the user.

**Architecture:** Local-first stays unchanged — all data saves to Dexie first. A persistent sync queue (Dexie table) replaces direct Firestore fire-and-forget calls. A background processor drains the queue with exponential backoff, error classification, and multi-tab safety via Web Locks API.

**Tech Stack:** Dexie 4.x (IndexedDB), Firestore, SolidJS signals, Web Locks API

---

## 1. Sync Queue Table

### Dexie Schema (version 3)

```typescript
db.version(3).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds, tournamentId',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
  tournaments: 'id, organizerId, status, date',
  syncQueue: 'id, [status+nextRetryAt], createdAt',
});
```

All existing tables preserved verbatim. No migration callback needed.

### SyncJob Interface

```typescript
export type SyncJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'awaitingAuth';

export interface SyncJob {
  id: string;                    // Deterministic: `${type}:${entityId}`
  type: 'match' | 'tournament' | 'playerStats';
  entityId: string;              // Match ID, tournament ID, etc.
  context: SyncJobContext;       // Minimal data to re-execute the sync
  status: SyncJobStatus;
  retryCount: number;
  nextRetryAt: number;           // Unix ms — REQUIRED, never undefined
  createdAt: number;
  processedAt?: number;          // For stale-lock detection
  completedAt?: number;          // For 24h prune
  lastError?: string;
  dependsOn?: string[];          // Job IDs that must complete first
}

type SyncJobContext =
  | { type: 'match'; ownerId: string; sharedWith: string[] }
  | { type: 'tournament' }
  | { type: 'playerStats'; scorerUid: string };
```

### Key Design Decisions

- **Deterministic IDs** (`match:abc123`): free deduplication via `db.syncQueue.put()` — upserting the same entity replaces the existing job.
- **Native object payloads**: IndexedDB handles structured clone natively. No JSON string serialization.
- **`playerStats` stores only `matchId` + `scorerUid`**: re-fetches match from Dexie at execution time so it always syncs the latest local state.
- **`match`/`tournament` re-fetch from Dexie at execution time**: same reason — jobs carry entity IDs, not snapshots.
- **`nextRetryAt` is required (not optional)**: compound index `[status+nextRetryAt]` silently excludes rows where either part is undefined.
- **TypeScript type declaration** must include `syncQueue: EntityTable<SyncJob, 'id'>` in `db.ts`.

### Retry Policies (Two Tiers)

| Tier | Job Types | Base Delay | Multiplier | Max Delay | Max Retries | Jitter |
|------|-----------|-----------|------------|-----------|-------------|--------|
| Simple writes | match, tournament | 3s | 2x | 5 min | 7 | +/-20% |
| Complex ops | playerStats | 15s | 3x | 30 min | 5 | +/-20% |

`resource-exhausted` errors get their own long-backoff: 60s base, 2x multiplier, max 10 min.

---

## 2. Queue Processor

### Location

`src/data/firebase/syncQueue.ts`

### Lifecycle

1. On app load: acquire Web Lock (`navigator.locks.request('picklescore-sync-queue', { mode: 'exclusive' }, processor)`). Only one tab runs the processor at a time. Include fallback guard for browsers without Web Locks support.
2. **Web Locks must be injectable** — accept a `lockProvider` parameter that defaults to `navigator.locks` in production. Tests inject a fake serial lock.
3. Adaptive polling: process ready jobs, then schedule exact `setTimeout` from next job's `nextRetryAt` — no blind 5-second polling.
4. On `window.online`: wake processor immediately.
5. On `window.offline`: pause polling.
6. On sign-out (`auth.currentUser` becomes null): halt processing.

### Job Execution

1. Query ready jobs: `status === 'pending'`, `nextRetryAt <= now`, dependencies satisfied.
2. **Dependency check**: if `dependsOn` contains job IDs, check each:
   - `completed` → satisfied
   - `failed` → fail the dependent too
   - Still pending/processing → skip this job for now
3. Claim job atomically in Dexie `rw` transaction: set `status: 'processing'`, `processedAt: now`. Transaction ensures only one tab claims each job.
4. Re-fetch entity from Dexie (match/tournament). For `playerStats`, re-fetch match by `entityId`.
5. Execute Firestore sync with **15-second timeout** per call (prevents hung calls from freezing processor).
6. On success: set `status: 'completed'`, `completedAt: now`. Keep for 24 hours (enables dependency checks), then prune.
7. On failure: classify error (see below).

### Bounded Parallelism

- Max 2 concurrent jobs.
- Per-entity serialization: two writes for the same entity run serially (tracked by in-flight `Set<string>` keyed on `type:entityId`).

### Error Classification (4 Categories)

| Category | Error Codes | Action |
|----------|-------------|--------|
| **Retryable** | `unavailable`, `deadline-exceeded`, `internal`, `cancelled`, `aborted`, `TypeError: Failed to fetch` | Backoff + jitter, increment retryCount |
| **Rate-limited** | `resource-exhausted` | Long backoff (60s base) |
| **Auth-dependent** | `unauthenticated`; `permission-denied` ONLY if token refresh fails | Set `awaitingAuth`, resume on auth state change (after token freshness check) |
| **Fatal** | `invalid-argument`, `already-exists`, `data-loss`, `out-of-range`, `unimplemented`, `permission-denied` with valid fresh token (= rules bug) | Delete job, log error |

Special cases:
- `not-found` on `playerStats` → treat as `staleJob` (tournament deleted). Delete job, log at info level.
- `not-found` on match/tournament → fatal (path bug).
- `failed-precondition` on `playerStats` → retryable (transaction contention).
- Non-Firestore errors (no `.code` property): check for `TypeError` with fetch/network in message → retryable. Unknown shape → fatal.

### `awaitingAuth` Recovery

On `onAuthStateChanged` with a valid user: force token refresh (`user.getIdToken(true)`), verify token has >1 minute validity, then reset all `awaitingAuth` jobs to `pending` with `nextRetryAt: now`.

### Startup Cleanup

Run on every app load:
1. **Reclaim stale `processing` jobs**: if `processedAt` > 10 minutes old, reset to `pending`.
2. **Prune `completed` jobs** older than 24 hours.
3. **Prune `failed` jobs** older than 30 days.

### Processor Resilience

- Wrap entire poll loop in try/catch. On unexpected error: log, sleep 5s, continue.
- Watchdog: if `lastPollAt` exceeds 30s while processor is running, restart the loop.

---

## 3. Sign-in Sync (Non-blocking)

### Revised Flow in `useAuth.ts`

```
1. await syncUserProfile()           — still blocking (fast, required by security rules)
2. enqueueLocalMatchPush()           — non-blocking: enqueue jobs to Dexie queue
3. pullCloudMatchesToLocal()         — non-blocking: runs in background
   .then(() => setSyncing(false))
   .catch(() => { setSyncError(true); setSyncing(false); })
```

### New Signals

- `syncError`: `createSignal<boolean>(false)` — set when pull fails. Returned from `useAuth()`.
- Separate from `syncing` (which tracks sign-in sync duration) and `syncStatus` (which tracks queue state).

### Pull Recency Guard

Inside `pullCloudMatchesToLocal`, before writing each cloud match to Dexie:

```
existing = matchRepository.getById(cloudMatch.id)
if existing?.status === 'in-progress' → skip (never overwrite active scoring)
if existing has pending/processing/awaitingAuth sync job → skip
if !existing → write (new match from cloud)
if existing?.status === 'completed' → write (immutable, safe to overwrite)
```

### Batched Dexie Writes

Wrap the pull's Dexie writes in a single `db.transaction('rw', db.matches, ...)` so `liveQuery` fires one notification after all matches are written, not N times. Prevents history page flash.

### Ownership Tracking

Add `ownerUid?: string` to local `Match` interface in `types.ts`:
- Set to `auth.currentUser?.uid` on local match creation.
- Set from `cloudMatch.ownerId` on cloud pull.
- No Dexie index needed (filtered in-memory during push).
- Existing matches have `undefined` (treated as "mine" by push filter).

`enqueueLocalMatchPush` reads all local matches, filters to only those where `!ownerUid` (pre-cloud) or `ownerUid === uid` (mine), then enqueues each as a `match` sync job.

### `pullCloudMatchesToLocal` Must Copy `ownerUid`

The current code explicitly lists fields when constructing `localMatch` from `cloudMatch`. Must add `ownerUid: cloudMatch.ownerId` to this mapping.

---

## 4. Sync Status UI

### New Module: `src/data/firebase/useSyncStatus.ts`

Global signals (module-level, same pattern as `useAuth.ts`):

```typescript
const [syncStatus, setSyncStatus] = createSignal<'idle' | 'processing' | 'pending' | 'failed'>('idle');
const [pendingCount, setPendingCount] = createSignal(0);
const [failedCount, setFailedCount] = createSignal(0);
```

Updated by the queue processor as state changes.

### TopNav Indicator

- **`idle`**: nothing shown.
- **`processing`**: small pulsing dot next to avatar (neutral color, same badge style as notifications).
- **`pending`**: same dot, static (jobs waiting for retry).
- **`failed`**: amber warning dot. Tapping avatar dropdown shows "X syncs failed" with "Retry" option.

No global banners, toasts, or modals.

### History/Profile Error Banner

Only shown when the sign-in pull specifically fails (`syncError()` signal):
- Small inline text: "Couldn't load cloud matches. Tap to retry."
- Scoped to HistoryPage and ProfilePage only.
- Dismisses on successful retry or manual dismissal.

### Settings Page Addition

- "Cloud Sync" row showing last successful sync timestamp (stored in localStorage).
- "Sync Now" button (disabled while syncing).
- Pending/failed job count if any.

---

## 5. Removals

### Drop `syncScoreEventToCloud`

No code in the codebase reads score events back from Firestore. The match-level sync already captures final scores, games, and winner.

**Files to edit:**
- `src/data/firebase/cloudSync.ts` — remove `syncScoreEventToCloud` method + import of `firestoreScoreEventRepository`
- `src/features/scoring/hooks/useScoringActor.ts` — remove 3 call sites (lines 121, 150, 176)
- `src/data/firebase/__tests__/cloudSync.test.ts` — remove method existence test + mock
- Test mock cleanup in `BuddiesPage.test.tsx`, `useAuth.test.ts`

**Keep:**
- Local Dexie `scoreEvents` table (used for undo log).
- `src/data/repositories/scoreEventRepository.ts` (local saves continue).
- Firestore security rules for scoreEvents (defensive, no harm).

### Schema Changes

- Add `ownerUid?: string` to `Match` interface (no Dexie version bump — not indexed).
- Add `SyncJob` interface and `syncQueue` EntityTable type declaration.

---

## 6. Testing Strategy

### Unit Tests (~35-40)

**syncQueue.ts:**
- Enqueue with deterministic ID (dedup on re-enqueue)
- Claim job atomically (Dexie `rw` transaction)
- Claim transaction conflict (two concurrent callers, only one wins)
- Dependency check: completed → satisfied, failed → fail dependent, pending → skip
- Retry with backoff calculation + ceiling test (doesn't grow unbounded)
- `nextRetryAt` in future → job skipped by processor
- Error classification: retryable, rate-limited, auth-dependent, fatal
- `permission-denied` + valid token → fatal (not auth-dependent)
- Network `TypeError` (no `.code`) → retryable
- Unknown error code → safe default
- Stale job reclaim (processing > 10 min)
- Prune completed (>24h), prune failed (>30d)
- Prune does NOT delete in-progress jobs
- Queue persistence across simulated page reload (close/reopen Dexie)
- Web Locks injectable (fake serial lock in tests)

**cloudSync.ts:**
- Refactored methods enqueue instead of direct Firestore calls
- `enqueueLocalMatchPush` filters owned-only (ownerUid match)
- `enqueueLocalMatchPush` with zero owned matches → zero enqueues
- Pull recency guard: skips in-progress matches
- Pull recency guard: skips matches with awaitingAuth sync jobs
- Pull recency guard: partial batch (skip 1, commit rest)
- Pull batched Dexie transaction (single liveQuery notification)
- Pull copies `ownerUid` from cloud match

**useSyncStatus.ts:**
- Signal updates as processor state changes (idle → processing → idle)
- Steady state: empty queue → idle
- Failed jobs → failed status with count

### Integration Tests (~5)

- Full flow: enqueue match → processor picks up → Firestore write → mark completed
- Dependency chain: match completes → playerStats becomes eligible
- Auth-dependent: permission error → awaitingAuth → auth change → re-queued
- Sign-in non-blocking: pull writes trigger liveQuery update on HistoryPage
- Batched pull: 10 matches written in single transaction, liveQuery fires once

### E2E Tests (~5-6)

- Sign in → history page shows cloud matches (pull works)
- Sign in with local matches → matches appear in Firestore (push works)
- TopNav sync indicator visible during active sync, clears on completion
- **Offline enqueue → come online → sync completes** (core resilience scenario)
- **Two-tab single-processing** (Web Locks prevents duplicate processing)
- Auth error recovery: sign out mid-sync → re-sign-in → jobs resume

### Performance Tests (~2)

- 100 queued jobs all succeed: baseline throughput < 2 seconds
- 100 queued jobs with 20% transient failure: retry logic doesn't cause O(n^2) re-scans

---

## 7. Dependency Chain

```
playerStats:${matchId}  ──dependsOn──▶  match:${matchId}
```

Only one dependency edge exists: `playerStats` must not run until the match exists in Firestore. The processor checks `dependsOn` before claiming. If the match job is `completed` (present in queue with that status for up to 24h), the dependency is satisfied. If the match job is `failed`, the dependent `playerStats` job also fails.

---

## 8. Migration Path

This is additive — no breaking changes to existing data:
1. Dexie v3 adds `syncQueue` table. Existing tables unchanged.
2. `ownerUid` is optional on Match — existing matches get `undefined` (treated as owned).
3. `cloudSync` methods keep same signatures (void for runtime sync, Promise for sign-in).
4. `syncScoreEventToCloud` calls removed — no functional change since nothing reads them.
5. New `syncStatus` signal is independent of existing `syncing` signal.
