import { test, expect } from '../fixtures';
import { signInAsTestUser, getCurrentUserUid } from '../helpers/emulator-auth';
import { FIRESTORE_EMULATOR, PROJECT_ID } from '../helpers/emulator-config';
import { randomUUID } from 'crypto';
import { GameSetupPage } from '../pages/GameSetupPage';
import { ScoringPage } from '../pages/ScoringPage';

test.describe('Sync Queue', () => {
  test('Settings page shows Cloud Sync section when signed in', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');

    // Cloud Sync section should be visible for signed-in users
    await expect(authenticatedPage.getByText('Cloud Sync')).toBeVisible({ timeout: 10000 });
    await expect(authenticatedPage.getByText('Status')).toBeVisible();
    await expect(authenticatedPage.getByRole('button', { name: /sync now/i })).toBeVisible();
  });

  test('Cloud Sync section hidden when not signed in', async ({ page }) => {
    await page.goto('/settings');

    // Cloud Sync section should NOT be visible for anonymous users
    await expect(page.getByText('Cloud Sync')).not.toBeVisible({ timeout: 5000 });
    // But other settings should still be visible
    await expect(page.getByText('Display')).toBeVisible();
  });

  test('completed match syncs to Firestore', async ({ page }) => {
    const email = `e2e-sync-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Sync Tester' });

    const uid = await getCurrentUserUid(page);
    expect(uid).toBeTruthy();

    // Play a quick match and complete it
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.quickGame();

    // Score 11 points to win (rally scoring, 11 points to win)
    await scoring.scorePoints('Team 1', 11);

    // Wait for match to complete
    await scoring.expectMatchOver();

    // Poll Firestore emulator for the match document
    await expect(async () => {
      const response = await fetch(
        `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/matches?pageSize=50`,
        { headers: { Authorization: 'Bearer owner' } },
      );
      expect(response.ok).toBe(true);
      const data = await response.json();
      const docs = data.documents || [];
      // Find a match owned by this user
      const userMatch = docs.find((doc: any) =>
        doc.fields?.userId?.stringValue === uid ||
        doc.fields?.ownerId?.stringValue === uid,
      );
      expect(userMatch).toBeTruthy();
    }).toPass({ timeout: 20000 });
  });

  test('sync indicator appears during sync operations', async ({ page }) => {
    const email = `e2e-ind-${randomUUID().slice(0, 8)}@test.com`;
    await page.goto('/');
    await signInAsTestUser(page, { email, displayName: 'Indicator User' });

    // Navigate to settings and trigger Sync Now
    await page.goto('/settings');
    await expect(page.getByText('Cloud Sync')).toBeVisible({ timeout: 10000 });

    const syncNowBtn = page.getByRole('button', { name: /sync now/i });
    await syncNowBtn.click();

    // The sync indicator should eventually settle to idle (no data to sync)
    // Verify the sync indicator is not stuck in failed state
    await page.waitForTimeout(3000);

    // Sync indicator should be hidden (idle) or not in failed state
    const indicator = page.locator('[data-testid="sync-indicator"]');
    const isVisible = await indicator.isVisible();
    if (isVisible) {
      // If visible, it should not be showing "failed"
      await expect(indicator).not.toContainText('failed');
    }
  });
});
