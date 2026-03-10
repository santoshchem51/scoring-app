import type { Tournament, TournamentRole } from '../../../data/types';

export type EffectiveRole = TournamentRole | 'owner';

const ROLE_LEVELS: Record<EffectiveRole, number> = {
  scorekeeper: 1,
  moderator: 2,
  admin: 3,
  owner: 4,
};

export function getTournamentRole(tournament: Tournament, uid: string): EffectiveRole | null {
  if (tournament.organizerId === uid) return 'owner';
  return tournament.staff[uid] ?? null;
}

export function hasMinRole(tournament: Tournament, uid: string, minimum: EffectiveRole): boolean {
  const role = getTournamentRole(tournament, uid);
  if (!role) return false;
  return ROLE_LEVELS[role] >= ROLE_LEVELS[minimum];
}
