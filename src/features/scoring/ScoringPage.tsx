import { Switch, Match, Show, createResource, onCleanup, onMount, createSignal, createEffect, on } from 'solid-js';
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
import { useCelebration } from '../../shared/hooks/useCelebration';
import { DEFAULT_TEAM1_COLOR, DEFAULT_TEAM2_COLOR } from '../../shared/constants/teamColors';
import { shareScoreCard } from '../../shared/utils/shareScoreCard';
import { useVoiceAnnouncements } from '../../shared/hooks/useVoiceAnnouncements';
import { cloudSync } from '../../data/firebase/cloudSync';

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

  const celebration = useCelebration();
  const t1Color = () => props.match.team1Color ?? DEFAULT_TEAM1_COLOR;
  const t2Color = () => props.match.team2Color ?? DEFAULT_TEAM2_COLOR;

  // Celebration trigger
  createEffect(on(stateName, (name, prev) => {
    if (prev === undefined) return;
    if (name === 'betweenGames') {
      const winnerColor = winningSide() === 1 ? t1Color() : t2Color();
      celebration.gameWin(winnerColor);
    }
    if (name === 'matchOver') {
      celebration.matchWin(t1Color(), t2Color());
    }
  }));

  // Voice announcements
  const voice = useVoiceAnnouncements({
    team1Name: props.match.team1Name,
    team2Name: props.match.team2Name,
    scoringMode: props.match.config.scoringMode,
    gameType: props.match.config.gameType,
    pointsToWin: props.match.config.pointsToWin,
  });

  createEffect(on(
    () => ({ ...ctx(), state: stateName() }),
    (current, prev) => {
      if (!prev) return;
      const { state, team1Score, team2Score, servingTeam, serverNumber, gameNumber, gamesWon } = current;

      // Game over announcement
      if (state === 'betweenGames' && prev.state === 'serving') {
        const winner = gamesWon[0] > prev.gamesWon[0] ? props.match.team1Name : props.match.team2Name;
        voice.announceGameOver(winner, prev.gameNumber, team1Score, team2Score);
        return;
      }

      // Match over announcement
      if (state === 'matchOver' && prev.state === 'serving') {
        const winner = gamesWon[0] > gamesWon[1] ? props.match.team1Name : props.match.team2Name;
        voice.announceMatchOver(winner, gamesWon[0], gamesWon[1]);
        return;
      }

      // Side out announcement
      if (servingTeam !== prev.servingTeam && state === 'serving') {
        voice.announceSideOut();
        // Announce score after a brief delay so side-out is heard first
        setTimeout(() => voice.announceScoreQueued(current), 800);
        return;
      }

      // Score change announcement
      if ((team1Score !== prev.team1Score || team2Score !== prev.team2Score) && state === 'serving') {
        const ptw = props.match.config.pointsToWin;
        const leading = Math.max(team1Score, team2Score);
        const trailing = Math.min(team1Score, team2Score);
        const leadTeam = team1Score > team2Score ? props.match.team1Name : props.match.team2Name;

        if (leading >= ptw - 1 && leading === trailing) {
          voice.announceDeuce();
          setTimeout(() => voice.announceScoreQueued(current), 1200);
        } else if (leading >= ptw - 1 && leading - trailing === 1) {
          voice.announceGamePoint(leadTeam);
          setTimeout(() => voice.announceScoreQueued(current), 1500);
        } else {
          voice.announceScore(current);
        }
      }
    },
  ));

  const [shareStatus, setShareStatus] = createSignal<string | null>(null);

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
    cloudSync.syncMatchToCloud(updatedMatch);
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
          team1Color={props.match.team1Color}
          team2Color={props.match.team2Color}
          onSwipeScoreTeam1={() => scorePoint(1)}
          onSwipeScoreTeam2={() => scorePoint(2)}
          onSwipeUndo={() => undo()}
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
                    team1Color={props.match.team1Color}
                    team2Color={props.match.team2Color}
                    onSwipeScoreTeam1={() => scorePoint(1)}
                    onSwipeScoreTeam2={() => scorePoint(2)}
                    onSwipeUndo={() => undo()}
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
              <button
                type="button"
                onClick={async () => {
                  const freshMatch = await matchRepository.getById(props.match.id);
                  if (!freshMatch) return;
                  const completedMatch = { ...freshMatch, team1Color: props.match.team1Color, team2Color: props.match.team2Color };
                  const result = await shareScoreCard(completedMatch);
                  setShareStatus(result === 'shared' ? 'Shared!' : result === 'copied' ? 'Copied to clipboard!' : result === 'downloaded' ? 'Downloaded!' : 'Share failed');
                  setTimeout(() => setShareStatus(null), 2000);
                }}
                class="w-full bg-surface-lighter text-on-surface font-semibold text-base py-4 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {shareStatus() ?? 'Share Score Card'}
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
