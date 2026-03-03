import type { BuddyGroupMember } from '../../../data/types';

export function deduplicateBuddies(members: BuddyGroupMember[]): BuddyGroupMember[] {
  const seen = new Set<string>();
  const result: BuddyGroupMember[] = [];
  for (const m of members) {
    if (!seen.has(m.userId)) {
      seen.add(m.userId);
      result.push(m);
    }
  }
  return result;
}

export function filterValidMembers(members: BuddyGroupMember[]): BuddyGroupMember[] {
  return members.filter((m) => m.userId && typeof m.userId === 'string' && m.userId.trim().length > 0);
}

export function excludeSelf(members: BuddyGroupMember[], currentUid: string): BuddyGroupMember[] {
  return members.filter((m) => m.userId !== currentUid);
}

interface ScorerInfo {
  scorerUid: string;
  scorerRole: 'player' | 'spectator';
  scorerTeam: 1 | 2;
}

export function buildTeamArrays(
  assignments: Record<string, 1 | 2>,
  scorer?: ScorerInfo,
): { team1: string[]; team2: string[]; sharedWith: string[] } {
  const team1: string[] = [];
  const team2: string[] = [];
  const sharedWith: string[] = [];

  for (const [uid, team] of Object.entries(assignments)) {
    if (team === 1) team1.push(uid);
    else team2.push(uid);
    sharedWith.push(uid);
  }

  if (scorer && scorer.scorerRole === 'player') {
    if (scorer.scorerTeam === 1) team1.push(scorer.scorerUid);
    else team2.push(scorer.scorerUid);
  }

  return { team1, team2, sharedWith };
}
