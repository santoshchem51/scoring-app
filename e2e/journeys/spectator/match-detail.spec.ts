import { test, expect } from '@playwright/test';
import { seedSpectatorMatch } from '../../helpers/seeders';

// --- Tests ---

test.describe('@p0 Spectator Match Detail', () => {
  test('scoreboard shows team names and scores', async ({ page }) => {
    const seed = await seedSpectatorMatch('org-test', {
      team1Name: 'Smashers',
      team2Name: 'Dinkers',
      team1Score: 7,
      team2Score: 4,
    });

    await page.goto(`/t/${seed.shareCode}/match/${seed.matchId}`);

    // Verify team names visible on scoreboard
    await expect(page.getByText('Smashers')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Dinkers')).toBeVisible();

    // Verify scores are visible within the scoreboard region
    const scoreboard = page.getByRole('region', { name: /scoreboard/i });
    await expect(scoreboard.getByText('7')).toBeVisible({ timeout: 10_000 });
    await expect(scoreboard.getByText('4')).toBeVisible();
  });

  test('play-by-play events render with score text', async ({ page }) => {
    const seed = await seedSpectatorMatch('org-test', {
      team1Name: 'Aces',
      team2Name: 'Volleys',
      team1Score: 3,
      team2Score: 2,
      withEvents: true,
    });

    await page.goto(`/t/${seed.shareCode}/match/${seed.matchId}`);

    // Wait for match detail page to load, then check for play-by-play content
    await expect(page.getByText('Aces').first()).toBeVisible({ timeout: 10_000 });

    // If tabs exist, click play-by-play; otherwise the events may render directly
    const playByPlayTab = page.getByRole('tab', { name: /play-by-play/i });
    if (await playByPlayTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await playByPlayTab.click();
    }

    // At least one event entry should be visible with score text
    // Score events display as "{team1Score} - {team2Score}" or similar
    await expect(page.getByText('1-0')).toBeVisible({ timeout: 10_000 });
  });
});
