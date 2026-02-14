import { Show, Switch, Match, createResource } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import Scoreboard from './components/Scoreboard';
import ScoreControls from './components/ScoreControls';
import { useScoringActor } from './hooks/useScoringActor';
import { useWakeLock } from '../../shared/hooks/useWakeLock';
import { matchRepository } from '../../data/repositories/matchRepository';
import type { Match as MatchData } from '../../data/types';

interface ScoringViewProps {
  match: MatchData;
}

const ScoringView: Component<ScoringViewProps> = (props) => {
  const navigate = useNavigate();
  const { state, scorePoint, sideOut, undo, startNextGame } = useScoringActor(
    props.match.id,
    props.match.config,
  );

  const { request: requestWakeLock } = useWakeLock();
  requestWakeLock();

  const ctx = () => state().context;
  const stateName = () => {
    const value = state().value;
    return typeof value === 'string' ? value : '';
  };

  const winnerName = () => {
    const context = ctx();
    if (context.gamesWon[0] > context.gamesWon[1]) {
      return props.match.team1Name;
    }
    return props.match.team2Name;
  };

  const winningSide = (): 1 | 2 => {
    const context = ctx();
    return context.gamesWon[0] > context.gamesWon[1] ? 1 : 2;
  };

  const saveAndFinish = async () => {
    const context = ctx();
    const updatedMatch: MatchData = {
      ...props.match,
      status: 'completed',
      winningSide: winningSide(),
      completedAt: Date.now(),
      games: [
        ...props.match.games,
        {
          gameNumber: context.gameNumber,
          team1Score: context.team1Score,
          team2Score: context.team2Score,
          winningSide: winningSide(),
        },
      ],
    };
    await matchRepository.save(updatedMatch);
    navigate('/history');
  };

  return (
    <PageLayout title="Live Score">
      <div class="flex flex-col gap-6 py-4">
        {/* Match info header */}
        <div class="flex items-center justify-center gap-4 px-4">
          <span class="text-sm text-on-surface-muted">
            Game {ctx().gameNumber}
          </span>
          <span class="text-xs text-on-surface-muted px-2 py-1 bg-surface-light rounded-full">
            {ctx().gamesWon[0]} - {ctx().gamesWon[1]}
          </span>
          <span class="text-xs text-on-surface-muted capitalize">
            {props.match.config.scoringMode}
          </span>
          <span class="text-xs text-on-surface-muted">
            to {props.match.config.pointsToWin}
          </span>
        </div>

        {/* Scoreboard */}
        <Scoreboard
          team1Name={props.match.team1Name}
          team2Name={props.match.team2Name}
          team1Score={ctx().team1Score}
          team2Score={ctx().team2Score}
          servingTeam={ctx().servingTeam}
          serverNumber={ctx().serverNumber}
          scoringMode={props.match.config.scoringMode}
          gameType={props.match.config.gameType}
        />

        {/* State-dependent controls */}
        <Switch>
          <Match when={stateName() === 'serving'}>
            <ScoreControls
              team1Name={props.match.team1Name}
              team2Name={props.match.team2Name}
              scoringMode={props.match.config.scoringMode}
              onScorePoint={scorePoint}
              onSideOut={sideOut}
              onUndo={undo}
            />
          </Match>

          <Match when={stateName() === 'betweenGames'}>
            <div class="flex flex-col items-center gap-4 px-4">
              <p class="text-2xl font-bold text-score">Game Complete!</p>
              <p class="text-on-surface-muted">
                Games: {ctx().gamesWon[0]} - {ctx().gamesWon[1]}
              </p>
              <button
                type="button"
                onClick={() => startNextGame()}
                class="w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
              >
                Start Next Game
              </button>
            </div>
          </Match>

          <Match when={stateName() === 'matchOver'}>
            <div class="flex flex-col items-center gap-4 px-4">
              <p class="text-2xl font-bold text-score">Match Over!</p>
              <p class="text-lg text-on-surface">
                {winnerName()} wins!
              </p>
              <p class="text-on-surface-muted">
                Final: {ctx().gamesWon[0]} - {ctx().gamesWon[1]}
              </p>
              <button
                type="button"
                onClick={saveAndFinish}
                class="w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl active:scale-95 transition-transform"
              >
                Save & Finish
              </button>
            </div>
          </Match>
        </Switch>
      </div>
    </PageLayout>
  );
};

const ScoringPage: Component = () => {
  const params = useParams<{ matchId: string }>();
  const [match] = createResource(() => params.matchId, (id) => matchRepository.getById(id));

  return (
    <Show
      when={match()}
      fallback={
        <PageLayout title="Loading...">
          <div class="flex items-center justify-center min-h-[50vh]">
            <p class="text-on-surface-muted">Loading match...</p>
          </div>
        </PageLayout>
      }
    >
      {(loadedMatch) => <ScoringView match={loadedMatch()} />}
    </Show>
  );
};

export default ScoringPage;
