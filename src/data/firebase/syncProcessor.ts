import type { SyncJob } from './syncQueue.types';
import { db } from '../db';
import { auth } from './config';
import { matchRepository } from '../repositories/matchRepository';
import { firestoreMatchRepository } from './firestoreMatchRepository';
import { firestoreTournamentRepository } from './firestoreTournamentRepository';
import { firestorePlayerStatsRepository } from './firestorePlayerStatsRepository';
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
import { classifyError } from './syncErrors';
import { computeNextRetryAt, computeRateLimitRetryAt, isMaxRetriesExceeded } from './syncRetry';
import { setSyncProcessing, updateSyncStatus, resetSyncStatus } from './useSyncStatus';

// ── Constants ────────────────────────────────────────────────────────

const MAX_CONCURRENT = 2;
const WATCHDOG_INTERVAL_MS = 30_000;      // 30 seconds
const ERROR_SLEEP_MS = 5_000;             // 5 seconds
const JOB_TIMEOUT_MS = 15_000;            // 15 seconds
const WEB_LOCK_NAME = 'picklescore-sync-queue';

// ── Lock provider type ───────────────────────────────────────────────

type LockProvider = <T>(
  name: string,
  options: { mode: 'exclusive' },
  callback: (lock: unknown) => Promise<T>,
) => Promise<T>;

// ── Module state ─────────────────────────────────────────────────────

let running = false;
let pollTimeout: ReturnType<typeof setTimeout> | null = null;
let sleepResolve: (() => void) | null = null;
let onlineListener: (() => void) | null = null;
let offlineListener: (() => void) | null = null;

/** Set of `type:entityId` keys currently being processed — prevents per-entity overlap. */
const inFlightEntities = new Set<string>();

// ── runStartupCleanup ────────────────────────────────────────────────

/** Runs once at processor start: reclaims stale jobs and prunes old ones. */
export async function runStartupCleanup(): Promise<void> {
  await reclaimStaleJobs();
  await pruneCompletedJobs();
  await pruneFailedJobs();
}

// ── executeJob ───────────────────────────────────────────────────────

/** Executes a single sync job against Firestore. Throws on failure. */
async function executeJob(job: SyncJob): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    const err = new Error('No authenticated user');
    (err as any).code = 'unauthenticated';
    throw err;
  }

  // Set up timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), JOB_TIMEOUT_MS);

  try {
    // Create a race between the actual work and the abort signal
    const abortPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => {
        const err = new Error('Job timed out after 15 seconds');
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

/** The actual work for each job type. */
async function executeJobWork(job: SyncJob, uid: string): Promise<void> {
  switch (job.type) {
    case 'match': {
      const match = await matchRepository.getById(job.entityId);
      if (!match) {
        const err = new Error(`Match ${job.entityId} not found locally`);
        (err as any).code = 'not-found';
        throw err;
      }
      const ctx = job.context as { type: 'match'; ownerId: string; sharedWith: string[] };
      await firestoreMatchRepository.save(match, uid, ctx.sharedWith);
      break;
    }

    case 'tournament': {
      const tournament = await db.tournaments.get(job.entityId);
      if (!tournament) {
        const err = new Error(`Tournament ${job.entityId} not found locally`);
        (err as any).code = 'not-found';
        throw err;
      }
      await firestoreTournamentRepository.save(tournament);
      break;
    }

    case 'playerStats': {
      const match = await matchRepository.getById(job.entityId);
      if (!match) {
        const err = new Error(`Match ${job.entityId} not found locally for playerStats`);
        (err as any).code = 'not-found';
        throw err;
      }
      const ctx = job.context as { type: 'playerStats'; scorerUid: string };
      await firestorePlayerStatsRepository.processMatchCompletion(match, ctx.scorerUid);
      break;
    }

    default: {
      const err = new Error(`Unknown job type: ${(job as SyncJob).type}`);
      (err as any).code = 'invalid-argument';
      throw err;
    }
  }
}

// ── handleJobError ───────────────────────────────────────────────────

/** Classifies the error and takes appropriate queue action. */
async function handleJobError(job: SyncJob, err: unknown): Promise<void> {
  // For permission-denied, try refreshing the token to distinguish stale vs real
  let hasValidFreshToken = false;
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'permission-denied'
  ) {
    try {
      const user = auth.currentUser;
      if (user) {
        await user.getIdToken(true);
        hasValidFreshToken = true;
      }
    } catch {
      // Token refresh failed — treat as auth-dependent
      hasValidFreshToken = false;
    }
  }

  const category = classifyError(err, job.type, hasValidFreshToken);
  const errorMessage = err instanceof Error ? err.message : String(err);

  switch (category) {
    case 'retryable': {
      if (isMaxRetriesExceeded(job.type, job.retryCount)) {
        await failJob(job.id, `Max retries exceeded: ${errorMessage}`);
      } else {
        const nextRetryAt = computeNextRetryAt(job.type, job.retryCount);
        await retryJob(job.id, nextRetryAt);
      }
      break;
    }

    case 'rate-limited': {
      const nextRetryAt = computeRateLimitRetryAt(job.retryCount);
      await retryJob(job.id, nextRetryAt);
      break;
    }

    case 'auth-dependent': {
      await setJobAwaitingAuth(job.id);
      break;
    }

    case 'staleJob': {
      await db.syncQueue.delete(job.id);
      break;
    }

    case 'fatal': {
      await failJob(job.id, errorMessage);
      break;
    }
  }
}

// ── processOnce ──────────────────────────────────────────────────────

/** Processes one batch of jobs. Returns when all claimed jobs settle. */
async function processOnce(): Promise<void> {
  // Skip if no authenticated user
  if (!auth.currentUser) {
    return;
  }

  setSyncProcessing();

  const jobs = await claimNextJobs(MAX_CONCURRENT);
  if (jobs.length === 0) {
    await updateSyncStatus();
    return;
  }

  // Filter out jobs whose entities are already in-flight (per-entity serialization)
  const entityKey = (job: SyncJob) => `${job.type}:${job.entityId}`;
  const eligibleJobs = jobs.filter((job) => !inFlightEntities.has(entityKey(job)));

  // Put back non-eligible jobs (reset to pending without incrementing retryCount)
  for (const job of jobs) {
    if (inFlightEntities.has(entityKey(job))) {
      await db.syncQueue.update(job.id, {
        status: 'pending',
        nextRetryAt: Date.now(),
      });
    }
  }

  // Mark entities as in-flight
  for (const job of eligibleJobs) {
    inFlightEntities.add(entityKey(job));
  }

  // Execute all eligible jobs concurrently
  const results = await Promise.allSettled(
    eligibleJobs.map(async (job) => {
      try {
        await executeJob(job);
        await completeJob(job.id);
      } catch (err) {
        await handleJobError(job, err);
      } finally {
        inFlightEntities.delete(`${job.type}:${job.entityId}`);
      }
    }),
  );

  // Log any unexpected settlement failures (Promise.allSettled rejections should be rare
  // since we catch inside the map, but guard against it)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[syncProcessor] Unexpected job settlement error:', result.reason);
    }
  }

  await updateSyncStatus();
}

// ── Sleep with wake support ──────────────────────────────────────────

/**
 * Sleeps for the given ms. Can be interrupted by wakeProcessor() or stopProcessor().
 * When interrupted, the sleep promise resolves immediately so the poll loop continues.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    sleepResolve = resolve;
    pollTimeout = setTimeout(() => {
      pollTimeout = null;
      sleepResolve = null;
      resolve();
    }, ms);
  });
}

/** Cancels any active sleep, causing the poll loop to resume immediately. */
function cancelSleep(): void {
  if (pollTimeout !== null) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  if (sleepResolve) {
    sleepResolve();
    sleepResolve = null;
  }
}

// ── pollLoop ─────────────────────────────────────────────────────────

/** Continuously processes jobs with adaptive scheduling until stopped. */
async function pollLoop(): Promise<void> {
  while (running) {
    try {
      await processOnce();

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

// ── startProcessor ───────────────────────────────────────────────────

/**
 * Starts the background sync processor.
 *
 * Uses Web Locks for multi-tab safety — only one tab runs the processor.
 * Accepts an injectable lockProvider for testing.
 * Falls back to no-lock if navigator.locks is unavailable.
 */
export function startProcessor(lockProvider?: LockProvider): void {
  if (running) return;
  running = true;

  // Add online/offline listeners
  onlineListener = () => wakeProcessor();
  offlineListener = () => {
    // On offline, we just let the poll loop naturally pause
    // (jobs will fail with network errors and get retried)
  };
  window.addEventListener('online', onlineListener);
  window.addEventListener('offline', offlineListener);

  const runLoop = async () => {
    await runStartupCleanup();
    await pollLoop();
  };

  // Try to acquire Web Lock for multi-tab safety
  const lock = lockProvider ?? getDefaultLockProvider();

  if (lock) {
    // The lock callback keeps the promise pending as long as we're running,
    // which holds the lock. When stopProcessor is called, the loop exits
    // and the lock is released.
    lock(WEB_LOCK_NAME, { mode: 'exclusive' }, async () => {
      await runLoop();
    }).catch((err: unknown) => {
      console.error('[syncProcessor] Web Lock error:', err);
    });
  } else {
    // No lock support — run directly
    runLoop().catch((err) => {
      console.error('[syncProcessor] Loop error:', err);
    });
  }
}

/** Returns the default Web Locks provider, or null if unavailable. */
function getDefaultLockProvider(): LockProvider | null {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return (name, options, callback) =>
      navigator.locks.request(name, options, callback as (lock: any) => Promise<any>);
  }
  return null;
}

// ── stopProcessor ────────────────────────────────────────────────────

/** Stops the background sync processor and cleans up all resources. */
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

// ── wakeProcessor ────────────────────────────────────────────────────

/**
 * Clears any scheduled poll timeout and triggers an immediate poll.
 * Used after auth recovery or coming back online.
 */
export function wakeProcessor(): void {
  if (!running) return;
  cancelSleep();
}
