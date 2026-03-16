import { test, expect } from '@playwright/test';
import {
  makeTournament,
  makePublicMatch,
  makeSpectatorProjection,
} from '../../helpers/factories';
import { seedDoc } from './spectator-helpers';

// --- Tests ---

test.describe('Spectator: Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('hub renders on 375px without horizontal overflow', async ({ page }) => {
    const shareCode = 'MOB10001';
    const tournament = makeTournament({
      shareCode,
      name: 'Mobile Hub Test',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${tournament.id}`, tournament);

    await page.goto(`/t/${shareCode}`);
    await expect(page.getByText('Mobile Hub Test')).toBeVisible({ timeout: 10_000 });

    // Check no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('match detail fits 375px viewport', async ({ page }) => {
    const shareCode = 'MOB20001';
    const tournamentId = 'tourney-mobile';
    const matchId = 'mobile-match-1';

    const tournament = makeTournament({
      id: tournamentId,
      shareCode,
      name: 'Mobile Match Test',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${tournamentId}`, tournament);

    // Seed match
    const match = makePublicMatch('org-mobile', {
      id: matchId,
      tournamentId,
      team1Name: 'Team Mobile A',
      team2Name: 'Team Mobile B',
      status: 'in-progress',
    });
    await seedDoc(`matches/${matchId}`, match);

    // Seed spectator projection
    const projection = makeSpectatorProjection({
      publicTeam1Name: 'Team Mobile A',
      publicTeam2Name: 'Team Mobile B',
      team1Score: 5,
      team2Score: 3,
      gameNumber: 1,
      status: 'in-progress',
      visibility: 'public',
      tournamentId,
      tournamentShareCode: shareCode,
    });
    await seedDoc(`matches/${matchId}/public/spectator`, projection);

    await page.goto(`/t/${shareCode}/match/${matchId}`);

    // Verify scoreboard visible
    await expect(page.getByText('Team Mobile A')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Team Mobile B')).toBeVisible();

    // Check no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
