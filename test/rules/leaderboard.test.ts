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
  makeLeaderboardEntry,
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
// LEADERBOARD (/leaderboard/{uid})
// ═══════════════════════════════════════════════════════════════════════

describe('Leaderboard (/leaderboard/{uid})', () => {
  const uid = 'user-1';
  const otherUid = 'user-2';

  // ── Read ────────────────────────────────────────────────────────────

  it('allows authenticated user to read any leaderboard entry', async () => {
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid));
    const db = authedContext('reader').firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertSucceeds(getDoc(ref));
  });

  it('allows user to read another user leaderboard entry', async () => {
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid));
    const db = authedContext(otherUid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertSucceeds(getDoc(ref));
  });

  it('denies unauthenticated read', async () => {
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid));
    const db = unauthedContext().firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(getDoc(ref));
  });

  // ── Create ──────────────────────────────────────────────────────────

  it('allows owner to create own leaderboard entry', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertSucceeds(setDoc(ref, makeLeaderboardEntry(uid)));
  });

  it('allows authenticated user to create entry for another user (cross-user tournament writes)', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', otherUid);
    await assertSucceeds(setDoc(ref, makeLeaderboardEntry(otherUid)));
  });

  it('denies unauthenticated create', async () => {
    const db = unauthedContext().firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(setDoc(ref, makeLeaderboardEntry(uid)));
  });

  // ── Create field validation ─────────────────────────────────────────

  it('denies create with empty displayName', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(setDoc(ref, makeLeaderboardEntry(uid, { displayName: '' })));
  });

  it('denies create with displayName too long (256+ chars)', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(setDoc(ref, makeLeaderboardEntry(uid, { displayName: 'A'.repeat(256) })));
  });

  it('allows create with displayName at max length (255 chars)', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertSucceeds(setDoc(ref, makeLeaderboardEntry(uid, { displayName: 'A'.repeat(255) })));
  });

  it('denies create when compositeScore > 100', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(setDoc(ref, makeLeaderboardEntry(uid, { compositeScore: 101 })));
  });

  it('denies create when compositeScore < 0', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(setDoc(ref, makeLeaderboardEntry(uid, { compositeScore: -1 })));
  });

  it('denies create when winRate > 1', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(setDoc(ref, makeLeaderboardEntry(uid, { winRate: 1.5 })));
  });

  it('denies create when winRate < 0', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(setDoc(ref, makeLeaderboardEntry(uid, { winRate: -0.1 })));
  });

  it('denies create when wins > totalMatches', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(setDoc(ref, makeLeaderboardEntry(uid, { wins: 20, totalMatches: 10 })));
  });

  it('denies create with invalid tier', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(setDoc(ref, makeLeaderboardEntry(uid, { tier: 'godmode' })));
  });

  it('allows create with all valid tier values', async () => {
    const tiers = ['beginner', 'intermediate', 'advanced', 'expert'];
    for (let i = 0; i < tiers.length; i++) {
      const tierUid = `tier-user-${i}`;
      const db = authedContext(tierUid).firestore();
      const ref = doc(db, 'leaderboard', tierUid);
      await assertSucceeds(setDoc(ref, makeLeaderboardEntry(tierUid, { tier: tiers[i] })));
    }
  });

  // ── Nested last30d validation on create ─────────────────────────────

  it('denies create when last30d.winRate > 1', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(setDoc(ref, makeLeaderboardEntry(uid, {
      last30d: { totalMatches: 5, wins: 3, winRate: 1.5, compositeScore: 50 },
    })));
  });

  it('denies create when last30d.compositeScore > 100', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(setDoc(ref, makeLeaderboardEntry(uid, {
      last30d: { totalMatches: 5, wins: 3, winRate: 0.6, compositeScore: 150 },
    })));
  });

  it('denies create when last30d is not a map', async () => {
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(setDoc(ref, makeLeaderboardEntry(uid, { last30d: 'not-a-map' })));
  });

  // ── Update ──────────────────────────────────────────────────────────

  it('allows owner to update own leaderboard entry', async () => {
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid));
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertSucceeds(updateDoc(ref, {
      wins: 7,
      totalMatches: 11,
      winRate: 7 / 11,
      compositeScore: 60,
      last30d: { totalMatches: 6, wins: 4, winRate: 4 / 6, compositeScore: 55 },
    }));
  });

  it('allows authenticated user to update another user leaderboard entry (cross-user tournament writes)', async () => {
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid));
    const db = authedContext(otherUid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertSucceeds(updateDoc(ref, {
      compositeScore: 60,
      last30d: { totalMatches: 5, wins: 3, winRate: 0.6, compositeScore: 50 },
    }));
  });

  // ── createdAt immutability on update ────────────────────────────────

  it('denies update that changes createdAt', async () => {
    const originalCreatedAt = Date.now();
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid, { createdAt: originalCreatedAt }));
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(updateDoc(ref, { createdAt: originalCreatedAt + 1000 }));
  });

  it('allows update that preserves createdAt', async () => {
    const originalCreatedAt = Date.now();
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid, { createdAt: originalCreatedAt }));
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertSucceeds(updateDoc(ref, {
      compositeScore: 60,
      createdAt: originalCreatedAt,
      last30d: { totalMatches: 5, wins: 3, winRate: 0.6, compositeScore: 50 },
    }));
  });

  // ── Update field validation ─────────────────────────────────────────

  it('denies update when compositeScore > 100', async () => {
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid));
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(updateDoc(ref, {
      compositeScore: 101,
      last30d: { totalMatches: 5, wins: 3, winRate: 0.6, compositeScore: 50 },
    }));
  });

  it('denies update when winRate > 1', async () => {
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid));
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(updateDoc(ref, {
      winRate: 1.5,
      last30d: { totalMatches: 5, wins: 3, winRate: 0.6, compositeScore: 50 },
    }));
  });

  it('denies update with invalid tier', async () => {
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid));
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(updateDoc(ref, {
      tier: 'godmode',
      last30d: { totalMatches: 5, wins: 3, winRate: 0.6, compositeScore: 50 },
    }));
  });

  // ── Delete ──────────────────────────────────────────────────────────

  it('allows owner to delete own leaderboard entry', async () => {
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid));
    const db = authedContext(uid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertSucceeds(deleteDoc(ref));
  });

  it('denies deleting another user leaderboard entry', async () => {
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid));
    const db = authedContext(otherUid).firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(deleteDoc(ref));
  });

  it('denies unauthenticated delete', async () => {
    await seedDoc(`leaderboard/${uid}`, makeLeaderboardEntry(uid));
    const db = unauthedContext().firestore();
    const ref = doc(db, 'leaderboard', uid);
    await assertFails(deleteDoc(ref));
  });
});
