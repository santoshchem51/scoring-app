import { describe, it, expect, vi } from 'vitest';

// Mock Firebase modules before importing the repository
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(() => ({ exists: () => false })),
  getDocs: vi.fn(() => ({ docs: [] })),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => null),
}));

vi.mock('../../firebase/config', () => ({
  firestore: {},
}));

import { firestoreTournamentRepository } from '../firestoreTournamentRepository';

describe('firestoreTournamentRepository', () => {
  it('exports save method', () => {
    expect(typeof firestoreTournamentRepository.save).toBe('function');
  });
  it('exports getById method', () => {
    expect(typeof firestoreTournamentRepository.getById).toBe('function');
  });
  it('exports getByOrganizer method', () => {
    expect(typeof firestoreTournamentRepository.getByOrganizer).toBe('function');
  });
  it('exports delete method', () => {
    expect(typeof firestoreTournamentRepository.delete).toBe('function');
  });
  it('exports updateStatus method', () => {
    expect(typeof firestoreTournamentRepository.updateStatus).toBe('function');
  });
});
