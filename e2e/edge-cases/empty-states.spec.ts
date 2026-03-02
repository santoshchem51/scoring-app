import { test, expect } from '../fixtures';
import { PlayersPage } from '../pages/PlayersPage';
import { TournamentBrowsePage } from '../pages/TournamentBrowsePage';
import { BuddiesPage } from '../pages/BuddiesPage';

test.describe('Empty States (Manual Plan 10.2)', () => {
  test('history page shows empty state when no matches recorded', async ({
    page,
  }) => {
    await page.goto('/history');

    await expect(page.getByText('No Matches Yet')).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByText(
        'Start your first game and your match history will appear here.',
      ),
    ).toBeVisible();
  });

  test('players page shows empty state when no players added', async ({
    page,
  }) => {
    const players = new PlayersPage(page);
    await players.goto();

    await players.expectEmpty({ timeout: 10000 });
  });

  test('tournaments browse page shows empty state when no tournaments', async ({
    page,
  }) => {
    const browse = new TournamentBrowsePage(page);
    await browse.goto();

    await browse.expectEmpty({ timeout: 10000 });
  });

  test('buddies page shows empty state when no groups (authenticated)', async ({
    authenticatedPage,
  }) => {
    const buddies = new BuddiesPage(authenticatedPage);
    await buddies.goto();

    await expect(
      authenticatedPage.getByRole('heading', { name: 'Buddies' }),
    ).toBeVisible({ timeout: 10000 });
    await buddies.expectEmpty();
  });
});
