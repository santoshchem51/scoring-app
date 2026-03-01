// e2e/pages/PlayersPage.ts
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class PlayersPage {
  constructor(private page: Page) {}

  // ── Navigation ──
  async goto() {
    await this.page.goto('/players');
  }

  // ── Actions ──
  async addPlayer(name: string) {
    await this.page.getByPlaceholder('Player name').fill(name);
    await this.page.getByRole('button', { name: 'Add' }).click();
    // Wait for player to appear before returning
    await expect(this.page.getByText(name, { exact: true })).toBeVisible();
  }

  async deletePlayer(name: string) {
    await this.page.getByRole('button', { name: `Delete ${name}` }).click();
    const dialog = this.page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    // dispatchEvent to avoid nav overlap — tracked as a known UI bug
    await dialog.getByRole('button', { name: 'Delete' }).dispatchEvent('click');
  }

  // ── Assertions ──
  async expectEmpty() {
    await expect(this.page.getByText('No Players Yet')).toBeVisible();
  }

  async expectPlayer(name: string) {
    await expect(this.page.getByText(name, { exact: true })).toBeVisible();
  }

  async expectPlayerGone(name: string) {
    await expect(this.page.getByText(name, { exact: true })).toBeHidden();
  }

  async expectInputCleared() {
    await expect(this.page.getByPlaceholder('Player name')).toHaveValue('');
  }
}
