import { describe, it, expect } from 'vitest';
import { calculateMomentum, detectStreaks, getPointDistribution } from '../matchAnalytics';
import type { ScoreEvent } from '../../../../data/types';

function makeEvent(team: 1 | 2, t1: number, t2: number, type: ScoreEvent['type'] = 'POINT_SCORED'): ScoreEvent {
  return { id: `e-${t1}-${t2}`, matchId: 'm1', gameNumber: 1, timestamp: Date.now(), type, team, team1Score: t1, team2Score: t2 };
}

describe('calculateMomentum', () => {
  it('returns 50/50 for empty events', () => {
    expect(calculateMomentum([])).toEqual({ team1Pct: 50, team2Pct: 50 });
  });

  it('returns 50/50 for non-point events only', () => {
    expect(calculateMomentum([makeEvent(1, 0, 0, 'SIDE_OUT')])).toEqual({ team1Pct: 50, team2Pct: 50 });
  });

  it('calculates from last 10 points', () => {
    const events = [
      makeEvent(1, 1, 0), makeEvent(1, 2, 0), makeEvent(1, 3, 0),
      makeEvent(1, 4, 0), makeEvent(1, 5, 0), makeEvent(1, 6, 0),
      makeEvent(2, 6, 1), makeEvent(2, 6, 2), makeEvent(2, 6, 3), makeEvent(2, 6, 4),
    ];
    expect(calculateMomentum(events)).toEqual({ team1Pct: 60, team2Pct: 40 });
  });

  it('uses only last N points when window specified', () => {
    const events = [
      makeEvent(1, 1, 0), makeEvent(1, 2, 0), makeEvent(1, 3, 0),
      makeEvent(2, 3, 1), makeEvent(2, 3, 2),
    ];
    expect(calculateMomentum(events, 3)).toEqual({ team1Pct: 33, team2Pct: 67 });
  });
});

describe('detectStreaks', () => {
  it('returns null for empty events', () => {
    expect(detectStreaks([])).toBeNull();
  });

  it('detects a streak of 3+', () => {
    const events = [makeEvent(1, 1, 0), makeEvent(1, 2, 0), makeEvent(1, 3, 0)];
    expect(detectStreaks(events)).toEqual({ team: 1, length: 3 });
  });

  it('returns null for streak under 3', () => {
    const events = [makeEvent(1, 1, 0), makeEvent(2, 1, 1)];
    expect(detectStreaks(events)).toBeNull();
  });

  it('ignores non-point events in streak', () => {
    const events = [
      makeEvent(1, 1, 0), makeEvent(1, 0, 0, 'SIDE_OUT'), makeEvent(1, 2, 0), makeEvent(1, 3, 0),
    ];
    expect(detectStreaks(events)).toEqual({ team: 1, length: 3 });
  });
});

describe('getPointDistribution', () => {
  it('returns 0-0 for no events', () => {
    expect(getPointDistribution([])).toEqual({ team1: 0, team2: 0 });
  });

  it('counts points per team', () => {
    const events = [makeEvent(1, 1, 0), makeEvent(1, 2, 0), makeEvent(2, 2, 1)];
    expect(getPointDistribution(events)).toEqual({ team1: 2, team2: 1 });
  });

  it('ignores non-point events', () => {
    const events = [makeEvent(1, 1, 0), makeEvent(1, 0, 0, 'FAULT'), makeEvent(2, 1, 1)];
    expect(getPointDistribution(events)).toEqual({ team1: 1, team2: 1 });
  });
});
