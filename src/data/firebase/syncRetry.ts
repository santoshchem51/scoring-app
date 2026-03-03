import type { SyncJob } from './syncQueue.types';

// ── Retry policy types ────────────────────────────────────────────
export interface RetryPolicy {
  baseDelay: number;
  multiplier: number;
  maxDelay: number;
  maxRetries: number;
}

// ── Two-tier policies ─────────────────────────────────────────────
const SIMPLE_WRITE_POLICY: RetryPolicy = {
  baseDelay: 3_000,       // 3 seconds
  multiplier: 2,
  maxDelay: 300_000,      // 5 minutes
  maxRetries: 7,
};

const COMPLEX_OPS_POLICY: RetryPolicy = {
  baseDelay: 15_000,      // 15 seconds
  multiplier: 3,
  maxDelay: 1_800_000,    // 30 minutes
  maxRetries: 5,
};

const RATE_LIMIT_POLICY: RetryPolicy = {
  baseDelay: 60_000,      // 60 seconds
  multiplier: 2,
  maxDelay: 600_000,      // 10 minutes
  maxRetries: Infinity,   // rate-limit retries are not capped by this module
};

const POLICY_MAP: Record<SyncJob['type'], RetryPolicy> = {
  match: SIMPLE_WRITE_POLICY,
  tournament: SIMPLE_WRITE_POLICY,
  playerStats: COMPLEX_OPS_POLICY,
};

// ── Public API ────────────────────────────────────────────────────

/** Returns the retry policy for a given job type. */
export function getRetryPolicy(jobType: SyncJob['type']): RetryPolicy {
  return POLICY_MAP[jobType];
}

/**
 * Computes the next retry timestamp using exponential backoff with jitter.
 *
 * Formula:
 *   rawDelay   = baseDelay * multiplier^retryCount
 *   capped     = min(rawDelay, maxDelay)
 *   jittered   = Math.round(capped * (0.8 + Math.random() * 0.4))
 *   nextRetry  = now + jittered
 */
export function computeNextRetryAt(
  jobType: SyncJob['type'],
  retryCount: number,
  now: number = Date.now(),
): number {
  const policy = POLICY_MAP[jobType];
  return applyBackoff(policy, retryCount, now);
}

/** Computes the next retry timestamp for a rate-limited request. */
export function computeRateLimitRetryAt(
  retryCount: number,
  now: number = Date.now(),
): number {
  return applyBackoff(RATE_LIMIT_POLICY, retryCount, now);
}

/** Returns true when retryCount >= the policy's maxRetries. */
export function isMaxRetriesExceeded(
  jobType: SyncJob['type'],
  retryCount: number,
): boolean {
  return retryCount >= POLICY_MAP[jobType].maxRetries;
}

// ── Internal helper ───────────────────────────────────────────────

function applyBackoff(
  policy: RetryPolicy,
  retryCount: number,
  now: number,
): number {
  const rawDelay = policy.baseDelay * Math.pow(policy.multiplier, retryCount);
  const capped = Math.min(rawDelay, policy.maxDelay);
  const jitterFactor = 0.8 + Math.random() * 0.4;
  const jittered = Math.round(capped * jitterFactor);
  return now + jittered;
}
