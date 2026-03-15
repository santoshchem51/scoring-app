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
  startedPoolMatches: PoolMatchInfo[];
  bracketMatches: BracketMatchInfo[];
}

/**
 * Extracts in-progress matches from pool schedules and bracket slots.
 *
 * Note: `startedPoolMatches` includes both in-progress AND completed pool matches
 * because `PoolScheduleEntry` has no completion marker — any entry with a `matchId`
 * is considered "started" but may have already finished.
 * Bracket matches are filtered more precisely (matchId present, winnerId absent).
 */
export function getInProgressMatches(
  pools: TournamentPool[],
  bracket: BracketSlot[],
): InProgressMatches {
  const startedPoolMatches: PoolMatchInfo[] = [];

  for (const pool of pools) {
    for (const entry of pool.schedule) {
      if (entry.matchId != null) {
        startedPoolMatches.push({
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

  return { startedPoolMatches, bracketMatches };
}
