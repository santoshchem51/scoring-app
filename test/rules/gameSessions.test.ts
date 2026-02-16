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
  makeGameSession,
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
// GAME SESSIONS (/gameSessions/{sessionId})
// ═══════════════════════════════════════════════════════════════════════

describe('GameSessions (/gameSessions/{sessionId})', () => {
  const creatorId = 'creator-1';
  const memberId = 'member-1';
  const strangerId = 'stranger-1';
  const sessionPath = 'gameSessions/s1';

  // ── Create ──────────────────────────────────────────────────────────

  it('allows authenticated user to create session with valid fields', async () => {
    const db = authedContext(creatorId).firestore();
    await assertSucceeds(
      setDoc(doc(db, sessionPath), makeGameSession(creatorId)),
    );
  });

  it('denies creation with wrong createdBy', async () => {
    const db = authedContext(strangerId).firestore();
    await assertFails(
      setDoc(doc(db, sessionPath), makeGameSession(creatorId)),
    );
  });

  it('denies creation with spotsConfirmed != 0', async () => {
    const db = authedContext(creatorId).firestore();
    await assertFails(
      setDoc(doc(db, sessionPath), makeGameSession(creatorId, { spotsConfirmed: 3 })),
    );
  });

  it('denies creation with status != proposed', async () => {
    const db = authedContext(creatorId).firestore();
    await assertFails(
      setDoc(doc(db, sessionPath), makeGameSession(creatorId, { status: 'confirmed' })),
    );
  });

  it('denies unauthenticated creation', async () => {
    const db = unauthedContext().firestore();
    await assertFails(
      setDoc(doc(db, sessionPath), makeGameSession(creatorId)),
    );
  });

  // ── Read ────────────────────────────────────────────────────────────

  it('allows any authenticated user to read open sessions', async () => {
    await seedDoc(sessionPath, makeGameSession(creatorId, { visibility: 'open' }));
    const db = authedContext(strangerId).firestore();
    await assertSucceeds(getDoc(doc(db, sessionPath)));
  });

  it('allows group member to read group session', async () => {
    await seedDoc('buddyGroups/g1', makeBuddyGroup(creatorId));
    await seedDoc('buddyGroups/g1/members/' + memberId, makeBuddyMember(memberId));
    await seedDoc(sessionPath, makeGameSession(creatorId, { groupId: 'g1', visibility: 'group' }));
    const db = authedContext(memberId).firestore();
    await assertSucceeds(getDoc(doc(db, sessionPath)));
  });

  it('denies non-member from reading group session', async () => {
    await seedDoc('buddyGroups/g1', makeBuddyGroup(creatorId));
    await seedDoc(sessionPath, makeGameSession(creatorId, { groupId: 'g1', visibility: 'group' }));
    const db = authedContext(strangerId).firestore();
    await assertFails(getDoc(doc(db, sessionPath)));
  });

  it('denies unauthenticated read of open session', async () => {
    await seedDoc(sessionPath, makeGameSession(creatorId, { visibility: 'open' }));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, sessionPath)));
  });

  // ── Update ──────────────────────────────────────────────────────────

  it('allows creator to update session', async () => {
    await seedDoc(sessionPath, makeGameSession(creatorId));
    const db = authedContext(creatorId).firestore();
    await assertSucceeds(
      updateDoc(doc(db, sessionPath), { title: 'Updated Title', createdBy: creatorId }),
    );
  });

  it('denies non-creator from updating session', async () => {
    await seedDoc(sessionPath, makeGameSession(creatorId));
    const db = authedContext(strangerId).firestore();
    await assertFails(
      updateDoc(doc(db, sessionPath), { title: 'Hacked Title', createdBy: creatorId }),
    );
  });

  it('denies creator from changing createdBy on update', async () => {
    await seedDoc(sessionPath, makeGameSession(creatorId));
    const db = authedContext(creatorId).firestore();
    await assertFails(
      updateDoc(doc(db, sessionPath), { createdBy: strangerId }),
    );
  });

  // ── Delete ──────────────────────────────────────────────────────────

  it('allows creator to delete session', async () => {
    await seedDoc(sessionPath, makeGameSession(creatorId));
    const db = authedContext(creatorId).firestore();
    await assertSucceeds(deleteDoc(doc(db, sessionPath)));
  });

  it('denies non-creator from deleting session', async () => {
    await seedDoc(sessionPath, makeGameSession(creatorId));
    const db = authedContext(strangerId).firestore();
    await assertFails(deleteDoc(doc(db, sessionPath)));
  });

  it('denies unauthenticated delete', async () => {
    await seedDoc(sessionPath, makeGameSession(creatorId));
    const db = unauthedContext().firestore();
    await assertFails(deleteDoc(doc(db, sessionPath)));
  });
});
