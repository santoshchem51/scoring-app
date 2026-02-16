import type {
  TournamentRegistration,
  TournamentTeam,
  TournamentPool,
  BracketSlot,
} from '../../../data/types';

export interface PlayerMatchInfo {
  type: 'pool' | 'bracket';
  round: number;
  opponentTeamId: string;
  opponentName: string;
  status: 'upcoming' | 'in-progress' | 'completed';
  matchId: string | null;
  won: boolean | null;
}

export interface PlayerStats {
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

export function getPlayerTeamId(
  userId: string,
  registrations: TournamentRegistration[],
  teams: TournamentTeam[],
): string | null {
  const reg = registrations.find((r) => r.userId === userId);
  if (reg?.teamId) return reg.teamId;
  const team = teams.find((t) => t.playerIds.includes(userId));
  return team?.id ?? null;
}

export function getPlayerMatches(
  teamId: string,
  pools: TournamentPool[],
  bracket: BracketSlot[],
  teamNames: Record<string, string>,
): PlayerMatchInfo[] {
  const matches: PlayerMatchInfo[] = [];

  // Pool matches
  for (const pool of pools) {
    for (const entry of pool.schedule) {
      let opponentId: string | null = null;
      if (entry.team1Id === teamId) opponentId = entry.team2Id;
      else if (entry.team2Id === teamId) opponentId = entry.team1Id;
      if (!opponentId) continue;

      let status: 'upcoming' | 'in-progress' | 'completed';
      if (!entry.matchId) status = 'upcoming';
      else status = 'completed';

      matches.push({
        type: 'pool',
        round: entry.round,
        opponentTeamId: opponentId,
        opponentName: teamNames[opponentId] ?? opponentId,
        status,
        matchId: entry.matchId,
        won: null,
      });
    }
  }

  // Bracket matches
  for (const slot of bracket) {
    let opponentId: string | null = null;
    if (slot.team1Id === teamId) opponentId = slot.team2Id;
    else if (slot.team2Id === teamId) opponentId = slot.team1Id;
    if (!opponentId) continue;

    let status: 'upcoming' | 'in-progress' | 'completed';
    let won: boolean | null = null;
    if (slot.winnerId) {
      status = 'completed';
      won = slot.winnerId === teamId;
    } else if (slot.matchId) {
      status = 'in-progress';
    } else {
      status = 'upcoming';
    }

    matches.push({
      type: 'bracket',
      round: slot.round,
      opponentTeamId: opponentId,
      opponentName: teamNames[opponentId] ?? opponentId,
      status,
      matchId: slot.matchId,
      won,
    });
  }

  return matches;
}

export function getPlayerStats(
  teamId: string,
  pools: TournamentPool[],
  bracket: BracketSlot[],
): PlayerStats {
  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;

  // Pool stats from standings
  for (const pool of pools) {
    const standing = pool.standings.find((s) => s.teamId === teamId);
    if (standing) {
      wins += standing.wins;
      losses += standing.losses;
      pointsFor += standing.pointsFor;
      pointsAgainst += standing.pointsAgainst;
    }
  }

  // Bracket stats from slots
  for (const slot of bracket) {
    if (!slot.winnerId) continue;
    if (slot.team1Id !== teamId && slot.team2Id !== teamId) continue;
    if (slot.winnerId === teamId) wins++;
    else losses++;
  }

  return {
    wins,
    losses,
    pointsFor,
    pointsAgainst,
    pointDiff: pointsFor - pointsAgainst,
  };
}
