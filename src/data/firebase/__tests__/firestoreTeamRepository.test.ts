import { describe, it, expect } from 'vitest';
import { firestoreTeamRepository } from '../firestoreTeamRepository';

describe('firestoreTeamRepository', () => {
  it('exports save method', () => { expect(typeof firestoreTeamRepository.save).toBe('function'); });
  it('exports getByTournament method', () => { expect(typeof firestoreTeamRepository.getByTournament).toBe('function'); });
  it('exports delete method', () => { expect(typeof firestoreTeamRepository.delete).toBe('function'); });
  it('exports updatePool method', () => { expect(typeof firestoreTeamRepository.updatePool).toBe('function'); });
});
