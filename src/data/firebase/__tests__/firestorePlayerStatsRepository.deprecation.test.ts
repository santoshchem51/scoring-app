import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('firestorePlayerStatsRepository — deprecation markers', () => {
  const source = readFileSync(
    resolve(__dirname, '../firestorePlayerStatsRepository.ts'),
    'utf-8',
  );

  it('marks writePublicTier as @deprecated', () => {
    // The @deprecated JSDoc should appear before the writePublicTier function
    const match = source.match(/@deprecated[\s\S]*?function writePublicTier/);
    expect(match).not.toBeNull();
  });

  it('marks processMatchCompletion as @deprecated', () => {
    // The @deprecated JSDoc should appear before processMatchCompletion
    const match = source.match(/@deprecated[\s\S]{0,300}?processMatchCompletion/);
    expect(match).not.toBeNull();
  });

  it('marks updatePlayerStats as @deprecated', () => {
    // The @deprecated JSDoc should appear before updatePlayerStats
    const match = source.match(/@deprecated[\s\S]{0,300}?updatePlayerStats/);
    expect(match).not.toBeNull();
  });

  it('does NOT remove any existing code (functions still exist)', () => {
    expect(source).toContain('async function writePublicTier');
    expect(source).toContain('processMatchCompletion');
    expect(source).toContain('updatePlayerStats');
    expect(source).toContain('buildLeaderboardEntry');
  });
});
