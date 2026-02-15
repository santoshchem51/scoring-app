import type { BracketSlot } from '../../../data/types';

export interface BracketAdvanceResult {
  slotId: string;
  field: 'team1Id' | 'team2Id';
  teamId: string;
}

export function advanceBracketWinner(
  currentSlot: BracketSlot,
  winnerTeamId: string,
  allSlots: BracketSlot[],
): BracketAdvanceResult | null {
  if (!currentSlot.nextSlotId) return null;

  const nextSlot = allSlots.find((s) => s.id === currentSlot.nextSlotId);
  if (!nextSlot) return null;

  const field = currentSlot.position % 2 === 0 ? 'team1Id' : 'team2Id';
  return { slotId: nextSlot.id, field, teamId: winnerTeamId };
}
