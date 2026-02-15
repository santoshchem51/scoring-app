import type { TournamentPool, BracketSlot } from '../../../data/types';

interface ValidationResult {
  valid: boolean;
  message: string | null;
}

interface BracketValidationResult extends ValidationResult {
  championId: string | null;
}

export function validatePoolCompletion(pools: TournamentPool[]): ValidationResult {
  for (const pool of pools) {
    const incomplete = pool.schedule.filter((e) => !e.matchId);
    if (incomplete.length > 0) {
      return {
        valid: false,
        message: `${incomplete.length} match(es) in ${pool.name} not yet played.`,
      };
    }
  }
  return { valid: true, message: null };
}

export function validateBracketCompletion(slots: BracketSlot[]): BracketValidationResult {
  if (slots.length === 0) {
    return { valid: false, message: 'No bracket slots found.', championId: null };
  }

  const maxRound = Math.max(...slots.map((s) => s.round));
  const finalSlot = slots.find((s) => s.round === maxRound);

  if (!finalSlot) {
    return { valid: false, message: 'No final bracket slot found.', championId: null };
  }

  if (!finalSlot.winnerId) {
    return {
      valid: false,
      message: 'The final match has not been completed yet.',
      championId: null,
    };
  }

  return { valid: true, message: null, championId: finalSlot.winnerId };
}
