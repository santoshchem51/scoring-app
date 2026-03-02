import { test, expect } from '@playwright/test';
import { GameSetupPage } from '../pages/GameSetupPage';
import { ScoringPage } from '../pages/ScoringPage';

test.describe('Rapid Input Handling (Manual Plan 10.4)', () => {
  let setup: GameSetupPage;
  let scoring: ScoringPage;

  test.beforeEach(async ({ page }) => {
    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);
  });

  test('rapid tapping on score button counts each tap exactly once', async ({
    page,
  }) => {
    // Start a rally scoring game so both team buttons are always enabled
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Fire 5 rapid clicks without awaiting between them
    const btn = scoring.team1ScoreBtn;
    await Promise.all([
      btn.click(),
      btn.click(),
      btn.click(),
      btn.click(),
      btn.click(),
    ]);

    // Allow a brief moment for any debounce / state settling
    await page.waitForTimeout(500);

    // In rally mode, the scoreboard uses aria-labels like "Team 1: 5"
    // Verify Team 1 has exactly 5 points (each click counted once)
    await expect(
      page
        .locator('[aria-label="Scoreboard"]')
        .locator('[aria-label*="Team 1: 5"]'),
    ).toBeVisible({ timeout: 5000 });
  });

  test('rapid undo does not crash and leaves correct score', async ({
    page,
  }) => {
    // Start a rally scoring game
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Score 3 deliberate points (awaited so state is stable)
    await scoring.scorePoint('Team 1');
    await scoring.scorePoint('Team 1');
    await scoring.scorePoint('Team 1');

    // Verify we have 3 points before rapid undo
    await expect(
      page
        .locator('[aria-label="Scoreboard"]')
        .locator('[aria-label*="Team 1: 3"]'),
    ).toBeVisible({ timeout: 5000 });

    // Rapid-fire 5 undo clicks (more than the 3 actions available)
    const undoBtn = scoring.undoBtn;
    await Promise.all([
      undoBtn.click(),
      undoBtn.click(),
      undoBtn.click(),
      undoBtn.click(),
      undoBtn.click(),
    ]);

    // Allow state to settle
    await page.waitForTimeout(500);

    // The app should not crash — scoring screen should still be visible
    await scoring.expectOnScoringScreen();

    // Score should be back to 0 (can't go negative)
    await expect(
      page
        .locator('[aria-label="Scoreboard"]')
        .locator('[aria-label*="Team 1: 0"]'),
    ).toBeVisible({ timeout: 5000 });
  });
});
