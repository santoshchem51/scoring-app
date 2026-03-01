// e2e/pages/NavigationBar.ts
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class NavigationBar {
  private nav;

  constructor(private page: Page) {
    this.nav = page.locator('nav');
  }

  // ── Actions ──
  async goToNew()         { await this.nav.getByText('New').click(); }
  async goToHistory()     { await this.nav.getByText('History').click(); }
  async goToPlayers()     { await this.nav.getByText('Players').click(); }
  async goToSettings()    { await this.nav.getByText('Settings').click(); }
  async goToTournaments() { await this.nav.getByText('Tournaments').click(); }
  async goToBuddies()     { await this.nav.getByText('Buddies').click(); }

  // ── Assertions ──
  async expectAllTabs() {
    await expect(this.nav.getByText('New')).toBeVisible();
    await expect(this.nav.getByText('History')).toBeVisible();
    await expect(this.nav.getByText('Players')).toBeVisible();
    await expect(this.nav.getByText('Settings')).toBeVisible();
  }

  async expectBuddiesTab() {
    await expect(this.nav.getByText('Buddies')).toBeVisible();
  }

  async expectTournamentsTab() {
    await expect(this.nav.getByText('Tournaments')).toBeVisible();
  }
}
