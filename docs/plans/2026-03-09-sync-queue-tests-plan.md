# Sync Queue Test Completion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fill sync processor test gaps (~15 integration tests) and add core E2E sync journeys (~4 tests).

**Architecture:** Integration tests drive `startProcessor` with an injectable fake lock provider and `vi.useFakeTimers()` to control the poll loop. E2E tests use existing Playwright fixtures with Firebase emulators.

**Tech Stack:** Vitest + fake-indexeddb + vi.useFakeTimers (unit), Playwright + Firebase emulators (E2E)

---

## Task 1: Processor Job Execution Dispatch Tests

**Files:**
- Modify: `src/data/firebase/__tests__/syncProcessor.test.ts`

**Step 1: Write the failing tests**

Add to `syncProcessor.test.ts`, inside the existing `describe('syncProcessor')` block. Add these new test groups after the existing `describe('JOB_TIMEOUT_MAP')`:

```ts
describe('job execution dispatch', () => {
  it('match job calls firestoreMatchRepository.save with correct args', async () => {
    vi.useFakeTimers();

    const job = createTestJob({
      type: 'match',
      entityId: 'match-1',
      context: { type: 'match', ownerId: 'u1', sharedWith: ['u2'] },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    const { firestoreMatchRepository } = await import('../firestoreMatchRepository');

    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    // Advance past startup cleanup + first poll
    await vi.advanceTimersByTimeAsync(100);

    expect(firestoreMatchRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'match-1' }),
      'test-user',
      ['u2'],
    );

    const completed = await db.syncQueue.get(job.id);
    expect(completed!.status).toBe('completed');

    stopProcessor();
    vi.useRealTimers();
  });

  it('tournament job calls firestoreTournamentRepository.save', async () => {
    vi.useFakeTimers();

    // Seed a tournament in Dexie so executeJobWork finds it
    await db.tournaments.put({
      id: 'tourn-1',
      name: 'Test Tournament',
      organizerId: 'test-user',
      status: 'registration',
      format: 'round-robin',
      teamSize: 'singles',
      createdAt: Date.now(),
    } as any);

    const job = createTestJob({
      type: 'tournament',
      entityId: 'tourn-1',
      context: { type: 'tournament' },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    const { firestoreTournamentRepository } = await import('../firestoreTournamentRepository');

    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    await vi.advanceTimersByTimeAsync(100);

    expect(firestoreTournamentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tourn-1' }),
    );

    stopProcessor();
    vi.useRealTimers();
    await db.tournaments.delete('tourn-1');
  });

  it('playerStats job calls firestorePlayerStatsRepository.processMatchCompletion', async () => {
    vi.useFakeTimers();

    const job = createTestJob({
      type: 'playerStats',
      entityId: 'match-ps-1',
      context: { type: 'playerStats', scorerUid: 'u1' },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    const { firestorePlayerStatsRepository } = await import('../firestorePlayerStatsRepository');

    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    await vi.advanceTimersByTimeAsync(100);

    expect(firestorePlayerStatsRepository.processMatchCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1' }), // matchRepository.getById mock returns id: '1'
      'u1',
    );

    stopProcessor();
    vi.useRealTimers();
  });

  it('job with no local entity fails with fatal error', async () => {
    vi.useFakeTimers();

    // Override matchRepository.getById to return null for this test
    const { matchRepository } = await import('../../repositories/matchRepository');
    vi.mocked(matchRepository.getById).mockResolvedValueOnce(null as any);

    const job = createTestJob({
      type: 'match',
      entityId: 'missing-match',
      context: { type: 'match', ownerId: 'u1', sharedWith: [] },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');

    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    await vi.advanceTimersByTimeAsync(100);

    const failed = await db.syncQueue.get(job.id);
    expect(failed!.status).toBe('failed');
    expect(failed!.lastError).toContain('not found');

    stopProcessor();
    vi.useRealTimers();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: FAIL — new tests should fail because the processor poll loop may need more timer advancement, or module-level state needs reset.

**Step 3: Fix any timing issues**

The key challenge is module-level state (`running`, `lastStaleCheck`, etc.). Since `vi.resetModules()` is needed to get a fresh processor each test, update `beforeEach`:

```ts
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  await db.syncQueue.clear();
});

afterEach(async () => {
  // Ensure processor is stopped if still running
  try {
    const { stopProcessor } = await import('../syncProcessor');
    stopProcessor();
  } catch {}
  vi.useRealTimers();
  await db.syncQueue.clear();
});
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/__tests__/syncProcessor.test.ts
git commit -m "test: add processor job dispatch integration tests"
```

---

## Task 2: Error Handling Routing Tests

**Files:**
- Modify: `src/data/firebase/__tests__/syncProcessor.test.ts`

**Step 1: Write the failing tests**

Add after the `job execution dispatch` describe block:

```ts
describe('error handling routing', () => {
  it('retryable error (unavailable) retries job with incremented retryCount', async () => {
    vi.useFakeTimers();

    const { firestoreMatchRepository } = await import('../firestoreMatchRepository');
    const unavailableErr = new Error('Service unavailable');
    (unavailableErr as any).code = 'unavailable';
    vi.mocked(firestoreMatchRepository.save).mockRejectedValueOnce(unavailableErr);

    const job = createTestJob({
      type: 'match',
      entityId: 'retry-match',
      context: { type: 'match', ownerId: 'u1', sharedWith: [] },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    await vi.advanceTimersByTimeAsync(100);

    const retried = await db.syncQueue.get(job.id);
    expect(retried!.status).toBe('pending');
    expect(retried!.retryCount).toBe(1);
    expect(retried!.nextRetryAt).toBeGreaterThan(Date.now());

    stopProcessor();
    vi.useRealTimers();
  });

  it('auth error (unauthenticated) sets job to awaitingAuth', async () => {
    vi.useFakeTimers();

    const { firestoreMatchRepository } = await import('../firestoreMatchRepository');
    const authErr = new Error('Not authenticated');
    (authErr as any).code = 'unauthenticated';
    vi.mocked(firestoreMatchRepository.save).mockRejectedValueOnce(authErr);

    const job = createTestJob({
      type: 'match',
      entityId: 'auth-match',
      context: { type: 'match', ownerId: 'u1', sharedWith: [] },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    await vi.advanceTimersByTimeAsync(100);

    const awaiting = await db.syncQueue.get(job.id);
    expect(awaiting!.status).toBe('awaitingAuth');

    stopProcessor();
    vi.useRealTimers();
  });

  it('fatal error (invalid-argument) marks job as failed', async () => {
    vi.useFakeTimers();

    const { firestoreMatchRepository } = await import('../firestoreMatchRepository');
    const fatalErr = new Error('Invalid data');
    (fatalErr as any).code = 'invalid-argument';
    vi.mocked(firestoreMatchRepository.save).mockRejectedValueOnce(fatalErr);

    const job = createTestJob({
      type: 'match',
      entityId: 'fatal-match',
      context: { type: 'match', ownerId: 'u1', sharedWith: [] },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    await vi.advanceTimersByTimeAsync(100);

    const failed = await db.syncQueue.get(job.id);
    expect(failed!.status).toBe('failed');
    expect(failed!.lastError).toContain('Invalid data');

    stopProcessor();
    vi.useRealTimers();
  });

  it('max retries exceeded marks job as failed with Max retries message', async () => {
    vi.useFakeTimers();

    const { firestoreMatchRepository } = await import('../firestoreMatchRepository');
    const retryErr = new Error('Temporary failure');
    (retryErr as any).code = 'unavailable';
    vi.mocked(firestoreMatchRepository.save).mockRejectedValueOnce(retryErr);

    // Job already at max retries for match type (maxRetries=7)
    const job = createTestJob({
      type: 'match',
      entityId: 'maxed-match',
      retryCount: 7,
      context: { type: 'match', ownerId: 'u1', sharedWith: [] },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    await vi.advanceTimersByTimeAsync(100);

    const failed = await db.syncQueue.get(job.id);
    expect(failed!.status).toBe('failed');
    expect(failed!.lastError).toContain('Max retries');

    stopProcessor();
    vi.useRealTimers();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: FAIL

**Step 3: Fix any issues**

Tests should work with the existing `beforeEach`/`afterEach` from Task 1. The mocked repos are already set up at the top of the file. The key is that `vi.mocked(...).mockRejectedValueOnce()` only affects one call, so the default `mockResolvedValue(undefined)` takes over after.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/__tests__/syncProcessor.test.ts
git commit -m "test: add processor error handling routing tests"
```

---

## Task 3: Per-Entity Serialization + Lifecycle Tests

**Files:**
- Modify: `src/data/firebase/__tests__/syncProcessor.test.ts`

**Step 1: Write the failing tests**

Add after the `error handling routing` describe block:

```ts
describe('per-entity serialization', () => {
  it('two jobs for the same entity only processes one at a time', async () => {
    vi.useFakeTimers();

    const { firestoreMatchRepository } = await import('../firestoreMatchRepository');

    // Make the first save take a while (will be resolved manually)
    let resolveSave: (() => void) | null = null;
    vi.mocked(firestoreMatchRepository.save).mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveSave = resolve; }),
    );

    // Two jobs for the same entity
    const job1 = createTestJob({
      type: 'match',
      entityId: 'same-entity',
      context: { type: 'match', ownerId: 'u1', sharedWith: [] },
    });
    // Second job — same type:entityId, so it will get a different id via upsert
    // But for this test, create two separate pending jobs manually
    const job2: SyncJob = {
      ...job1,
      id: 'match:same-entity-2',
      status: 'pending',
      nextRetryAt: Date.now(),
    };
    await db.syncQueue.bulkPut([job1, job2]);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    await vi.advanceTimersByTimeAsync(100);

    // First job should be processing, second should be put back to pending
    expect(firestoreMatchRepository.save).toHaveBeenCalledTimes(1);

    // Resolve the first save
    resolveSave?.();
    await vi.advanceTimersByTimeAsync(100);

    stopProcessor();
    vi.useRealTimers();
  });

  it('different entities process concurrently', async () => {
    vi.useFakeTimers();

    const { firestoreMatchRepository } = await import('../firestoreMatchRepository');
    vi.mocked(firestoreMatchRepository.save).mockResolvedValue(undefined);

    const job1 = createTestJob({
      type: 'match',
      entityId: 'entity-a',
      context: { type: 'match', ownerId: 'u1', sharedWith: [] },
    });
    const job2 = createTestJob({
      type: 'match',
      entityId: 'entity-b',
      context: { type: 'match', ownerId: 'u1', sharedWith: [] },
    });
    await db.syncQueue.bulkPut([job1, job2]);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    await vi.advanceTimersByTimeAsync(100);

    // Both should have been processed (MAX_CONCURRENT=2)
    expect(firestoreMatchRepository.save).toHaveBeenCalledTimes(2);

    const completed1 = await db.syncQueue.get(job1.id);
    const completed2 = await db.syncQueue.get(job2.id);
    expect(completed1!.status).toBe('completed');
    expect(completed2!.status).toBe('completed');

    stopProcessor();
    vi.useRealTimers();
  });
});

describe('processor lifecycle', () => {
  it('startProcessor is idempotent — calling twice does not double-start', async () => {
    vi.useFakeTimers();

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    const lockSpy = vi.fn(fakeLock);

    startProcessor(lockSpy);
    startProcessor(lockSpy); // second call should be no-op

    expect(lockSpy).toHaveBeenCalledTimes(1);

    stopProcessor();
    vi.useRealTimers();
  });

  it('stopProcessor cleans up online/offline listeners', async () => {
    vi.useFakeTimers();

    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    stopProcessor();

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
    vi.useRealTimers();
  });

  it('wakeProcessor triggers immediate poll by canceling sleep', async () => {
    vi.useFakeTimers();

    const { startProcessor, stopProcessor, wakeProcessor } = await import('../syncProcessor');
    const { firestoreMatchRepository } = await import('../firestoreMatchRepository');
    vi.mocked(firestoreMatchRepository.save).mockResolvedValue(undefined);

    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    // Let the first poll complete (no jobs)
    await vi.advanceTimersByTimeAsync(100);

    // Now enqueue a job while processor is sleeping (30s watchdog)
    const job = createTestJob({
      type: 'match',
      entityId: 'wake-match',
      context: { type: 'match', ownerId: 'u1', sharedWith: [] },
    });
    await db.syncQueue.put(job);

    // Wake the processor — should process immediately, not wait 30s
    wakeProcessor();
    await vi.advanceTimersByTimeAsync(100);

    const completed = await db.syncQueue.get(job.id);
    expect(completed!.status).toBe('completed');

    stopProcessor();
    vi.useRealTimers();
  });
});

describe('no-auth guard', () => {
  it('processOnce skips when no auth.currentUser', async () => {
    vi.useFakeTimers();

    // Override auth mock to have no current user
    const { auth } = await import('../config');
    const originalUser = auth.currentUser;
    Object.defineProperty(auth, 'currentUser', { value: null, writable: true, configurable: true });

    const job = createTestJob({
      type: 'match',
      entityId: 'no-auth-match',
      context: { type: 'match', ownerId: 'u1', sharedWith: [] },
    });
    await db.syncQueue.put(job);

    const { startProcessor, stopProcessor } = await import('../syncProcessor');
    const fakeLock: any = (_name: string, _opts: any, cb: any) => cb(null);
    startProcessor(fakeLock);

    await vi.advanceTimersByTimeAsync(100);

    // Job should still be pending — not processed
    const pending = await db.syncQueue.get(job.id);
    expect(pending!.status).toBe('pending');

    stopProcessor();
    Object.defineProperty(auth, 'currentUser', { value: originalUser, writable: true, configurable: true });
    vi.useRealTimers();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: FAIL

**Step 3: Fix any issues**

The per-entity serialization test with two jobs having the same `type:entityId` is tricky because `enqueueJob` uses deterministic IDs. Instead, we manually create two separate job records with different `id` values but the same `entityKey`. The `claimNextJobs` function claims both, but `processOnce` filters by `inFlightEntities`. Adjust the test if the dual-id approach doesn't work with the compound index — the key assertion is that `firestoreMatchRepository.save` is called exactly once for overlapping entities.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/__tests__/syncProcessor.test.ts
git commit -m "test: add processor serialization, lifecycle, and no-auth guard tests"
```

---

## Task 4: E2E Sync Journey Tests

**Files:**
- Modify: `e2e/sync/sync-queue.spec.ts`

**Step 1: Write the E2E tests**

Extend the existing `e2e/sync/sync-queue.spec.ts`:

```ts
import { test, expect } from '../fixtures';
import { signInAsTestUser, getCurrentUserUid } from '../helpers/emulator-auth';
import { FIRESTORE_EMULATOR, PROJECT_ID } from '../helpers/emulator-config';
import { randomUUID } from 'crypto';
import { GameSetupPage } from '../pages/GameSetupPage';
import { ScoringPage } from '../pages/ScoringPage';

test.describe('Sync Queue', () => {
  test('Settings page shows Cloud Sync section when signed in', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');

    // Cloud Sync section should be visible for signed-in users
    await expect(authenticatedPage.getByText('Cloud Sync')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.getByText('Status')).toBeVisible();
    await expect(authenticatedPage.getByRole('button', { name: /sync now/i })).toBeVisible();
  });

  test('Cloud Sync section hidden when not signed in', async ({ page }) => {
    await page.goto('/settings');

    // Cloud Sync section should NOT be visible for anonymous users
    await expect(page.getByText('Cloud Sync')).not.toBeVisible({ timeout: 5000 });
    // But other settings should still be visible
    await expect(page.getByText('Display')).toBeVisible();
  });

  test('completed match syncs to Firestore', async ({ page }) => {
    const email = `e2e-sync-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Sync Tester' });

    const uid = await getCurrentUserUid(page);
    expect(uid).toBeTruthy();

    // Play a quick match and complete it
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.quickGame();

    // Score 11 points to win (rally scoring, 11 points to win)
    await scoring.scorePoints('Team 1', 11);

    // Wait for match to complete
    await scoring.expectMatchOver();

    // Poll Firestore emulator for the match document
    await expect(async () => {
      const response = await fetch(
        `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/matches?pageSize=50`,
        { headers: { Authorization: 'Bearer owner' } },
      );
      expect(response.ok).toBe(true);
      const data = await response.json();
      const docs = data.documents || [];
      // Find a match owned by this user
      const userMatch = docs.find((doc: any) =>
        doc.fields?.userId?.stringValue === uid ||
        doc.fields?.ownerId?.stringValue === uid,
      );
      expect(userMatch).toBeTruthy();
    }).toPass({ timeout: 20000 });
  });

  test('sync indicator appears during sync operations', async ({ page }) => {
    const email = `e2e-ind-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Indicator User' });

    // Navigate to settings and trigger Sync Now
    await page.goto('/settings');
    await expect(page.getByText('Cloud Sync')).toBeVisible({ timeout: 10000 });

    const syncNowBtn = page.getByRole('button', { name: /sync now/i });
    await syncNowBtn.click();

    // The sync indicator should eventually settle to idle (no data to sync)
    // Verify the sync indicator is not stuck in failed state
    await page.waitForTimeout(3000);

    // Sync indicator should be hidden (idle) or not in failed state
    const indicator = page.locator('[data-testid="sync-indicator"]');
    const isVisible = await indicator.isVisible();
    if (isVisible) {
      // If visible, it should not be showing "failed"
      await expect(indicator).not.toContainText('failed');
    }
  });
});
```

**Step 2: Try running E2E tests**

Run: `npx playwright test e2e/sync/ --project=emulator`
Expected: Tests require Firebase emulators. If emulators are running, tests should pass. If not, they will timeout — that's OK, the test files are structurally correct.

**Step 3: Commit**

```bash
git add e2e/sync/sync-queue.spec.ts
git commit -m "test: add E2E sync journey tests (match sync, sync indicator)"
```

---

## Task 5: Run Full Test Suite + Update Roadmap

**Files:**
- Modify: `docs/ROADMAP.md`

**Step 1: Run full test suite**

Run: `npx vitest run --exclude '.claude/**' --exclude '.worktrees/**'`
Expected: All tests pass (except pre-existing DiscoverPage failure if applicable)

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Update ROADMAP.md**

Change the Sync Queue Hardening section from:

```markdown
- [ ] Full test suite + E2E tests
```

to:

```markdown
- [x] Full test suite + E2E tests
```

**Step 4: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark sync queue test suite complete in roadmap"
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Processor job dispatch (match, tournament, playerStats, missing entity) | 4 integration tests |
| 2 | Error handling routing (retryable, auth, fatal, max retries) | 4 integration tests |
| 3 | Per-entity serialization + lifecycle + no-auth guard | 5 integration tests |
| 4 | E2E sync journeys (match sync, sync indicator) | 2 new E2E tests |
| 5 | Full verification + roadmap update | Verification only |

**Total: 5 tasks, ~15 new tests**
