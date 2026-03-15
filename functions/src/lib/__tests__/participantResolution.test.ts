import { describe, it, expect } from 'vitest';
import { resolveParticipants } from '../participantResolution';
import type { CloudMatch } from '../../shared/types';

function makeMatch(overrides: Partial<CloudMatch> = {}): CloudMatch {
  return {
    id: 'match-1',
    config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
    team1PlayerIds: [], team2PlayerIds: [],
    team1Name: 'Team A', team2Name: 'Team B',
    games: [{ gameNumber: 1, team1Score: 11, team2Score: 5, winningSide: 1 }],
    winningSide: 1, status: 'completed',
    startedAt: 1000, completedAt: 2000,
    ownerId: 'owner-1', sharedWith: [], visibility: 'private', syncedAt: 3000,
    ...overrides,
  };
}

describe('resolveParticipants', () => {
  it('returns empty for null winningSide (abandoned match)', () => {
    const match = makeMatch({ winningSide: null });
    const result = resolveParticipants(match, []);
    expect(result).toEqual([]);
  });

  it('resolves tournament participants from registrations', () => {
    const match = makeMatch({
      tournamentId: 't1',
      tournamentTeam1Id: 'team-a',
      tournamentTeam2Id: 'team-b',
      winningSide: 1,
    });
    const registrations = [
      { id: 'r1', userId: 'user-1', teamId: 'team-a' },
      { id: 'r2', userId: 'user-2', teamId: 'team-b' },
    ];
    const result = resolveParticipants(match, registrations);
    expect(result).toEqual([
      { uid: 'user-1', playerTeam: 1, result: 'win' },
      { uid: 'user-2', playerTeam: 2, result: 'loss' },
    ]);
  });

  it('resolves doubles tournament participants', () => {
    const match = makeMatch({
      config: { gameType: 'doubles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11 },
      tournamentId: 't1',
      tournamentTeam1Id: 'team-a',
      tournamentTeam2Id: 'team-b',
      winningSide: 2,
    });
    const registrations = [
      { id: 'r1', userId: 'user-1', teamId: 'team-a' },
      { id: 'r2', userId: 'user-2', teamId: 'team-a' },
      { id: 'r3', userId: 'user-3', teamId: 'team-b' },
      { id: 'r4', userId: 'user-4', teamId: 'team-b' },
    ];
    const result = resolveParticipants(match, registrations);
    expect(result).toHaveLength(4);
    expect(result.filter(p => p.result === 'win')).toHaveLength(2);
    expect(result.filter(p => p.result === 'loss')).toHaveLength(2);
  });

  it('resolves casual (non-tournament) match participants from player IDs', () => {
    const match = makeMatch({
      team1PlayerIds: ['uid1'],
      team2PlayerIds: ['uid2'],
      winningSide: 1,
      tournamentId: undefined,
    });
    const result = resolveParticipants(match, []);
    expect(result).toEqual([
      { uid: 'uid1', playerTeam: 1, result: 'win' },
      { uid: 'uid2', playerTeam: 2, result: 'loss' },
    ]);
  });

  it('deduplicates UIDs (first occurrence wins)', () => {
    const match = makeMatch({
      tournamentId: 't1',
      tournamentTeam1Id: 'team-a',
      tournamentTeam2Id: 'team-b',
      winningSide: 1,
    });
    const registrations = [
      { id: 'r1', userId: 'user-1', teamId: 'team-a' },
      { id: 'r2', userId: 'user-1', teamId: 'team-b' },
    ];
    const result = resolveParticipants(match, registrations);
    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe('user-1');
  });
});
