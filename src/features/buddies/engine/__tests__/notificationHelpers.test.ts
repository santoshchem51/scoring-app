import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BuddyNotification } from '../../../../data/types';
import {
  createSessionProposedNotification,
  createSessionConfirmedNotification,
  createSessionCancelledNotification,
  createSpotOpenedNotification,
  createPlayerJoinedNotification,
  createGroupInviteNotification,
  createVotingReminderNotification,
} from '../notificationHelpers';

// Freeze Date.now() and crypto.randomUUID() for deterministic tests
const FIXED_UUID = 'test-uuid-1234';
const FIXED_NOW = 1700000000000;

beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(FIXED_UUID as `${string}-${string}-${string}-${string}-${string}`);
  vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createSessionProposedNotification', () => {
  it('returns a BuddyNotification with correct fields', () => {
    const result: BuddyNotification = createSessionProposedNotification(
      'user-1', 'Alice', 'Tuesday Doubles', 'session-1', 'group-1',
    );

    expect(result).toEqual({
      id: FIXED_UUID,
      userId: 'user-1',
      type: 'session_proposed',
      sessionId: 'session-1',
      groupId: 'group-1',
      actorName: 'Alice',
      message: 'Alice proposed a session: Tuesday Doubles',
      read: false,
      createdAt: FIXED_NOW,
    });
  });

  it('formats the message with actor name and session title', () => {
    const result = createSessionProposedNotification(
      'u', 'Bob', 'Friday Fun', 's', 'g',
    );
    expect(result.message).toBe('Bob proposed a session: Friday Fun');
  });
});

describe('createSessionConfirmedNotification', () => {
  it('returns a BuddyNotification with correct fields', () => {
    const result: BuddyNotification = createSessionConfirmedNotification(
      'user-2', 'Saturday Smash', 'session-2', 'group-2',
    );

    expect(result).toEqual({
      id: FIXED_UUID,
      userId: 'user-2',
      type: 'session_confirmed',
      sessionId: 'session-2',
      groupId: 'group-2',
      actorName: '',
      message: 'Saturday Smash is confirmed — game on!',
      read: false,
      createdAt: FIXED_NOW,
    });
  });

  it('accepts null groupId for open sessions', () => {
    const result = createSessionConfirmedNotification(
      'user-2', 'Open Play', 'session-3', null,
    );
    expect(result.groupId).toBeNull();
    expect(result.sessionId).toBe('session-3');
  });
});

describe('createSessionCancelledNotification', () => {
  it('returns a BuddyNotification with correct fields', () => {
    const result: BuddyNotification = createSessionCancelledNotification(
      'user-3', 'Rainy Day Session', 'session-4', 'group-3',
    );

    expect(result).toEqual({
      id: FIXED_UUID,
      userId: 'user-3',
      type: 'session_cancelled',
      sessionId: 'session-4',
      groupId: 'group-3',
      actorName: '',
      message: 'Rainy Day Session has been cancelled',
      read: false,
      createdAt: FIXED_NOW,
    });
  });

  it('accepts null groupId', () => {
    const result = createSessionCancelledNotification(
      'user-3', 'Open Session', 'session-5', null,
    );
    expect(result.groupId).toBeNull();
  });
});

describe('createSpotOpenedNotification', () => {
  it('returns a BuddyNotification with correct fields', () => {
    const result: BuddyNotification = createSpotOpenedNotification(
      'user-4', 'Charlie', 'Wednesday Warmup', 'session-6',
    );

    expect(result).toEqual({
      id: FIXED_UUID,
      userId: 'user-4',
      type: 'spot_opened',
      sessionId: 'session-6',
      groupId: null,
      actorName: 'Charlie',
      message: 'Charlie dropped out of Wednesday Warmup — spot available!',
      read: false,
      createdAt: FIXED_NOW,
    });
  });

  it('formats message with actor and session title', () => {
    const result = createSpotOpenedNotification(
      'u', 'Dana', 'Morning Mix', 's',
    );
    expect(result.message).toBe('Dana dropped out of Morning Mix — spot available!');
  });
});

describe('createPlayerJoinedNotification', () => {
  it('returns a BuddyNotification with correct fields', () => {
    const result: BuddyNotification = createPlayerJoinedNotification(
      'user-5', 'Eve', 'Thursday Thunder', 'session-7',
    );

    expect(result).toEqual({
      id: FIXED_UUID,
      userId: 'user-5',
      type: 'player_joined',
      sessionId: 'session-7',
      groupId: null,
      actorName: 'Eve',
      message: 'Eve joined Thursday Thunder',
      read: false,
      createdAt: FIXED_NOW,
    });
  });
});

describe('createGroupInviteNotification', () => {
  it('returns a BuddyNotification with correct fields', () => {
    const result: BuddyNotification = createGroupInviteNotification(
      'user-6', 'Frank', 'Weekend Warriors', 'group-4',
    );

    expect(result).toEqual({
      id: FIXED_UUID,
      userId: 'user-6',
      type: 'group_invite',
      sessionId: null,
      groupId: 'group-4',
      actorName: 'Frank',
      message: 'Frank invited you to join Weekend Warriors',
      read: false,
      createdAt: FIXED_NOW,
    });
  });

  it('has null sessionId since it is a group-level notification', () => {
    const result = createGroupInviteNotification(
      'u', 'Grace', 'Crew', 'g',
    );
    expect(result.sessionId).toBeNull();
  });
});

describe('createVotingReminderNotification', () => {
  it('returns a BuddyNotification with correct fields', () => {
    const result: BuddyNotification = createVotingReminderNotification(
      'user-7', 'Sunday Showdown', 'session-8', 'group-5',
    );

    expect(result).toEqual({
      id: FIXED_UUID,
      userId: 'user-7',
      type: 'voting_reminder',
      sessionId: 'session-8',
      groupId: 'group-5',
      actorName: '',
      message: 'Voting deadline approaching for Sunday Showdown',
      read: false,
      createdAt: FIXED_NOW,
    });
  });

  it('accepts null groupId', () => {
    const result = createVotingReminderNotification(
      'user-7', 'Open Vote', 'session-9', null,
    );
    expect(result.groupId).toBeNull();
  });
});

describe('shared behavior across all notification helpers', () => {
  it('every helper generates a unique id via crypto.randomUUID()', () => {
    const results = [
      createSessionProposedNotification('u', 'A', 'T', 's', 'g'),
      createSessionConfirmedNotification('u', 'T', 's', 'g'),
      createSessionCancelledNotification('u', 'T', 's', 'g'),
      createSpotOpenedNotification('u', 'A', 'T', 's'),
      createPlayerJoinedNotification('u', 'A', 'T', 's'),
      createGroupInviteNotification('u', 'A', 'G', 'g'),
      createVotingReminderNotification('u', 'T', 's', 'g'),
    ];

    for (const r of results) {
      expect(r.id).toBe(FIXED_UUID);
    }
    expect(crypto.randomUUID).toHaveBeenCalledTimes(7);
  });

  it('every helper sets read to false', () => {
    const results = [
      createSessionProposedNotification('u', 'A', 'T', 's', 'g'),
      createSessionConfirmedNotification('u', 'T', 's', 'g'),
      createSessionCancelledNotification('u', 'T', 's', 'g'),
      createSpotOpenedNotification('u', 'A', 'T', 's'),
      createPlayerJoinedNotification('u', 'A', 'T', 's'),
      createGroupInviteNotification('u', 'A', 'G', 'g'),
      createVotingReminderNotification('u', 'T', 's', 'g'),
    ];

    for (const r of results) {
      expect(r.read).toBe(false);
    }
  });

  it('every helper sets createdAt to Date.now()', () => {
    const results = [
      createSessionProposedNotification('u', 'A', 'T', 's', 'g'),
      createSessionConfirmedNotification('u', 'T', 's', 'g'),
      createSessionCancelledNotification('u', 'T', 's', 'g'),
      createSpotOpenedNotification('u', 'A', 'T', 's'),
      createPlayerJoinedNotification('u', 'A', 'T', 's'),
      createGroupInviteNotification('u', 'A', 'G', 'g'),
      createVotingReminderNotification('u', 'T', 's', 'g'),
    ];

    for (const r of results) {
      expect(r.createdAt).toBe(FIXED_NOW);
    }
  });
});
