import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { GameType, ScoringMode } from '../../../data/types';
import { useScoreAnimation } from '../hooks/useScoreAnimation';
import { useSwipeGesture } from '../../../shared/hooks/useSwipeGesture';

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
    <div class="grid grid-cols-2 gap-4 px-4" role="region" aria-label="Scoreboard">
      {/* Screen reader live announcement */}
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {props.team1Name} {props.team1Score}, {props.team2Name} {props.team2Score}
      </div>

      {/* Team 1 */}
      <div
        ref={team1PanelRef}
        class="flex flex-col items-center py-6 rounded-2xl transition-all"
        classList={{
          'bg-surface-light': !isServing(1) && !team1GamePoint(),
        }}
        style={{
          "touch-action": "pan-y",
          ...(isServing(1) ? {
            "background-color": `${t1Color()}20`,
            border: `2px solid ${t1Color()}`,
            "box-shadow": `0 0 20px 4px ${t1Color()}30`,
          } : team1GamePoint() ? {
            "background-color": `${t1Color()}15`,
            border: `2px solid ${t1Color()}`,
          } : {
            border: '2px solid transparent',
          }),
        }}
        aria-label={`${props.team1Name}: ${props.team1Score}${isServing(1) ? ', serving' : ''}`}
      >
        <span class="text-sm font-semibold text-on-surface-muted mb-2 truncate max-w-full px-2">
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
          <span class="mt-2 text-xs font-bold uppercase tracking-wider" style={{ color: t1Color() }}>
            {showServerNumber() ? `Server ${props.serverNumber}` : 'Serving'}
          </span>
        </Show>
        <Show when={team1GamePoint()}>
          <span class="mt-1 text-xs font-bold uppercase tracking-wider animate-pulse" style={{ color: t1Color() }}>Game Point</span>
        </Show>
      </div>

      {/* Team 2 */}
      <div
        ref={team2PanelRef}
        class="flex flex-col items-center py-6 rounded-2xl transition-all"
        classList={{
          'bg-surface-light': !isServing(2) && !team2GamePoint(),
        }}
        style={{
          "touch-action": "pan-y",
          ...(isServing(2) ? {
            "background-color": `${t2Color()}20`,
            border: `2px solid ${t2Color()}`,
            "box-shadow": `0 0 20px 4px ${t2Color()}30`,
          } : team2GamePoint() ? {
            "background-color": `${t2Color()}15`,
            border: `2px solid ${t2Color()}`,
          } : {
            border: '2px solid transparent',
          }),
        }}
        aria-label={`${props.team2Name}: ${props.team2Score}${isServing(2) ? ', serving' : ''}`}
      >
        <span class="text-sm font-semibold text-on-surface-muted mb-2 truncate max-w-full px-2">
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
          <span class="mt-2 text-xs font-bold uppercase tracking-wider" style={{ color: t2Color() }}>
            {showServerNumber() ? `Server ${props.serverNumber}` : 'Serving'}
          </span>
        </Show>
        <Show when={team2GamePoint()}>
          <span class="mt-1 text-xs font-bold uppercase tracking-wider animate-pulse" style={{ color: t2Color() }}>Game Point</span>
        </Show>
      </div>
    </div>
  );
};

export default Scoreboard;
