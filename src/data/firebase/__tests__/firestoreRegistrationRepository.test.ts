import { describe, it, expect, vi } from 'vitest';

// Mock Firebase modules before importing the repository
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDocs: vi.fn(() => ({ docs: [], empty: true })),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(() => null),
}));

vi.mock('../../firebase/config', () => ({
  firestore: {},
}));

import { firestoreRegistrationRepository } from '../firestoreRegistrationRepository';

describe('firestoreRegistrationRepository', () => {
  it('exports save method', () => {
    expect(typeof firestoreRegistrationRepository.save).toBe('function');
  });
  it('exports getByTournament method', () => {
    expect(typeof firestoreRegistrationRepository.getByTournament).toBe('function');
  });
  it('exports updatePayment method', () => {
    expect(typeof firestoreRegistrationRepository.updatePayment).toBe('function');
  });
});
