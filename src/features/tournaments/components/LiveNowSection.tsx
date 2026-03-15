import { Show, For, createSignal } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import LiveMatchCard from './LiveMatchCard';

export interface LiveNowMatch {
  matchId: string;
  team1Name: string;
  team2Name: string;
  court?: string;
  status: 'in-progress' | 'completed';
}

export interface UpcomingMatch {
  team1Name: string;
  team2Name: string;
  court?: string;
  scheduledTime?: string;
}

export interface LiveNowSectionProps {
  matches: LiveNowMatch[];
  tournamentCode: string;
  upcomingMatches?: UpcomingMatch[];
}

const MAX_VISIBLE = 3;

const LiveNowSection: Component<LiveNowSectionProps> = (props): JSX.Element => {
  const hasLive = () => props.matches.length > 0;
  const hasUpcoming = () => (props.upcomingMatches?.length ?? 0) > 0;
  const showSection = () => hasLive() || hasUpcoming();

  const [expanded, setExpanded] = createSignal(false);

  const visibleMatches = () => {
    if (expanded()) return props.matches;
    return props.matches.slice(0, MAX_VISIBLE);
  };
  const overflowCount = () => props.matches.length - MAX_VISIBLE;
  const visibleUpcoming = () => (props.upcomingMatches ?? []).slice(0, MAX_VISIBLE);

  return (
    <Show when={showSection()}>
      <section aria-labelledby="live-now-heading">
        <Show when={hasLive()} fallback={
          <>
            <div data-testid="live-now-header" class="flex items-center gap-2 mb-3 animate-[fadeIn_300ms_ease-out] motion-reduce:animate-none">
              <span
                class="w-2.5 h-2.5 rounded-full bg-yellow-500"
                aria-hidden="true"
              />
              <h2 id="live-now-heading" class="text-sm font-bold uppercase tracking-wide text-on-surface">
                UP NEXT
              </h2>
            </div>

            <ul class="space-y-2">
              <For each={visibleUpcoming()}>
                {(match) => (
                  <li>
                    <div
                      class="block rounded-lg border border-surface-lighter bg-surface-light px-3 py-2 border-l-4 border-l-surface-lighter"
                    >
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-on-surface truncate">
                          <Show when={match.court}>
                            <span class="text-on-surface-muted">Ct {match.court}: </span>
                          </Show>
                          {match.team1Name} vs {match.team2Name}
                        </span>
                      </div>
                      <div class="mt-0.5">
                        <span class="text-xs font-semibold text-yellow-400">UPCOMING</span>
                        <Show when={match.scheduledTime}>
                          <span class="text-xs text-on-surface-muted ml-2">{match.scheduledTime}</span>
                        </Show>
                      </div>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </>
        }>
          <div data-testid="live-now-header" class="flex items-center gap-2 mb-3 animate-[fadeIn_300ms_ease-out] motion-reduce:animate-none">
            <span
              data-testid="live-dot"
              class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"
              aria-hidden="true"
            />
            <h2 id="live-now-heading" class="text-sm font-bold uppercase tracking-wide text-on-surface">
              LIVE NOW
            </h2>
          </div>

          {/* sr-only announcer for live updates */}
          <div class="sr-only" aria-live="polite" data-testid="live-now-announcer" />

          <ul class="space-y-2">
            <For each={visibleMatches()}>
              {(match) => (
                <LiveMatchCard
                  matchId={match.matchId}
                  team1Name={match.team1Name}
                  team2Name={match.team2Name}
                  court={match.court}
                  status={match.status}
                  tournamentCode={props.tournamentCode}
                />
              )}
            </For>
          </ul>

          <Show when={overflowCount() > 0}>
            <div class="mt-2 text-center">
              <button
                type="button"
                class="text-xs text-primary hover:text-primary-light transition-colors"
                onClick={() => setExpanded((prev) => !prev)}
              >
                {expanded()
                  ? 'Show fewer'
                  : `+${overflowCount()} more live`}
              </button>
            </div>
          </Show>
        </Show>
      </section>
    </Show>
  );
};

export default LiveNowSection;
