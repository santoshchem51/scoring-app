import type { GameType } from '../../../data/types';

interface TournamentFormInput {
  name: string;
  date: string;
  location: string;
  maxPlayers: string;
  gameType: GameType;
}

export type TournamentFormErrors = Partial<Record<keyof TournamentFormInput, string>>;

export function validateTournamentForm(input: TournamentFormInput): TournamentFormErrors {
  const errors: TournamentFormErrors = {};
  const trimmedName = input.name.trim();

  // Name: 3-60 chars
  if (trimmedName.length < 3) {
    errors.name = 'Name must be at least 3 characters';
  } else if (trimmedName.length > 60) {
    errors.name = 'Name must be 60 characters or less';
  }

  // Date: required + not in past
  if (!input.date) {
    errors.date = 'Date is required';
  } else {
    const selected = new Date(input.date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selected < today) {
      errors.date = 'Date must be today or in the future';
    }
  }

  // Location: optional, max 60
  if (input.location.trim().length > 60) {
    errors.location = 'Location must be 60 characters or less';
  }

  // Max players: optional, but if provided must be valid
  if (input.maxPlayers.trim() !== '') {
    const n = parseInt(input.maxPlayers, 10);
    if (isNaN(n)) {
      errors.maxPlayers = 'Must be a valid number';
    } else if (n < 4) {
      errors.maxPlayers = 'Must be at least 4 players';
    } else if (n > 128) {
      errors.maxPlayers = 'Must be 128 players or less';
    } else if (input.gameType === 'doubles' && n % 2 !== 0) {
      errors.maxPlayers = 'Must be an even number for doubles';
    }
  }

  return errors;
}
