import { describe, it, expect } from 'vitest';
import { classifyError } from '../syncErrors';
import type { ErrorCategory } from '../syncErrors';
import type { SyncJob } from '../syncQueue.types';

/** Helper to create a Firestore-style error with a `.code` property. */
function firestoreError(code: string): { code: string; message: string } {
  return { code, message: `FirebaseError: ${code}` };
}

/** Helper job type shorthand. */
type JobType = SyncJob['type'];

describe('classifyError', () => {
  describe('retryable errors', () => {
    const retryableCodes = [
      'unavailable',
      'deadline-exceeded',
      'internal',
      'cancelled',
      'aborted',
    ];

    it.each(retryableCodes)('classifies "%s" as retryable', (code) => {
      const result = classifyError(firestoreError(code), 'match');
      expect(result).toBe('retryable' satisfies ErrorCategory);
    });
  });

  describe('rate-limited errors', () => {
    it('classifies "resource-exhausted" as rate-limited', () => {
      const result = classifyError(firestoreError('resource-exhausted'), 'tournament');
      expect(result).toBe('rate-limited' satisfies ErrorCategory);
    });
  });

  describe('auth-dependent errors', () => {
    it('classifies "unauthenticated" as auth-dependent', () => {
      const result = classifyError(firestoreError('unauthenticated'), 'match');
      expect(result).toBe('auth-dependent' satisfies ErrorCategory);
    });

    it('classifies "permission-denied" as auth-dependent when hasValidFreshToken is false', () => {
      const result = classifyError(
        firestoreError('permission-denied'),
        'tournament',
        false,
      );
      expect(result).toBe('auth-dependent' satisfies ErrorCategory);
    });

    it('classifies "permission-denied" as auth-dependent by default (no token arg)', () => {
      const result = classifyError(firestoreError('permission-denied'), 'match');
      expect(result).toBe('auth-dependent' satisfies ErrorCategory);
    });
  });

  describe('fatal errors', () => {
    const fatalCodes = [
      'invalid-argument',
      'already-exists',
      'data-loss',
      'out-of-range',
      'unimplemented',
    ];

    it.each(fatalCodes)('classifies "%s" as fatal', (code) => {
      const result = classifyError(firestoreError(code), 'match');
      expect(result).toBe('fatal' satisfies ErrorCategory);
    });

    it('classifies "permission-denied" as fatal when hasValidFreshToken is true', () => {
      const result = classifyError(
        firestoreError('permission-denied'),
        'tournament',
        true,
      );
      expect(result).toBe('fatal' satisfies ErrorCategory);
    });
  });

  describe('not-found special cases', () => {
    it('classifies "not-found" on playerStats as staleJob', () => {
      const result = classifyError(firestoreError('not-found'), 'playerStats');
      expect(result).toBe('staleJob' satisfies ErrorCategory);
    });

    it('classifies "not-found" on match as fatal', () => {
      const result = classifyError(firestoreError('not-found'), 'match');
      expect(result).toBe('fatal' satisfies ErrorCategory);
    });

    it('classifies "not-found" on tournament as fatal', () => {
      const result = classifyError(firestoreError('not-found'), 'tournament');
      expect(result).toBe('fatal' satisfies ErrorCategory);
    });
  });

  describe('failed-precondition special cases', () => {
    it('classifies "failed-precondition" on playerStats as retryable', () => {
      const result = classifyError(firestoreError('failed-precondition'), 'playerStats');
      expect(result).toBe('retryable' satisfies ErrorCategory);
    });

    it('classifies "failed-precondition" on match as fatal', () => {
      const result = classifyError(firestoreError('failed-precondition'), 'match');
      expect(result).toBe('fatal' satisfies ErrorCategory);
    });

    it('classifies "failed-precondition" on tournament as fatal', () => {
      const result = classifyError(firestoreError('failed-precondition'), 'tournament');
      expect(result).toBe('fatal' satisfies ErrorCategory);
    });
  });

  describe('non-Firestore errors', () => {
    it('classifies TypeError with "fetch" in message as retryable', () => {
      const result = classifyError(new TypeError('Failed to fetch'), 'match');
      expect(result).toBe('retryable' satisfies ErrorCategory);
    });

    it('classifies TypeError with "network" in message as retryable', () => {
      const result = classifyError(
        new TypeError('A network error occurred'),
        'tournament',
      );
      expect(result).toBe('retryable' satisfies ErrorCategory);
    });

    it('classifies TypeError with "Network" (case-insensitive) as retryable', () => {
      const result = classifyError(
        new TypeError('Network request failed'),
        'playerStats',
      );
      expect(result).toBe('retryable' satisfies ErrorCategory);
    });

    it('classifies TypeError with "Fetch" (case-insensitive) as retryable', () => {
      const result = classifyError(
        new TypeError('Fetch operation timed out'),
        'match',
      );
      expect(result).toBe('retryable' satisfies ErrorCategory);
    });

    it('classifies TypeError without fetch/network as fatal', () => {
      const result = classifyError(
        new TypeError('Cannot read properties of undefined'),
        'match',
      );
      expect(result).toBe('fatal' satisfies ErrorCategory);
    });
  });

  describe('unknown error shapes', () => {
    it('classifies a plain string as fatal', () => {
      const result = classifyError('something went wrong', 'match');
      expect(result).toBe('fatal' satisfies ErrorCategory);
    });

    it('classifies null as fatal', () => {
      const result = classifyError(null, 'tournament');
      expect(result).toBe('fatal' satisfies ErrorCategory);
    });

    it('classifies undefined as fatal', () => {
      const result = classifyError(undefined, 'playerStats');
      expect(result).toBe('fatal' satisfies ErrorCategory);
    });

    it('classifies an object without .code as fatal', () => {
      const result = classifyError({ message: 'oops' }, 'match');
      expect(result).toBe('fatal' satisfies ErrorCategory);
    });

    it('classifies an unknown Firestore code as fatal', () => {
      const result = classifyError(firestoreError('some-unknown-code'), 'match');
      expect(result).toBe('fatal' satisfies ErrorCategory);
    });
  });
});
