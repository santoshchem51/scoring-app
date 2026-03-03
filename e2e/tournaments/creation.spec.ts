// e2e/tournaments/creation.spec.ts
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

// ── Helpers ────────────────────────────────────────────────────────

/** Fill the three required text/date fields. */
async function fillRequiredFields(page: Page, name = 'Test Tournament') {
  await page.locator('#t-name').fill(name);
  const tomorrow = new Date(Date.now() + 86400000);
  await page.locator('#t-date').fill(tomorrow.toISOString().split('T')[0]);
  await page.locator('#t-location').fill('Test Courts');
}

/** Select an option inside a specific fieldset (scoped by legend text). */
async function selectInFieldset(
  page: Page,
  legendText: string,
  buttonLabel: string | RegExp,
) {
  const fieldset = page.locator('fieldset', {
    has: page.locator('legend', { hasText: legendText }),
  });
  await fieldset.getByRole('button', { name: buttonLabel }).click();
}

/** Select all game-rule defaults: Round Robin, Doubles, Side-Out, 11, 1 Game. */
async function selectDefaultGameRules(page: Page) {
  // These are already the defaults, but clicking them ensures they are active.
  await selectInFieldset(page, 'Format', /Round Robin/);
  await selectInFieldset(page, 'Game Type', /Doubles/);
  await selectInFieldset(page, 'Scoring', /Side-Out/);
  await selectInFieldset(page, 'Points to Win', '11');
  await selectInFieldset(page, 'Match Format', /1 Game/);
}

/** Submit the tournament creation form and wait for dashboard redirect. */
async function submitAndWaitForDashboard(page: Page, tournamentName: string) {
  await page.getByRole('button', { name: 'Create Tournament' }).click();

  // Wait for redirect to /tournaments/:id and the dashboard to load with the name
  await expect(page).toHaveURL(/\/tournaments\/[a-f0-9-]+/, { timeout: 15000 });
  await expect(page.getByText(tournamentName)).toBeVisible({ timeout: 10000 });
}

// ── Test Suite ──────────────────────────────────────────────────────

test.describe('Tournament Creation (Manual Plan 4.1)', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/tournaments/new');
    // Wait for the form to be ready
    await expect(authenticatedPage.locator('#t-name')).toBeVisible({
      timeout: 15000,
    });
  });

  // ── 1. Create round-robin tournament ─────────────────────────────

  test('create round-robin tournament with all required fields', async ({
    authenticatedPage: page,
  }) => {
    const name = `RR Tourney ${Date.now()}`;
    await fillRequiredFields(page, name);
    await selectInFieldset(page, 'Format', /Round Robin/);
    await selectInFieldset(page, 'Game Type', /Doubles/);
    await selectInFieldset(page, 'Scoring', /Side-Out/);
    await selectInFieldset(page, 'Points to Win', '11');
    await selectInFieldset(page, 'Match Format', /1 Game/);

    await submitAndWaitForDashboard(page, name);
  });

  // ── 2. Create single-elimination tournament ──────────────────────

  test('create single-elimination tournament', async ({
    authenticatedPage: page,
  }) => {
    const name = `Elim Tourney ${Date.now()}`;
    await fillRequiredFields(page, name);
    await selectInFieldset(page, 'Format', /Elimination/);
    await selectInFieldset(page, 'Game Type', /Singles/);
    await selectInFieldset(page, 'Scoring', /Rally/);
    await selectInFieldset(page, 'Points to Win', '15');
    await selectInFieldset(page, 'Match Format', /Best of 3/);

    await submitAndWaitForDashboard(page, name);
  });

  // ── 3. Create pool-bracket (hybrid) tournament ───────────────────

  test('create pool-bracket (hybrid) tournament', async ({
    authenticatedPage: page,
  }) => {
    const name = `Hybrid Tourney ${Date.now()}`;
    await fillRequiredFields(page, name);
    await selectInFieldset(page, 'Format', /Pool.*Bracket/);
    await selectInFieldset(page, 'Game Type', /Doubles/);
    await selectInFieldset(page, 'Scoring', /Rally/);
    await selectInFieldset(page, 'Points to Win', '21');
    await selectInFieldset(page, 'Match Format', /Best of 5/);

    await submitAndWaitForDashboard(page, name);
  });

  // ── 4. Access mode selector shows all 4 options ──────────────────

  test('access mode selector shows all 4 options', async ({
    authenticatedPage: page,
  }) => {
    // The AccessModeSelector uses its own buttons inside a fieldset
    // with legend "Who Can Join?"
    const accessFieldset = page.locator('fieldset', {
      has: page.locator('legend', { hasText: 'Who Can Join?' }),
    });

    await expect(
      accessFieldset.getByRole('button', { name: /^Open / }),
    ).toBeVisible();
    await expect(
      accessFieldset.getByRole('button', { name: /^Approval Required/ }),
    ).toBeVisible();
    await expect(
      accessFieldset.getByRole('button', { name: /^Invite Only/ }),
    ).toBeVisible();
    await expect(
      accessFieldset.getByRole('button', { name: /^Buddy Group/ }),
    ).toBeVisible();

    // Open is selected by default
    await expect(
      accessFieldset.getByRole('button', { name: /^Open / }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  // ── 5. Tournament appears in "My Tournaments" after creation ─────

  test('tournament appears in My Tournaments after creation', { timeout: 60000 }, async ({
    authenticatedPage: page,
  }) => {
    const name = `My Tourney ${Date.now()}`;
    await fillRequiredFields(page, name);
    await selectDefaultGameRules(page);
    await submitAndWaitForDashboard(page, name);

    // SPA-navigate via BottomNav instead of page.goto() to avoid full page
    // reload that causes createResource to fire before auth is restored.
    await page.locator('nav[aria-label="Main navigation"]').getByRole('link', { name: 'Tournaments' }).click();
    await expect(page.getByRole('tab', { name: 'My Tournaments' })).toBeVisible(
      { timeout: 15000 },
    );
    await page.getByRole('tab', { name: 'My Tournaments' }).click();

    await expect(page.getByText(name)).toBeVisible({ timeout: 30000 });
  });

  // ── 6. Tournament appears in public browse (if listed/public) ────

  test('tournament appears in public browse when open and listed', async ({
    authenticatedPage: page,
    browser,
  }) => {
    const name = `Public Tourney ${Date.now()}`;
    await fillRequiredFields(page, name);
    await selectDefaultGameRules(page);

    // Ensure "Open" access mode (default) — tournament is listed by default
    const accessFieldset = page.locator('fieldset', {
      has: page.locator('legend', { hasText: 'Who Can Join?' }),
    });
    await expect(
      accessFieldset.getByRole('button', { name: /^Open / }),
    ).toHaveAttribute('aria-pressed', 'true');

    await submitAndWaitForDashboard(page, name);

    // Extract the base URL from the current page origin so the new context
    // can navigate with absolute URLs.
    const baseURL = new URL(page.url()).origin;

    // Open a fresh browser context (no auth) to verify public visibility.
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();

    try {
      await publicPage.goto(`${baseURL}/tournaments`);
      await publicPage.waitForLoadState('domcontentloaded');

      // For an unauthenticated user, the browse tab loads by default (no tab
      // switcher). We need to wait for tournaments to load.
      // Switch status filter to "All Statuses" in case the new tournament
      // is in "setup" status (not yet "registration").
      const statusFilter = publicPage.getByLabel('Filter by status');
      await expect(statusFilter).toBeVisible({ timeout: 15000 });
      await statusFilter.selectOption('all');

      await expect(publicPage.getByText(name)).toBeVisible({ timeout: 15000 });
    } finally {
      await publicContext.close();
    }
  });
});
