import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class SettingsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/settings');
    await expect(this.page.getByText('Settings')).toBeVisible({ timeout: 10000 });
  }

  async selectDisplayMode(mode: 'dark' | 'outdoor') {
    await this.page.getByLabel(mode, { exact: false }).click();
  }

  async selectDefaultScoringMode(mode: 'sideout' | 'rally') {
    const label = mode === 'sideout' ? 'Side-Out' : 'Rally';
    const fieldset = this.page.locator('fieldset', { has: this.page.getByText('Default Scoring') });
    await fieldset.getByRole('button', { name: label }).click();
  }

  async selectDefaultPointsToWin(points: 11 | 15 | 21) {
    const fieldset = this.page.locator('fieldset', { has: this.page.getByText('Default Points to Win') });
    await fieldset.getByRole('button', { name: String(points), exact: true }).click();
  }

  async selectDefaultMatchFormat(format: '1 Game' | 'Best of 3' | 'Best of 5') {
    await this.page.getByLabel(format, { exact: false }).click();
  }

  async expectAllSections() {
    await expect(this.page.getByText('Display')).toBeVisible();
    await expect(this.page.getByText('Sound')).toBeVisible();
  }
}
