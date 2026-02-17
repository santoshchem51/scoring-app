import { test, expect } from '@playwright/test';
import {
  clearEmulators,
  signInAsTestUser,
  seedFirestoreDocAdmin,
} from './helpers/emulator-auth';

// Run all tests in this file serially so they share the same emulator state
test.describe.configure({ mode: 'serial' });

// ── Helpers ──────────────────────────────────────────────────────────

function makeTournament(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e2e-tournament-default',
    name: 'Default Tournament',
    date: Date.now() + 86400000,
    location: 'Default Courts',
    format: 'round-robin',
    organizerId: 'organizer-1',
    scorekeeperIds: [],
    status: 'registration',
    maxPlayers: 16,
    teamFormation: null,
    minPlayers: 4,
    entryFee: null,
    rules: { pointsToWin: 11, mustWin: true, bestOf: 1, playAllMatches: true },
    pausedFrom: null,
    cancellationReason: null,
    visibility: 'public',
    shareCode: 'DEFAULT1',
    config: { poolCount: 0, poolSize: 0, advanceCount: 0, consolation: false, thirdPlace: false },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ── A. Browse tab (logged out, no data) ──────────────────────────────

test.describe('Browse tab - logged out', () => {
  test.beforeAll(async () => {
    await clearEmulators();
  });

  test('shows page title, search input, and filter dropdowns', async ({ page }) => {
    await page.goto('/tournaments');

    // Page title
    await expect(page.getByText('Tournaments', { exact: true })).toBeVisible({
      timeout: 15000,
    });

    // Search input
    await expect(
      page.getByPlaceholder('Search name or location...'),
    ).toBeVisible();

    // Status filter defaults to "Upcoming"
    const statusSelect = page.getByLabel('Filter by status');
    await expect(statusSelect).toBeVisible();
    await expect(statusSelect).toHaveValue('upcoming');

    // Format filter
    await expect(page.getByLabel('Filter by format')).toBeVisible();
  });

  test('tab switcher is NOT visible when logged out', async ({ page }) => {
    await page.goto('/tournaments');

    // Wait for the page to render by checking a known element
    await expect(page.getByLabel('Filter by status')).toBeVisible({
      timeout: 15000,
    });

    await expect(page.getByRole('tablist')).not.toBeVisible();
  });

  test('shows empty state when no public tournaments exist', async ({ page }) => {
    await page.goto('/tournaments');

    await expect(page.getByText('No tournaments yet')).toBeVisible({
      timeout: 15000,
    });
  });
});

// ── B. Browse tab with seeded data ───────────────────────────────────

test.describe('Browse tab - seeded tournaments', () => {
  test.beforeAll(async () => {
    await clearEmulators();

    await seedFirestoreDocAdmin('tournaments', 'e2e-t1', makeTournament({
      id: 'e2e-t1',
      name: 'Spring Championship',
      location: 'Central Park Courts',
      format: 'round-robin',
      status: 'registration',
      shareCode: 'SPRING01',
    }));

    await seedFirestoreDocAdmin('tournaments', 'e2e-t2', makeTournament({
      id: 'e2e-t2',
      name: 'Summer Slam',
      location: 'Beach Arena',
      format: 'single-elimination',
      status: 'registration',
      shareCode: 'SUMMER01',
    }));

    await seedFirestoreDocAdmin('tournaments', 'e2e-t3', makeTournament({
      id: 'e2e-t3',
      name: 'Winter Classic',
      location: 'Indoor Gym',
      format: 'round-robin',
      status: 'registration',
      shareCode: 'WINTER01',
    }));
  });

  test('tournament cards display correct info', async ({ page }) => {
    await page.goto('/tournaments');

    // Wait for cards to appear
    await expect(page.getByRole('heading', { name: 'Spring Championship' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('heading', { name: 'Summer Slam' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Winter Classic' })).toBeVisible();

    // Check locations shown (inside <p> elements, not dropdown options)
    await expect(page.getByText('Central Park Courts')).toBeVisible();
    await expect(page.getByText('Beach Arena')).toBeVisible();

    // Check format badges (use locator scoped to card links, not dropdown options)
    const cards = page.locator('a[href^="/t/"]');
    await expect(cards.filter({ hasText: 'Round Robin' }).first()).toBeVisible();
    await expect(cards.filter({ hasText: 'Single Elimination' })).toBeVisible();

    // Check status badges
    await expect(cards.filter({ hasText: 'Registration Open' }).first()).toBeVisible();
  });

  test('cards link to /t/:shareCode', async ({ page }) => {
    await page.goto('/tournaments');

    await expect(page.getByRole('heading', { name: 'Spring Championship' })).toBeVisible({
      timeout: 15000,
    });

    // Check that the card has a link to /t/SPRING01
    const springCard = page.locator('a[href="/t/SPRING01"]');
    await expect(springCard).toBeVisible();
  });
});

// ── C. Browse tab filter behavior ────────────────────────────────────

test.describe('Browse tab - filter behavior', () => {
  test.beforeAll(async () => {
    await clearEmulators();

    // Upcoming (registration)
    await seedFirestoreDocAdmin('tournaments', 'e2e-f1', makeTournament({
      id: 'e2e-f1',
      name: 'Open Registration Tourney',
      location: 'Park Courts',
      format: 'round-robin',
      status: 'registration',
      shareCode: 'OPENREG1',
    }));

    // Active (pool-play)
    await seedFirestoreDocAdmin('tournaments', 'e2e-f2', makeTournament({
      id: 'e2e-f2',
      name: 'Pool Play Active Tourney',
      location: 'Downtown Arena',
      format: 'single-elimination',
      status: 'pool-play',
      shareCode: 'POOLPL01',
    }));

    // Completed
    await seedFirestoreDocAdmin('tournaments', 'e2e-f3', makeTournament({
      id: 'e2e-f3',
      name: 'Finished Classic Tourney',
      location: 'Old Gym',
      format: 'round-robin',
      status: 'completed',
      shareCode: 'FINISH01',
    }));
  });

  test('default "Upcoming" filter shows only registration/setup tournaments', async ({ page }) => {
    await page.goto('/tournaments');

    // Should see the registration tournament
    await expect(page.getByRole('heading', { name: 'Open Registration Tourney' })).toBeVisible({
      timeout: 15000,
    });

    // Should NOT see pool-play or completed tournaments
    await expect(page.getByRole('heading', { name: 'Pool Play Active Tourney' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Finished Classic Tourney' })).not.toBeVisible();
  });

  test('changing status to "All Statuses" shows all tournaments', async ({ page }) => {
    await page.goto('/tournaments');

    // Wait for initial load
    await expect(page.getByRole('heading', { name: 'Open Registration Tourney' })).toBeVisible({
      timeout: 15000,
    });

    // Change status filter to "All Statuses"
    await page.getByLabel('Filter by status').selectOption('all');

    // All three should now be visible
    await expect(page.getByRole('heading', { name: 'Open Registration Tourney' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pool Play Active Tourney' })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole('heading', { name: 'Finished Classic Tourney' })).toBeVisible();
  });

  test('search by name filters results', async ({ page }) => {
    await page.goto('/tournaments');

    // Switch to all statuses so all are visible first
    await page.getByLabel('Filter by status').selectOption('all');

    await expect(page.getByRole('heading', { name: 'Open Registration Tourney' })).toBeVisible({
      timeout: 15000,
    });

    // Type in the search box
    await page.getByPlaceholder('Search name or location...').fill('Pool Play');

    // Only the matching tournament should be visible
    await expect(page.getByRole('heading', { name: 'Pool Play Active Tourney' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Open Registration Tourney' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Finished Classic Tourney' })).not.toBeVisible();
  });

  test('search by location filters results', async ({ page }) => {
    await page.goto('/tournaments');

    // Switch to all statuses
    await page.getByLabel('Filter by status').selectOption('all');

    await expect(page.getByRole('heading', { name: 'Open Registration Tourney' })).toBeVisible({
      timeout: 15000,
    });

    // Search by location
    await page.getByPlaceholder('Search name or location...').fill('Old Gym');

    // Only the matching tournament should be visible
    await expect(page.getByRole('heading', { name: 'Finished Classic Tourney' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Open Registration Tourney' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pool Play Active Tourney' })).not.toBeVisible();
  });
});

// ── D. Logged-in user sees tab switcher ──────────────────────────────

test.describe('Tab switcher - logged in', () => {
  test.beforeAll(async () => {
    await clearEmulators();
  });

  test('tab switcher is visible with Browse and My Tournaments tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await signInAsTestUser(page, { email: 'tabs-test@test.com' });

    await page.goto('/tournaments');

    // Tab switcher should be visible
    const tablist = page.getByRole('tablist');
    await expect(tablist).toBeVisible({ timeout: 15000 });

    // Both tabs present
    await expect(page.getByRole('tab', { name: 'Browse' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'My Tournaments' })).toBeVisible();
  });

  test('Browse tab is selected by default for new user', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await signInAsTestUser(page, { email: 'tabs-test2@test.com' });

    await page.goto('/tournaments');

    // Browse tab should be selected by default (user has no tournaments)
    await expect(page.getByRole('tab', { name: 'Browse' })).toBeVisible({
      timeout: 15000,
    });

    // Browse tab content should be showing (search input and filters)
    await expect(
      page.getByPlaceholder('Search name or location...'),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel('Filter by status')).toBeVisible();
  });
});

// ── E. Landing page preview ──────────────────────────────────────────

test.describe('Landing page - tournament preview', () => {
  test.beforeAll(async () => {
    await clearEmulators();

    await seedFirestoreDocAdmin('tournaments', 'e2e-landing', makeTournament({
      id: 'e2e-landing',
      name: 'Weekend Showdown',
      location: 'Lakeside Courts',
      format: 'round-robin',
      status: 'registration',
      shareCode: 'WKNDSHW1',
    }));
  });

  test('landing page shows upcoming tournaments section', async ({ page }) => {
    await page.goto('/');

    // "Upcoming Tournaments" heading
    await expect(page.getByText('Upcoming Tournaments')).toBeVisible({
      timeout: 15000,
    });

    // Tournament name visible
    await expect(page.getByText('Weekend Showdown')).toBeVisible();

    // "Browse All Tournaments" link
    await expect(
      page.getByText('Browse All Tournaments'),
    ).toBeVisible();
  });
});
