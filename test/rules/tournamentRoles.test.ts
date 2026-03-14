import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  setupTestEnv, teardownTestEnv, clearFirestore,
  authedContext, assertSucceeds, assertFails,
  getTestEnv, makeTournament,
} from './helpers';

beforeAll(async () => { await setupTestEnv(); });
afterAll(async () => { await teardownTestEnv(); });
beforeEach(async () => { await clearFirestore(); });

async function seedDoc(path: string, data: Record<string, unknown>) {
  await getTestEnv().withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

describe('Tournament Role-Based Access', () => {
  const ownerId = 'owner-1';
  const adminId = 'admin-1';
  const modId = 'mod-1';
  const skId = 'sk-1';
  const randomId = 'random-1';
  const tourneyId = 'tourney-1';

  const seedTournament = () => seedDoc(`tournaments/${tourneyId}`, makeTournament(ownerId, {
    staff: { [adminId]: 'admin', [modId]: 'moderator', [skId]: 'scorekeeper' },
    staffUids: [adminId, modId, skId],
    status: 'registration',
    accessMode: 'open',
    listed: true,
    visibility: 'public',
  }));

  // --- Tournament Creation ---
  describe('tournament creation', () => {
    it('allows creation with empty staff and staffUids', async () => {
      const db = authedContext(ownerId).firestore();
      const newTourney = makeTournament(ownerId, {
        id: 'new-tourney',
        staff: {},
        staffUids: [],
        accessMode: 'open',
        listed: true,
        visibility: 'public',
      });
      await assertSucceeds(setDoc(doc(db, 'tournaments/new-tourney'), newTourney));
    });

    it('rejects creation with non-empty staff', async () => {
      const db = authedContext(ownerId).firestore();
      const newTourney = makeTournament(ownerId, {
        id: 'new-tourney-2',
        staff: { 'someone': 'admin' },
        staffUids: ['someone'],
        accessMode: 'open',
        listed: true,
        visibility: 'public',
      });
      await assertFails(setDoc(doc(db, 'tournaments/new-tourney-2'), newTourney));
    });

    it('rejects creation with non-map staff', async () => {
      const db = authedContext(ownerId).firestore();
      const newTourney = makeTournament(ownerId, {
        id: 'new-tourney-3',
        staff: 'not-a-map',
        staffUids: [],
        accessMode: 'open',
        listed: true,
        visibility: 'public',
      });
      await assertFails(setDoc(doc(db, 'tournaments/new-tourney-3'), newTourney));
    });
  });

  // --- Settings Update: admin+ only ---
  describe('settings updates (admin+ only)', () => {
    it('owner can update name', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'New Name', updatedAt: Date.now() }));
    });

    it('admin can update name', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'Admin Name', updatedAt: Date.now() }));
    });

    it('moderator cannot update name', async () => {
      await seedTournament();
      const db = authedContext(modId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'Mod Name', updatedAt: Date.now() }));
    });

    it('scorekeeper cannot update name', async () => {
      await seedTournament();
      const db = authedContext(skId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'SK Name', updatedAt: Date.now() }));
    });

    it('random user cannot update name', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), { name: 'Random Name', updatedAt: Date.now() }));
    });
  });

  // --- Staff Update: admin+ only, mutually exclusive with settings ---
  describe('staff updates (admin+ only, separate rule)', () => {
    it('owner can add admin to staff', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-admin`]: 'admin',
        staffUids: [adminId, modId, skId, 'new-admin'],
        updatedAt: Date.now(),
      }));
    });

    it('admin can add moderator to staff', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-mod`]: 'moderator',
        staffUids: [adminId, modId, skId, 'new-mod'],
        updatedAt: Date.now(),
      }));
    });

    it('moderator cannot modify staff', async () => {
      await seedTournament();
      const db = authedContext(modId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-sk`]: 'scorekeeper',
        staffUids: [adminId, modId, skId, 'new-sk'],
        updatedAt: Date.now(),
      }));
    });

    it('staff update cannot piggyback settings fields', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-mod`]: 'moderator',
        staffUids: [adminId, modId, skId, 'new-mod'],
        name: 'Piggybacked Name',
        updatedAt: Date.now(),
      }));
    });
  });

  // --- Delete: owner only ---
  describe('tournament deletion (owner only)', () => {
    it('owner can delete', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(deleteDoc(doc(db, `tournaments/${tourneyId}`)));
    });

    it('admin cannot delete', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}`)));
    });

    it('moderator cannot delete', async () => {
      await seedTournament();
      const db = authedContext(modId).firestore();
      await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}`)));
    });
  });

  // --- Counter-only update: any auth'd user ---
  describe('counter-only update', () => {
    it('random user can update only registrationCounts', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        registrationCounts: { confirmed: 1, pending: 0 },
        updatedAt: Date.now(),
      }));
    });

    it('rejects negative confirmed count', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        registrationCounts: { confirmed: -1, pending: 0 },
        updatedAt: Date.now(),
      }));
    });

    it('rejects negative pending count', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        registrationCounts: { confirmed: 0, pending: -5 },
        updatedAt: Date.now(),
      }));
    });

    it('rejects non-number confirmed count', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        registrationCounts: { confirmed: 'many', pending: 0 },
        updatedAt: Date.now(),
      }));
    });
  });

  // --- Settings update cannot manipulate registrationCounts ---
  describe('settings update registrationCounts immutability', () => {
    it('admin settings update cannot change registrationCounts', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        name: 'Legit Name Change',
        registrationCounts: { confirmed: 999, pending: 0 },
        updatedAt: Date.now(),
      }));
    });
  });
});
