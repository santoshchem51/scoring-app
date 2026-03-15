import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('firestore.rules — cross-user write path lockdown', () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf-8');

  it('denies client writes to /users/{userId}/stats/{docId}', () => {
    // Extract the stats section
    const statsSection = rules.match(
      /match\s+\/users\/\{userId\}\/stats\/\{docId\}[\s\S]*?(?=\n\s*\/\/\s*──|\n\s*match\s+\/)/,
    );
    expect(statsSection).not.toBeNull();
    const section = statsSection![0];
    // Should have write: if false (or create, update: if false)
    expect(section).toMatch(/allow\s+(write|create,\s*update):\s*if\s+false/);
    // Should contain Admin SDK comment
    expect(section).toContain('Cloud Function only');
  });

  it('denies client writes to /leaderboard/{uid}', () => {
    const leaderboardSection = rules.match(
      /match\s+\/leaderboard\/\{uid\}[\s\S]*?(?=\n\s*\/\/\s*──|\n\s*match\s+\/)/,
    );
    expect(leaderboardSection).not.toBeNull();
    const section = leaderboardSection![0];
    // Create and update should be denied
    expect(section).toMatch(/allow\s+create,\s*update:\s*if\s+false/);
    expect(section).toContain('Cloud Function only');
  });

  it('denies client writes to /users/{userId}/matchRefs/{refId}', () => {
    const matchRefsSection = rules.match(
      /match\s+\/users\/\{userId\}\/matchRefs\/\{refId\}[\s\S]*?(?=\n\s*\/\/\s*──|\n\s*match\s+\/)/,
    );
    expect(matchRefsSection).not.toBeNull();
    const section = matchRefsSection![0];
    // Create should be denied
    expect(section).toMatch(/allow\s+create:\s*if\s+false/);
    expect(section).toContain('Cloud Function only');
  });

  it('denies client writes to /users/{userId}/public/{docId}', () => {
    const publicSection = rules.match(
      /match\s+\/users\/\{userId\}\/public\/\{docId\}[\s\S]*?(?=\n\s*\/\/\s*──|\n\s*match\s+\/)/,
    );
    expect(publicSection).not.toBeNull();
    const section = publicSection![0];
    // Create/update should be denied
    expect(section).toMatch(/allow\s+(write|create,\s*update):\s*if\s+false/);
    expect(section).toContain('Cloud Function only');
  });

  it('preserves read rules for stats', () => {
    const statsSection = rules.match(
      /match\s+\/users\/\{userId\}\/stats\/\{docId\}[\s\S]*?(?=\n\s*\/\/\s*──|\n\s*match\s+\/)/,
    );
    expect(statsSection).not.toBeNull();
    expect(statsSection![0]).toMatch(/allow\s+read:\s*if\s+request\.auth\s*!=\s*null/);
  });

  it('preserves read rules for leaderboard', () => {
    const leaderboardSection = rules.match(
      /match\s+\/leaderboard\/\{uid\}[\s\S]*?(?=\n\s*\/\/\s*──|\n\s*match\s+\/)/,
    );
    expect(leaderboardSection).not.toBeNull();
    expect(leaderboardSection![0]).toMatch(/allow\s+read:\s*if\s+request\.auth\s*!=\s*null/);
  });

  it('preserves read rules for matchRefs', () => {
    const matchRefsSection = rules.match(
      /match\s+\/users\/\{userId\}\/matchRefs\/\{refId\}[\s\S]*?(?=\n\s*\/\/\s*──|\n\s*match\s+\/)/,
    );
    expect(matchRefsSection).not.toBeNull();
    expect(matchRefsSection![0]).toMatch(
      /allow\s+read:\s*if\s+request\.auth\s*!=\s*null\s*&&\s*request\.auth\.uid\s*==\s*userId/,
    );
  });

  it('preserves read rules for public tier', () => {
    const publicSection = rules.match(
      /match\s+\/users\/\{userId\}\/public\/\{docId\}[\s\S]*?(?=\n\s*\/\/\s*──|\n\s*match\s+\/)/,
    );
    expect(publicSection).not.toBeNull();
    const section = publicSection![0];
    // Both public and authenticated reads should still exist
    expect(section).toMatch(/allow\s+read:\s*if\s+resource\.data\.profileVisibility/);
    expect(section).toMatch(/allow\s+read:\s*if\s+request\.auth\s*!=\s*null/);
  });
});
