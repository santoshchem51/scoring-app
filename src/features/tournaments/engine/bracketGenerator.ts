import type { BracketSlot } from '../../../data/types';

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function standardSeeding(bracketSize: number): Array<[number, number]> {
  // Build positions iteratively so top seeds land on opposite halves.
  // For bracketSize=8: [0,3,1,2] -> pairs (0v7, 3v4, 1v6, 2v5) = 1v8, 4v5, 2v7, 3v6
  let positions = [0];
  while (positions.length < bracketSize / 2) {
    const nextRoundSize = positions.length * 2;
    const newPositions: number[] = [];
    for (const pos of positions) {
      newPositions.push(pos);
      newPositions.push(nextRoundSize - 1 - pos);
    }
    positions = newPositions;
  }
  return positions.map((pos) => [pos, bracketSize - 1 - pos] as [number, number]);
}

/**
 * Generate a single-elimination bracket.
 * Teams ordered by seed (index 0 = top seed).
 * Non-power-of-2 counts get byes (null team slots).
 */
export function generateBracket(tournamentId: string, seededTeamIds: string[]): BracketSlot[] {
  const bracketSize = nextPowerOf2(seededTeamIds.length);
  const totalRounds = Math.log2(bracketSize);
  const slots: BracketSlot[] = [];

  const teams: Array<string | null> = [...seededTeamIds];
  while (teams.length < bracketSize) teams.push(null);

  let slotCounter = 0;
  const slotsByRound: BracketSlot[][] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    const roundSlots: BracketSlot[] = [];
    for (let pos = 0; pos < matchesInRound; pos++) {
      roundSlots.push({
        id: `slot-${slotCounter++}`,
        tournamentId,
        round,
        position: pos,
        team1Id: null,
        team2Id: null,
        matchId: null,
        winnerId: null,
        nextSlotId: null,
      });
    }
    slotsByRound.push(roundSlots);
    slots.push(...roundSlots);
  }

  for (let r = 0; r < slotsByRound.length - 1; r++) {
    const currentRound = slotsByRound[r];
    const nextRound = slotsByRound[r + 1];
    for (let i = 0; i < currentRound.length; i++) {
      currentRound[i].nextSlotId = nextRound[Math.floor(i / 2)].id;
    }
  }

  const firstRound = slotsByRound[0];
  const pairs = standardSeeding(bracketSize);
  for (let i = 0; i < firstRound.length; i++) {
    const [seedA, seedB] = pairs[i];
    firstRound[i].team1Id = teams[seedA];
    firstRound[i].team2Id = teams[seedB];
  }

  return slots;
}
