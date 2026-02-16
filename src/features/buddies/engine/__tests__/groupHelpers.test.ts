import { describe, it, expect } from 'vitest';
import {
  canManageGroup,
  canJoinGroup,
  createDefaultSession,
  validateGroupName,
} from '../groupHelpers';
import type { BuddyGroup, BuddyGroupMember } from '../../../../data/types';

function makeGroup(overrides: Partial<BuddyGroup> = {}): BuddyGroup {
  return {
    id: 'g1',
    name: 'Test Group',
    description: 'A test group',
    createdBy: 'u1',
    defaultLocation: 'Park',
    defaultDay: 'tuesday',
    defaultTime: '18:00',
    memberCount: 3,
    visibility: 'private',
    shareCode: 'GRP123',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeMember(overrides: Partial<BuddyGroupMember> = {}): BuddyGroupMember {
  return {
    userId: 'u1',
    displayName: 'Test User',
    photoURL: null,
    role: 'member',
    joinedAt: Date.now(),
    ...overrides,
  };
}

describe('canManageGroup', () => {
  it('returns true for admin', () => {
    expect(canManageGroup(makeMember({ role: 'admin' }))).toBe(true);
  });

  it('returns false for regular member', () => {
    expect(canManageGroup(makeMember({ role: 'member' }))).toBe(false);
  });
});

describe('canJoinGroup', () => {
  it('returns true for public group when not a member', () => {
    const group = makeGroup({ visibility: 'public' });
    expect(canJoinGroup(group, false)).toBe(true);
  });

  it('returns false when already a member', () => {
    const group = makeGroup({ visibility: 'public' });
    expect(canJoinGroup(group, true)).toBe(false);
  });

  it('returns false for private group without share code', () => {
    const group = makeGroup({ visibility: 'private' });
    expect(canJoinGroup(group, false)).toBe(false);
  });

  it('returns true for private group with matching share code', () => {
    const group = makeGroup({ visibility: 'private', shareCode: 'GRP123' });
    expect(canJoinGroup(group, false, 'GRP123')).toBe(true);
  });

  it('returns false for private group with wrong share code', () => {
    const group = makeGroup({ visibility: 'private', shareCode: 'GRP123' });
    expect(canJoinGroup(group, false, 'WRONG')).toBe(false);
  });
});

describe('createDefaultSession', () => {
  it('pre-fills from group defaults', () => {
    const group = makeGroup({
      defaultLocation: 'Riverside Park',
      defaultDay: 'tuesday',
      defaultTime: '18:00',
    });
    const result = createDefaultSession(group);
    expect(result.location).toBe('Riverside Park');
    expect(result.groupId).toBe('g1');
  });

  it('uses empty string when no default location', () => {
    const group = makeGroup({ defaultLocation: null });
    const result = createDefaultSession(group);
    expect(result.location).toBe('');
  });
});

describe('validateGroupName', () => {
  it('returns null for valid name', () => {
    expect(validateGroupName('Tuesday Crew')).toBeNull();
  });

  it('returns error for empty name', () => {
    expect(validateGroupName('')).toBe('Group name is required');
  });

  it('returns error for whitespace-only name', () => {
    expect(validateGroupName('   ')).toBe('Group name is required');
  });

  it('returns error for name over 50 characters', () => {
    expect(validateGroupName('A'.repeat(51))).toBe('Group name must be 50 characters or less');
  });
});
