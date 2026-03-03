import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getRetryPolicy,
  computeNextRetryAt,
  computeRateLimitRetryAt,
  isMaxRetriesExceeded,
} from '../syncRetry';

describe('syncRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── getRetryPolicy ──────────────────────────────────────────────
  describe('getRetryPolicy', () => {
    it('returns simple-write policy for match jobs', () => {
      const policy = getRetryPolicy('match');
      expect(policy).toEqual({
        baseDelay: 3_000,
        multiplier: 2,
        maxDelay: 300_000,
        maxRetries: 7,
      });
    });

    it('returns simple-write policy for tournament jobs', () => {
      const policy = getRetryPolicy('tournament');
      expect(policy).toEqual({
        baseDelay: 3_000,
        multiplier: 2,
        maxDelay: 300_000,
        maxRetries: 7,
      });
    });

    it('returns complex-ops policy for playerStats jobs', () => {
      const policy = getRetryPolicy('playerStats');
      expect(policy).toEqual({
        baseDelay: 15_000,
        multiplier: 3,
        maxDelay: 1_800_000,
        maxRetries: 5,
      });
    });
  });

  // ── computeNextRetryAt ──────────────────────────────────────────
  describe('computeNextRetryAt', () => {
    it('returns now + baseDelay (with jitter) at retry 0 for match', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const now = 1_000_000;
      const result = computeNextRetryAt('match', 0, now);
      // baseDelay=3000, multiplier^0=1, raw=3000
      // jitter factor = 0.8 + 0.5*0.4 = 1.0 → delay = 3000
      expect(result).toBe(now + 3_000);
    });

    it('doubles delay at retry 1 for match (simple-write)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const now = 1_000_000;
      const result = computeNextRetryAt('match', 1, now);
      // baseDelay=3000, multiplier^1=2, raw=6000
      // jitter factor = 1.0 → delay = 6000
      expect(result).toBe(now + 6_000);
    });

    it('triples delay at retry 1 for playerStats (complex-ops)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const now = 1_000_000;
      const result = computeNextRetryAt('playerStats', 1, now);
      // baseDelay=15000, multiplier^1=3, raw=45000
      // jitter factor = 1.0 → delay = 45000
      expect(result).toBe(now + 45_000);
    });

    it('caps delay at maxDelay for high retry counts (match)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const now = 1_000_000;
      // retry 20 → 3000 * 2^20 = 3,145,728,000 — way over maxDelay
      const result = computeNextRetryAt('match', 20, now);
      // capped at 300,000, jitter factor 1.0 → 300,000
      expect(result).toBe(now + 300_000);
    });

    it('caps delay at maxDelay for high retry counts (playerStats)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const now = 1_000_000;
      // retry 10 → 15000 * 3^10 = 885,735,000 — way over maxDelay
      const result = computeNextRetryAt('playerStats', 10, now);
      // capped at 1,800,000, jitter factor 1.0 → 1,800,000
      expect(result).toBe(now + 1_800_000);
    });

    it('applies -20% jitter when Math.random returns 0', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const now = 1_000_000;
      const result = computeNextRetryAt('match', 0, now);
      // baseDelay=3000, jitter factor = 0.8 + 0*0.4 = 0.8
      // delay = Math.round(3000 * 0.8) = 2400
      expect(result).toBe(now + 2_400);
    });

    it('applies +20% jitter when Math.random returns 1', () => {
      vi.spyOn(Math, 'random').mockReturnValue(1);
      const now = 1_000_000;
      const result = computeNextRetryAt('match', 0, now);
      // baseDelay=3000, jitter factor = 0.8 + 1*0.4 = 1.2
      // delay = Math.round(3000 * 1.2) = 3600
      expect(result).toBe(now + 3_600);
    });

    it('defaults now to Date.now() when not provided', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const before = Date.now();
      const result = computeNextRetryAt('match', 0);
      const after = Date.now();
      // jitter factor = 1.0, delay = 3000
      expect(result).toBeGreaterThanOrEqual(before + 3_000);
      expect(result).toBeLessThanOrEqual(after + 3_000);
    });
  });

  // ── computeRateLimitRetryAt ─────────────────────────────────────
  describe('computeRateLimitRetryAt', () => {
    it('uses 60s base delay at retry 0', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const now = 1_000_000;
      const result = computeRateLimitRetryAt(0, now);
      // base=60000, 2^0=1, raw=60000, jitter 1.0 → 60000
      expect(result).toBe(now + 60_000);
    });

    it('doubles delay at retry 1', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const now = 1_000_000;
      const result = computeRateLimitRetryAt(1, now);
      // base=60000, 2^1=2, raw=120000, jitter 1.0 → 120000
      expect(result).toBe(now + 120_000);
    });

    it('caps at 10 minutes for high retry counts', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const now = 1_000_000;
      // retry 10 → 60000 * 2^10 = 61,440,000 — over 600,000 cap
      const result = computeRateLimitRetryAt(10, now);
      expect(result).toBe(now + 600_000);
    });

    it('applies jitter with ±20% range', () => {
      const now = 1_000_000;

      vi.spyOn(Math, 'random').mockReturnValue(0);
      const low = computeRateLimitRetryAt(0, now);
      // jitter factor 0.8 → Math.round(60000 * 0.8) = 48000
      expect(low).toBe(now + 48_000);

      vi.spyOn(Math, 'random').mockReturnValue(1);
      const high = computeRateLimitRetryAt(0, now);
      // jitter factor 1.2 → Math.round(60000 * 1.2) = 72000
      expect(high).toBe(now + 72_000);
    });
  });

  // ── isMaxRetriesExceeded ────────────────────────────────────────
  describe('isMaxRetriesExceeded', () => {
    it('returns false when retryCount is below max for match', () => {
      expect(isMaxRetriesExceeded('match', 6)).toBe(false);
    });

    it('returns true when retryCount equals maxRetries for match', () => {
      expect(isMaxRetriesExceeded('match', 7)).toBe(true);
    });

    it('returns true when retryCount exceeds maxRetries for match', () => {
      expect(isMaxRetriesExceeded('match', 10)).toBe(true);
    });

    it('returns false when retryCount is below max for playerStats', () => {
      expect(isMaxRetriesExceeded('playerStats', 4)).toBe(false);
    });

    it('returns true when retryCount equals maxRetries for playerStats', () => {
      expect(isMaxRetriesExceeded('playerStats', 5)).toBe(true);
    });

    it('returns true when retryCount exceeds maxRetries for tournament', () => {
      expect(isMaxRetriesExceeded('tournament', 8)).toBe(true);
    });
  });
});
