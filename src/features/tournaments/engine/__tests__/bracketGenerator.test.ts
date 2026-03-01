import { describe, it, expect } from 'vitest';
import { generateBracket } from '../bracketGenerator';

describe('generateBracket', () => {
  it('generates correct slots for 4 teams', () => {
    const slots = generateBracket('t1', ['A', 'B', 'C', 'D']);
    expect(slots).toHaveLength(3);
  });

  it('generates correct slots for 8 teams', () => {
    const slots = generateBracket('t1', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(slots).toHaveLength(7);
  });

  it('seeds first round correctly (1v4, 2v3 for 4 teams)', () => {
    const slots = generateBracket('t1', ['S1', 'S2', 'S3', 'S4']);
    const firstRound = slots.filter((s) => s.round === 1);
    expect(firstRound).toHaveLength(2);
    const matchups = firstRound.map((s) => [s.team1Id, s.team2Id]);
    expect(matchups).toContainEqual(['S1', 'S4']);
    expect(matchups).toContainEqual(['S2', 'S3']);
  });

  it('final round slots have no nextSlotId', () => {
    const slots = generateBracket('t1', ['A', 'B', 'C', 'D']);
    const maxRound = Math.max(...slots.map((s) => s.round));
    const finals = slots.filter((s) => s.round === maxRound);
    expect(finals).toHaveLength(1);
    expect(finals[0].nextSlotId).toBeNull();
  });

  it('first round slots link to next round', () => {
    const slots = generateBracket('t1', ['A', 'B', 'C', 'D']);
    const firstRound = slots.filter((s) => s.round === 1);
    for (const slot of firstRound) { expect(slot.nextSlotId).not.toBeNull(); }
  });

  it('later round slots have null teams (to be filled)', () => {
    const slots = generateBracket('t1', ['A', 'B', 'C', 'D']);
    const finalSlot = slots.find((s) => s.round === 2);
    expect(finalSlot?.team1Id).toBeNull();
    expect(finalSlot?.team2Id).toBeNull();
  });

  it('handles non-power-of-2 teams with byes', () => {
    const slots = generateBracket('t1', ['A', 'B', 'C', 'D', 'E', 'F']);
    expect(slots).toHaveLength(7);
    const firstRound = slots.filter((s) => s.round === 1);
    const byes = firstRound.filter((s) => s.team1Id === null || s.team2Id === null);
    expect(byes).toHaveLength(2);
  });

  it('generates 1 slot (the final) for 2 teams', () => {
    const slots = generateBracket('t1', ['A', 'B']);
    expect(slots).toHaveLength(1);
    expect(slots[0].round).toBe(1);
    expect(slots[0].team1Id).toBe('A');
    expect(slots[0].team2Id).toBe('B');
    expect(slots[0].nextSlotId).toBeNull();
  });

  it('pads 3 teams to 4, producing 3 slots with 1 bye', () => {
    const slots = generateBracket('t1', ['A', 'B', 'C']);
    expect(slots).toHaveLength(3);
    const firstRound = slots.filter((s) => s.round === 1);
    expect(firstRound).toHaveLength(2);
    const byes = firstRound.filter((s) => s.team1Id === null || s.team2Id === null);
    expect(byes).toHaveLength(1);
    // All 3 real teams should appear in first round
    const allTeams = firstRound.flatMap((s) => [s.team1Id, s.team2Id]).filter(Boolean);
    expect(allTeams).toContain('A');
    expect(allTeams).toContain('B');
    expect(allTeams).toContain('C');
  });

  it('throws for 1 team (no valid bracket can be formed)', () => {
    // nextPowerOf2(1) = 1, log2(1) = 0 rounds, slotsByRound is empty,
    // so accessing slotsByRound[0] fails — callers should provide >= 2 teams
    expect(() => generateBracket('t1', ['A'])).toThrow();
  });

  it('places seed 1 and seed 2 on opposite halves of the bracket', () => {
    const teamIds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
    const slots = generateBracket('t1', teamIds);

    const firstRound = slots.filter((s) => s.round === 1);
    // Top half: positions 0-1, Bottom half: positions 2-3
    const topHalfTeams = firstRound.filter((s) => s.position < 2).flatMap((s) => [s.team1Id, s.team2Id]);

    // Seed 1 (s1) and seed 2 (s2) must be in DIFFERENT halves
    const s1InTop = topHalfTeams.includes('s1');
    const s2InTop = topHalfTeams.includes('s2');
    expect(s1InTop).not.toBe(s2InTop);
  });
});
