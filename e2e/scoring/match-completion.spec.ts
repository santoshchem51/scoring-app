import { test, expect } from '@playwright/test';
import { GameSetupPage } from '../pages/GameSetupPage';
import { ScoringPage } from '../pages/ScoringPage';

test.describe('MP-3.3: Match Completion', () => {
  let setup: GameSetupPage;
  let scoring: ScoringPage;

  test.beforeEach(async ({ page }) => {
    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);
    await setup.goto();
    await setup.quickGame();
  });

  test('game completes at 11 points with match over screen', async () => {
    await scoring.scorePoints('Team 1', 11);

    await scoring.expectMatchOver('Team 1');
  });

  test('match over screen shows Save & Finish button', async () => {
    await scoring.scorePoints('Team 1', 11);

    await scoring.expectMatchOver();
    await expect(scoring.saveFinishBtn).toBeVisible();
  });

  test('save & finish navigates to match history', async ({ page }) => {
    await scoring.scorePoints('Team 1', 11);

    await scoring.saveAndFinish();

    await expect(page.getByRole('link', { name: 'Match History' })).toBeVisible();
    await expect(page.getByText('11').first()).toBeVisible();
  });

  test('match saved to history after completion', async ({ page }) => {
    await scoring.scorePoints('Team 1', 11);
    await scoring.saveAndFinish();

    // Verify we're on the history page with the match visible
    await expect(page.getByRole('link', { name: 'Match History' })).toBeVisible();
    await expect(page.getByText('11').first()).toBeVisible();
  });
});
