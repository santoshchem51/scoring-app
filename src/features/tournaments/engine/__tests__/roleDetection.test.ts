import { describe, it, expect } from 'vitest';
import { detectViewerRole } from '../roleDetection';
import type { Tournament, TournamentRegistration } from '../../../../data/types';

const makeTournament = (overrides?: Partial<Tournament>): Tournament => ({
  id: 't1',
  name: 'Test',
  date: Date.now(),
  location: '',
  format: 'single-elimination',
  config: { gameType: 'singles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 1, teamsPerPoolAdvancing: 2 },
  organizerId: 'org-1',
  scorekeeperIds: ['sk-1', 'sk-2'],
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
  ...overrides,
});

const makeReg = (userId: string): TournamentRegistration => ({
  id: `reg-${userId}`,
  tournamentId: 't1',
  userId,
  playerName: userId,
  teamId: null,
  paymentStatus: 'unpaid',
  paymentNote: '',
  lateEntry: false,
  skillRating: null,
  partnerId: null,
  partnerName: null,
  profileComplete: false,
  registeredAt: Date.now(),
});

describe('detectViewerRole', () => {
  it('returns organizer when userId matches organizerId', () => {
    expect(detectViewerRole(makeTournament(), 'org-1', [])).toBe('organizer');
  });

  it('returns scorekeeper when userId is in scorekeeperIds', () => {
    expect(detectViewerRole(makeTournament(), 'sk-1', [])).toBe('scorekeeper');
  });

  it('returns player when userId has a registration', () => {
    const regs = [makeReg('player-1')];
    expect(detectViewerRole(makeTournament(), 'player-1', regs)).toBe('player');
  });

  it('returns spectator when userId is null', () => {
    expect(detectViewerRole(makeTournament(), null, [])).toBe('spectator');
  });

  it('returns spectator when userId has no role', () => {
    expect(detectViewerRole(makeTournament(), 'random-user', [])).toBe('spectator');
  });

  it('organizer takes priority over scorekeeper', () => {
    const t = makeTournament({ scorekeeperIds: ['org-1'] });
    expect(detectViewerRole(t, 'org-1', [])).toBe('organizer');
  });

  it('scorekeeper takes priority over player', () => {
    const regs = [makeReg('sk-1')];
    expect(detectViewerRole(makeTournament(), 'sk-1', regs)).toBe('scorekeeper');
  });
});
