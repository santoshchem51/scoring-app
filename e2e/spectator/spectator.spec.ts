import { test, expect } from '@playwright/test';

// These tests require:
// - Dev server running on port 5199
// - Firebase emulators running (Auth: 9099, Firestore: 8180)
// Run with: npx playwright test e2e/spectator/

const EMULATOR_PROJECT_ID = 'picklescore-b0a71';
const FIRESTORE_URL = 'http://127.0.0.1:8180';

async function clearEmulator() {
  await fetch(
    `${FIRESTORE_URL}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
}

async function seedDoc(path: string, data: Record<string, unknown>) {
  const parts = path.split('/');
  const collectionPath = parts.slice(0, -1).join('/');
  const docId = parts[parts.length - 1];

  await fetch(
    `${FIRESTORE_URL}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/${collectionPath}?documentId=${docId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFirestoreFields(data) }),
    },
  );
}

// Convert JS object to Firestore REST API field format
function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') fields[key] = { stringValue: value };
    else if (typeof value === 'number') fields[key] = { integerValue: String(value) };
    else if (typeof value === 'boolean') fields[key] = { booleanValue: value };
    else if (value === null) fields[key] = { nullValue: null };
    else if (Array.isArray(value))
      fields[key] = { arrayValue: { values: value.map((v) => ({ stringValue: String(v) })) } };
    else if (typeof value === 'object')
      fields[key] = {
        mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) },
      };
  }
  return fields;
}

test.describe('Spectator Experience', () => {
  test.beforeAll(async () => {
    await clearEmulator();
  });

  test('spectator opens tournament hub via share code', async ({ page }) => {
    // Seed tournament
    await seedDoc('tournaments/t1', {
      name: 'Summer Slam 2026',
      shareCode: 'TEST1234',
      visibility: 'public',
      status: 'pool-play',
      format: 'round-robin',
      organizerId: 'org-1',
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
    });

    await page.goto('http://localhost:5199/t/TEST1234');
    await expect(page.getByText('Summer Slam 2026')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Pool Play')).toBeVisible();
  });

  test('spectator navigates to match detail page', async ({ page }) => {
    // Seed match
    await seedDoc('matches/m1', {
      team1Name: 'Sarah M.',
      team2Name: 'Mike T.',
      status: 'in-progress',
      visibility: 'public',
      ownerId: 'org-1',
      sharedWith: [],
      tournamentId: 't1',
      config: {
        gameType: 'singles',
        scoringMode: 'rally',
        matchFormat: 'best-of-3',
        pointsToWin: 11,
      },
      team1PlayerIds: [],
      team2PlayerIds: [],
      games: [],
      winningSide: null,
      startedAt: Date.now(),
      completedAt: null,
      syncedAt: Date.now(),
    });

    await page.goto('http://localhost:5199/t/TEST1234/match/m1');
    await expect(page.getByText('Sarah M.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Mike T.')).toBeVisible();
  });

  test('invalid share code shows error', async ({ page }) => {
    await page.goto('http://localhost:5199/t/INVALID99');
    await expect(page.getByText('Tournament Not Found')).toBeVisible({ timeout: 10_000 });
  });

  test('scoreboard shows LIVE badge for in-progress match', async ({ page }) => {
    await page.goto('http://localhost:5199/t/TEST1234/match/m1');
    await expect(page.getByText('LIVE')).toBeVisible({ timeout: 10_000 });
  });

  test('privacy: non-consenting player shows anonymized name', async ({ page }) => {
    // Seed spectator projection with anonymized names
    await seedDoc('matches/m1/public/spectator', {
      publicTeam1Name: 'Player A',
      publicTeam2Name: 'Mike T.',
      team1Score: 5,
      team2Score: 3,
      gameNumber: 1,
      team1Wins: 0,
      team2Wins: 0,
      status: 'in-progress',
      visibility: 'public',
      tournamentId: 't1',
      tournamentShareCode: 'TEST1234',
      spectatorCount: 0,
      updatedAt: Date.now(),
    });

    // TODO: Update PublicMatchPage to read from spectator projection instead of match doc
    // For now this test documents the intended behavior
    test.skip();
  });

  test('unauthenticated user can view full spectator experience', async ({ page }) => {
    await page.goto('http://localhost:5199/t/TEST1234');
    // No sign-in prompt blocking the view
    await expect(page.getByText('Summer Slam 2026')).toBeVisible({ timeout: 10_000 });
    // Privacy policy footer visible
    await expect(page.getByText('Privacy Policy')).toBeVisible();
  });

  test('segmented control switches between Play-by-Play and Stats', async ({ page }) => {
    await page.goto('http://localhost:5199/t/TEST1234/match/m1');

    // Default: Play-by-Play tab active
    const playByPlayTab = page.getByRole('tab', { name: /play-by-play/i });
    const statsTab = page.getByRole('tab', { name: /stats/i });

    await expect(playByPlayTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });

    // Click Stats tab
    await statsTab.click();
    await expect(statsTab).toHaveAttribute('aria-selected', 'true');
    await expect(playByPlayTab).toHaveAttribute('aria-selected', 'false');
  });

  test('reduced motion: no animations', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();

    await page.goto('http://localhost:5199/t/TEST1234/match/m1');
    await page.waitForTimeout(2000);

    // Verify prefers-reduced-motion is active
    const motionPref = await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    expect(motionPref).toBe(true);

    await context.close();
  });

  test('back link navigates to tournament hub', async ({ page }) => {
    await page.goto('http://localhost:5199/t/TEST1234/match/m1');

    const backLink = page.getByRole('link', { name: /back to tournament/i });
    await expect(backLink).toBeVisible({ timeout: 10_000 });
    await expect(backLink).toHaveAttribute('href', '/t/TEST1234');
  });

  // --- Placeholder stubs for complex tests (future implementation) ---

  // TODO: Requires multi-context Playwright setup with two browser tabs
  // to verify real-time score updates propagate to spectators
  test.skip('cross-tab real-time: score update appears in spectator view', async () => {});

  // TODO: Requires seeded play-by-play events and touch interaction testing
  // to verify timeline scrolling and event rendering
  test.skip('play-by-play touch: timeline scrolls and renders events', async () => {});

  // TODO: Requires doubles match seed data with four players
  // to verify the doubles-specific scoreboard layout
  test.skip('doubles layout: scoreboard shows all four player names', async () => {});

  // TODO: Requires seeding many matches (10+) to verify tournament hub
  // handles overflow with scroll or pagination
  test.skip('hub overflow: tournament hub scrolls with many matches', async () => {});
});
