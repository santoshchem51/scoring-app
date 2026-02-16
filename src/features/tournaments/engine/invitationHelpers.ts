import type { UserProfile, TournamentInvitation, InvitationStatus, TournamentStatus } from '../../../data/types';

export function filterSearchResults(
  users: UserProfile[],
  organizerId: string,
  existingInvitations: TournamentInvitation[],
  registeredUserIds: string[],
): UserProfile[] {
  const invitedIds = new Set(existingInvitations.map((inv) => inv.invitedUserId));
  const registeredIds = new Set(registeredUserIds);

  return users.filter((u) => {
    if (u.id === organizerId) return false;
    if (invitedIds.has(u.id)) return false;
    if (registeredIds.has(u.id)) return false;
    return true;
  });
}

export function mergeAndDeduplicate(
  nameResults: UserProfile[],
  emailResults: UserProfile[],
  limit: number,
): UserProfile[] {
  const seen = new Set<string>();
  const merged: UserProfile[] = [];

  for (const user of [...nameResults, ...emailResults]) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    merged.push(user);
    if (merged.length >= limit) break;
  }

  return merged;
}

export function canAcceptInvitation(
  invitationStatus: InvitationStatus,
  tournamentStatus: TournamentStatus,
): boolean {
  if (invitationStatus !== 'pending') return false;
  return ['setup', 'registration'].includes(tournamentStatus);
}
