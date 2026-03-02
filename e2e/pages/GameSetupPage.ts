// e2e/pages/GameSetupPage.ts
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class GameSetupPage {
  constructor(private page: Page) {}

  // ── Navigation ──
  async goto() {
    await this.page.goto('/new');
  }

  // ── Actions ──
  async quickGame() {
    await this.page.getByRole('button', { name: /Quick Game/ }).click();
  }

  async startGame() {
    await this.page.getByRole('button', { name: /start game/i }).click();
  }

  async selectSingles() {
    await this.page.getByRole('button', { name: /Singles/ }).click();
  }

  async selectDoubles() {
    await this.page.getByRole('button', { name: /Doubles/ }).click();
  }

  async selectSideoutScoring() {
    await this.page.getByRole('button', { name: /Side-Out/ }).click();
  }

  async selectRallyScoring() {
    await this.page.getByRole('button', { name: /Rally/ }).click();
  }

  async selectPointsToWin(points: 11 | 15 | 21) {
    const section = this.page.locator('fieldset', { has: this.page.getByText('Points to Win') });
    await section.getByRole('button', { name: String(points), exact: true }).click();
  }

  async fillTeamName(team: 1 | 2, name: string) {
    await this.page.locator(`#team${team}-name`).fill(name);
  }

  async selectBestOf(games: 1 | 3 | 5) {
    const labels: Record<number, string> = { 1: '1 Game', 3: 'Best of 3', 5: 'Best of 5' };
    const section = this.page.locator('fieldset', { has: this.page.getByText('Match Format') });
    await section.getByRole('button', { name: labels[games] }).click();
  }

  // ── Assertions ──
  async expectSetupVisible() {
    await expect(this.page.getByRole('link', { name: 'New Game' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: /Quick Game/ })).toBeVisible();
    await expect(this.page.getByText('Game Type')).toBeVisible();
    await expect(this.page.getByText('Scoring')).toBeVisible();
    await expect(this.page.getByText('Points to Win')).toBeVisible();
  }
}
