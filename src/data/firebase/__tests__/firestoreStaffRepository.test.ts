import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpdateDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockDoc = vi.hoisted(() => vi.fn(() => 'mock-doc-ref'));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  updateDoc: mockUpdateDoc,
  arrayUnion: vi.fn((v) => ({ _type: 'arrayUnion', value: v })),
  arrayRemove: vi.fn((v) => ({ _type: 'arrayRemove', value: v })),
  deleteField: vi.fn(() => ({ _type: 'deleteField' })),
  serverTimestamp: vi.fn(() => 'mock-ts'),
}));

vi.mock('../config', () => ({
  firestore: 'mock-firestore',
}));

import { addStaffMember, removeStaffMember, updateStaffRole } from '../firestoreStaffRepository';

describe('firestoreStaffRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('addStaffMember sets staff role and adds to staffUids', async () => {
    await addStaffMember('tourney-1', 'user-1', 'moderator');

    expect(mockDoc).toHaveBeenCalledWith('mock-firestore', 'tournaments', 'tourney-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
      'staff.user-1': 'moderator',
    }));
    const callArgs = mockUpdateDoc.mock.calls[0][1];
    expect(callArgs.staffUids).toEqual(expect.objectContaining({ _type: 'arrayUnion', value: 'user-1' }));
    expect(callArgs.updatedAt).toBe('mock-ts');
  });

  it('removeStaffMember deletes staff entry and removes from staffUids', async () => {
    await removeStaffMember('tourney-1', 'user-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
      'staff.user-1': expect.objectContaining({ _type: 'deleteField' }),
    }));
    const callArgs = mockUpdateDoc.mock.calls[0][1];
    expect(callArgs.staffUids).toEqual(expect.objectContaining({ _type: 'arrayRemove', value: 'user-1' }));
  });

  it('updateStaffRole changes existing staff role without touching staffUids', async () => {
    await updateStaffRole('tourney-1', 'user-1', 'admin');

    expect(mockUpdateDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({
      'staff.user-1': 'admin',
      updatedAt: 'mock-ts',
    }));
    const callArgs = mockUpdateDoc.mock.calls[0][1];
    expect(callArgs.staffUids).toBeUndefined();
  });
});
