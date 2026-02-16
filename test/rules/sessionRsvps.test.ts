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
  makeGameSession,
  makeSessionRsvp,
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
// SESSION RSVPs (/gameSessions/{sid}/rsvps/{userId})
// ═══════════════════════════════════════════════════════════════════════

describe('Session RSVPs (/gameSessions/{sid}/rsvps/{userId})', () => {
  const creatorId = 'creator-1';
  const userId = 'user-1';
  const otherUserId = 'user-2';
  const sessionPath = 'gameSessions/s1';
  const rsvpPath = (uid: string) => `gameSessions/s1/rsvps/${uid}`;

  beforeEach(async () => {
    await seedDoc(sessionPath, makeGameSession(creatorId));
  });

  // ── Create ──────────────────────────────────────────────────────────

  it('allows user to create own RSVP', async () => {
    const db = authedContext(userId).firestore();
    await assertSucceeds(
      setDoc(doc(db, rsvpPath(userId)), makeSessionRsvp(userId)),
    );
  });

  it('denies creating RSVP for someone else', async () => {
    const db = authedContext(userId).firestore();
    await assertFails(
      setDoc(doc(db, rsvpPath(otherUserId)), makeSessionRsvp(otherUserId)),
    );
  });

  it('denies create with mismatched userId field', async () => {
    const db = authedContext(userId).firestore();
    await assertFails(
      setDoc(doc(db, rsvpPath(userId)), makeSessionRsvp('wrong-user')),
    );
  });

  it('denies unauthenticated RSVP creation', async () => {
    const db = unauthedContext().firestore();
    await assertFails(
      setDoc(doc(db, rsvpPath(userId)), makeSessionRsvp(userId)),
    );
  });

  // ── Read ────────────────────────────────────────────────────────────

  it('allows any authenticated user to read RSVPs', async () => {
    await seedDoc(rsvpPath(userId), makeSessionRsvp(userId));
    const db = authedContext(otherUserId).firestore();
    await assertSucceeds(getDoc(doc(db, rsvpPath(userId))));
  });

  it('denies unauthenticated read of RSVPs', async () => {
    await seedDoc(rsvpPath(userId), makeSessionRsvp(userId));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, rsvpPath(userId))));
  });

  // ── Update ──────────────────────────────────────────────────────────

  it('allows user to update own RSVP', async () => {
    await seedDoc(rsvpPath(userId), makeSessionRsvp(userId));
    const db = authedContext(userId).firestore();
    await assertSucceeds(
      updateDoc(doc(db, rsvpPath(userId)), { response: 'out' }),
    );
  });

  it('denies updating someone else RSVP', async () => {
    await seedDoc(rsvpPath(userId), makeSessionRsvp(userId));
    const db = authedContext(otherUserId).firestore();
    await assertFails(
      updateDoc(doc(db, rsvpPath(userId)), { response: 'out' }),
    );
  });

  // ── Delete ──────────────────────────────────────────────────────────

  it('allows user to delete own RSVP', async () => {
    await seedDoc(rsvpPath(userId), makeSessionRsvp(userId));
    const db = authedContext(userId).firestore();
    await assertSucceeds(deleteDoc(doc(db, rsvpPath(userId))));
  });

  it('denies deleting someone else RSVP', async () => {
    await seedDoc(rsvpPath(userId), makeSessionRsvp(userId));
    const db = authedContext(otherUserId).firestore();
    await assertFails(deleteDoc(doc(db, rsvpPath(userId))));
  });

  it('denies unauthenticated delete', async () => {
    await seedDoc(rsvpPath(userId), makeSessionRsvp(userId));
    const db = unauthedContext().firestore();
    await assertFails(deleteDoc(doc(db, rsvpPath(userId))));
  });
});
