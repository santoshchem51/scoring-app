import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { pickleballMachine } from '../pickleballMachine.ts';

describe('Full Match Integration', () => {
  it('plays a complete best-of-3 rally scoring match', () => {
    const actor = createActor(pickleballMachine, {
      input: {
        gameType: 'doubles' as const,
        scoringMode: 'rally' as const,
        matchFormat: 'best-of-3' as const,
        pointsToWin: 11,
      },
    });
    actor.start();
    actor.send({ type: 'START_GAME' });

    // Team 1 wins game 1: 11-0
    for (let i = 0; i < 11; i++) actor.send({ type: 'SCORE_POINT', team: 1 });
    expect(actor.getSnapshot().value).toBe('betweenGames');
    expect(actor.getSnapshot().context.gamesWon).toEqual([1, 0]);

    // Start game 2
    actor.send({ type: 'START_NEXT_GAME' });
    expect(actor.getSnapshot().context.team1Score).toBe(0);
    expect(actor.getSnapshot().context.gameNumber).toBe(2);

    // Team 1 wins game 2: 11-0
    for (let i = 0; i < 11; i++) actor.send({ type: 'SCORE_POINT', team: 1 });
    expect(actor.getSnapshot().value).toBe('matchOver');
    expect(actor.getSnapshot().context.gamesWon).toEqual([2, 0]);
    actor.stop();
  });

  it('plays a best-of-3 where team 2 wins after losing game 1', () => {
    const actor = createActor(pickleballMachine, {
      input: {
        gameType: 'singles' as const,
        scoringMode: 'rally' as const,
        matchFormat: 'best-of-3' as const,
        pointsToWin: 11,
      },
    });
    actor.start();
    actor.send({ type: 'START_GAME' });

    // Team 1 wins game 1
    for (let i = 0; i < 11; i++) actor.send({ type: 'SCORE_POINT', team: 1 });
    expect(actor.getSnapshot().value).toBe('betweenGames');
    actor.send({ type: 'START_NEXT_GAME' });

    // Team 2 wins game 2
    for (let i = 0; i < 11; i++) actor.send({ type: 'SCORE_POINT', team: 2 });
    expect(actor.getSnapshot().value).toBe('betweenGames');
    expect(actor.getSnapshot().context.gamesWon).toEqual([1, 1]);
    actor.send({ type: 'START_NEXT_GAME' });

    // Team 2 wins game 3
    for (let i = 0; i < 11; i++) actor.send({ type: 'SCORE_POINT', team: 2 });
    expect(actor.getSnapshot().value).toBe('matchOver');
    expect(actor.getSnapshot().context.gamesWon).toEqual([1, 2]);
    actor.stop();
  });

  it('plays a side-out doubles match with full serve rotation', () => {
    const actor = createActor(pickleballMachine, {
      input: {
        gameType: 'doubles' as const,
        scoringMode: 'sideout' as const,
        matchFormat: 'single' as const,
        pointsToWin: 11,
      },
    });
    actor.start();
    actor.send({ type: 'START_GAME' });

    // First serve: team 1, server 2 (one-serve rule)
    expect(actor.getSnapshot().context.servingTeam).toBe(1);
    expect(actor.getSnapshot().context.serverNumber).toBe(2);

    // Team 1 scores
    actor.send({ type: 'SCORE_POINT', team: 1 });
    expect(actor.getSnapshot().context.team1Score).toBe(1);

    // Side out -> team 2 server 1
    actor.send({ type: 'SIDE_OUT' });
    expect(actor.getSnapshot().context.servingTeam).toBe(2);
    expect(actor.getSnapshot().context.serverNumber).toBe(1);

    // Team 2 scores
    actor.send({ type: 'SCORE_POINT', team: 2 });
    expect(actor.getSnapshot().context.team2Score).toBe(1);

    // Non-serving team cannot score
    actor.send({ type: 'SCORE_POINT', team: 1 });
    expect(actor.getSnapshot().context.team1Score).toBe(1); // unchanged

    // Side out -> team 2 server 2
    actor.send({ type: 'SIDE_OUT' });
    expect(actor.getSnapshot().context.servingTeam).toBe(2);
    expect(actor.getSnapshot().context.serverNumber).toBe(2);

    // Side out -> team 1 server 1
    actor.send({ type: 'SIDE_OUT' });
    expect(actor.getSnapshot().context.servingTeam).toBe(1);
    expect(actor.getSnapshot().context.serverNumber).toBe(1);

    actor.stop();
  });

  it('undo works across multiple actions', () => {
    const actor = createActor(pickleballMachine, {
      input: {
        gameType: 'singles' as const,
        scoringMode: 'rally' as const,
        matchFormat: 'single' as const,
        pointsToWin: 11,
      },
    });
    actor.start();
    actor.send({ type: 'START_GAME' });

    actor.send({ type: 'SCORE_POINT', team: 1 });
    actor.send({ type: 'SCORE_POINT', team: 2 });
    actor.send({ type: 'SCORE_POINT', team: 1 });

    expect(actor.getSnapshot().context.team1Score).toBe(2);
    expect(actor.getSnapshot().context.team2Score).toBe(1);

    actor.send({ type: 'UNDO' });
    expect(actor.getSnapshot().context.team1Score).toBe(1);
    expect(actor.getSnapshot().context.team2Score).toBe(1);

    actor.send({ type: 'UNDO' });
    expect(actor.getSnapshot().context.team1Score).toBe(1);
    expect(actor.getSnapshot().context.team2Score).toBe(0);

    actor.send({ type: 'UNDO' });
    expect(actor.getSnapshot().context.team1Score).toBe(0);
    expect(actor.getSnapshot().context.team2Score).toBe(0);

    actor.stop();
  });

  it('handles win-by-2 in extended deuce', () => {
    const actor = createActor(pickleballMachine, {
      input: {
        gameType: 'singles' as const,
        scoringMode: 'rally' as const,
        matchFormat: 'single' as const,
        pointsToWin: 11,
      },
    });
    actor.start();
    actor.send({ type: 'START_GAME' });

    // Score to 10-10
    for (let i = 0; i < 10; i++) {
      actor.send({ type: 'SCORE_POINT', team: 1 });
      actor.send({ type: 'SCORE_POINT', team: 2 });
    }
    expect(actor.getSnapshot().context.team1Score).toBe(10);
    expect(actor.getSnapshot().context.team2Score).toBe(10);

    // 11-10 does NOT end
    actor.send({ type: 'SCORE_POINT', team: 1 });
    expect(actor.getSnapshot().value).toBe('serving');

    // 11-11
    actor.send({ type: 'SCORE_POINT', team: 2 });
    expect(actor.getSnapshot().value).toBe('serving');

    // 12-11
    actor.send({ type: 'SCORE_POINT', team: 1 });
    expect(actor.getSnapshot().value).toBe('serving');

    // 13-11 — wins by 2!
    actor.send({ type: 'SCORE_POINT', team: 1 });
    expect(actor.getSnapshot().value).toBe('matchOver');
    expect(actor.getSnapshot().context.team1Score).toBe(13);
    expect(actor.getSnapshot().context.team2Score).toBe(11);

    actor.stop();
  });

  it('plays best-of-5 to 5 games', () => {
    const actor = createActor(pickleballMachine, {
      input: {
        gameType: 'doubles' as const,
        scoringMode: 'rally' as const,
        matchFormat: 'best-of-5' as const,
        pointsToWin: 11,
      },
    });
    actor.start();
    actor.send({ type: 'START_GAME' });

    // Play 5 games: T1 wins, T2 wins, T1 wins, T2 wins, T1 wins
    const winners = [1, 2, 1, 2, 1] as const;
    for (let g = 0; g < 5; g++) {
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: winners[g] });
      }
      if (g < 4) {
        expect(actor.getSnapshot().value).toBe('betweenGames');
        actor.send({ type: 'START_NEXT_GAME' });
      }
    }

    expect(actor.getSnapshot().value).toBe('matchOver');
    expect(actor.getSnapshot().context.gamesWon).toEqual([3, 2]);
    actor.stop();
  });
});
