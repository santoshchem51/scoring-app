import { describe, it, expect } from 'vitest';
import { validatePoolCompletion, validateBracketCompletion } from '../completionValidation';
import type { TournamentPool, BracketSlot } from '../../../../data/types';

describe('validatePoolCompletion', () => {
  it('returns valid when all schedule entries have matchId', () => {
    const pools: TournamentPool[] = [{
      id: 'p1', tournamentId: 't1', name: 'Pool A', teamIds: ['a', 'b'],
      schedule: [
        { round: 1, team1Id: 'a', team2Id: 'b', matchId: 'm1', court: null },
      ],
      standings: [],
    }];
    const result = validatePoolCompletion(pools);
    expect(result).toEqual({ valid: true, message: null });
  });

  it('returns invalid when schedule entries are missing matchId', () => {
    const pools: TournamentPool[] = [{
      id: 'p1', tournamentId: 't1', name: 'Pool A', teamIds: ['a', 'b', 'c'],
      schedule: [
        { round: 1, team1Id: 'a', team2Id: 'b', matchId: 'm1', court: null },
        { round: 1, team1Id: 'a', team2Id: 'c', matchId: null, court: null },
        { round: 2, team1Id: 'b', team2Id: 'c', matchId: null, court: null },
      ],
      standings: [],
    }];
    const result = validatePoolCompletion(pools);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('2');
    expect(result.message).toContain('Pool A');
  });

  it('validates across multiple pools', () => {
    const pools: TournamentPool[] = [
      {
        id: 'p1', tournamentId: 't1', name: 'Pool A', teamIds: ['a', 'b'],
        schedule: [{ round: 1, team1Id: 'a', team2Id: 'b', matchId: 'm1', court: null }],
        standings: [],
      },
      {
        id: 'p2', tournamentId: 't1', name: 'Pool B', teamIds: ['c', 'd'],
        schedule: [{ round: 1, team1Id: 'c', team2Id: 'd', matchId: null, court: null }],
        standings: [],
      },
    ];
    const result = validatePoolCompletion(pools);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Pool B');
  });

  it('returns valid for empty pools array', () => {
    const result = validatePoolCompletion([]);
    expect(result).toEqual({ valid: true, message: null });
  });
});

describe('validateBracketCompletion', () => {
  it('returns valid when the final slot has a winnerId', () => {
    const slots: BracketSlot[] = [
      { id: 's1', tournamentId: 't1', round: 1, position: 0, team1Id: 'a', team2Id: 'b', matchId: 'm1', winnerId: 'a', nextSlotId: 'final' },
      { id: 'final', tournamentId: 't1', round: 2, position: 0, team1Id: 'a', team2Id: 'c', matchId: 'm2', winnerId: 'a', nextSlotId: null },
    ];
    const result = validateBracketCompletion(slots);
    expect(result).toEqual({ valid: true, message: null, championId: 'a' });
  });

  it('returns invalid when the final slot has no winnerId', () => {
    const slots: BracketSlot[] = [
      { id: 's1', tournamentId: 't1', round: 1, position: 0, team1Id: 'a', team2Id: 'b', matchId: 'm1', winnerId: 'a', nextSlotId: 'final' },
      { id: 'final', tournamentId: 't1', round: 2, position: 0, team1Id: 'a', team2Id: null, matchId: null, winnerId: null, nextSlotId: null },
    ];
    const result = validateBracketCompletion(slots);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('final');
  });

  it('returns invalid for empty bracket', () => {
    const result = validateBracketCompletion([]);
    expect(result.valid).toBe(false);
  });

  it('identifies final as highest round slot', () => {
    const slots: BracketSlot[] = [
      { id: 'q1', tournamentId: 't1', round: 1, position: 0, team1Id: 'a', team2Id: 'b', matchId: 'm1', winnerId: 'a', nextSlotId: 's1' },
      { id: 'q2', tournamentId: 't1', round: 1, position: 1, team1Id: 'c', team2Id: 'd', matchId: 'm2', winnerId: 'c', nextSlotId: 's1' },
      { id: 's1', tournamentId: 't1', round: 2, position: 0, team1Id: 'a', team2Id: 'c', matchId: 'm3', winnerId: 'a', nextSlotId: 'f' },
      { id: 'q3', tournamentId: 't1', round: 1, position: 2, team1Id: 'e', team2Id: 'f', matchId: 'm4', winnerId: 'e', nextSlotId: 's2' },
      { id: 'q4', tournamentId: 't1', round: 1, position: 3, team1Id: 'g', team2Id: 'h', matchId: 'm5', winnerId: 'g', nextSlotId: 's2' },
      { id: 's2', tournamentId: 't1', round: 2, position: 1, team1Id: 'e', team2Id: 'g', matchId: 'm6', winnerId: 'e', nextSlotId: 'f' },
      { id: 'f', tournamentId: 't1', round: 3, position: 0, team1Id: 'a', team2Id: 'e', matchId: 'm7', winnerId: 'a', nextSlotId: null },
    ];
    const result = validateBracketCompletion(slots);
    expect(result).toEqual({ valid: true, message: null, championId: 'a' });
  });
});
