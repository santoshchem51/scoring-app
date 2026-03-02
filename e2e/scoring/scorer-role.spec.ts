import { test, expect } from '@playwright/test';
import { GameSetupPage } from '../pages/GameSetupPage';
import { ScoringPage } from '../pages/ScoringPage';

test.describe('Scorer Role (Phase 1)', () => {
  test('Your Role UI defaults to I\'m Playing and toggles correctly', async ({ page }) => {
    const setup = new GameSetupPage(page);
    await setup.goto();

    // Collapsed by default showing "I'm Playing"
    await setup.expectRoleCollapsed("I'm Playing");

    // Expand and select Scoring for Others
    await setup.expandYourRole();
    await setup.expectTeamSelectorVisible();
    await setup.selectScoringForOthers();
    await setup.expectTeamSelectorHidden();

    // Switch back to I'm Playing
    await setup.selectImPlaying();
    await setup.expectTeamSelectorVisible();

    // Collapse
    await setup.collapseYourRole();
    await setup.expectRoleCollapsed("I'm Playing");
  });

  test('scorer team selection carries to scoring screen indicator', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    await setup.goto();
    await setup.fillTeamName(1, 'Sai');
    await setup.fillTeamName(2, 'Dave');

    // Expand role section and select team 2
    await setup.expandYourRole();
    await setup.selectScorerTeam(2);
    await setup.collapseYourRole();

    // Start game
    await setup.startGame();

    // Verify scoring screen shows team indicator
    await scoring.expectOnScoringScreen();
    await scoring.expectTeamIndicator('Dave');
  });

  test('Quick Game shows default team 1 indicator on scoring screen', async ({ page }) => {
    const setup = new GameSetupPage(page);
    const scoring = new ScoringPage(page);

    await setup.goto();
    await setup.quickGame();

    await scoring.expectOnScoringScreen();
    await scoring.expectTeamIndicator('Team 1');
  });
});
