import { describe, it, expect, vi } from 'vitest';

// Mock Firebase modules before importing
vi.mock('../config', () => ({ firestore: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
}));

import { buildSpectatorProjection } from '../firestoreSpectatorRepository';

describe('buildSpectatorProjection', () => {
  it('does NOT include tournamentShareCode in projection', () => {
    const result = buildSpectatorProjection(
      {
        id: 'm1', status: 'in-progress', tournamentId: 't1',
        team1Name: 'Sarah M.', team2Name: 'Mike T.',
        games: [], lastSnapshot: JSON.stringify({ team1Score: 5, team2Score: 3, gameNumber: 2 }),
        config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'best-of-3', pointsToWin: 11 },
        team1PlayerIds: ['uid1'], team2PlayerIds: ['uid2'],
        winningSide: null, startedAt: Date.now(), completedAt: null,
      },
      { publicTeam1Name: 'Sarah M.', publicTeam2Name: 'Player B' },
    );
    expect(result).not.toHaveProperty('tournamentShareCode');
  });

  it('includes all required fields in projection', () => {
    const result = buildSpectatorProjection(
      {
        id: 'm1', status: 'in-progress', tournamentId: 't1',
        team1Name: 'Sarah M.', team2Name: 'Mike T.',
        games: [], lastSnapshot: JSON.stringify({ team1Score: 5, team2Score: 3, gameNumber: 2 }),
        config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'best-of-3', pointsToWin: 11 },
        team1PlayerIds: ['uid1'], team2PlayerIds: ['uid2'],
        winningSide: null, startedAt: Date.now(), completedAt: null,
      },
      { publicTeam1Name: 'Sarah M.', publicTeam2Name: 'Player B' },
    );
    expect(result.publicTeam1Name).toBe('Sarah M.');
    expect(result.publicTeam2Name).toBe('Player B');
    expect(result.team1Score).toBe(5);
    expect(result.team2Score).toBe(3);
    expect(result.gameNumber).toBe(2);
    expect(result.visibility).toBe('public');
    expect(result.spectatorCount).toBe(0);
    expect(result.status).toBe('in-progress');
    expect(result.tournamentId).toBe('t1');
    expect(typeof result.updatedAt).toBe('number');
    expect(typeof result.team1Wins).toBe('number');
    expect(typeof result.team2Wins).toBe('number');
    // Must NOT contain sensitive fields
    expect(result).not.toHaveProperty('team1PlayerIds');
    expect(result).not.toHaveProperty('team2PlayerIds');
    expect(result).not.toHaveProperty('ownerUid');
    expect(result).not.toHaveProperty('sharedWith');
    expect(result).not.toHaveProperty('team1Name');
    expect(result).not.toHaveProperty('team2Name');
  });

  it('uses fallback scores when no lastSnapshot', () => {
    const result = buildSpectatorProjection(
      {
        id: 'm2', status: 'in-progress', tournamentId: 't1',
        team1Name: 'A', team2Name: 'B',
        games: [{ gameNumber: 1, team1Score: 11, team2Score: 7, winningSide: 1 }],
        config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'best-of-3', pointsToWin: 11 },
        team1PlayerIds: [], team2PlayerIds: [],
        winningSide: null, startedAt: Date.now(), completedAt: null,
      },
      { publicTeam1Name: 'Team A', publicTeam2Name: 'Team B' },
    );
    expect(result.team1Score).toBe(11);
    expect(result.team2Score).toBe(7);
    expect(result.team1Wins).toBe(1);
    expect(result.team2Wins).toBe(0);
  });

  it('defaults gameNumber to 1 when no snapshot and no games', () => {
    const result = buildSpectatorProjection(
      {
        id: 'm3', status: 'in-progress', tournamentId: 't1',
        team1Name: 'A', team2Name: 'B', games: [],
        config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'best-of-3', pointsToWin: 11 },
        team1PlayerIds: [], team2PlayerIds: [],
        winningSide: null, startedAt: Date.now(), completedAt: null,
      },
      { publicTeam1Name: 'A', publicTeam2Name: 'B' },
    );
    expect(result.gameNumber).toBe(1);
    expect(result.team1Score).toBe(0);
    expect(result.team2Score).toBe(0);
  });
});
