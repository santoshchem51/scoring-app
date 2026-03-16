import { test, expect } from '@playwright/test';
import { captureScreen } from '../../helpers/screenshots';
import {
  makeTournament,
  makeTeam,
  makePool,
  makeBracketSlot,
} from '../../helpers/factories';
import { seedDoc } from './spectator-helpers';

// --- Tests ---

test.describe('Spectator Hub: Tournament Phase Rendering', () => {
  test('hub in registration status shows tournament name and registration info', async ({
    page,
  }, testInfo) => {
    const shareCode = 'REGT0001';
    const tournament = makeTournament({
      shareCode,
      name: 'Spring Open 2026',
      status: 'registration',
      visibility: 'public',
    });

    await seedDoc(`tournaments/${tournament.id}`, tournament);

    await page.goto(`/t/${shareCode}`);
    await expect(page.getByText('Spring Open 2026')).toBeVisible({ timeout: 10_000 });

    // Registration-related text should be visible
    await expect(page.getByText(/registration/i)).toBeVisible();

    // No pool or bracket sections should be present
    await expect(page.getByText(/pool/i)).not.toBeVisible();
    await expect(page.getByText(/bracket/i)).not.toBeVisible();

    await captureScreen(page, testInfo, 'hub-registration-phase');
  });

  test('hub in pool-play status shows pool standings', async ({ page }, testInfo) => {
    const shareCode = 'POOLT001';
    const tournamentId = 'tourney-pool';
    const tournament = makeTournament({
      id: tournamentId,
      shareCode,
      name: 'Pool Play Classic',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 8, pending: 0 },
    });

    await seedDoc(`tournaments/${tournamentId}`, tournament);

    // Seed teams
    const team1 = makeTeam({ tournamentId, name: 'Eagles', poolId: 'pool-a' });
    const team2 = makeTeam({ tournamentId, name: 'Hawks', poolId: 'pool-a' });
    await seedDoc(`tournaments/${tournamentId}/teams/${team1.id}`, team1);
    await seedDoc(`tournaments/${tournamentId}/teams/${team2.id}`, team2);

    // Seed pool with standings
    const pool = makePool({
      id: 'pool-a',
      tournamentId,
      name: 'Pool A',
      teamIds: [team1.id, team2.id],
      standings: [
        { teamId: team1.id, wins: 2, losses: 0, pointDiff: 10 },
        { teamId: team2.id, wins: 0, losses: 2, pointDiff: -10 },
      ],
    });
    await seedDoc(`tournaments/${tournamentId}/pools/${pool.id}`, pool);

    await page.goto(`/t/${shareCode}`);
    await expect(page.getByText('Pool Play Classic')).toBeVisible({ timeout: 10_000 });

    // Pool standings section should be visible
    await expect(page.getByText(/pool/i)).toBeVisible();

    await captureScreen(page, testInfo, 'hub-pool-play-phase');
  });

  test('hub in bracket status shows bracket section', async ({ page }, testInfo) => {
    const shareCode = 'BRKT0001';
    const tournamentId = 'tourney-bracket';
    const tournament = makeTournament({
      id: tournamentId,
      shareCode,
      name: 'Bracket Bash 2026',
      status: 'bracket',
      visibility: 'public',
      registrationCounts: { confirmed: 8, pending: 0 },
    });

    await seedDoc(`tournaments/${tournamentId}`, tournament);

    // Seed bracket slots
    const slot1 = makeBracketSlot({
      tournamentId,
      round: 1,
      position: 1,
      team1Id: 'team-a',
      team2Id: 'team-b',
    });
    const slot2 = makeBracketSlot({
      tournamentId,
      round: 1,
      position: 2,
      team1Id: 'team-c',
      team2Id: 'team-d',
    });
    await seedDoc(`tournaments/${tournamentId}/bracket/${slot1.id}`, slot1);
    await seedDoc(`tournaments/${tournamentId}/bracket/${slot2.id}`, slot2);

    await page.goto(`/t/${shareCode}`);
    await expect(page.getByText('Bracket Bash 2026')).toBeVisible({ timeout: 10_000 });

    // Bracket section should be visible
    await expect(page.getByText(/bracket/i)).toBeVisible();

    await captureScreen(page, testInfo, 'hub-bracket-phase');
  });

  test('hub in completed status shows completed indicator', async ({ page }, testInfo) => {
    const shareCode = 'DONE0001';
    const tournament = makeTournament({
      shareCode,
      name: 'Championship Finale',
      status: 'completed',
      visibility: 'public',
      registrationCounts: { confirmed: 8, pending: 0 },
    });

    await seedDoc(`tournaments/${tournament.id}`, tournament);

    await page.goto(`/t/${shareCode}`);
    await expect(page.getByText('Championship Finale')).toBeVisible({ timeout: 10_000 });

    // Completed status or results should be visible
    await expect(page.getByText(/complete/i)).toBeVisible();

    await captureScreen(page, testInfo, 'hub-completed-phase');
  });
});
