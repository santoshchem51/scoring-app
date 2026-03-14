import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import {
  setupTestEnv, teardownTestEnv, clearFirestore,
  authedContext, assertSucceeds, assertFails,
} from './helpers';

beforeAll(async () => { await setupTestEnv(); });
afterAll(async () => { await teardownTestEnv(); });
beforeEach(async () => { await clearFirestore(); });

describe('Template Security Rules', () => {
  const userId = 'user-1';
  const otherId = 'user-2';

  const makeTemplate = () => ({
    id: 'tpl-1',
    name: 'Weekly Doubles',
    format: 'round-robin',
    gameType: 'doubles',
    config: { gameType: 'doubles', scoringMode: 'rally', matchFormat: 'single', pointsToWin: 11, poolCount: 2, teamsPerPoolAdvancing: 2 },
    teamFormation: 'byop',
    maxPlayers: 16,
    accessMode: 'open',
    rules: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
  });

  it('user can create own template', async () => {
    const db = authedContext(userId).firestore();
    await assertSucceeds(setDoc(doc(db, `users/${userId}/templates/tpl-1`), makeTemplate()));
  });

  it('user can read own template', async () => {
    const db = authedContext(userId).firestore();
    await setDoc(doc(db, `users/${userId}/templates/tpl-1`), makeTemplate());
    await assertSucceeds(getDoc(doc(db, `users/${userId}/templates/tpl-1`)));
  });

  it('user can update own template', async () => {
    const db = authedContext(userId).firestore();
    await setDoc(doc(db, `users/${userId}/templates/tpl-1`), makeTemplate());
    await assertSucceeds(updateDoc(doc(db, `users/${userId}/templates/tpl-1`), { name: 'Updated' }));
  });

  it('user can delete own template', async () => {
    const db = authedContext(userId).firestore();
    await setDoc(doc(db, `users/${userId}/templates/tpl-1`), makeTemplate());
    await assertSucceeds(deleteDoc(doc(db, `users/${userId}/templates/tpl-1`)));
  });

  it('other user cannot read another user template', async () => {
    const ownerDb = authedContext(userId).firestore();
    await setDoc(doc(ownerDb, `users/${userId}/templates/tpl-1`), makeTemplate());
    const otherDb = authedContext(otherId).firestore();
    await assertFails(getDoc(doc(otherDb, `users/${userId}/templates/tpl-1`)));
  });

  it('other user cannot write another user template', async () => {
    const otherDb = authedContext(otherId).firestore();
    await assertFails(setDoc(doc(otherDb, `users/${userId}/templates/tpl-1`), makeTemplate()));
  });
});
