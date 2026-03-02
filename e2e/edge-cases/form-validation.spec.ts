import { test, expect } from '../fixtures';
import { GameSetupPage } from '../pages/GameSetupPage';

test.describe('Form Validation (Manual Plan 10.3)', () => {
  test('Start Game button is disabled when team names are empty', async ({
    page,
  }) => {
    const setup = new GameSetupPage(page);
    await setup.goto();

    // Clear both team name fields (they default to "Team 1" / "Team 2")
    await page.locator('#team1-name').clear();
    await page.locator('#team2-name').clear();

    // The Start Game button should be disabled when both names are blank
    await expect(
      page.getByRole('button', { name: /start game/i }),
    ).toBeDisabled();

    // Fill only team 1 name — still disabled because team 2 is empty
    await setup.fillTeamName(1, 'Aces');
    await expect(
      page.getByRole('button', { name: /start game/i }),
    ).toBeDisabled();

    // Fill team 2 name — now it should be enabled
    await setup.fillTeamName(2, 'Smashers');
    await expect(
      page.getByRole('button', { name: /start game/i }),
    ).toBeEnabled();
  });

  test('tournament creation shows validation errors when name is empty', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/tournaments/new');
    await expect(page.locator('#t-name')).toBeVisible({ timeout: 15000 });

    // Click Create Tournament without filling required fields
    await page.getByRole('button', { name: 'Create Tournament' }).click();

    // Validation errors should appear for the name field
    await expect(
      page.getByText('Name must be at least 3 characters'),
    ).toBeVisible({ timeout: 5000 });

    // Date is also required — verify its error shows too
    await expect(page.getByText('Date is required')).toBeVisible();
  });

  // Share-code lookups query Firestore, which requires auth in the emulator
  // (security rules gate reads on request.auth != null).

  test('invalid tournament share code shows "Tournament Not Found"', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/t/INVALID999');

    await expect(page.getByText('Tournament Not Found')).toBeVisible({
      timeout: 15000,
    });
  });

  test('invalid session share code shows "Session Not Found"', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/s/INVALID999');

    await expect(page.getByText('Session Not Found')).toBeVisible({
      timeout: 15000,
    });
  });
});
