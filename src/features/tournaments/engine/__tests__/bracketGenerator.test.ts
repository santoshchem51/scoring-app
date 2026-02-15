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
});
