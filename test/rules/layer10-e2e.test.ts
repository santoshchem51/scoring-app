import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
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

describe('Layer 10: Admin & Moderation E2E', () => {
  const ownerId = 'e2e-owner';
  const adminId = 'e2e-admin';
  const modId = 'e2e-mod';
  const skId = 'e2e-sk';
  const randomId = 'e2e-random';
  const tourneyId = 'e2e-tourney';

  const staffMap = { [adminId]: 'admin', [modId]: 'moderator', [skId]: 'scorekeeper' };
  const staffUids = [adminId, modId, skId];

  const seedTournament = () => seedDoc(`tournaments/${tourneyId}`, makeTournament(ownerId, {
    staff: staffMap,
    staffUids,
    status: 'registration',
    accessMode: 'open',
    listed: true,
    visibility: 'public',
  }));

  // ── Role-based settings access ──────────────────────────────────────

  describe('Role-based settings access', () => {
    it('admin can edit tournament settings', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        name: 'Admin Renamed', updatedAt: Date.now(),
      }));
    });

    it('moderator cannot edit tournament settings', async () => {
      await seedTournament();
      const db = authedContext(modId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        name: 'Mod Renamed', updatedAt: Date.now(),
      }));
    });

    it('scorekeeper cannot edit tournament settings', async () => {
      await seedTournament();
      const db = authedContext(skId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        name: 'SK Renamed', updatedAt: Date.now(),
      }));
    });

    it('random user cannot edit tournament settings', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        name: 'Random Renamed', updatedAt: Date.now(),
      }));
    });

    it('owner can edit tournament settings', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        name: 'Owner Renamed', updatedAt: Date.now(),
      }));
    });
  });

  // ── Staff management access ─────────────────────────────────────────

  describe('Staff management access', () => {
    it('admin can add staff members', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-user`]: 'scorekeeper',
        staffUids: [...staffUids, 'new-user'],
        updatedAt: Date.now(),
      }));
    });

    it('moderator cannot manage staff', async () => {
      await seedTournament();
      const db = authedContext(modId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-user`]: 'scorekeeper',
        staffUids: [...staffUids, 'new-user'],
        updatedAt: Date.now(),
      }));
    });

    it('scorekeeper cannot manage staff', async () => {
      await seedTournament();
      const db = authedContext(skId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}`), {
        [`staff.new-user`]: 'scorekeeper',
        staffUids: [...staffUids, 'new-user'],
        updatedAt: Date.now(),
      }));
    });
  });

  // ── Audit log immutability ──────────────────────────────────────────

  describe('Audit log immutability', () => {
    const makeAuditEntry = (actorId: string) => ({
      action: 'status_change',
      actorId,
      actorName: 'Test Actor',
      actorRole: 'admin',
      targetType: 'tournament',
      targetId: tourneyId,
      details: { action: 'status_change', oldStatus: 'setup', newStatus: 'registration' },
      timestamp: new Date(),
    });

    it('staff can create audit entries', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertSucceeds(setDoc(
        doc(db, `tournaments/${tourneyId}/auditLog/log-1`),
        makeAuditEntry(adminId),
      ));
    });

    it('scorekeeper can create audit entries', async () => {
      await seedTournament();
      const db = authedContext(skId).firestore();
      await assertSucceeds(setDoc(
        doc(db, `tournaments/${tourneyId}/auditLog/log-2`),
        makeAuditEntry(skId),
      ));
    });

    it('non-staff cannot create audit entries', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(setDoc(
        doc(db, `tournaments/${tourneyId}/auditLog/log-3`),
        makeAuditEntry(randomId),
      ));
    });

    it('audit entries cannot be updated', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, makeAuditEntry(adminId));
      const db = authedContext(adminId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`), {
        action: 'hacked',
      }));
    });

    it('audit entries cannot be deleted', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, makeAuditEntry(adminId));
      const db = authedContext(adminId).firestore();
      await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`)));
    });

    it('even owner cannot update audit entries', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, makeAuditEntry(adminId));
      const db = authedContext(ownerId).firestore();
      await assertFails(updateDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`), {
        action: 'tampered',
      }));
    });

    it('even owner cannot delete audit entries', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, makeAuditEntry(adminId));
      const db = authedContext(ownerId).firestore();
      await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`)));
    });
  });

  // ── Disputes role enforcement ───────────────────────────────────────

  describe('Disputes role enforcement', () => {
    const makeDispute = (flaggedBy: string, flaggedByName: string) => ({
      matchId: 'm1',
      tournamentId: tourneyId,
      flaggedBy,
      flaggedByName,
      reason: 'Wrong score recorded',
      status: 'open',
      resolvedBy: null,
      resolvedByName: null,
      resolution: null,
      createdAt: new Date(),
      resolvedAt: null,
    });

    it('moderator can create a dispute', async () => {
      await seedTournament();
      const db = authedContext(modId).firestore();
      await assertSucceeds(setDoc(
        doc(db, `tournaments/${tourneyId}/disputes/d1`),
        makeDispute(modId, 'Mod'),
      ));
    });

    it('admin can create a dispute', async () => {
      await seedTournament();
      const db = authedContext(adminId).firestore();
      await assertSucceeds(setDoc(
        doc(db, `tournaments/${tourneyId}/disputes/d2`),
        makeDispute(adminId, 'Admin'),
      ));
    });

    it('owner can create a dispute', async () => {
      await seedTournament();
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(setDoc(
        doc(db, `tournaments/${tourneyId}/disputes/d3`),
        makeDispute(ownerId, 'Owner'),
      ));
    });

    it('scorekeeper cannot create a dispute', async () => {
      await seedTournament();
      const db = authedContext(skId).firestore();
      await assertFails(setDoc(
        doc(db, `tournaments/${tourneyId}/disputes/d4`),
        makeDispute(skId, 'SK'),
      ));
    });

    it('random user cannot create a dispute', async () => {
      await seedTournament();
      const db = authedContext(randomId).firestore();
      await assertFails(setDoc(
        doc(db, `tournaments/${tourneyId}/disputes/d5`),
        makeDispute(randomId, 'Random'),
      ));
    });

    it('moderator can resolve an open dispute', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/disputes/d1`, makeDispute(modId, 'Mod'));
      const db = authedContext(modId).firestore();
      await assertSucceeds(updateDoc(doc(db, `tournaments/${tourneyId}/disputes/d1`), {
        status: 'resolved-edited',
        resolvedBy: modId,
        resolvedByName: 'Mod',
        resolution: 'Score corrected',
        resolvedAt: new Date(),
      }));
    });

    it('disputes cannot be deleted', async () => {
      await seedTournament();
      await seedDoc(`tournaments/${tourneyId}/disputes/d1`, makeDispute(modId, 'Mod'));
      const db = authedContext(ownerId).firestore();
      await assertFails(deleteDoc(doc(db, `tournaments/${tourneyId}/disputes/d1`)));
    });
  });

  // ── Templates privacy ──────────────────────────────────────────────

  describe('Templates privacy', () => {
    const makeTemplate = () => ({
      id: 'tpl-1',
      name: 'Test Template',
      format: 'round-robin',
      gameType: 'doubles',
      config: {},
      teamFormation: 'byop',
      maxPlayers: 16,
      accessMode: 'open',
      rules: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    });

    it('user can create own template', async () => {
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(setDoc(
        doc(db, `users/${ownerId}/templates/tpl-1`),
        makeTemplate(),
      ));
    });

    it('user can read own template', async () => {
      await seedDoc(`users/${ownerId}/templates/tpl-1`, makeTemplate());
      const db = authedContext(ownerId).firestore();
      await assertSucceeds(getDoc(doc(db, `users/${ownerId}/templates/tpl-1`)));
    });

    it('other user cannot read another user template', async () => {
      await seedDoc(`users/${ownerId}/templates/tpl-1`, makeTemplate());
      const db = authedContext(adminId).firestore();
      await assertFails(getDoc(doc(db, `users/${ownerId}/templates/tpl-1`)));
    });

    it('other user cannot write to another user templates', async () => {
      const db = authedContext(adminId).firestore();
      await assertFails(setDoc(
        doc(db, `users/${ownerId}/templates/tpl-2`),
        makeTemplate(),
      ));
    });
  });

  // ── Cross-cutting: role hierarchy in subcollections ─────────────────

  describe('Cross-cutting: subcollection role enforcement', () => {
    it('scorekeeper can read audit log', async () => {
      await seedTournament();
      const entry = {
        action: 'score_edit', actorId: adminId, actorName: 'Admin',
        actorRole: 'admin', targetType: 'match', targetId: 'm1',
        details: {}, timestamp: new Date(),
      };
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, entry);
      const db = authedContext(skId).firestore();
      await assertSucceeds(getDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`)));
    });

    it('non-staff cannot read audit log', async () => {
      await seedTournament();
      const entry = {
        action: 'score_edit', actorId: adminId, actorName: 'Admin',
        actorRole: 'admin', targetType: 'match', targetId: 'm1',
        details: {}, timestamp: new Date(),
      };
      await seedDoc(`tournaments/${tourneyId}/auditLog/log-1`, entry);
      const db = authedContext(randomId).firestore();
      await assertFails(getDoc(doc(db, `tournaments/${tourneyId}/auditLog/log-1`)));
    });

    it('scorekeeper can read disputes', async () => {
      await seedTournament();
      const dispute = {
        matchId: 'm1', tournamentId: tourneyId, flaggedBy: modId,
        flaggedByName: 'Mod', reason: 'Wrong score', status: 'open',
        resolvedBy: null, resolvedByName: null, resolution: null,
        createdAt: new Date(), resolvedAt: null,
      };
      await seedDoc(`tournaments/${tourneyId}/disputes/d1`, dispute);
      const db = authedContext(skId).firestore();
      await assertSucceeds(getDoc(doc(db, `tournaments/${tourneyId}/disputes/d1`)));
    });

    it('non-staff cannot read disputes', async () => {
      await seedTournament();
      const dispute = {
        matchId: 'm1', tournamentId: tourneyId, flaggedBy: modId,
        flaggedByName: 'Mod', reason: 'Wrong score', status: 'open',
        resolvedBy: null, resolvedByName: null, resolution: null,
        createdAt: new Date(), resolvedAt: null,
      };
      await seedDoc(`tournaments/${tourneyId}/disputes/d1`, dispute);
      const db = authedContext(randomId).firestore();
      await assertFails(getDoc(doc(db, `tournaments/${tourneyId}/disputes/d1`)));
    });
  });
});
