import { describe, it, expect, vi } from 'vitest';
import { getExpiredRegistrationUserIds, EXPIRY_DAYS } from '../registrationExpiry';
import type { TournamentRegistration } from '../../../../data/types';

function makeReg(userId: string, daysAgo: number, status: string): TournamentRegistration {
  return {
    id: userId,
    tournamentId: 't1',
    userId,
    playerName: `Player ${userId}`,
    teamId: null,
    paymentStatus: 'unpaid',
    paymentNote: '',
    lateEntry: false,
    skillRating: null,
    partnerId: null,
    partnerName: null,
    profileComplete: false,
    registeredAt: Date.now() - daysAgo * 86400000,
    status: status as any,
    declineReason: null,
    statusUpdatedAt: null,
  };
}

describe('getExpiredRegistrationUserIds', () => {
  it('returns pending registrations older than 14 days', () => {
    const regs = [
      makeReg('u1', 15, 'pending'),
      makeReg('u2', 1, 'pending'),
      makeReg('u3', 20, 'pending'),
    ];
    const expired = getExpiredRegistrationUserIds(regs);
    expect(expired).toEqual(['u1', 'u3']);
  });

  it('ignores non-pending registrations', () => {
    const regs = [
      makeReg('u1', 20, 'confirmed'),
      makeReg('u2', 20, 'declined'),
    ];
    const expired = getExpiredRegistrationUserIds(regs);
    expect(expired).toEqual([]);
  });

  it('returns empty array when no expired', () => {
    const regs = [
      makeReg('u1', 5, 'pending'),
    ];
    const expired = getExpiredRegistrationUserIds(regs);
    expect(expired).toEqual([]);
  });

  it('exports EXPIRY_DAYS as 14', () => {
    expect(EXPIRY_DAYS).toBe(14);
  });
});
