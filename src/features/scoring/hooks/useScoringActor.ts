import { createSignal, onCleanup } from 'solid-js';
import { createActor } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import { pickleballMachine } from '../engine/pickleballMachine';
import { scoreEventRepository } from '../../../data/repositories/scoreEventRepository';
import { matchRepository } from '../../../data/repositories/matchRepository';
import type { MatchConfig, ScoreEvent, GameResult } from '../../../data/types';
import { cloudSync } from '../../../data/firebase/cloudSync';

export interface ResumeState {
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;
  gameNumber: number;
  gamesWon: [number, number];
}

function persistSnapshot(matchId: string, context: { team1Score: number; team2Score: number; servingTeam: 1 | 2; serverNumber: 1 | 2; gameNumber: number; gamesWon: [number, number]; config: { gameType: string; scoringMode: string; matchFormat: string; pointsToWin: number }; gamesToWin: number }) {
  const snapshot: ResumeState = {
    team1Score: context.team1Score,
    team2Score: context.team2Score,
    servingTeam: context.servingTeam,
    serverNumber: context.serverNumber,
    gameNumber: context.gameNumber,
    gamesWon: [context.gamesWon[0], context.gamesWon[1]],
  };
  // Fire and forget - don't block the UI on DB write
  matchRepository.getById(matchId).then((match) => {
    if (match) {
      const updated = { ...match, lastSnapshot: JSON.stringify(snapshot) };
      matchRepository.save(updated);
      cloudSync.syncMatchToCloud(updated);
    }
  });
}

function hasWonGame(score: number, opponentScore: number, pointsToWin: number): boolean {
  return score >= pointsToWin && score - opponentScore >= 2;
}

function saveCompletedGame(matchId: string, context: { team1Score: number; team2Score: number; gameNumber: number; config: { pointsToWin: number } }) {
  const winningSide: 1 | 2 = hasWonGame(context.team1Score, context.team2Score, context.config.pointsToWin) ? 1 : 2;
  const gameResult: GameResult = {
    gameNumber: context.gameNumber,
    team1Score: context.team1Score,
    team2Score: context.team2Score,
    winningSide,
  };
  matchRepository.getById(matchId).then((match) => {
    if (match) {
      // Only add if this game hasn't been saved yet
      const alreadySaved = match.games.some((g) => g.gameNumber === gameResult.gameNumber);
      if (!alreadySaved) {
        const updated = { ...match, games: [...match.games, gameResult] };
        matchRepository.save(updated);
        cloudSync.syncMatchToCloud(updated);
      }
    }
  });
}

export function useScoringActor(matchId: string, config: MatchConfig, initialState?: ResumeState) {
  const actor = createActor(pickleballMachine, {
    input: {
      gameType: config.gameType,
      scoringMode: config.scoringMode,
      matchFormat: config.matchFormat,
      pointsToWin: config.pointsToWin,
    },
  });

  const [state, setState] = createSignal<SnapshotFrom<typeof pickleballMachine>>(
    actor.getSnapshot(),
  );

  actor.subscribe((snapshot) => {
    setState(snapshot);
  });
  actor.start();

  if (initialState) {
    actor.send({
      type: 'RESUME',
      snapshot: {
        ...initialState,
        config: {
          gameType: config.gameType,
          scoringMode: config.scoringMode,
          matchFormat: config.matchFormat,
          pointsToWin: config.pointsToWin,
        },
        gamesToWin: config.matchFormat === 'single' ? 1 : config.matchFormat === 'best-of-3' ? 2 : 3,
      },
    });
  } else {
    actor.send({ type: 'START_GAME' });
  }

  onCleanup(() => actor.stop());

  const scorePoint = async (team: 1 | 2) => {
    const before = actor.getSnapshot().context;
    actor.send({ type: 'SCORE_POINT', team });
    const after = actor.getSnapshot().context;

    if (before.team1Score !== after.team1Score || before.team2Score !== after.team2Score) {
      const event: ScoreEvent = {
        id: crypto.randomUUID(),
        matchId,
        gameNumber: after.gameNumber,
        timestamp: Date.now(),
        type: 'POINT_SCORED',
        team,
        serverNumber: before.serverNumber,
        team1Score: after.team1Score,
        team2Score: after.team2Score,
      };
      try {
        await scoreEventRepository.save(event);
        cloudSync.syncScoreEventToCloud(event);
      } catch (err) {
        console.error('Failed to save score event:', err);
      }
      persistSnapshot(matchId, after);

      // Bug #3: If a game was just won, save the completed game result
      const stateValue = actor.getSnapshot().value;
      if (stateValue === 'betweenGames' || stateValue === 'matchOver') {
        saveCompletedGame(matchId, after);
      }
    }
  };

  const sideOut = async () => {
    actor.send({ type: 'SIDE_OUT' });
    const after = actor.getSnapshot().context;
    const event: ScoreEvent = {
      id: crypto.randomUUID(),
      matchId,
      gameNumber: after.gameNumber,
      timestamp: Date.now(),
      type: 'SIDE_OUT',
      team: after.servingTeam,
      team1Score: after.team1Score,
      team2Score: after.team2Score,
    };
    try {
      await scoreEventRepository.save(event);
      cloudSync.syncScoreEventToCloud(event);
    } catch (err) {
      console.error('Failed to save score event:', err);
    }
    persistSnapshot(matchId, after);
  };

  const undo = async () => {
    const before = actor.getSnapshot().context;
    actor.send({ type: 'UNDO' });
    const after = actor.getSnapshot().context;

    // Bug #4: Persist UNDO event if state actually changed
    if (before.team1Score !== after.team1Score || before.team2Score !== after.team2Score || before.servingTeam !== after.servingTeam) {
      const event: ScoreEvent = {
        id: crypto.randomUUID(),
        matchId,
        gameNumber: after.gameNumber,
        timestamp: Date.now(),
        type: 'UNDO',
        team: after.servingTeam,
        team1Score: after.team1Score,
        team2Score: after.team2Score,
      };
      try {
        await scoreEventRepository.save(event);
        cloudSync.syncScoreEventToCloud(event);
      } catch (err) {
        console.error('Failed to save score event:', err);
      }
      persistSnapshot(matchId, after);
    }
  };

  const startNextGame = async () => {
    // Bug #3: Save the current completed game before starting next
    const currentContext = actor.getSnapshot().context;
    saveCompletedGame(matchId, currentContext);

    actor.send({ type: 'START_NEXT_GAME' });
    const after = actor.getSnapshot().context;
    persistSnapshot(matchId, after);
  };

  return { state, scorePoint, sideOut, undo, startNextGame };
}
