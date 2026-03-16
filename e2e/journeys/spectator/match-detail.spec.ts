import { test, expect } from '@playwright/test';
import {
  makeTournament,
  makePublicMatch,
  makeSpectatorProjection,
  makeScoreEvent,
  uid,
  shareCode as makeShareCode,
} from '../../helpers/factories';
import { seedDoc } from './spectator-helpers';
import { seedFirestoreDocAdmin } from '../../helpers/emulator-auth';

// --- Tests ---

test.describe('@p0 Spectator Match Detail', () => {
  test('scoreboard shows team names and scores', async ({ page }) => {
    const SHARE_CODE = makeShareCode();
    const TOURNAMENT_ID = uid('tourney');
    const MATCH_ID = uid('match');

    // Seed tournament
    const tournament = makeTournament({
      id: TOURNAMENT_ID,
      shareCode: SHARE_CODE,
      name: 'Match Detail Tournament',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${TOURNAMENT_ID}`, tournament);

    // Seed match WITH lastSnapshot so extractLiveScore reads the scores
    // (the component reads scores from match.lastSnapshot, not from the spectator projection)
    const match = makePublicMatch('org-test', {
      id: MATCH_ID,
      tournamentId: TOURNAMENT_ID,
      team1Name: 'Smashers',
      team2Name: 'Dinkers',
      status: 'in-progress',
      lastSnapshot: JSON.stringify({ team1Score: 7, team2Score: 4, gameNumber: 1 }),
    });
    await seedDoc(`matches/${MATCH_ID}`, match);

    // Seed spectator projection (used for team names on the public page)
    const projection = makeSpectatorProjection({
      publicTeam1Name: 'Smashers',
      publicTeam2Name: 'Dinkers',
      team1Score: 7,
      team2Score: 4,
      gameNumber: 1,
      status: 'in-progress',
      visibility: 'public',
      tournamentId: TOURNAMENT_ID,
      tournamentShareCode: SHARE_CODE,
    });
    await seedFirestoreDocAdmin(`matches/${MATCH_ID}/public`, 'spectator', projection);

    await page.goto(`/t/${SHARE_CODE}/match/${MATCH_ID}`);

    // Verify team names visible on scoreboard
    await expect(page.getByText('Smashers')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Dinkers')).toBeVisible();

    // Verify scores are visible within the scoreboard region
    const scoreboard = page.getByRole('region', { name: /scoreboard/i });
    await expect(scoreboard.getByText('7')).toBeVisible({ timeout: 10_000 });
    await expect(scoreboard.getByText('4')).toBeVisible();
  });

  test('play-by-play events render with score text', async ({ page }) => {
    const SHARE_CODE = makeShareCode();
    const TOURNAMENT_ID = uid('tourney');
    const MATCH_ID = uid('match');

    // Seed tournament
    const tournament = makeTournament({
      id: TOURNAMENT_ID,
      shareCode: SHARE_CODE,
      name: 'Play-by-Play Tournament',
      status: 'pool-play',
      visibility: 'public',
      registrationCounts: { confirmed: 4, pending: 0 },
    });
    await seedDoc(`tournaments/${TOURNAMENT_ID}`, tournament);

    // Seed match with lastSnapshot for score display
    const match = makePublicMatch('org-test', {
      id: MATCH_ID,
      tournamentId: TOURNAMENT_ID,
      team1Name: 'Aces',
      team2Name: 'Volleys',
      status: 'in-progress',
      lastSnapshot: JSON.stringify({ team1Score: 3, team2Score: 2, gameNumber: 1 }),
    });
    await seedDoc(`matches/${MATCH_ID}`, match);

    // Seed spectator projection
    const projection = makeSpectatorProjection({
      publicTeam1Name: 'Aces',
      publicTeam2Name: 'Volleys',
      team1Score: 3,
      team2Score: 2,
      gameNumber: 1,
      status: 'in-progress',
      visibility: 'public',
      tournamentId: TOURNAMENT_ID,
      tournamentShareCode: SHARE_CODE,
    });
    await seedFirestoreDocAdmin(`matches/${MATCH_ID}/public`, 'spectator', projection);

    // Seed score events into the correct subcollection: "scoreEvents" (not "events")
    const event1 = makeScoreEvent(MATCH_ID, {
      team: 1,
      team1Score: 1,
      team2Score: 0,
      timestamp: Date.now() - 30000,
      visibility: 'public',
    });
    const event2 = makeScoreEvent(MATCH_ID, {
      team: 2,
      team1Score: 1,
      team2Score: 1,
      timestamp: Date.now() - 20000,
      visibility: 'public',
    });
    const event3 = makeScoreEvent(MATCH_ID, {
      team: 1,
      team1Score: 2,
      team2Score: 1,
      timestamp: Date.now() - 10000,
      visibility: 'public',
    });
    await seedFirestoreDocAdmin(`matches/${MATCH_ID}/scoreEvents`, event1.id, event1);
    await seedFirestoreDocAdmin(`matches/${MATCH_ID}/scoreEvents`, event2.id, event2);
    await seedFirestoreDocAdmin(`matches/${MATCH_ID}/scoreEvents`, event3.id, event3);

    await page.goto(`/t/${SHARE_CODE}/match/${MATCH_ID}`);

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
