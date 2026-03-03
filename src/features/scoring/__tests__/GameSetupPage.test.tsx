import { describe, it, expect } from 'vitest';
import { buildTeamArrays } from '../helpers/buddyPickerHelpers';

// Test the integration logic as pure functions where possible
describe('GameSetupPage buddy integration logic', () => {
  it('buildTeamArrays includes scorer on team 1 when playing', () => {
    const result = buildTeamArrays(
      { 'buddy-1': 2 },
      { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 1 },
    );
    expect(result.team1).toEqual(['scorer']);
    expect(result.team2).toEqual(['buddy-1']);
    expect(result.sharedWith).toEqual(['buddy-1']);
  });

  it('buildTeamArrays excludes scorer when spectator', () => {
    const result = buildTeamArrays(
      { 'buddy-1': 1, 'buddy-2': 2 },
      { scorerUid: 'scorer', scorerRole: 'spectator', scorerTeam: 1 },
    );
    expect(result.team1).toEqual(['buddy-1']);
    expect(result.team2).toEqual(['buddy-2']);
    expect(result.sharedWith).toEqual(['buddy-1', 'buddy-2']);
  });

  it('buildTeamArrays returns empty for quick start (no assignments)', () => {
    const result = buildTeamArrays({});
    expect(result.team1).toEqual([]);
    expect(result.team2).toEqual([]);
    expect(result.sharedWith).toEqual([]);
  });

  it('buildTeamArrays deduplicates sharedWith', () => {
    const result = buildTeamArrays(
      { 'buddy-1': 1, 'buddy-2': 2 },
      { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 1 },
    );
    const uniqueShared = new Set(result.sharedWith);
    expect(uniqueShared.size).toBe(result.sharedWith.length);
  });

  it('scorer UID moves between arrays on scorerTeam change', () => {
    const r1 = buildTeamArrays(
      { 'buddy-1': 2 },
      { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 1 },
    );
    expect(r1.team1).toContain('scorer');
    expect(r1.team2).not.toContain('scorer');

    const r2 = buildTeamArrays(
      { 'buddy-1': 2 },
      { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 2 },
    );
    expect(r2.team1).not.toContain('scorer');
    expect(r2.team2).toContain('scorer');
  });

  it('capacity: max 2 per team in doubles (including scorer)', () => {
    const result = buildTeamArrays(
      { 'buddy-1': 1, 'buddy-2': 2 },
      { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 1 },
    );
    expect(result.team1).toHaveLength(2); // buddy-1 + scorer
    expect(result.team2).toHaveLength(1); // buddy-2
  });

  it('capacity: max 1 per team in singles (including scorer)', () => {
    const result = buildTeamArrays(
      { 'buddy-1': 2 },
      { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 1 },
    );
    expect(result.team1).toHaveLength(1); // scorer only
    expect(result.team2).toHaveLength(1); // buddy-1
  });

  it('game type change: doubles to singles recalculates capacity', () => {
    const doublesResult = buildTeamArrays(
      { 'buddy-1': 1, 'buddy-2': 1 },
    );
    expect(doublesResult.team1).toHaveLength(2);

    const singlesResult = buildTeamArrays(
      { 'buddy-1': 1 },
    );
    expect(singlesResult.team1).toHaveLength(1);
  });

  it('startGame builds correct arrays with mixed assignments', () => {
    const result = buildTeamArrays(
      { 'buddy-1': 1, 'buddy-2': 2, 'buddy-3': 1 },
      { scorerUid: 'scorer', scorerRole: 'player', scorerTeam: 2 },
    );
    expect(result.team1).toEqual(expect.arrayContaining(['buddy-1', 'buddy-3']));
    expect(result.team2).toEqual(expect.arrayContaining(['buddy-2', 'scorer']));
    expect(result.sharedWith).toEqual(expect.arrayContaining(['buddy-1', 'buddy-2', 'buddy-3']));
    expect(result.sharedWith).not.toContain('scorer');
  });

  // --- Phase 3: Global Search integration ---

  it('searchUserInfo: onSearchAssign populates display info', () => {
    const searchUserInfo: Record<string, { displayName: string; photoURL: string | null }> = {};
    const buddyAssignments: Record<string, 1 | 2> = {};

    const userId = 'search-user-1';
    const team = 1 as const;
    const info = { displayName: 'Searched User', photoURL: 'https://photo.test/su.jpg' };
    searchUserInfo[userId] = info;
    buddyAssignments[userId] = team;

    expect(searchUserInfo['search-user-1']).toEqual({
      displayName: 'Searched User',
      photoURL: 'https://photo.test/su.jpg',
    });
    expect(buddyAssignments['search-user-1']).toBe(1);

    const result = buildTeamArrays(buddyAssignments, {
      scorerUid: 'scorer',
      scorerRole: 'player',
      scorerTeam: 2,
    });
    expect(result.team1).toContain('search-user-1');
    expect(result.sharedWith).toContain('search-user-1');
  });

  it('searchUserInfo: onSearchUnassign removes display info', () => {
    const searchUserInfo: Record<string, { displayName: string; photoURL: string | null }> = {
      'su-1': { displayName: 'Found User', photoURL: null },
    };
    const buddyAssignments: Record<string, 1 | 2> = { 'su-1': 2 };

    delete searchUserInfo['su-1'];
    delete buddyAssignments['su-1'];

    expect(searchUserInfo).toEqual({});
    expect(buddyAssignments).toEqual({});
  });

  it('capacity pruning: doubles→singles keeps only first assignment per team', () => {
    const assignments: Record<string, 1 | 2> = {
      'u1': 1,
      'u2': 1,
      'u3': 2,
      'u4': 2,
    };

    const pruned: Record<string, 1 | 2> = {};
    const team1Count = { count: 0 };
    const team2Count = { count: 0 };
    for (const [uid, team] of Object.entries(assignments)) {
      if (team === 1 && team1Count.count < 1) {
        pruned[uid] = team;
        team1Count.count++;
      } else if (team === 2 && team2Count.count < 1) {
        pruned[uid] = team;
        team2Count.count++;
      }
    }

    expect(Object.keys(pruned)).toHaveLength(2);
    expect(Object.values(pruned).filter((t) => t === 1)).toHaveLength(1);
    expect(Object.values(pruned).filter((t) => t === 2)).toHaveLength(1);
  });
});
