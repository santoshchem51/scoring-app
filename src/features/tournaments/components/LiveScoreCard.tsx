import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useLiveMatch } from '../hooks/useLiveMatch';
import { extractLiveScore, extractGameCount } from '../engine/scoreExtraction';

interface Props {
  matchId: string;
  team1Name: string;
  team2Name: string;
}

const LiveScoreCard: Component<Props> = (props) => {
  const { match, loading } = useLiveMatch(() => props.matchId);

  const liveScore = () => extractLiveScore(match());
  const gameCount = () => extractGameCount(match());

  return (
    <div class="bg-surface-light rounded-lg border border-surface-lighter overflow-hidden">
      <Show when={!loading()} fallback={
        <div class="px-3 py-2 text-xs text-on-surface-muted">Loading...</div>
      }>
        <Show when={match()}>
          {(m) => (
            <>
              {/* Header with live indicator */}
              <div class="px-3 py-1.5 flex items-center gap-2 bg-surface-lighter">
                <Show when={m().status === 'in-progress'}>
                  <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span class="text-xs font-semibold text-red-400">LIVE</span>
                </Show>
                <Show when={m().status === 'completed'}>
                  <span class="text-xs font-semibold text-green-400">FINAL</span>
                </Show>
                <Show when={m().config.matchFormat !== 'single'}>
                  <span class="text-xs text-on-surface-muted ml-auto">
                    Games: {gameCount().team1}-{gameCount().team2}
                  </span>
                </Show>
              </div>
              {/* Score display */}
              <div class="px-3 py-2 space-y-1">
                <div class="flex items-center justify-between text-sm">
                  <span class={`truncate ${m().winningSide === 1 ? 'font-bold text-on-surface' : 'text-on-surface-muted'}`}>
                    {props.team1Name}
                  </span>
                  <span class={`font-mono font-bold ${m().winningSide === 1 ? 'text-on-surface' : 'text-on-surface-muted'}`}>
                    {liveScore().team1Score}
                  </span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class={`truncate ${m().winningSide === 2 ? 'font-bold text-on-surface' : 'text-on-surface-muted'}`}>
                    {props.team2Name}
                  </span>
                  <span class={`font-mono font-bold ${m().winningSide === 2 ? 'text-on-surface' : 'text-on-surface-muted'}`}>
                    {liveScore().team2Score}
                  </span>
                </div>
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
};

export default LiveScoreCard;
