# Fire-and-Forget Sync Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace fire-and-forget `.catch(console.warn)` cloud sync with a Dexie-backed sync queue that retries on failure, makes sign-in sync non-blocking, and surfaces sync status to the user.

**Architecture:** Local-first unchanged — all data saves to Dexie first. A persistent sync queue (Dexie table) replaces direct Firestore fire-and-forget calls. A background processor drains the queue with exponential backoff, error classification, and multi-tab safety via Web Locks API.

**Tech Stack:** Dexie 4.x (IndexedDB), Firestore, SolidJS signals, Web Locks API

**Design Doc:** `docs/plans/2026-03-03-fire-and-forget-sync-design.md`

---

## Task 1: SyncJob Types + Dexie Schema v3

**Files:**
- Create: `src/data/firebase/syncQueue.types.ts`
- Modify: `src/data/types.ts` — add `ownerUid?: string` to `Match` interface
- Modify: `src/data/db.ts` — add v3 schema with `syncQueue` table + EntityTable type
- Test: `src/data/__tests__/db.syncQueue.test.ts`

**Step 1: Write the failing test**

Create test file that verifies Dexie v3 has the `syncQueue` table and can store/retrieve a SyncJob:

```typescript
// src/data/__tests__/db.syncQueue.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';

describe('Dexie v3 syncQueue table', () => {
  let db: typeof import('../db').db;

  beforeEach(async () => {
    // Fresh import to get the db instance
    const mod = await import('../db');
    db = mod.db;
  });

  afterEach(async () => {
    // Clean up
    await db.syncQueue.clear();
  });

  it('syncQueue table exists on db', () => {
    expect(db.syncQueue).toBeDefined();
  });

  it('can store and retrieve a SyncJob', async () => {
    const job = {
      id: 'match:abc123',
      type: 'match' as const,
      entityId: 'abc123',
      context: { type: 'match' as const, ownerId: 'user-1', sharedWith: [] },
      status: 'pending' as const,
      retryCount: 0,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
    };
    await db.syncQueue.put(job);
    const retrieved = await db.syncQueue.get('match:abc123');
    expect(retrieved).toEqual(job);
  });

  it('upserts job with same deterministic ID', async () => {
    const job1 = {
      id: 'match:abc123',
      type: 'match' as const,
      entityId: 'abc123',
      context: { type: 'match' as const, ownerId: 'user-1', sharedWith: [] },
      status: 'pending' as const,
      retryCount: 0,
      nextRetryAt: Date.now(),
      createdAt: 1000,
    };
    const job2 = { ...job1, createdAt: 2000 };
    await db.syncQueue.put(job1);
    await db.syncQueue.put(job2);
    const count = await db.syncQueue.count();
    expect(count).toBe(1);
    const retrieved = await db.syncQueue.get('match:abc123');
    expect(retrieved!.createdAt).toBe(2000);
  });

  it('queries by compound index [status+nextRetryAt]', async () => {
    const now = Date.now();
    await db.syncQueue.bulkPut([
      { id: 'match:1', type: 'match', entityId: '1', context: { type: 'match', ownerId: 'u', sharedWith: [] }, status: 'pending', retryCount: 0, nextRetryAt: now - 1000, createdAt: now },
      { id: 'match:2', type: 'match', entityId: '2', context: { type: 'match', ownerId: 'u', sharedWith: [] }, status: 'pending', retryCount: 0, nextRetryAt: now + 5000, createdAt: now },
      { id: 'match:3', type: 'match', entityId: '3', context: { type: 'match', ownerId: 'u', sharedWith: [] }, status: 'completed', retryCount: 0, nextRetryAt: now - 1000, createdAt: now },
    ]);
    // Query: status=pending AND nextRetryAt <= now
    const ready = await db.syncQueue
      .where('[status+nextRetryAt]')
      .between(['pending', Dexie.minKey], ['pending', now], true, true)
      .toArray();
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe('match:1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/__tests__/db.syncQueue.test.ts`
Expected: FAIL — `db.syncQueue` is undefined

**Step 3: Create SyncJob types**

```typescript
// src/data/firebase/syncQueue.types.ts
export type SyncJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'awaitingAuth';

export type SyncJobContext =
  | { type: 'match'; ownerId: string; sharedWith: string[] }
  | { type: 'tournament' }
  | { type: 'playerStats'; scorerUid: string };

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
```

**Step 4: Add ownerUid to Match interface**

In `src/data/types.ts`, add to the `Match` interface (after `scorerTeam`):

```typescript
  ownerUid?: string;               // Set on creation / cloud pull (not indexed)
```

**Step 5: Update db.ts with v3 schema + EntityTable**

In `src/data/db.ts`:
- Add import: `import type { SyncJob } from './firebase/syncQueue.types';`
- Add `syncQueue: EntityTable<SyncJob, 'id'>` to the type declaration
- Add `db.version(3).stores(...)` preserving all existing tables verbatim + new syncQueue

```typescript
import Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { Match, Player, ScoreEvent, Tournament } from './types';
import type { SyncJob } from './firebase/syncQueue.types';

const db = new Dexie('PickleScoreDB') as Dexie & {
  matches: EntityTable<Match, 'id'>;
  players: EntityTable<Player, 'id'>;
  scoreEvents: EntityTable<ScoreEvent, 'id'>;
  tournaments: EntityTable<Tournament, 'id'>;
  syncQueue: EntityTable<SyncJob, 'id'>;
};

db.version(1).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
});

db.version(2).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds, tournamentId',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
  tournaments: 'id, organizerId, status, date',
});

db.version(3).stores({
  matches: 'id, status, startedAt, *team1PlayerIds, *team2PlayerIds, tournamentId',
  players: 'id, name, createdAt',
  scoreEvents: 'id, matchId, gameNumber, timestamp',
  tournaments: 'id, organizerId, status, date',
  syncQueue: 'id, [status+nextRetryAt], createdAt',
});

export { db };
```

**Step 6: Run test to verify it passes**

Run: `npx vitest run src/data/__tests__/db.syncQueue.test.ts`
Expected: PASS (all 4 tests)

**Step 7: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests still pass (additive schema change, no breakage)

**Step 8: Commit**

```bash
git add src/data/firebase/syncQueue.types.ts src/data/types.ts src/data/db.ts src/data/__tests__/db.syncQueue.test.ts
git commit -m "feat(sync): add SyncJob types, ownerUid on Match, Dexie v3 syncQueue table"
```

---

## Task 2: Retry Policy + Backoff Calculation

**Files:**
- Create: `src/data/firebase/syncRetry.ts`
- Test: `src/data/firebase/__tests__/syncRetry.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/data/firebase/__tests__/syncRetry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SyncJob } from '../syncQueue.types';

describe('syncRetry', () => {
  let computeNextRetryAt: typeof import('../syncRetry').computeNextRetryAt;
  let getRetryPolicy: typeof import('../syncRetry').getRetryPolicy;

  beforeEach(async () => {
    const mod = await import('../syncRetry');
    computeNextRetryAt = mod.computeNextRetryAt;
    getRetryPolicy = mod.getRetryPolicy;
  });

  describe('getRetryPolicy', () => {
    it('returns simple-write policy for match type', () => {
      const policy = getRetryPolicy('match');
      expect(policy.baseDelay).toBe(3000);
      expect(policy.multiplier).toBe(2);
      expect(policy.maxDelay).toBe(300_000);
      expect(policy.maxRetries).toBe(7);
    });

    it('returns simple-write policy for tournament type', () => {
      const policy = getRetryPolicy('tournament');
      expect(policy.baseDelay).toBe(3000);
    });

    it('returns complex-ops policy for playerStats type', () => {
      const policy = getRetryPolicy('playerStats');
      expect(policy.baseDelay).toBe(15000);
      expect(policy.multiplier).toBe(3);
      expect(policy.maxDelay).toBe(1_800_000);
      expect(policy.maxRetries).toBe(5);
    });
  });

  describe('computeNextRetryAt', () => {
    it('computes first retry at base delay', () => {
      const now = 1000000;
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // No jitter offset at 0.5
      const next = computeNextRetryAt('match', 0, now);
      // base=3000, retryCount=0: 3000 * 2^0 = 3000, jitter at 0.5 = 3000
      expect(next).toBe(now + 3000);
    });

    it('doubles delay for simple writes on retry 1', () => {
      const now = 1000000;
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const next = computeNextRetryAt('match', 1, now);
      // 3000 * 2^1 = 6000
      expect(next).toBe(now + 6000);
    });

    it('triples delay for playerStats on retry 1', () => {
      const now = 1000000;
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const next = computeNextRetryAt('playerStats', 1, now);
      // 15000 * 3^1 = 45000
      expect(next).toBe(now + 45000);
    });

    it('caps delay at maxDelay for simple writes', () => {
      const now = 1000000;
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const next = computeNextRetryAt('match', 20, now); // Very high retry
      // Should be capped at 300_000 (5 min)
      expect(next).toBeLessThanOrEqual(now + 300_000);
    });

    it('applies +/-20% jitter', () => {
      const now = 1000000;
      vi.spyOn(Math, 'random').mockReturnValue(0); // Min jitter
      const minNext = computeNextRetryAt('match', 0, now);
      vi.spyOn(Math, 'random').mockReturnValue(1); // Max jitter
      const maxNext = computeNextRetryAt('match', 0, now);
      // base=3000: min=3000*0.8=2400, max=3000*1.2=3600
      expect(minNext).toBe(now + 2400);
      expect(maxNext).toBe(now + 3600);
    });

    it('handles resource-exhausted with long backoff', () => {
      const now = 1000000;
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { computeRateLimitRetryAt } = require('../syncRetry');
      const next = computeRateLimitRetryAt(0, now);
      // base=60000, retry=0: 60000 * 2^0 = 60000
      expect(next).toBe(now + 60000);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/syncRetry.test.ts`
Expected: FAIL — module not found

**Step 3: Implement retry policy**

```typescript
// src/data/firebase/syncRetry.ts
import type { SyncJob } from './syncQueue.types';

interface RetryPolicy {
  baseDelay: number;
  multiplier: number;
  maxDelay: number;
  maxRetries: number;
}

const SIMPLE_WRITE_POLICY: RetryPolicy = {
  baseDelay: 3_000,
  multiplier: 2,
  maxDelay: 300_000,    // 5 min
  maxRetries: 7,
};

const COMPLEX_OPS_POLICY: RetryPolicy = {
  baseDelay: 15_000,
  multiplier: 3,
  maxDelay: 1_800_000,  // 30 min
  maxRetries: 5,
};

const RATE_LIMIT_POLICY: RetryPolicy = {
  baseDelay: 60_000,
  multiplier: 2,
  maxDelay: 600_000,    // 10 min
  maxRetries: 7,
};

export function getRetryPolicy(jobType: SyncJob['type']): RetryPolicy {
  if (jobType === 'playerStats') return COMPLEX_OPS_POLICY;
  return SIMPLE_WRITE_POLICY;
}

function applyJitter(delay: number): number {
  // +/- 20% jitter
  const jitterFactor = 0.8 + Math.random() * 0.4;
  return Math.round(delay * jitterFactor);
}

export function computeNextRetryAt(
  jobType: SyncJob['type'],
  retryCount: number,
  now: number = Date.now(),
): number {
  const policy = getRetryPolicy(jobType);
  const rawDelay = policy.baseDelay * Math.pow(policy.multiplier, retryCount);
  const cappedDelay = Math.min(rawDelay, policy.maxDelay);
  return now + applyJitter(cappedDelay);
}

export function computeRateLimitRetryAt(
  retryCount: number,
  now: number = Date.now(),
): number {
  const rawDelay = RATE_LIMIT_POLICY.baseDelay * Math.pow(RATE_LIMIT_POLICY.multiplier, retryCount);
  const cappedDelay = Math.min(rawDelay, RATE_LIMIT_POLICY.maxDelay);
  return now + applyJitter(cappedDelay);
}

export function isMaxRetriesExceeded(jobType: SyncJob['type'], retryCount: number): boolean {
  const policy = getRetryPolicy(jobType);
  return retryCount >= policy.maxRetries;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/syncRetry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/syncRetry.ts src/data/firebase/__tests__/syncRetry.test.ts
git commit -m "feat(sync): add retry policy with two-tier backoff and jitter"
```

---

## Task 3: Error Classification

**Files:**
- Create: `src/data/firebase/syncErrors.ts`
- Test: `src/data/firebase/__tests__/syncErrors.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/data/firebase/__tests__/syncErrors.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('syncErrors', () => {
  let classifyError: typeof import('../syncErrors').classifyError;

  beforeEach(async () => {
    const mod = await import('../syncErrors');
    classifyError = mod.classifyError;
  });

  describe('retryable errors', () => {
    it.each([
      'unavailable',
      'deadline-exceeded',
      'internal',
      'cancelled',
      'aborted',
    ])('classifies Firestore code "%s" as retryable', (code) => {
      const err = { code };
      expect(classifyError(err, 'match')).toBe('retryable');
    });

    it('classifies failed-precondition on playerStats as retryable', () => {
      expect(classifyError({ code: 'failed-precondition' }, 'playerStats')).toBe('retryable');
    });

    it('classifies TypeError with fetch message as retryable', () => {
      const err = new TypeError('Failed to fetch');
      expect(classifyError(err, 'match')).toBe('retryable');
    });

    it('classifies TypeError with network message as retryable', () => {
      const err = new TypeError('NetworkError when attempting to fetch resource.');
      expect(classifyError(err, 'match')).toBe('retryable');
    });
  });

  describe('rate-limited errors', () => {
    it('classifies resource-exhausted as rate-limited', () => {
      expect(classifyError({ code: 'resource-exhausted' }, 'match')).toBe('rate-limited');
    });
  });

  describe('auth-dependent errors', () => {
    it('classifies unauthenticated as auth-dependent', () => {
      expect(classifyError({ code: 'unauthenticated' }, 'match')).toBe('auth-dependent');
    });

    it('classifies permission-denied as auth-dependent by default', () => {
      // Without token freshness check, permission-denied defaults to auth-dependent
      expect(classifyError({ code: 'permission-denied' }, 'match')).toBe('auth-dependent');
    });

    it('classifies permission-denied with fresh token as fatal', () => {
      expect(classifyError({ code: 'permission-denied' }, 'match', true)).toBe('fatal');
    });
  });

  describe('fatal errors', () => {
    it.each([
      'invalid-argument',
      'already-exists',
      'data-loss',
      'out-of-range',
      'unimplemented',
    ])('classifies Firestore code "%s" as fatal', (code) => {
      expect(classifyError({ code }, 'match')).toBe('fatal');
    });

    it('classifies failed-precondition on match as fatal', () => {
      expect(classifyError({ code: 'failed-precondition' }, 'match')).toBe('fatal');
    });
  });

  describe('not-found special cases', () => {
    it('classifies not-found on playerStats as staleJob', () => {
      expect(classifyError({ code: 'not-found' }, 'playerStats')).toBe('staleJob');
    });

    it('classifies not-found on match as fatal', () => {
      expect(classifyError({ code: 'not-found' }, 'match')).toBe('fatal');
    });
  });

  describe('unknown errors', () => {
    it('classifies unknown error shape as fatal', () => {
      expect(classifyError({ message: 'something weird' }, 'match')).toBe('fatal');
    });

    it('classifies error with unknown Firestore code as fatal', () => {
      expect(classifyError({ code: 'some-unknown-code' }, 'match')).toBe('fatal');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/syncErrors.test.ts`
Expected: FAIL — module not found

**Step 3: Implement error classification**

```typescript
// src/data/firebase/syncErrors.ts
import type { SyncJob } from './syncQueue.types';

export type ErrorCategory = 'retryable' | 'rate-limited' | 'auth-dependent' | 'fatal' | 'staleJob';

const RETRYABLE_CODES = new Set([
  'unavailable',
  'deadline-exceeded',
  'internal',
  'cancelled',
  'aborted',
]);

const FATAL_CODES = new Set([
  'invalid-argument',
  'already-exists',
  'data-loss',
  'out-of-range',
  'unimplemented',
]);

export function classifyError(
  err: unknown,
  jobType: SyncJob['type'],
  hasValidFreshToken: boolean = false,
): ErrorCategory {
  // Handle Firestore errors with .code property
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;

    if (RETRYABLE_CODES.has(code)) return 'retryable';
    if (code === 'resource-exhausted') return 'rate-limited';
    if (code === 'unauthenticated') return 'auth-dependent';

    if (code === 'permission-denied') {
      return hasValidFreshToken ? 'fatal' : 'auth-dependent';
    }

    if (code === 'not-found') {
      return jobType === 'playerStats' ? 'staleJob' : 'fatal';
    }

    if (code === 'failed-precondition') {
      return jobType === 'playerStats' ? 'retryable' : 'fatal';
    }

    if (FATAL_CODES.has(code)) return 'fatal';

    // Unknown Firestore code — treat as fatal
    return 'fatal';
  }

  // Handle non-Firestore errors (TypeError from network)
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase();
    if (msg.includes('fetch') || msg.includes('network')) {
      return 'retryable';
    }
  }

  // Unknown error shape — fatal
  return 'fatal';
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/syncErrors.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/data/firebase/syncErrors.ts src/data/firebase/__tests__/syncErrors.test.ts
git commit -m "feat(sync): add 4-category error classification for sync jobs"
```

---

## Task 4: Sync Queue Enqueue + Claim Operations

**Files:**
- Create: `src/data/firebase/syncQueue.ts`
- Test: `src/data/firebase/__tests__/syncQueue.test.ts`

This task implements the core enqueue/claim/complete/fail operations on the Dexie `syncQueue` table. The processor (Task 5) will use these operations.

**Step 1: Write the failing tests**

```typescript
// src/data/firebase/__tests__/syncQueue.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dexie from 'dexie';
import { db } from '../../db';
import type { SyncJob } from '../syncQueue.types';

describe('syncQueue operations', () => {
  let enqueueJob: typeof import('../syncQueue').enqueueJob;
  let claimNextJobs: typeof import('../syncQueue').claimNextJobs;
  let completeJob: typeof import('../syncQueue').completeJob;
  let failJob: typeof import('../syncQueue').failJob;
  let setJobAwaitingAuth: typeof import('../syncQueue').setJobAwaitingAuth;
  let resetAwaitingAuthJobs: typeof import('../syncQueue').resetAwaitingAuthJobs;
  let reclaimStaleJobs: typeof import('../syncQueue').reclaimStaleJobs;
  let pruneCompletedJobs: typeof import('../syncQueue').pruneCompletedJobs;
  let pruneFailedJobs: typeof import('../syncQueue').pruneFailedJobs;

  beforeEach(async () => {
    await db.syncQueue.clear();
    const mod = await import('../syncQueue');
    enqueueJob = mod.enqueueJob;
    claimNextJobs = mod.claimNextJobs;
    completeJob = mod.completeJob;
    failJob = mod.failJob;
    setJobAwaitingAuth = mod.setJobAwaitingAuth;
    resetAwaitingAuthJobs = mod.resetAwaitingAuthJobs;
    reclaimStaleJobs = mod.reclaimStaleJobs;
    pruneCompletedJobs = mod.pruneCompletedJobs;
    pruneFailedJobs = mod.pruneFailedJobs;
  });

  afterEach(async () => {
    await db.syncQueue.clear();
  });

  describe('enqueueJob', () => {
    it('creates a job with deterministic ID', async () => {
      await enqueueJob('match', 'abc123', { type: 'match', ownerId: 'u1', sharedWith: [] });
      const job = await db.syncQueue.get('match:abc123');
      expect(job).toBeDefined();
      expect(job!.status).toBe('pending');
      expect(job!.retryCount).toBe(0);
      expect(job!.nextRetryAt).toBeLessThanOrEqual(Date.now());
    });

    it('deduplicates by upserting same entity', async () => {
      await enqueueJob('match', 'abc123', { type: 'match', ownerId: 'u1', sharedWith: [] });
      await enqueueJob('match', 'abc123', { type: 'match', ownerId: 'u1', sharedWith: ['u2'] });
      const count = await db.syncQueue.count();
      expect(count).toBe(1);
      const job = await db.syncQueue.get('match:abc123');
      expect(job!.context).toEqual({ type: 'match', ownerId: 'u1', sharedWith: ['u2'] });
    });

    it('preserves retryCount when re-enqueuing processing job', async () => {
      await enqueueJob('match', 'abc123', { type: 'match', ownerId: 'u1', sharedWith: [] });
      await db.syncQueue.update('match:abc123', { status: 'processing', retryCount: 3 });
      await enqueueJob('match', 'abc123', { type: 'match', ownerId: 'u1', sharedWith: [] });
      const job = await db.syncQueue.get('match:abc123');
      // Re-enqueue resets to pending but keeps retryCount
      expect(job!.status).toBe('pending');
    });

    it('adds dependsOn for playerStats jobs', async () => {
      await enqueueJob('playerStats', 'match-1', { type: 'playerStats', scorerUid: 'u1' }, ['match:match-1']);
      const job = await db.syncQueue.get('playerStats:match-1');
      expect(job!.dependsOn).toEqual(['match:match-1']);
    });
  });

  describe('claimNextJobs', () => {
    it('claims ready pending jobs', async () => {
      const now = Date.now();
      await enqueueJob('match', '1', { type: 'match', ownerId: 'u', sharedWith: [] });
      const claimed = await claimNextJobs(2);
      expect(claimed).toHaveLength(1);
      expect(claimed[0].status).toBe('processing');
    });

    it('skips jobs with nextRetryAt in the future', async () => {
      await db.syncQueue.put({
        id: 'match:1', type: 'match', entityId: '1',
        context: { type: 'match', ownerId: 'u', sharedWith: [] },
        status: 'pending', retryCount: 0, nextRetryAt: Date.now() + 60000, createdAt: Date.now(),
      });
      const claimed = await claimNextJobs(2);
      expect(claimed).toHaveLength(0);
    });

    it('skips jobs with unsatisfied dependencies', async () => {
      await enqueueJob('match', '1', { type: 'match', ownerId: 'u', sharedWith: [] });
      await enqueueJob('playerStats', '1', { type: 'playerStats', scorerUid: 'u' }, ['match:1']);
      const claimed = await claimNextJobs(2);
      // Only match should be claimed, playerStats depends on match
      expect(claimed).toHaveLength(1);
      expect(claimed[0].type).toBe('match');
    });

    it('claims dependent job after dependency is completed', async () => {
      await enqueueJob('match', '1', { type: 'match', ownerId: 'u', sharedWith: [] });
      await enqueueJob('playerStats', '1', { type: 'playerStats', scorerUid: 'u' }, ['match:1']);
      await completeJob('match:1');
      const claimed = await claimNextJobs(2);
      expect(claimed).toHaveLength(1);
      expect(claimed[0].type).toBe('playerStats');
    });

    it('fails dependent job when dependency fails', async () => {
      await enqueueJob('match', '1', { type: 'match', ownerId: 'u', sharedWith: [] });
      await enqueueJob('playerStats', '1', { type: 'playerStats', scorerUid: 'u' }, ['match:1']);
      await failJob('match:1', 'fatal error');
      // claimNextJobs should cascade the failure
      const claimed = await claimNextJobs(2);
      expect(claimed).toHaveLength(0);
      const statsJob = await db.syncQueue.get('playerStats:1');
      expect(statsJob!.status).toBe('failed');
    });

    it('limits claimed jobs to maxConcurrent', async () => {
      await enqueueJob('match', '1', { type: 'match', ownerId: 'u', sharedWith: [] });
      await enqueueJob('match', '2', { type: 'match', ownerId: 'u', sharedWith: [] });
      await enqueueJob('match', '3', { type: 'match', ownerId: 'u', sharedWith: [] });
      const claimed = await claimNextJobs(2);
      expect(claimed).toHaveLength(2);
    });
  });

  describe('completeJob', () => {
    it('marks job as completed with timestamp', async () => {
      await enqueueJob('match', '1', { type: 'match', ownerId: 'u', sharedWith: [] });
      await completeJob('match:1');
      const job = await db.syncQueue.get('match:1');
      expect(job!.status).toBe('completed');
      expect(job!.completedAt).toBeDefined();
    });
  });

  describe('failJob', () => {
    it('marks job as failed with error message', async () => {
      await enqueueJob('match', '1', { type: 'match', ownerId: 'u', sharedWith: [] });
      await failJob('match:1', 'something broke');
      const job = await db.syncQueue.get('match:1');
      expect(job!.status).toBe('failed');
      expect(job!.lastError).toBe('something broke');
    });
  });

  describe('setJobAwaitingAuth', () => {
    it('sets status to awaitingAuth', async () => {
      await enqueueJob('match', '1', { type: 'match', ownerId: 'u', sharedWith: [] });
      await setJobAwaitingAuth('match:1');
      const job = await db.syncQueue.get('match:1');
      expect(job!.status).toBe('awaitingAuth');
    });
  });

  describe('resetAwaitingAuthJobs', () => {
    it('resets all awaitingAuth jobs to pending', async () => {
      await enqueueJob('match', '1', { type: 'match', ownerId: 'u', sharedWith: [] });
      await enqueueJob('match', '2', { type: 'match', ownerId: 'u', sharedWith: [] });
      await setJobAwaitingAuth('match:1');
      await setJobAwaitingAuth('match:2');
      const resetCount = await resetAwaitingAuthJobs();
      expect(resetCount).toBe(2);
      const job1 = await db.syncQueue.get('match:1');
      expect(job1!.status).toBe('pending');
      expect(job1!.nextRetryAt).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('reclaimStaleJobs', () => {
    it('reclaims processing jobs older than 10 minutes', async () => {
      const tenMinAgo = Date.now() - 11 * 60 * 1000;
      await db.syncQueue.put({
        id: 'match:1', type: 'match', entityId: '1',
        context: { type: 'match', ownerId: 'u', sharedWith: [] },
        status: 'processing', retryCount: 0, nextRetryAt: 0, createdAt: tenMinAgo,
        processedAt: tenMinAgo,
      });
      const reclaimed = await reclaimStaleJobs();
      expect(reclaimed).toBe(1);
      const job = await db.syncQueue.get('match:1');
      expect(job!.status).toBe('pending');
    });

    it('does not reclaim recent processing jobs', async () => {
      await db.syncQueue.put({
        id: 'match:1', type: 'match', entityId: '1',
        context: { type: 'match', ownerId: 'u', sharedWith: [] },
        status: 'processing', retryCount: 0, nextRetryAt: 0, createdAt: Date.now(),
        processedAt: Date.now(),
      });
      const reclaimed = await reclaimStaleJobs();
      expect(reclaimed).toBe(0);
    });
  });

  describe('pruneCompletedJobs', () => {
    it('prunes completed jobs older than 24 hours', async () => {
      const dayAgo = Date.now() - 25 * 60 * 60 * 1000;
      await db.syncQueue.put({
        id: 'match:1', type: 'match', entityId: '1',
        context: { type: 'match', ownerId: 'u', sharedWith: [] },
        status: 'completed', retryCount: 0, nextRetryAt: 0, createdAt: dayAgo,
        completedAt: dayAgo,
      });
      const pruned = await pruneCompletedJobs();
      expect(pruned).toBe(1);
    });

    it('keeps recent completed jobs', async () => {
      await db.syncQueue.put({
        id: 'match:1', type: 'match', entityId: '1',
        context: { type: 'match', ownerId: 'u', sharedWith: [] },
        status: 'completed', retryCount: 0, nextRetryAt: 0, createdAt: Date.now(),
        completedAt: Date.now(),
      });
      const pruned = await pruneCompletedJobs();
      expect(pruned).toBe(0);
    });
  });

  describe('pruneFailedJobs', () => {
    it('prunes failed jobs older than 30 days', async () => {
      const monthAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      await db.syncQueue.put({
        id: 'match:1', type: 'match', entityId: '1',
        context: { type: 'match', ownerId: 'u', sharedWith: [] },
        status: 'failed', retryCount: 7, nextRetryAt: 0, createdAt: monthAgo,
        lastError: 'fatal',
      });
      const pruned = await pruneFailedJobs();
      expect(pruned).toBe(1);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/syncQueue.test.ts`
Expected: FAIL — module not found

**Step 3: Implement sync queue operations**

```typescript
// src/data/firebase/syncQueue.ts
import Dexie from 'dexie';
import { db } from '../db';
import type { SyncJob, SyncJobContext, SyncJobStatus } from './syncQueue.types';

const STALE_PROCESSING_THRESHOLD = 10 * 60 * 1000; // 10 min
const COMPLETED_PRUNE_AGE = 24 * 60 * 60 * 1000;    // 24 hours
const FAILED_PRUNE_AGE = 30 * 24 * 60 * 60 * 1000;  // 30 days

export async function enqueueJob(
  type: SyncJob['type'],
  entityId: string,
  context: SyncJobContext,
  dependsOn?: string[],
): Promise<void> {
  const id = `${type}:${entityId}`;
  const now = Date.now();

  const existing = await db.syncQueue.get(id);
  const job: SyncJob = {
    id,
    type,
    entityId,
    context,
    status: 'pending',
    retryCount: existing?.retryCount ?? 0,
    nextRetryAt: now,
    createdAt: existing?.createdAt ?? now,
    ...(dependsOn?.length ? { dependsOn } : {}),
  };

  // If existing job is completed, reset fully
  if (existing?.status === 'completed') {
    job.retryCount = 0;
    job.completedAt = undefined;
  }

  await db.syncQueue.put(job);
}

export async function claimNextJobs(maxConcurrent: number): Promise<SyncJob[]> {
  const now = Date.now();

  // First: cascade failures from failed dependencies
  const pendingWithDeps = await db.syncQueue
    .where('status').equals('pending')
    .filter((j) => !!j.dependsOn?.length)
    .toArray();

  for (const job of pendingWithDeps) {
    if (!job.dependsOn) continue;
    for (const depId of job.dependsOn) {
      const dep = await db.syncQueue.get(depId);
      if (dep?.status === 'failed') {
        await db.syncQueue.update(job.id, {
          status: 'failed' as SyncJobStatus,
          lastError: `Dependency ${depId} failed`,
        });
        break;
      }
    }
  }

  // Query ready jobs: pending + nextRetryAt <= now
  const readyJobs = await db.syncQueue
    .where('[status+nextRetryAt]')
    .between(['pending', Dexie.minKey], ['pending', now], true, true)
    .toArray();

  // Filter: skip jobs with unsatisfied dependencies
  const eligible: SyncJob[] = [];
  for (const job of readyJobs) {
    if (eligible.length >= maxConcurrent) break;

    if (job.dependsOn?.length) {
      let satisfied = true;
      for (const depId of job.dependsOn) {
        const dep = await db.syncQueue.get(depId);
        if (!dep || dep.status !== 'completed') {
          satisfied = false;
          break;
        }
      }
      if (!satisfied) continue;
    }

    eligible.push(job);
  }

  // Claim atomically via rw transaction
  const claimed: SyncJob[] = [];
  for (const job of eligible) {
    await db.transaction('rw', db.syncQueue, async () => {
      const fresh = await db.syncQueue.get(job.id);
      if (!fresh || fresh.status !== 'pending') return;
      const updated: Partial<SyncJob> = { status: 'processing', processedAt: now };
      await db.syncQueue.update(job.id, updated);
      claimed.push({ ...fresh, ...updated } as SyncJob);
    });
  }

  return claimed;
}

export async function completeJob(jobId: string): Promise<void> {
  await db.syncQueue.update(jobId, {
    status: 'completed' as SyncJobStatus,
    completedAt: Date.now(),
  });
}

export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  await db.syncQueue.update(jobId, {
    status: 'failed' as SyncJobStatus,
    lastError: errorMessage,
  });
}

export async function setJobAwaitingAuth(jobId: string): Promise<void> {
  await db.syncQueue.update(jobId, {
    status: 'awaitingAuth' as SyncJobStatus,
  });
}

export async function resetAwaitingAuthJobs(): Promise<number> {
  const jobs = await db.syncQueue
    .where('status').equals('awaitingAuth')
    .toArray();

  const now = Date.now();
  await db.transaction('rw', db.syncQueue, async () => {
    for (const job of jobs) {
      await db.syncQueue.update(job.id, {
        status: 'pending' as SyncJobStatus,
        nextRetryAt: now,
      });
    }
  });

  return jobs.length;
}

export async function retryJob(jobId: string, nextRetryAt: number): Promise<void> {
  const job = await db.syncQueue.get(jobId);
  if (!job) return;
  await db.syncQueue.update(jobId, {
    status: 'pending' as SyncJobStatus,
    retryCount: job.retryCount + 1,
    nextRetryAt,
  });
}

export async function reclaimStaleJobs(): Promise<number> {
  const cutoff = Date.now() - STALE_PROCESSING_THRESHOLD;
  const stale = await db.syncQueue
    .where('status').equals('processing')
    .filter((j) => (j.processedAt ?? 0) < cutoff)
    .toArray();

  for (const job of stale) {
    await db.syncQueue.update(job.id, {
      status: 'pending' as SyncJobStatus,
      nextRetryAt: Date.now(),
    });
  }

  return stale.length;
}

export async function pruneCompletedJobs(): Promise<number> {
  const cutoff = Date.now() - COMPLETED_PRUNE_AGE;
  const old = await db.syncQueue
    .where('status').equals('completed')
    .filter((j) => (j.completedAt ?? 0) < cutoff)
    .toArray();

  await db.syncQueue.bulkDelete(old.map((j) => j.id));
  return old.length;
}

export async function pruneFailedJobs(): Promise<number> {
  const cutoff = Date.now() - FAILED_PRUNE_AGE;
  const old = await db.syncQueue
    .where('status').equals('failed')
    .filter((j) => j.createdAt < cutoff)
    .toArray();

  await db.syncQueue.bulkDelete(old.map((j) => j.id));
  return old.length;
}

export async function getNextRetryTime(): Promise<number | null> {
  const pendingJobs = await db.syncQueue
    .where('status').equals('pending')
    .toArray();

  if (pendingJobs.length === 0) return null;
  return Math.min(...pendingJobs.map((j) => j.nextRetryAt));
}

export async function getPendingCount(): Promise<number> {
  return db.syncQueue
    .where('status').anyOf(['pending', 'processing', 'awaitingAuth'])
    .count();
}

export async function getFailedCount(): Promise<number> {
  return db.syncQueue.where('status').equals('failed').count();
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/syncQueue.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/data/firebase/syncQueue.ts src/data/firebase/__tests__/syncQueue.test.ts
git commit -m "feat(sync): add sync queue CRUD operations with dependency tracking"
```

---

## Task 5: Queue Processor

**Files:**
- Create: `src/data/firebase/syncProcessor.ts`
- Test: `src/data/firebase/__tests__/syncProcessor.test.ts`

This task builds the background processor that drains the queue. It uses Web Locks for multi-tab safety, adaptive polling, and bounded parallelism.

**Step 1: Write the failing tests**

Focus on: processor lifecycle, job execution flow, error handling delegation, online/offline awareness, auth halt, startup cleanup. The processor coordinates the parts built in Tasks 2-4.

```typescript
// src/data/firebase/__tests__/syncProcessor.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../../db';

// Mock all Firestore repos
vi.mock('../../firebase/firestoreMatchRepository', () => ({
  firestoreMatchRepository: { save: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: { save: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../firebase/firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: { processMatchCompletion: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'test-user', getIdToken: vi.fn().mockResolvedValue('token') } },
  firestore: {},
}));
vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: {
    getById: vi.fn().mockResolvedValue({
      id: '1', config: { gameType: 'singles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
      team1PlayerIds: [], team2PlayerIds: [], team1Name: 'A', team2Name: 'B',
      games: [], winningSide: 1, status: 'completed', startedAt: 1000, completedAt: 2000,
    }),
  },
}));

describe('syncProcessor', () => {
  let startProcessor: typeof import('../syncProcessor').startProcessor;
  let stopProcessor: typeof import('../syncProcessor').stopProcessor;
  let runStartupCleanup: typeof import('../syncProcessor').runStartupCleanup;

  // Fake serial lock (no multi-tab contention in tests)
  const fakeLockProvider = {
    request: (_name: string, _opts: unknown, callback: () => Promise<void>) => callback(),
  };

  beforeEach(async () => {
    await db.syncQueue.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const mod = await import('../syncProcessor');
    startProcessor = mod.startProcessor;
    stopProcessor = mod.stopProcessor;
    runStartupCleanup = mod.runStartupCleanup;
  });

  afterEach(async () => {
    stopProcessor();
    await db.syncQueue.clear();
    vi.useRealTimers();
  });

  it('runStartupCleanup reclaims stale processing jobs', async () => {
    const tenMinAgo = Date.now() - 11 * 60 * 1000;
    await db.syncQueue.put({
      id: 'match:stale', type: 'match', entityId: 'stale',
      context: { type: 'match', ownerId: 'u', sharedWith: [] },
      status: 'processing', retryCount: 0, nextRetryAt: 0, createdAt: tenMinAgo, processedAt: tenMinAgo,
    });
    await runStartupCleanup();
    const job = await db.syncQueue.get('match:stale');
    expect(job!.status).toBe('pending');
  });

  it('runStartupCleanup prunes old completed jobs', async () => {
    const dayAgo = Date.now() - 25 * 60 * 60 * 1000;
    await db.syncQueue.put({
      id: 'match:old', type: 'match', entityId: 'old',
      context: { type: 'match', ownerId: 'u', sharedWith: [] },
      status: 'completed', retryCount: 0, nextRetryAt: 0, createdAt: dayAgo, completedAt: dayAgo,
    });
    await runStartupCleanup();
    const job = await db.syncQueue.get('match:old');
    expect(job).toBeUndefined();
  });

  it('exports startProcessor and stopProcessor', () => {
    expect(typeof startProcessor).toBe('function');
    expect(typeof stopProcessor).toBe('function');
  });
});
```

**Note:** Full processor integration tests are in Task 9. This task focuses on the processor module's startup cleanup and lifecycle exports. The actual Firestore execution will be tested via integration tests with mocked Firestore.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the processor**

```typescript
// src/data/firebase/syncProcessor.ts
import { db } from '../db';
import { matchRepository } from '../repositories/matchRepository';
import { auth } from './config';
import { firestoreMatchRepository } from './firestoreMatchRepository';
import { firestoreTournamentRepository } from './firestoreTournamentRepository';
import { firestorePlayerStatsRepository } from './firestorePlayerStatsRepository';
import { classifyError } from './syncErrors';
import { computeNextRetryAt, computeRateLimitRetryAt, isMaxRetriesExceeded } from './syncRetry';
import {
  claimNextJobs,
  completeJob,
  failJob,
  retryJob,
  setJobAwaitingAuth,
  reclaimStaleJobs,
  pruneCompletedJobs,
  pruneFailedJobs,
  getNextRetryTime,
} from './syncQueue';
import type { SyncJob } from './syncQueue.types';

const MAX_CONCURRENT = 2;
const JOB_TIMEOUT = 15_000;
const RESILIENCE_SLEEP = 5_000;

let running = false;
let timerId: ReturnType<typeof setTimeout> | null = null;
let onStatusChange: ((status: 'idle' | 'processing' | 'pending' | 'failed') => void) | null = null;

export function setStatusChangeCallback(cb: typeof onStatusChange): void {
  onStatusChange = cb;
}

export async function runStartupCleanup(): Promise<void> {
  await reclaimStaleJobs();
  await pruneCompletedJobs();
  await pruneFailedJobs();
}

async function executeJob(job: SyncJob): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), JOB_TIMEOUT);

  try {
    switch (job.type) {
      case 'match': {
        const match = await matchRepository.getById(job.entityId);
        if (!match) throw Object.assign(new Error('Match not found locally'), { code: 'not-found' });
        const user = auth.currentUser;
        if (!user) throw Object.assign(new Error('Not authenticated'), { code: 'unauthenticated' });
        const ctx = job.context as { type: 'match'; ownerId: string; sharedWith: string[] };
        await firestoreMatchRepository.save(match, user.uid, ctx.sharedWith);
        break;
      }
      case 'tournament': {
        // Re-fetch tournament from Dexie
        const tournament = await db.tournaments.get(job.entityId);
        if (!tournament) throw Object.assign(new Error('Tournament not found locally'), { code: 'not-found' });
        await firestoreTournamentRepository.save(tournament);
        break;
      }
      case 'playerStats': {
        const match = await matchRepository.getById(job.entityId);
        if (!match) throw Object.assign(new Error('Match not found locally'), { code: 'not-found' });
        const ctx = job.context as { type: 'playerStats'; scorerUid: string };
        await firestorePlayerStatsRepository.processMatchCompletion(match, ctx.scorerUid);
        break;
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleJobError(job: SyncJob, err: unknown): Promise<void> {
  // For permission-denied, check if token is fresh
  let hasValidFreshToken = false;
  if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'permission-denied') {
    try {
      const user = auth.currentUser;
      if (user) {
        await user.getIdToken(true);
        hasValidFreshToken = true;
      }
    } catch {
      // Token refresh failed — auth-dependent
    }
  }

  const category = classifyError(err, job.type, hasValidFreshToken);
  const errorMessage = err instanceof Error ? err.message : String(err);

  switch (category) {
    case 'retryable': {
      if (isMaxRetriesExceeded(job.type, job.retryCount)) {
        await failJob(job.id, `Max retries exceeded: ${errorMessage}`);
      } else {
        const nextRetry = computeNextRetryAt(job.type, job.retryCount);
        await retryJob(job.id, nextRetry);
      }
      break;
    }
    case 'rate-limited': {
      const nextRetry = computeRateLimitRetryAt(job.retryCount);
      await retryJob(job.id, nextRetry);
      break;
    }
    case 'auth-dependent': {
      await setJobAwaitingAuth(job.id);
      break;
    }
    case 'staleJob': {
      // Tournament/match deleted — just remove the job
      await db.syncQueue.delete(job.id);
      break;
    }
    case 'fatal':
    default: {
      await failJob(job.id, errorMessage);
      break;
    }
  }
}

async function processOnce(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  onStatusChange?.('processing');

  const jobs = await claimNextJobs(MAX_CONCURRENT);
  if (jobs.length === 0) {
    // Check for pending/failed to determine status
    const pending = await db.syncQueue.where('status').anyOf(['pending', 'awaitingAuth']).count();
    const failed = await db.syncQueue.where('status').equals('failed').count();
    if (failed > 0) onStatusChange?.('failed');
    else if (pending > 0) onStatusChange?.('pending');
    else onStatusChange?.('idle');
    return;
  }

  // Track in-flight entities for per-entity serialization
  const inFlight = new Set<string>();

  const promises = jobs.map(async (job) => {
    const entityKey = `${job.type}:${job.entityId}`;

    // Per-entity serialization: wait if same entity is in-flight
    while (inFlight.has(entityKey)) {
      await new Promise((r) => setTimeout(r, 100));
    }
    inFlight.add(entityKey);

    try {
      await executeJob(job);
      await completeJob(job.id);
    } catch (err) {
      await handleJobError(job, err);
    } finally {
      inFlight.delete(entityKey);
    }
  });

  await Promise.allSettled(promises);

  // Update status after processing
  const pendingCount = await db.syncQueue.where('status').anyOf(['pending', 'awaitingAuth']).count();
  const failedCount = await db.syncQueue.where('status').equals('failed').count();
  if (failedCount > 0) onStatusChange?.('failed');
  else if (pendingCount > 0) onStatusChange?.('pending');
  else onStatusChange?.('idle');
}

function scheduleNext(): void {
  if (!running) return;

  getNextRetryTime().then((nextTime) => {
    if (!running) return;

    if (nextTime === null) {
      // No pending jobs — check again in 30s (watchdog)
      timerId = setTimeout(() => {
        if (running) pollLoop();
      }, 30_000);
    } else {
      const delay = Math.max(0, nextTime - Date.now());
      timerId = setTimeout(() => {
        if (running) pollLoop();
      }, delay);
    }
  });
}

async function pollLoop(): Promise<void> {
  if (!running) return;

  try {
    await processOnce();
  } catch (err) {
    console.error('Sync processor error:', err);
    await new Promise((r) => setTimeout(r, RESILIENCE_SLEEP));
  }

  scheduleNext();
}

export function startProcessor(lockProvider?: { request: (...args: unknown[]) => unknown }): void {
  if (running) return;
  running = true;

  const locks = lockProvider ?? (typeof navigator !== 'undefined' ? navigator.locks : null);

  if (locks) {
    locks.request('picklescore-sync-queue', { mode: 'exclusive' }, async () => {
      await runStartupCleanup();
      await pollLoop();
      // Hold the lock while running
      return new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (!running) { clearInterval(check); resolve(); }
        }, 1000);
      });
    });
  } else {
    // Fallback: no Web Locks support
    runStartupCleanup().then(() => pollLoop());
  }

  // Online/offline listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', wakeProcessor);
    window.addEventListener('offline', pauseProcessor);
  }
}

export function stopProcessor(): void {
  running = false;
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', wakeProcessor);
    window.removeEventListener('offline', pauseProcessor);
  }
}

export function wakeProcessor(): void {
  if (!running) return;
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
  pollLoop();
}

function pauseProcessor(): void {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/syncProcessor.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/data/firebase/syncProcessor.ts src/data/firebase/__tests__/syncProcessor.test.ts
git commit -m "feat(sync): add queue processor with Web Locks, adaptive polling, error handling"
```

---

## Task 6: Remove syncScoreEventToCloud

**Files:**
- Modify: `src/data/firebase/cloudSync.ts` — remove method + `firestoreScoreEventRepository` import
- Modify: `src/features/scoring/hooks/useScoringActor.ts` — remove 3 call sites (lines 121, 150, 176)
- Modify: `src/data/firebase/__tests__/cloudSync.test.ts` — remove method existence test
- Modify: `src/shared/hooks/__tests__/useAuth.test.ts` — remove from mock
- Modify: `src/features/buddies/__tests__/BuddiesPage.test.tsx` — remove from mock
- Modify: `src/features/buddies/__tests__/CreateGroupPage.test.tsx` — remove from mock

**Step 1: Remove from cloudSync.ts**

In `src/data/firebase/cloudSync.ts`:
- Remove the `import { firestoreScoreEventRepository }` line (line 3)
- Remove the entire `syncScoreEventToCloud` method (lines 27-33)
- Remove `ScoreEvent` from the types import (line 8)

**Step 2: Remove 3 call sites from useScoringActor.ts**

In `src/features/scoring/hooks/useScoringActor.ts`, remove these lines:
- Line 121: `cloudSync.syncScoreEventToCloud(event);`
- Line 150: `cloudSync.syncScoreEventToCloud(event);`
- Line 176: `cloudSync.syncScoreEventToCloud(event);`

**Step 3: Remove from test files**

In `src/data/firebase/__tests__/cloudSync.test.ts`:
- Remove lines 45-47 (firestoreScoreEventRepository mock)
- Remove lines 76-79 (syncScoreEventToCloud method existence test)

In `src/shared/hooks/__tests__/useAuth.test.ts`:
- Remove line 21: `syncScoreEventToCloud: vi.fn(),`

In `src/features/buddies/__tests__/BuddiesPage.test.tsx`:
- Remove line 31: `syncScoreEventToCloud: vi.fn(),`

In `src/features/buddies/__tests__/CreateGroupPage.test.tsx`:
- Remove line 29: `syncScoreEventToCloud: vi.fn(),`

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests pass (no consumers of the removed method)

**Step 5: Commit**

```bash
git add src/data/firebase/cloudSync.ts src/features/scoring/hooks/useScoringActor.ts src/data/firebase/__tests__/cloudSync.test.ts src/shared/hooks/__tests__/useAuth.test.ts src/features/buddies/__tests__/BuddiesPage.test.tsx src/features/buddies/__tests__/CreateGroupPage.test.tsx
git commit -m "refactor(sync): remove syncScoreEventToCloud (no cloud consumers)"
```

---

## Task 7: Refactor cloudSync — Enqueue Instead of Direct Calls

**Files:**
- Modify: `src/data/firebase/cloudSync.ts` — refactor runtime methods to enqueue
- Modify: `src/data/firebase/__tests__/cloudSync.test.ts` — update tests for enqueue behavior
- Test: `src/data/firebase/__tests__/cloudSync.enqueue.test.ts` (new focused tests)

**Step 1: Write the failing tests**

```typescript
// src/data/firebase/__tests__/cloudSync.enqueue.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../../db';

vi.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'test-user' } },
  firestore: {},
}));

vi.mock('../../firebase/firestoreMatchRepository', () => ({
  firestoreMatchRepository: { save: vi.fn(), getByOwner: vi.fn(() => []), getBySharedWith: vi.fn(() => []) },
}));

vi.mock('../../firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: { save: vi.fn(), getByOrganizer: vi.fn(() => []) },
}));

vi.mock('../../firebase/firestoreUserRepository', () => ({
  firestoreUserRepository: { saveProfile: vi.fn() },
}));

vi.mock('../../firebase/firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: { processMatchCompletion: vi.fn() },
}));

vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: { save: vi.fn(), getAll: vi.fn(() => []), getById: vi.fn() },
}));

describe('cloudSync enqueue behavior', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db.syncQueue.clear();
  });

  it('syncMatchToCloud enqueues a match sync job', async () => {
    const { cloudSync } = await import('../cloudSync');
    const match = { id: 'match-1', status: 'completed' } as any;
    cloudSync.syncMatchToCloud(match, ['buddy-1']);
    // Give microtask a chance to complete
    await new Promise((r) => setTimeout(r, 50));
    const job = await db.syncQueue.get('match:match-1');
    expect(job).toBeDefined();
    expect(job!.type).toBe('match');
    expect(job!.context).toEqual({ type: 'match', ownerId: 'test-user', sharedWith: ['buddy-1'] });
  });

  it('syncTournamentToCloud enqueues a tournament sync job', async () => {
    const { cloudSync } = await import('../cloudSync');
    cloudSync.syncTournamentToCloud({ id: 'tourn-1' } as any);
    await new Promise((r) => setTimeout(r, 50));
    const job = await db.syncQueue.get('tournament:tourn-1');
    expect(job).toBeDefined();
    expect(job!.type).toBe('tournament');
  });

  it('syncPlayerStatsAfterMatch enqueues a playerStats job with dependency', async () => {
    const { cloudSync } = await import('../cloudSync');
    cloudSync.syncPlayerStatsAfterMatch({ id: 'match-1' } as any);
    await new Promise((r) => setTimeout(r, 50));
    const job = await db.syncQueue.get('playerStats:match-1');
    expect(job).toBeDefined();
    expect(job!.type).toBe('playerStats');
    expect(job!.dependsOn).toEqual(['match:match-1']);
  });

  it('syncMatchToCloud does nothing when user is not signed in', async () => {
    const config = await import('../config');
    (config as any).auth.currentUser = null;
    const { cloudSync } = await import('../cloudSync');
    cloudSync.syncMatchToCloud({ id: 'match-1' } as any);
    await new Promise((r) => setTimeout(r, 50));
    const count = await db.syncQueue.count();
    expect(count).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/cloudSync.enqueue.test.ts`
Expected: FAIL — jobs not created (old implementation calls Firestore directly)

**Step 3: Refactor cloudSync.ts**

Replace the runtime fire-and-forget methods with enqueue calls:

```typescript
// src/data/firebase/cloudSync.ts
import { auth } from './config';
import { firestoreMatchRepository } from './firestoreMatchRepository';
import { firestoreTournamentRepository } from './firestoreTournamentRepository';
import { firestoreUserRepository } from './firestoreUserRepository';
import { firestorePlayerStatsRepository } from './firestorePlayerStatsRepository';
import { matchRepository } from '../repositories/matchRepository';
import { enqueueJob } from './syncQueue';
import { db } from '../db';
import type { Match, Tournament } from '../types';

export const cloudSync = {
  /**
   * Enqueue a match sync job. Fire-and-forget — enqueue is instant.
   */
  syncMatchToCloud(match: Match, sharedWith: string[] = []): void {
    const user = auth.currentUser;
    if (!user) return;
    enqueueJob('match', match.id, { type: 'match', ownerId: user.uid, sharedWith }).catch((err) => {
      console.warn('Failed to enqueue match sync:', match.id, err);
    });
  },

  /**
   * Pull all cloud matches into local Dexie.
   * Called on sign-in to hydrate local DB with cloud data.
   */
  async pullCloudMatchesToLocal(): Promise<number> {
    const user = auth.currentUser;
    if (!user) return 0;

    try {
      const [ownedMatches, sharedMatches] = await Promise.all([
        firestoreMatchRepository.getByOwner(user.uid),
        firestoreMatchRepository.getBySharedWith(user.uid),
      ]);

      // Deduplicate by match ID — owned takes precedence
      const matchMap = new Map<string, typeof ownedMatches[number]>();
      for (const m of ownedMatches) {
        matchMap.set(m.id, m);
      }
      for (const m of sharedMatches) {
        if (!matchMap.has(m.id)) {
          matchMap.set(m.id, m);
        }
      }

      const cloudMatches = Array.from(matchMap.values());
      let synced = 0;

      // Batched write in single transaction
      await db.transaction('rw', db.matches, db.syncQueue, async () => {
        for (const cloudMatch of cloudMatches) {
          // Recency guard
          const existing = await matchRepository.getById(cloudMatch.id);

          // Never overwrite active scoring
          if (existing?.status === 'in-progress') continue;

          // Skip if local match has pending/processing/awaitingAuth sync job
          if (existing) {
            const syncJob = await db.syncQueue.get(`match:${cloudMatch.id}`);
            if (syncJob && ['pending', 'processing', 'awaitingAuth'].includes(syncJob.status)) {
              continue;
            }
          }

          const localMatch: Match = {
            id: cloudMatch.id,
            config: cloudMatch.config,
            team1PlayerIds: cloudMatch.team1PlayerIds,
            team2PlayerIds: cloudMatch.team2PlayerIds,
            team1Name: cloudMatch.team1Name,
            team2Name: cloudMatch.team2Name,
            team1Color: cloudMatch.team1Color,
            team2Color: cloudMatch.team2Color,
            games: cloudMatch.games,
            winningSide: cloudMatch.winningSide,
            status: cloudMatch.status,
            startedAt: cloudMatch.startedAt,
            completedAt: cloudMatch.completedAt,
            lastSnapshot: cloudMatch.lastSnapshot,
            tournamentId: cloudMatch.tournamentId,
            tournamentTeam1Id: cloudMatch.tournamentTeam1Id,
            tournamentTeam2Id: cloudMatch.tournamentTeam2Id,
            poolId: cloudMatch.poolId,
            bracketSlotId: cloudMatch.bracketSlotId,
            court: cloudMatch.court,
            scorerRole: cloudMatch.scorerRole,
            scorerTeam: cloudMatch.scorerTeam,
            ownerUid: cloudMatch.ownerId,
          };
          await matchRepository.save(localMatch);
          synced++;
        }
      });

      return synced;
    } catch (err) {
      console.warn('Failed to pull cloud matches:', err);
      throw err; // Re-throw so useAuth can set syncError
    }
  },

  /**
   * Save user profile to Firestore on sign-in (still blocking).
   */
  async syncUserProfile(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await firestoreUserRepository.saveProfile(user);
    } catch (err) {
      console.warn('Failed to sync user profile:', err);
    }
  },

  /**
   * Enqueue local matches for push to cloud.
   * Non-blocking — enqueues jobs to the sync queue.
   */
  async enqueueLocalMatchPush(): Promise<number> {
    const user = auth.currentUser;
    if (!user) return 0;

    const localMatches = await matchRepository.getAll();
    let enqueued = 0;
    for (const match of localMatches) {
      // Only push matches owned by current user (or pre-cloud matches with no owner)
      if (!match.ownerUid || match.ownerUid === user.uid) {
        await enqueueJob('match', match.id, { type: 'match', ownerId: user.uid, sharedWith: [] });
        enqueued++;
      }
    }
    return enqueued;
  },

  /**
   * Enqueue a tournament sync job. Fire-and-forget.
   */
  syncTournamentToCloud(tournament: Tournament): void {
    const user = auth.currentUser;
    if (!user) return;
    enqueueJob('tournament', tournament.id, { type: 'tournament' }).catch((err) => {
      console.warn('Failed to enqueue tournament sync:', tournament.id, err);
    });
  },

  /**
   * Pull organizer's tournaments from Firestore (unchanged).
   */
  async pullTournamentsFromCloud(): Promise<Tournament[]> {
    const user = auth.currentUser;
    if (!user) return [];
    try {
      return await firestoreTournamentRepository.getByOrganizer(user.uid);
    } catch (err) {
      console.warn('Failed to pull tournaments:', err);
      return [];
    }
  },

  /**
   * Enqueue player stats sync. Depends on match being synced first.
   */
  syncPlayerStatsAfterMatch(match: Match): void {
    const user = auth.currentUser;
    if (!user) return;
    enqueueJob(
      'playerStats',
      match.id,
      { type: 'playerStats', scorerUid: user.uid },
      [`match:${match.id}`],
    ).catch((err) => {
      console.warn('Failed to enqueue stats sync:', match.id, err);
    });
  },
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/cloudSync.enqueue.test.ts`
Expected: PASS

**Step 5: Update existing cloudSync tests**

Update `src/data/firebase/__tests__/cloudSync.test.ts`:
- Remove the `syncMatchToCloud method` existence test (behavior changed)
- Add syncQueue mock/import and clear in beforeEach
- Update the pull tests to account for the new recency guard and ownerUid mapping

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/data/firebase/cloudSync.ts src/data/firebase/__tests__/cloudSync.test.ts src/data/firebase/__tests__/cloudSync.enqueue.test.ts
git commit -m "refactor(sync): replace fire-and-forget with queue enqueue, add pull recency guard"
```

---

## Task 8: Non-blocking Sign-in Sync

**Files:**
- Modify: `src/shared/hooks/useAuth.ts` — non-blocking push/pull, syncError signal
- Test: `src/shared/hooks/__tests__/useAuth.test.ts` — update tests

**Step 1: Write the failing tests**

Add tests for the new non-blocking flow and `syncError` signal:

```typescript
// Add to useAuth.test.ts
it('should provide syncError signal', async () => {
  const mod = await import('../useAuth');
  const authState = mod.useAuth();
  expect(typeof authState.syncError).toBe('function');
  expect(authState.syncError()).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/hooks/__tests__/useAuth.test.ts`
Expected: FAIL — `syncError` not returned

**Step 3: Update useAuth.ts**

```typescript
// src/shared/hooks/useAuth.ts
import { createSignal } from 'solid-js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../../data/firebase/config';
import { cloudSync } from '../../data/firebase/cloudSync';
import { resetAwaitingAuthJobs } from '../../data/firebase/syncQueue';
import { startProcessor, stopProcessor, wakeProcessor } from '../../data/firebase/syncProcessor';

const [user, setUser] = createSignal<User | null>(null);
const [loading, setLoading] = createSignal(true);
const [syncing, setSyncing] = createSignal(false);
const [syncError, setSyncError] = createSignal(false);

let listenerInitialized = false;

function initAuthListener() {
  if (listenerInitialized) return;
  listenerInitialized = true;
  onAuthStateChanged(auth, async (firebaseUser) => {
    const wasSignedOut = user() === null;
    setUser(firebaseUser);
    setLoading(false);

    if (firebaseUser && wasSignedOut) {
      setSyncing(true);
      setSyncError(false);

      // Step 1: blocking profile sync (fast, required by security rules)
      await cloudSync.syncUserProfile();

      // Step 2: non-blocking push — enqueue local matches
      cloudSync.enqueueLocalMatchPush().catch((err) => {
        console.warn('Match push enqueue failed:', err);
      });

      // Step 3: non-blocking pull — runs in background
      cloudSync.pullCloudMatchesToLocal()
        .then(() => setSyncing(false))
        .catch(() => {
          setSyncError(true);
          setSyncing(false);
        });

      // Start the sync processor
      startProcessor();

      // Resume awaitingAuth jobs with fresh token
      try {
        await firebaseUser.getIdToken(true);
        await resetAwaitingAuthJobs();
        wakeProcessor();
      } catch {
        // Token refresh failed — processor will handle it
      }
    }

    // Sign out: stop processor
    if (!firebaseUser) {
      stopProcessor();
    }
  });
}

export function useAuth() {
  initAuthListener();

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return { user, loading, syncing, syncError, signIn, signOut };
}
```

**Step 4: Update useAuth.test.ts mocks**

The test file needs mocks for the new imports (`syncQueue`, `syncProcessor`). Add:

```typescript
vi.mock('../../../data/firebase/syncQueue', () => ({
  resetAwaitingAuthJobs: vi.fn(() => Promise.resolve(0)),
}));

vi.mock('../../../data/firebase/syncProcessor', () => ({
  startProcessor: vi.fn(),
  stopProcessor: vi.fn(),
  wakeProcessor: vi.fn(),
}));
```

And update the cloudSync mock to include `enqueueLocalMatchPush`:
```typescript
vi.mock('../../../data/firebase/cloudSync', () => ({
  cloudSync: {
    syncUserProfile: vi.fn(() => Promise.resolve()),
    enqueueLocalMatchPush: vi.fn(() => Promise.resolve(0)),
    pullCloudMatchesToLocal: vi.fn(() => Promise.resolve(0)),
    syncMatchToCloud: vi.fn(),
    syncTournamentToCloud: vi.fn(),
    syncPlayerStatsAfterMatch: vi.fn(),
  },
}));
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/shared/hooks/__tests__/useAuth.test.ts`
Expected: PASS

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/shared/hooks/useAuth.ts src/shared/hooks/__tests__/useAuth.test.ts
git commit -m "feat(sync): non-blocking sign-in sync with processor startup and syncError signal"
```

---

## Task 9: Sync Status Signals + useSyncStatus Hook

**Files:**
- Create: `src/data/firebase/useSyncStatus.ts`
- Test: `src/data/firebase/__tests__/useSyncStatus.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/data/firebase/__tests__/useSyncStatus.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'u1' } },
  firestore: {},
}));

vi.mock('../../firebase/syncQueue', () => ({
  getPendingCount: vi.fn(() => Promise.resolve(0)),
  getFailedCount: vi.fn(() => Promise.resolve(0)),
}));

describe('useSyncStatus', () => {
  it('exports syncStatus, pendingCount, failedCount signals', async () => {
    const mod = await import('../useSyncStatus');
    expect(typeof mod.syncStatus).toBe('function');
    expect(typeof mod.pendingCount).toBe('function');
    expect(typeof mod.failedCount).toBe('function');
  });

  it('syncStatus defaults to idle', async () => {
    const mod = await import('../useSyncStatus');
    expect(mod.syncStatus()).toBe('idle');
  });

  it('updateSyncStatus sets status based on counts', async () => {
    const mod = await import('../useSyncStatus');
    const { getPendingCount, getFailedCount } = await import('../syncQueue');
    (getPendingCount as any).mockResolvedValue(3);
    (getFailedCount as any).mockResolvedValue(0);
    await mod.updateSyncStatus();
    expect(mod.syncStatus()).toBe('pending');
    expect(mod.pendingCount()).toBe(3);
  });

  it('shows failed when failed jobs exist', async () => {
    const mod = await import('../useSyncStatus');
    const { getPendingCount, getFailedCount } = await import('../syncQueue');
    (getPendingCount as any).mockResolvedValue(0);
    (getFailedCount as any).mockResolvedValue(2);
    await mod.updateSyncStatus();
    expect(mod.syncStatus()).toBe('failed');
    expect(mod.failedCount()).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/firebase/__tests__/useSyncStatus.test.ts`
Expected: FAIL — module not found

**Step 3: Implement useSyncStatus**

```typescript
// src/data/firebase/useSyncStatus.ts
import { createSignal } from 'solid-js';
import { getPendingCount, getFailedCount } from './syncQueue';

type SyncStatusValue = 'idle' | 'processing' | 'pending' | 'failed';

const [syncStatus, setSyncStatus] = createSignal<SyncStatusValue>('idle');
const [pendingCount, setPendingCount] = createSignal(0);
const [failedCount, setFailedCount] = createSignal(0);

export { syncStatus, pendingCount, failedCount };

export async function updateSyncStatus(): Promise<void> {
  const pending = await getPendingCount();
  const failed = await getFailedCount();
  setPendingCount(pending);
  setFailedCount(failed);

  if (failed > 0) setSyncStatus('failed');
  else if (pending > 0) setSyncStatus('pending');
  else setSyncStatus('idle');
}

export function setSyncProcessing(): void {
  setSyncStatus('processing');
}
```

**Step 4: Wire useSyncStatus into the processor**

In `src/data/firebase/syncProcessor.ts`, import and use `updateSyncStatus` and `setSyncProcessing` instead of the local `onStatusChange` callback. Replace:
- `onStatusChange?.('processing')` → `setSyncProcessing()`
- All status updates after processing → `updateSyncStatus()`

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/firebase/__tests__/useSyncStatus.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/data/firebase/useSyncStatus.ts src/data/firebase/__tests__/useSyncStatus.test.ts src/data/firebase/syncProcessor.ts
git commit -m "feat(sync): add useSyncStatus hook with global signals for sync state"
```

---

## Task 10: TopNav Sync Indicator

**Files:**
- Modify: `src/shared/components/TopNav.tsx` — add sync dot next to avatar
- Test: `src/shared/components/__tests__/TopNav.sync.test.tsx` (new)

**Step 1: Write the failing tests**

```typescript
// src/shared/components/__tests__/TopNav.sync.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import TopNav from '../TopNav';

// Mock hooks
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'u1', displayName: 'Test', email: 'test@test.com', photoURL: null }),
    loading: () => false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

const mockSyncStatus = vi.fn(() => 'idle');
const mockPendingCount = vi.fn(() => 0);
const mockFailedCount = vi.fn(() => 0);

vi.mock('../../../data/firebase/useSyncStatus', () => ({
  syncStatus: () => mockSyncStatus(),
  pendingCount: () => mockPendingCount(),
  failedCount: () => mockFailedCount(),
}));

vi.mock('@solidjs/router', () => ({
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

describe('TopNav sync indicator', () => {
  it('shows no indicator when idle', () => {
    mockSyncStatus.mockReturnValue('idle');
    const { container } = render(() => <TopNav />);
    expect(container.querySelector('[data-testid="sync-indicator"]')).toBeNull();
  });

  it('shows pulsing dot when processing', () => {
    mockSyncStatus.mockReturnValue('processing');
    const { container } = render(() => <TopNav />);
    const dot = container.querySelector('[data-testid="sync-indicator"]');
    expect(dot).not.toBeNull();
    expect(dot!.classList.contains('animate-pulse')).toBe(true);
  });

  it('shows static dot when pending', () => {
    mockSyncStatus.mockReturnValue('pending');
    const { container } = render(() => <TopNav />);
    const dot = container.querySelector('[data-testid="sync-indicator"]');
    expect(dot).not.toBeNull();
    expect(dot!.classList.contains('animate-pulse')).toBe(false);
  });

  it('shows amber dot when failed', () => {
    mockSyncStatus.mockReturnValue('failed');
    const { container } = render(() => <TopNav />);
    const dot = container.querySelector('[data-testid="sync-indicator"]');
    expect(dot).not.toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/components/__tests__/TopNav.sync.test.tsx`
Expected: FAIL — no sync indicator in DOM

**Step 3: Add sync indicator to TopNav**

In `src/shared/components/TopNav.tsx`, import `syncStatus` from `useSyncStatus` and add a small dot next to the avatar button:

```tsx
import { syncStatus } from '../../data/firebase/useSyncStatus';

// Inside the avatar button, add after the <img> or fallback avatar:
<Show when={syncStatus() !== 'idle'}>
  <span
    data-testid="sync-indicator"
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

Also add "X syncs failed" + "Retry" to the dropdown menu when status is failed.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/components/__tests__/TopNav.sync.test.tsx`
Expected: PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/shared/components/TopNav.tsx src/shared/components/__tests__/TopNav.sync.test.tsx
git commit -m "feat(sync): add sync status indicator to TopNav avatar"
```

---

## Task 11: Settings Page Cloud Sync Row

**Files:**
- Modify: `src/features/settings/SettingsPage.tsx` — add Cloud Sync section
- Test: `src/features/settings/__tests__/SettingsPage.sync.test.tsx` (new)

**Step 1: Write the failing test**

```typescript
// src/features/settings/__tests__/SettingsPage.sync.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import SettingsPage from '../SettingsPage';

vi.mock('../../../data/firebase/useSyncStatus', () => ({
  syncStatus: () => 'idle',
  pendingCount: () => 0,
  failedCount: () => 0,
}));

vi.mock('../../../data/firebase/syncProcessor', () => ({
  wakeProcessor: vi.fn(),
}));

vi.mock('../../../shared/hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'u1' }),
    loading: () => false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../../../stores/settingsStore', () => ({
  settings: () => ({
    displayMode: 'dark',
    keepScreenAwake: true,
    soundEffects: 'off',
    hapticFeedback: false,
    voiceAnnouncements: 'off',
    voiceUri: '',
    voiceRate: 1.0,
    voicePitch: 1.0,
    defaultScoringMode: 'sideout',
    defaultPointsToWin: 11,
    defaultMatchFormat: 'single',
  }),
  setSettings: vi.fn(),
}));

vi.mock('@solidjs/router', () => ({
  A: (props: any) => <a href={props.href}>{props.children}</a>,
}));

describe('SettingsPage Cloud Sync section', () => {
  it('renders Cloud Sync heading', () => {
    render(() => <SettingsPage />);
    expect(screen.getByText('Cloud Sync')).toBeDefined();
  });

  it('renders Sync Now button', () => {
    render(() => <SettingsPage />);
    expect(screen.getByRole('button', { name: /sync now/i })).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/settings/__tests__/SettingsPage.sync.test.tsx`
Expected: FAIL — "Cloud Sync" not in DOM

**Step 3: Add Cloud Sync section to SettingsPage**

In `src/features/settings/SettingsPage.tsx`, add a new section at the top of the right column:

```tsx
import { syncStatus, pendingCount, failedCount } from '../../data/firebase/useSyncStatus';
import { wakeProcessor } from '../../data/firebase/syncProcessor';
import { useAuth } from '../../shared/hooks/useAuth';

// In the right column, before "Default Scoring":
<Show when={useAuth().user()}>
  <fieldset>
    <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">
      Cloud Sync
    </legend>
    <div class="bg-surface-light rounded-xl p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <div class="font-semibold text-on-surface text-sm">Status</div>
          <div class="text-xs text-on-surface-muted capitalize">{syncStatus()}</div>
        </div>
        <Show when={pendingCount() > 0 || failedCount() > 0}>
          <div class="text-xs text-on-surface-muted">
            {pendingCount() > 0 && `${pendingCount()} pending`}
            {pendingCount() > 0 && failedCount() > 0 && ' · '}
            {failedCount() > 0 && `${failedCount()} failed`}
          </div>
        </Show>
      </div>
      <button
        type="button"
        onClick={() => wakeProcessor()}
        disabled={syncStatus() === 'processing'}
        class="w-full bg-surface-lighter text-on-surface font-semibold text-sm py-2.5 rounded-lg active:scale-95 transition-transform disabled:opacity-50"
      >
        Sync Now
      </button>
    </div>
  </fieldset>
</Show>
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/settings/__tests__/SettingsPage.sync.test.tsx`
Expected: PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/features/settings/SettingsPage.tsx src/features/settings/__tests__/SettingsPage.sync.test.tsx
git commit -m "feat(sync): add Cloud Sync section to Settings page"
```

---

## Task 12: Integration Tests

**Files:**
- Create: `src/data/firebase/__tests__/syncIntegration.test.ts`

Full-flow integration tests verifying the enqueue → processor → Firestore path.

**Step 1: Write integration tests**

```typescript
// src/data/firebase/__tests__/syncIntegration.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../../db';
import { enqueueJob, completeJob } from '../syncQueue';

// Mock Firestore repos
const mockSave = vi.fn().mockResolvedValue(undefined);
vi.mock('../../firebase/firestoreMatchRepository', () => ({
  firestoreMatchRepository: { save: mockSave, getByOwner: vi.fn(() => []), getBySharedWith: vi.fn(() => []) },
}));
vi.mock('../../firebase/firestoreTournamentRepository', () => ({
  firestoreTournamentRepository: { save: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../firebase/firestorePlayerStatsRepository', () => ({
  firestorePlayerStatsRepository: { processMatchCompletion: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'u1', getIdToken: vi.fn().mockResolvedValue('token') } },
  firestore: {},
}));
vi.mock('../../repositories/matchRepository', () => ({
  matchRepository: {
    getById: vi.fn().mockResolvedValue({
      id: '1', config: { gameType: 'singles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
      team1PlayerIds: [], team2PlayerIds: [], team1Name: 'A', team2Name: 'B',
      games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
      winningSide: 1, status: 'completed', startedAt: 1000, completedAt: 2000,
    }),
    getAll: vi.fn(() => []),
    save: vi.fn(),
  },
}));
vi.mock('../../firebase/firestoreUserRepository', () => ({
  firestoreUserRepository: { saveProfile: vi.fn() },
}));

describe('sync integration', () => {
  beforeEach(async () => {
    await db.syncQueue.clear();
  });

  afterEach(async () => {
    await db.syncQueue.clear();
  });

  it('enqueue match → claim → execute → mark completed', async () => {
    const { claimNextJobs, completeJob } = await import('../syncQueue');
    const { executeJobForTest } = await import('../syncProcessor');

    await enqueueJob('match', '1', { type: 'match', ownerId: 'u1', sharedWith: [] });
    const jobs = await claimNextJobs(2);
    expect(jobs).toHaveLength(1);

    // Processor would call executeJob — we test the flow
    const job = await db.syncQueue.get('match:1');
    expect(job!.status).toBe('processing');
  });

  it('dependency chain: match completes → playerStats becomes eligible', async () => {
    const { claimNextJobs } = await import('../syncQueue');

    await enqueueJob('match', '1', { type: 'match', ownerId: 'u1', sharedWith: [] });
    await enqueueJob('playerStats', '1', { type: 'playerStats', scorerUid: 'u1' }, ['match:1']);

    // First round: only match is claimable
    const round1 = await claimNextJobs(2);
    expect(round1).toHaveLength(1);
    expect(round1[0].type).toBe('match');

    // Complete match
    await completeJob('match:1');

    // Second round: playerStats now eligible
    const round2 = await claimNextJobs(2);
    expect(round2).toHaveLength(1);
    expect(round2[0].type).toBe('playerStats');
  });

  it('auth-dependent → awaitingAuth → auth change → re-queued', async () => {
    const { setJobAwaitingAuth, resetAwaitingAuthJobs, claimNextJobs } = await import('../syncQueue');

    await enqueueJob('match', '1', { type: 'match', ownerId: 'u1', sharedWith: [] });
    await setJobAwaitingAuth('match:1');

    const before = await claimNextJobs(2);
    expect(before).toHaveLength(0); // awaitingAuth not claimable

    await resetAwaitingAuthJobs();

    const after = await claimNextJobs(2);
    expect(after).toHaveLength(1); // Now pending again
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/data/firebase/__tests__/syncIntegration.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/data/firebase/__tests__/syncIntegration.test.ts
git commit -m "test(sync): add integration tests for queue flow, dependencies, auth recovery"
```

---

## Task 13: History/Profile Sync Error Banner

**Files:**
- Create: `src/shared/components/SyncErrorBanner.tsx`
- Modify: `src/features/history/HistoryPage.tsx` — add banner
- Modify: `src/features/profile/ProfilePage.tsx` — add banner (if exists)
- Test: `src/shared/components/__tests__/SyncErrorBanner.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/shared/components/__tests__/SyncErrorBanner.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

const mockSyncError = vi.fn(() => false);
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: () => ({ uid: 'u1' }),
    loading: () => false,
    syncing: () => false,
    syncError: () => mockSyncError(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../../../data/firebase/cloudSync', () => ({
  cloudSync: { pullCloudMatchesToLocal: vi.fn(() => Promise.resolve(0)) },
}));

describe('SyncErrorBanner', () => {
  it('shows nothing when syncError is false', async () => {
    mockSyncError.mockReturnValue(false);
    const { SyncErrorBanner } = await import('../SyncErrorBanner');
    const { container } = render(() => <SyncErrorBanner />);
    expect(container.textContent).toBe('');
  });

  it('shows error message when syncError is true', async () => {
    mockSyncError.mockReturnValue(true);
    const { SyncErrorBanner } = await import('../SyncErrorBanner');
    render(() => <SyncErrorBanner />);
    expect(screen.getByText(/couldn't load cloud matches/i)).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/components/__tests__/SyncErrorBanner.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement SyncErrorBanner**

```tsx
// src/shared/components/SyncErrorBanner.tsx
import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useAuth } from '../hooks/useAuth';
import { cloudSync } from '../../data/firebase/cloudSync';

export const SyncErrorBanner: Component = () => {
  const { syncError } = useAuth();

  const retry = () => {
    cloudSync.pullCloudMatchesToLocal().catch(() => {});
  };

  return (
    <Show when={syncError()}>
      <button
        type="button"
        onClick={retry}
        class="w-full text-center text-sm text-amber-400 bg-amber-400/10 py-2 px-4 rounded-lg"
      >
        Couldn't load cloud matches. Tap to retry.
      </button>
    </Show>
  );
};
```

**Step 4: Add to HistoryPage and ProfilePage**

Import `SyncErrorBanner` and add at the top of the page content in both files.

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/shared/components/__tests__/SyncErrorBanner.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/shared/components/SyncErrorBanner.tsx src/shared/components/__tests__/SyncErrorBanner.test.tsx src/features/history/HistoryPage.tsx
git commit -m "feat(sync): add SyncErrorBanner for failed cloud pull"
```

---

## Task 14: Type Check + Full Test Suite

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Fix any issues**

If there are type errors or test failures, fix them before proceeding.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(sync): resolve type check and test issues"
```

---

## Task 15: E2E Tests

**Files:**
- Create: `e2e/sync/sync-queue.spec.ts`

**Step 1: Write E2E tests**

```typescript
// e2e/sync/sync-queue.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Sync Queue E2E', () => {
  test('TopNav sync indicator visible during active sync, clears on completion', async ({ page }) => {
    await page.goto('http://localhost:5199');
    // Sign in (use test auth)
    // Start a match → complete it → check for sync indicator
    // Wait for indicator to clear
    const indicator = page.locator('[data-testid="sync-indicator"]');
    // This test depends on auth setup — may need Firebase emulator
  });

  test('Settings page shows Cloud Sync section when signed in', async ({ page }) => {
    await page.goto('http://localhost:5199/settings');
    // After signing in, verify "Cloud Sync" section appears
  });
});
```

**Note:** Full E2E tests require Firebase emulators running (Auth 9099, Firestore 8180). The E2E test skeleton is provided; implementation details depend on the existing E2E auth helpers in `e2e/helpers/`.

**Step 2: Run E2E tests**

Run: `npx playwright test e2e/sync/`
Expected: Tests pass with emulators running

**Step 3: Commit**

```bash
git add e2e/sync/sync-queue.spec.ts
git commit -m "test(sync): add E2E tests for sync indicator and settings"
```

---

## Summary

| Task | Description | Est. Tests |
|------|-------------|-----------|
| 1 | SyncJob types + Dexie v3 schema | 4 |
| 2 | Retry policy + backoff | 7 |
| 3 | Error classification | 14 |
| 4 | Sync queue CRUD operations | 17 |
| 5 | Queue processor | 3 |
| 6 | Remove syncScoreEventToCloud | 0 (removal) |
| 7 | Refactor cloudSync to enqueue | 4 |
| 8 | Non-blocking sign-in sync | 1+ |
| 9 | useSyncStatus hook | 3 |
| 10 | TopNav sync indicator | 4 |
| 11 | Settings Cloud Sync row | 2 |
| 12 | Integration tests | 3 |
| 13 | Sync error banner | 2 |
| 14 | Type check + full suite | 0 |
| 15 | E2E tests | 2+ |
| **Total** | | **~60+** |
