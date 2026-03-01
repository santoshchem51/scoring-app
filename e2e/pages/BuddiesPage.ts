// e2e/pages/BuddiesPage.ts
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class BuddiesPage {
  constructor(private page: Page) {}

  // ── Navigation ──
  async goto() {
    await this.page.goto('/buddies');
  }

  async gotoNewGroup() {
    await this.page.goto('/buddies/new');
  }

  // ── Actions ──
  async createGroup(name: string) {
    await this.page.locator('#group-name').fill(name);
    await this.page.getByRole('button', { name: /Create Group/i }).click();
  }

  // ── Assertions ──
  async expectEmpty() {
    await expect(this.page.getByText('No groups yet')).toBeVisible();
  }

  async expectGroup(name: string) {
    await expect(this.page.getByText(name)).toBeVisible();
  }

  async expectSignInRequired() {
    await expect(this.page.getByText('Sign in required')).toBeVisible();
  }

  async expectOnGroupDetail() {
    // After creating a group, we're redirected to the group detail page
    await this.page.waitForURL(/\/buddies\/.+/);
  }
}
