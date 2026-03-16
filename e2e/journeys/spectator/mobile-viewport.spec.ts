import { test, expect } from '@playwright/test';
import {
  makeTournament,
  makePublicMatch,
  makeSpectatorProjection,
} from '../../helpers/factories';

// --- Config ---
const FIRESTORE_URL = 'http://127.0.0.1:8180';
const PROJECT_ID = 'picklescore-b0a71';

// --- Firestore helpers ---

async function clearEmulator() {
  await fetch(
    `${FIRESTORE_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') fields[key] = { stringValue: value };
    else if (typeof value === 'number') fields[key] = { integerValue: String(value) };
    else if (typeof value === 'boolean') fields[key] = { booleanValue: value };
    else if (value === null) fields[key] = { nullValue: null };
    else if (Array.isArray(value))
      fields[key] = {
        arrayValue: {
          values: value.map((v) => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { integerValue: String(v) };
            if (typeof v === 'boolean') return { booleanValue: v };
            if (v === null) return { nullValue: null };
            if (typeof v === 'object')
              return { mapValue: { fields: toFirestoreFields(v as Record<string, unknown>) } };
            return { stringValue: String(v) };
          }),
        },
      };
    else if (typeof value === 'object')
      fields[key] = {
        mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) },
      };
  }
  return fields;
}

async function seedDoc(path: string, data: Record<string, unknown>) {
  const parts = path.split('/');
  const collectionPath = parts.slice(0, -1).join('/');
  const docId = parts[parts.length - 1];

  const resp = await fetch(
    `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?documentId=${docId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner',
      },
      body: JSON.stringify({ fields: toFirestoreFields(data) }),
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`seedDoc(${path}) failed ${resp.status}: ${text}`);
  }
}

// --- Tests ---

test.describe('Spectator: Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async () => {
    await clearEmulator();
  });

  test('hub renders on 375px without horizontal overflow', async ({ page }) => {
    const shareCode = 'MOB10001';
    const tournament = makeTournament({
      shareCode,
      name: 'Mobile Hub Test',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${tournament.id}`, tournament);

    await page.goto(`/t/${shareCode}`);
    await expect(page.getByText('Mobile Hub Test')).toBeVisible({ timeout: 10_000 });

    // Check no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('match detail fits 375px viewport', async ({ page }) => {
    const shareCode = 'MOB20001';
    const tournamentId = 'tourney-mobile';
    const matchId = 'mobile-match-1';

    const tournament = makeTournament({
      id: tournamentId,
      shareCode,
      name: 'Mobile Match Test',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${tournamentId}`, tournament);

    // Seed match
    const match = makePublicMatch('org-mobile', {
      id: matchId,
      tournamentId,
      team1Name: 'Team Mobile A',
      team2Name: 'Team Mobile B',
      status: 'in-progress',
    });
    await seedDoc(`matches/${matchId}`, match);

    // Seed spectator projection
    const projection = makeSpectatorProjection({
      publicTeam1Name: 'Team Mobile A',
      publicTeam2Name: 'Team Mobile B',
      team1Score: 5,
      team2Score: 3,
      gameNumber: 1,
      status: 'in-progress',
      visibility: 'public',
      tournamentId,
      tournamentShareCode: shareCode,
    });
    await seedDoc(`matches/${matchId}/public/spectator`, projection);

    await page.goto(`/t/${shareCode}/match/${matchId}`);

    // Verify scoreboard visible
    await expect(page.getByText('Team Mobile A')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Team Mobile B')).toBeVisible();

    // Check no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
