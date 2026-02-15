import { describe, it, expect } from 'vitest';
import { firestorePoolRepository } from '../firestorePoolRepository';

describe('firestorePoolRepository', () => {
  it('exports save method', () => { expect(typeof firestorePoolRepository.save).toBe('function'); });
  it('exports getByTournament method', () => { expect(typeof firestorePoolRepository.getByTournament).toBe('function'); });
  it('exports updateStandings method', () => { expect(typeof firestorePoolRepository.updateStandings).toBe('function'); });
});
