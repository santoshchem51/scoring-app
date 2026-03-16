import { test, expect } from '../../fixtures';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { NavigationBar } from '../../pages/NavigationBar';
import { captureScreen } from '../../helpers/screenshots';

test.describe('Casual Scorer: Core Journeys', () => {
  let setup: GameSetupPage;
  let scoring: ScoringPage;

  test.beforeEach(async ({ page }) => {
    setup = new GameSetupPage(page);
    scoring = new ScoringPage(page);
  });

  test('CS-1: landing page Start Scoring navigates to game setup', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/start scoring/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: /start scoring/i }).click();
    await setup.expectSetupVisible();
  });

  test('CS-3: best-of-3 plays through game boundary', async ({ page }, testInfo) => {
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.selectBestOf(3);
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    // Win game 1 (rally mode: either team can score)
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectBetweenGames();
    await captureScreen(page, testInfo, 'scoring-betweengames-game1complete');

    // Start game 2
    await scoring.startNextGame();
    await scoring.expectScores(0, 0);

    // Win game 2 -> match over
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await captureScreen(page, testInfo, 'scoring-matchover-bestof3');
  });

  test('CS-4: doubles sideout serving restrictions + score call', async ({ page }, testInfo) => {
    await setup.goto();
    await setup.selectDoubles();
    await setup.selectSideoutScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    await scoring.expectTeam1Enabled();
    await scoring.expectTeam2Disabled();
    await scoring.expectScoreCall('0-0-2');

    await scoring.scorePoint('Team 1');
    await scoring.expectTeamScore('Team 1', 1);

    await scoring.triggerSideOut();
    await scoring.expectTeam1Disabled();
    await scoring.expectTeam2Enabled();
    await captureScreen(page, testInfo, 'scoring-sideout-team2serving');
  });

  test('CS-6: rally scoring win-by-2 enforced', async ({ page }, testInfo) => {
    await setup.goto();
    await setup.selectRallyScoring();
    await setup.startGame();
    await scoring.expectOnScoringScreen();

    await scoring.scorePoints('Team 1', 10);
    await scoring.expectTeamScore('Team 1', 10);

    await scoring.scorePoints('Team 2', 10);
    await scoring.expectScores(10, 10);

    await scoring.scorePoint('Team 1');
    await scoring.expectScores(11, 10);
    await expect(scoring.team1ScoreBtn).toBeVisible();

    await scoring.scorePoint('Team 1');
    await scoring.expectMatchOver();
    await captureScreen(page, testInfo, 'scoring-rally-winby2-matchover');
  });
});
