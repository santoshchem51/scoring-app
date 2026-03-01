// e2e/pages/TournamentBrowsePage.ts
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class TournamentBrowsePage {
  constructor(private page: Page) {}

  // ── Navigation ──
  async goto() {
    await this.page.goto('/tournaments');
  }

  // ── Actions ──
  async filterByStatus(status: 'upcoming' | 'active' | 'completed' | 'all') {
    await this.page.getByLabel('Filter by status').selectOption(status);
  }

  async filterByFormat(format: string) {
    await this.page.getByLabel('Filter by format').selectOption(format);
  }

  async search(query: string) {
    await this.page.getByPlaceholder('Search name or location...').fill(query);
  }

  async clearSearch() {
    await this.page.getByPlaceholder('Search name or location...').clear();
  }

  async clickTab(tabName: 'Browse' | 'My Tournaments') {
    await this.page.getByRole('tab', { name: tabName }).click();
  }

  // ── Assertions ──
  async expectPageLoaded() {
    await expect(this.page.getByText('Tournaments', { exact: true })).toBeVisible();
    await expect(this.page.getByPlaceholder('Search name or location...')).toBeVisible();
    await expect(this.page.getByLabel('Filter by status')).toBeVisible();
  }

  async expectTournament(name: string, options?: { timeout?: number }) {
    await expect(this.page.getByRole('heading', { name })).toBeVisible(options);
  }

  async expectNoTournament(name: string, options?: { timeout?: number }) {
    await expect(this.page.getByRole('heading', { name })).not.toBeVisible(options);
  }

  async expectEmpty(options?: { timeout?: number }) {
    await expect(this.page.getByText('No tournaments yet')).toBeVisible(options);
  }

  async expectTabSwitcher() {
    await expect(this.page.getByRole('tablist')).toBeVisible();
    await expect(this.page.getByRole('tab', { name: 'Browse' })).toBeVisible();
    await expect(this.page.getByRole('tab', { name: 'My Tournaments' })).toBeVisible();
  }

  async expectNoTabSwitcher() {
    await expect(this.page.getByRole('tablist')).not.toBeVisible();
  }

  async expectStatusFilter(value: string) {
    await expect(this.page.getByLabel('Filter by status')).toHaveValue(value);
  }

  async expectCardLink(shareCode: string) {
    await expect(this.page.locator(`a[href="/t/${shareCode}"]`)).toBeVisible();
  }
}
