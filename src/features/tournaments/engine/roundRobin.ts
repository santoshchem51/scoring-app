import type { PoolScheduleEntry } from '../../../data/types';

/**
 * Generate a round-robin schedule using the circle method.
 * For N teams (N even): N-1 rounds, N/2 matches per round.
 * For N teams (N odd): N rounds, (N-1)/2 matches per round (one bye per round).
 */
export function generateRoundRobinSchedule(teamIds: string[]): PoolScheduleEntry[] {
  const teams = [...teamIds];
  const hasBye = teams.length % 2 !== 0;
  if (hasBye) teams.push('__BYE__');

  const n = teams.length;
  const rounds = n - 1;
  const halfN = n / 2;
  const schedule: PoolScheduleEntry[] = [];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < halfN; i++) {
      const home = i === 0 ? teams[0] : teams[((round + i - 1) % (n - 1)) + 1];
      const away = teams[((round + (n - 1) - i - 1) % (n - 1)) + 1];

      if (home === '__BYE__' || away === '__BYE__') continue;

      schedule.push({
        round: round + 1,
        team1Id: home,
        team2Id: away,
        matchId: null,
        court: null,
      });
    }
  }

  return schedule;
}
