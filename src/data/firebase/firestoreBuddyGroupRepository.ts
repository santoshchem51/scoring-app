import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, collectionGroup, query, where, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { firestore } from './config';
import type { BuddyGroup, BuddyGroupMember } from '../types';

export const firestoreBuddyGroupRepository = {
  async create(group: BuddyGroup): Promise<void> {
    const ref = doc(firestore, 'buddyGroups', group.id);
    await setDoc(ref, { ...group, updatedAt: serverTimestamp() });
  },

  async get(groupId: string): Promise<BuddyGroup | null> {
    const snap = await getDoc(doc(firestore, 'buddyGroups', groupId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as BuddyGroup;
  },

  async update(groupId: string, data: Partial<BuddyGroup>): Promise<void> {
    const ref = doc(firestore, 'buddyGroups', groupId);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  },

  async delete(groupId: string): Promise<void> {
    await deleteDoc(doc(firestore, 'buddyGroups', groupId));
  },

  async getByShareCode(code: string): Promise<BuddyGroup | null> {
    const q = query(collection(firestore, 'buddyGroups'), where('shareCode', '==', code));
    const snap = await getDocs(q);
    if (snap.docs.length === 0) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as BuddyGroup;
  },

  async addMember(groupId: string, member: BuddyGroupMember): Promise<void> {
    const batch = writeBatch(firestore);
    const memberRef = doc(firestore, 'buddyGroups', groupId, 'members', member.userId);
    const groupRef = doc(firestore, 'buddyGroups', groupId);
    batch.set(memberRef, member);
    batch.update(groupRef, { memberCount: increment(1), updatedAt: serverTimestamp() });
    await batch.commit();
  },

  async removeMember(groupId: string, userId: string): Promise<void> {
    const batch = writeBatch(firestore);
    const memberRef = doc(firestore, 'buddyGroups', groupId, 'members', userId);
    const groupRef = doc(firestore, 'buddyGroups', groupId);
    batch.delete(memberRef);
    batch.update(groupRef, { memberCount: increment(-1), updatedAt: serverTimestamp() });
    await batch.commit();
  },

  async getMembers(groupId: string): Promise<BuddyGroupMember[]> {
    const snap = await getDocs(collection(firestore, 'buddyGroups', groupId, 'members'));
    return snap.docs.map((d) => d.data() as BuddyGroupMember);
  },

  async getMember(groupId: string, userId: string): Promise<BuddyGroupMember | null> {
    const snap = await getDoc(doc(firestore, 'buddyGroups', groupId, 'members', userId));
    if (!snap.exists()) return null;
    return snap.data() as BuddyGroupMember;
  },

  async getGroupsForUser(userId: string): Promise<string[]> {
    const q = query(collectionGroup(firestore, 'members'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.ref.parent.parent!.id);
  },
};
