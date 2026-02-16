import type { BuddyNotification } from '../../../data/types';

export function createSessionProposedNotification(
  userId: string,
  actorName: string,
  sessionTitle: string,
  sessionId: string,
  groupId: string,
): BuddyNotification {
  return {
    id: crypto.randomUUID(),
    userId,
    type: 'session_proposed',
    sessionId,
    groupId,
    actorName,
    message: `${actorName} proposed a session: ${sessionTitle}`,
    read: false,
    createdAt: Date.now(),
  };
}

export function createSessionConfirmedNotification(
  userId: string,
  sessionTitle: string,
  sessionId: string,
  groupId: string | null,
): BuddyNotification {
  return {
    id: crypto.randomUUID(),
    userId,
    type: 'session_confirmed',
    sessionId,
    groupId,
    actorName: '',
    message: `${sessionTitle} is confirmed — game on!`,
    read: false,
    createdAt: Date.now(),
  };
}

export function createSessionCancelledNotification(
  userId: string,
  sessionTitle: string,
  sessionId: string,
  groupId: string | null,
): BuddyNotification {
  return {
    id: crypto.randomUUID(),
    userId,
    type: 'session_cancelled',
    sessionId,
    groupId,
    actorName: '',
    message: `${sessionTitle} has been cancelled`,
    read: false,
    createdAt: Date.now(),
  };
}

export function createSpotOpenedNotification(
  userId: string,
  actorName: string,
  sessionTitle: string,
  sessionId: string,
): BuddyNotification {
  return {
    id: crypto.randomUUID(),
    userId,
    type: 'spot_opened',
    sessionId,
    groupId: null,
    actorName,
    message: `${actorName} dropped out of ${sessionTitle} — spot available!`,
    read: false,
    createdAt: Date.now(),
  };
}

export function createPlayerJoinedNotification(
  userId: string,
  actorName: string,
  sessionTitle: string,
  sessionId: string,
): BuddyNotification {
  return {
    id: crypto.randomUUID(),
    userId,
    type: 'player_joined',
    sessionId,
    groupId: null,
    actorName,
    message: `${actorName} joined ${sessionTitle}`,
    read: false,
    createdAt: Date.now(),
  };
}

export function createGroupInviteNotification(
  userId: string,
  actorName: string,
  groupName: string,
  groupId: string,
): BuddyNotification {
  return {
    id: crypto.randomUUID(),
    userId,
    type: 'group_invite',
    sessionId: null,
    groupId,
    actorName,
    message: `${actorName} invited you to join ${groupName}`,
    read: false,
    createdAt: Date.now(),
  };
}

export function createVotingReminderNotification(
  userId: string,
  sessionTitle: string,
  sessionId: string,
  groupId: string | null,
): BuddyNotification {
  return {
    id: crypto.randomUUID(),
    userId,
    type: 'voting_reminder',
    sessionId,
    groupId,
    actorName: '',
    message: `Voting deadline approaching for ${sessionTitle}`,
    read: false,
    createdAt: Date.now(),
  };
}
