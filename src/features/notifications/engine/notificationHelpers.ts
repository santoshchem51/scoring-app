import type { AppNotification } from '../../../data/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const EXPIRY_DAYS = {
  short: 1,
  week: 7,
  standard: 30,
  long: 90,
} as const;

function makeNotif(
  userId: string,
  category: AppNotification['category'],
  type: AppNotification['type'],
  message: string,
  actionUrl: string,
  payload: AppNotification['payload'],
  expiryDays: number,
): AppNotification {
  return {
    id: crypto.randomUUID(),
    userId,
    category,
    type,
    message,
    actionUrl,
    payload,
    read: false,
    createdAt: Date.now(),
    expiresAt: Date.now() + expiryDays * DAY_MS,
  };
}

// ── Buddy ──

export function createSessionProposedNotif(
  userId: string, actorName: string, sessionTitle: string, sessionId: string, groupId: string,
): AppNotification {
  return makeNotif(userId, 'buddy', 'session_proposed',
    `${actorName} proposed a session: ${sessionTitle}`,
    `/session/${sessionId}`,
    { sessionId, groupId, actorName },
    EXPIRY_DAYS.standard);
}

export function createSessionConfirmedNotif(
  userId: string, sessionTitle: string, sessionId: string, groupId: string | null,
): AppNotification {
  return makeNotif(userId, 'buddy', 'session_confirmed',
    `${sessionTitle} is confirmed — game on!`,
    `/session/${sessionId}`,
    { sessionId, groupId: groupId ?? undefined },
    EXPIRY_DAYS.standard);
}

export function createSessionCancelledNotif(
  userId: string, sessionTitle: string, sessionId: string, groupId: string | null,
): AppNotification {
  return makeNotif(userId, 'buddy', 'session_cancelled',
    `${sessionTitle} has been cancelled`,
    `/session/${sessionId}`,
    { sessionId, groupId: groupId ?? undefined },
    EXPIRY_DAYS.standard);
}

export function createSessionReminderNotif(
  userId: string, sessionTitle: string, sessionId: string,
): AppNotification {
  return makeNotif(userId, 'buddy', 'session_reminder',
    `${sessionTitle} starts in 1 hour`,
    `/session/${sessionId}`,
    { sessionId },
    EXPIRY_DAYS.week);
}

export function createSpotOpenedNotif(
  userId: string, actorName: string, sessionTitle: string, sessionId: string,
): AppNotification {
  return makeNotif(userId, 'buddy', 'spot_opened',
    `${actorName} dropped out of ${sessionTitle} — spot available!`,
    `/session/${sessionId}`,
    { sessionId, actorName },
    EXPIRY_DAYS.week);
}

export function createGroupInviteNotif(
  userId: string, actorName: string, groupName: string, groupId: string,
): AppNotification {
  return makeNotif(userId, 'buddy', 'group_invite',
    `${actorName} invited you to join ${groupName}`,
    `/buddies/${groupId}`,
    { groupId, actorName },
    EXPIRY_DAYS.standard);
}

// ── Tournament ──

export function createTournamentInvitationNotif(
  userId: string, organizerName: string, tournamentName: string, tournamentId: string,
): AppNotification {
  return makeNotif(userId, 'tournament', 'tournament_invitation',
    `${organizerName} invited you to ${tournamentName}`,
    `/tournaments/${tournamentId}`,
    { tournamentId, actorName: organizerName },
    EXPIRY_DAYS.standard);
}

export function createMatchUpcomingNotif(
  userId: string, tournamentName: string, tournamentId: string, matchId: string,
): AppNotification {
  return makeNotif(userId, 'tournament', 'match_upcoming',
    `Your next match in ${tournamentName} is about to start`,
    `/tournaments/${tournamentId}`,
    { tournamentId, matchId },
    EXPIRY_DAYS.short);
}

export function createMatchResultRecordedNotif(
  userId: string, scorerName: string, tournamentName: string, tournamentId: string, matchId: string,
): AppNotification {
  return makeNotif(userId, 'tournament', 'match_result_recorded',
    `${scorerName} recorded your match result in ${tournamentName}`,
    `/tournaments/${tournamentId}`,
    { tournamentId, matchId, actorName: scorerName },
    EXPIRY_DAYS.standard);
}

// ── Achievement ──

export function createAchievementUnlockedNotif(
  userId: string, achievementName: string, description: string, achievementId: string,
): AppNotification {
  return makeNotif(userId, 'achievement', 'achievement_unlocked',
    `Achievement unlocked: ${achievementName}`,
    '/profile',
    { achievementId },
    EXPIRY_DAYS.long);
}

// ── Disputes ──

export function createDisputeFlaggedNotif(
  userId: string, tournamentId: string, tournamentName: string, matchId: string, reason: string,
): AppNotification {
  return makeNotif(userId, 'tournament', 'dispute_flagged',
    `A match in ${tournamentName} has been disputed: ${reason}`,
    `/tournaments/${tournamentId}`,
    { tournamentId, matchId },
    EXPIRY_DAYS.standard);
}

export function createDisputeResolvedNotif(
  userId: string, tournamentId: string, tournamentName: string, matchId: string, resolution: string, type: 'edited' | 'dismissed',
): AppNotification {
  return makeNotif(userId, 'tournament', 'dispute_resolved',
    `Your dispute in ${tournamentName} was ${type === 'edited' ? 'resolved (score edited)' : 'dismissed'}: ${resolution}`,
    `/tournaments/${tournamentId}`,
    { tournamentId, matchId },
    EXPIRY_DAYS.standard);
}

// ── Stats ──

export function createTierUpNotif(
  userId: string, fromTier: string, toTier: string,
): AppNotification {
  return makeNotif(userId, 'stats', 'tier_up',
    `You've been promoted to ${toTier}!`,
    '/profile',
    { tierFrom: fromTier, tierTo: toTier },
    EXPIRY_DAYS.standard);
}

export function createTierDownNotif(
  userId: string, fromTier: string, toTier: string,
): AppNotification {
  return makeNotif(userId, 'stats', 'tier_down',
    `Your tier has changed to ${toTier}`,
    '/profile',
    { tierFrom: fromTier, tierTo: toTier },
    EXPIRY_DAYS.standard);
}
