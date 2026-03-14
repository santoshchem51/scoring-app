import type { Tournament } from '../../../data/types';
import { hasMinRole } from './roleHelpers';

// Design decision: canFlagDispute allows participants client-side,
// but Firestore rules restrict dispute creation to moderator+ only.
// This allows future relaxation without a rules deploy.
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
