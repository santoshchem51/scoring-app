import type { ScoreEvent } from '../../../data/types';

export interface MomentumResult {
  team1Pct: number;
  team2Pct: number;
}

export interface StreakResult {
  team: 1 | 2;
  length: number;
}

export interface PointDistribution {
  team1: number;
  team2: number;
}

function isPoint(event: ScoreEvent): boolean {
  return event.type === 'POINT_SCORED';
}

/**
 * Calculates momentum as percentage split between teams
 * based on the last N scoring events (default 10).
 */
export function calculateMomentum(
  events: ScoreEvent[],
  window: number = 10
): MomentumResult {
  const points = events.filter(isPoint);

  if (points.length === 0) {
    return { team1Pct: 50, team2Pct: 50 };
  }

  const recent = points.slice(-window);
  const team1Count = recent.filter((e) => e.team === 1).length;
  const team2Count = recent.length - team1Count;
  const total = recent.length;

  return {
    team1Pct: Math.round((team1Count / total) * 100),
    team2Pct: Math.round((team2Count / total) * 100),
  };
}

/**
 * Detects if there is a current scoring streak of 3+ points
 * by the same team (reading from the end of the event list).
 * Non-point events are ignored.
 */
export function detectStreaks(events: ScoreEvent[]): StreakResult | null {
  const points = events.filter(isPoint);

  if (points.length === 0) {
    return null;
  }

  const lastTeam = points[points.length - 1].team;
  let length = 0;

  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].team === lastTeam) {
      length++;
    } else {
      break;
    }
  }

  return length >= 3 ? { team: lastTeam, length } : null;
}

/**
 * Counts total points scored by each team.
 * Only POINT_SCORED events are counted.
 */
export function getPointDistribution(events: ScoreEvent[]): PointDistribution {
  const points = events.filter(isPoint);

  return {
    team1: points.filter((e) => e.team === 1).length,
    team2: points.filter((e) => e.team === 2).length,
  };
}
