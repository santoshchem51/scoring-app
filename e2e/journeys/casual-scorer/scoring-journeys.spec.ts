import { test, expect } from '../../fixtures';
import { GameSetupPage } from '../../pages/GameSetupPage';
import { ScoringPage } from '../../pages/ScoringPage';
import { NavigationBar } from '../../pages/NavigationBar';
import { captureScreen } from '../../helpers/screenshots';

test.describe('@p0 Casual Scorer: Core Journeys', () => {

  test('CS-1: landing page Start Scoring navigates to game setup', async ({ page }) => {
    const setup = new GameSetupPage(page);
    await setup.goto();
    await setup.expectSetupVisible();
  });

  test('CS-3: best-of-3 plays through game boundary', async ({ page }, testInfo) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
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
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
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
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
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

  test('CS-2: quick game to completion appears in history', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.quickGame();
    await scoring.expectOnScoringScreen();

    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    const nav = new NavigationBar(page);
    await nav.goToHistory();
    const matchCard = page.locator('article', { hasText: 'Team 1' });
    await expect(matchCard).toBeVisible({ timeout: 10000 });
    await expect(matchCard.getByText('11', { exact: true })).toBeVisible();
    await expect(matchCard.getByText('0', { exact: true })).toBeVisible();
  });

  test('CS-16: match history persists across reload', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);
    await setup.goto();
    await setup.quickGame();
    await scoring.expectOnScoringScreen();
    await scoring.scorePoints('Team 1', 11);
    await scoring.expectMatchOver();
    await scoring.saveAndFinish();

    const nav = new NavigationBar(page);
    await nav.goToHistory();
    const matchCard = page.locator('article', { hasText: 'Team 1' });
    await expect(matchCard).toBeVisible({ timeout: 10000 });
    await expect(matchCard.getByText('11', { exact: true })).toBeVisible();

    await page.reload();
    await expect(matchCard).toBeVisible({ timeout: 10000 });
    await expect(matchCard.getByText('11', { exact: true })).toBeVisible();
  });
});
