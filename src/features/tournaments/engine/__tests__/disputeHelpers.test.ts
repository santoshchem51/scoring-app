import { describe, it, expect } from 'vitest';
import { canFlagDispute, canResolveDispute } from '../disputeHelpers';
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

describe('canFlagDispute', () => {
  it('returns true for tournament owner', () => {
    expect(canFlagDispute(makeTournament(), 'owner-1', [])).toBe(true);
  });

  it('returns true for admin', () => {
    expect(canFlagDispute(makeTournament(), 'admin-1', [])).toBe(true);
  });

  it('returns true for moderator', () => {
    expect(canFlagDispute(makeTournament(), 'mod-1', [])).toBe(true);
  });

  it('returns true for match participant', () => {
    expect(canFlagDispute(makeTournament(), 'player-1', ['player-1', 'player-2'])).toBe(true);
  });

  it('returns false for scorekeeper not in match', () => {
    expect(canFlagDispute(makeTournament(), 'sk-1', ['player-1'])).toBe(false);
  });

  it('returns false for random user not in match', () => {
    expect(canFlagDispute(makeTournament(), 'nobody', ['player-1'])).toBe(false);
  });
});

describe('canResolveDispute', () => {
  it('returns true for owner', () => {
    expect(canResolveDispute(makeTournament(), 'owner-1')).toBe(true);
  });

  it('returns true for admin', () => {
    expect(canResolveDispute(makeTournament(), 'admin-1')).toBe(true);
  });

  it('returns true for moderator', () => {
    expect(canResolveDispute(makeTournament(), 'mod-1')).toBe(true);
  });

  it('returns false for scorekeeper', () => {
    expect(canResolveDispute(makeTournament(), 'sk-1')).toBe(false);
  });

  it('returns false for random user', () => {
    expect(canResolveDispute(makeTournament(), 'nobody')).toBe(false);
  });
});
