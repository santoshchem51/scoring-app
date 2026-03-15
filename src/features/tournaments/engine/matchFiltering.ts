import type { TournamentPool, BracketSlot } from '../../../data/types';

export interface PoolMatchInfo {
  matchId: string;
  team1Id: string;
  team2Id: string;
  court: string | null;
  round: number;
  poolName: string;
  poolId: string;
}

export interface BracketMatchInfo {
  matchId: string;
  team1Id: string | null;
  team2Id: string | null;
  round: number;
  position: number;
  slotId: string;
}

export interface InProgressMatches {
  poolMatches: PoolMatchInfo[];
  bracketMatches: BracketMatchInfo[];
}

export function getInProgressMatches(
  pools: TournamentPool[],
  bracket: BracketSlot[],
): InProgressMatches {
  const poolMatches: PoolMatchInfo[] = [];

  for (const pool of pools) {
    for (const entry of pool.schedule) {
      if (entry.matchId != null) {
        poolMatches.push({
          matchId: entry.matchId,
          team1Id: entry.team1Id,
          team2Id: entry.team2Id,
          court: entry.court,
          round: entry.round,
          poolName: pool.name,
          poolId: pool.id,
        });
      }
    }
  }

  const bracketMatches: BracketMatchInfo[] = [];

  for (const slot of bracket) {
    if (slot.matchId != null && slot.winnerId == null) {
      bracketMatches.push({
        matchId: slot.matchId,
        team1Id: slot.team1Id,
        team2Id: slot.team2Id,
        round: slot.round,
        position: slot.position,
        slotId: slot.id,
      });
    }
  }

  return { poolMatches, bracketMatches };
}
