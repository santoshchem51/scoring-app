import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AppNotification } from '../../../../data/types';
import {
  createSessionProposedNotif,
  createSessionConfirmedNotif,
  createSessionCancelledNotif,
  createSessionReminderNotif,
  createSpotOpenedNotif,
  createGroupInviteNotif,
  createTournamentInvitationNotif,
  createMatchUpcomingNotif,
  createMatchResultRecordedNotif,
  createAchievementUnlockedNotif,
  createTierUpNotif,
  createTierDownNotif,
  EXPIRY_DAYS,
} from '../notificationHelpers';

const FIXED_UUID = 'test-uuid-1234';
const FIXED_NOW = 1700000000000;
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_UUID as `${string}-${string}-${string}-${string}-${string}`);
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Table-driven: every type maps to correct category, actionUrl pattern, and expiresAt ──

const TYPE_MAP: Array<{
  name: string;
  factory: () => AppNotification;
  expectedCategory: string;
  expectedType: string;
  expectedActionUrlPattern: RegExp | null;
  expectedExpiryDays: number;
}> = [
  {
    name: 'session_proposed',
    factory: () => createSessionProposedNotif('u1', 'Alice', 'Tue Doubles', 's1', 'g1'),
    expectedCategory: 'buddy',
    expectedType: 'session_proposed',
    expectedActionUrlPattern: /\/session\/s1/,
    expectedExpiryDays: 30,
  },
  {
    name: 'session_confirmed',
    factory: () => createSessionConfirmedNotif('u1', 'Tue Doubles', 's1', 'g1'),
    expectedCategory: 'buddy',
    expectedType: 'session_confirmed',
    expectedActionUrlPattern: /\/session\/s1/,
    expectedExpiryDays: 30,
  },
  {
    name: 'session_cancelled',
    factory: () => createSessionCancelledNotif('u1', 'Tue Doubles', 's1', 'g1'),
    expectedCategory: 'buddy',
    expectedType: 'session_cancelled',
    expectedActionUrlPattern: /\/session\/s1/,
    expectedExpiryDays: 30,
  },
  {
    name: 'session_reminder',
    factory: () => createSessionReminderNotif('u1', 'Tue Doubles', 's1'),
    expectedCategory: 'buddy',
    expectedType: 'session_reminder',
    expectedActionUrlPattern: /\/session\/s1/,
    expectedExpiryDays: 7,
  },
  {
    name: 'spot_opened',
    factory: () => createSpotOpenedNotif('u1', 'Bob', 'Tue Doubles', 's1'),
    expectedCategory: 'buddy',
    expectedType: 'spot_opened',
    expectedActionUrlPattern: /\/session\/s1/,
    expectedExpiryDays: 7,
  },
  {
    name: 'group_invite',
    factory: () => createGroupInviteNotif('u1', 'Alice', 'Friday Group', 'g1'),
    expectedCategory: 'buddy',
    expectedType: 'group_invite',
    expectedActionUrlPattern: /\/buddies\/g1/,
    expectedExpiryDays: 30,
  },
  {
    name: 'tournament_invitation',
    factory: () => createTournamentInvitationNotif('u1', 'Organizer', 'Spring Open', 't1'),
    expectedCategory: 'tournament',
    expectedType: 'tournament_invitation',
    expectedActionUrlPattern: /\/tournaments\/t1/,
    expectedExpiryDays: 30,
  },
  {
    name: 'match_upcoming',
    factory: () => createMatchUpcomingNotif('u1', 'Spring Open', 't1', 'm1'),
    expectedCategory: 'tournament',
    expectedType: 'match_upcoming',
    expectedActionUrlPattern: /\/tournaments\/t1/,
    expectedExpiryDays: 1,
  },
  {
    name: 'match_result_recorded',
    factory: () => createMatchResultRecordedNotif('u1', 'Scorer', 'Spring Open', 't1', 'm1'),
    expectedCategory: 'tournament',
    expectedType: 'match_result_recorded',
    expectedActionUrlPattern: /\/tournaments\/t1/,
    expectedExpiryDays: 30,
  },
  {
    name: 'achievement_unlocked',
    factory: () => createAchievementUnlockedNotif('u1', 'Century Club', 'Play 100 matches', 'century_club'),
    expectedCategory: 'achievement',
    expectedType: 'achievement_unlocked',
    expectedActionUrlPattern: /\/profile/,
    expectedExpiryDays: 90,
  },
  {
    name: 'tier_up',
    factory: () => createTierUpNotif('u1', 'intermediate', 'advanced'),
    expectedCategory: 'stats',
    expectedType: 'tier_up',
    expectedActionUrlPattern: /\/profile/,
    expectedExpiryDays: 30,
  },
  {
    name: 'tier_down',
    factory: () => createTierDownNotif('u1', 'advanced', 'intermediate'),
    expectedCategory: 'stats',
    expectedType: 'tier_down',
    expectedActionUrlPattern: /\/profile/,
    expectedExpiryDays: 30,
  },
];

describe('notification helpers', () => {
  describe.each(TYPE_MAP)('$name', ({ factory, expectedCategory, expectedType, expectedActionUrlPattern, expectedExpiryDays }) => {
    it('sets correct category', () => {
      expect(factory().category).toBe(expectedCategory);
    });

    it('sets correct type', () => {
      expect(factory().type).toBe(expectedType);
    });

    it('sets actionUrl matching expected pattern', () => {
      const result = factory();
      if (expectedActionUrlPattern) {
        expect(result.actionUrl).toMatch(expectedActionUrlPattern);
      }
    });

    it('sets expiresAt to correct number of days from now', () => {
      expect(factory().expiresAt).toBe(FIXED_NOW + expectedExpiryDays * DAY_MS);
    });
  });

  describe('shared behavior', () => {
    it('every helper generates a unique id via crypto.randomUUID()', () => {
      for (const { factory } of TYPE_MAP) {
        expect(factory().id).toBe(FIXED_UUID);
      }
      expect(crypto.randomUUID).toHaveBeenCalledTimes(TYPE_MAP.length);
    });

    it('every helper sets read to false', () => {
      for (const { factory } of TYPE_MAP) {
        expect(factory().read).toBe(false);
      }
    });

    it('every helper sets createdAt to Date.now()', () => {
      for (const { factory } of TYPE_MAP) {
        expect(factory().createdAt).toBe(FIXED_NOW);
      }
    });

    it('every helper sets userId to the provided value', () => {
      for (const { factory } of TYPE_MAP) {
        expect(factory().userId).toBe('u1');
      }
    });

    it('every helper sets a non-empty message string', () => {
      for (const { factory } of TYPE_MAP) {
        const result = factory();
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Specific message formatting ──

  it('session_proposed includes actor name and session title', () => {
    const result = createSessionProposedNotif('u1', 'Alice', 'Tue Doubles', 's1', 'g1');
    expect(result.message).toBe('Alice proposed a session: Tue Doubles');
  });

  it('session_confirmed includes session title', () => {
    const result = createSessionConfirmedNotif('u1', 'Tue Doubles', 's1', 'g1');
    expect(result.message).toContain('Tue Doubles');
    expect(result.message).toContain('confirmed');
  });

  it('session_cancelled includes session title', () => {
    const result = createSessionCancelledNotif('u1', 'Tue Doubles', 's1', 'g1');
    expect(result.message).toContain('Tue Doubles');
    expect(result.message).toContain('cancelled');
  });

  it('session_reminder includes session title', () => {
    const result = createSessionReminderNotif('u1', 'Tue Doubles', 's1');
    expect(result.message).toContain('Tue Doubles');
  });

  it('spot_opened includes actor name and session title', () => {
    const result = createSpotOpenedNotif('u1', 'Bob', 'Tue Doubles', 's1');
    expect(result.message).toContain('Bob');
    expect(result.message).toContain('Tue Doubles');
  });

  it('group_invite includes actor name and group name', () => {
    const result = createGroupInviteNotif('u1', 'Alice', 'Friday Group', 'g1');
    expect(result.message).toContain('Alice');
    expect(result.message).toContain('Friday Group');
  });

  it('tournament_invitation includes organizer and tournament name', () => {
    const result = createTournamentInvitationNotif('u1', 'Organizer', 'Spring Open', 't1');
    expect(result.message).toContain('Organizer');
    expect(result.message).toContain('Spring Open');
  });

  it('match_upcoming includes tournament name', () => {
    const result = createMatchUpcomingNotif('u1', 'Spring Open', 't1', 'm1');
    expect(result.message).toContain('Spring Open');
  });

  it('match_result_recorded includes scorer and tournament', () => {
    const result = createMatchResultRecordedNotif('u1', 'Scorer', 'Spring Open', 't1', 'm1');
    expect(result.message).toContain('Scorer');
    expect(result.message).toContain('Spring Open');
  });

  it('achievement_unlocked includes achievement name', () => {
    const result = createAchievementUnlockedNotif('u1', 'Century Club', 'Play 100 matches', 'century_club');
    expect(result.message).toContain('Century Club');
  });

  it('tier_up includes old and new tier', () => {
    const result = createTierUpNotif('u1', 'intermediate', 'advanced');
    expect(result.message).toContain('advanced');
    expect(result.payload.tierFrom).toBe('intermediate');
    expect(result.payload.tierTo).toBe('advanced');
  });

  it('tier_down includes old and new tier', () => {
    const result = createTierDownNotif('u1', 'advanced', 'intermediate');
    expect(result.message).toContain('intermediate');
    expect(result.payload.tierFrom).toBe('advanced');
    expect(result.payload.tierTo).toBe('intermediate');
  });
});
