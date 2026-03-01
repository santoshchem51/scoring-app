import { test, expect } from '@playwright/test';
import { GameSetupPage } from '../pages/GameSetupPage';
import { ScoringPage } from '../pages/ScoringPage';

test.describe('MP-3.1: Match Setup', () => {
  let setup: GameSetupPage;
  let scoring: ScoringPage;

  test.beforeEach(async ({ page }) => {
    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);
    await setup.goto();
  });

  test('shows New Game setup UI', async () => {
    await setup.expectSetupVisible();
  });

  test('quick game starts scoring screen', async ({ page }) => {
    await setup.quickGame();

    await scoring.expectOnScoringScreen();
    await scoring.expectScore('0-0-2');
    await expect(page.getByRole('button', { name: /Side out/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Undo/i })).toBeVisible();
  });

  test('creates singles match', async () => {
    await setup.selectSingles();
    await setup.startGame();

    await scoring.expectOnScoringScreen();
  });

  test('creates match with rally scoring - both buttons enabled', async () => {
    await setup.selectRallyScoring();
    await setup.startGame();

    await scoring.expectOnScoringScreen();
    await scoring.expectTeam1Enabled();
    await scoring.expectTeam2Enabled();
  });

  test('changes points to win to 15', async () => {
    await setup.selectPointsToWin(15);
    await setup.startGame();

    await scoring.expectPointsToWin(15);
  });

  test('changes points to win to 21', async () => {
    await setup.selectPointsToWin(21);
    await setup.startGame();

    await scoring.expectPointsToWin(21);
  });

  test('team names appear on scoreboard after setup', async ({ page }) => {
    await setup.fillTeamName(1, 'Aces');
    await setup.fillTeamName(2, 'Smashers');
    await setup.startGame();

    await scoring.expectOnScoringScreen();
    await expect(page.getByText('Aces')).toBeVisible();
    await expect(page.getByText('Smashers')).toBeVisible();
  });
});
