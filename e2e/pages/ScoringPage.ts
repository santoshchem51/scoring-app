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

  /** Score a point using the team's actual display name (for tournament matches). */
  async scorePointByName(teamName: string) {
    await this.page.getByRole('button', { name: `Score point for ${teamName}` }).click();
  }

  async scorePointsByName(teamName: string, count: number) {
    for (let i = 0; i < count; i++) {
      await this.scorePointByName(teamName);
    }
  }

  /** Score a point for the first enabled score button (works with any team name). */
  async scoreFirstTeam() {
    const btn = this.page.locator('button[aria-label^="Score point for"]').first();
    await btn.click();
  }

  async scoreFirstTeamPoints(count: number) {
    for (let i = 0; i < count; i++) {
      await this.scoreFirstTeam();
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

  async expectTeamIndicator(teamName: string) {
    await expect(this.page.getByText(`You're on ${teamName}`)).toBeVisible({ timeout: 10000 });
  }

  async expectNoTeamIndicator() {
    await expect(this.page.locator('text=/You\'re on/')).not.toBeVisible();
  }

  // --- Score assertion using aria-label on scoreboard panels ---
  // The Scoreboard renders each team panel with aria-label like:
  //   "Team 1: 5, serving, game point"  or  "Team 2: 3"
  // Use this instead of expectScore('X - Y') which doesn't match the DOM.
  async expectTeamScore(team: 'Team 1' | 'Team 2', score: number) {
    const scoreboard = this.page.locator('[aria-label="Scoreboard"]');
    await expect(scoreboard.locator(`[aria-label*="${team}: ${score}"]`)).toBeVisible({ timeout: 10000 });
  }

  async expectScores(team1Score: number, team2Score: number) {
    await this.expectTeamScore('Team 1', team1Score);
    await this.expectTeamScore('Team 2', team2Score);
  }

  // --- Game flow methods ---
  async startNextGame() {
    await this.page.getByRole('button', { name: /start (next )?game/i }).click();
  }

  async getMatchIdFromUrl(): Promise<string> {
    const url = this.page.url();
    const match = url.match(/\/score\/(.+)$/);
    if (!match) throw new Error(`Could not extract match ID from URL: ${url}`);
    return match[1];
  }

  async expectBetweenGames(gamesWon?: string) {
    await expect(this.page.getByText(/game complete/i)).toBeVisible({ timeout: 10000 });
    await expect(this.page.getByRole('button', { name: /start (next )?game/i })).toBeVisible();
    if (gamesWon) {
      await expect(this.page.getByText(gamesWon)).toBeVisible();
    }
  }

  async expectServingIndicator(team: 1 | 2) {
    await expect(this.page.getByTestId(`serving-indicator-${team}`)).toBeVisible();
  }

  async expectGameNumber(n: number) {
    await expect(this.page.getByText(`Game ${n}`)).toBeVisible();
  }

  async expectScoreCall(call: string) {
    await expect(this.page.getByTestId('score-call')).toContainText(call);
  }
}
