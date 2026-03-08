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
  makeNotification,
  makeTournament,
  makeBuddyMember,
} from './helpers';

beforeAll(async () => {
  await setupTestEnv();
});

afterAll(async () => {
  await teardownTestEnv();
});

beforeEach(async () => {
  await clearFirestore();
});

async function seedDoc(path: string, data: Record<string, unknown>) {
  await getTestEnv().withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, path), data);
  });
}

const userId = 'user-1';
const otherUserId = 'user-2';
const organizerId = 'organizer-1';
const groupId = 'g1';
const tournamentId = 't1';
const notifPath = (uid: string, nid = 'n1') => `users/${uid}/notifications/${nid}`;

// ═══════════════════════════════════════════════════════════════
// 1. READ RULES (~3 tests)
// ═══════════════════════════════════════════════════════════════

describe('Read', () => {
  it('allows owner to read own notification', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertSucceeds(getDoc(doc(db, notifPath(userId))));
  });

  it('denies reading another user notification', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(otherUserId).firestore();
    await assertFails(getDoc(doc(db, notifPath(userId))));
  });

  it('denies unauthenticated read', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, notifPath(userId))));
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. UPDATE RULES — only 'read' field, only false→true (~8 tests)
// ═══════════════════════════════════════════════════════════════

describe('Update (mark as read)', () => {
  it('allows owner to set read: true', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertSucceeds(updateDoc(doc(db, notifPath(userId)), { read: true }));
  });

  it('denies setting read: false (un-reading)', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId, { read: true }));
    const db = authedContext(userId).firestore();
    await assertFails(updateDoc(doc(db, notifPath(userId)), { read: false }));
  });

  it('denies updating message field', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertFails(updateDoc(doc(db, notifPath(userId)), { read: true, message: 'hacked' }));
  });

  it('denies other user updating', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(otherUserId).firestore();
    await assertFails(updateDoc(doc(db, notifPath(userId)), { read: true }));
  });

  it('denies updating type field', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertFails(updateDoc(doc(db, notifPath(userId)), { read: true, type: 'group_invite' }));
  });

  it('denies updating category field', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertFails(updateDoc(doc(db, notifPath(userId)), { read: true, category: 'tournament' }));
  });

  it('denies updating payload field', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertFails(updateDoc(doc(db, notifPath(userId)), { read: true, payload: { hacked: true } }));
  });

  it('denies updating createdAt field', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertFails(updateDoc(doc(db, notifPath(userId)), { read: true, createdAt: 0 }));
  });

  it('denies updating expiresAt field', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertFails(updateDoc(doc(db, notifPath(userId)), { read: true, expiresAt: 0 }));
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. DELETE RULES (~3 tests)
// ═══════════════════════════════════════════════════════════════

describe('Delete', () => {
  it('allows owner to delete own notification', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(userId).firestore();
    await assertSucceeds(deleteDoc(doc(db, notifPath(userId))));
  });

  it('denies deleting another user notification', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = authedContext(otherUserId).firestore();
    await assertFails(deleteDoc(doc(db, notifPath(userId))));
  });

  it('denies unauthenticated delete', async () => {
    await seedDoc(notifPath(userId), makeNotification(userId));
    const db = unauthedContext().firestore();
    await assertFails(deleteDoc(doc(db, notifPath(userId))));
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. BUDDY CREATE — bidirectional group membership (~10 tests)
// ═══════════════════════════════════════════════════════════════

describe('Buddy create (with group membership)', () => {
  beforeEach(async () => {
    // Seed group membership for both users
    await seedDoc(`buddyGroups/${groupId}/members/${otherUserId}`, makeBuddyMember(otherUserId));
    await seedDoc(`buddyGroups/${groupId}/members/${userId}`, makeBuddyMember(userId));
  });

  it('allows member to create buddy notification for another member', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'session_proposed',
      payload: { sessionId: 's1', groupId },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create when writer is NOT a group member', async () => {
    const outsider = 'outsider';
    const db = authedContext(outsider).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'session_proposed',
      payload: { sessionId: 's1', groupId },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create when recipient is NOT a group member', async () => {
    const nonMember = 'non-member';
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(nonMember, {
      category: 'buddy',
      type: 'session_proposed',
      payload: { sessionId: 's1', groupId },
    });
    await assertFails(setDoc(doc(db, `users/${nonMember}/notifications/n1`), notif));
  });

  it('denies self-write for buddy notification', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'session_proposed',
      payload: { sessionId: 's1', groupId },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create with read: true', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, { read: true, payload: { sessionId: 's1', groupId } });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create with empty message', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, { message: '', payload: { sessionId: 's1', groupId } });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create with message > 500 chars', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, { message: 'x'.repeat(501), payload: { sessionId: 's1', groupId } });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create with extra fields (field injection)', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = { ...makeNotification(userId, { payload: { sessionId: 's1', groupId } }), isAdmin: true };
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create with missing payload.groupId', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'session_proposed',
      payload: { sessionId: 's1' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies create with non-string message', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      message: 12345,
      payload: { sessionId: 's1', groupId },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('allows session_confirmed type', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'session_confirmed',
      payload: { sessionId: 's1', groupId },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId, 'n2')), notif));
  });

  it('allows session_cancelled type', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'session_cancelled',
      payload: { sessionId: 's1', groupId },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId, 'n3')), notif));
  });

  it('allows session_reminder type', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'session_reminder',
      payload: { sessionId: 's1', groupId },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId, 'n4')), notif));
  });

  it('allows spot_opened type', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'spot_opened',
      payload: { sessionId: 's1', groupId },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId, 'n5')), notif));
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. GROUP_INVITE — no group membership required (~3 tests)
// ═══════════════════════════════════════════════════════════════

describe('group_invite create', () => {
  it('allows any authenticated user to send group invite', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      type: 'group_invite',
      payload: { groupId },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies unauthenticated group_invite', async () => {
    const db = unauthedContext().firestore();
    const notif = makeNotification(userId, { type: 'group_invite', payload: { groupId } });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies self-invite', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, { type: 'group_invite', payload: { groupId } });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies group_invite with read: true', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, { type: 'group_invite', read: true, payload: { groupId } });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies group_invite with empty message', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, { type: 'group_invite', message: '', payload: { groupId } });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. TOURNAMENT CREATE — organizer check (~5 tests)
// ═══════════════════════════════════════════════════════════════

describe('Tournament notification create (organizer check)', () => {
  beforeEach(async () => {
    await seedDoc(`tournaments/${tournamentId}`, makeTournament(organizerId));
  });

  it('allows organizer to create tournament_invitation', async () => {
    const db = authedContext(organizerId).firestore();
    const notif = makeNotification(userId, {
      category: 'tournament',
      type: 'tournament_invitation',
      payload: { tournamentId },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies non-organizer creating tournament notification', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'tournament',
      type: 'tournament_invitation',
      payload: { tournamentId },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('allows organizer to create match_upcoming', async () => {
    const db = authedContext(organizerId).firestore();
    const notif = makeNotification(userId, {
      category: 'tournament',
      type: 'match_upcoming',
      payload: { tournamentId, matchId: 'm1' },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies tournament notification with missing tournamentId', async () => {
    const db = authedContext(organizerId).firestore();
    const notif = makeNotification(userId, {
      category: 'tournament',
      type: 'tournament_invitation',
      payload: {},
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('allows organizer to create match_result_recorded', async () => {
    const db = authedContext(organizerId).firestore();
    const notif = makeNotification(userId, {
      category: 'tournament',
      type: 'match_result_recorded',
      payload: { tournamentId, matchId: 'm1' },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId, 'n2')), notif));
  });

  it('denies tournament notification with spoofed tournamentId', async () => {
    const db = authedContext(organizerId).firestore();
    const notif = makeNotification(userId, {
      category: 'tournament',
      type: 'tournament_invitation',
      payload: { tournamentId: 'nonexistent-tournament' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies self-write for tournament notification', async () => {
    const db = authedContext(organizerId).firestore();
    const notif = makeNotification(organizerId, {
      category: 'tournament',
      type: 'tournament_invitation',
      payload: { tournamentId },
    });
    await assertFails(setDoc(doc(db, notifPath(organizerId)), notif));
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. ACHIEVEMENT / STATS — self-write only (~6 tests)
// ═══════════════════════════════════════════════════════════════

describe('Achievement/stats self-write', () => {
  it('allows self-write for achievement_unlocked', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'achievement',
      type: 'achievement_unlocked',
      payload: { achievementId: 'century_club' },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('allows self-write for tier_up', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'stats',
      type: 'tier_up',
      payload: { tierFrom: 'beginner', tierTo: 'intermediate' },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('allows self-write for tier_down', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'stats',
      type: 'tier_down',
      payload: { tierFrom: 'advanced', tierTo: 'intermediate' },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId, 'n2')), notif));
  });

  it('denies other-user write for achievement', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'achievement',
      type: 'achievement_unlocked',
      payload: { achievementId: 'century_club' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies self-write with wrong category/type combo', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'achievement',
      type: 'session_proposed',
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies self-write for stats with read: true', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'stats',
      type: 'tier_up',
      read: true,
      payload: { tierFrom: 'beginner', tierTo: 'intermediate' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies other-user write for stats', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'stats',
      type: 'tier_up',
      payload: { tierFrom: 'beginner', tierTo: 'intermediate' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies achievement self-write with read: true', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'achievement',
      type: 'achievement_unlocked',
      read: true,
      payload: { achievementId: 'century_club' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. ATTACK VECTOR TESTS (~8 tests)
// ═══════════════════════════════════════════════════════════════

describe('Attack vectors', () => {
  it('denies spam: writing to another user without group membership', async () => {
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      payload: { sessionId: 's1', groupId: 'nonexistent-group' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies field injection: extra fields beyond allowlist', async () => {
    await seedDoc(`buddyGroups/${groupId}/members/${otherUserId}`, makeBuddyMember(otherUserId));
    await seedDoc(`buddyGroups/${groupId}/members/${userId}`, makeBuddyMember(userId));
    const db = authedContext(otherUserId).firestore();
    const notif = {
      ...makeNotification(userId, { payload: { sessionId: 's1', groupId } }),
      adminOverride: true,
    };
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies privilege escalation: buddy user writes tournament notification', async () => {
    await seedDoc(`buddyGroups/${groupId}/members/${otherUserId}`, makeBuddyMember(otherUserId));
    await seedDoc(`buddyGroups/${groupId}/members/${userId}`, makeBuddyMember(userId));
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'tournament',
      type: 'tournament_invitation',
      payload: { tournamentId: 't1' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies userId mismatch: data.userId does not match path userId', async () => {
    await seedDoc(`buddyGroups/${groupId}/members/${otherUserId}`, makeBuddyMember(otherUserId));
    await seedDoc(`buddyGroups/${groupId}/members/${userId}`, makeBuddyMember(userId));
    const db = authedContext(otherUserId).firestore();
    // Write to user-1's path but set userId to user-2
    const notif = makeNotification(otherUserId, {
      payload: { sessionId: 's1', groupId },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies type not in allowed list for buddy category', async () => {
    await seedDoc(`buddyGroups/${groupId}/members/${otherUserId}`, makeBuddyMember(otherUserId));
    await seedDoc(`buddyGroups/${groupId}/members/${userId}`, makeBuddyMember(userId));
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'invalid_type',
      payload: { sessionId: 's1', groupId },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('allows message exactly 500 chars', async () => {
    await seedDoc(`buddyGroups/${groupId}/members/${otherUserId}`, makeBuddyMember(otherUserId));
    await seedDoc(`buddyGroups/${groupId}/members/${userId}`, makeBuddyMember(userId));
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      message: 'x'.repeat(500),
      payload: { sessionId: 's1', groupId },
    });
    await assertSucceeds(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies message exactly 501 chars', async () => {
    await seedDoc(`buddyGroups/${groupId}/members/${otherUserId}`, makeBuddyMember(otherUserId));
    await seedDoc(`buddyGroups/${groupId}/members/${userId}`, makeBuddyMember(userId));
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      message: 'x'.repeat(501),
      payload: { sessionId: 's1', groupId },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies mismatched category/type: stats category with buddy type', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'stats',
      type: 'session_proposed',
      payload: { sessionId: 's1' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies buddy notification missing required groupId in payload', async () => {
    await seedDoc(`buddyGroups/${groupId}/members/${otherUserId}`, makeBuddyMember(otherUserId));
    await seedDoc(`buddyGroups/${groupId}/members/${userId}`, makeBuddyMember(userId));
    const db = authedContext(otherUserId).firestore();
    const notif = makeNotification(userId, {
      category: 'buddy',
      type: 'session_proposed',
      payload: { sessionId: 's1' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies unauthenticated create of any type', async () => {
    const db = unauthedContext().firestore();
    const notif = makeNotification(userId, {
      category: 'achievement',
      type: 'achievement_unlocked',
      payload: { achievementId: 'test' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });

  it('denies achievement category with tournament type', async () => {
    const db = authedContext(userId).firestore();
    const notif = makeNotification(userId, {
      category: 'achievement',
      type: 'tournament_invitation',
      payload: { tournamentId: 't1' },
    });
    await assertFails(setDoc(doc(db, notifPath(userId)), notif));
  });
});
