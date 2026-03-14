import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
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

describe('Dispute Security Rules', () => {
  const ownerId = 'owner-1';
  const modId = 'mod-1';
  const skId = 'sk-1';
  const randomId = 'random-1';
  const tourneyId = 'tourney-1';

  const seedTournament = () => seedDoc(`tournaments/${tourneyId}`, makeTournament(ownerId, {
    staff: { [modId]: 'moderator', [skId]: 'scorekeeper' },
    staffUids: [modId, skId],
    status: 'registration',
  }));

  const makeDispute = (flaggedBy: string) => ({
    matchId: 'match-1',
    tournamentId: tourneyId,
    flaggedBy,
    flaggedByName: 'Test User',
    reason: 'Wrong score',
    status: 'open',
    resolvedBy: null,
    resolvedByName: null,
    resolution: null,
    createdAt: new Date(),
    resolvedAt: null,
  });

  describe('create', () => {
    it('moderator can create dispute', async () => {
      await seedTournament();
      const db = authedContext(modId).firestore();
      await assertSucceeds(setDoc(doc(db, `tournaments/${tourneyId}/disputes/d1`), makeDispute(modId)));
    });

    it('owner can create dispute', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(setDoc(doc(db, `tournaments/${tourneyId}/disputes/d2`), makeDispute(ownerId)));
    });

    it('scorekeeper cannot create dispute', async () => {
      await seedTournament();
      const db = authedContext(skId).firestore();
      await assertFails(setDoc(doc(db, `tournaments/${tourneyId}/disputes/d3`), makeDispute(skId)));
    });

    it('random user cannot create dispute', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(setDoc(doc(db, `tournaments/${tourneyId}/disputes/d4`), makeDispute(randomId)));
    });
  });

  describe('update (resolve)', () => {
    it('moderator can resolve dispute', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/disputes/d1`, makeDispute(ownerId));
      const db = authedContext(modId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}/disputes/d1`),
        { status: 'resolved-edited', resolvedBy: modId, resolvedByName: 'Mod', resolution: 'Fixed', resolvedAt: new Date() }));
    });

    it('scorekeeper cannot resolve dispute', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/disputes/d1`, makeDispute(ownerId));
      const db = authedContext(skId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}/disputes/d1`),
        { status: 'resolved-edited', resolvedBy: skId, resolvedByName: 'SK', resolution: 'Fixed', resolvedAt: new Date() }));
    });
  });

  describe('read', () => {
    it('staff can read disputes', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/disputes/d1`, makeDispute(ownerId));
      const db = authedContext(skId).firestore();
      await assertSucceeds(getDoc(doc(db, `tournaments/${tourneyId}/disputes/d1`)));
    });
  });

  describe('delete', () => {
    it('no one can delete disputes', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/disputes/d1`, makeDispute(ownerId));
      const db = authedContext(ownerId).firestore();
      await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}/disputes/d1`)));
    });
  });
});
