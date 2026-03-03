import { describe, it, expect } from 'vitest';
import type { BuddyGroupMember } from '../../../../data/types';
import {
  deduplicateBuddies,
  filterValidMembers,
  excludeSelf,
  buildTeamArrays,
} from '../buddyPickerHelpers';

function makeMember(overrides: Partial<BuddyGroupMember> = {}): BuddyGroupMember {
  return {
    userId: 'user-1',
    displayName: 'Alice',
    photoURL: null,
    role: 'member',
    joinedAt: Date.now(),
    ...overrides,
  };
}

describe('buddyPickerHelpers', () => {
  describe('deduplicateBuddies', () => {
    it('removes duplicate members by userId', () => {
      const members = [
        makeMember({ userId: 'u1', displayName: 'Alice' }),
        makeMember({ userId: 'u1', displayName: 'Alice (Group 2)' }),
        makeMember({ userId: 'u2', displayName: 'Bob' }),
      ];
      const result = deduplicateBuddies(members);
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('u1');
      expect(result[1].userId).toBe('u2');
    });

    it('returns empty array for empty input', () => {
      expect(deduplicateBuddies([])).toEqual([]);
    });
  });

  describe('filterValidMembers', () => {
    it('removes members with empty userId', () => {
      const members = [
        makeMember({ userId: '' }),
        makeMember({ userId: 'u1' }),
      ];
      expect(filterValidMembers(members)).toHaveLength(1);
    });

    it('removes members with undefined-like userId', () => {
      const members = [
        makeMember({ userId: undefined as unknown as string }),
        makeMember({ userId: 'u1' }),
      ];
      expect(filterValidMembers(members)).toHaveLength(1);
    });
  });

  describe('excludeSelf', () => {
    it('removes current user from list', () => {
      const members = [
        makeMember({ userId: 'me' }),
        makeMember({ userId: 'other' }),
      ];
      expect(excludeSelf(members, 'me')).toHaveLength(1);
      expect(excludeSelf(members, 'me')[0].userId).toBe('other');
    });
  });

  describe('buildTeamArrays', () => {
    it('splits assignments into team1 and team2 arrays', () => {
      const assignments: Record<string, 1 | 2> = { 'u1': 1, 'u2': 2, 'u3': 1 };
      const result = buildTeamArrays(assignments);
      expect(result.team1).toEqual(['u1', 'u3']);
      expect(result.team2).toEqual(['u2']);
    });

    it('adds scorer to correct team when playing', () => {
      const assignments: Record<string, 1 | 2> = { 'u1': 1 };
      const result = buildTeamArrays(assignments, { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 2 });
      expect(result.team1).toEqual(['u1']);
      expect(result.team2).toEqual(['scorer']);
    });

    it('excludes scorer when spectator', () => {
      const assignments: Record<string, 1 | 2> = { 'u1': 1 };
      const result = buildTeamArrays(assignments, { scorerUid: 'scorer', scorerRole: 'spectator', scorerTeam: 1 });
      expect(result.team1).toEqual(['u1']);
      expect(result.team2).toEqual([]);
    });

    it('computes sharedWith as all buddy UIDs (excludes scorer)', () => {
      const assignments: Record<string, 1 | 2> = { 'u1': 1, 'u2': 2 };
      const result = buildTeamArrays(assignments, { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 1 });
      expect(result.sharedWith).toEqual(['u1', 'u2']);
    });

    it('returns empty arrays for empty assignments', () => {
      const result = buildTeamArrays({});
      expect(result.team1).toEqual([]);
      expect(result.team2).toEqual([]);
      expect(result.sharedWith).toEqual([]);
    });
  });
});
