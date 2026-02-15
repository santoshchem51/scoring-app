import { describe, it, expect } from 'vitest';
import { autoPairByRating } from '../autoPair';

describe('autoPairByRating', () => {
  it('pairs players by closest skill rating', () => {
    const players = [
      { userId: 'p1', skillRating: 4.0 },
      { userId: 'p2', skillRating: 4.0 },
      { userId: 'p3', skillRating: 3.0 },
      { userId: 'p4', skillRating: 3.0 },
    ];
    const pairs = autoPairByRating(players);

    expect(pairs).toHaveLength(2);
    const pair1Ids = [pairs[0][0].userId, pairs[0][1].userId].sort();
    const pair2Ids = [pairs[1][0].userId, pairs[1][1].userId].sort();
    expect(pair1Ids).toEqual(['p1', 'p2']);
    expect(pair2Ids).toEqual(['p3', 'p4']);
  });

  it('uses default rating 3.0 for null ratings', () => {
    const players = [
      { userId: 'p1', skillRating: null },
      { userId: 'p2', skillRating: 3.0 },
      { userId: 'p3', skillRating: 4.5 },
      { userId: 'p4', skillRating: 4.5 },
    ];
    const pairs = autoPairByRating(players);

    expect(pairs).toHaveLength(2);
    const pair1Players = pairs[0].map((p) => p.userId).sort();
    const pair2Players = pairs[1].map((p) => p.userId).sort();
    expect([pair1Players, pair2Players].sort()).toEqual([['p1', 'p2'], ['p3', 'p4']]);
  });

  it('returns empty array for empty input', () => {
    const pairs = autoPairByRating([]);
    expect(pairs).toEqual([]);
  });

  it('returns empty array for single player (cannot pair)', () => {
    const pairs = autoPairByRating([{ userId: 'p1', skillRating: 3.0 }]);
    expect(pairs).toEqual([]);
  });

  it('handles odd number of players by leaving last unpaired', () => {
    const players = [
      { userId: 'p1', skillRating: 4.0 },
      { userId: 'p2', skillRating: 4.0 },
      { userId: 'p3', skillRating: 3.0 },
    ];
    const result = autoPairByRating(players);
    expect(result).toHaveLength(1);
  });

  it('sorts pairs by average team rating descending (best team first)', () => {
    const players = [
      { userId: 'p1', skillRating: 3.0 },
      { userId: 'p2', skillRating: 3.0 },
      { userId: 'p3', skillRating: 5.0 },
      { userId: 'p4', skillRating: 5.0 },
    ];
    const pairs = autoPairByRating(players);
    const firstPairIds = pairs[0].map((p) => p.userId).sort();
    expect(firstPairIds).toEqual(['p3', 'p4']);
  });
});
