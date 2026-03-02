// e2e/pages/ScoringPage.ts
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class ScoringPage {
  constructor(private page: Page) {}

  // ── Locators ──
  get team1ScoreBtn() { return this.page.getByRole('button', { name: 'Score point for Team 1' }); }
  get team2ScoreBtn() { return this.page.getByRole('button', { name: 'Score point for Team 2' }); }
  get undoBtn()       { return this.page.getByRole('button', { name: /Undo/i }); }
  get sideOutBtn()    { return this.page.getByRole('button', { name: /Side out/i }); }
  get saveFinishBtn() { return this.page.getByRole('button', { name: 'Save & Finish' }); }

  // ── Actions ──
  async scorePoint(team: 'Team 1' | 'Team 2') {
    const btn = team === 'Team 1' ? this.team1ScoreBtn : this.team2ScoreBtn;
    await btn.click();
  }

  async scorePoints(team: 'Team 1' | 'Team 2', count: number) {
    for (let i = 0; i < count; i++) {
      await this.scorePoint(team);
    }
  }

  async undoLastAction() {
    await this.undoBtn.click();
  }

  async triggerSideOut() {
    await this.sideOutBtn.click();
  }

  async saveAndFinish() {
    await this.saveFinishBtn.click();
  }

  // ── Assertions ──
  async expectOnScoringScreen() {
    await expect(this.page.getByRole('link', { name: 'Live Score' })).toBeVisible();
  }

  async expectScore(scoreText: string) {
    await expect(this.page.getByText(scoreText)).toBeVisible();
  }

  async expectGamePoint() {
    await expect(this.page.getByText('GAME POINT')).toBeVisible();
  }

  async expectMatchOver(winnerName?: string) {
    await expect(this.page.getByText('Match Over!')).toBeVisible();
    if (winnerName) {
      await expect(this.page.getByText(`${winnerName} wins!`)).toBeVisible();
    }
  }

  async expectTeam1Enabled() {
    await expect(this.team1ScoreBtn).toBeEnabled();
  }

  async expectTeam1Disabled() {
    await expect(this.team1ScoreBtn).toBeDisabled();
  }

  async expectTeam2Enabled() {
    await expect(this.team2ScoreBtn).toBeEnabled();
  }

  async expectTeam2Disabled() {
    await expect(this.team2ScoreBtn).toBeDisabled();
  }

  async expectPointsToWin(points: number) {
    await expect(this.page.getByText(`to ${points}`)).toBeVisible();
  }
}
