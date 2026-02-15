import { describe, it, expect } from 'vitest';
import { advanceBracketWinner } from '../bracketAdvancement';
import type { BracketSlot } from '../../../../data/types';

function slot(overrides: Partial<BracketSlot>): BracketSlot {
  return {
    id: 'slot-1',
    tournamentId: 't1',
    round: 1,
    position: 0,
    team1Id: null,
    team2Id: null,
    matchId: null,
    winnerId: null,
    nextSlotId: null,
    ...overrides,
  };
}

describe('advanceBracketWinner', () => {
  it('returns null when current slot has no nextSlotId (finals)', () => {
    const current = slot({ id: 'final', nextSlotId: null });
    const all = [current];
    const result = advanceBracketWinner(current, 'team-a', all);
    expect(result).toBeNull();
  });

  it('places winner in team1Id when current slot has even position', () => {
    const semi1 = slot({ id: 'semi1', position: 0, nextSlotId: 'final' });
    const semi2 = slot({ id: 'semi2', position: 1, nextSlotId: 'final' });
    const final = slot({ id: 'final', round: 2, position: 0 });
    const all = [semi1, semi2, final];

    const result = advanceBracketWinner(semi1, 'team-a', all);
    expect(result).toEqual({ slotId: 'final', field: 'team1Id', teamId: 'team-a' });
  });

  it('places winner in team2Id when current slot has odd position', () => {
    const semi1 = slot({ id: 'semi1', position: 0, nextSlotId: 'final' });
    const semi2 = slot({ id: 'semi2', position: 1, nextSlotId: 'final' });
    const final = slot({ id: 'final', round: 2, position: 0 });
    const all = [semi1, semi2, final];

    const result = advanceBracketWinner(semi2, 'team-b', all);
    expect(result).toEqual({ slotId: 'final', field: 'team2Id', teamId: 'team-b' });
  });

  it('returns null when next slot is not found in slots array', () => {
    const current = slot({ id: 's1', nextSlotId: 'missing' });
    const result = advanceBracketWinner(current, 'team-a', [current]);
    expect(result).toBeNull();
  });
});
