import { describe, it, expect } from 'vitest';
import { classifyRegistrations } from '../pairingHelpers';
import type { TournamentRegistration } from '../../../../data/types';

const makeReg = (overrides: Partial<TournamentRegistration> & { userId: string }): TournamentRegistration => ({
  id: `reg-${overrides.userId}`,
  tournamentId: 't1',
  playerName: null,
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

describe('classifyRegistrations', () => {
  it('detects mutually-named partners as pre-paired', () => {
    const regs = [
      makeReg({ userId: 'p1', playerName: 'Alice', partnerName: 'Bob' }),
      makeReg({ userId: 'p2', playerName: 'Bob', partnerName: 'Alice' }),
    ];
    const userNames: Record<string, string> = { p1: 'Alice', p2: 'Bob' };
    const result = classifyRegistrations(regs, userNames);
    expect(result.paired).toHaveLength(1);
    expect(result.paired[0].player1.userId).toBe('p1');
    expect(result.paired[0].player2.userId).toBe('p2');
    expect(result.unmatched).toHaveLength(0);
  });

  it('leaves players without partnerName as unmatched', () => {
    const regs = [
      makeReg({ userId: 'p1', playerName: 'Alice' }),
      makeReg({ userId: 'p2', playerName: 'Bob' }),
    ];
    const userNames: Record<string, string> = { p1: 'Alice', p2: 'Bob' };
    const result = classifyRegistrations(regs, userNames);
    expect(result.paired).toHaveLength(0);
    expect(result.unmatched).toHaveLength(2);
  });

  it('handles one-sided naming as unmatched', () => {
    const regs = [
      makeReg({ userId: 'p1', playerName: 'Alice', partnerName: 'Bob' }),
      makeReg({ userId: 'p2', playerName: 'Bob' }),
    ];
    const userNames: Record<string, string> = { p1: 'Alice', p2: 'Bob' };
    const result = classifyRegistrations(regs, userNames);
    expect(result.paired).toHaveLength(0);
    expect(result.unmatched).toHaveLength(2);
  });

  it('handles mix of paired and unmatched', () => {
    const regs = [
      makeReg({ userId: 'p1', playerName: 'Alice', partnerName: 'Bob' }),
      makeReg({ userId: 'p2', playerName: 'Bob', partnerName: 'Alice' }),
      makeReg({ userId: 'p3', playerName: 'Charlie' }),
      makeReg({ userId: 'p4', playerName: 'Diana' }),
    ];
    const userNames: Record<string, string> = { p1: 'Alice', p2: 'Bob', p3: 'Charlie', p4: 'Diana' };
    const result = classifyRegistrations(regs, userNames);
    expect(result.paired).toHaveLength(1);
    expect(result.unmatched).toHaveLength(2);
    expect(result.unmatched.map((r) => r.userId).sort()).toEqual(['p3', 'p4']);
  });

  it('is case-insensitive for partner name matching', () => {
    const regs = [
      makeReg({ userId: 'p1', playerName: 'Alice', partnerName: 'BOB' }),
      makeReg({ userId: 'p2', playerName: 'Bob', partnerName: 'alice' }),
    ];
    const userNames: Record<string, string> = { p1: 'Alice', p2: 'Bob' };
    const result = classifyRegistrations(regs, userNames);
    expect(result.paired).toHaveLength(1);
  });

  it('returns empty arrays for empty registrations', () => {
    const result = classifyRegistrations([], {});
    expect(result.paired).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
  });
});
