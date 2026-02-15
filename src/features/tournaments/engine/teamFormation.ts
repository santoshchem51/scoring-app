import type { TournamentRegistration, TournamentTeam } from '../../../data/types';
import { autoPairByRating } from './autoPair';

interface TeamFormationResult {
  teams: TournamentTeam[];
  unmatched: TournamentRegistration[];
}

export function createTeamsFromRegistrations(
  registrations: TournamentRegistration[],
  tournamentId: string,
  mode: 'singles' | 'byop' | 'auto-pair',
  userNames?: Record<string, string>,
): TeamFormationResult {
  if (mode === 'singles') return createSinglesTeams(registrations, tournamentId, userNames);
  if (mode === 'byop') return createByopTeams(registrations, tournamentId, userNames);
  return createAutoPairTeams(registrations, tournamentId, userNames);
}

function createSinglesTeams(
  registrations: TournamentRegistration[],
  tournamentId: string,
  userNames?: Record<string, string>,
): TeamFormationResult {
  const teams: TournamentTeam[] = registrations.map((reg, i) => ({
    id: crypto.randomUUID(),
    tournamentId,
    name: userNames?.[reg.userId] ?? `Player ${i + 1}`,
    playerIds: [reg.userId],
    seed: null,
    poolId: null,
  }));
  return { teams, unmatched: [] };
}

function createByopTeams(
  registrations: TournamentRegistration[],
  tournamentId: string,
  userNames?: Record<string, string>,
): TeamFormationResult {
  const teams: TournamentTeam[] = [];
  const paired = new Set<string>();

  for (const reg of registrations) {
    if (paired.has(reg.userId) || !reg.partnerName) continue;

    const partner = registrations.find((r) =>
      !paired.has(r.userId) &&
      r.userId !== reg.userId &&
      userNames?.[r.userId]?.toLowerCase() === reg.partnerName?.toLowerCase(),
    );

    if (partner) {
      paired.add(reg.userId);
      paired.add(partner.userId);

      const name1 = userNames?.[reg.userId] ?? reg.userId;
      const name2 = userNames?.[partner.userId] ?? partner.userId;

      teams.push({
        id: crypto.randomUUID(),
        tournamentId,
        name: `${name1} & ${name2}`,
        playerIds: [reg.userId, partner.userId],
        seed: null,
        poolId: null,
      });
    }
  }

  const unmatched = registrations.filter((r) => !paired.has(r.userId));
  return { teams, unmatched };
}

function createAutoPairTeams(
  registrations: TournamentRegistration[],
  tournamentId: string,
  userNames?: Record<string, string>,
): TeamFormationResult {
  const players = registrations.map((r) => ({
    userId: r.userId,
    skillRating: r.skillRating,
  }));

  const pairs = autoPairByRating(players);
  const pairedUserIds = new Set(pairs.flatMap((p) => [p[0].userId, p[1].userId]));

  const teams: TournamentTeam[] = pairs.map((pair) => {
    const name1 = userNames?.[pair[0].userId] ?? pair[0].userId;
    const name2 = userNames?.[pair[1].userId] ?? pair[1].userId;
    return {
      id: crypto.randomUUID(),
      tournamentId,
      name: `${name1} & ${name2}`,
      playerIds: [pair[0].userId, pair[1].userId],
      seed: null,
      poolId: null,
    };
  });

  const unmatched = registrations.filter((r) => !pairedUserIds.has(r.userId));
  return { teams, unmatched };
}
