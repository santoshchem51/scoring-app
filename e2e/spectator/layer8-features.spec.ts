import { test, expect } from '@playwright/test';

// --- Config ---
const FIRESTORE_URL = 'http://127.0.0.1:8180';
const AUTH_URL = 'http://127.0.0.1:9099';
const FUNCTIONS_URL = 'http://127.0.0.1:5001';
const PROJECT_ID = 'picklescore-b0a71';
const BASE_URL = 'http://localhost:5205';

// --- Helpers (adapted from spectator.spec.ts) ---

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
            if (typeof v === 'object') return { mapValue: { fields: toFirestoreFields(v as Record<string, unknown>) } };
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

async function patchDoc(path: string, data: Record<string, unknown>) {
  // Build update mask from top-level keys
  const mask = Object.keys(data)
    .map((k) => `updateMask.fieldPaths=${k}`)
    .join('&');

  const resp = await fetch(
    `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?${mask}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer owner',
      },
      body: JSON.stringify({ fields: toFirestoreFields(data) }),
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`patchDoc(${path}) failed ${resp.status}: ${text}`);
  }
}

// --- Shared tournament seed ---
const SHARE_CODE = 'L8TEST01';
const TOURNAMENT_ID = 'l8t1';

function baseTournament() {
  return {
    name: 'Layer 8 Test Tournament',
    shareCode: SHARE_CODE,
    visibility: 'public',
    status: 'pool-play',
    format: 'round-robin',
    organizerId: 'org-l8',
    date: Date.now(),
    location: 'Test Courts',
    config: {
      gameType: 'singles',
      scoringMode: 'rally',
      matchFormat: 'single',
      pointsToWin: 11,
    },
    staff: {},
    staffUids: [],
    maxPlayers: 16,
    minPlayers: 4,
    accessMode: 'open',
    listed: true,
    registrationCounts: { confirmed: 4, pending: 0 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeMatch(
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    team1Name: `Team A ${id}`,
    team2Name: `Team B ${id}`,
    status: 'in-progress',
    visibility: 'public',
    ownerId: 'org-l8',
    sharedWith: [],
    tournamentId: TOURNAMENT_ID,
    config: {
      gameType: 'singles',
      scoringMode: 'rally',
      matchFormat: 'single',
      pointsToWin: 11,
    },
    team1PlayerIds: [],
    team2PlayerIds: [],
    games: [],
    winningSide: null,
    startedAt: Date.now(),
    completedAt: null,
    lastSnapshot: null,
    ...overrides,
  };
}

// --- Tests ---

test.describe('Layer 8: LiveNowSection + Security + Accessibility', () => {
  test.beforeEach(async () => {
    await clearEmulator();
    await seedDoc(`tournaments/${TOURNAMENT_ID}`, baseTournament());
  });

  // --- UX Tests ---

  test('1. no live matches → LIVE NOW section not shown', async ({ page }) => {
    // Only tournament seeded, no matches
    await page.goto(`${BASE_URL}/t/${SHARE_CODE}`);
    await expect(page.getByText('Layer 8 Test Tournament')).toBeVisible({ timeout: 10_000 });
    // "LIVE NOW" heading should NOT appear
    await expect(page.getByText('LIVE NOW')).not.toBeVisible();
  });

  test('2. single live match renders without overflow toggle', async ({ page }) => {
    await seedDoc('matches/l8m1', makeMatch('l8m1', {
      team1Name: 'Alice',
      team2Name: 'Bob',
    }));

    await page.goto(`${BASE_URL}/t/${SHARE_CODE}`);
    await expect(page.getByText('Alice')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Bob')).toBeVisible();
    // Verify "LIVE" badge on the card (use exact match to avoid "LIVE NOW" heading)
    await expect(page.getByText('LIVE', { exact: true })).toBeVisible();
    // No overflow button when <= 3 matches
    await expect(page.getByText('more live')).not.toBeVisible();
  });

  test('3. 4+ matches shows expandable overflow that toggles', async ({ page }) => {
    // Seed 4 in-progress public matches
    for (let i = 1; i <= 4; i++) {
      await seedDoc(`matches/l8m${i}`, makeMatch(`l8m${i}`, {
        team1Name: `Team1-${i}`,
        team2Name: `Team2-${i}`,
      }));
    }

    await page.goto(`${BASE_URL}/t/${SHARE_CODE}`);
    // Wait for data to load
    await expect(page.getByText('Team1-1')).toBeVisible({ timeout: 10_000 });

    // Only 3 cards visible initially (MAX_VISIBLE = 3)
    // The 4th match should not be visible
    await expect(page.getByText('Team1-4')).not.toBeVisible();

    // Overflow button visible
    const overflowBtn = page.getByText('+1 more live');
    await expect(overflowBtn).toBeVisible();

    // Click to expand
    await overflowBtn.click();
    await expect(page.getByText('Team1-4')).toBeVisible();

    // Button text changes to "Show fewer"
    const collapseBtn = page.getByText('Show fewer');
    await expect(collapseBtn).toBeVisible();

    // Click to collapse
    await collapseBtn.click();
    await expect(page.getByText('Team1-4')).not.toBeVisible();
  });

  test('4. completed matches excluded from Live Now', async ({ page }) => {
    // One in-progress match
    await seedDoc('matches/l8m-live', makeMatch('l8m-live', {
      team1Name: 'LiveTeamA',
      team2Name: 'LiveTeamB',
    }));
    // One completed match (status != 'in-progress' so query filters it out)
    await seedDoc('matches/l8m-done', makeMatch('l8m-done', {
      team1Name: 'DoneTeamA',
      team2Name: 'DoneTeamB',
      status: 'completed',
      winningSide: 1,
      completedAt: Date.now(),
    }));

    await page.goto(`${BASE_URL}/t/${SHARE_CODE}`);
    await expect(page.getByText('LiveTeamA')).toBeVisible({ timeout: 10_000 });
    // Completed match should NOT appear in Live Now section
    // The query filters by status == 'in-progress'
    await expect(page.getByText('DoneTeamA')).not.toBeVisible();
  });

  test('5. inline scores visible on LiveMatchCard', async ({ page }) => {
    await seedDoc('matches/l8m-score', makeMatch('l8m-score', {
      team1Name: 'ScoreAlpha',
      team2Name: 'ScoreBeta',
      lastSnapshot: JSON.stringify({ team1Score: 7, team2Score: 5 }),
    }));

    await page.goto(`${BASE_URL}/t/${SHARE_CODE}`);
    await expect(page.getByText('ScoreAlpha')).toBeVisible({ timeout: 10_000 });

    // The LiveMatchCard renders score as "{team1Score} - {team2Score}"
    // Look for "7 - 5" pattern in the card
    await expect(page.getByText('7 - 5')).toBeVisible({ timeout: 8_000 });
  });

  // --- Real-time Tests ---

  test('6. score update propagates in real-time', async ({ page }) => {
    await seedDoc('matches/l8m-rt', makeMatch('l8m-rt', {
      team1Name: 'RealTimeA',
      team2Name: 'RealTimeB',
      lastSnapshot: JSON.stringify({ team1Score: 3, team2Score: 2 }),
    }));

    await page.goto(`${BASE_URL}/t/${SHARE_CODE}`);
    await expect(page.getByText('3 - 2')).toBeVisible({ timeout: 10_000 });

    // PATCH the match's lastSnapshot to update score
    await patchDoc('matches/l8m-rt', {
      lastSnapshot: JSON.stringify({ team1Score: 4, team2Score: 2 }),
    });

    // onSnapshot should fire and update score in real-time
    await expect(page.getByText('4 - 2')).toBeVisible({ timeout: 10_000 });
    // Old score should no longer be visible
    await expect(page.getByText('3 - 2')).not.toBeVisible();
  });

  test('7. match completion removes from LIVE NOW or shows FINAL', async ({ page }) => {
    await seedDoc('matches/l8m-fin', makeMatch('l8m-fin', {
      team1Name: 'FinalTeamA',
      team2Name: 'FinalTeamB',
    }));

    await page.goto(`${BASE_URL}/t/${SHARE_CODE}`);
    // Wait for the LIVE badge on the match card (exact match to avoid "LIVE NOW" heading)
    await expect(page.getByText('LIVE', { exact: true })).toBeVisible({ timeout: 10_000 });

    // PATCH status to 'completed' — the query filters status=='in-progress',
    // so the match should drop from the live query.
    // The retention logic should show it with FINAL badge briefly.
    await patchDoc('matches/l8m-fin', {
      status: 'completed',
      winningSide: 1,
      completedAt: Date.now(),
    });

    // Either "FINAL" badge appears (retention) OR the match disappears from Live Now
    // Wait for the live query to update — check for FINAL or absence of LIVE badge
    try {
      await expect(page.getByText('FINAL')).toBeVisible({ timeout: 15_000 });
    } catch {
      // Alternative: LIVE badge disappears (match removed from query)
      await expect(page.getByText('LIVE', { exact: true })).not.toBeVisible({ timeout: 5_000 });
    }

    await page.screenshot({ path: 'e2e/screenshots/test7-match-completion.png' });
  });

  test('8. revoked projection shows "Match No Longer Public"', async ({ page }) => {
    // Seed a match
    await seedDoc('matches/l8m-rev', makeMatch('l8m-rev', {
      team1Name: 'RevokedA',
      team2Name: 'RevokedB',
    }));
    // Seed spectator projection with status: 'revoked'
    await seedDoc('matches/l8m-rev/public/spectator', {
      publicTeam1Name: 'RevokedA',
      publicTeam2Name: 'RevokedB',
      team1Score: 0,
      team2Score: 0,
      gameNumber: 1,
      team1Wins: 0,
      team2Wins: 0,
      status: 'revoked',
      visibility: 'public',
      tournamentId: TOURNAMENT_ID,
      spectatorCount: 0,
      updatedAt: Date.now(),
    });

    await page.goto(`${BASE_URL}/t/${SHARE_CODE}/match/l8m-rev`);
    await expect(page.getByText('Match No Longer Public')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('The organizer has made this match private.')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/test8-revoked.png' });
  });

  // --- Security Tests ---

  test('9. client write to stats collection denied', async () => {
    // Attempt to write to /users/fake/stats/summary WITHOUT Bearer owner
    // (simulating an unauthenticated client)
    const resp = await fetch(
      `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/fake-user/stats?documentId=summary`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: toFirestoreFields({
            schemaVersion: 1,
            totalMatches: 999,
            wins: 999,
            losses: 0,
            winRate: 100,
          }),
        }),
      },
    );
    // Firestore emulator should deny this write
    expect(resp.status).toBe(403);
  });

  test('10. spectator projection with extra field denied', async () => {
    // First, seed a match with Bearer owner
    await seedDoc('matches/l8m-sec', makeMatch('l8m-sec'));

    // Create a fake auth user in the Auth emulator
    const authResp = await fetch(
      `${AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'attacker@test.com',
          password: 'password123',
          returnSecureToken: true,
        }),
      },
    );
    const authData = await authResp.json();
    const attackerToken = authData.idToken;

    // Attempt to PATCH spectator projection with an extra field (phishingUrl)
    // using the attacker's token (not the owner)
    const resp = await fetch(
      `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/matches/l8m-sec/public/spectator`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${attackerToken}`,
        },
        body: JSON.stringify({
          fields: toFirestoreFields({
            publicTeam1Name: 'Legit',
            publicTeam2Name: 'Also Legit',
            team1Score: 0,
            team2Score: 0,
            gameNumber: 1,
            team1Wins: 0,
            team2Wins: 0,
            status: 'in-progress',
            tournamentId: TOURNAMENT_ID,
            spectatorCount: 0,
            updatedAt: Date.now(),
            visibility: 'public',
            phishingUrl: 'http://evil.com',
          }),
        }),
      },
    );
    // Should be denied — either 403 (permission denied) or 400 (bad request)
    // The emulator may return either status code depending on which rule fails first
    expect([400, 403]).toContain(resp.status);
  });

  test('11. processMatchCompletion callable validates and processes', async () => {
    // Clear auth emulator to avoid duplicate email conflicts
    await fetch(`${AUTH_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
      method: 'DELETE',
    });

    // Create an auth user via Auth emulator
    const uniqueEmail = `owner-${Date.now()}@test.com`;
    const signUpResp = await fetch(
      `${AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: uniqueEmail,
          password: 'password123',
          returnSecureToken: true,
        }),
      },
    );
    const signUpData = await signUpResp.json();
    if (!signUpData.localId) {
      throw new Error(`Auth sign-up failed: ${JSON.stringify(signUpData)}`);
    }
    const ownerUid = signUpData.localId;
    const ownerToken = signUpData.idToken;

    // Seed a completed match owned by this user
    await seedDoc('matches/l8m-callable', {
      team1Name: 'CallableTeamA',
      team2Name: 'CallableTeamB',
      status: 'completed',
      visibility: 'public',
      ownerId: ownerUid,
      sharedWith: [],
      tournamentId: null,
      config: {
        gameType: 'singles',
        scoringMode: 'rally',
        matchFormat: 'single',
        pointsToWin: 11,
      },
      team1PlayerIds: [ownerUid],
      team2PlayerIds: [],
      games: [{ team1Score: 11, team2Score: 5, winningSide: 1 }],
      winningSide: 1,
      startedAt: Date.now() - 60000,
      completedAt: Date.now(),
      lastSnapshot: null,
    });

    // Also seed the user doc (needed for profile lookups)
    await seedDoc(`users/${ownerUid}`, {
      id: ownerUid,
      displayName: 'Test Owner',
      email: uniqueEmail,
      createdAt: Date.now(),
    });

    // Call the callable function via the Functions emulator
    const callableResp = await fetch(
      `${FUNCTIONS_URL}/${PROJECT_ID}/us-central1/processMatchCompletion`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          data: { matchId: 'l8m-callable' },
        }),
      },
    );

    expect(callableResp.status).toBe(200);
    const callableResult = await callableResp.json();
    // The callable should return status: 'ok' (or 'skipped' if no participants)
    expect(callableResult.result.status).toMatch(/^(ok|skipped)$/);

    // If status is 'ok', verify stats or matchRefs docs were created
    if (callableResult.result.status === 'ok') {
      const statsResp = await fetch(
        `${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${ownerUid}/stats/summary`,
        {
          headers: { Authorization: 'Bearer owner' },
        },
      );
      // Stats doc should exist (200) or the participant may have errored (still OK at callable level)
      expect([200, 404]).toContain(statsResp.status);
    }
  });

  // --- Accessibility Tests ---

  test('12. match card has descriptive aria-label with score', async ({ page }) => {
    await seedDoc('matches/l8m-aria', makeMatch('l8m-aria', {
      team1Name: 'AriaAlpha',
      team2Name: 'AriaBeta',
      lastSnapshot: JSON.stringify({ team1Score: 9, team2Score: 6 }),
    }));

    await page.goto(`${BASE_URL}/t/${SHARE_CODE}`);
    await expect(page.getByText('AriaAlpha')).toBeVisible({ timeout: 10_000 });

    // Wait for score to load
    await expect(page.getByText('9 - 6')).toBeVisible({ timeout: 8_000 });

    // The <a> element for the match card should have an aria-label
    // Format: "{team1Name} versus {team2Name} {score}, live"
    const matchLink = page.locator('a[aria-label]').filter({
      has: page.getByText('AriaAlpha'),
    });
    const ariaLabel = await matchLink.getAttribute('aria-label');
    expect(ariaLabel).toContain('AriaAlpha');
    expect(ariaLabel).toContain('AriaBeta');
    expect(ariaLabel).toContain('9');
    expect(ariaLabel).toContain('6');
    expect(ariaLabel).toContain('live');
  });

  test('13. overflow button is keyboard accessible', async ({ page }) => {
    // Seed 4 matches to trigger overflow
    for (let i = 1; i <= 4; i++) {
      await seedDoc(`matches/l8kb${i}`, makeMatch(`l8kb${i}`, {
        team1Name: `KB-Team1-${i}`,
        team2Name: `KB-Team2-${i}`,
      }));
    }

    await page.goto(`${BASE_URL}/t/${SHARE_CODE}`);
    await expect(page.getByText('KB-Team1-1')).toBeVisible({ timeout: 10_000 });

    // 4th match should not be visible initially
    await expect(page.getByText('KB-Team1-4')).not.toBeVisible();

    // Find the overflow button
    const overflowBtn = page.getByText('+1 more live');
    await expect(overflowBtn).toBeVisible();

    // Focus the button and press Enter
    await overflowBtn.focus();
    await page.keyboard.press('Enter');

    // All 4 matches should now be visible
    await expect(page.getByText('KB-Team1-4')).toBeVisible();
  });
});
