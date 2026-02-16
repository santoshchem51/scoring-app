import { describe, it, expect } from 'vitest';
import {
  canRsvp,
  canUpdateDayOfStatus,
  isSessionFull,
  needsMorePlayers,
  shouldAutoOpen,
  getWinningSlot,
  getSessionDisplayStatus,
} from '../sessionHelpers';
import type { GameSession, SessionRsvp, TimeSlot } from '../../../../data/types';

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: 's1',
    groupId: 'g1',
    createdBy: 'u1',
    title: 'Test Session',
    location: 'Park',
    courtsAvailable: 1,
    spotsTotal: 4,
    spotsConfirmed: 0,
    scheduledDate: Date.now() + 86400000,
    timeSlots: null,
    confirmedSlot: null,
    rsvpStyle: 'simple',
    rsvpDeadline: null,
    visibility: 'group',
    shareCode: 'ABC123',
    autoOpenOnDropout: false,
    minPlayers: 4,
    status: 'proposed',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeRsvp(overrides: Partial<SessionRsvp> = {}): SessionRsvp {
  return {
    userId: 'u1',
    displayName: 'Test User',
    photoURL: null,
    response: 'in',
    dayOfStatus: 'none',
    selectedSlotIds: [],
    respondedAt: Date.now(),
    statusUpdatedAt: null,
    ...overrides,
  };
}

describe('canRsvp', () => {
  it('returns true for proposed session', () => {
    expect(canRsvp(makeSession({ status: 'proposed' }))).toBe(true);
  });

  it('returns true for confirmed session', () => {
    expect(canRsvp(makeSession({ status: 'confirmed' }))).toBe(true);
  });

  it('returns false for cancelled session', () => {
    expect(canRsvp(makeSession({ status: 'cancelled' }))).toBe(false);
  });

  it('returns false for completed session', () => {
    expect(canRsvp(makeSession({ status: 'completed' }))).toBe(false);
  });

  it('returns false when past RSVP deadline', () => {
    const session = makeSession({ rsvpDeadline: Date.now() - 1000 });
    expect(canRsvp(session)).toBe(false);
  });

  it('returns true with null deadline', () => {
    const session = makeSession({ status: 'proposed', rsvpDeadline: null });
    expect(canRsvp(session)).toBe(true);
  });

  it('returns true with future deadline', () => {
    const session = makeSession({ status: 'proposed', rsvpDeadline: Date.now() + 3600000 });
    expect(canRsvp(session)).toBe(true);
  });
});

describe('canUpdateDayOfStatus', () => {
  it('returns true for confirmed session with "in" RSVP', () => {
    const session = makeSession({ status: 'confirmed' });
    const rsvp = makeRsvp({ response: 'in' });
    expect(canUpdateDayOfStatus(session, rsvp)).toBe(true);
  });

  it('returns false for proposed session', () => {
    const session = makeSession({ status: 'proposed' });
    const rsvp = makeRsvp({ response: 'in' });
    expect(canUpdateDayOfStatus(session, rsvp)).toBe(false);
  });

  it('returns false if RSVP is "out"', () => {
    const session = makeSession({ status: 'confirmed' });
    const rsvp = makeRsvp({ response: 'out' });
    expect(canUpdateDayOfStatus(session, rsvp)).toBe(false);
  });

  it('returns false if RSVP is "maybe"', () => {
    const session = makeSession({ status: 'confirmed' });
    const rsvp = makeRsvp({ response: 'maybe' });
    expect(canUpdateDayOfStatus(session, rsvp)).toBe(false);
  });
});

describe('isSessionFull', () => {
  it('returns true when spotsConfirmed >= spotsTotal', () => {
    expect(isSessionFull(makeSession({ spotsConfirmed: 4, spotsTotal: 4 }))).toBe(true);
  });

  it('returns false when spots remain', () => {
    expect(isSessionFull(makeSession({ spotsConfirmed: 3, spotsTotal: 4 }))).toBe(false);
  });

  it('returns true when overbooked (confirmed > total)', () => {
    expect(isSessionFull(makeSession({ spotsConfirmed: 5, spotsTotal: 4 }))).toBe(true);
  });
});

describe('needsMorePlayers', () => {
  it('returns true when below minPlayers', () => {
    expect(needsMorePlayers(makeSession({ spotsConfirmed: 2, minPlayers: 4 }))).toBe(true);
  });

  it('returns false when at or above minPlayers', () => {
    expect(needsMorePlayers(makeSession({ spotsConfirmed: 4, minPlayers: 4 }))).toBe(false);
  });
});

describe('shouldAutoOpen', () => {
  it('returns true when autoOpen enabled, group visibility, and needs players', () => {
    const session = makeSession({
      autoOpenOnDropout: true,
      visibility: 'group',
      spotsConfirmed: 3,
      minPlayers: 4,
    });
    expect(shouldAutoOpen(session)).toBe(true);
  });

  it('returns false when already open', () => {
    const session = makeSession({
      autoOpenOnDropout: true,
      visibility: 'open',
      spotsConfirmed: 3,
      minPlayers: 4,
    });
    expect(shouldAutoOpen(session)).toBe(false);
  });

  it('returns false when autoOpen disabled', () => {
    const session = makeSession({
      autoOpenOnDropout: false,
      visibility: 'group',
      spotsConfirmed: 3,
      minPlayers: 4,
    });
    expect(shouldAutoOpen(session)).toBe(false);
  });

  it('returns false when spotsConfirmed >= minPlayers (no need to open)', () => {
    const session = makeSession({
      autoOpenOnDropout: true,
      visibility: 'group',
      spotsConfirmed: 4,
      minPlayers: 4,
    });
    expect(shouldAutoOpen(session)).toBe(false);
  });
});

describe('getWinningSlot', () => {
  it('returns the slot with most votes', () => {
    const slots: TimeSlot[] = [
      { id: 'a', date: 1, startTime: '09:00', endTime: '11:00', voteCount: 2 },
      { id: 'b', date: 1, startTime: '14:00', endTime: '16:00', voteCount: 5 },
      { id: 'c', date: 2, startTime: '09:00', endTime: '11:00', voteCount: 3 },
    ];
    expect(getWinningSlot(slots)).toEqual(slots[1]);
  });

  it('returns first slot on tie', () => {
    const slots: TimeSlot[] = [
      { id: 'a', date: 1, startTime: '09:00', endTime: '11:00', voteCount: 3 },
      { id: 'b', date: 1, startTime: '14:00', endTime: '16:00', voteCount: 3 },
    ];
    expect(getWinningSlot(slots)).toEqual(slots[0]);
  });

  it('returns null for empty slots', () => {
    expect(getWinningSlot([])).toBeNull();
  });

  it('returns that slot when only one slot exists', () => {
    const slots: TimeSlot[] = [
      { id: 'only', date: 1, startTime: '10:00', endTime: '12:00', voteCount: 1 },
    ];
    expect(getWinningSlot(slots)).toEqual(slots[0]);
  });
});

describe('getSessionDisplayStatus', () => {
  it('returns "Need X more" when below min', () => {
    const session = makeSession({ spotsConfirmed: 2, minPlayers: 4 });
    expect(getSessionDisplayStatus(session)).toBe('Need 2 more');
  });

  it('returns "X/Y confirmed" when above min but not full', () => {
    const session = makeSession({ spotsConfirmed: 5, spotsTotal: 8, minPlayers: 4 });
    expect(getSessionDisplayStatus(session)).toBe('5/8 confirmed');
  });

  it('returns "Full" when all spots taken', () => {
    const session = makeSession({ spotsConfirmed: 4, spotsTotal: 4 });
    expect(getSessionDisplayStatus(session)).toBe('Full');
  });

  it('returns "Cancelled" for cancelled session', () => {
    const session = makeSession({ status: 'cancelled' });
    expect(getSessionDisplayStatus(session)).toBe('Cancelled');
  });

  it('returns "Completed" for completed session', () => {
    const session = makeSession({ status: 'completed' });
    expect(getSessionDisplayStatus(session)).toBe('Completed');
  });

  it('returns "X/Y confirmed" at exact minPlayers threshold (not full)', () => {
    const session = makeSession({ spotsConfirmed: 4, spotsTotal: 8, minPlayers: 4 });
    expect(getSessionDisplayStatus(session)).toBe('4/8 confirmed');
  });
});
