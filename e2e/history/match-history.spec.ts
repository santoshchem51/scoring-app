import { test, expect } from '@playwright/test';
import { GameSetupPage } from '../pages/GameSetupPage';
import { ScoringPage } from '../pages/ScoringPage';

test.describe('Match History (Manual Plan 2.1)', () => {
  test('empty state shows "No Matches Yet" when no matches recorded', async ({ page }) => {
    await page.goto('/history');

    await expect(page.getByText('No Matches Yet')).toBeVisible();
    await expect(
      page.getByText('Start your first game and your match history will appear here.'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start a Game' })).toBeVisible();
  });

  test('completed match appears in history', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    // Play a quick game to completion
    await setup.goto();
    await setup.quickGame();
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver('Team 1');
    await scoring.saveAndFinish();

    // Should be on the history page with the completed match
    await expect(page.getByRole('link', { name: 'Match History' })).toBeVisible();
    await expect(page.getByText('No Matches Yet')).not.toBeVisible();
    await expect(
      page.getByRole('article', { name: 'Team 1 vs Team 2' }),
    ).toBeVisible();
  });

  test('match entry shows correct details — score, team names, game type', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    // Play a quick game: sideout doubles, to 11, best-of-1
    await setup.goto();
    await setup.quickGame();
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver('Team 1');
    await scoring.saveAndFinish();

    // Locate the match card
    const card = page.getByRole('article', { name: 'Team 1 vs Team 2' });
    await expect(card).toBeVisible();

    // Scoring mode badge
    await expect(card.getByText('Side-Out')).toBeVisible();

    // Team names
    await expect(card.getByText('Team 1')).toBeVisible();
    await expect(card.getByText('Team 2')).toBeVisible();

    // Scores — Team 1 won 11-0 (quick game, all points to Team 1)
    await expect(card.getByText('11')).toBeVisible();
    await expect(card.getByText('0')).toBeVisible();

    // Game type info: "Doubles · To 11" (no best-of suffix for single format)
    await expect(card.getByText('Doubles · To 11')).toBeVisible();
  });

  test('history persists across page reload', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    // Play a quick game to completion
    await setup.goto();
    await setup.quickGame();
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver('Team 1');
    await scoring.saveAndFinish();

    // Verify the match is in history
    await expect(
      page.getByRole('article', { name: 'Team 1 vs Team 2' }),
    ).toBeVisible();

    // Reload the page
    await page.reload();

    // Match should still be visible after reload (persisted in Dexie/IndexedDB)
    await expect(
      page.getByRole('article', { name: 'Team 1 vs Team 2' }),
    ).toBeVisible();
    await expect(page.getByText('No Matches Yet')).not.toBeVisible();
  });
});
