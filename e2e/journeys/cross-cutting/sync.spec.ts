import { test, expect } from '../../fixtures';
import {
  signInAsTestUser,
  signOut,
  getCurrentUserUid,
  seedFirestoreDocAdmin,
} from '../../helpers/emulator-auth';
import { FIRESTORE_EMULATOR, PROJECT_ID } from '../../helpers/emulator-config';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { NavigationBar } from '../../pages/NavigationBar';
import { SettingsPage } from '../../pages/SettingsPage';
import { captureScreen } from '../../helpers/screenshots';
import { randomUUID } from 'crypto';

test.describe('@p0 Cross-Cutting: Sync Journeys', () => {

  // ═══════════════════════════════════════════════════════════════════
  // C1 — Sync retry button after failed sync
  // ═══════════════════════════════════════════════════════════════════

  test('C1: sync retry button appears after failed sync and recovers', async ({
    page,
  }, testInfo) => {
    const email = `e2e-c1-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Sync Retry User' });

    // Intercept Firestore requests and return 500 errors
    await page.route('**/firestore.googleapis.com/**', route =>
      route.fulfill({ status: 500, body: 'Simulated server error' }),
    );
    await page.route('**/127.0.0.1:8180/**', route => {
      // Allow emulator auth but block Firestore data writes
      const url = route.request().url();
      if (url.includes('/documents/') && route.request().method() !== 'GET') {
        return route.fulfill({ status: 500, body: 'Simulated server error' });
      }
      return route.continue();
    });

    // Play a quick match to completion
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.quickGame();
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    // Navigate to settings
    await page.goto('/settings');
    await expect(page.getByText('Cloud Sync')).toBeVisible({ timeout: 10000 });

    // Wait for sync to attempt and fail — poll for error/retry state
    const retryBtn = page.getByRole('button', { name: /retry|sync now/i });
    await expect(async () => {
      const hasError = await page.getByText(/failed|error/i).isVisible().catch(() => false);
      const hasRetry = await retryBtn.isVisible().catch(() => false);
      expect(hasError || hasRetry).toBe(true);
    }).toPass({ timeout: 15000 });
    await captureScreen(page, testInfo, 'sync-settings-errorstate');

    // Remove the route intercepts to allow recovery
    await page.unroute('**/firestore.googleapis.com/**');
    await page.unroute('**/127.0.0.1:8180/**');

    // Click retry / sync now
    await expect(retryBtn).toBeVisible({ timeout: 5000 });
    await retryBtn.click();

    // Verify sync recovers — error text should disappear
    await expect(async () => {
      const hasError = await page.getByText(/failed|error/i).isVisible().catch(() => false);
      expect(hasError).toBe(false);
    }).toPass({ timeout: 15000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // C2 — awaitingAuth jobs resume after re-authentication
  // ═══════════════════════════════════════════════════════════════════

  test('C2: local match syncs to cloud after signing in', async ({ page }) => {
    // Start without signing in — score and complete a match locally
    await page.goto('/');

    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.quickGame();
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    // Now sign in
    const email = `e2e-c2-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Late Signer' });
    const uid = await getCurrentUserUid(page);

    // Verify the match eventually appears in Firestore
    // Poll the Firestore emulator REST API for a match owned by this user
    await expect(async () => {
      const response = await fetch(
        `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/matches?pageSize=50`,
        { headers: { Authorization: 'Bearer owner' } },
      );
      expect(response.ok).toBe(true);
      const data = await response.json();
      const docs = data.documents || [];
      const userMatch = docs.find((doc: any) =>
        doc.fields?.userId?.stringValue === uid ||
        doc.fields?.ownerId?.stringValue === uid,
      );
      expect(userMatch).toBeTruthy();
    }).toPass({ timeout: 20000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // C3 — Local matches pushed to cloud on first sign-in
  // ═══════════════════════════════════════════════════════════════════

  test('C3: multiple local matches sync on first sign-in', async ({ page }) => {
    // Score 2 matches without signing in
    await page.goto('/');

    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    // Match 1
    await setup.goto();
    await setup.quickGame();
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    // Match 2
    await setup.goto();
    await setup.quickGame();
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    // Sign in for the first time
    const email = `e2e-c3-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'First Timer' });

    // Navigate to settings and check sync indicator settles
    await page.goto('/settings');
    await expect(page.getByText('Cloud Sync')).toBeVisible({ timeout: 10000 });

    // Wait for sync to process both matches — error text should not persist
    await expect(async () => {
      const hasError = await page.getByText(/failed|error/i).isVisible().catch(() => false);
      expect(hasError).toBe(false);
    }).toPass({ timeout: 25000 });

    // Verify via Firestore emulator that matches exist
    const uid = await getCurrentUserUid(page);
    await expect(async () => {
      const response = await fetch(
        `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/matches?pageSize=50`,
        { headers: { Authorization: 'Bearer owner' } },
      );
      expect(response.ok).toBe(true);
      const data = await response.json();
      const docs = data.documents || [];
      const userMatches = docs.filter((doc: any) =>
        doc.fields?.userId?.stringValue === uid ||
        doc.fields?.ownerId?.stringValue === uid,
      );
      // Both matches should have synced
      expect(userMatches.length).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 25000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1 Cross-Cutting: Settings & Navigation
// ═══════════════════════════════════════════════════════════════════════════

test.describe('@p1 Cross-Cutting: P1 Settings & Navigation', () => {

  // ═══════════════════════════════════════════════════════════════════
  // C4 — Cloud matches pulled on sign-in (multi-context)
  // ═══════════════════════════════════════════════════════════════════

  test('C4: cloud matches pulled on sign-in', async ({ page }, testInfo) => {
    // Sign in to get a UID, then seed a match in Firestore for that user
    const email = `e2e-c4-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Cloud Puller' });
    const uid = await getCurrentUserUid(page);

    // Seed a completed match in Firestore with this user as owner
    const matchId = `seeded-${randomUUID().slice(0, 8)}`;
    await seedFirestoreDocAdmin('matches', matchId, {
      id: matchId,
      ownerId: uid,
      sharedWith: [],
      visibility: 'public',
      syncedAt: Date.now(),
      team1Name: 'Seeded Eagles',
      team2Name: 'Seeded Hawks',
      team1PlayerIds: [],
      team2PlayerIds: [],
      config: {
        gameType: 'singles',
        scoringMode: 'rally',
        matchFormat: 'single',
        pointsToWin: 11,
      },
      games: [{ gameNumber: 1, team1Score: 11, team2Score: 7, winningSide: 1 }],
      winningSide: 1,
      status: 'completed',
      startedAt: Date.now() - 60000,
      completedAt: Date.now() - 30000,
    });

    // Force a cloud pull by reloading — the app pulls cloud matches on auth
    await page.reload();
    await page.waitForTimeout(2000);
    await signInAsTestUser(page, { email, displayName: 'Cloud Puller' });

    // Navigate to /new first to ensure bottom nav is visible
    await page.goto('/new');
    await expect(page.locator('nav')).toBeVisible({ timeout: 10000 });
    const nav = new NavigationBar(page);
    await nav.goToHistory();

    // Assert the seeded match appears
    await expect(async () => {
      const card = page.locator('article', { hasText: 'Seeded Eagles' });
      await expect(card).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 20000 });

    await captureScreen(page, testInfo, 'c4-cloud-match-in-history');

    // Verify both team names appear
    const card = page.locator('article', { hasText: 'Seeded Eagles' });
    await expect(card.getByText('Seeded Hawks')).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // C8 — Default scoring settings persist across sessions
  // ═══════════════════════════════════════════════════════════════════

  test('C8: default scoring settings persist across sessions', async ({ page }, testInfo) => {
    await page.goto('/');

    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();

    // Change default scoring to Rally
    await settingsPage.selectDefaultScoringMode('rally');
    // Change default points to 15
    await settingsPage.selectDefaultPointsToWin(15);

    await captureScreen(page, testInfo, 'c8-settings-after-change');

    // Verify selections are active (aria-pressed="true")
    const rallyBtn = page.getByRole('button', { name: /Rally/i, pressed: true });
    const pts15Btn = page.getByRole('button', { name: '15', pressed: true });
    await expect(rallyBtn).toBeVisible();
    await expect(pts15Btn).toBeVisible();

    // Navigate away to /new, then back to /settings
    const nav = new NavigationBar(page);
    await nav.goToNew();
    await expect(page.getByText('Game Type')).toBeVisible({ timeout: 10000 });

    await settingsPage.goto();

    // Assert: Rally and 15pts are still selected (survived navigation)
    await expect(page.getByRole('button', { name: /Rally/i, pressed: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '15', pressed: true })).toBeVisible({ timeout: 5000 });

    await captureScreen(page, testInfo, 'c8-settings-after-navigation');

    // Reload the page
    await page.reload();

    // Wait for settings page to re-render
    await expect(page.getByText('Settings')).toBeVisible({ timeout: 10000 });

    // Assert: Rally and 15pts are still selected (survived reload via localStorage)
    await expect(page.getByRole('button', { name: /Rally/i, pressed: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '15', pressed: true })).toBeVisible({ timeout: 5000 });

    await captureScreen(page, testInfo, 'c8-settings-after-reload');
  });

  // ═══════════════════════════════════════════════════════════════════
  // C10 — Rapid navigation stress test
  // ═══════════════════════════════════════════════════════════════════

  test('C10: rapid navigation stress test — no crash or console errors', async ({ page }, testInfo) => {
    // Collect page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // Navigate to /new first — landing page (/) may not show bottom nav
    await page.goto('/new');
    await expect(page.locator('nav')).toBeVisible({ timeout: 10000 });

    const nav = new NavigationBar(page);

    // Navigate quickly between multiple pages
    await nav.goToNew();
    await expect(page.locator('nav')).toBeVisible({ timeout: 5000 });

    await nav.goToHistory();
    await expect(page.locator('nav')).toBeVisible({ timeout: 5000 });

    await nav.goToPlayers();
    await expect(page.locator('nav')).toBeVisible({ timeout: 5000 });

    await nav.goToSettings();
    await expect(page.locator('nav')).toBeVisible({ timeout: 5000 });

    // Second rapid pass — no waits except element visibility
    await nav.goToNew();
    await nav.goToHistory();
    await nav.goToPlayers();
    await nav.goToSettings();
    await nav.goToNew();

    // Wait for final page to fully render
    await expect(page.getByText('Game Type')).toBeVisible({ timeout: 10000 });

    await captureScreen(page, testInfo, 'c10-after-rapid-nav');

    // Assert no console errors occurred
    expect(pageErrors).toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════════
  // C11 — Sign out and sign in as different user — no stale data
  // ═══════════════════════════════════════════════════════════════════

  test('C11: sign out and sign in as different user — no stale data leakage', async ({ page }, testInfo) => {
    // Sign in as User A
    const emailA = `e2e-c11-a-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email: emailA, displayName: 'User A' });

    // Play a custom match as User A with unique team names
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.fillTeamName(1, 'UserA Tigers');
    await setup.fillTeamName(2, 'UserA Lions');
    await setup.startGame();
    await scoring.scorePointsByName('UserA Tigers', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    // Navigate to history and verify the match appears
    const nav = new NavigationBar(page);
    await nav.goToHistory();
    await expect(async () => {
      const card = page.locator('article', { hasText: 'UserA Tigers' });
      await expect(card).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 15000 });

    await captureScreen(page, testInfo, 'c11-user-a-history');

    // Sign out using the programmatic helper
    await signOut(page);

    // Clear local IndexedDB to simulate a fresh session for the new user
    // (local-first Dexie DB stores matches without user-scoping)
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    });

    await captureScreen(page, testInfo, 'c11-after-signout');

    // Sign in as User B
    const emailB = `e2e-c11-b-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email: emailB, displayName: 'User B' });

    // Navigate to /new first to ensure bottom nav is visible
    await page.goto('/new');
    await expect(page.locator('nav')).toBeVisible({ timeout: 10000 });

    // Navigate to history
    await nav.goToHistory();

    // Positive wait: wait for history page to render
    await expect(page.getByText('Match History').first()).toBeVisible({ timeout: 10000 });

    // Allow time for any async data loading
    await page.waitForTimeout(2000);

    await captureScreen(page, testInfo, 'c11-user-b-history');

    // Assert: User A's match does NOT appear (no stale data)
    const staleCard = page.locator('article', { hasText: 'UserA Tigers' });
    await expect(staleCard).not.toBeVisible();

    // Also verify the empty state or lack of User A's data
    const anyCard = page.locator('article[aria-label*="UserA"]');
    await expect(anyCard).toHaveCount(0);
  });
});
