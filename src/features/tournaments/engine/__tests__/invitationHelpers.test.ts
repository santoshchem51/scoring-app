import { describe, it, expect } from 'vitest';
import { filterSearchResults, mergeAndDeduplicate, canAcceptInvitation } from '../invitationHelpers';
import type { UserProfile, TournamentInvitation } from '../../../../data/types';

const makeUser = (id: string, name: string, email: string): UserProfile => ({
  id,
  displayName: name,
  displayNameLower: name.toLowerCase(),
  email,
  photoURL: null,
  createdAt: Date.now(),
});

const makeInvitation = (userId: string, status: 'pending' | 'accepted' | 'declined' = 'pending'): TournamentInvitation => ({
  id: `inv-${userId}`,
  tournamentId: 't1',
  invitedUserId: userId,
  invitedEmail: `${userId}@test.com`,
  invitedName: userId,
  invitedByUserId: 'org-1',
  status,
  createdAt: Date.now(),
  respondedAt: null,
});

describe('filterSearchResults', () => {
  const users = [
    makeUser('org-1', 'Organizer', 'org@test.com'),
    makeUser('u1', 'Alice', 'alice@test.com'),
    makeUser('u2', 'Bob', 'bob@test.com'),
    makeUser('u3', 'Charlie', 'charlie@test.com'),
  ];

  it('excludes the organizer', () => {
    const result = filterSearchResults(users, 'org-1', [], []);
    expect(result.map((u) => u.id)).not.toContain('org-1');
    expect(result).toHaveLength(3);
  });

  it('excludes already-invited users', () => {
    const invitations = [makeInvitation('u1')];
    const result = filterSearchResults(users, 'org-1', invitations, []);
    expect(result.map((u) => u.id)).not.toContain('u1');
    expect(result).toHaveLength(2);
  });

  it('excludes already-registered users', () => {
    const registeredUserIds = ['u2'];
    const result = filterSearchResults(users, 'org-1', [], registeredUserIds);
    expect(result.map((u) => u.id)).not.toContain('u2');
    expect(result).toHaveLength(2);
  });
});

describe('mergeAndDeduplicate', () => {
  it('merges two arrays and removes duplicates by id', () => {
    const nameResults = [makeUser('u1', 'Alice', 'alice@test.com'), makeUser('u2', 'Bob', 'bob@test.com')];
    const emailResults = [makeUser('u2', 'Bob', 'bob@test.com'), makeUser('u3', 'Charlie', 'charlie@test.com')];
    const result = mergeAndDeduplicate(nameResults, emailResults, 8);
    expect(result).toHaveLength(3);
    expect(result.map((u) => u.id)).toEqual(['u1', 'u2', 'u3']);
  });

  it('respects the limit', () => {
    const nameResults = [makeUser('u1', 'A', 'a@t.com'), makeUser('u2', 'B', 'b@t.com')];
    const emailResults = [makeUser('u3', 'C', 'c@t.com'), makeUser('u4', 'D', 'd@t.com')];
    const result = mergeAndDeduplicate(nameResults, emailResults, 3);
    expect(result).toHaveLength(3);
  });
});

describe('canAcceptInvitation', () => {
  it('returns true when invitation is pending and tournament is in registration', () => {
    expect(canAcceptInvitation('pending', 'registration')).toBe(true);
  });

  it('returns true when invitation is pending and tournament is in setup', () => {
    expect(canAcceptInvitation('pending', 'setup')).toBe(true);
  });

  it('returns false when invitation is already accepted', () => {
    expect(canAcceptInvitation('accepted', 'registration')).toBe(false);
  });

  it('returns false when invitation is already declined', () => {
    expect(canAcceptInvitation('declined', 'registration')).toBe(false);
  });

  it('returns false when tournament is past registration', () => {
    expect(canAcceptInvitation('pending', 'pool-play')).toBe(false);
  });

  it('returns false when tournament is completed', () => {
    expect(canAcceptInvitation('pending', 'completed')).toBe(false);
  });

  it('returns false when tournament is cancelled', () => {
    expect(canAcceptInvitation('pending', 'cancelled')).toBe(false);
  });
});
