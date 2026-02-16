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
  makeBuddyNotification,
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
// BUDDY NOTIFICATIONS (/users/{userId}/buddyNotifications/{notifId})
// ═══════════════════════════════════════════════════════════════════════

describe('BuddyNotifications (/users/{userId}/buddyNotifications/{notifId})', () => {
  const userId = 'user-1';
  const otherUserId = 'user-2';
  const notifPath = (uid: string) => `users/${uid}/buddyNotifications/n1`;

  // ── Create ──────────────────────────────────────────────────────────

  it('allows authenticated user to create notification with valid fields', async () => {
    const db = authedContext(otherUserId).firestore();
    await assertSucceeds(
      setDoc(doc(db, notifPath(userId)), makeBuddyNotification(userId)),
    );
  });

  it('denies create with mismatched userId field', async () => {
    const db = authedContext(otherUserId).firestore();
    await assertFails(
      setDoc(doc(db, notifPath(userId)), makeBuddyNotification('wrong-user')),
    );
  });

  it('denies create with invalid notification type', async () => {
    const db = authedContext(otherUserId).firestore();
    await assertFails(
      setDoc(doc(db, notifPath(userId)), makeBuddyNotification(userId, { type: 'hacked_type' })),
    );
  });

  it('denies create with read set to true', async () => {
    const db = authedContext(otherUserId).firestore();
    await assertFails(
      setDoc(doc(db, notifPath(userId)), makeBuddyNotification(userId, { read: true })),
    );
  });

  it('denies create with non-string message', async () => {
    const db = authedContext(otherUserId).firestore();
    await assertFails(
      setDoc(doc(db, notifPath(userId)), makeBuddyNotification(userId, { message: 123 })),
    );
  });

  it('denies unauthenticated notification creation', async () => {
    const db = unauthedContext().firestore();
    await assertFails(
      setDoc(doc(db, notifPath(userId)), makeBuddyNotification(userId)),
    );
  });

  // ── Read ────────────────────────────────────────────────────────────

  it('allows user to read own notifications', async () => {
    await seedDoc(notifPath(userId), makeBuddyNotification(userId));
    const db = authedContext(userId).firestore();
    await assertSucceeds(getDoc(doc(db, notifPath(userId))));
  });

  it('denies reading another user notifications', async () => {
    await seedDoc(notifPath(userId), makeBuddyNotification(userId));
    const db = authedContext(otherUserId).firestore();
    await assertFails(getDoc(doc(db, notifPath(userId))));
  });

  it('denies unauthenticated read', async () => {
    await seedDoc(notifPath(userId), makeBuddyNotification(userId));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, notifPath(userId))));
  });

  // ── Update (e.g., mark as read) ────────────────────────────────────

  it('allows user to update own notification', async () => {
    await seedDoc(notifPath(userId), makeBuddyNotification(userId));
    const db = authedContext(userId).firestore();
    await assertSucceeds(
      updateDoc(doc(db, notifPath(userId)), { read: true }),
    );
  });

  it('denies updating another user notification', async () => {
    await seedDoc(notifPath(userId), makeBuddyNotification(userId));
    const db = authedContext(otherUserId).firestore();
    await assertFails(
      updateDoc(doc(db, notifPath(userId)), { read: true }),
    );
  });

  // ── Delete ──────────────────────────────────────────────────────────

  it('allows user to delete own notification', async () => {
    await seedDoc(notifPath(userId), makeBuddyNotification(userId));
    const db = authedContext(userId).firestore();
    await assertSucceeds(deleteDoc(doc(db, notifPath(userId))));
  });

  it('denies deleting another user notification', async () => {
    await seedDoc(notifPath(userId), makeBuddyNotification(userId));
    const db = authedContext(otherUserId).firestore();
    await assertFails(deleteDoc(doc(db, notifPath(userId))));
  });

  it('denies unauthenticated delete', async () => {
    await seedDoc(notifPath(userId), makeBuddyNotification(userId));
    const db = unauthedContext().firestore();
    await assertFails(deleteDoc(doc(db, notifPath(userId))));
  });
});
