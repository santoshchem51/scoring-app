# Sync Queue Test Completion — Design

**Date:** 2026-03-09
**Status:** Approved

## Goal

Complete the sync queue test suite (roadmap item: "Full test suite + E2E tests") by filling gaps in `syncProcessor.ts` coverage and adding core E2E sync journeys.

## Current State

- ~1,900 lines of existing tests across 10 test files
- `syncProcessor.ts` (424 lines) has only 151 lines of tests — covers exports, startup cleanup, signal reset, and timeout constants
- E2E: 2 basic UI visibility tests (sync-queue.spec.ts) + 2 profile/resilience tests (cloud-sync.spec.ts)

## Approach

### Processor Integration Tests (~15 tests)

Test through `startProcessor` with injectable fake lock provider. Enqueue jobs in Dexie → start processor → verify outcomes.

**Timing control:** `vi.useFakeTimers()` + `vi.advanceTimersByTime()` to control poll loop. Fake lock provider executes callback immediately.

#### Test Groups

1. **Job execution dispatch** (4 tests)
   - Match job → calls `firestoreMatchRepository.save`
   - Tournament job → calls `firestoreTournamentRepository.save`
   - PlayerStats job → calls `firestorePlayerStatsRepository.processMatchCompletion`
   - Unknown job type → fails with fatal error

2. **Error handling routing** (4 tests)
   - Retryable error (unavailable) → job retried with incremented retryCount
   - Auth error (unauthenticated) → job set to awaitingAuth
   - Fatal error (invalid-argument) → job marked failed
   - Max retries exceeded → job marked failed with "Max retries" message

3. **Per-entity serialization** (2 tests)
   - Two jobs for same entity → only one processes at a time
   - Different entities → process concurrently

4. **Processor lifecycle** (3 tests)
   - `startProcessor` idempotent (calling twice doesn't double-start)
   - `stopProcessor` stops loop and cleans up listeners
   - `wakeProcessor` triggers immediate poll (interrupts sleep)

5. **No-auth guard** (2 tests)
   - processOnce skips when no auth.currentUser
   - Job throws unauthenticated when user is null mid-execution

### E2E Sync Tests (~4 tests)

Extend `e2e/sync/sync-queue.spec.ts` with core sync journeys. Uses Firebase emulators.

1. **Match syncs to Firestore** — Sign in → play match → complete → verify Firestore document
2. **Sync indicator transitions** — Sign in → trigger sync → verify indicator shows processing → idle
3. **Sync Now button** — Settings → click Sync Now → verify indicator transitions
4. **Signed-out: no sync UI** — No sign-in → verify no sync indicator or Cloud Sync section

### Total New Tests

- ~15 processor integration tests
- ~4 E2E tests
- **~19 new tests total**
