import { test, expect } from '@playwright/test';
import { GameSetupPage } from '../pages/GameSetupPage';
import { ScoringPage } from '../pages/ScoringPage';

test.describe('MP-3.2: Live Scoring', () => {
  let setup: GameSetupPage;
  let scoring: ScoringPage;

  test.beforeEach(async ({ page }) => {
    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);
    await setup.goto();
    await setup.quickGame();
  });

  test('tap to score increments correct team score', async () => {
    await scoring.expectScore('0-0-2');

    await scoring.scorePoint('Team 1');
    await scoring.expectScore('1-0-2');
  });

  test('sideout: only serving team can score', async () => {
    await scoring.expectTeam2Disabled();
    await scoring.expectTeam1Enabled();
  });

  test('side out changes serving team', async () => {
    await scoring.scorePoint('Team 1');
    await scoring.scorePoint('Team 1');
    await scoring.expectScore('2-0-2');

    await scoring.triggerSideOut();
    await scoring.expectScore('0-2-1');
  });

  test('undo reverses last action', async () => {
    await scoring.scorePoint('Team 1');
    await scoring.expectScore('1-0-2');

    await scoring.undoLastAction();
    await scoring.expectScore('0-0-2');
  });

  test('multiple undos work in sequence', async () => {
    await scoring.scorePoint('Team 1');
    await scoring.scorePoint('Team 1');
    await scoring.expectScore('2-0-2');

    await scoring.undoLastAction();
    await scoring.expectScore('1-0-2');

    await scoring.undoLastAction();
    await scoring.expectScore('0-0-2');
  });

  test('game point indicator shows at 10 points', async () => {
    await scoring.scorePoints('Team 1', 10);

    await scoring.expectGamePoint();
  });
});

test.describe('MP-3.2b: Rally Scoring', () => {
  let setup: GameSetupPage;
  let scoring: ScoringPage;

  test.beforeEach(async ({ page }) => {
    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
  });

  test('rally mode: either team can score on any tap', async ({ page }) => {
    // Both team buttons should be enabled (no side-out restriction)
    await scoring.expectTeam1Enabled();
    await scoring.expectTeam2Enabled();

    // Side Out button should NOT be visible in rally mode
    await expect(scoring.sideOutBtn).not.toBeVisible();

    // Team 2 can score directly without side-out
    await scoring.scorePoint('Team 2');

    // Verify Team 2 score updated to 1
    await expect(
      page.locator('[aria-label="Scoreboard"]').locator('[aria-label*="Team 2: 1"]')
    ).toBeVisible();

    // Verify Team 1 score is still 0
    await expect(
      page.locator('[aria-label="Scoreboard"]').locator('[aria-label*="Team 1: 0"]')
    ).toBeVisible();

    // Both buttons still enabled after scoring
    await scoring.expectTeam1Enabled();
    await scoring.expectTeam2Enabled();
  });

  test('rally mode: game ends correctly at 11 points', async () => {
    // Score 11 points for Team 1 in rally mode (win-by-2 satisfied: 11-0)
    await scoring.scorePoints('Team 1', 11);

    // Match should be over (single-game format by default)
    await scoring.expectMatchOver();
  });

  test('rally mode: win-by-2 enforced', async ({ page }) => {
    // Score 10 for Team 1 — should trigger game point indicator
    await scoring.scorePoints('Team 1', 10);
    await scoring.expectGamePoint();

    // Verify Team 1 has 10 points
    await expect(
      page.locator('[aria-label="Scoreboard"]').locator('[aria-label*="Team 1: 10"]')
    ).toBeVisible();

    // Score 1 more for Team 1 (11-0 satisfies win-by-2) → Match Over
    await scoring.scorePoint('Team 1');
    await scoring.expectMatchOver();
  });
});
