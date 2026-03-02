// e2e/pages/ProfilePage.ts
import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class ProfilePage {
  readonly header: Locator;
  readonly statsSection: Locator;
  readonly matchesList: Locator;
  readonly loadMoreButton: Locator;
  readonly emptyState: Locator;
  readonly loadingSkeleton: Locator;

  constructor(private page: Page) {
    this.header = page.locator('header[aria-label="Player profile"]');
    this.statsSection = page.locator('section[aria-labelledby="stats-heading"]');
    this.matchesList = page.locator('ul[aria-label="Recent match results"]');
    this.loadMoreButton = page.getByLabel('Load more matches');
    this.emptyState = page.getByText('No matches recorded yet');
    this.loadingSkeleton = page.locator('[aria-label="Loading profile"]');
  }

  async goto() {
    await this.page.goto('/profile');
  }

  async expectHeaderVisible(name: string, email: string) {
    await expect(this.header.getByRole('heading', { level: 1 })).toHaveText(name);
    await expect(this.header.getByText(email)).toBeVisible();
  }

  async expectMemberSince(text: string) {
    await expect(this.header.getByText(`Member since ${text}`)).toBeVisible();
  }

  async expectTierBadge(tier: string) {
    await expect(this.header.getByLabelText(new RegExp(`Skill tier: ${tier}`))).toBeVisible();
  }

  async expectWinRate(percentage: string) {
    await expect(this.statsSection.getByText(percentage)).toBeVisible();
  }

  async expectTotalMatches(count: number) {
    await expect(this.statsSection.getByLabelText(`Total matches: ${count}`)).toBeVisible();
  }

  async expectMatchCount(count: number) {
    const items = this.matchesList.locator('li');
    await expect(items).toHaveCount(count);
  }

  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
    const cta = this.page.getByRole('link', { name: 'Start a Match' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/new');
  }

  async clickLoadMore() {
    await this.loadMoreButton.click();
  }
}
