import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import {
  setupTestEnv, teardownTestEnv, clearFirestore,
  authedContext, unauthedContext, assertSucceeds, assertFails,
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

describe('Audit Log Security Rules', () => {
  const ownerId = 'owner-1';
  const adminId = 'admin-1';
  const skId = 'sk-1';
  const randomId = 'random-1';
  const tourneyId = 'tourney-1';

  const seedTournament = () => seedDoc(`tournaments/${tourneyId}`, makeTournament(ownerId, {
    staff: { [adminId]: 'admin', [skId]: 'scorekeeper' },
    staffUids: [adminId, skId],
    status: 'registration',
  }));

  const makeAuditEntry = (actorId: string) => ({
    action: 'score_edit',
    actorId,
    actorName: 'Test Actor',
    actorRole: 'admin',
    targetType: 'match',
    targetId: 'match-1',
    details: { action: 'score_edit', matchId: 'match-1', oldScores: '11-5', newScores: '11-7', oldWinner: 1, newWinner: 1 },
    timestamp: new Date(),
  });

  describe('create', () => {
    it('staff can create audit entry with valid fields and actorId == auth.uid', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertSucceeds(setDoc(
        doc(db, `tournaments/${tourneyId}/auditLog/log-1`),
        makeAuditEntry(adminId),
      ));
    });

    it('rejects if actorId does not match auth.uid', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertFails(setDoc(
        doc(db, `tournaments/${tourneyId}/auditLog/log-2`),
        makeAuditEntry('someone-else'),
      ));
    });

    it('rejects audit entry with extra fields', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertFails(setDoc(
        doc(db, `tournaments/${tourneyId}/auditLog/log-extra`),
        { ...makeAuditEntry(adminId), maliciousField: 'injected', isAdmin: true },
      ));
    });

    it('non-staff cannot create audit entry', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(setDoc(
        doc(db, `tournaments/${tourneyId}/auditLog/log-3`),
        makeAuditEntry(randomId),
      ));
    });

    it('unauthenticated cannot create audit entry', async () => {
      await seedTournament();
      const db = unauthedContext().firestore();
      await assertFails(setDoc(
        doc(db, `tournaments/${tourneyId}/auditLog/log-4`),
        makeAuditEntry('anon'),
      ));
    });
  });

  describe('read', () => {
    it('staff can read audit entries', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, makeAuditEntry(adminId));
      const db = authedContext(skId).firestore();
      await assertSucceeds(getDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`)));
    });

    it('non-staff cannot read audit entries', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, makeAuditEntry(adminId));
      const db = authedContext(randomId).firestore();
      await assertFails(getDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`)));
    });
  });

  describe('update and delete', () => {
    it('no one can update audit entries', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, makeAuditEntry(adminId));
      const db = authedContext(ownerId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`), { action: 'hacked' }));
    });

    it('no one can delete audit entries', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, makeAuditEntry(adminId));
      const db = authedContext(ownerId).firestore();
      await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`)));
    });
  });
});
