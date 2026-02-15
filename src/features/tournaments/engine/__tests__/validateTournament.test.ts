import { describe, it, expect } from 'vitest';
import { validateTournamentForm } from '../validateTournament';
import type { GameType } from '../../../../data/types';

describe('validateTournamentForm', () => {
  const validInput = {
    name: 'Spring Classic',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
    location: 'City Park',
    maxPlayers: '',
    gameType: 'doubles' as GameType,
  };

  it('returns no errors for valid input', () => {
    const errors = validateTournamentForm(validInput);
    expect(errors).toEqual({});
  });

  describe('name validation', () => {
    it('requires minimum 3 characters', () => {
      const errors = validateTournamentForm({ ...validInput, name: 'AB' });
      expect(errors.name).toBe('Name must be at least 3 characters');
    });

    it('rejects empty name', () => {
      const errors = validateTournamentForm({ ...validInput, name: '' });
      expect(errors.name).toBe('Name must be at least 3 characters');
    });

    it('rejects whitespace-only name', () => {
      const errors = validateTournamentForm({ ...validInput, name: '   ' });
      expect(errors.name).toBe('Name must be at least 3 characters');
    });

    it('rejects name over 60 characters', () => {
      const errors = validateTournamentForm({ ...validInput, name: 'A'.repeat(61) });
      expect(errors.name).toBe('Name must be 60 characters or less');
    });
  });

  describe('date validation', () => {
    it('rejects empty date', () => {
      const errors = validateTournamentForm({ ...validInput, date: '' });
      expect(errors.date).toBe('Date is required');
    });

    it('rejects past date', () => {
      const errors = validateTournamentForm({ ...validInput, date: '2020-01-01' });
      expect(errors.date).toBe('Date must be today or in the future');
    });

    it('accepts today', () => {
      const today = new Date().toISOString().split('T')[0];
      const errors = validateTournamentForm({ ...validInput, date: today });
      expect(errors.date).toBeUndefined();
    });
  });

  describe('location validation', () => {
    it('allows empty location', () => {
      const errors = validateTournamentForm({ ...validInput, location: '' });
      expect(errors.location).toBeUndefined();
    });

    it('rejects location over 60 characters', () => {
      const errors = validateTournamentForm({ ...validInput, location: 'A'.repeat(61) });
      expect(errors.location).toBe('Location must be 60 characters or less');
    });
  });

  describe('maxPlayers validation', () => {
    it('allows empty (no limit)', () => {
      const errors = validateTournamentForm({ ...validInput, maxPlayers: '' });
      expect(errors.maxPlayers).toBeUndefined();
    });

    it('rejects less than 4', () => {
      const errors = validateTournamentForm({ ...validInput, maxPlayers: '3' });
      expect(errors.maxPlayers).toBe('Must be at least 4 players');
    });

    it('rejects more than 128', () => {
      const errors = validateTournamentForm({ ...validInput, maxPlayers: '200' });
      expect(errors.maxPlayers).toBe('Must be 128 players or less');
    });

    it('rejects odd number for doubles', () => {
      const errors = validateTournamentForm({ ...validInput, maxPlayers: '7', gameType: 'doubles' });
      expect(errors.maxPlayers).toBe('Must be an even number for doubles');
    });

    it('allows odd number for singles', () => {
      const errors = validateTournamentForm({ ...validInput, maxPlayers: '7', gameType: 'singles' });
      expect(errors.maxPlayers).toBeUndefined();
    });

    it('rejects non-numeric input', () => {
      const errors = validateTournamentForm({ ...validInput, maxPlayers: 'abc' });
      expect(errors.maxPlayers).toBe('Must be a valid number');
    });
  });
});
