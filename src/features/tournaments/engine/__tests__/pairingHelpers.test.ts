import { describe, it, expect } from 'vitest';
import { classifyRegistrations, preparePairUpdate, prepareUnpairUpdate, prepareAutoPairUpdates } from '../pairingHelpers';
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

describe('preparePairUpdate', () => {
  it('returns mutual partnerName updates', () => {
    const reg1 = makeReg({ userId: 'p1', playerName: 'Alice' });
    const reg2 = makeReg({ userId: 'p2', playerName: 'Bob' });
    const result = preparePairUpdate(reg1, reg2);

    expect(result).toEqual([
      { regId: 'reg-p1', partnerName: 'Bob' },
      { regId: 'reg-p2', partnerName: 'Alice' },
    ]);
  });

  it('uses playerName for partner name (not userId)', () => {
    const reg1 = makeReg({ userId: 'manual-abc', playerName: 'Charlie' });
    const reg2 = makeReg({ userId: 'manual-xyz', playerName: 'Diana' });
    const result = preparePairUpdate(reg1, reg2);

    expect(result[0].partnerName).toBe('Diana');
    expect(result[1].partnerName).toBe('Charlie');
  });
});

describe('prepareUnpairUpdate', () => {
  it('returns null partnerName for both registrations', () => {
    const reg1 = makeReg({ userId: 'p1', playerName: 'Alice', partnerName: 'Bob' });
    const reg2 = makeReg({ userId: 'p2', playerName: 'Bob', partnerName: 'Alice' });
    const result = prepareUnpairUpdate(reg1, reg2);

    expect(result).toEqual([
      { regId: 'reg-p1', partnerName: null },
      { regId: 'reg-p2', partnerName: null },
    ]);
  });
});

describe('prepareAutoPairUpdates', () => {
  it('pairs unmatched players by skill rating and returns updates', () => {
    const unmatched = [
      makeReg({ userId: 'p1', playerName: 'Alice', skillRating: 4.0 }),
      makeReg({ userId: 'p2', playerName: 'Bob', skillRating: 4.0 }),
      makeReg({ userId: 'p3', playerName: 'Charlie', skillRating: 3.0 }),
      makeReg({ userId: 'p4', playerName: 'Diana', skillRating: 3.0 }),
    ];
    const result = prepareAutoPairUpdates(unmatched);

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(2);
    expect(result[1]).toHaveLength(2);
    for (const pair of result) {
      expect(pair[0].partnerName).not.toBeNull();
      expect(pair[1].partnerName).not.toBeNull();
    }
  });

  it('leaves odd player out', () => {
    const unmatched = [
      makeReg({ userId: 'p1', playerName: 'Alice', skillRating: 4.0 }),
      makeReg({ userId: 'p2', playerName: 'Bob', skillRating: 3.5 }),
      makeReg({ userId: 'p3', playerName: 'Charlie', skillRating: 3.0 }),
    ];
    const result = prepareAutoPairUpdates(unmatched);
    expect(result).toHaveLength(1);
  });

  it('returns empty for fewer than 2 players', () => {
    const result = prepareAutoPairUpdates([makeReg({ userId: 'p1', playerName: 'Alice' })]);
    expect(result).toHaveLength(0);
  });
});
