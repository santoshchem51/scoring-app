import { test } from '@playwright/test';
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
