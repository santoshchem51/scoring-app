import { Switch, Match, Show, createResource, onCleanup, onMount, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams, useNavigate, useBeforeLeave, A } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import Scoreboard from './components/Scoreboard';
import ScoreControls from './components/ScoreControls';
import { useScoringActor } from './hooks/useScoringActor';
import type { ResumeState } from './hooks/useScoringActor';
import { useWakeLock } from '../../shared/hooks/useWakeLock';
import ConfirmDialog from '../../shared/components/ConfirmDialog';
import { matchRepository } from '../../data/repositories/matchRepository';
import type { Match as MatchData } from '../../data/types';
import { settings } from '../../stores/settingsStore';

interface ScoringViewProps {
  match: MatchData;
  initialState?: ResumeState;
}

const ScoringView: Component<ScoringViewProps> = (props) => {
  const navigate = useNavigate();
  const { state, scorePoint, sideOut, undo, startNextGame } = useScoringActor(
    props.match.id,
    props.match.config,
    props.initialState,
  );

  const { request: requestWakeLock } = useWakeLock();
  if (settings().keepScreenAwake) {
    requestWakeLock();
  }

  const ctx = () => state().context;
  const scoringModeDisplay = () => props.match.config.scoringMode === 'sideout' ? 'Side-Out' : 'Rally';
  const stateName = () => {
    const value = state().value;
    return typeof value === 'string' ? value : '';
  };

  // Bug #2: Navigation guard - beforeunload for browser refresh/close
  const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    const name = stateName();
    if (name === 'serving' || name === 'betweenGames') {
      event.preventDefault();
    }
  };

  window.addEventListener('beforeunload', beforeUnloadHandler);
  onCleanup(() => window.removeEventListener('beforeunload', beforeUnloadHandler));

  // Navigation guard - SPA navigation
  const [showLeaveConfirm, setShowLeaveConfirm] = createSignal(false);
  let pendingLeaveRetry: (() => void) | null = null;

  useBeforeLeave((e) => {
    const name = stateName();
    if ((name === 'serving' || name === 'betweenGames') && !e.defaultPrevented) {
      e.preventDefault();
      pendingLeaveRetry = () => e.retry(true);
      setShowLeaveConfirm(true);
    }
  });

  // Landscape detection for side-by-side layout
  const checkLandscape = () =>
    window.innerHeight < 500 && window.innerWidth > window.innerHeight;
  const [isLandscape, setIsLandscape] = createSignal(checkLandscape());

  onMount(() => {
    const handleResize = () => setIsLandscape(checkLandscape());
    window.addEventListener('resize', handleResize);
    onCleanup(() => window.removeEventListener('resize', handleResize));
  });

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
    // Bug #3: Re-read match from DB to get previously saved games
    const freshMatch = await matchRepository.getById(props.match.id);
    const existingGames = freshMatch?.games ?? [];

    // Only append the final game if not already saved
    const finalGameAlreadySaved = existingGames.some((g) => g.gameNumber === context.gameNumber);
    const games = finalGameAlreadySaved
      ? existingGames
      : [
          ...existingGames,
          {
            gameNumber: context.gameNumber,
            team1Score: context.team1Score,
            team2Score: context.team2Score,
            winningSide: winningSide(),
          },
        ];

    const updatedMatch: MatchData = {
      ...props.match,
      ...(freshMatch ?? {}),
      status: 'completed',
      winningSide: winningSide(),
      completedAt: Date.now(),
      games,
      lastSnapshot: null,
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
          <span class="text-xs text-on-surface-muted">
            {scoringModeDisplay()}
          </span>
          <span class="text-xs text-on-surface-muted">
            to {props.match.config.pointsToWin}
          </span>
        </div>

        {/* Score Call */}
        <Show when={props.match.config.scoringMode === 'sideout' && props.match.config.gameType === 'doubles' && stateName() === 'serving'}>
          <div class="text-center">
            <span class="text-2xl font-bold text-on-surface tabular-nums" style={{ "font-family": "var(--font-score)" }}>
              {ctx().servingTeam === 1
                ? `${ctx().team1Score}-${ctx().team2Score}-${ctx().serverNumber}`
                : `${ctx().team2Score}-${ctx().team1Score}-${ctx().serverNumber}`}
            </span>
            <p class="text-xs text-on-surface-muted mt-1">Score Call</p>
          </div>
        </Show>

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
          pointsToWin={props.match.config.pointsToWin}
        />

        {/* State-dependent controls */}
        <Switch>
          <Match when={stateName() === 'serving'}>
            <Show
              when={isLandscape()}
              fallback={
                <ScoreControls
                  team1Name={props.match.team1Name}
                  team2Name={props.match.team2Name}
                  scoringMode={props.match.config.scoringMode}
                  servingTeam={ctx().servingTeam}
                  onScorePoint={scorePoint}
                  onSideOut={sideOut}
                  onUndo={undo}
                />
              }
            >
              <div class="fixed inset-0 bg-surface z-40 flex">
                {/* Left side: Scoreboard */}
                <div class="flex-1 flex flex-col justify-center">
                  <div class="flex items-center justify-center gap-4 px-4 mb-4">
                    <span class="text-sm text-on-surface-muted">
                      Game {ctx().gameNumber}
                    </span>
                    <span class="text-xs text-on-surface-muted px-2 py-1 bg-surface-light rounded-full">
                      {ctx().gamesWon[0]} - {ctx().gamesWon[1]}
                    </span>
                    <span class="text-xs text-on-surface-muted">
                      {scoringModeDisplay()}
                    </span>
                    <span class="text-xs text-on-surface-muted">
                      to {props.match.config.pointsToWin}
                    </span>
                  </div>
                  <Scoreboard
                    team1Name={props.match.team1Name}
                    team2Name={props.match.team2Name}
                    team1Score={ctx().team1Score}
                    team2Score={ctx().team2Score}
                    servingTeam={ctx().servingTeam}
                    serverNumber={ctx().serverNumber}
                    scoringMode={props.match.config.scoringMode}
                    gameType={props.match.config.gameType}
                    pointsToWin={props.match.config.pointsToWin}
                  />
                </div>
                {/* Right side: ScoreControls */}
                <div class="flex-1 flex flex-col justify-center">
                  <ScoreControls
                    team1Name={props.match.team1Name}
                    team2Name={props.match.team2Name}
                    scoringMode={props.match.config.scoringMode}
                    servingTeam={ctx().servingTeam}
                    onScorePoint={scorePoint}
                    onSideOut={sideOut}
                    onUndo={undo}
                  />
                </div>
              </div>
            </Show>
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
      <ConfirmDialog
        open={showLeaveConfirm()}
        title="Leave Game?"
        message="You have an active game in progress. Are you sure you want to leave?"
        confirmLabel="Leave"
        onConfirm={() => {
          setShowLeaveConfirm(false);
          pendingLeaveRetry?.();
          pendingLeaveRetry = null;
        }}
        onCancel={() => {
          setShowLeaveConfirm(false);
          pendingLeaveRetry = null;
        }}
      />
    </PageLayout>
  );
};

const ScoringPage: Component = () => {
  const params = useParams<{ matchId: string }>();
  const [match] = createResource(() => params.matchId, (id) => matchRepository.getById(id));

  const initialState = (): ResumeState | undefined => {
    const m = match();
    if (m?.lastSnapshot) {
      try {
        return JSON.parse(m.lastSnapshot) as ResumeState;
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  return (
    <Switch fallback={<PageLayout title="Loading..."><div class="flex items-center justify-center min-h-[50vh]"><p class="text-on-surface-muted">Loading match...</p></div></PageLayout>}>
      <Match when={match.error || (match.state === 'ready' && !match())}>
        <PageLayout title="Error">
          <div class="flex flex-col items-center justify-center min-h-[50vh] gap-4">
            <p class="text-on-surface-muted">{match.error ? 'Failed to load match' : 'Match not found'}</p>
            <A href="/" class="text-primary underline">Back to Home</A>
          </div>
        </PageLayout>
      </Match>
      <Match when={match()}>
        {(loadedMatch) => <ScoringView match={loadedMatch()} initialState={initialState()} />}
      </Match>
    </Switch>
  );
};

export default ScoringPage;
