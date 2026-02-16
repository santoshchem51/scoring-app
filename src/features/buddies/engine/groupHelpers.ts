import type { BuddyGroup, BuddyGroupMember } from '../../../data/types';

export function canManageGroup(member: BuddyGroupMember): boolean {
  return member.role === 'admin';
}

export function canJoinGroup(group: BuddyGroup, isMember: boolean, shareCode?: string): boolean {
  if (isMember) return false;
  if (group.visibility === 'public') return true;
  if (shareCode && group.shareCode === shareCode) return true;
  return false;
}

export function createDefaultSession(group: BuddyGroup): { groupId: string; location: string } {
  return {
    groupId: group.id,
    location: group.defaultLocation ?? '',
  };
}

export function validateGroupName(name: string): string | null {
  if (!name.trim()) return 'Group name is required';
  if (name.length > 50) return 'Group name must be 50 characters or less';
  return null;
}
