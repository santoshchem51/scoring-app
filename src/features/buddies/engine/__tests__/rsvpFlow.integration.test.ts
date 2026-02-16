import { describe, it, expect } from 'vitest';
import {
  canRsvp,
  isSessionFull,
  shouldAutoOpen,
  needsMorePlayers,
  getSessionDisplayStatus,
} from '../sessionHelpers';
import type {
  GameSession,
  BuddyNotification,
  BuddyNotificationType,
} from '../../../../data/types';

/**
 * Integration tests for the RSVP flow.
 *
 * These test the logical chain of pure functions that compose the
 * RSVP pipeline: canRsvp -> isSessionFull -> shouldAutoOpen -> notification.
 * No mocks needed — all pure function composition.
 */

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: 's1',
    groupId: 'g1',
    createdBy: 'u1',
    title: 'Friday Pickleball',
    location: 'Central Courts',
    courtsAvailable: 2,
    spotsTotal: 8,
    spotsConfirmed: 0,
    scheduledDate: Date.now() + 86400000,
    timeSlots: null,
    confirmedSlot: null,
    rsvpStyle: 'simple',
    rsvpDeadline: null,
    visibility: 'group',
    shareCode: 'INT123',
    autoOpenOnDropout: false,
    minPlayers: 4,
    status: 'proposed',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeNotification(
  type: BuddyNotificationType,
  session: GameSession,
): BuddyNotification {
  return {
    id: `notif-${Date.now()}`,
    userId: session.createdBy,
    type,
    sessionId: session.id,
    groupId: session.groupId,
    actorName: 'System',
    message: type === 'spot_opened' ? 'A spot has opened up!' : 'Player joined',
    read: false,
    createdAt: Date.now(),
  };
}

describe('RSVP flow integration', () => {
  it('full flow: canRsvp -> RSVP in -> session becomes full -> no auto-open', () => {
    // Start with a session that has 7 of 8 spots filled
    const session = makeSession({
      status: 'proposed',
      spotsConfirmed: 7,
      spotsTotal: 8,
      minPlayers: 4,
      autoOpenOnDropout: false,
    });

    // Step 1: Verify the player can RSVP
    expect(canRsvp(session)).toBe(true);

    // Step 2: Simulate the player RSVPing "in" by incrementing spotsConfirmed
    const afterRsvp: GameSession = { ...session, spotsConfirmed: 8 };

    // Step 3: Session should now be full
    expect(isSessionFull(afterRsvp)).toBe(true);

    // Step 4: Auto-open should NOT trigger (disabled)
    expect(shouldAutoOpen(afterRsvp)).toBe(false);

    // Step 5: Display status reflects fullness
    expect(getSessionDisplayStatus(afterRsvp)).toBe('Full');
  });

  it('player fills last spot, triggers auto-open when configured and player drops out', () => {
    // Start with a session at capacity, autoOpen enabled
    const fullSession = makeSession({
      status: 'confirmed',
      spotsConfirmed: 8,
      spotsTotal: 8,
      minPlayers: 4,
      autoOpenOnDropout: true,
      visibility: 'group',
    });

    expect(isSessionFull(fullSession)).toBe(true);
    expect(shouldAutoOpen(fullSession)).toBe(false); // full, no need to open

    // Player drops out: spotsConfirmed decreases below minPlayers threshold
    const afterDropout: GameSession = { ...fullSession, spotsConfirmed: 3 };

    // Now needs more players
    expect(needsMorePlayers(afterDropout)).toBe(true);
    expect(shouldAutoOpen(afterDropout)).toBe(true);

    // A "spot_opened" notification should be created
    const notification = makeNotification('spot_opened', afterDropout);
    expect(notification.type).toBe('spot_opened');
    expect(notification.sessionId).toBe('s1');

    // Display status reflects need
    expect(getSessionDisplayStatus(afterDropout)).toBe('Need 1 more');
  });

  it('RSVP blocked for cancelled session even if spots are available', () => {
    const session = makeSession({
      status: 'cancelled',
      spotsConfirmed: 2,
      spotsTotal: 8,
    });

    // Cannot RSVP to cancelled session
    expect(canRsvp(session)).toBe(false);

    // Display status shows cancelled regardless of spot counts
    expect(getSessionDisplayStatus(session)).toBe('Cancelled');
  });

  it('RSVP blocked when past deadline, even for proposed session with spots', () => {
    const session = makeSession({
      status: 'proposed',
      spotsConfirmed: 1,
      spotsTotal: 8,
      rsvpDeadline: Date.now() - 60000, // 1 minute ago
    });

    expect(canRsvp(session)).toBe(false);
    // Session is not full, and not cancelled — still shows need
    expect(isSessionFull(session)).toBe(false);
    expect(getSessionDisplayStatus(session)).toBe('Need 3 more');
  });

  it('reaching minPlayers but not full shows confirmed count, auto-open stays off', () => {
    const session = makeSession({
      status: 'proposed',
      spotsConfirmed: 3,
      spotsTotal: 8,
      minPlayers: 4,
      autoOpenOnDropout: true,
      visibility: 'group',
    });

    // Before reaching minPlayers
    expect(needsMorePlayers(session)).toBe(true);
    expect(shouldAutoOpen(session)).toBe(true);
    expect(getSessionDisplayStatus(session)).toBe('Need 1 more');

    // Player RSVPs in, reaching minPlayers
    const atMin: GameSession = { ...session, spotsConfirmed: 4 };

    expect(needsMorePlayers(atMin)).toBe(false);
    expect(isSessionFull(atMin)).toBe(false);
    expect(shouldAutoOpen(atMin)).toBe(false); // has enough players now
    expect(getSessionDisplayStatus(atMin)).toBe('4/8 confirmed');
  });
});
