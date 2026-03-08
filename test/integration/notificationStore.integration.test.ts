/**
 * Integration tests for notification store Firestore operations.
 *
 * These tests verify the same data operations the notification store performs,
 * running against the Firestore emulator via @firebase/rules-unit-testing.
 *
 * Run with: firebase emulators:exec --only firestore "npx vitest run -c vitest.rules.config.ts test/integration"
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit, writeBatch,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let testEnv: RulesTestEnvironment;

const UID = 'test-user-1';

function makeNotif(overrides: Record<string, unknown> = {}) {
  return {
    userId: UID,
    type: 'session_proposed',
    category: 'buddy',
    message: 'Test notification',
    actionUrl: '/session/s1',
    payload: { actorId: 'a1', actorName: 'Alice' },
    read: false,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklescore-integration-test',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8180,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

/**
 * Seeds a notification document bypassing security rules.
 */
async function seedNotification(id: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', UID, 'notifications', id), data);
  });
}

// ════════════════════════════════════════════════════════════════════
// 1. Read-back after document creation
// ════════════════════════════════════════════════════════════════════

describe('Notification read-back', () => {
  it('reads back a seeded notification with correct data', async () => {
    const notif = makeNotif({ message: 'Hello from integration test' });
    await seedNotification('n1', notif);

    const db = testEnv.authenticatedContext(UID).firestore();
    const snap = await getDoc(doc(db, 'users', UID, 'notifications', 'n1'));

    expect(snap.exists()).toBe(true);
    const data = snap.data()!;
    expect(data.message).toBe('Hello from integration test');
    expect(data.userId).toBe(UID);
    expect(data.type).toBe('session_proposed');
    expect(data.category).toBe('buddy');
    expect(data.read).toBe(false);
    expect(data.payload).toEqual({ actorId: 'a1', actorName: 'Alice' });
  });
});

// ════════════════════════════════════════════════════════════════════
// 2. markRead round-trip
// ════════════════════════════════════════════════════════════════════

describe('markRead round-trip', () => {
  it('updates read field from false to true', async () => {
    await seedNotification('n1', makeNotif({ read: false }));

    const db = testEnv.authenticatedContext(UID).firestore();
    const ref = doc(db, 'users', UID, 'notifications', 'n1');

    // Update read to true (same operation as markNotificationRead)
    await updateDoc(ref, { read: true });

    // Read back and verify
    const snap = await getDoc(ref);
    expect(snap.exists()).toBe(true);
    expect(snap.data()!.read).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// 3. markAllNotificationsRead with multiple items
// ════════════════════════════════════════════════════════════════════

describe('markAllNotificationsRead', () => {
  it('batch-updates all unread notifications to read', async () => {
    // Seed 3 unread notifications
    await seedNotification('n1', makeNotif({ read: false, createdAt: 1000 }));
    await seedNotification('n2', makeNotif({ read: false, createdAt: 2000 }));
    await seedNotification('n3', makeNotif({ read: false, createdAt: 3000 }));

    const db = testEnv.authenticatedContext(UID).firestore();

    // Query unread (same logic as markAllNotificationsRead in the store)
    const q = query(
      collection(db, 'users', UID, 'notifications'),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(500),
    );
    const snap = await getDocs(q);
    expect(snap.docs.length).toBe(3);

    // Batch update all to read: true
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.update(d.ref, { read: true });
    }
    await batch.commit();

    // Verify all are now read
    const afterSnap = await getDocs(
      query(collection(db, 'users', UID, 'notifications'), where('read', '==', false)),
    );
    expect(afterSnap.docs.length).toBe(0);

    // Verify they still exist and are marked read
    const allSnap = await getDocs(collection(db, 'users', UID, 'notifications'));
    expect(allSnap.docs.length).toBe(3);
    for (const d of allSnap.docs) {
      expect(d.data().read).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// 4. cleanupExpiredNotifications deletes expired docs
// ════════════════════════════════════════════════════════════════════

describe('cleanupExpiredNotifications', () => {
  it('deletes expired notifications and keeps valid ones', async () => {
    const now = Date.now();

    // Seed one expired notification (expiresAt in the past)
    await seedNotification('expired-1', makeNotif({
      message: 'Old expired notification',
      expiresAt: now - 1000,
    }));

    // Seed one valid notification (expiresAt in the future)
    await seedNotification('valid-1', makeNotif({
      message: 'Still valid notification',
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    }));

    const db = testEnv.authenticatedContext(UID).firestore();

    // Query expired (same logic as cleanupExpiredNotifications in the store)
    const q = query(
      collection(db, 'users', UID, 'notifications'),
      where('expiresAt', '<=', now),
      limit(100),
    );
    const snap = await getDocs(q);
    expect(snap.docs.length).toBe(1);
    expect(snap.docs[0].id).toBe('expired-1');

    // Batch delete expired
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.delete(d.ref);
    }
    await batch.commit();

    // Verify only the valid notification remains
    const allSnap = await getDocs(collection(db, 'users', UID, 'notifications'));
    expect(allSnap.docs.length).toBe(1);
    expect(allSnap.docs[0].id).toBe('valid-1');
    expect(allSnap.docs[0].data().message).toBe('Still valid notification');
  });
});

// ════════════════════════════════════════════════════════════════════
// 5. Category query for filtered view
// ════════════════════════════════════════════════════════════════════

describe('Category query', () => {
  it('returns only notifications matching the queried category', async () => {
    // Seed notifications with different categories
    await seedNotification('buddy-1', makeNotif({
      category: 'buddy',
      type: 'session_proposed',
      message: 'Buddy notification 1',
    }));
    await seedNotification('buddy-2', makeNotif({
      category: 'buddy',
      type: 'session_confirmed',
      message: 'Buddy notification 2',
    }));
    await seedNotification('achievement-1', makeNotif({
      category: 'achievement',
      type: 'achievement_unlocked',
      message: 'Achievement unlocked!',
    }));
    await seedNotification('tournament-1', makeNotif({
      category: 'tournament',
      type: 'tournament_invitation',
      message: 'Tournament invite',
    }));

    const db = testEnv.authenticatedContext(UID).firestore();

    // Query by buddy category
    const buddyQuery = query(
      collection(db, 'users', UID, 'notifications'),
      where('category', '==', 'buddy'),
    );
    const buddySnap = await getDocs(buddyQuery);
    expect(buddySnap.docs.length).toBe(2);
    for (const d of buddySnap.docs) {
      expect(d.data().category).toBe('buddy');
    }

    // Query by achievement category
    const achievementQuery = query(
      collection(db, 'users', UID, 'notifications'),
      where('category', '==', 'achievement'),
    );
    const achievementSnap = await getDocs(achievementQuery);
    expect(achievementSnap.docs.length).toBe(1);
    expect(achievementSnap.docs[0].data().message).toBe('Achievement unlocked!');

    // Query by tournament category
    const tournamentQuery = query(
      collection(db, 'users', UID, 'notifications'),
      where('category', '==', 'tournament'),
    );
    const tournamentSnap = await getDocs(tournamentQuery);
    expect(tournamentSnap.docs.length).toBe(1);
    expect(tournamentSnap.docs[0].data().message).toBe('Tournament invite');

    // Query by stats category (should be empty)
    const statsQuery = query(
      collection(db, 'users', UID, 'notifications'),
      where('category', '==', 'stats'),
    );
    const statsSnap = await getDocs(statsQuery);
    expect(statsSnap.docs.length).toBe(0);
  });
});
