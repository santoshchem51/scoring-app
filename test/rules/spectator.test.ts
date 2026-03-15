import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import {
  setupTestEnv, teardownTestEnv, clearFirestore,
  authedContext, unauthedContext,
  assertSucceeds, assertFails,
  getTestEnv,
  makeCloudMatch,
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
// SPECTATOR PROJECTION (/matches/{matchId}/public/{docId})
// ═══════════════════════════════════════════════════════════════════════

describe('Spectator projection (/matches/{matchId}/public/{docId})', () => {
  const matchId = 'match-1';
  const ownerId = 'owner-1';
  const spectatorDoc = `matches/${matchId}/public/spectator`;

  const spectatorData = {
    publicTeam1Name: 'Team A',
    publicTeam2Name: 'Team B',
    team1Score: 5,
    team2Score: 3,
    status: 'in-progress',
    updatedAt: Date.now(),
  };

  beforeEach(async () => {
    // Seed match + spectator projection via admin
    await seedDoc(`matches/${matchId}`, makeCloudMatch(ownerId, { visibility: 'public' }));
    await seedDoc(spectatorDoc, spectatorData);
  });

  it('allows unauthenticated read', async () => {
    const db = unauthedContext().firestore();
    await assertSucceeds(getDoc(doc(db, spectatorDoc)));
  });

  it('allows authenticated read', async () => {
    const db = authedContext('random-user').firestore();
    await assertSucceeds(getDoc(doc(db, spectatorDoc)));
  });

  it('denies unauthenticated create', async () => {
    const db = unauthedContext().firestore();
    await assertFails(
      setDoc(doc(db, `matches/${matchId}/public/spectator`), spectatorData),
    );
  });

  it('denies unauthenticated update', async () => {
    const db = unauthedContext().firestore();
    await assertFails(
      updateDoc(doc(db, spectatorDoc), { team1Score: 10 }),
    );
  });

  it('denies unauthenticated delete', async () => {
    const db = unauthedContext().firestore();
    await assertFails(deleteDoc(doc(db, spectatorDoc)));
  });

  it('denies authenticated non-owner create', async () => {
    const db = authedContext('random-user').firestore();
    await assertFails(
      setDoc(doc(db, `matches/${matchId}/public/spectator`), spectatorData),
    );
  });

  it('allows owner to create spectator subdoc', async () => {
    // Clear the seeded spectator doc so we can test create
    await getTestEnv().withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await deleteDoc(doc(db, spectatorDoc));
    });
    const db = authedContext(ownerId).firestore();
    await assertSucceeds(
      setDoc(doc(db, spectatorDoc), spectatorData),
    );
  });

  it('allows owner to update spectator subdoc', async () => {
    const db = authedContext(ownerId).firestore();
    await assertSucceeds(
      updateDoc(doc(db, spectatorDoc), { team1Score: 10 }),
    );
  });

  it('allows shared user to create spectator subdoc', async () => {
    const sharedUser = 'shared-user-1';
    // Re-seed match with sharedWith
    await getTestEnv().withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `matches/${matchId}`), makeCloudMatch(ownerId, {
        visibility: 'public',
        sharedWith: [sharedUser],
      }));
      // Delete spectator doc to test create
      await deleteDoc(doc(db, spectatorDoc));
    });
    const db = authedContext(sharedUser).firestore();
    await assertSucceeds(
      setDoc(doc(db, spectatorDoc), spectatorData),
    );
  });

  it('allows shared user to update spectator subdoc', async () => {
    const sharedUser = 'shared-user-1';
    // Re-seed match with sharedWith
    await getTestEnv().withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `matches/${matchId}`), makeCloudMatch(ownerId, {
        visibility: 'public',
        sharedWith: [sharedUser],
      }));
    });
    const db = authedContext(sharedUser).firestore();
    await assertSucceeds(
      updateDoc(doc(db, spectatorDoc), { team1Score: 10 }),
    );
  });

  it('denies delete even for owner', async () => {
    const db = authedContext(ownerId).firestore();
    await assertFails(deleteDoc(doc(db, spectatorDoc)));
  });

  it('denies arbitrary doc under /public/ (evil doc)', async () => {
    const db = authedContext(ownerId).firestore();
    await assertFails(
      setDoc(doc(db, `matches/${matchId}/public/evil`), { hacked: true }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// FIELD DENY-LIST (spectatorCount, tournamentShareCode, publicTeam*Name)
// ═══════════════════════════════════════════════════════════════════════

describe('Field deny-list on match updates', () => {
  const matchId = 'match-deny';
  const ownerId = 'owner-deny';
  const sharedUser = 'shared-user-1';

  beforeEach(async () => {
    await seedDoc(`matches/${matchId}`, makeCloudMatch(ownerId, {
      visibility: 'public',
      sharedWith: [sharedUser],
    }));
  });

  it('denies owner updating spectatorCount', async () => {
    const db = authedContext(ownerId).firestore();
    await assertFails(
      updateDoc(doc(db, `matches/${matchId}`), { spectatorCount: 42 }),
    );
  });

  it('denies owner updating publicTeam1Name', async () => {
    const db = authedContext(ownerId).firestore();
    await assertFails(
      updateDoc(doc(db, `matches/${matchId}`), { publicTeam1Name: 'Hackers' }),
    );
  });

  it('allows owner updating legitimate field (status)', async () => {
    const db = authedContext(ownerId).firestore();
    await assertSucceeds(
      updateDoc(doc(db, `matches/${matchId}`), { status: 'completed' }),
    );
  });

  it('denies legitimate + smuggled field together', async () => {
    const db = authedContext(ownerId).firestore();
    await assertFails(
      updateDoc(doc(db, `matches/${matchId}`), {
        status: 'completed',
        tournamentShareCode: 'SNEAK',
      }),
    );
  });

  it('denies shared user updating spectatorCount', async () => {
    const db = authedContext(sharedUser).firestore();
    await assertFails(
      updateDoc(doc(db, `matches/${matchId}`), { spectatorCount: 99 }),
    );
  });

  it('denies owner updating tournamentId', async () => {
    const db = authedContext(ownerId).firestore();
    await assertFails(
      updateDoc(doc(db, `matches/${matchId}`), { tournamentId: 'hijacked-tournament' }),
    );
  });

  it('denies owner updating visibility', async () => {
    const db = authedContext(ownerId).firestore();
    await assertFails(
      updateDoc(doc(db, `matches/${matchId}`), { visibility: 'private' }),
    );
  });
});
