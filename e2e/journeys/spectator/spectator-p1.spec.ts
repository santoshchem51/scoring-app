import { test, expect } from '@playwright/test';
import { seedSpectatorMatch } from '../../helpers/seeders';
import { seedDoc } from './spectator-helpers';
import {
  makeTournament,
  makePublicMatch,
  makeSpectatorProjection,
  makeTeam,
  makePool,
  uid,
  shareCode,
} from '../../helpers/factories';
import { captureScreen } from '../../helpers/screenshots';

// --- Tests ---

test.describe('@p1 Spectator: P1 Features', () => {
  test('match card click navigates to match detail', async ({ page }, testInfo) => {
    const code = shareCode();
    const tournamentId = uid('tournament');
    const matchId = uid('match');

    const tournament = makeTournament({
      id: tournamentId,
      shareCode: code,
      name: 'Card Nav Test',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${tournamentId}`, tournament);

    // Seed a live match (hub queries matches with status=in-progress, tournamentId, visibility=public)
    const match = makePublicMatch('org-test', {
      id: matchId,
      tournamentId,
      team1Name: 'Navigators',
      team2Name: 'Explorers',
      status: 'in-progress',
    });
    await seedDoc(`matches/${matchId}`, match);

    // Seed spectator projection
    const projection = makeSpectatorProjection({
      publicTeam1Name: 'Navigators',
      publicTeam2Name: 'Explorers',
      team1Score: 3,
      team2Score: 1,
      gameNumber: 1,
      status: 'in-progress',
      visibility: 'public',
      tournamentId,
      tournamentShareCode: code,
    });
    await seedDoc(`matches/${matchId}/public/spectator`, projection);

    await page.goto(`/t/${code}`);
    await expect(page.getByText('Card Nav Test')).toBeVisible({ timeout: 10_000 });

    // Click the match card link
    const matchLink = page.locator(`a[href="/t/${code}/match/${matchId}"]`);
    await expect(matchLink).toBeVisible({ timeout: 10_000 });
    await matchLink.click();

    // Assert URL changed to match detail
    await expect(page).toHaveURL(new RegExp(`/t/${code}/match/${matchId}`));

    await captureScreen(page, testInfo, 'match-card-navigated');
  });

  test('UP NEXT section shows upcoming matches from pool schedule', async ({ page }, testInfo) => {
    // Upcoming matches come from pool schedule entries where matchId is null.
    // The hub resolves team names from team docs, not from match docs.
    const code = shareCode();
    const tournamentId = uid('tournament');

    const tournament = makeTournament({
      id: tournamentId,
      shareCode: code,
      name: 'Upcoming Schedule Test',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${tournamentId}`, tournament);

    // Seed teams
    const team1 = makeTeam({ tournamentId, name: 'Future Stars', poolId: 'pool-a' });
    const team2 = makeTeam({ tournamentId, name: 'Rising Tide', poolId: 'pool-a' });
    await seedDoc(`tournaments/${tournamentId}/teams/${team1.id}`, team1);
    await seedDoc(`tournaments/${tournamentId}/teams/${team2.id}`, team2);

    // Seed pool with unstarted schedule entries (matchId = null → upcoming)
    const pool = makePool({
      id: 'pool-a',
      tournamentId,
      name: 'Pool A',
      teamIds: [team1.id, team2.id],
      schedule: [
        { team1Id: team1.id, team2Id: team2.id, matchId: null, round: 1, court: null },
      ],
      standings: [
        { teamId: team1.id, wins: 0, losses: 0, pointDiff: 0 },
        { teamId: team2.id, wins: 0, losses: 0, pointDiff: 0 },
      ],
    });
    await seedDoc(`tournaments/${tournamentId}/pools/${pool.id}`, pool);

    await page.goto(`/t/${code}`);
    await expect(page.getByText('Upcoming Schedule Test')).toBeVisible({ timeout: 10_000 });

    // Verify UP NEXT heading visible (shown when no live matches but upcoming exist)
    await expect(page.getByText('UP NEXT')).toBeVisible({ timeout: 10_000 });

    // Team names should be visible on the upcoming match card (use .first() — names also appear in pool table)
    await expect(page.getByText('Future Stars').first()).toBeVisible();
    await expect(page.getByText('Rising Tide').first()).toBeVisible();

    await captureScreen(page, testInfo, 'hub-upcoming-matches');
  });

  test('FINAL badge on completed match detail', async ({ page }, testInfo) => {
    const code = shareCode();
    const tournamentId = uid('tournament');
    const matchId = uid('match');

    const tournament = makeTournament({
      id: tournamentId,
      shareCode: code,
      name: 'Final Badge Test',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${tournamentId}`, tournament);

    // Seed a completed match
    const match = makePublicMatch('org-test', {
      id: matchId,
      tournamentId,
      team1Name: 'Winners FC',
      team2Name: 'Runners Up',
      team1Score: 11,
      team2Score: 5,
      status: 'completed',
    });
    await seedDoc(`matches/${matchId}`, match);

    const projection = makeSpectatorProjection({
      publicTeam1Name: 'Winners FC',
      publicTeam2Name: 'Runners Up',
      team1Score: 11,
      team2Score: 5,
      gameNumber: 1,
      status: 'completed',
      visibility: 'public',
      tournamentId,
      tournamentShareCode: code,
    });
    await seedDoc(`matches/${matchId}/public/spectator`, projection);

    await page.goto(`/t/${code}/match/${matchId}`);

    // Wait for page to load
    await expect(page.getByText('Winners FC')).toBeVisible({ timeout: 10_000 });

    // Assert FINAL text visible (use exact: true to avoid matching tournament name substring)
    await expect(page.getByText('FINAL', { exact: true })).toBeVisible();

    await captureScreen(page, testInfo, 'match-detail-final-badge');
  });

  test('tournament name in match detail nav', async ({ page }, testInfo) => {
    const seed = await seedSpectatorMatch('org-test', {
      team1Name: 'Nav Team A',
      team2Name: 'Nav Team B',
      team1Score: 3,
      team2Score: 2,
    });

    await page.goto(`/t/${seed.shareCode}/match/${seed.matchId}`);

    // Wait for page to load
    await expect(page.getByText('Nav Team A').first()).toBeVisible({ timeout: 10_000 });

    // Tournament name should be visible in the nav area (rendered as "· Tournament XXXX" in a muted span)
    const tournamentNameSpan = page.locator('nav span.text-on-surface-muted');
    await expect(tournamentNameSpan).toBeVisible();
    await expect(tournamentNameSpan).toContainText('Tournament');

    // Back to Tournament link should be visible
    const backLink = page.getByRole('link', { name: /back to tournament/i });
    await expect(backLink).toBeVisible();

    await captureScreen(page, testInfo, 'match-detail-nav');
  });

  test('match-tournament mismatch shows error', async ({ page }, testInfo) => {
    // Seed tournament A
    const codeA = shareCode();
    const tournamentAId = uid('tournament');
    const tournamentA = makeTournament({
      id: tournamentAId,
      shareCode: codeA,
      name: 'Tournament A',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${tournamentAId}`, tournamentA);

    // Seed a match that belongs to a DIFFERENT tournament
    const differentTournamentId = uid('tournament');
    const matchId = uid('match');
    const match = makePublicMatch('org-test', {
      id: matchId,
      tournamentId: differentTournamentId,
      team1Name: 'Mismatch A',
      team2Name: 'Mismatch B',
      status: 'in-progress',
    });
    await seedDoc(`matches/${matchId}`, match);

    const projection = makeSpectatorProjection({
      publicTeam1Name: 'Mismatch A',
      publicTeam2Name: 'Mismatch B',
      team1Score: 0,
      team2Score: 0,
      gameNumber: 1,
      status: 'in-progress',
      visibility: 'public',
      tournamentId: differentTournamentId,
      tournamentShareCode: 'OTHER',
    });
    await seedDoc(`matches/${matchId}/public/spectator`, projection);

    // Navigate to tournament A's hub but with a match from another tournament
    await page.goto(`/t/${codeA}/match/${matchId}`);

    // Assert error text visible (wait for it directly, no networkidle — Firestore keeps connections open)
    await expect(
      page.getByText('Match not found in this tournament'),
    ).toBeVisible({ timeout: 15_000 });

    await captureScreen(page, testInfo, 'match-tournament-mismatch');
  });

  test('score announcer aria-live region exists', async ({ page }, testInfo) => {
    const seed = await seedSpectatorMatch('org-test', {
      team1Name: 'A11y Team A',
      team2Name: 'A11y Team B',
      team1Score: 5,
      team2Score: 3,
      withEvents: true,
    });

    await page.goto(`/t/${seed.shareCode}/match/${seed.matchId}`);

    // Wait for scoreboard to load (use .first() since name appears in scoreboard + play-by-play)
    await expect(page.getByText('A11y Team A').first()).toBeVisible({ timeout: 10_000 });

    // Assert aria-live polite region exists on the page
    const ariaLiveRegion = page.locator('[aria-live="polite"]');
    await expect(ariaLiveRegion.first()).toBeAttached();

    await captureScreen(page, testInfo, 'aria-live-region');
  });

  test('long team names do not break layout', async ({ page }, testInfo) => {
    const longName1 = 'The Incredibly Long Named Pickleball Team Of Champions United';
    const longName2 = 'Another Extraordinarily Lengthy Team Name For Testing Purposes';

    const seed = await seedSpectatorMatch('org-test', {
      team1Name: longName1,
      team2Name: longName2,
      team1Score: 4,
      team2Score: 6,
    });

    await page.goto(`/t/${seed.shareCode}/match/${seed.matchId}`);

    // Team names should be visible (rendered, not hidden). Use .first() for potential duplicates.
    await expect(page.getByText(longName1).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(longName2).first()).toBeVisible();

    // No horizontal overflow on the page
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    await captureScreen(page, testInfo, 'long-team-names');
  });

  test('scoreboard renders fully on match detail', async ({ page }, testInfo) => {
    // Instead of trying to catch a loading skeleton (too fast),
    // verify the scoreboard renders completely with all expected elements
    const seed = await seedSpectatorMatch('org-test', {
      team1Name: 'Render Team A',
      team2Name: 'Render Team B',
      team1Score: 8,
      team2Score: 6,
    });

    await page.goto(`/t/${seed.shareCode}/match/${seed.matchId}`);

    // Scoreboard region should be visible
    const scoreboard = page.getByRole('region', { name: /scoreboard/i });
    await expect(scoreboard).toBeVisible({ timeout: 10_000 });

    // Team names in scoreboard
    await expect(scoreboard.getByText('Render Team A')).toBeVisible();
    await expect(scoreboard.getByText('Render Team B')).toBeVisible();

    // Scores visible in scoreboard
    await expect(scoreboard.getByText('8')).toBeVisible();
    await expect(scoreboard.getByText('6')).toBeVisible();

    await captureScreen(page, testInfo, 'scoreboard-fully-rendered');
  });

  test('hub live match card shows team names and LIVE badge', async ({ page }, testInfo) => {
    // Hub shows match cards for in-progress matches queried from Firestore.
    // Completed matches only appear as "retained" when they transition during the session,
    // so we test a live match card with the LIVE badge instead.
    const code = shareCode();
    const tournamentId = uid('tournament');
    const matchId = uid('match');

    const tournament = makeTournament({
      id: tournamentId,
      shareCode: code,
      name: 'Hub Live Card',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${tournamentId}`, tournament);

    // Seed an in-progress match
    const match = makePublicMatch('org-test', {
      id: matchId,
      tournamentId,
      team1Name: 'Hub Stars',
      team2Name: 'Hub Rockets',
      status: 'in-progress',
    });
    await seedDoc(`matches/${matchId}`, match);

    const projection = makeSpectatorProjection({
      publicTeam1Name: 'Hub Stars',
      publicTeam2Name: 'Hub Rockets',
      team1Score: 6,
      team2Score: 4,
      gameNumber: 1,
      status: 'in-progress',
      visibility: 'public',
      tournamentId,
      tournamentShareCode: code,
    });
    await seedDoc(`matches/${matchId}/public/spectator`, projection);

    await page.goto(`/t/${code}`);
    await expect(page.getByText('Hub Live Card')).toBeVisible({ timeout: 10_000 });

    // Match card should render with team names
    await expect(page.getByText('Hub Stars')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Hub Rockets')).toBeVisible();

    // LIVE badge should be visible on the card
    await expect(page.getByText('LIVE', { exact: true })).toBeVisible();

    // LIVE NOW heading should be visible
    await expect(page.getByText('LIVE NOW')).toBeVisible();

    await captureScreen(page, testInfo, 'hub-live-match-card');
  });

  test('hub with no live matches shows pool standings, no LIVE NOW', async ({
    page,
  }, testInfo) => {
    const code = shareCode();
    const tournamentId = uid('tournament');

    const tournament = makeTournament({
      id: tournamentId,
      shareCode: code,
      name: 'No Live Matches',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${tournamentId}`, tournament);

    // Seed teams and pool standings, but NO matches at all
    const team1 = makeTeam({ tournamentId, name: 'Still Waters', poolId: 'pool-a' });
    const team2 = makeTeam({ tournamentId, name: 'Calm Currents', poolId: 'pool-a' });
    await seedDoc(`tournaments/${tournamentId}/teams/${team1.id}`, team1);
    await seedDoc(`tournaments/${tournamentId}/teams/${team2.id}`, team2);

    const pool = makePool({
      id: 'pool-a',
      tournamentId,
      name: 'Pool A',
      teamIds: [team1.id, team2.id],
      standings: [
        { teamId: team1.id, wins: 1, losses: 0, pointDiff: 5 },
        { teamId: team2.id, wins: 0, losses: 1, pointDiff: -5 },
      ],
    });
    await seedDoc(`tournaments/${tournamentId}/pools/${pool.id}`, pool);

    await page.goto(`/t/${code}`);
    await expect(page.getByText('No Live Matches')).toBeVisible({ timeout: 10_000 });

    // Pool standings should be visible (positive assertion first)
    await expect(page.getByText('Pool Standings')).toBeVisible();

    // LIVE NOW should NOT be visible
    await expect(page.getByText('LIVE NOW')).not.toBeVisible();

    await captureScreen(page, testInfo, 'hub-no-live-matches');
  });
});
