import type { Tournament, TournamentRegistration } from '../../../data/types';

export type ViewerRole = 'organizer' | 'scorekeeper' | 'player' | 'spectator';

export function detectViewerRole(
  tournament: Tournament,
  userId: string | null,
  registrations: TournamentRegistration[],
): ViewerRole {
  if (!userId) return 'spectator';
  if (tournament.organizerId === userId) return 'organizer';
  if (tournament.scorekeeperIds.includes(userId)) return 'scorekeeper';
  if (registrations.some((r) => r.userId === userId)) return 'player';
  return 'spectator';
}
