import type { GameSession, SessionRsvp, TimeSlot } from '../../../data/types';

export function canRsvp(session: GameSession): boolean {
  if (session.status === 'cancelled' || session.status === 'completed') return false;
  if (session.rsvpDeadline && Date.now() > session.rsvpDeadline) return false;
  return true;
}

export function canUpdateDayOfStatus(session: GameSession, rsvp: SessionRsvp): boolean {
  if (session.status !== 'confirmed') return false;
  if (rsvp.response !== 'in') return false;
  return true;
}

export function isSessionFull(session: GameSession): boolean {
  return session.spotsConfirmed >= session.spotsTotal;
}

export function needsMorePlayers(session: GameSession): boolean {
  return session.spotsConfirmed < session.minPlayers;
}

export function shouldAutoOpen(session: GameSession): boolean {
  return session.autoOpenOnDropout && session.visibility === 'group' && needsMorePlayers(session);
}

export function getWinningSlot(slots: TimeSlot[]): TimeSlot | null {
  if (slots.length === 0) return null;
  return slots.reduce((best, slot) => (slot.voteCount > best.voteCount ? slot : best));
}

export function getSessionDisplayStatus(session: GameSession): string {
  if (session.status === 'cancelled') return 'Cancelled';
  if (session.status === 'completed') return 'Completed';
  if (isSessionFull(session)) return 'Full';
  if (needsMorePlayers(session)) return `Need ${session.minPlayers - session.spotsConfirmed} more`;
  return `${session.spotsConfirmed}/${session.spotsTotal} confirmed`;
}
