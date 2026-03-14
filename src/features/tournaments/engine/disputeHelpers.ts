import type { Tournament } from '../../../data/types';
import { hasMinRole } from './roleHelpers';

export function canFlagDispute(
  tournament: Tournament,
  userId: string,
  matchParticipantIds: string[],
): boolean {
  if (hasMinRole(tournament, userId, 'moderator')) return true;
  return matchParticipantIds.includes(userId);
}

export function canResolveDispute(tournament: Tournament, userId: string): boolean {
  return hasMinRole(tournament, userId, 'moderator');
}
