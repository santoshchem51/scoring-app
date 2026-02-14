import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { matchRepository } from '../matchRepository';
import { db } from '../../db';
import type { Match, MatchConfig } from '../../types';

const testConfig: MatchConfig = {
  gameType: 'singles',
  scoringMode: 'rally',
  matchFormat: 'single',
  pointsToWin: 11,
};

function createTestMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: crypto.randomUUID(),
    config: testConfig,
    team1PlayerIds: [],
    team2PlayerIds: [],
    team1Name: 'Team 1',
    team2Name: 'Team 2',
    games: [],
    winningSide: null,
    status: 'in-progress',
    startedAt: Date.now(),
    completedAt: null,
    ...overrides,
  };
}

describe('matchRepository', () => {
  beforeEach(async () => {
    await db.matches.clear();
  });

  it('saves and retrieves a match by id', async () => {
    const match = createTestMatch();
    await matchRepository.save(match);
    const result = await matchRepository.getById(match.id);
    expect(result).toEqual(match);
  });

  it('returns undefined for non-existent match', async () => {
    const result = await matchRepository.getById('non-existent');
    expect(result).toBeUndefined();
  });

  it('lists all matches ordered by startedAt descending', async () => {
    const older = createTestMatch({ startedAt: 1000 });
    const newer = createTestMatch({ startedAt: 2000 });
    await matchRepository.save(older);
    await matchRepository.save(newer);

    const all = await matchRepository.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].startedAt).toBe(2000);
    expect(all[1].startedAt).toBe(1000);
  });

  it('lists completed matches only', async () => {
    const inProgress = createTestMatch({ status: 'in-progress' });
    const completed = createTestMatch({ status: 'completed' });
    await matchRepository.save(inProgress);
    await matchRepository.save(completed);

    const result = await matchRepository.getCompleted();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(completed.id);
  });

  it('deletes a match', async () => {
    const match = createTestMatch();
    await matchRepository.save(match);
    await matchRepository.delete(match.id);
    const result = await matchRepository.getById(match.id);
    expect(result).toBeUndefined();
  });
});
