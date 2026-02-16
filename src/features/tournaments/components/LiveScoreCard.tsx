import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useLiveMatch } from '../hooks/useLiveMatch';

interface Props {
  matchId: string;
  team1Name: string;
  team2Name: string;
}

const LiveScoreCard: Component<Props> = (props) => {
  const { match, loading } = useLiveMatch(() => props.matchId);

  const liveScore = () => {
    const m = match();
    if (!m) return { team1Score: 0, team2Score: 0 };
    // Use lastSnapshot for in-progress scores (games array only has completed games)
    if (m.lastSnapshot && m.status === 'in-progress') {
      try {
        const snap = typeof m.lastSnapshot === 'string' ? JSON.parse(m.lastSnapshot) : m.lastSnapshot;
        return { team1Score: snap.team1Score ?? 0, team2Score: snap.team2Score ?? 0 };
      } catch { /* fall through */ }
    }
    // Fallback to last completed game
    if (m.games.length > 0) {
      const last = m.games[m.games.length - 1];
      return { team1Score: last.team1Score, team2Score: last.team2Score };
    }
    return { team1Score: 0, team2Score: 0 };
  };

  const gameCount = () => {
    const m = match();
    if (!m) return { team1: 0, team2: 0 };
    let t1 = 0;
    let t2 = 0;
    for (const g of m.games) {
      if (g.winningSide === 1) t1++;
      else if (g.winningSide === 2) t2++;
    }
    return { team1: t1, team2: t2 };
  };

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
