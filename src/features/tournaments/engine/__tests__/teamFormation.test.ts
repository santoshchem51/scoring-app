import { describe, it, expect } from 'vitest';
import { createTeamsFromRegistrations } from '../teamFormation';
import type { TournamentRegistration } from '../../../../data/types';

const makeReg = (overrides: Partial<TournamentRegistration> & { userId: string }): TournamentRegistration => ({
  id: `reg-${overrides.userId}`,
  tournamentId: 't1',
  teamId: null,
  paymentStatus: 'unpaid',
  paymentNote: '',
  lateEntry: false,
  skillRating: null,
  partnerId: null,
  partnerName: null,
  profileComplete: false,
  registeredAt: Date.now(),
  ...overrides,
});

describe('createTeamsFromRegistrations', () => {
  describe('singles mode', () => {
    it('creates one team per registration', () => {
      const registrations = [makeReg({ userId: 'p1' }), makeReg({ userId: 'p2' }), makeReg({ userId: 'p3' })];
      const { teams, unmatched } = createTeamsFromRegistrations(registrations, 't1', 'singles');

      expect(teams).toHaveLength(3);
      expect(unmatched).toHaveLength(0);
      expect(teams[0].playerIds).toEqual(['p1']);
      expect(teams[1].playerIds).toEqual(['p2']);
    });
  });

  describe('BYOP mode', () => {
    it('pairs players who named each other as partners', () => {
      const registrations = [
        makeReg({ userId: 'p1', partnerName: 'Player 2' }),
        makeReg({ userId: 'p2', partnerName: 'Player 1' }),
      ];
      const userNames: Record<string, string> = { p1: 'Player 1', p2: 'Player 2' };
      const { teams, unmatched } = createTeamsFromRegistrations(registrations, 't1', 'byop', userNames);

      expect(teams).toHaveLength(1);
      expect(teams[0].playerIds.sort()).toEqual(['p1', 'p2']);
      expect(unmatched).toHaveLength(0);
    });

    it('leaves unmatched players who have no partner', () => {
      const registrations = [
        makeReg({ userId: 'p1' }),
        makeReg({ userId: 'p2', partnerName: 'Player 3' }),
      ];
      const { teams, unmatched } = createTeamsFromRegistrations(registrations, 't1', 'byop');

      expect(teams).toHaveLength(0);
      expect(unmatched).toHaveLength(2);
    });
  });

  describe('auto-pair mode', () => {
    it('pairs players by closest skill rating', () => {
      const registrations = [
        makeReg({ userId: 'p1', skillRating: 4.0 }),
        makeReg({ userId: 'p2', skillRating: 4.0 }),
        makeReg({ userId: 'p3', skillRating: 3.0 }),
        makeReg({ userId: 'p4', skillRating: 3.0 }),
      ];
      const { teams, unmatched } = createTeamsFromRegistrations(registrations, 't1', 'auto-pair');

      expect(teams).toHaveLength(2);
      expect(unmatched).toHaveLength(0);
    });

    it('leaves odd player unpaired', () => {
      const registrations = [
        makeReg({ userId: 'p1', skillRating: 4.0 }),
        makeReg({ userId: 'p2', skillRating: 4.0 }),
        makeReg({ userId: 'p3', skillRating: 3.0 }),
      ];
      const { teams, unmatched } = createTeamsFromRegistrations(registrations, 't1', 'auto-pair');

      expect(teams).toHaveLength(1);
      expect(unmatched).toHaveLength(1);
    });
  });
});
