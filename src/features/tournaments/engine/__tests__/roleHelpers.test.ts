import { describe, it, expect } from 'vitest';
import { getTournamentRole, hasMinRole } from '../roleHelpers';
import type { Tournament } from '../../../../data/types';

const makeTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  name: 'Test',
  date: Date.now(),
  location: '',
  format: 'single-elimination',
  config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 1, teamsPerPoolAdvancing: 2 },
  organizerId: 'owner-1',
  staff: { 'admin-1': 'admin', 'mod-1': 'moderator', 'sk-1': 'scorekeeper' },
  staffUids: ['admin-1', 'mod-1', 'sk-1'],
  status: 'registration',
  maxPlayers: null,
  teamFormation: null,
  minPlayers: null,
  entryFee: null,
  rules: { registrationDeadline: null, checkInRequired: false, checkInOpens: null, checkInCloses: null, scoringRules: '', timeoutRules: '', conductRules: '', penalties: [], additionalNotes: '' },
  pausedFrom: null,
  cancellationReason: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  visibility: 'private',
  shareCode: null,
  accessMode: 'open',
  listed: true,
  buddyGroupId: null,
  buddyGroupName: null,
  registrationCounts: { confirmed: 0, pending: 0 },
  ...overrides,
});

describe('getTournamentRole', () => {
  it('returns owner for organizerId match', () => {
    expect(getTournamentRole(makeTournament(), 'owner-1')).toBe('owner');
  });

  it('returns admin for staff admin', () => {
    expect(getTournamentRole(makeTournament(), 'admin-1')).toBe('admin');
  });

  it('returns moderator for staff moderator', () => {
    expect(getTournamentRole(makeTournament(), 'mod-1')).toBe('moderator');
  });

  it('returns scorekeeper for staff scorekeeper', () => {
    expect(getTournamentRole(makeTournament(), 'sk-1')).toBe('scorekeeper');
  });

  it('returns null for unknown user', () => {
    expect(getTournamentRole(makeTournament(), 'random')).toBeNull();
  });
});

describe('hasMinRole', () => {
  it('owner has all roles', () => {
    expect(hasMinRole(makeTournament(), 'owner-1', 'scorekeeper')).toBe(true);
    expect(hasMinRole(makeTournament(), 'owner-1', 'moderator')).toBe(true);
    expect(hasMinRole(makeTournament(), 'owner-1', 'admin')).toBe(true);
    expect(hasMinRole(makeTournament(), 'owner-1', 'owner')).toBe(true);
  });

  it('admin has moderator and scorekeeper but not owner', () => {
    expect(hasMinRole(makeTournament(), 'admin-1', 'scorekeeper')).toBe(true);
    expect(hasMinRole(makeTournament(), 'admin-1', 'moderator')).toBe(true);
    expect(hasMinRole(makeTournament(), 'admin-1', 'admin')).toBe(true);
    expect(hasMinRole(makeTournament(), 'admin-1', 'owner')).toBe(false);
  });

  it('moderator has scorekeeper but not admin or owner', () => {
    expect(hasMinRole(makeTournament(), 'mod-1', 'scorekeeper')).toBe(true);
    expect(hasMinRole(makeTournament(), 'mod-1', 'moderator')).toBe(true);
    expect(hasMinRole(makeTournament(), 'mod-1', 'admin')).toBe(false);
    expect(hasMinRole(makeTournament(), 'mod-1', 'owner')).toBe(false);
  });

  it('scorekeeper only has scorekeeper', () => {
    expect(hasMinRole(makeTournament(), 'sk-1', 'scorekeeper')).toBe(true);
    expect(hasMinRole(makeTournament(), 'sk-1', 'moderator')).toBe(false);
  });

  it('unknown user has no role', () => {
    expect(hasMinRole(makeTournament(), 'nobody', 'scorekeeper')).toBe(false);
  });
});
