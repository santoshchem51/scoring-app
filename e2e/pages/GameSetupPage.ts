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

  // ── Your Role Actions ──
  async expandYourRole() {
    // Use exact match to avoid ambiguity with BuddyPicker's collapsed row
    // (which is a div[role="button"] with name "Players: ... Change")
    await this.page.getByRole('button', { name: 'Change', exact: true }).click();
  }

  async selectScoringForOthers() {
    await this.page.getByRole('button', { name: /Scoring for Others/ }).click();
  }

  async selectImPlaying() {
    await this.page.getByRole('button', { name: /I'm Playing/ }).click();
  }

  async selectScorerTeam(team: 1 | 2) {
    const roleSection = this.page.locator('fieldset', { has: this.page.getByText('Your Role') });
    const teamContainer = roleSection.locator('.flex.gap-3');
    await teamContainer.locator('button').nth(team - 1).click();
  }

  async collapseYourRole() {
    await this.page.getByRole('button', { name: 'Done' }).click();
  }

  // ── Your Role Assertions ──
  async expectRoleCollapsed(roleText: string) {
    await expect(this.page.getByText(roleText)).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Change' })).toBeVisible();
  }

  async expectTeamSelectorVisible() {
    await expect(this.page.getByText('Which team are you on?')).toBeVisible();
  }

  async expectTeamSelectorHidden() {
    await expect(this.page.getByText('Which team are you on?')).not.toBeVisible();
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
