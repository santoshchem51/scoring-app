import { test, expect } from '../fixtures';
import { GameSetupPage } from '../pages/GameSetupPage';
import { ScoringPage } from '../pages/ScoringPage';

test.describe('Offline Functionality (Manual Plan 6.3)', () => {
  test.fixme('app loads from cache when offline', async ({ page }) => {
    // TODO: This test requires a production build with service worker.
    // In dev mode, there is no service worker to cache assets.
    // Run against `npx vite build && npx vite preview` for a real test.
    await page.goto('/new', { timeout: 15000 });
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 10000 });
    await page.context().setOffline(true);
    try {
      await page.reload({ timeout: 15000 });
      await expect(page.getByRole('navigation')).toBeVisible({ timeout: 10000 });
    } finally {
      await page.context().setOffline(false);
    }
  });

  test('can score a match while offline', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    // Load the app and navigate to game setup while still online.
    // Wait for the Quick Game button so we know the page (and its chunks) are loaded.
    await setup.goto();
    await expect(
      page.getByRole('button', { name: /Quick Game/ }),
    ).toBeVisible({ timeout: 10000 });

    // Start the game BEFORE going offline — the scoring page needs its JS chunk loaded.
    await setup.quickGame();
    await scoring.expectOnScoringScreen();

    // Go offline — scoring is entirely local (Dexie.js / IndexedDB)
    await page.context().setOffline(true);

    try {
      // Score several points while offline
      await scoring.scorePoint('Team 1');
      await scoring.expectScore('1-0-2');

      await scoring.scorePoint('Team 1');
      await scoring.expectScore('2-0-2');

      await scoring.scorePoint('Team 1');
      await scoring.expectScore('3-0-2');

      // Undo also works offline
      await scoring.undoLastAction();
      await scoring.expectScore('2-0-2');
    } finally {
      await page.context().setOffline(false);
    }
  });

  test('match saved locally when offline', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    // Load the app while online and wait for setup page to be interactive.
    // Use the Quick Game button as our readiness indicator (avoids "New Game" ambiguity).
    await setup.goto();
    await expect(
      page.getByRole('button', { name: /Quick Game/ }),
    ).toBeVisible({ timeout: 10000 });

    // Start the game while still online so the scoring page JS chunk is loaded
    await setup.quickGame();
    await scoring.expectOnScoringScreen();

    // Go offline for the actual scoring
    await page.context().setOffline(true);

    try {
      // Play a complete game while offline
      await scoring.scorePoints('Team 1', 11);
      await scoring.expectMatchOver('Team 1');
      await scoring.saveAndFinish();
    } finally {
      // Go back online
      await page.context().setOffline(false);
    }

    // Navigate to history — the match should be persisted in local Dexie/IndexedDB
    await page.goto('/history', { timeout: 15000 });
    await expect(
      page.getByRole('article', { name: 'Team 1 vs Team 2' }),
    ).toBeVisible({ timeout: 10000 });
  });
});
