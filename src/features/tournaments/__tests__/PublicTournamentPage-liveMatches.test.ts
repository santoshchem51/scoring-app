import { describe, it, expect } from 'vitest';
import { getInProgressMatches } from '../engine/matchFiltering';
import type { BracketSlot } from '../../../data/types';

describe('PublicTournamentPage live match merging', () => {
  it('bracket matches are still included even with query-based pool filtering', () => {
    // The new approach: pool matches come from useTournamentLiveMatches query.
    // Bracket matches still come from getInProgressMatches (bracket slots with matchId, no winnerId).
    // This test validates that bracket match extraction still works.
    const bracket: BracketSlot[] = [
      {
        id: 'slot-1', tournamentId: 't1', round: 1, position: 1,
        team1Id: 'a', team2Id: 'b', matchId: 'match-1', winnerId: null, nextSlotId: null,
      },
      {
        id: 'slot-2', tournamentId: 't1', round: 1, position: 2,
        team1Id: 'c', team2Id: 'd', matchId: 'match-2', winnerId: 'c', nextSlotId: null,
      },
    ];
    const result = getInProgressMatches([], bracket);
    expect(result.bracketMatches).toHaveLength(1);
    expect(result.bracketMatches[0].matchId).toBe('match-1');
  });
});
