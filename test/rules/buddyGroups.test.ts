import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  setupTestEnv,
  teardownTestEnv,
  clearFirestore,
  authedContext,
  unauthedContext,
  assertSucceeds,
  assertFails,
  getTestEnv,
  makeBuddyGroup,
  makeBuddyMember,
} from './helpers';

// ── Setup & teardown ────────────────────────────────────────────────────

beforeAll(async () => {
  await setupTestEnv();
});

afterAll(async () => {
  await teardownTestEnv();
});

beforeEach(async () => {
  await clearFirestore();
});

// Helper to seed data using the admin context (bypasses rules)
async function seedDoc(path: string, data: Record<string, unknown>) {
  await getTestEnv().withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, path), data);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// BUDDY GROUPS (/buddyGroups/{groupId})
// ═══════════════════════════════════════════════════════════════════════

describe('BuddyGroups (/buddyGroups/{groupId})', () => {
  const creatorId = 'creator-1';
  const memberId = 'member-1';
  const strangerId = 'stranger-1';
  const groupPath = 'buddyGroups/g1';
  const memberDocPath = (gid: string, uid: string) => `buddyGroups/${gid}/members/${uid}`;

  // ── Create ──────────────────────────────────────────────────────────

  it('allows authenticated user to create group with valid fields', async () => {
    const db = authedContext(creatorId).firestore();
    await assertSucceeds(
      setDoc(doc(db, groupPath), makeBuddyGroup(creatorId)),
    );
  });

  it('denies creation with wrong createdBy', async () => {
    const db = authedContext(strangerId).firestore();
    await assertFails(
      setDoc(doc(db, groupPath), makeBuddyGroup(creatorId)),
    );
  });

  it('denies creation with memberCount != 0', async () => {
    const db = authedContext(creatorId).firestore();
    await assertFails(
      setDoc(doc(db, groupPath), makeBuddyGroup(creatorId, { memberCount: 1 })),
    );
  });

  it('denies creation with empty name', async () => {
    const db = authedContext(creatorId).firestore();
    await assertFails(
      setDoc(doc(db, groupPath), makeBuddyGroup(creatorId, { name: '' })),
    );
  });

  it('denies creation with name > 50 characters', async () => {
    const db = authedContext(creatorId).firestore();
    await assertFails(
      setDoc(doc(db, groupPath), makeBuddyGroup(creatorId, { name: 'A'.repeat(51) })),
    );
  });

  it('allows creation with name exactly 50 characters', async () => {
    const db = authedContext(creatorId).firestore();
    await assertSucceeds(
      setDoc(doc(db, groupPath), makeBuddyGroup(creatorId, { name: 'A'.repeat(50) })),
    );
  });

  it('denies creation with invalid visibility', async () => {
    const db = authedContext(creatorId).firestore();
    await assertFails(
      setDoc(doc(db, groupPath), makeBuddyGroup(creatorId, { visibility: 'secret' })),
    );
  });

  it('denies unauthenticated creation', async () => {
    const db = unauthedContext().firestore();
    await assertFails(
      setDoc(doc(db, groupPath), makeBuddyGroup(creatorId)),
    );
  });

  // ── Read ────────────────────────────────────────────────────────────

  it('allows member to read their private group', async () => {
    await seedDoc(groupPath, makeBuddyGroup(creatorId, { visibility: 'private' }));
    await seedDoc(memberDocPath('g1', memberId), makeBuddyMember(memberId));
    const db = authedContext(memberId).firestore();
    await assertSucceeds(getDoc(doc(db, groupPath)));
  });

  it('denies non-member from reading private group', async () => {
    await seedDoc(groupPath, makeBuddyGroup(creatorId, { visibility: 'private' }));
    const db = authedContext(strangerId).firestore();
    await assertFails(getDoc(doc(db, groupPath)));
  });

  it('allows any authenticated user to read public group', async () => {
    await seedDoc(groupPath, makeBuddyGroup(creatorId, { visibility: 'public' }));
    const db = authedContext(strangerId).firestore();
    await assertSucceeds(getDoc(doc(db, groupPath)));
  });

  it('denies unauthenticated read of public group', async () => {
    await seedDoc(groupPath, makeBuddyGroup(creatorId, { visibility: 'public' }));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, groupPath)));
  });

  // ── Update ──────────────────────────────────────────────────────────

  it('allows admin to update group', async () => {
    await seedDoc(groupPath, makeBuddyGroup(creatorId));
    await seedDoc(memberDocPath('g1', creatorId), makeBuddyMember(creatorId, { role: 'admin' }));
    const db = authedContext(creatorId).firestore();
    await assertSucceeds(
      updateDoc(doc(db, groupPath), { name: 'Updated Name', createdBy: creatorId }),
    );
  });

  it('denies regular member from updating group', async () => {
    await seedDoc(groupPath, makeBuddyGroup(creatorId));
    await seedDoc(memberDocPath('g1', memberId), makeBuddyMember(memberId, { role: 'member' }));
    const db = authedContext(memberId).firestore();
    await assertFails(
      updateDoc(doc(db, groupPath), { name: 'Hacked Name', createdBy: creatorId }),
    );
  });

  it('denies non-member from updating group', async () => {
    await seedDoc(groupPath, makeBuddyGroup(creatorId));
    const db = authedContext(strangerId).firestore();
    await assertFails(
      updateDoc(doc(db, groupPath), { name: 'Hacked Name', createdBy: creatorId }),
    );
  });

  it('denies admin from changing createdBy on update', async () => {
    await seedDoc(groupPath, makeBuddyGroup(creatorId));
    await seedDoc(memberDocPath('g1', creatorId), makeBuddyMember(creatorId, { role: 'admin' }));
    const db = authedContext(creatorId).firestore();
    await assertFails(
      updateDoc(doc(db, groupPath), { createdBy: strangerId }),
    );
  });

  // ── Delete ──────────────────────────────────────────────────────────

  it('allows admin to delete group', async () => {
    await seedDoc(groupPath, makeBuddyGroup(creatorId));
    await seedDoc(memberDocPath('g1', creatorId), makeBuddyMember(creatorId, { role: 'admin' }));
    const db = authedContext(creatorId).firestore();
    await assertSucceeds(deleteDoc(doc(db, groupPath)));
  });

  it('denies regular member from deleting group', async () => {
    await seedDoc(groupPath, makeBuddyGroup(creatorId));
    await seedDoc(memberDocPath('g1', memberId), makeBuddyMember(memberId, { role: 'member' }));
    const db = authedContext(memberId).firestore();
    await assertFails(deleteDoc(doc(db, groupPath)));
  });

  it('denies non-member from deleting group', async () => {
    await seedDoc(groupPath, makeBuddyGroup(creatorId));
    const db = authedContext(strangerId).firestore();
    await assertFails(deleteDoc(doc(db, groupPath)));
  });

  it('denies unauthenticated delete', async () => {
    await seedDoc(groupPath, makeBuddyGroup(creatorId));
    const db = unauthedContext().firestore();
    await assertFails(deleteDoc(doc(db, groupPath)));
  });
});
