import { test, expect } from '@playwright/test';
import { signInAsTestUser, seedFirestoreDocAdmin } from '../helpers/emulator-auth';
import { makeTournament } from '../helpers/factories';
import { TournamentBrowsePage } from '../pages/TournamentBrowsePage';
import { randomUUID } from 'crypto';

// Run all tests in this file serially so they share the same emulator state
test.describe.configure({ mode: 'serial' });

// ── A. Browse tab (logged out, no data) ──────────────────────────────

test.describe('Browse tab - logged out', () => {
  test('shows page title, search input, and filter dropdowns', async ({ page }) => {
    const browse = new TournamentBrowsePage(page);
    await browse.goto();
    await browse.expectPageLoaded();

    // Status filter defaults to "Upcoming"
    await browse.expectStatusFilter('upcoming');

    // Format filter
    await expect(page.getByLabel('Filter by format')).toBeVisible();
  });

  test('tab switcher is NOT visible when logged out', async ({ page }) => {
    const browse = new TournamentBrowsePage(page);
    await browse.goto();

    // Wait for the page to render by checking a known element
    await expect(page.getByLabel('Filter by status')).toBeVisible({
      timeout: 15000,
    });

    await browse.expectNoTabSwitcher();
  });

  test('shows empty state when no public tournaments exist', async ({ page }) => {
    const browse = new TournamentBrowsePage(page);
    await browse.goto();
    await browse.expectEmpty({ timeout: 15000 });
  });
});

// ── B. Browse tab with seeded data ───────────────────────────────────

test.describe('Browse tab - seeded tournaments', () => {
  test.beforeAll(async () => {
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
    const browse = new TournamentBrowsePage(page);
    await browse.goto();

    // Wait for cards to appear
    await browse.expectTournament('Spring Championship', { timeout: 15000 });
    await browse.expectTournament('Summer Slam');
    await browse.expectTournament('Winter Classic');

    // Check locations shown (inside <p> elements, not dropdown options)
    await expect(page.getByText('Central Park Courts')).toBeVisible();
    await expect(page.getByText('Beach Arena')).toBeVisible();

    // Check format badges (scoped to card links, not dropdown options)
    await browse.expectCardWithText('Round Robin');
    await browse.expectCardWithText('Single Elimination');

    // Check status badges
    await browse.expectCardWithText('Registration Open');
  });

  test('cards link to /t/:shareCode', async ({ page }) => {
    const browse = new TournamentBrowsePage(page);
    await browse.goto();

    await browse.expectTournament('Spring Championship', { timeout: 15000 });

    // Check that the card has a link to /t/SPRING01
    await browse.expectCardLink('SPRING01');
  });
});

// ── C. Browse tab filter behavior ────────────────────────────────────

test.describe('Browse tab - filter behavior', () => {
  test.beforeAll(async () => {
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
    const browse = new TournamentBrowsePage(page);
    await browse.goto();

    // Should see the registration tournament
    await browse.expectTournament('Open Registration Tourney', { timeout: 15000 });

    // Should NOT see pool-play or completed tournaments
    await browse.expectNoTournament('Pool Play Active Tourney');
    await browse.expectNoTournament('Finished Classic Tourney');
  });

  test('changing status to "All Statuses" shows all tournaments', async ({ page }) => {
    const browse = new TournamentBrowsePage(page);
    await browse.goto();

    // Wait for initial load
    await browse.expectTournament('Open Registration Tourney', { timeout: 15000 });

    // Change status filter to "All Statuses"
    await browse.filterByStatus('all');

    // All three should now be visible
    await browse.expectTournament('Open Registration Tourney');
    await browse.expectTournament('Pool Play Active Tourney', { timeout: 5000 });
    await browse.expectTournament('Finished Classic Tourney');
  });

  test('search by name filters results', async ({ page }) => {
    const browse = new TournamentBrowsePage(page);
    await browse.goto();

    // Switch to all statuses so all are visible first
    await browse.filterByStatus('all');

    await browse.expectTournament('Open Registration Tourney', { timeout: 15000 });

    // Type in the search box
    await browse.search('Pool Play');

    // Only the matching tournament should be visible
    await browse.expectTournament('Pool Play Active Tourney');
    await browse.expectNoTournament('Open Registration Tourney');
    await browse.expectNoTournament('Finished Classic Tourney');
  });

  test('search by location filters results', async ({ page }) => {
    const browse = new TournamentBrowsePage(page);
    await browse.goto();

    // Switch to all statuses
    await browse.filterByStatus('all');

    await browse.expectTournament('Open Registration Tourney', { timeout: 15000 });

    // Search by location
    await browse.search('Old Gym');

    // Only the matching tournament should be visible
    await browse.expectTournament('Finished Classic Tourney');
    await browse.expectNoTournament('Open Registration Tourney');
    await browse.expectNoTournament('Pool Play Active Tourney');
  });
});

// ── D. Logged-in user sees tab switcher ──────────────────────────────

test.describe('Tab switcher - logged in', () => {
  test('tab switcher is visible with Browse and My Tournaments tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await signInAsTestUser(page, { email: `tabs-${randomUUID().slice(0, 8)}@test.com` });

    const browse = new TournamentBrowsePage(page);
    await browse.goto();

    // Tab switcher should be visible with both tabs
    await browse.expectTabSwitcher();
  });

  test('Browse tab is selected by default for new user', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await signInAsTestUser(page, { email: `tabs-${randomUUID().slice(0, 8)}@test.com` });

    const browse = new TournamentBrowsePage(page);
    await browse.goto();

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
