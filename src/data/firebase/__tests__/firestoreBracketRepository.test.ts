import { describe, it, expect, vi } from 'vitest';

// Mock Firebase modules before importing the repository
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDocs: vi.fn(() => ({ docs: [] })),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(() => null),
}));

vi.mock('../../firebase/config', () => ({
  firestore: {},
}));

import { firestoreBracketRepository } from '../firestoreBracketRepository';

describe('firestoreBracketRepository', () => {
  it('exports save method', () => {
    expect(typeof firestoreBracketRepository.save).toBe('function');
  });
  it('exports getByTournament method', () => {
    expect(typeof firestoreBracketRepository.getByTournament).toBe('function');
  });
  it('exports updateResult method', () => {
    expect(typeof firestoreBracketRepository.updateResult).toBe('function');
  });
});
