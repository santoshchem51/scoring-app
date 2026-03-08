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

/**
 * Returns true if the error has a string `.code` property (Firestore-style error).
 */
function hasFirestoreCode(err: unknown): err is { code: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  );
}

/**
 * Classifies a sync error into one of 5 categories that determine
 * how the sync queue processor should handle the failed job.
 *
 * - `retryable`: Transient errors — use exponential backoff
 * - `rate-limited`: Firestore quota exceeded — use longer backoff
 * - `auth-dependent`: Token expired or permissions issue — pause until re-auth
 * - `fatal`: Unrecoverable — delete/fail the job
 * - `staleJob`: Entity was deleted — silently remove the job
 */
export function classifyError(
  err: unknown,
  jobType: SyncJob['type'],
  hasValidFreshToken: boolean = false,
): ErrorCategory {
  // --- Firestore errors (have a `.code` property) ---
  if (hasFirestoreCode(err)) {
    const { code } = err;

    if (RETRYABLE_CODES.has(code)) {
      return 'retryable';
    }

    if (code === 'resource-exhausted') {
      return 'rate-limited';
    }

    if (code === 'unauthenticated') {
      return 'auth-dependent';
    }

    if (code === 'permission-denied') {
      return hasValidFreshToken ? 'fatal' : 'auth-dependent';
    }

    // not-found: playerStats means tournament was deleted (stale job),
    // match/tournament means the doc itself is missing (fatal).
    if (code === 'not-found') {
      return jobType === 'playerStats' ? 'staleJob' : 'fatal';
    }

    // failed-precondition: conditions not met (e.g., document must exist).
    // NOT transaction contention — that throws 'aborted' (already in RETRYABLE_CODES).
    if (code === 'failed-precondition') {
      return 'fatal';
    }

    if (FATAL_CODES.has(code)) {
      return 'fatal';
    }

    // Unknown Firestore code — treat as fatal (don't retry unknown problems).
    return 'fatal';
  }

  // --- Non-Firestore errors ---

  // Network/fetch failures are retryable.
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase();
    if (msg.includes('fetch') || msg.includes('network')) {
      return 'retryable';
    }
    return 'fatal';
  }

  // Completely unknown error shape — fatal.
  return 'fatal';
}
