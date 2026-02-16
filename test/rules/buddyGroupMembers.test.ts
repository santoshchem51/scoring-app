import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
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
// BUDDY GROUP MEMBERS (/buddyGroups/{gid}/members/{userId})
// ═══════════════════════════════════════════════════════════════════════

describe('BuddyGroup Members (/buddyGroups/{gid}/members/{userId})', () => {
  const adminId = 'admin-1';
  const memberId = 'member-1';
  const newUserId = 'new-user-1';
  const strangerId = 'stranger-1';
  const groupPath = 'buddyGroups/g1';
  const memberPath = (uid: string) => `buddyGroups/g1/members/${uid}`;

  beforeEach(async () => {
    // Seed a group with an admin member
    await seedDoc(groupPath, makeBuddyGroup(adminId));
    await seedDoc(memberPath(adminId), makeBuddyMember(adminId, { role: 'admin' }));
  });

  // ── Create (add member) ─────────────────────────────────────────────

  it('allows admin to add any member', async () => {
    const db = authedContext(adminId).firestore();
    await assertSucceeds(
      setDoc(doc(db, memberPath(newUserId)), makeBuddyMember(newUserId)),
    );
  });

  it('allows user to add themselves', async () => {
    const db = authedContext(newUserId).firestore();
    await assertSucceeds(
      setDoc(doc(db, memberPath(newUserId)), makeBuddyMember(newUserId)),
    );
  });

  it('denies non-admin from adding someone else', async () => {
    // memberId is a regular member, trying to add newUserId
    await seedDoc(memberPath(memberId), makeBuddyMember(memberId, { role: 'member' }));
    const db = authedContext(memberId).firestore();
    await assertFails(
      setDoc(doc(db, memberPath(newUserId)), makeBuddyMember(newUserId)),
    );
  });

  it('denies create with mismatched userId field', async () => {
    const db = authedContext(newUserId).firestore();
    await assertFails(
      setDoc(doc(db, memberPath(newUserId)), makeBuddyMember('wrong-user')),
    );
  });

  it('denies unauthenticated member creation', async () => {
    const db = unauthedContext().firestore();
    await assertFails(
      setDoc(doc(db, memberPath(newUserId)), makeBuddyMember(newUserId)),
    );
  });

  // ── Read ────────────────────────────────────────────────────────────

  it('allows group member to read members list', async () => {
    await seedDoc(memberPath(memberId), makeBuddyMember(memberId));
    const db = authedContext(memberId).firestore();
    await assertSucceeds(getDoc(doc(db, memberPath(adminId))));
  });

  it('denies non-member from reading members list', async () => {
    const db = authedContext(strangerId).firestore();
    await assertFails(getDoc(doc(db, memberPath(adminId))));
  });

  it('denies unauthenticated read of members', async () => {
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, memberPath(adminId))));
  });

  // ── Delete (remove member) ──────────────────────────────────────────

  it('allows admin to remove any member', async () => {
    await seedDoc(memberPath(memberId), makeBuddyMember(memberId));
    const db = authedContext(adminId).firestore();
    await assertSucceeds(deleteDoc(doc(db, memberPath(memberId))));
  });

  it('allows user to remove themselves', async () => {
    await seedDoc(memberPath(memberId), makeBuddyMember(memberId));
    const db = authedContext(memberId).firestore();
    await assertSucceeds(deleteDoc(doc(db, memberPath(memberId))));
  });

  it('denies non-admin from removing someone else', async () => {
    await seedDoc(memberPath(memberId), makeBuddyMember(memberId));
    await seedDoc(memberPath(newUserId), makeBuddyMember(newUserId));
    const db = authedContext(memberId).firestore();
    await assertFails(deleteDoc(doc(db, memberPath(newUserId))));
  });

  it('denies unauthenticated delete', async () => {
    await seedDoc(memberPath(memberId), makeBuddyMember(memberId));
    const db = unauthedContext().firestore();
    await assertFails(deleteDoc(doc(db, memberPath(memberId))));
  });
});
