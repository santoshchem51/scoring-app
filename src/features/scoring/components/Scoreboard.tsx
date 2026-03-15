import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { GameType, ScoringMode } from '../../../data/types';
import { useScoreAnimation } from '../hooks/useScoreAnimation';
import { useSwipeGesture } from '../../../shared/hooks/useSwipeGesture';
import { hexToRgb } from '../../../shared/utils/colorUtils';

interface Props {
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;
  scoringMode: ScoringMode;
  gameType: GameType;
  pointsToWin?: number;
  team1Color?: string;
  team2Color?: string;
  onSwipeScoreTeam1?: () => void;
  onSwipeScoreTeam2?: () => void;
  onSwipeUndo?: () => void;
}

const Scoreboard: Component<Props> = (props) => {
  let team1ScoreRef: HTMLSpanElement | undefined;
  let team2ScoreRef: HTMLSpanElement | undefined;
  let team1PanelRef: HTMLDivElement | undefined;
  let team2PanelRef: HTMLDivElement | undefined;

  useScoreAnimation(() => props.team1Score, () => team1ScoreRef);
  useScoreAnimation(() => props.team2Score, () => team2ScoreRef);

  useSwipeGesture(() => team1PanelRef, {
    onSwipeRight: props.onSwipeScoreTeam1,
    onSwipeLeft: props.onSwipeUndo,
  });
  useSwipeGesture(() => team2PanelRef, {
    onSwipeRight: props.onSwipeScoreTeam2,
    onSwipeLeft: props.onSwipeUndo,
  });

  const isServing = (team: 1 | 2) => props.servingTeam === team;
  const showServerNumber = () =>
    props.scoringMode === 'sideout' && props.gameType === 'doubles';

  const isGamePoint = (teamScore: number, otherScore: number) => {
    const target = props.pointsToWin ?? 11;
    return teamScore >= target - 1 && teamScore > otherScore;
  };
  const team1GamePoint = () => isGamePoint(props.team1Score, props.team2Score);
  const team2GamePoint = () => isGamePoint(props.team2Score, props.team1Score);

  const t1Color = () => props.team1Color ?? '#22c55e';
  const t2Color = () => props.team2Color ?? '#f97316';

  return (
    <div class="grid grid-cols-[1fr_auto_1fr] gap-0 px-4" role="region" aria-label="Scoreboard">
      {/* Screen reader live announcement */}
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {props.team1Name} {props.team1Score}, {props.team2Name} {props.team2Score}
      </div>

      {/* Team 1 */}
      <div
        ref={team1PanelRef}
        class="score-panel score-panel-brackets flex flex-col items-center py-6 rounded-2xl"
        classList={{
          'serving': isServing(1),
          'game-point': team1GamePoint() && !isServing(1),
        }}
        style={{
          "touch-action": "pan-y",
          "--team-color": t1Color(),
          "--team-color-rgb": hexToRgb(t1Color()),
        } as import('solid-js').JSX.CSSProperties}
        aria-label={`${props.team1Name}: ${props.team1Score}${isServing(1) ? ', serving' : ''}${team1GamePoint() ? ', game point' : ''}`}
      >
        <span
          class="text-sm font-semibold text-on-surface-muted mb-2 truncate max-w-full px-2 uppercase tracking-wider"
          style={{ "font-family": "var(--font-score)", "font-weight": "400" }}
        >
          {props.team1Name}
        </span>
        <span
          ref={team1ScoreRef}
          class="text-7xl font-bold text-score tabular-nums"
          style={{ "font-family": "var(--font-score)" }}
        >
          {props.team1Score}
        </span>
        <Show when={isServing(1)}>
          <span
            class="mt-2 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
            style={{ color: t1Color(), "border-color": t1Color() }}
          >
            {showServerNumber() ? `Server ${props.serverNumber}` : 'Serving'}
          </span>
        </Show>
        <Show when={team1GamePoint()}>
          <span
            class="mt-1 text-sm font-bold uppercase tracking-wider game-point-pulse"
            style={{ color: t1Color(), "animation": "gamePointPulse 1.5s ease-in-out infinite" }}
          >
            Game Point
          </span>
        </Show>
      </div>

      {/* Net divider */}
      <div class="flex flex-col items-center justify-center py-4" aria-hidden="true">
        <div class="net-line flex-1" />
        <div class="net-diamond my-1" />
        <div class="net-line flex-1" />
      </div>

      {/* Team 2 */}
      <div
        ref={team2PanelRef}
        class="score-panel score-panel-brackets flex flex-col items-center py-6 rounded-2xl"
        classList={{
          'serving': isServing(2),
          'game-point': team2GamePoint() && !isServing(2),
        }}
        style={{
          "touch-action": "pan-y",
          "--team-color": t2Color(),
          "--team-color-rgb": hexToRgb(t2Color()),
        } as import('solid-js').JSX.CSSProperties}
        aria-label={`${props.team2Name}: ${props.team2Score}${isServing(2) ? ', serving' : ''}${team2GamePoint() ? ', game point' : ''}`}
      >
        <span
          class="text-sm font-semibold text-on-surface-muted mb-2 truncate max-w-full px-2 uppercase tracking-wider"
          style={{ "font-family": "var(--font-score)", "font-weight": "400" }}
        >
          {props.team2Name}
        </span>
        <span
          ref={team2ScoreRef}
          class="text-7xl font-bold text-score tabular-nums"
          style={{ "font-family": "var(--font-score)" }}
        >
          {props.team2Score}
        </span>
        <Show when={isServing(2)}>
          <span
            class="mt-2 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
            style={{ color: t2Color(), "border-color": t2Color() }}
          >
            {showServerNumber() ? `Server ${props.serverNumber}` : 'Serving'}
          </span>
        </Show>
        <Show when={team2GamePoint()}>
          <span
            class="mt-1 text-sm font-bold uppercase tracking-wider game-point-pulse"
            style={{ color: t2Color(), "animation": "gamePointPulse 1.5s ease-in-out infinite" }}
          >
            Game Point
          </span>
        </Show>
      </div>
    </div>
  );
};

export default Scoreboard;
