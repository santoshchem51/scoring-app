import { test, expect } from '@playwright/test';
import { PlayersPage } from '../pages/PlayersPage';
import { NavigationBar } from '../pages/NavigationBar';

test.describe('Players Management (Manual Plan 3.1)', () => {
  let players: PlayersPage;
  let nav: NavigationBar;

  test.beforeEach(async ({ page }) => {
    players = new PlayersPage(page);
    nav = new NavigationBar(page);
    await page.goto('/new');
    await nav.goToPlayers();
  });

  test('shows empty state when no players', async () => {
    await players.expectEmpty();
  });

  test('adds a new player', async ({ page }) => {
    await players.addPlayer('Alice');

    await players.expectPlayer('Alice');
    await expect(page.getByText('No Players Yet')).not.toBeVisible();
  });

  test('adds multiple players', async () => {
    await players.addPlayer('Alice');
    await players.addPlayer('Bob');

    await players.expectPlayer('Bob');
    await players.expectPlayer('Alice');
  });

  test('deletes a player via confirmation dialog', async () => {
    await players.addPlayer('ToDelete');

    await players.deletePlayer('ToDelete');

    await players.expectPlayerGone('ToDelete', { timeout: 10000 });
  });

  test('clears input after adding player', async () => {
    await players.addPlayer('Alice');

    await players.expectInputCleared();
  });
});
