import Dexie from 'dexie';
import { db } from '../db';
import type { SyncJob, SyncJobContext } from './syncQueue.types';

// ── Constants ────────────────────────────────────────────────────────
const STALE_PROCESSING_MS = 10 * 60 * 1000;   // 10 minutes
const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000;  // 24 hours
const FAILED_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── enqueueJob ───────────────────────────────────────────────────────

/**
 * Creates or upserts a sync job with deterministic ID `${type}:${entityId}`.
 * If the job already exists and is completed, resets retryCount.
 * Always sets status='pending' and nextRetryAt=now.
 */
export async function enqueueJob(
  type: SyncJob['type'],
  entityId: string,
  context: SyncJobContext,
  dependsOn?: string[],
): Promise<void> {
  const id = `${type}:${entityId}`;
  const now = Date.now();

  const existing = await db.syncQueue.get(id);

  if (existing) {
    // Preserve retryCount unless the job was completed
    const retryCount = existing.status === 'completed' ? 0 : existing.retryCount;

    await db.syncQueue.update(id, {
      status: 'pending',
      nextRetryAt: now,
      retryCount,
      context,
      ...(dependsOn !== undefined ? { dependsOn } : {}),
    });
  } else {
    const job: SyncJob = {
      id,
      type,
      entityId,
      context,
      status: 'pending',
      retryCount: 0,
      nextRetryAt: now,
      createdAt: now,
      ...(dependsOn !== undefined ? { dependsOn } : {}),
    };
    await db.syncQueue.put(job);
  }
}

// ── claimNextJobs ────────────────────────────────────────────────────

/**
 * Queries ready jobs (status='pending', nextRetryAt <= now).
 * Cascades failures from failed dependencies.
 * Filters out jobs with unsatisfied dependencies.
 * Claims atomically via Dexie rw transaction.
 * Returns array of claimed jobs.
 */
export async function claimNextJobs(maxConcurrent: number): Promise<SyncJob[]> {
  const now = Date.now();

  return db.transaction('rw', db.syncQueue, async () => {
    // Query pending jobs ready to run using compound index
    const readyJobs = await db.syncQueue
      .where('[status+nextRetryAt]')
      .between(['pending', Dexie.minKey], ['pending', now], true, true)
      .toArray();

    const claimable: SyncJob[] = [];

    for (const job of readyJobs) {
      if (claimable.length >= maxConcurrent) break;

      // Check dependencies
      if (job.dependsOn && job.dependsOn.length > 0) {
        let allSatisfied = true;
        let hasFailed = false;
        let failedDepId = '';

        for (const depId of job.dependsOn) {
          const dep = await db.syncQueue.get(depId);
          if (!dep || dep.status === 'completed') {
            // Satisfied (completed or doesn't exist)
            continue;
          }
          if (dep.status === 'failed') {
            hasFailed = true;
            failedDepId = depId;
            break;
          }
          // Dependency is still in progress, pending, or awaitingAuth
          allSatisfied = false;
          break;
        }

        if (hasFailed) {
          // Cascade failure
          await db.syncQueue.update(job.id, {
            status: 'failed',
            lastError: `Dependency failed: ${failedDepId}`,
          });
          continue;
        }

        if (!allSatisfied) {
          continue;
        }
      }

      // Claim the job
      const processedAt = Date.now();
      await db.syncQueue.update(job.id, {
        status: 'processing',
        processedAt,
      });

      claimable.push({
        ...job,
        status: 'processing',
        processedAt,
      });
    }

    return claimable;
  });
}

// ── completeJob ──────────────────────────────────────────────────────

/** Sets status='completed' and completedAt=now. */
export async function completeJob(jobId: string): Promise<void> {
  await db.syncQueue.update(jobId, {
    status: 'completed',
    completedAt: Date.now(),
  });
}

// ── failJob ──────────────────────────────────────────────────────────

/** Sets status='failed' and lastError=message. */
export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  await db.syncQueue.update(jobId, {
    status: 'failed',
    lastError: errorMessage,
  });
}

// ── setJobAwaitingAuth ───────────────────────────────────────────────

/** Sets status='awaitingAuth'. */
export async function setJobAwaitingAuth(jobId: string): Promise<void> {
  await db.syncQueue.update(jobId, {
    status: 'awaitingAuth',
  });
}

// ── resetAwaitingAuthJobs ────────────────────────────────────────────

/**
 * Finds all awaitingAuth jobs, resets to pending with nextRetryAt=now.
 * Returns count of reset jobs.
 */
export async function resetAwaitingAuthJobs(): Promise<number> {
  const now = Date.now();

  const awaitingJobs = await db.syncQueue
    .where('[status+nextRetryAt]')
    .between(['awaitingAuth', Dexie.minKey], ['awaitingAuth', Dexie.maxKey], true, true)
    .toArray();

  if (awaitingJobs.length === 0) return 0;

  await db.transaction('rw', db.syncQueue, async () => {
    for (const job of awaitingJobs) {
      await db.syncQueue.update(job.id, {
        status: 'pending',
        nextRetryAt: now,
      });
    }
  });

  return awaitingJobs.length;
}

// ── retryJob ─────────────────────────────────────────────────────────

/** Increments retryCount, sets status='pending' and nextRetryAt. */
export async function retryJob(jobId: string, nextRetryAt: number): Promise<void> {
  const job = await db.syncQueue.get(jobId);
  if (!job) return;

  await db.syncQueue.update(jobId, {
    status: 'pending',
    retryCount: job.retryCount + 1,
    nextRetryAt,
  });
}

// ── reclaimStaleJobs ─────────────────────────────────────────────────

/**
 * Finds processing jobs with processedAt > 10 min old, resets to pending.
 * Returns count of reclaimed jobs.
 */
export async function reclaimStaleJobs(): Promise<number> {
  const now = Date.now();
  const staleThreshold = now - STALE_PROCESSING_MS;

  // Use compound index to find processing jobs, then filter by processedAt
  const staleJobs = await db.syncQueue
    .where('[status+nextRetryAt]')
    .between(['processing', Dexie.minKey], ['processing', Dexie.maxKey], true, true)
    .filter((job) => job.processedAt !== undefined && job.processedAt < staleThreshold)
    .toArray();

  if (staleJobs.length === 0) return 0;

  await db.transaction('rw', db.syncQueue, async () => {
    for (const job of staleJobs) {
      await db.syncQueue.update(job.id, {
        status: 'pending',
        nextRetryAt: now,
      });
    }
  });

  return staleJobs.length;
}

// ── pruneCompletedJobs ───────────────────────────────────────────────

/**
 * Deletes completed jobs older than 24 hours.
 * Returns count of deleted jobs.
 */
export async function pruneCompletedJobs(): Promise<number> {
  const cutoff = Date.now() - COMPLETED_TTL_MS;

  const oldJobs = await db.syncQueue
    .where('[status+nextRetryAt]')
    .between(['completed', Dexie.minKey], ['completed', Dexie.maxKey], true, true)
    .filter((job) => job.completedAt !== undefined && job.completedAt < cutoff)
    .toArray();

  if (oldJobs.length === 0) return 0;

  const ids = oldJobs.map((j) => j.id);
  await db.syncQueue.bulkDelete(ids);

  return ids.length;
}

// ── pruneFailedJobs ──────────────────────────────────────────────────

/**
 * Deletes failed jobs older than 30 days.
 * Returns count of deleted jobs.
 */
export async function pruneFailedJobs(): Promise<number> {
  const cutoff = Date.now() - FAILED_TTL_MS;

  const oldJobs = await db.syncQueue
    .where('[status+nextRetryAt]')
    .between(['failed', Dexie.minKey], ['failed', Dexie.maxKey], true, true)
    .filter((job) => job.createdAt < cutoff)
    .toArray();

  if (oldJobs.length === 0) return 0;

  const ids = oldJobs.map((j) => j.id);
  await db.syncQueue.bulkDelete(ids);

  return ids.length;
}

// ── getNextRetryTime ─────────────────────────────────────────────────

/** Returns earliest nextRetryAt among pending jobs, or null. */
export async function getNextRetryTime(): Promise<number | null> {
  // Use compound index to get pending jobs sorted by nextRetryAt
  const first = await db.syncQueue
    .where('[status+nextRetryAt]')
    .between(['pending', Dexie.minKey], ['pending', Dexie.maxKey], true, true)
    .first();

  return first ? first.nextRetryAt : null;
}

// ── getPendingCount ──────────────────────────────────────────────────

/** Count of pending + processing + awaitingAuth jobs. */
export async function getPendingCount(): Promise<number> {
  const [pending, processing, awaitingAuth] = await Promise.all([
    db.syncQueue
      .where('[status+nextRetryAt]')
      .between(['pending', Dexie.minKey], ['pending', Dexie.maxKey], true, true)
      .count(),
    db.syncQueue
      .where('[status+nextRetryAt]')
      .between(['processing', Dexie.minKey], ['processing', Dexie.maxKey], true, true)
      .count(),
    db.syncQueue
      .where('[status+nextRetryAt]')
      .between(['awaitingAuth', Dexie.minKey], ['awaitingAuth', Dexie.maxKey], true, true)
      .count(),
  ]);
  return pending + processing + awaitingAuth;
}

// ── getFailedCount ───────────────────────────────────────────────────

/** Count of failed jobs. */
export async function getFailedCount(): Promise<number> {
  return db.syncQueue
    .where('[status+nextRetryAt]')
    .between(['failed', Dexie.minKey], ['failed', Dexie.maxKey], true, true)
    .count();
}
