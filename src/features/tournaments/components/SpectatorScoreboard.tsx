import { Show } from 'solid-js';
import type { Component } from 'solid-js';

interface SpectatorScoreboardProps {
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  team1Wins: number;
  team2Wins: number;
  gameNumber: number;
  isServing?: 1 | 2;
  status: 'in-progress' | 'completed' | 'abandoned';
  spectatorCount?: number;
  contextLine?: string;
  isDoubles?: boolean;
  loading?: boolean;
}

const SpectatorScoreboard: Component<SpectatorScoreboardProps> = (props) => {
  return (
    <Show
      when={!props.loading}
      fallback={
        <div
          role="region"
          aria-label="Live scoreboard"
          data-testid="scoreboard-skeleton"
          class="bg-white rounded-xl p-4"
          style={{
            flex: '0 0 auto',
            contain: 'layout style paint',
            height: props.isDoubles ? '148px' : '120px',
          }}
        >
          <div class="animate-pulse space-y-3">
            <div class="h-4 bg-on-surface-muted/20 rounded w-20" />
            <div class="flex justify-between items-center">
              <div class="h-6 bg-on-surface-muted/20 rounded w-24" />
              <div class="h-10 bg-on-surface-muted/20 rounded w-12" />
            </div>
            <div class="flex justify-between items-center">
              <div class="h-6 bg-on-surface-muted/20 rounded w-24" />
              <div class="h-10 bg-on-surface-muted/20 rounded w-12" />
            </div>
          </div>
        </div>
      }
    >
      <div
        role="region"
        aria-label="Live scoreboard"
        class="bg-white rounded-xl p-4"
        style={{
          flex: '0 0 auto',
          contain: 'layout style paint',
          height: props.isDoubles ? '148px' : '120px',
        }}
      >
        {/* Status badge row */}
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <Show when={props.status === 'in-progress'}>
              <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold">
                <span
                  class="w-2 h-2 rounded-full bg-red-500 animate-pulse motion-reduce:animate-none"
                  aria-hidden="true"
                />
                LIVE
              </span>
            </Show>
            <Show when={props.status === 'completed'}>
              <span class="px-2 py-0.5 rounded-full bg-on-surface-muted/20 text-on-surface-muted text-xs font-semibold">
                FINAL
              </span>
            </Show>
            <Show when={props.status === 'abandoned'}>
              <span class="px-2 py-0.5 rounded-full bg-on-surface-muted/20 text-on-surface-muted text-xs font-semibold">
                ABANDONED
              </span>
            </Show>
          </div>

          <div class="flex items-center gap-2">
            <Show when={props.spectatorCount != null && props.spectatorCount > 10}>
              <span data-testid="spectator-count" class="text-xs text-on-surface-muted">
                👁 {props.spectatorCount}
              </span>
            </Show>
          </div>
        </div>

        {/* Team 1 row */}
        <div class="flex items-center justify-between mb-1" data-team="1">
          <div class="flex items-center gap-1.5 min-w-0">
            <Show when={props.isServing === 1}>
              <span data-serving aria-hidden="true" class="text-yellow-500 text-xs flex-shrink-0">●</span>
              <span class="sr-only">(serving)</span>
            </Show>
            <span class="text-on-surface text-sm font-medium truncate">
              {props.team1Name}
            </span>
          </div>
          <span
            class="font-mono font-bold text-on-surface"
            style={{
              'font-variant-numeric': 'tabular-nums',
              'font-size': 'clamp(48px, 10vw, 64px)',
              'min-width': '1.2ch',
              'text-align': 'right',
              color: '#111',
            }}
          >
            {props.team1Score}
          </span>
        </div>

        {/* Team 2 row */}
        <div class="flex items-center justify-between mb-1" data-team="2">
          <div class="flex items-center gap-1.5 min-w-0">
            <Show when={props.isServing === 2}>
              <span data-serving aria-hidden="true" class="text-yellow-500 text-xs flex-shrink-0">●</span>
              <span class="sr-only">(serving)</span>
            </Show>
            <span class="text-on-surface text-sm font-medium truncate">
              {props.team2Name}
            </span>
          </div>
          <span
            class="font-mono font-bold text-on-surface"
            style={{
              'font-variant-numeric': 'tabular-nums',
              'font-size': 'clamp(48px, 10vw, 64px)',
              'min-width': '1.2ch',
              'text-align': 'right',
              color: '#111',
            }}
          >
            {props.team2Score}
          </span>
        </div>

        {/* Game wins pills */}
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs text-on-surface-muted">
            Game {props.gameNumber} · {props.team1Wins}-{props.team2Wins}
          </span>
        </div>

        {/* Context line */}
        <Show when={props.contextLine}>
          <div class="mt-1 text-xs" style={{ color: '#4B5563' }}>
            {props.contextLine}
          </div>
        </Show>
      </div>
    </Show>
  );
};

export default SpectatorScoreboard;
