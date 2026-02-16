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
  makeUserProfile,
  makeCloudMatch,
  makeScoreEvent,
  makeTournament,
  makeTeam,
  makePool,
  makeBracketSlot,
  makeRegistration,
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
// USERS (/users/{uid})
// ═══════════════════════════════════════════════════════════════════════

describe('Users (/users/{uid})', () => {
  const uid = 'user-1';
  const otherUid = 'user-2';

  it('allows owner to read their own profile', async () => {
    await seedDoc(`users/${uid}`, makeUserProfile(uid));
    const db = authedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(db, `users/${uid}`)));
  });

  it('allows owner to create their own profile', async () => {
    const db = authedContext(uid).firestore();
    await assertSucceeds(setDoc(doc(db, `users/${uid}`), makeUserProfile(uid)));
  });

  it('allows owner to update their display name', async () => {
    await seedDoc(`users/${uid}`, makeUserProfile(uid));
    const db = authedContext(uid).firestore();
    await assertSucceeds(updateDoc(doc(db, `users/${uid}`), { displayName: 'New Name' }));
  });

  it('allows any authenticated user to read another user profile', async () => {
    await seedDoc(`users/${uid}`, makeUserProfile(uid));
    const db = authedContext(otherUid).firestore();
    await assertSucceeds(getDoc(doc(db, `users/${uid}`)));
  });

  it('denies writing another user profile', async () => {
    const db = authedContext(otherUid).firestore();
    await assertFails(setDoc(doc(db, `users/${uid}`), makeUserProfile(uid)));
  });

  it('denies unauthenticated read', async () => {
    await seedDoc(`users/${uid}`, makeUserProfile(uid));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, `users/${uid}`)));
  });

  it('denies unauthenticated write', async () => {
    const db = unauthedContext().firestore();
    await assertFails(setDoc(doc(db, `users/${uid}`), makeUserProfile(uid)));
  });

  // ── Field validation (HIGH) ─────────────────────────────────────────

  it('denies create with mismatched id field', async () => {
    const db = authedContext(uid).firestore();
    await assertFails(setDoc(doc(db, `users/${uid}`), makeUserProfile('wrong-id')));
  });

  it('denies update changing id', async () => {
    await seedDoc(`users/${uid}`, makeUserProfile(uid));
    const db = authedContext(uid).firestore();
    await assertFails(updateDoc(doc(db, `users/${uid}`), { id: 'different-id' }));
  });

  it('denies update changing createdAt', async () => {
    await seedDoc(`users/${uid}`, makeUserProfile(uid));
    const db = authedContext(uid).firestore();
    await assertFails(updateDoc(doc(db, `users/${uid}`), { createdAt: 999 }));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// MATCHES (/matches/{id})
// ═══════════════════════════════════════════════════════════════════════

describe('Matches (/matches/{id})', () => {
  const ownerId = 'owner-1';
  const sharedUserId = 'shared-1';
  const strangerId = 'stranger-1';

  it('allows owner to create a match', async () => {
    const db = authedContext(ownerId).firestore();
    const matchData = makeCloudMatch(ownerId);
    await assertSucceeds(setDoc(doc(db, 'matches/m1'), matchData));
  });

  it('denies create when ownerId does not match auth uid', async () => {
    const db = authedContext(strangerId).firestore();
    const matchData = makeCloudMatch(ownerId);
    await assertFails(setDoc(doc(db, 'matches/m1'), matchData));
  });

  it('allows owner to read their match', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = authedContext(ownerId).firestore();
    await assertSucceeds(getDoc(doc(db, 'matches/m1')));
  });

  it('allows owner to update their match', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = authedContext(ownerId).firestore();
    await assertSucceeds(updateDoc(doc(db, 'matches/m1'), { status: 'completed' }));
  });

  it('allows owner to delete their match', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = authedContext(ownerId).firestore();
    await assertSucceeds(deleteDoc(doc(db, 'matches/m1')));
  });

  it('allows shared user to read the match', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId, { sharedWith: [sharedUserId] }));
    const db = authedContext(sharedUserId).firestore();
    await assertSucceeds(getDoc(doc(db, 'matches/m1')));
  });

  it('allows shared user to update the match', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId, { sharedWith: [sharedUserId] }));
    const db = authedContext(sharedUserId).firestore();
    await assertSucceeds(updateDoc(doc(db, 'matches/m1'), { status: 'completed' }));
  });

  it('allows public read without auth', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId, { visibility: 'public' }));
    const db = unauthedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'matches/m1')));
  });

  it('denies stranger from reading a private match', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = authedContext(strangerId).firestore();
    await assertFails(getDoc(doc(db, 'matches/m1')));
  });

  it('denies stranger from updating a match', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = authedContext(strangerId).firestore();
    await assertFails(updateDoc(doc(db, 'matches/m1'), { status: 'completed' }));
  });

  it('denies unauthenticated write on private match', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = unauthedContext().firestore();
    await assertFails(updateDoc(doc(db, 'matches/m1'), { status: 'completed' }));
  });

  it('denies unauthenticated read on private match', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, 'matches/m1')));
  });

  // ── CRITICAL: shared user cannot delete (2.1) ──────────────────────

  it('denies shared user from deleting a match', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId, { sharedWith: [sharedUserId] }));
    const db = authedContext(sharedUserId).firestore();
    await assertFails(deleteDoc(doc(db, 'matches/m1')));
  });

  // ── HIGH: ownerId immutability (2.4) ────────────────────────────────

  it('denies owner from changing ownerId on update', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = authedContext(ownerId).firestore();
    await assertFails(updateDoc(doc(db, 'matches/m1'), { ownerId: strangerId }));
  });

  it('denies shared user from changing ownerId', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId, { sharedWith: [sharedUserId] }));
    const db = authedContext(sharedUserId).firestore();
    await assertFails(updateDoc(doc(db, 'matches/m1'), { ownerId: sharedUserId }));
  });

  // ── HIGH: field validation on create (2.3) ─────────────────────────

  it('denies create with invalid visibility', async () => {
    const db = authedContext(ownerId).firestore();
    await assertFails(setDoc(doc(db, 'matches/m1'), makeCloudMatch(ownerId, { visibility: 'invalid' })));
  });

  it('denies create with invalid config.gameType', async () => {
    const db = authedContext(ownerId).firestore();
    await assertFails(setDoc(doc(db, 'matches/m1'), makeCloudMatch(ownerId, {
      config: { gameType: 'triples', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11 },
    })));
  });

  it('denies create with invalid config.pointsToWin', async () => {
    const db = authedContext(ownerId).firestore();
    await assertFails(setDoc(doc(db, 'matches/m1'), makeCloudMatch(ownerId, {
      config: { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 99 },
    })));
  });

  it('denies create with empty team1Name', async () => {
    const db = authedContext(ownerId).firestore();
    await assertFails(setDoc(doc(db, 'matches/m1'), makeCloudMatch(ownerId, { team1Name: '' })));
  });

  it('denies create with invalid status', async () => {
    const db = authedContext(ownerId).firestore();
    await assertFails(setDoc(doc(db, 'matches/m1'), makeCloudMatch(ownerId, { status: 'hacked' })));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SCORE EVENTS (/matches/{mid}/scoreEvents/{eid})
// ═══════════════════════════════════════════════════════════════════════

describe('ScoreEvents (/matches/{mid}/scoreEvents/{eid})', () => {
  const ownerId = 'owner-1';
  const sharedUserId = 'shared-1';
  const strangerId = 'stranger-1';

  it('allows match owner to write a score event', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = authedContext(ownerId).firestore();
    await assertSucceeds(setDoc(doc(db, 'matches/m1/scoreEvents/e1'), makeScoreEvent('m1')));
  });

  it('allows match owner to read score events', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    await seedDoc('matches/m1/scoreEvents/e1', makeScoreEvent('m1'));
    const db = authedContext(ownerId).firestore();
    await assertSucceeds(getDoc(doc(db, 'matches/m1/scoreEvents/e1')));
  });

  it('allows shared user to read score events', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId, { sharedWith: [sharedUserId] }));
    await seedDoc('matches/m1/scoreEvents/e1', makeScoreEvent('m1'));
    const db = authedContext(sharedUserId).firestore();
    await assertSucceeds(getDoc(doc(db, 'matches/m1/scoreEvents/e1')));
  });

  it('allows shared user to write score events', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId, { sharedWith: [sharedUserId] }));
    const db = authedContext(sharedUserId).firestore();
    await assertSucceeds(setDoc(doc(db, 'matches/m1/scoreEvents/e1'), makeScoreEvent('m1')));
  });

  it('allows public read of score events', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId, { visibility: 'public' }));
    await seedDoc('matches/m1/scoreEvents/e1', makeScoreEvent('m1'));
    const db = unauthedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'matches/m1/scoreEvents/e1')));
  });

  it('denies stranger from reading score events', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    await seedDoc('matches/m1/scoreEvents/e1', makeScoreEvent('m1'));
    const db = authedContext(strangerId).firestore();
    await assertFails(getDoc(doc(db, 'matches/m1/scoreEvents/e1')));
  });

  it('denies stranger from writing score events', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = authedContext(strangerId).firestore();
    await assertFails(setDoc(doc(db, 'matches/m1/scoreEvents/e1'), makeScoreEvent('m1')));
  });

  it('denies unauthenticated write on score events', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = unauthedContext().firestore();
    await assertFails(setDoc(doc(db, 'matches/m1/scoreEvents/e1'), makeScoreEvent('m1')));
  });

  // ── HIGH: field validation on create (3.1) ─────────────────────────

  it('denies create with mismatched matchId', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = authedContext(ownerId).firestore();
    const event = { ...makeScoreEvent('m1'), matchId: 'wrong-match' };
    await assertFails(setDoc(doc(db, 'matches/m1/scoreEvents/e1'), event));
  });

  it('denies create with invalid type', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = authedContext(ownerId).firestore();
    const event = { ...makeScoreEvent('m1'), type: 'INVALID' };
    await assertFails(setDoc(doc(db, 'matches/m1/scoreEvents/e1'), event));
  });

  it('denies create with invalid team value', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = authedContext(ownerId).firestore();
    const event = { ...makeScoreEvent('m1'), team: 3 };
    await assertFails(setDoc(doc(db, 'matches/m1/scoreEvents/e1'), event));
  });

  it('denies create with negative score', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    const db = authedContext(ownerId).firestore();
    const event = { ...makeScoreEvent('m1'), team1Score: -1 };
    await assertFails(setDoc(doc(db, 'matches/m1/scoreEvents/e1'), event));
  });

  // ── HIGH: matchId immutability on update (3.2) ─────────────────────

  it('denies update changing matchId', async () => {
    await seedDoc('matches/m1', makeCloudMatch(ownerId));
    await seedDoc('matches/m1/scoreEvents/e1', makeScoreEvent('m1'));
    const db = authedContext(ownerId).firestore();
    await assertFails(updateDoc(doc(db, 'matches/m1/scoreEvents/e1'), { matchId: 'wrong' }));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TOURNAMENTS (/tournaments/{tid})
// ═══════════════════════════════════════════════════════════════════════

describe('Tournaments (/tournaments/{tid})', () => {
  const organizerId = 'organizer-1';
  const otherId = 'other-1';

  // ── Read ────────────────────────────────────────────────────────────

  it('allows any authenticated user to read a tournament', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId));
    const db = authedContext(otherId).firestore();
    await assertSucceeds(getDoc(doc(db, 'tournaments/t1')));
  });

  it('denies unauthenticated read', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, 'tournaments/t1')));
  });

  // ── Create validation ──────────────────────────────────────────────

  it('allows create with valid fields', async () => {
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId)));
  });

  it('denies create when organizerId does not match auth uid', async () => {
    const db = authedContext(otherId).firestore();
    await assertFails(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId)));
  });

  it('denies create with empty name', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId, { name: '' })));
  });

  it('denies create with name > 100 chars', async () => {
    const db = authedContext(organizerId).firestore();
    const longName = 'A'.repeat(101);
    await assertFails(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId, { name: longName })));
  });

  it('allows create with name exactly 100 chars', async () => {
    const db = authedContext(organizerId).firestore();
    const exactName = 'A'.repeat(100);
    await assertSucceeds(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId, { name: exactName })));
  });

  it('denies create with status other than setup', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId, { status: 'registration' })));
  });

  it('denies create with invalid format', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId, { format: 'invalid' })));
  });

  it('allows create with format round-robin', async () => {
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId, { format: 'round-robin' })));
  });

  it('allows create with format single-elimination', async () => {
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(setDoc(doc(db, 'tournaments/t2'), makeTournament(organizerId, { format: 'single-elimination' })));
  });

  it('allows create with format pool-bracket', async () => {
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(setDoc(doc(db, 'tournaments/t3'), makeTournament(organizerId, { format: 'pool-bracket' })));
  });

  // ── HIGH: additional field validation on create (4.1, 4.2) ─────────

  it('denies create with non-number date', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId, { date: 'not-a-date' })));
  });

  it('denies create with non-string location', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId, { location: 123 })));
  });

  it('denies create with invalid config.gameType', async () => {
    const db = authedContext(organizerId).firestore();
    const badConfig = { gameType: 'triples', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 11, poolCount: 2, teamsPerPoolAdvancing: 2 };
    await assertFails(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId, { config: badConfig })));
  });

  it('denies create with invalid config.pointsToWin', async () => {
    const db = authedContext(organizerId).firestore();
    const badConfig = { gameType: 'doubles', scoringMode: 'sideout', matchFormat: 'single', pointsToWin: 99, poolCount: 2, teamsPerPoolAdvancing: 2 };
    await assertFails(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId, { config: badConfig })));
  });

  it('denies create with non-list scorekeeperIds', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId, { scorekeeperIds: 'not-a-list' })));
  });

  // ── Status transitions ──────────────────────────────────────────────

  it('allows setup -> registration', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId, { status: 'setup' }));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, 'tournaments/t1'), { status: 'registration', organizerId }));
  });

  it('allows setup -> cancelled', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId, { status: 'setup' }));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, 'tournaments/t1'), { status: 'cancelled', organizerId }));
  });

  it('denies setup -> completed (invalid transition)', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId, { status: 'setup' }));
    const db = authedContext(organizerId).firestore();
    await assertFails(updateDoc(doc(db, 'tournaments/t1'), { status: 'completed', organizerId }));
  });

  it('allows registration -> pool-play', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId, { status: 'registration' }));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, 'tournaments/t1'), { status: 'pool-play', organizerId }));
  });

  it('allows registration -> bracket', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId, { status: 'registration' }));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, 'tournaments/t1'), { status: 'bracket', organizerId }));
  });

  it('allows pool-play -> bracket', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId, { status: 'pool-play' }));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, 'tournaments/t1'), { status: 'bracket', organizerId }));
  });

  it('allows pool-play -> completed', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId, { status: 'pool-play' }));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, 'tournaments/t1'), { status: 'completed', organizerId }));
  });

  it('allows bracket -> completed', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId, { status: 'bracket' }));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, 'tournaments/t1'), { status: 'completed', organizerId }));
  });

  it('allows paused -> completed (end early)', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId, { status: 'paused' }));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, 'tournaments/t1'), { status: 'completed', organizerId }));
  });

  it('allows update without changing status (e.g., updating name)', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, 'tournaments/t1'), { name: 'New Name', organizerId, status: 'setup' }));
  });

  // ── organizerId immutability ────────────────────────────────────────

  it('denies changing organizerId on update', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId));
    const db = authedContext(organizerId).firestore();
    await assertFails(updateDoc(doc(db, 'tournaments/t1'), { organizerId: otherId, status: 'setup' }));
  });

  // ── Non-organizer cannot update ─────────────────────────────────────

  it('denies non-organizer from updating tournament', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId));
    const db = authedContext(otherId).firestore();
    await assertFails(updateDoc(doc(db, 'tournaments/t1'), { name: 'Hacked', organizerId, status: 'setup' }));
  });

  // ── HIGH: field validation on update (4.5) ─────────────────────────

  it('denies update with empty name', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId));
    const db = authedContext(organizerId).firestore();
    await assertFails(updateDoc(doc(db, 'tournaments/t1'), { name: '', organizerId, status: 'setup' }));
  });

  it('denies update with invalid format', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId));
    const db = authedContext(organizerId).firestore();
    await assertFails(updateDoc(doc(db, 'tournaments/t1'), { format: 'invalid', organizerId, status: 'setup' }));
  });

  // ── Delete ──────────────────────────────────────────────────────────

  it('allows organizer to delete tournament', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(deleteDoc(doc(db, 'tournaments/t1')));
  });

  it('denies non-organizer from deleting tournament', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId));
    const db = authedContext(otherId).firestore();
    await assertFails(deleteDoc(doc(db, 'tournaments/t1')));
  });

  it('denies unauthenticated delete', async () => {
    await seedDoc('tournaments/t1', makeTournament(organizerId));
    const db = unauthedContext().firestore();
    await assertFails(deleteDoc(doc(db, 'tournaments/t1')));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TEAMS (/tournaments/{tid}/teams/{id})
// ═══════════════════════════════════════════════════════════════════════

describe('Teams (/tournaments/{tid}/teams/{id})', () => {
  const organizerId = 'organizer-1';
  const scorekeeperId = 'scorekeeper-1';
  const randomUser = 'random-1';
  const tourneyPath = 'tournaments/t1';
  const teamPath = `${tourneyPath}/teams/team1`;

  beforeEach(async () => {
    await seedDoc(tourneyPath, makeTournament(organizerId, { scorekeeperIds: [scorekeeperId] }));
  });

  it('allows any authed user to read teams', async () => {
    await seedDoc(teamPath, makeTeam('t1'));
    const db = authedContext(randomUser).firestore();
    await assertSucceeds(getDoc(doc(db, teamPath)));
  });

  it('denies unauthenticated read of teams', async () => {
    await seedDoc(teamPath, makeTeam('t1'));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, teamPath)));
  });

  it('allows organizer to create a team', async () => {
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(setDoc(doc(db, teamPath), makeTeam('t1')));
  });

  it('denies non-organizer from creating a team', async () => {
    const db = authedContext(randomUser).firestore();
    await assertFails(setDoc(doc(db, teamPath), makeTeam('t1')));
  });

  it('denies scorekeeper from creating a team', async () => {
    const db = authedContext(scorekeeperId).firestore();
    await assertFails(setDoc(doc(db, teamPath), makeTeam('t1')));
  });

  it('allows organizer to update a team', async () => {
    await seedDoc(teamPath, makeTeam('t1'));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, teamPath), { name: 'Updated Team' }));
  });

  it('allows scorekeeper to update team seed', async () => {
    await seedDoc(teamPath, makeTeam('t1'));
    const db = authedContext(scorekeeperId).firestore();
    await assertSucceeds(updateDoc(doc(db, teamPath), { seed: 1 }));
  });

  it('denies scorekeeper from updating team name', async () => {
    await seedDoc(teamPath, makeTeam('t1'));
    const db = authedContext(scorekeeperId).firestore();
    await assertFails(updateDoc(doc(db, teamPath), { name: 'Hacked' }));
  });

  it('denies random user from updating a team', async () => {
    await seedDoc(teamPath, makeTeam('t1'));
    const db = authedContext(randomUser).firestore();
    await assertFails(updateDoc(doc(db, teamPath), { name: 'Hacked Team' }));
  });

  it('allows organizer to delete a team', async () => {
    await seedDoc(teamPath, makeTeam('t1'));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(deleteDoc(doc(db, teamPath)));
  });

  it('denies scorekeeper from deleting a team', async () => {
    await seedDoc(teamPath, makeTeam('t1'));
    const db = authedContext(scorekeeperId).firestore();
    await assertFails(deleteDoc(doc(db, teamPath)));
  });

  it('denies random user from deleting a team', async () => {
    await seedDoc(teamPath, makeTeam('t1'));
    const db = authedContext(randomUser).firestore();
    await assertFails(deleteDoc(doc(db, teamPath)));
  });

  // ── HIGH: field validation on create (5.1) ─────────────────────────

  it('denies create with mismatched tournamentId', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, teamPath), makeTeam('wrong-tournament')));
  });

  it('denies create with empty name', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, teamPath), makeTeam('t1', { name: '' })));
  });

  it('denies create with non-list playerIds', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, teamPath), makeTeam('t1', { playerIds: 'not-a-list' })));
  });

  // ── HIGH: tournamentId immutability on update (5.2) ────────────────

  it('denies update changing tournamentId', async () => {
    await seedDoc(teamPath, makeTeam('t1'));
    const db = authedContext(organizerId).firestore();
    await assertFails(updateDoc(doc(db, teamPath), { tournamentId: 'different' }));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// POOLS (/tournaments/{tid}/pools/{id})
// ═══════════════════════════════════════════════════════════════════════

describe('Pools (/tournaments/{tid}/pools/{id})', () => {
  const organizerId = 'organizer-1';
  const randomUser = 'random-1';
  const tourneyPath = 'tournaments/t1';
  const poolPath = `${tourneyPath}/pools/pool1`;

  beforeEach(async () => {
    await seedDoc(tourneyPath, makeTournament(organizerId));
  });

  it('allows any authed user to read pools', async () => {
    await seedDoc(poolPath, makePool('t1'));
    const db = authedContext(randomUser).firestore();
    await assertSucceeds(getDoc(doc(db, poolPath)));
  });

  it('denies unauthenticated read of pools', async () => {
    await seedDoc(poolPath, makePool('t1'));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, poolPath)));
  });

  it('allows organizer to create a pool', async () => {
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(setDoc(doc(db, poolPath), makePool('t1')));
  });

  it('denies non-organizer from creating a pool', async () => {
    const db = authedContext(randomUser).firestore();
    await assertFails(setDoc(doc(db, poolPath), makePool('t1')));
  });

  it('allows organizer to update a pool', async () => {
    await seedDoc(poolPath, makePool('t1'));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, poolPath), { name: 'Pool B' }));
  });

  it('denies non-organizer from updating a pool', async () => {
    await seedDoc(poolPath, makePool('t1'));
    const db = authedContext(randomUser).firestore();
    await assertFails(updateDoc(doc(db, poolPath), { name: 'Hacked Pool' }));
  });

  it('allows organizer to delete a pool', async () => {
    await seedDoc(poolPath, makePool('t1'));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(deleteDoc(doc(db, poolPath)));
  });

  it('denies non-organizer from deleting a pool', async () => {
    await seedDoc(poolPath, makePool('t1'));
    const db = authedContext(randomUser).firestore();
    await assertFails(deleteDoc(doc(db, poolPath)));
  });

  // ── HIGH: field validation on create (6.1) ─────────────────────────

  it('denies create with mismatched tournamentId', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, poolPath), makePool('wrong-tournament')));
  });

  it('denies create with empty name', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, poolPath), makePool('t1', { name: '' })));
  });

  it('denies create with non-list teamIds', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, poolPath), makePool('t1', { teamIds: 'not-a-list' })));
  });

  // ── HIGH: tournamentId immutability on update (6.2) ────────────────

  it('denies update changing tournamentId', async () => {
    await seedDoc(poolPath, makePool('t1'));
    const db = authedContext(organizerId).firestore();
    await assertFails(updateDoc(doc(db, poolPath), { tournamentId: 'different' }));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// BRACKET (/tournaments/{tid}/bracket/{id})
// ═══════════════════════════════════════════════════════════════════════

describe('Bracket (/tournaments/{tid}/bracket/{id})', () => {
  const organizerId = 'organizer-1';
  const scorekeeperId = 'scorekeeper-1';
  const randomUser = 'random-1';
  const tourneyPath = 'tournaments/t1';
  const slotPath = `${tourneyPath}/bracket/slot1`;

  beforeEach(async () => {
    await seedDoc(tourneyPath, makeTournament(organizerId, { scorekeeperIds: [scorekeeperId] }));
  });

  it('allows any authed user to read bracket slots', async () => {
    await seedDoc(slotPath, makeBracketSlot('t1'));
    const db = authedContext(randomUser).firestore();
    await assertSucceeds(getDoc(doc(db, slotPath)));
  });

  it('denies unauthenticated read of bracket', async () => {
    await seedDoc(slotPath, makeBracketSlot('t1'));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, slotPath)));
  });

  it('allows organizer to create a bracket slot', async () => {
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(setDoc(doc(db, slotPath), makeBracketSlot('t1')));
  });

  it('denies non-organizer from creating a bracket slot', async () => {
    const db = authedContext(randomUser).firestore();
    await assertFails(setDoc(doc(db, slotPath), makeBracketSlot('t1')));
  });

  it('denies scorekeeper from creating a bracket slot', async () => {
    const db = authedContext(scorekeeperId).firestore();
    await assertFails(setDoc(doc(db, slotPath), makeBracketSlot('t1')));
  });

  it('allows organizer to update a bracket slot', async () => {
    await seedDoc(slotPath, makeBracketSlot('t1'));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, slotPath), { winnerId: 'team-1' }));
  });

  it('allows scorekeeper to update a bracket slot', async () => {
    await seedDoc(slotPath, makeBracketSlot('t1'));
    const db = authedContext(scorekeeperId).firestore();
    await assertSucceeds(updateDoc(doc(db, slotPath), { winnerId: 'team-1' }));
  });

  it('denies random user from updating a bracket slot', async () => {
    await seedDoc(slotPath, makeBracketSlot('t1'));
    const db = authedContext(randomUser).firestore();
    await assertFails(updateDoc(doc(db, slotPath), { winnerId: 'team-1' }));
  });

  it('allows organizer to delete a bracket slot', async () => {
    await seedDoc(slotPath, makeBracketSlot('t1'));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(deleteDoc(doc(db, slotPath)));
  });

  // ── HIGH: field validation on create (7.1) ─────────────────────────

  it('denies create with mismatched tournamentId', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, slotPath), makeBracketSlot('wrong-tournament')));
  });

  it('denies create with non-number round', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, slotPath), makeBracketSlot('t1', { round: 'one' })));
  });

  // ── HIGH: tournamentId immutability on update (7.2) ────────────────

  it('denies update changing tournamentId', async () => {
    await seedDoc(slotPath, makeBracketSlot('t1'));
    const db = authedContext(organizerId).firestore();
    await assertFails(updateDoc(doc(db, slotPath), { tournamentId: 'different' }));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// REGISTRATIONS (/tournaments/{tid}/registrations/{id})
// ═══════════════════════════════════════════════════════════════════════

describe('Registrations (/tournaments/{tid}/registrations/{id})', () => {
  const organizerId = 'organizer-1';
  const playerId = 'player-1';
  const otherPlayerId = 'player-2';
  const tourneyPath = 'tournaments/t1';
  const regPath = `${tourneyPath}/registrations/reg1`;

  beforeEach(async () => {
    // Tournament must be in 'registration' status for create rules
    await seedDoc(tourneyPath, makeTournament(organizerId, { status: 'registration' }));
  });

  // ── Read ────────────────────────────────────────────────────────────

  it('allows any authed user to read registrations', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(otherPlayerId).firestore();
    await assertSucceeds(getDoc(doc(db, regPath)));
  });

  it('denies unauthenticated read of registrations', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, regPath)));
  });

  // ── Create (self-register) ─────────────────────────────────────────

  it('allows player to register themselves', async () => {
    const db = authedContext(playerId).firestore();
    await assertSucceeds(setDoc(doc(db, regPath), makeRegistration(playerId, 't1')));
  });

  it('denies registering as a different user', async () => {
    const db = authedContext(otherPlayerId).firestore();
    await assertFails(setDoc(doc(db, regPath), makeRegistration(playerId, 't1')));
  });

  // ── CRITICAL: paymentStatus must be 'unpaid' on create (8.1) ──────

  it('denies create with paymentStatus set to paid', async () => {
    const db = authedContext(playerId).firestore();
    await assertFails(setDoc(doc(db, regPath), makeRegistration(playerId, 't1', { paymentStatus: 'paid' })));
  });

  it('denies create with paymentStatus set to waived', async () => {
    const db = authedContext(playerId).firestore();
    await assertFails(setDoc(doc(db, regPath), makeRegistration(playerId, 't1', { paymentStatus: 'waived' })));
  });

  // ── HIGH: paymentNote must be empty on create ─────────────────────

  it('denies create with non-empty paymentNote', async () => {
    const db = authedContext(playerId).firestore();
    await assertFails(setDoc(doc(db, regPath), makeRegistration(playerId, 't1', { paymentNote: 'I already paid' })));
  });

  // ── HIGH: tournament must be in registration status (8.8) ─────────

  it('denies create when tournament is in setup status', async () => {
    await seedDoc(tourneyPath, makeTournament(organizerId, { status: 'setup' }));
    const db = authedContext(playerId).firestore();
    await assertFails(setDoc(doc(db, regPath), makeRegistration(playerId, 't1')));
  });

  it('denies create when tournament is completed', async () => {
    await seedDoc(tourneyPath, makeTournament(organizerId, { status: 'completed' }));
    const db = authedContext(playerId).firestore();
    await assertFails(setDoc(doc(db, regPath), makeRegistration(playerId, 't1')));
  });

  // ── HIGH: tournamentId must match path on create (8.5) ────────────

  it('denies create with mismatched tournamentId', async () => {
    const db = authedContext(playerId).firestore();
    await assertFails(setDoc(doc(db, regPath), makeRegistration(playerId, 'wrong-tournament')));
  });

  // ── Update ─────────────────────────────────────────────────────────

  it('allows organizer to update any registration field', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(updateDoc(doc(db, regPath), { paymentStatus: 'paid', paymentNote: 'Venmo' }));
  });

  it('allows player to update own registration (without touching payment)', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(playerId).firestore();
    await assertSucceeds(updateDoc(doc(db, regPath), {
      teamId: 'team-1',
      paymentStatus: 'unpaid',    // must stay same
      paymentNote: '',             // must stay same
    }));
  });

  it('denies player from changing paymentStatus', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(playerId).firestore();
    await assertFails(updateDoc(doc(db, regPath), {
      paymentStatus: 'paid',
      paymentNote: '',
    }));
  });

  it('denies player from changing paymentNote', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(playerId).firestore();
    await assertFails(updateDoc(doc(db, regPath), {
      paymentStatus: 'unpaid',
      paymentNote: 'I said I paid!',
    }));
  });

  it('denies other player from updating a registration', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(otherPlayerId).firestore();
    await assertFails(updateDoc(doc(db, regPath), { teamId: 'team-2', paymentStatus: 'unpaid', paymentNote: '' }));
  });

  // ── CRITICAL: paymentStatus enum on organizer update (8.2) ────────

  it('denies organizer setting invalid paymentStatus', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(organizerId).firestore();
    await assertFails(updateDoc(doc(db, regPath), { paymentStatus: 'free-pass' }));
  });

  // ── HIGH: userId immutable on organizer update (8.6) ──────────────

  it('denies organizer from changing userId', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(organizerId).firestore();
    await assertFails(updateDoc(doc(db, regPath), { userId: otherPlayerId, paymentStatus: 'unpaid' }));
  });

  // ── HIGH: tournamentId immutable on update (8.5) ──────────────────

  it('denies organizer from changing tournamentId', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(organizerId).firestore();
    await assertFails(updateDoc(doc(db, regPath), { tournamentId: 'different', paymentStatus: 'unpaid' }));
  });

  it('denies player from changing tournamentId', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(playerId).firestore();
    await assertFails(updateDoc(doc(db, regPath), { tournamentId: 'different', paymentStatus: 'unpaid', paymentNote: '' }));
  });

  // ── Delete ─────────────────────────────────────────────────────────

  it('allows player to delete their own registration', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(playerId).firestore();
    await assertSucceeds(deleteDoc(doc(db, regPath)));
  });

  it('allows organizer to delete any registration', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(deleteDoc(doc(db, regPath)));
  });

  it('denies other player from deleting a registration', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = authedContext(otherPlayerId).firestore();
    await assertFails(deleteDoc(doc(db, regPath)));
  });

  it('denies unauthenticated delete', async () => {
    await seedDoc(regPath, makeRegistration(playerId, 't1'));
    const db = unauthedContext().firestore();
    await assertFails(deleteDoc(doc(db, regPath)));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// REGRESSION TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('Regression tests', () => {
  const organizerId = 'organizer-1';

  it('validates format at top level (not config.format)', async () => {
    const db = authedContext(organizerId).firestore();
    const tournament = makeTournament(organizerId, { format: 'pool-bracket' });
    await assertSucceeds(setDoc(doc(db, 'tournaments/t1'), tournament));
  });

  it('rejects tournament with config.format but missing top-level format', async () => {
    const db = authedContext(organizerId).firestore();
    const { format: _removed, ...tournamentWithout } = makeTournament(organizerId);
    const badTournament = {
      ...tournamentWithout,
      config: { ...makeTournament(organizerId).config, format: 'round-robin' },
    };
    await assertFails(setDoc(doc(db, 'tournaments/t1'), badTournament));
  });

  it('uses lowercase "tournaments" collection (not "Tournaments")', async () => {
    const db = authedContext(organizerId).firestore();
    await assertSucceeds(setDoc(doc(db, 'tournaments/t1'), makeTournament(organizerId)));
  });

  it('denies access to incorrectly-cased "Tournaments" collection', async () => {
    const db = authedContext(organizerId).firestore();
    await assertFails(setDoc(doc(db, 'Tournaments/t1'), makeTournament(organizerId)));
  });

  it('tournament create validates all required fields together', async () => {
    const db = authedContext(organizerId).firestore();
    const valid = makeTournament(organizerId, {
      name: 'Weekend Tourney',
      status: 'setup',
      format: 'single-elimination',
    });
    await assertSucceeds(setDoc(doc(db, 'tournaments/t1'), valid));
  });
});
