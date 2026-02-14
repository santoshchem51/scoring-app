import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { pickleballMachine } from '../pickleballMachine.ts';

function createTestActor(overrides: {
  gameType?: 'singles' | 'doubles';
  scoringMode?: 'sideout' | 'rally';
  matchFormat?: 'single' | 'best-of-3' | 'best-of-5';
  pointsToWin?: number;
} = {}) {
  const actor = createActor(pickleballMachine, {
    input: {
      gameType: overrides.gameType ?? 'doubles',
      scoringMode: overrides.scoringMode ?? 'sideout',
      matchFormat: overrides.matchFormat ?? 'single',
      pointsToWin: overrides.pointsToWin ?? 11,
    },
  });
  actor.start();
  return actor;
}

describe('Pickleball Scoring Machine', () => {
  // ------------------------------------------------------------------
  // Basic state transitions
  // ------------------------------------------------------------------
  describe('pregame -> serving', () => {
    it('starts in pregame state', () => {
      const actor = createTestActor();
      expect(actor.getSnapshot().value).toBe('pregame');
    });

    it('transitions to serving on START_GAME', () => {
      const actor = createTestActor();
      actor.send({ type: 'START_GAME' });
      expect(actor.getSnapshot().value).toBe('serving');
    });
  });

  // ------------------------------------------------------------------
  // Rally scoring
  // ------------------------------------------------------------------
  describe('rally scoring', () => {
    it('either team can score', () => {
      const actor = createTestActor({ scoringMode: 'rally' });
      actor.send({ type: 'START_GAME' });

      // Team 1 (serving) scores
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().context.team1Score).toBe(1);

      // Team 2 (non-serving) also scores
      actor.send({ type: 'SCORE_POINT', team: 2 });
      expect(actor.getSnapshot().context.team2Score).toBe(1);
    });

    it('serve switches when non-serving team scores', () => {
      const actor = createTestActor({ scoringMode: 'rally', gameType: 'doubles' });
      actor.send({ type: 'START_GAME' });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);

      // Non-serving team (team 2) scores -> serve switches to team 2
      actor.send({ type: 'SCORE_POINT', team: 2 });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);

      // Now team 1 is non-serving, scores -> serve switches back to team 1
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);
    });

    it('serve stays with serving team when they score', () => {
      const actor = createTestActor({ scoringMode: 'rally', gameType: 'doubles' });
      actor.send({ type: 'START_GAME' });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);

      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);
      expect(actor.getSnapshot().context.team1Score).toBe(1);
    });
  });

  // ------------------------------------------------------------------
  // Side-out scoring
  // ------------------------------------------------------------------
  describe('side-out scoring', () => {
    it('only serving team can score', () => {
      const actor = createTestActor({ scoringMode: 'sideout' });
      actor.send({ type: 'START_GAME' });

      // Team 1 is serving, team 1 scores
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().context.team1Score).toBe(1);
    });

    it('non-serving team score attempt is ignored (guard blocks it)', () => {
      const actor = createTestActor({ scoringMode: 'sideout' });
      actor.send({ type: 'START_GAME' });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);

      // Team 2 tries to score but team 1 is serving -> should be ignored
      actor.send({ type: 'SCORE_POINT', team: 2 });
      expect(actor.getSnapshot().context.team2Score).toBe(0);
      expect(actor.getSnapshot().value).toBe('serving');
    });
  });

  // ------------------------------------------------------------------
  // Doubles serve rotation (one-serve rule)
  // ------------------------------------------------------------------
  describe('doubles serve rotation (side-out)', () => {
    it('first serving team starts with server 2 (one-serve rule)', () => {
      const actor = createTestActor({ scoringMode: 'sideout', gameType: 'doubles' });
      expect(actor.getSnapshot().context.serverNumber).toBe(2);
      expect(actor.getSnapshot().context.servingTeam).toBe(1);
    });

    it('SIDE_OUT from server 1 goes to server 2 on same team', () => {
      const actor = createTestActor({ scoringMode: 'sideout', gameType: 'doubles' });
      actor.send({ type: 'START_GAME' });

      // First serve is server 2 on team 1, so first SIDE_OUT goes to team 2 server 1
      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);
      expect(actor.getSnapshot().context.serverNumber).toBe(1);

      // Now server 1 on team 2 -> SIDE_OUT -> server 2 on team 2
      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);
      expect(actor.getSnapshot().context.serverNumber).toBe(2);
    });

    it('SIDE_OUT from server 2 goes to other team server 1', () => {
      const actor = createTestActor({ scoringMode: 'sideout', gameType: 'doubles' });
      actor.send({ type: 'START_GAME' });

      // Start: team 1, server 2
      // SIDE_OUT from server 2 -> other team (team 2), server 1
      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);
      expect(actor.getSnapshot().context.serverNumber).toBe(1);
    });

    it('full rotation cycle works correctly', () => {
      const actor = createTestActor({ scoringMode: 'sideout', gameType: 'doubles' });
      actor.send({ type: 'START_GAME' });

      // Start: team 1, server 2
      expect(actor.getSnapshot().context.servingTeam).toBe(1);
      expect(actor.getSnapshot().context.serverNumber).toBe(2);

      // SIDE_OUT 1: team 1 server 2 -> team 2 server 1
      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);
      expect(actor.getSnapshot().context.serverNumber).toBe(1);

      // SIDE_OUT 2: team 2 server 1 -> team 2 server 2
      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);
      expect(actor.getSnapshot().context.serverNumber).toBe(2);

      // SIDE_OUT 3: team 2 server 2 -> team 1 server 1
      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);
      expect(actor.getSnapshot().context.serverNumber).toBe(1);

      // SIDE_OUT 4: team 1 server 1 -> team 1 server 2
      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);
      expect(actor.getSnapshot().context.serverNumber).toBe(2);
    });
  });

  // ------------------------------------------------------------------
  // Win-by-2 rule
  // ------------------------------------------------------------------
  describe('win-by-2', () => {
    it('game does not end at 11-10', () => {
      const actor = createTestActor({ scoringMode: 'rally', pointsToWin: 11 });
      actor.send({ type: 'START_GAME' });

      // Get team 1 to 10, team 2 to 10
      for (let i = 0; i < 10; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }
      for (let i = 0; i < 10; i++) {
        actor.send({ type: 'SCORE_POINT', team: 2 });
      }
      expect(actor.getSnapshot().context.team1Score).toBe(10);
      expect(actor.getSnapshot().context.team2Score).toBe(10);

      // Team 1 scores to 11-10 -> should NOT win
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().context.team1Score).toBe(11);
      expect(actor.getSnapshot().value).toBe('serving');
    });

    it('game ends when team has pointsToWin AND 2-point lead', () => {
      const actor = createTestActor({
        scoringMode: 'rally',
        pointsToWin: 11,
        matchFormat: 'single',
      });
      actor.send({ type: 'START_GAME' });

      // Score to 10-10
      for (let i = 0; i < 10; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }
      for (let i = 0; i < 10; i++) {
        actor.send({ type: 'SCORE_POINT', team: 2 });
      }

      // 11-10 -> not over
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().value).toBe('serving');

      // 11-11 (tied again)
      actor.send({ type: 'SCORE_POINT', team: 2 });
      expect(actor.getSnapshot().value).toBe('serving');

      // 12-11 -> still not over
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().value).toBe('serving');

      // 12-12
      actor.send({ type: 'SCORE_POINT', team: 2 });
      expect(actor.getSnapshot().value).toBe('serving');

      // 13-12
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().value).toBe('serving');

      // 14-12 -> 2-point lead! Match over (single game).
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().context.team1Score).toBe(14);
      expect(actor.getSnapshot().context.team2Score).toBe(12);
      expect(actor.getSnapshot().value).toBe('matchOver');
    });

    it('game ends at exact pointsToWin with 2-point lead (e.g. 11-0)', () => {
      const actor = createTestActor({
        scoringMode: 'rally',
        pointsToWin: 11,
        matchFormat: 'single',
      });
      actor.send({ type: 'START_GAME' });

      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }

      expect(actor.getSnapshot().context.team1Score).toBe(11);
      expect(actor.getSnapshot().value).toBe('matchOver');
    });
  });

  // ------------------------------------------------------------------
  // Single game: match ends when game ends
  // ------------------------------------------------------------------
  describe('single game match', () => {
    it('match ends immediately when single game is won', () => {
      const actor = createTestActor({
        scoringMode: 'rally',
        matchFormat: 'single',
        pointsToWin: 11,
      });
      actor.send({ type: 'START_GAME' });

      // Team 1 wins 11-0
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }

      expect(actor.getSnapshot().value).toBe('matchOver');
      expect(actor.getSnapshot().context.gamesWon).toEqual([1, 0]);
    });
  });

  // ------------------------------------------------------------------
  // Best-of-3
  // ------------------------------------------------------------------
  describe('best-of-3 match', () => {
    it('goes to betweenGames after game 1', () => {
      const actor = createTestActor({
        scoringMode: 'rally',
        matchFormat: 'best-of-3',
        pointsToWin: 11,
      });
      actor.send({ type: 'START_GAME' });

      // Team 1 wins game 1: 11-0
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }

      expect(actor.getSnapshot().value).toBe('betweenGames');
      expect(actor.getSnapshot().context.gamesWon).toEqual([1, 0]);
    });

    it('resets scores between games', () => {
      const actor = createTestActor({
        scoringMode: 'rally',
        matchFormat: 'best-of-3',
        pointsToWin: 11,
      });
      actor.send({ type: 'START_GAME' });

      // Team 1 wins game 1: 11-0
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }

      expect(actor.getSnapshot().value).toBe('betweenGames');

      actor.send({ type: 'START_NEXT_GAME' });
      expect(actor.getSnapshot().value).toBe('serving');
      expect(actor.getSnapshot().context.team1Score).toBe(0);
      expect(actor.getSnapshot().context.team2Score).toBe(0);
      expect(actor.getSnapshot().context.gameNumber).toBe(2);
    });

    it('alternates first serve between games', () => {
      const actor = createTestActor({
        scoringMode: 'rally',
        matchFormat: 'best-of-3',
        pointsToWin: 11,
      });
      actor.send({ type: 'START_GAME' });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);

      // Team 1 wins game 1
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }

      actor.send({ type: 'START_NEXT_GAME' });
      // Game 2 should start with team 2 serving
      expect(actor.getSnapshot().context.servingTeam).toBe(2);
    });

    it('match ends when a team wins 2 games', () => {
      const actor = createTestActor({
        scoringMode: 'rally',
        matchFormat: 'best-of-3',
        pointsToWin: 11,
      });
      actor.send({ type: 'START_GAME' });

      // Team 1 wins game 1: 11-0
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }
      expect(actor.getSnapshot().value).toBe('betweenGames');

      // Start game 2
      actor.send({ type: 'START_NEXT_GAME' });

      // Team 1 wins game 2: 11-0
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }

      expect(actor.getSnapshot().value).toBe('matchOver');
      expect(actor.getSnapshot().context.gamesWon).toEqual([2, 0]);
    });

    it('allows split games before deciding match', () => {
      const actor = createTestActor({
        scoringMode: 'rally',
        matchFormat: 'best-of-3',
        pointsToWin: 11,
      });
      actor.send({ type: 'START_GAME' });

      // Team 1 wins game 1
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }
      expect(actor.getSnapshot().context.gamesWon).toEqual([1, 0]);
      actor.send({ type: 'START_NEXT_GAME' });

      // Team 2 wins game 2
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 2 });
      }
      expect(actor.getSnapshot().value).toBe('betweenGames');
      expect(actor.getSnapshot().context.gamesWon).toEqual([1, 1]);

      actor.send({ type: 'START_NEXT_GAME' });

      // Team 2 wins game 3
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 2 });
      }
      expect(actor.getSnapshot().value).toBe('matchOver');
      expect(actor.getSnapshot().context.gamesWon).toEqual([1, 2]);
    });
  });

  // ------------------------------------------------------------------
  // Best-of-5
  // ------------------------------------------------------------------
  describe('best-of-5 match', () => {
    it('needs 3 game wins to end the match', () => {
      const actor = createTestActor({
        scoringMode: 'rally',
        matchFormat: 'best-of-5',
        pointsToWin: 11,
      });
      actor.send({ type: 'START_GAME' });

      // Win 2 games for team 1 -> should not be matchOver yet
      for (let game = 0; game < 2; game++) {
        for (let i = 0; i < 11; i++) {
          actor.send({ type: 'SCORE_POINT', team: 1 });
        }
        expect(actor.getSnapshot().value).toBe('betweenGames');
        actor.send({ type: 'START_NEXT_GAME' });
      }

      expect(actor.getSnapshot().context.gamesWon).toEqual([2, 0]);
      expect(actor.getSnapshot().value).toBe('serving');

      // Win game 3 -> match over
      for (let i = 0; i < 11; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }
      expect(actor.getSnapshot().value).toBe('matchOver');
      expect(actor.getSnapshot().context.gamesWon).toEqual([3, 0]);
    });
  });

  // ------------------------------------------------------------------
  // Undo
  // ------------------------------------------------------------------
  describe('undo', () => {
    it('reverts last score action', () => {
      const actor = createTestActor({ scoringMode: 'rally' });
      actor.send({ type: 'START_GAME' });

      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().context.team1Score).toBe(1);

      actor.send({ type: 'UNDO' });
      expect(actor.getSnapshot().context.team1Score).toBe(0);
    });

    it('reverts serve state along with score', () => {
      const actor = createTestActor({ scoringMode: 'rally', gameType: 'doubles' });
      actor.send({ type: 'START_GAME' });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);

      // Non-serving team scores -> serve switches
      actor.send({ type: 'SCORE_POINT', team: 2 });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);
      expect(actor.getSnapshot().context.team2Score).toBe(1);

      // Undo -> back to original state
      actor.send({ type: 'UNDO' });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);
      expect(actor.getSnapshot().context.team2Score).toBe(0);
    });

    it('reverts side-out action', () => {
      const actor = createTestActor({ scoringMode: 'sideout', gameType: 'doubles' });
      actor.send({ type: 'START_GAME' });

      // Start: team 1, server 2
      expect(actor.getSnapshot().context.servingTeam).toBe(1);
      expect(actor.getSnapshot().context.serverNumber).toBe(2);

      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);
      expect(actor.getSnapshot().context.serverNumber).toBe(1);

      actor.send({ type: 'UNDO' });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);
      expect(actor.getSnapshot().context.serverNumber).toBe(2);
    });

    it('does nothing when history is empty', () => {
      const actor = createTestActor({ scoringMode: 'rally' });
      actor.send({ type: 'START_GAME' });

      // No actions taken, undo should do nothing
      actor.send({ type: 'UNDO' });
      expect(actor.getSnapshot().value).toBe('serving');
      expect(actor.getSnapshot().context.team1Score).toBe(0);
      expect(actor.getSnapshot().context.team2Score).toBe(0);
    });

    it('supports multiple undos in sequence', () => {
      const actor = createTestActor({ scoringMode: 'rally' });
      actor.send({ type: 'START_GAME' });

      actor.send({ type: 'SCORE_POINT', team: 1 });
      actor.send({ type: 'SCORE_POINT', team: 1 });
      actor.send({ type: 'SCORE_POINT', team: 2 });

      expect(actor.getSnapshot().context.team1Score).toBe(2);
      expect(actor.getSnapshot().context.team2Score).toBe(1);

      actor.send({ type: 'UNDO' });
      expect(actor.getSnapshot().context.team1Score).toBe(2);
      expect(actor.getSnapshot().context.team2Score).toBe(0);

      actor.send({ type: 'UNDO' });
      expect(actor.getSnapshot().context.team1Score).toBe(1);
      expect(actor.getSnapshot().context.team2Score).toBe(0);

      actor.send({ type: 'UNDO' });
      expect(actor.getSnapshot().context.team1Score).toBe(0);
      expect(actor.getSnapshot().context.team2Score).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Side-out scoring in singles
  // ------------------------------------------------------------------
  describe('singles side-out', () => {
    it('serve alternates on SIDE_OUT in singles', () => {
      const actor = createTestActor({ scoringMode: 'sideout', gameType: 'singles' });
      actor.send({ type: 'START_GAME' });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);

      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);

      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(1);
    });

    it('singles starts with server 1 (no one-serve rule)', () => {
      const actor = createTestActor({ scoringMode: 'sideout', gameType: 'singles' });
      expect(actor.getSnapshot().context.serverNumber).toBe(1);
    });
  });

  // ------------------------------------------------------------------
  // Side-out scoring: complete game flow
  // ------------------------------------------------------------------
  describe('side-out complete game flow', () => {
    it('plays a full side-out doubles game to completion', () => {
      const actor = createTestActor({
        scoringMode: 'sideout',
        gameType: 'doubles',
        matchFormat: 'single',
        pointsToWin: 5,
      });
      actor.send({ type: 'START_GAME' });

      // Start: team 1, server 2
      // Team 1 scores a point
      actor.send({ type: 'SCORE_POINT', team: 1 });
      expect(actor.getSnapshot().context.team1Score).toBe(1);

      // Side-out from server 2 -> team 2, server 1
      actor.send({ type: 'SIDE_OUT' });
      expect(actor.getSnapshot().context.servingTeam).toBe(2);

      // Team 2 scores 5 points in a row to win 5-1
      for (let i = 0; i < 5; i++) {
        actor.send({ type: 'SCORE_POINT', team: 2 });
      }
      expect(actor.getSnapshot().context.team2Score).toBe(5);
      expect(actor.getSnapshot().value).toBe('matchOver');
      expect(actor.getSnapshot().context.gamesWon).toEqual([0, 1]);
    });
  });

  // ------------------------------------------------------------------
  // Doubles side-out new game starts with server 2
  // ------------------------------------------------------------------
  describe('new game server number in doubles side-out', () => {
    it('new game starts with server 2 for first serving team', () => {
      const actor = createTestActor({
        scoringMode: 'sideout',
        gameType: 'doubles',
        matchFormat: 'best-of-3',
        pointsToWin: 5,
      });
      actor.send({ type: 'START_GAME' });

      // Win game 1 quickly
      for (let i = 0; i < 5; i++) {
        actor.send({ type: 'SCORE_POINT', team: 1 });
      }
      expect(actor.getSnapshot().value).toBe('betweenGames');

      actor.send({ type: 'START_NEXT_GAME' });
      // Game 2: team 2 serves first, should start with server 2 (one-serve rule)
      expect(actor.getSnapshot().context.servingTeam).toBe(2);
      expect(actor.getSnapshot().context.serverNumber).toBe(2);
    });
  });
});
