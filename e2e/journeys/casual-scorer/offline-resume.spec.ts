import { test, expect } from '../../fixtures';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { captureScreen } from '../../helpers/screenshots';

test.describe('@p0 Casual Scorer: Offline & Resume', () => {

  test('CS-7: match resume restores full snapshot', async ({ page }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.selectBestOf(3);
    await setup.startGame();

    await scoring.scorePoints('Team 1', 7);
    await scoring.scorePoints('Team 2', 4);
    await scoring.expectScores(7, 4);

    await page.reload();
    await scoring.expectOnScoringScreen();

    await scoring.expectScores(7, 4);
    await expect(scoring.team1ScoreBtn).toBeVisible();
    await expect(scoring.team2ScoreBtn).toBeVisible();
    await scoring.expectGameNumber(1);

    await captureScreen(page, testInfo, 'scoring-resume-afterreload');
  });

  test('CS-8: go offline mid-match, continue scoring', async ({ page, context }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();

    await scoring.scorePoints('Team 1', 3);
    await scoring.expectTeamScore('Team 1', 3);

    await context.setOffline(true);

    await scoring.scorePoints('Team 1', 3);
    await scoring.expectTeamScore('Team 1', 6);

    await context.setOffline(false);

    await page.reload();
    await scoring.expectOnScoringScreen();
    await scoring.expectTeamScore('Team 1', 6);

    await captureScreen(page, testInfo, 'scoring-offline-resumed');
  });

  test('CS-9: undo sequences and boundary behavior', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();

    await scoring.scorePoint('Team 1');
    await scoring.expectTeamScore('Team 1', 1);
    await scoring.undoLastAction();
    await scoring.expectScores(0, 0);

    await scoring.scorePoints('Team 1', 3);
    await scoring.expectTeamScore('Team 1', 3);
    await scoring.undoLastAction();
    await scoring.undoLastAction();
    await scoring.expectTeamScore('Team 1', 1);
  });
});
