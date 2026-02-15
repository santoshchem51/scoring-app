import { describe, it, expect } from 'vitest';
import { generateRoundRobinSchedule } from '../roundRobin';

describe('generateRoundRobinSchedule', () => {
  it('generates correct number of matches for 4 teams', () => {
    const schedule = generateRoundRobinSchedule(['A', 'B', 'C', 'D']);
    expect(schedule).toHaveLength(6);
  });

  it('generates correct number of matches for 3 teams', () => {
    const schedule = generateRoundRobinSchedule(['A', 'B', 'C']);
    expect(schedule).toHaveLength(3);
  });

  it('every team plays every other team exactly once', () => {
    const teams = ['A', 'B', 'C', 'D'];
    const schedule = generateRoundRobinSchedule(teams);
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const matchCount = schedule.filter(
          (m) => (m.team1Id === teams[i] && m.team2Id === teams[j]) || (m.team1Id === teams[j] && m.team2Id === teams[i]),
        ).length;
        expect(matchCount).toBe(1);
      }
    }
  });

  it('assigns round numbers', () => {
    const schedule = generateRoundRobinSchedule(['A', 'B', 'C', 'D']);
    for (const entry of schedule) { expect(entry.round).toBeGreaterThanOrEqual(1); }
  });

  it('handles 2 teams', () => {
    const schedule = generateRoundRobinSchedule(['A', 'B']);
    expect(schedule).toHaveLength(1);
    expect(schedule[0].team1Id).toBe('A');
    expect(schedule[0].team2Id).toBe('B');
  });

  it('generates correct rounds for 4 teams (3 rounds)', () => {
    const schedule = generateRoundRobinSchedule(['A', 'B', 'C', 'D']);
    const rounds = new Set(schedule.map((m) => m.round));
    expect(rounds.size).toBe(3);
  });

  it('no team plays twice in the same round', () => {
    const schedule = generateRoundRobinSchedule(['A', 'B', 'C', 'D', 'E', 'F']);
    const roundMap = new Map<number, string[]>();
    for (const entry of schedule) {
      if (!roundMap.has(entry.round)) roundMap.set(entry.round, []);
      const teams = roundMap.get(entry.round)!;
      expect(teams).not.toContain(entry.team1Id);
      expect(teams).not.toContain(entry.team2Id);
      teams.push(entry.team1Id, entry.team2Id);
    }
  });

  it('returns empty schedule for 0 teams', () => {
    const schedule = generateRoundRobinSchedule([]);
    expect(schedule).toEqual([]);
  });

  it('returns empty schedule for 1 team (no opponents)', () => {
    const schedule = generateRoundRobinSchedule(['A']);
    expect(schedule).toEqual([]);
  });
});
