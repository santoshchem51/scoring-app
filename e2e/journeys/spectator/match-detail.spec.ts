import { test, expect } from '@playwright/test';
import {
  makeTournament,
  makePublicMatch,
  makeSpectatorProjection,
  makeScoreEvent,
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

// --- Shared seed data ---
const SHARE_CODE = 'MTCH0001';
const TOURNAMENT_ID = 'tourney-match';
const MATCH_ID = 'match-detail-1';

// --- Tests ---

test.describe('Spectator Match Detail', () => {
  test.beforeEach(async () => {
    await clearEmulator();

    // Seed tournament
    const tournament = makeTournament({
      id: TOURNAMENT_ID,
      shareCode: SHARE_CODE,
      name: 'Match Detail Tournament',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${TOURNAMENT_ID}`, tournament);
  });

  test('scoreboard shows team names and scores', async ({ page }) => {
    // Seed match
    const match = makePublicMatch('org-test', {
      id: MATCH_ID,
      tournamentId: TOURNAMENT_ID,
      team1Name: 'Smashers',
      team2Name: 'Dinkers',
      status: 'in-progress',
    });
    await seedDoc(`matches/${MATCH_ID}`, match);

    // Seed spectator projection with scores
    const projection = makeSpectatorProjection({
      publicTeam1Name: 'Smashers',
      publicTeam2Name: 'Dinkers',
      team1Score: 7,
      team2Score: 4,
      gameNumber: 1,
      status: 'in-progress',
      visibility: 'public',
      tournamentId: TOURNAMENT_ID,
      tournamentShareCode: SHARE_CODE,
    });
    await seedDoc(`matches/${MATCH_ID}/public/spectator`, projection);

    await page.goto(`/t/${SHARE_CODE}/match/${MATCH_ID}`);

    // Verify team names visible on scoreboard
    await expect(page.getByText('Smashers')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Dinkers')).toBeVisible();

    // Verify scores are visible
    await expect(page.getByText('7')).toBeVisible();
    await expect(page.getByText('4')).toBeVisible();
  });

  test('play-by-play events render with score text', async ({ page }) => {
    // Seed match
    const match = makePublicMatch('org-test', {
      id: MATCH_ID,
      tournamentId: TOURNAMENT_ID,
      team1Name: 'Aces',
      team2Name: 'Volleys',
      status: 'in-progress',
    });
    await seedDoc(`matches/${MATCH_ID}`, match);

    // Seed spectator projection
    const projection = makeSpectatorProjection({
      publicTeam1Name: 'Aces',
      publicTeam2Name: 'Volleys',
      team1Score: 3,
      team2Score: 2,
      gameNumber: 1,
      status: 'in-progress',
      visibility: 'public',
      tournamentId: TOURNAMENT_ID,
      tournamentShareCode: SHARE_CODE,
    });
    await seedDoc(`matches/${MATCH_ID}/public/spectator`, projection);

    // Seed score events for play-by-play
    const event1 = makeScoreEvent(MATCH_ID, {
      team: 1,
      team1Score: 1,
      team2Score: 0,
      timestamp: Date.now() - 30000,
      visibility: 'public',
    });
    const event2 = makeScoreEvent(MATCH_ID, {
      team: 2,
      team1Score: 1,
      team2Score: 1,
      timestamp: Date.now() - 20000,
      visibility: 'public',
    });
    const event3 = makeScoreEvent(MATCH_ID, {
      team: 1,
      team1Score: 2,
      team2Score: 1,
      timestamp: Date.now() - 10000,
      visibility: 'public',
    });
    await seedDoc(`matches/${MATCH_ID}/events/${event1.id}`, event1);
    await seedDoc(`matches/${MATCH_ID}/events/${event2.id}`, event2);
    await seedDoc(`matches/${MATCH_ID}/events/${event3.id}`, event3);

    await page.goto(`/t/${SHARE_CODE}/match/${MATCH_ID}`);

    // Play-by-Play tab should be the default
    const playByPlayTab = page.getByRole('tab', { name: /play-by-play/i });
    await expect(playByPlayTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });

    // At least one event entry should be visible with score text
    // Score events display as "{team1Score} - {team2Score}" or similar
    await expect(page.getByText('1 - 0').or(page.getByText('1 - 1')).or(page.getByText('2 - 1'))).toBeVisible({
      timeout: 10_000,
    });
  });
});
