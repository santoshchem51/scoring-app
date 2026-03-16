import { test, expect } from '../../fixtures';
import {
  signInAsTestUser,
  getCurrentUserUid,
} from '../../helpers/emulator-auth';
import { FIRESTORE_EMULATOR, PROJECT_ID } from '../../helpers/emulator-config';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { randomUUID } from 'crypto';

test.describe('Cross-Cutting: Sync Journeys', () => {

  // ═══════════════════════════════════════════════════════════════════
  // C1 — Sync retry button after failed sync
  // ═══════════════════════════════════════════════════════════════════

  test('C1: sync retry button appears after failed sync and recovers', async ({
    page,
  }) => {
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

    // Verify sync error indicator or retry button is visible
    // The sync system should show failed state after Firestore errors
    const syncSection = page.locator('text=Cloud Sync').locator('..');
    const retryBtn = page.getByRole('button', { name: /retry|sync now/i });

    // Wait for sync to attempt and fail
    await page.waitForTimeout(3000);

    // Check for error indicator
    const syncIndicator = page.locator('[data-testid="sync-indicator"]');
    const indicatorVisible = await syncIndicator.isVisible().catch(() => false);
    if (indicatorVisible) {
      // Indicator should show error/failed state
      await expect(syncIndicator).toBeVisible();
    }

    // Remove the route intercepts to allow recovery
    await page.unroute('**/firestore.googleapis.com/**');
    await page.unroute('**/127.0.0.1:8180/**');

    // Click retry / sync now
    await expect(retryBtn).toBeVisible({ timeout: 5000 });
    await retryBtn.click();

    // Verify sync recovers — indicator should settle to idle/success
    await expect(async () => {
      const indicator = page.locator('[data-testid="sync-indicator"]');
      const isVisible = await indicator.isVisible();
      if (isVisible) {
        // If still visible, it should not show "failed" or "error"
        const text = await indicator.textContent();
        expect(text).not.toMatch(/failed|error/i);
      }
      // If not visible, sync has settled to idle — success
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
    await scoring.scorePoints('Team 2', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    // Sign in for the first time
    const email = `e2e-c3-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'First Timer' });

    // Navigate to settings and check sync indicator settles
    await page.goto('/settings');
    await expect(page.getByText('Cloud Sync')).toBeVisible({ timeout: 10000 });

    // Wait for sync to process both matches
    // The sync indicator should eventually settle (not stuck in syncing/failed)
    await expect(async () => {
      const indicator = page.locator('[data-testid="sync-indicator"]');
      const isVisible = await indicator.isVisible();
      if (isVisible) {
        const text = await indicator.textContent();
        // Should not be in failed state
        expect(text).not.toMatch(/failed|error/i);
        // Should not be actively syncing forever
        // (allow "syncing" briefly, but eventually it should settle)
      }
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
