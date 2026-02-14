import { setup, assign } from 'xstate';
import type { ScoringContext, ScoringEvent, ScoringSnapshot } from './types.ts';

function takeSnapshot(ctx: ScoringContext): ScoringSnapshot {
  return {
    team1Score: ctx.team1Score,
    team2Score: ctx.team2Score,
    servingTeam: ctx.servingTeam,
    serverNumber: ctx.serverNumber,
    gameNumber: ctx.gameNumber,
    gamesWon: [ctx.gamesWon[0], ctx.gamesWon[1]],
  };
}

function gamesToWinFromFormat(format: ScoringContext['config']['matchFormat']): number {
  switch (format) {
    case 'single':
      return 1;
    case 'best-of-3':
      return 2;
    case 'best-of-5':
      return 3;
  }
}

function hasWonGame(score: number, opponentScore: number, pointsToWin: number): boolean {
  return score >= pointsToWin && score - opponentScore >= 2;
}

export const pickleballMachine = setup({
  types: {
    context: {} as ScoringContext,
    events: {} as ScoringEvent,
    input: {} as {
      gameType: ScoringContext['config']['gameType'];
      scoringMode: ScoringContext['config']['scoringMode'];
      matchFormat: ScoringContext['config']['matchFormat'];
      pointsToWin: number;
    },
  },
  guards: {
    canScore: ({ context, event }) => {
      if (context.config.scoringMode === 'rally') return true;
      // Side-out: only the serving team can score
      if (event.type !== 'SCORE_POINT') return false;
      return event.team === context.servingTeam;
    },
    isGameWon: ({ context }) => {
      const { team1Score, team2Score, config } = context;
      return (
        hasWonGame(team1Score, team2Score, config.pointsToWin) ||
        hasWonGame(team2Score, team1Score, config.pointsToWin)
      );
    },
    isNotGameWon: ({ context }) => {
      const { team1Score, team2Score, config } = context;
      return !(
        hasWonGame(team1Score, team2Score, config.pointsToWin) ||
        hasWonGame(team2Score, team1Score, config.pointsToWin)
      );
    },
    isMatchWon: ({ context }) => {
      return context.gamesWon[0] >= context.gamesToWin || context.gamesWon[1] >= context.gamesToWin;
    },
    isNotMatchWon: ({ context }) => {
      return context.gamesWon[0] < context.gamesToWin && context.gamesWon[1] < context.gamesToWin;
    },
    hasHistory: ({ context }) => {
      return context.history.length > 0;
    },
    resumeToMatchOver: ({ event }) => {
      if (event.type !== 'RESUME') return false;
      const s = event.snapshot;
      return s.gamesWon[0] >= s.gamesToWin || s.gamesWon[1] >= s.gamesToWin;
    },
    resumeToBetweenGames: ({ event }) => {
      if (event.type !== 'RESUME') return false;
      const s = event.snapshot;
      const isMatchOver = s.gamesWon[0] >= s.gamesToWin || s.gamesWon[1] >= s.gamesToWin;
      if (isMatchOver) return false;
      // Between games: a game was just won (score meets win condition) but match isn't over
      const ptw = s.config.pointsToWin;
      const gameJustWon =
        (s.team1Score >= ptw && s.team1Score - s.team2Score >= 2) ||
        (s.team2Score >= ptw && s.team2Score - s.team1Score >= 2);
      return gameJustWon;
    },
  },
  actions: {
    pushHistory: assign({
      history: ({ context }) => [...context.history, takeSnapshot(context)],
    }),
    scorePoint: assign({
      team1Score: ({ context, event }) => {
        if (event.type !== 'SCORE_POINT') return context.team1Score;
        return event.team === 1 ? context.team1Score + 1 : context.team1Score;
      },
      team2Score: ({ context, event }) => {
        if (event.type !== 'SCORE_POINT') return context.team2Score;
        return event.team === 2 ? context.team2Score + 1 : context.team2Score;
      },
    }),
    switchServeOnRallyScore: assign({
      servingTeam: ({ context, event }) => {
        if (context.config.scoringMode !== 'rally') return context.servingTeam;
        if (event.type !== 'SCORE_POINT') return context.servingTeam;
        // In rally scoring, serve switches when non-serving team scores
        if (event.team !== context.servingTeam) {
          return event.team;
        }
        return context.servingTeam;
      },
      serverNumber: ({ context, event }) => {
        if (context.config.scoringMode !== 'rally') return context.serverNumber;
        if (event.type !== 'SCORE_POINT') return context.serverNumber;
        if (context.config.gameType === 'singles') return 1 as const;
        // In rally doubles, when serve switches, new team starts with server 1
        if (event.team !== context.servingTeam) {
          return 1 as const;
        }
        return context.serverNumber;
      },
    }),
    handleSideOut: assign({
      servingTeam: ({ context }) => {
        const { gameType, scoringMode } = context.config;
        if (scoringMode !== 'sideout') return context.servingTeam;

        if (gameType === 'singles') {
          // Singles: serve just alternates
          return context.servingTeam === 1 ? 2 as const : 1 as const;
        }

        // Doubles side-out logic:
        // Server 1 -> Server 2 (same team)
        // Server 2 -> Other team, server 1
        if (context.serverNumber === 1) {
          // Stay on same team, go to server 2
          return context.servingTeam;
        }
        // Server 2 -> switch to other team
        return context.servingTeam === 1 ? 2 as const : 1 as const;
      },
      serverNumber: ({ context }) => {
        const { gameType, scoringMode } = context.config;
        if (scoringMode !== 'sideout') return context.serverNumber;

        if (gameType === 'singles') {
          return 1 as const;
        }

        // Doubles:
        // Server 1 -> Server 2 (same team)
        // Server 2 -> Other team, server 1
        if (context.serverNumber === 1) {
          return 2 as const;
        }
        return 1 as const;
      },
    }),
    recordGameWin: assign({
      gamesWon: ({ context }) => {
        const { team1Score, team2Score, config } = context;
        const newGamesWon: [number, number] = [context.gamesWon[0], context.gamesWon[1]];
        if (hasWonGame(team1Score, team2Score, config.pointsToWin)) {
          newGamesWon[0] += 1;
        } else if (hasWonGame(team2Score, team1Score, config.pointsToWin)) {
          newGamesWon[1] += 1;
        }
        return newGamesWon;
      },
    }),
    resetForNextGame: assign({
      team1Score: () => 0,
      team2Score: () => 0,
      gameNumber: ({ context }) => context.gameNumber + 1,
      // Alternate first serve each game
      servingTeam: ({ context }) => {
        // Game 1 starts with team 1. Game 2 with team 2. Etc.
        // Alternate based on the upcoming game number
        const nextGame = context.gameNumber + 1;
        return (nextGame % 2 === 1 ? 1 : 2) as 1 | 2;
      },
      serverNumber: ({ context }) => {
        // First serving team of a game in doubles starts with server 2 (one-serve rule)
        if (context.config.gameType === 'doubles' && context.config.scoringMode === 'sideout') {
          return 2 as const;
        }
        return 1 as const;
      },
      history: () => [] as ScoringSnapshot[],
    }),
    undoLastAction: assign(({ context }) => {
      if (context.history.length === 0) return {};
      const prev = context.history[context.history.length - 1];
      return {
        team1Score: prev.team1Score,
        team2Score: prev.team2Score,
        servingTeam: prev.servingTeam,
        serverNumber: prev.serverNumber,
        gameNumber: prev.gameNumber,
        gamesWon: [prev.gamesWon[0], prev.gamesWon[1]] as [number, number],
        history: context.history.slice(0, -1),
      };
    }),
    restoreSnapshot: assign(({ event }) => {
      if (event.type !== 'RESUME') return {};
      const s = event.snapshot;
      return {
        team1Score: s.team1Score,
        team2Score: s.team2Score,
        servingTeam: s.servingTeam,
        serverNumber: s.serverNumber,
        gameNumber: s.gameNumber,
        gamesWon: [s.gamesWon[0], s.gamesWon[1]] as [number, number],
        history: [] as ScoringSnapshot[],
      };
    }),
  },
}).createMachine({
  id: 'pickleball',
  context: ({ input }) => ({
    config: {
      gameType: input.gameType,
      scoringMode: input.scoringMode,
      matchFormat: input.matchFormat,
      pointsToWin: input.pointsToWin,
    },
    team1Score: 0,
    team2Score: 0,
    servingTeam: 1 as const,
    // Doubles side-out: first serving team starts with server 2 (one-serve rule)
    serverNumber:
      input.gameType === 'doubles' && input.scoringMode === 'sideout'
        ? (2 as const)
        : (1 as const),
    gameNumber: 1,
    gamesWon: [0, 0] as [number, number],
    gamesToWin: gamesToWinFromFormat(input.matchFormat),
    history: [] as ScoringSnapshot[],
  }),
  initial: 'pregame',
  states: {
    pregame: {
      on: {
        START_GAME: {
          target: 'serving',
        },
        RESUME: [
          {
            guard: 'resumeToMatchOver',
            target: 'matchOver',
            actions: ['restoreSnapshot'],
          },
          {
            guard: 'resumeToBetweenGames',
            target: 'betweenGames',
            actions: ['restoreSnapshot'],
          },
          {
            target: 'serving',
            actions: ['restoreSnapshot'],
          },
        ],
      },
    },
    serving: {
      on: {
        SCORE_POINT: {
          guard: 'canScore',
          target: 'checkWin',
          actions: ['pushHistory', 'scorePoint', 'switchServeOnRallyScore'],
        },
        SIDE_OUT: {
          target: 'serving',
          reenter: true,
          actions: ['pushHistory', 'handleSideOut'],
        },
        UNDO: {
          guard: 'hasHistory',
          target: 'serving',
          reenter: true,
          actions: ['undoLastAction'],
        },
      },
    },
    checkWin: {
      always: [
        {
          guard: 'isGameWon',
          target: 'checkMatchWin',
          actions: ['recordGameWin'],
        },
        {
          guard: 'isNotGameWon',
          target: 'serving',
        },
      ],
    },
    checkMatchWin: {
      always: [
        {
          guard: 'isMatchWon',
          target: 'matchOver',
        },
        {
          guard: 'isNotMatchWon',
          target: 'betweenGames',
        },
      ],
    },
    betweenGames: {
      on: {
        START_NEXT_GAME: {
          target: 'serving',
          actions: ['resetForNextGame'],
        },
      },
    },
    matchOver: {
      type: 'final',
    },
  },
});
