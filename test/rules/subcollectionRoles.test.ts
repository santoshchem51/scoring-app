import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  setupTestEnv, teardownTestEnv, clearFirestore,
  authedContext, assertSucceeds, assertFails,
  getTestEnv, makeTournament, makeTeam, makePool, makeBracketSlot, makeRegistration,
} from './helpers';

beforeAll(async () => { await setupTestEnv(); });
afterAll(async () => { await teardownTestEnv(); });
beforeEach(async () => { await clearFirestore(); });

async function seedDoc(path: string, data: Record<string, unknown>) {
  await getTestEnv().withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

const ownerId = 'owner-1';
const adminId = 'admin-1';
const modId = 'mod-1';
const skId = 'sk-1';
const randomId = 'random-1';
const tourneyId = 'tourney-1';

const seedRoleTournament = () => seedDoc(`tournaments/${tourneyId}`, makeTournament(ownerId, {
  staff: { [adminId]: 'admin', [modId]: 'moderator', [skId]: 'scorekeeper' },
  staffUids: [adminId, modId, skId],
  status: 'registration',
}));

describe('Teams subcollection with roles', () => {
  it('admin can create team', async () => {
    await seedRoleTournament();
    const db = authedContext(adminId).firestore();
    const team = makeTeam(tourneyId, { id: 'team-new' });
    await assertSucceeds(setDoc(doc(db, `tournaments/${tourneyId}/teams/team-new`), team));
  });

  it('moderator cannot create team', async () => {
    await seedRoleTournament();
    const db = authedContext(modId).firestore();
    const team = makeTeam(tourneyId, { id: 'team-new2' });
    await assertFails(setDoc(doc(db, `tournaments/${tourneyId}/teams/team-new2`), team));
  });

  it('scorekeeper can update seed only', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/teams/team-1`, makeTeam(tourneyId));
    const db = authedContext(skId).firestore();
    await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}/teams/team-1`), { seed: 3, updatedAt: Date.now() }));
  });

  it('scorekeeper cannot update name', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/teams/team-1`, makeTeam(tourneyId));
    const db = authedContext(skId).firestore();
    await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}/teams/team-1`), { name: 'Hacked' }));
  });
});

describe('Pools subcollection with roles', () => {
  it('admin can create pool', async () => {
    await seedRoleTournament();
    const db = authedContext(adminId).firestore();
    const pool = makePool(tourneyId, { id: 'pool-new' });
    await assertSucceeds(setDoc(doc(db, `tournaments/${tourneyId}/pools/pool-new`), pool));
  });

  it('scorekeeper cannot create pool', async () => {
    await seedRoleTournament();
    const db = authedContext(skId).firestore();
    const pool = makePool(tourneyId, { id: 'pool-new2' });
    await assertFails(setDoc(doc(db, `tournaments/${tourneyId}/pools/pool-new2`), pool));
  });

  it('admin can update pool', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/pools/pool-1`, makePool(tourneyId));
    const db = authedContext(adminId).firestore();
    await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}/pools/pool-1`), { name: 'Pool B' }));
  });
});

describe('Bracket subcollection with roles', () => {
  it('admin can create bracket slot', async () => {
    await seedRoleTournament();
    const db = authedContext(adminId).firestore();
    const slot = makeBracketSlot(tourneyId, { id: 'slot-new' });
    await assertSucceeds(setDoc(doc(db, `tournaments/${tourneyId}/bracket/slot-new`), slot));
  });

  it('scorekeeper can update winnerId only', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/bracket/slot-1`, makeBracketSlot(tourneyId));
    const db = authedContext(skId).firestore();
    await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}/bracket/slot-1`), { winnerId: 'team-1', updatedAt: Date.now() }));
  });
});

describe('Registrations subcollection with roles', () => {
  it('moderator can approve registration (pending -> confirmed)', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/registrations/player-1`,
      makeRegistration('player-1', tourneyId, { status: 'pending' }));
    const db = authedContext(modId).firestore();
    await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}/registrations/player-1`), {
      status: 'confirmed',
    }));
  });

  it('scorekeeper cannot approve registration', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/registrations/player-1`,
      makeRegistration('player-1', tourneyId, { status: 'pending' }));
    const db = authedContext(skId).firestore();
    await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}/registrations/player-1`), {
      status: 'confirmed',
    }));
  });

  it('admin can create registration on behalf of player', async () => {
    await seedRoleTournament();
    const db = authedContext(adminId).firestore();
    const reg = makeRegistration('player-2', tourneyId, { id: 'player-2', status: 'confirmed' });
    await assertSucceeds(setDoc(doc(db, `tournaments/${tourneyId}/registrations/player-2`), reg));
  });

  it('moderator cannot create registration on behalf of player', async () => {
    await seedRoleTournament();
    const db = authedContext(modId).firestore();
    const reg = makeRegistration('player-3', tourneyId, { id: 'player-3', status: 'confirmed' });
    await assertFails(setDoc(doc(db, `tournaments/${tourneyId}/registrations/player-3`), reg));
  });
});

// --- isTournamentActive() boundary: completed/cancelled tournaments block writes ---
describe('Completed/cancelled tournament blocks subcollection writes', () => {
  const seedCompletedTournament = () => seedDoc(`tournaments/${tourneyId}`, makeTournament(ownerId, {
    staff: { [adminId]: 'admin', [skId]: 'scorekeeper' },
    staffUids: [adminId, skId],
    status: 'completed',
  }));

  const seedCancelledTournament = () => seedDoc(`tournaments/${tourneyId}`, makeTournament(ownerId, {
    staff: { [adminId]: 'admin', [skId]: 'scorekeeper' },
    staffUids: [adminId, skId],
    status: 'cancelled',
  }));

  it('admin cannot create team in completed tournament', async () => {
    await seedCompletedTournament();
    const db = authedContext(adminId).firestore();
    await assertFails(setDoc(doc(db, `tournaments/${tourneyId}/teams/team-new`), makeTeam(tourneyId, { id: 'team-new' })));
  });

  it('admin cannot create pool in cancelled tournament', async () => {
    await seedCancelledTournament();
    const db = authedContext(adminId).firestore();
    await assertFails(setDoc(doc(db, `tournaments/${tourneyId}/pools/pool-new`), makePool(tourneyId, { id: 'pool-new' })));
  });

  it('admin cannot create bracket slot in completed tournament', async () => {
    await seedCompletedTournament();
    const db = authedContext(adminId).firestore();
    await assertFails(setDoc(doc(db, `tournaments/${tourneyId}/bracket/slot-new`), makeBracketSlot(tourneyId, { id: 'slot-new' })));
  });

  it('scorekeeper cannot update bracket winnerId in completed tournament', async () => {
    await seedCompletedTournament();
    await seedDoc(`tournaments/${tourneyId}/bracket/slot-1`, makeBracketSlot(tourneyId));
    const db = authedContext(skId).firestore();
    await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}/bracket/slot-1`), { winnerId: 'team-1', updatedAt: Date.now() }));
  });
});

// --- Subcollection delete tests ---
describe('Subcollection deletes (admin+ only)', () => {
  it('admin can delete team', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/teams/team-1`, makeTeam(tourneyId));
    const db = authedContext(adminId).firestore();
    await assertSucceeds(deleteDoc(doc(db, `tournaments/${tourneyId}/teams/team-1`)));
  });

  it('moderator cannot delete team', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/teams/team-1`, makeTeam(tourneyId));
    const db = authedContext(modId).firestore();
    await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}/teams/team-1`)));
  });

  it('scorekeeper cannot delete team', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/teams/team-1`, makeTeam(tourneyId));
    const db = authedContext(skId).firestore();
    await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}/teams/team-1`)));
  });

  it('admin can delete pool', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/pools/pool-1`, makePool(tourneyId));
    const db = authedContext(adminId).firestore();
    await assertSucceeds(deleteDoc(doc(db, `tournaments/${tourneyId}/pools/pool-1`)));
  });

  it('admin can delete bracket slot', async () => {
    await seedRoleTournament();
    await seedDoc(`tournaments/${tourneyId}/bracket/slot-1`, makeBracketSlot(tourneyId));
    const db = authedContext(adminId).firestore();
    await assertSucceeds(deleteDoc(doc(db, `tournaments/${tourneyId}/bracket/slot-1`)));
  });
});
