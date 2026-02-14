import { createSignal, onCleanup } from 'solid-js';
import { createActor } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import { pickleballMachine } from '../engine/pickleballMachine';
import { scoreEventRepository } from '../../../data/repositories/scoreEventRepository';
import type { MatchConfig, ScoreEvent } from '../../../data/types';

export function useScoringActor(matchId: string, config: MatchConfig) {
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
  actor.send({ type: 'START_GAME' });

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
      await scoreEventRepository.save(event);
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
    await scoreEventRepository.save(event);
  };

  const undo = () => {
    actor.send({ type: 'UNDO' });
  };

  const startNextGame = () => {
    actor.send({ type: 'START_NEXT_GAME' });
  };

  return { state, scorePoint, sideOut, undo, startNextGame };
}
