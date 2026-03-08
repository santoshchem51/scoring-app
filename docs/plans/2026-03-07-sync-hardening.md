# Sync Queue Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 critical and 3 important bugs found by specialist reviews of the fire-and-forget sync system, add test coverage, and update stale documentation.

**Architecture:** Targeted fixes to existing sync infrastructure. No new modules — all changes modify `syncProcessor.ts`, `syncQueue.ts`, `useSyncStatus.ts`, `syncErrors.ts`, `TopNav.tsx`, and their test files. Each task is independent and can be tested in isolation.

**Tech Stack:** SolidJS 1.9, Dexie.js v4, TypeScript, Vitest, Firebase Auth

---

### Task 1: Reset Sync Status on Sign-Out

**Why:** When a user signs out, `stopProcessor()` is called but the SolidJS signals in `useSyncStatus.ts` are never reset. The signed-out user sees a stale sync indicator dot in TopNav. (Specialist finding C5)

**Files:**
- Modify: `src/data/firebase/useSyncStatus.ts`
- Modify: `src/data/firebase/syncProcessor.ts:372-385`
- Test: `src/data/firebase/__tests__/useSyncStatus.test.ts`
- Test: `src/data/firebase/__tests__/syncProcessor.test.ts`

**Step 1: Write the failing tests**

In `src/data/firebase/__tests__/useSyncStatus.test.ts`, add:

```typescript
it('resetSyncStatus resets all signals to defaults', async () => {
  // Set non-default values
  setSyncProcessing();
  expect(syncStatus()).toBe('processing');

  const { resetSyncStatus } = await import('../useSyncStatus');
  resetSyncStatus();

  expect(syncStatus()).toBe('idle');
  expect(pendingCount()).toBe(0);
  expect(failedCount()).toBe(0);
});
```

In `src/data/firebase/__tests__/syncProcessor.test.ts`, add:

```typescript
it('stopProcessor resets sync status signals', async () => {
  const { resetSyncStatus, syncStatus } = await import('../useSyncStatus');
  const { setSyncProcessing } = await import('../useSyncStatus');
  // Simulate active state
  setSyncProcessing();
  expect(syncStatus()).toBe('processing');

  stopProcessor();

  expect(syncStatus()).toBe('idle');
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/firebase/__tests__/useSyncStatus.test.ts src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: FAIL — `resetSyncStatus` is not exported

**Step 3: Implement resetSyncStatus**

In `src/data/firebase/useSyncStatus.ts`, add after line 10:

```typescript
export function resetSyncStatus(): void {
  setSyncStatus('idle');
  setPendingCount(0);
  setFailedCount(0);
}
```

In `src/data/firebase/syncProcessor.ts`, add `resetSyncStatus` to the import on line 21:

```typescript
import { setSyncProcessing, updateSyncStatus, resetSyncStatus } from './useSyncStatus';
```

In `stopProcessor()` (line 372), add `resetSyncStatus()` call after `cancelSleep()`:

```typescript
export function stopProcessor(): void {
  running = false;

  cancelSleep();
  resetSyncStatus();

  if (onlineListener) {
    window.removeEventListener('online', onlineListener);
    onlineListener = null;
  }
  if (offlineListener) {
    window.removeEventListener('offline', offlineListener);
    offlineListener = null;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/useSyncStatus.test.ts src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/useSyncStatus.ts src/data/firebase/syncProcessor.ts src/data/firebase/__tests__/useSyncStatus.test.ts src/data/firebase/__tests__/syncProcessor.test.ts
git commit -m "fix: reset sync status signals on sign-out (C5)"
```

---

### Task 2: Periodic Stale Job Reclaim in Poll Loop

**Why:** `reclaimStaleJobs()` only runs at startup. If a tab crashes mid-processing, its claimed jobs stay in `processing` status until the next app restart (up to 10 minutes stale threshold). The surviving tab's processor never reclaims them during runtime. This can cause data corruption if the crashed tab's Firestore write completes while the new tab eventually reclaims and re-processes the same job. (Specialist findings C1, C3)

**Files:**
- Modify: `src/data/firebase/syncProcessor.ts:291-311`
- Test: `src/data/firebase/__tests__/syncProcessor.test.ts`

**Step 1: Write the failing test**

In `src/data/firebase/__tests__/syncProcessor.test.ts`, add:

```typescript
describe('STALE_CHECK_INTERVAL', () => {
  it('is exported and set to a reasonable interval', async () => {
    const mod = await import('../syncProcessor');
    expect(mod.STALE_CHECK_INTERVAL_MS).toBeDefined();
    expect(mod.STALE_CHECK_INTERVAL_MS).toBeGreaterThanOrEqual(60_000);
    expect(mod.STALE_CHECK_INTERVAL_MS).toBeLessThanOrEqual(300_000);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: FAIL — `STALE_CHECK_INTERVAL_MS` not exported

**Step 3: Implement periodic stale reclaim**

In `src/data/firebase/syncProcessor.ts`:

Add constant after line 29:

```typescript
export const STALE_CHECK_INTERVAL_MS = 120_000; // 2 minutes
```

Add module state after line 48:

```typescript
let lastStaleCheck = 0;
```

In `pollLoop()` (line 291), add stale check inside the loop, right after `processOnce()`:

```typescript
async function pollLoop(): Promise<void> {
  while (running) {
    try {
      await processOnce();

      // Periodic stale job reclaim (every STALE_CHECK_INTERVAL_MS)
      const now = Date.now();
      if (now - lastStaleCheck >= STALE_CHECK_INTERVAL_MS) {
        lastStaleCheck = now;
        const reclaimed = await reclaimStaleJobs();
        if (reclaimed > 0) {
          console.info(`[syncProcessor] Reclaimed ${reclaimed} stale job(s)`);
        }
      }

      // Adaptive polling: schedule next run based on earliest pending retry
      const nextRetry = await getNextRetryTime();

      if (nextRetry !== null) {
        const delay = Math.max(0, nextRetry - Date.now());
        await sleep(delay);
      } else {
        // No pending jobs — watchdog interval
        await sleep(WATCHDOG_INTERVAL_MS);
      }
    } catch (err) {
      console.error('[syncProcessor] Poll loop error:', err);
      await sleep(ERROR_SLEEP_MS);
    }
  }
}
```

Reset `lastStaleCheck` in `stopProcessor()`:

```typescript
export function stopProcessor(): void {
  running = false;
  lastStaleCheck = 0;

  cancelSleep();
  resetSyncStatus();
  // ... rest unchanged
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/syncProcessor.ts src/data/firebase/__tests__/syncProcessor.test.ts
git commit -m "fix: run stale job reclaim periodically in poll loop (C1/C3)"
```

---

### Task 3: Per-Type Job Timeouts

**Why:** All job types share a 15-second timeout (`JOB_TIMEOUT_MS`). The `playerStats` job type calls `processMatchCompletion` which performs 12-15 Firestore round-trips (read stats, compute tiers, write stats, evaluate achievements, write achievements). 15 seconds is insufficient on slower connections, causing false `deadline-exceeded` errors that burn retries. (Specialist finding I6)

**Files:**
- Modify: `src/data/firebase/syncProcessor.ts:28,70-88`
- Test: `src/data/firebase/__tests__/syncProcessor.test.ts`

**Step 1: Write the failing test**

In `src/data/firebase/__tests__/syncProcessor.test.ts`, add:

```typescript
describe('JOB_TIMEOUT_MAP', () => {
  it('uses longer timeout for playerStats than match/tournament', async () => {
    const mod = await import('../syncProcessor');
    expect(mod.JOB_TIMEOUT_MAP.playerStats).toBeGreaterThan(mod.JOB_TIMEOUT_MAP.match);
    expect(mod.JOB_TIMEOUT_MAP.match).toBe(mod.JOB_TIMEOUT_MAP.tournament);
  });

  it('playerStats timeout is at least 30 seconds', async () => {
    const mod = await import('../syncProcessor');
    expect(mod.JOB_TIMEOUT_MAP.playerStats).toBeGreaterThanOrEqual(30_000);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: FAIL — `JOB_TIMEOUT_MAP` not exported

**Step 3: Implement per-type timeouts**

In `src/data/firebase/syncProcessor.ts`:

Replace the `JOB_TIMEOUT_MS` constant (line 28) with:

```typescript
export const JOB_TIMEOUT_MAP: Record<SyncJob['type'], number> = {
  match: 15_000,          // 15 seconds — single setDoc
  tournament: 15_000,     // 15 seconds — single save
  playerStats: 45_000,    // 45 seconds — 12-15 Firestore round-trips
};
```

Add `SyncJob` to the type import on line 1:

```typescript
import type { SyncJob } from './syncQueue.types';
```

Update `executeJob()` (line 62) to use per-type timeout:

```typescript
async function executeJob(job: SyncJob): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    const err = new Error('No authenticated user');
    (err as any).code = 'unauthenticated';
    throw err;
  }

  const timeoutMs = JOB_TIMEOUT_MAP[job.type];

  // Set up timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const abortPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => {
        const err = new Error(`Job timed out after ${timeoutMs / 1000} seconds`);
        (err as any).code = 'deadline-exceeded';
        reject(err);
      });
    });

    const workPromise = executeJobWork(job, user.uid);
    await Promise.race([workPromise, abortPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/syncProcessor.ts src/data/firebase/__tests__/syncProcessor.test.ts
git commit -m "fix: use per-type job timeouts (45s for playerStats) (I6)"
```

---

### Task 4: Atomic resetAwaitingAuthJobs

**Why:** `resetAwaitingAuthJobs()` reads all `awaitingAuth` jobs outside a transaction, then writes inside a separate transaction. Between the read and write, another operation (e.g., the processor setting a new job to `awaitingAuth`) could create a job that gets missed. The read should be inside the same transaction. (Specialist finding I3)

**Files:**
- Modify: `src/data/firebase/syncQueue.ts:168-188`
- Test: `src/data/firebase/__tests__/syncQueue.test.ts`

**Step 1: Write the failing test**

In `src/data/firebase/__tests__/syncQueue.test.ts`, add to the `resetAwaitingAuthJobs` describe block:

```typescript
it('reads and writes within a single transaction (atomic)', async () => {
  // Enqueue two awaitingAuth jobs
  await enqueueJob('match', 'm1', { type: 'match', ownerId: 'u1', sharedWith: [] });
  await setJobAwaitingAuth('match:m1');
  await enqueueJob('match', 'm2', { type: 'match', ownerId: 'u1', sharedWith: [] });
  await setJobAwaitingAuth('match:m2');

  // Spy on db.transaction to verify it's called
  const txSpy = vi.spyOn(db, 'transaction');

  const count = await resetAwaitingAuthJobs();

  expect(count).toBe(2);
  // Should use a single rw transaction that encompasses both read and write
  expect(txSpy).toHaveBeenCalledWith('rw', db.syncQueue, expect.any(Function));

  const j1 = await db.syncQueue.get('match:m1');
  const j2 = await db.syncQueue.get('match:m2');
  expect(j1?.status).toBe('pending');
  expect(j2?.status).toBe('pending');

  txSpy.mockRestore();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/syncQueue.test.ts`
Expected: FAIL — `db.transaction` is NOT called for the read portion (read happens before the transaction)

**Step 3: Make resetAwaitingAuthJobs fully atomic**

In `src/data/firebase/syncQueue.ts`, replace `resetAwaitingAuthJobs` (lines 168-188):

```typescript
export async function resetAwaitingAuthJobs(): Promise<number> {
  const now = Date.now();

  return db.transaction('rw', db.syncQueue, async () => {
    const awaitingJobs = await db.syncQueue
      .where('[status+nextRetryAt]')
      .between(['awaitingAuth', Dexie.minKey], ['awaitingAuth', Dexie.maxKey], true, true)
      .toArray();

    if (awaitingJobs.length === 0) return 0;

    for (const job of awaitingJobs) {
      await db.syncQueue.update(job.id, {
        status: 'pending',
        nextRetryAt: now,
      });
    }

    return awaitingJobs.length;
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/syncQueue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/syncQueue.ts src/data/firebase/__tests__/syncQueue.test.ts
git commit -m "fix: make resetAwaitingAuthJobs fully atomic (I3)"
```

---

### Task 5: TopNav Sync Indicator Accessibility

**Why:** The sync indicator dot in TopNav has no accessible text — screen readers cannot convey the sync state to users. The `<span>` element at line 148-158 of `TopNav.tsx` has `data-testid` but no `aria-label` or visually-hidden text. (Specialist finding I12)

**Files:**
- Modify: `src/shared/components/TopNav.tsx:147-158`
- Test: `src/shared/components/__tests__/TopNav.sync.test.tsx`

**Step 1: Write the failing test**

In `src/shared/components/__tests__/TopNav.sync.test.tsx`, add:

```typescript
it('sync indicator has accessible label for processing state', async () => {
  mockSyncStatus.mockImplementation(() => 'processing');
  render(() => <TopNav />);
  const indicator = screen.getByTestId('sync-indicator');
  expect(indicator.getAttribute('role')).toBe('status');
  expect(indicator.getAttribute('aria-label')).toBe('Syncing');
});

it('sync indicator has accessible label for failed state', async () => {
  mockSyncStatus.mockImplementation(() => 'failed');
  render(() => <TopNav />);
  const indicator = screen.getByTestId('sync-indicator');
  expect(indicator.getAttribute('aria-label')).toBe('Sync failed');
});

it('sync indicator has accessible label for pending state', async () => {
  mockSyncStatus.mockImplementation(() => 'pending');
  render(() => <TopNav />);
  const indicator = screen.getByTestId('sync-indicator');
  expect(indicator.getAttribute('aria-label')).toBe('Sync pending');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/components/__tests__/TopNav.sync.test.tsx`
Expected: FAIL — no `role` or `aria-label` attributes on sync indicator

**Step 3: Add accessible attributes to sync indicator**

In `src/shared/components/TopNav.tsx`, replace the sync indicator `<span>` (lines 147-158):

```tsx
<Show when={syncStatus() !== 'idle'}>
  <span
    role="status"
    data-testid="sync-indicator"
    aria-label={
      syncStatus() === 'failed'
        ? 'Sync failed'
        : syncStatus() === 'processing'
        ? 'Syncing'
        : 'Sync pending'
    }
    class={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-light ${
      syncStatus() === 'failed'
        ? 'bg-amber-400'
        : syncStatus() === 'processing'
        ? 'bg-primary animate-pulse'
        : 'bg-primary'
    }`}
  />
</Show>
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/components/__tests__/TopNav.sync.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/components/TopNav.tsx src/shared/components/__tests__/TopNav.sync.test.tsx
git commit -m "fix: add accessible labels to TopNav sync indicator (I12)"
```

---

### Task 6: Fix error classification for failed-precondition

**Why:** The `syncErrors.ts` classifies `failed-precondition` as `retryable` for `playerStats` (treating it as transaction contention). However, `failed-precondition` in Firestore typically means the operation requires conditions that aren't met (e.g., document must exist). For actual transaction contention, Firestore throws `aborted`, not `failed-precondition`. This means real precondition failures on playerStats get retried instead of failed. (Specialist finding I8)

**Files:**
- Modify: `src/data/firebase/syncErrors.ts:74-78`
- Test: `src/data/firebase/__tests__/syncErrors.test.ts`

**Step 1: Write the failing test**

In `src/data/firebase/__tests__/syncErrors.test.ts`, update the existing `failed-precondition` tests:

```typescript
describe('failed-precondition handling', () => {
  it('classifies failed-precondition as fatal for match', () => {
    const err = { code: 'failed-precondition', message: 'precondition' };
    expect(classifyError(err, 'match')).toBe('fatal');
  });

  it('classifies failed-precondition as fatal for tournament', () => {
    const err = { code: 'failed-precondition', message: 'precondition' };
    expect(classifyError(err, 'tournament')).toBe('fatal');
  });

  it('classifies failed-precondition as fatal for playerStats', () => {
    const err = { code: 'failed-precondition', message: 'precondition' };
    expect(classifyError(err, 'playerStats')).toBe('fatal');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/syncErrors.test.ts`
Expected: FAIL — playerStats returns `retryable` instead of `fatal`

**Step 3: Fix failed-precondition classification**

In `src/data/firebase/syncErrors.ts`, replace lines 74-78:

```typescript
    // failed-precondition: conditions not met (e.g., document must exist).
    // NOT transaction contention — that throws 'aborted' (already in RETRYABLE_CODES).
    if (code === 'failed-precondition') {
      return 'fatal';
    }
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/syncErrors.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/syncErrors.ts src/data/firebase/__tests__/syncErrors.test.ts
git commit -m "fix: classify failed-precondition as fatal for all job types (I8)"
```

---

### Task 7: Update Stale Documentation

**Why:** The sync redesign plan (`docs/plans/2026-03-03-fire-and-forget-sync-plan.md`) describes creating files that already exist — the implementation is complete. The design doc needs updating to reflect actual state. The ROADMAP needs P1 updated. (Codebase integration specialist finding)

**Files:**
- Delete: `docs/plans/2026-03-03-fire-and-forget-sync-plan.md` (stale plan — all tasks done)
- Modify: `docs/plans/2026-03-03-fire-and-forget-sync-design.md` (add "Status: Implemented" header)
- Modify: `docs/ROADMAP.md` (update P1 section)

**Step 1: Archive the stale plan**

Delete the stale plan file since all tasks are implemented:

```bash
git rm docs/plans/2026-03-03-fire-and-forget-sync-plan.md
```

**Step 2: Update the design doc header**

In `docs/plans/2026-03-03-fire-and-forget-sync-design.md`, add at the top (after the title):

```markdown
> **Status:** Implemented (March 2026). All components built and integrated.
> Hardening fixes applied via `docs/plans/2026-03-07-sync-hardening.md`.
```

**Step 3: Update ROADMAP.md P1 section**

In `docs/ROADMAP.md`, replace the P1 section with:

```markdown
### P1 — Sync Queue Hardening
> Core sync queue is implemented. Hardening pass to fix specialist-review findings.
>
> *Fixes applied via `docs/plans/2026-03-07-sync-hardening.md`.*

- [x] SyncJob types + Dexie schema
- [x] Retry policy + exponential backoff with jitter
- [x] Error classification (retryable, rate-limited, auth-dependent, fatal)
- [x] Sync queue enqueue + claim operations
- [x] Queue processor (Web Locks, adaptive polling, bounded parallelism)
- [x] Refactor cloudSync.ts to use queue
- [x] useSyncStatus hook + TopNav indicator
- [x] Drop legacy syncScoreEventToCloud
- [x] Startup cleanup + auth recovery
- [ ] Reset sync signals on sign-out
- [ ] Periodic stale job reclaim
- [ ] Per-type job timeouts
- [ ] Atomic resetAwaitingAuthJobs
- [ ] TopNav sync indicator accessibility
- [ ] Error classification hardening
- [ ] Full test suite + E2E tests
```

**Step 4: Commit**

```bash
git add docs/plans/2026-03-03-fire-and-forget-sync-design.md docs/ROADMAP.md
git commit -m "docs: update stale sync docs, mark implementation complete, add hardening tasks"
```

---

## Summary

| Task | Issue(s) | Severity | Files Changed |
|------|----------|----------|---------------|
| 1. Reset sync status on sign-out | C5 | Critical | useSyncStatus.ts, syncProcessor.ts |
| 2. Periodic stale job reclaim | C1, C3 | Critical | syncProcessor.ts |
| 3. Per-type job timeouts | I6 | Important | syncProcessor.ts |
| 4. Atomic resetAwaitingAuthJobs | I3 | Important | syncQueue.ts |
| 5. TopNav sync indicator a11y | I12 | Important | TopNav.tsx |
| 6. Fix failed-precondition classification | I8 | Important | syncErrors.ts |
| 7. Update stale documentation | — | Cleanup | ROADMAP.md, design doc, plan |

**Test commands:**
- Unit tests: `npx vitest run`
- Specific file: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
- Type check: `npx tsc --noEmit`
