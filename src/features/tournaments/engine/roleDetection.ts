import type { Tournament, TournamentRegistration } from '../../../data/types';

export type ViewerRole = 'organizer' | 'scorekeeper' | 'player' | 'spectator';

/**
 * Maps staff roles to legacy ViewerRole for backward compatibility.
 * Components should gradually migrate to hasMinRole() from roleHelpers.ts.
 */
export function detectViewerRole(
  tournament: Tournament,
  userId: string | null,
  registrations: TournamentRegistration[],
): ViewerRole {
  if (!userId) return 'spectator';
  if (tournament.organizerId === userId) return 'organizer';
  // NOTE: All staff roles (admin, moderator, scorekeeper) collapse to 'scorekeeper'
  // for ViewerRole. Role-specific permissions use hasMinRole() from roleHelpers.ts instead.
  if (tournament.staff[userId]) return 'scorekeeper';
  if (registrations.some((r) => r.userId === userId)) return 'player';
  return 'spectator';
}
