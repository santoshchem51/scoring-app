import { test, expect } from '../../fixtures';
import { seedFirestoreDocAdmin } from '../../helpers/emulator-auth';
import { makeTournament, makeTeam, makePool } from '../../helpers/factories';
import { captureScreen } from '../../helpers/screenshots';
import { randomUUID } from 'crypto';

test.describe('Player: Tournament View Journeys', () => {

  // ═══════════════════════════════════════════════════════════════════
  // PL-4 — View tournament via share code
  // ═══════════════════════════════════════════════════════════════════

  test('PL-4: view tournament via share code shows details', async ({ page }) => {
    const code = `PL4${randomUUID().slice(0, 5).toUpperCase()}`;
    const tournament = makeTournament({
      shareCode: code,
      name: 'Spring Open 2026',
      location: 'Riverside Courts',
      format: 'round-robin',
      status: 'registration',
    });
    await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

    // Navigate via share code URL
    await page.goto(`/t/${code}`);

    // Verify tournament details are visible
    await expect(page.getByText('Spring Open 2026')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Riverside Courts')).toBeVisible();
    await expect(page.getByText(/round.?robin/i)).toBeVisible();
    await expect(page.getByText('Registration Open')).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // PL-10 — Pool standings display (all columns)
  // ═══════════════════════════════════════════════════════════════════

  test('PL-10: pool standings table shows all columns', async ({ authenticatedPage: page }, testInfo) => {
    const tournament = makeTournament({
      name: 'Pool Play Classic',
      format: 'round-robin',
      status: 'pool-play',
      config: {
        poolCount: 1,
        poolSize: 4,
        advanceCount: 2,
        consolation: false,
        thirdPlace: false,
      },
    });
    await seedFirestoreDocAdmin('tournaments', tournament.id, tournament);

    // Seed 4 teams
    const teamNames = ['Aces', 'Blazers', 'Crushers', 'Dynamos'];
    const teams = teamNames.map((name, i) =>
      makeTeam({
        tournamentId: tournament.id,
        name,
        seed: i + 1,
      }),
    );
    for (const team of teams) {
      await seedFirestoreDocAdmin(
        `tournaments/${tournament.id}/teams`,
        team.id,
        team,
      );
    }

    // Seed a pool with standings (pre-computed from scored matches)
    const pool = makePool({
      tournamentId: tournament.id,
      name: 'Pool A',
      teamIds: teams.map(t => t.id),
      standings: [
        { teamId: teams[0].id, teamName: 'Aces',     wins: 3, losses: 0, pointsFor: 33, pointsAgainst: 18, pointDiff: 15 },
        { teamId: teams[1].id, teamName: 'Blazers',  wins: 2, losses: 1, pointsFor: 30, pointsAgainst: 25, pointDiff: 5 },
        { teamId: teams[2].id, teamName: 'Crushers', wins: 1, losses: 2, pointsFor: 22, pointsAgainst: 28, pointDiff: -6 },
        { teamId: teams[3].id, teamName: 'Dynamos',  wins: 0, losses: 3, pointsFor: 15, pointsAgainst: 33, pointDiff: -18 },
      ],
    });
    await seedFirestoreDocAdmin(
      `tournaments/${tournament.id}/pools`,
      pool.id,
      pool,
    );

    // Navigate to tournament dashboard
    await page.goto(`/tournaments/${tournament.id}`);

    // Wait for the page to load
    await expect(page.getByText('Pool Play Classic')).toBeVisible({ timeout: 15000 });

    // Verify pool standings table has the expected column headers
    // The table should show: team name, W, L, PF, PA, Diff (or similar)
    await expect(page.getByText('Pool A')).toBeVisible({ timeout: 10000 });

    // Verify team names appear in standings
    await expect(page.getByText('Aces')).toBeVisible();
    await expect(page.getByText('Blazers')).toBeVisible();
    await expect(page.getByText('Crushers')).toBeVisible();
    await expect(page.getByText('Dynamos')).toBeVisible();

    // Verify column headers (W, L, PF, PA, Diff)
    const standingsSection = page.locator('table, [role="table"], [data-testid="pool-standings"]').first();
    await expect(standingsSection.getByRole('columnheader', { name: 'W' })).toBeVisible();
    await expect(standingsSection.getByRole('columnheader', { name: 'L' })).toBeVisible();
    await expect(standingsSection.getByRole('columnheader', { name: 'PF' })).toBeVisible();
    await expect(standingsSection.getByRole('columnheader', { name: 'PA' })).toBeVisible();
    await expect(standingsSection.getByRole('columnheader', { name: '+/-' })).toBeVisible();
    await captureScreen(page, testInfo, 'player-poolstandings-table');
  });
});
