import { Show, For } from 'solid-js';
import type { Component, JSX } from 'solid-js';

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

  const visibleMatches = () => props.matches.slice(0, MAX_VISIBLE);
  const overflowCount = () => props.matches.length - MAX_VISIBLE;
  const visibleUpcoming = () => (props.upcomingMatches ?? []).slice(0, MAX_VISIBLE);

  const buildAriaLabel = (match: LiveNowMatch): string => {
    const courtPart = match.court ? `Court ${match.court}: ` : '';
    const statusPart = match.status === 'in-progress' ? 'live' : 'final';
    return `${courtPart}${match.team1Name} versus ${match.team2Name}, ${statusPart}`;
  };

  return (
    <Show when={showSection()}>
      <section aria-labelledby="live-now-heading">
        <Show when={hasLive()} fallback={
          <>
            <div data-testid="live-now-header" class="flex items-center gap-2 mb-3">
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
                      class="block rounded-lg border border-surface-lighter bg-surface-light px-3 py-2"
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
          <div data-testid="live-now-header" class="flex items-center gap-2 mb-3">
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
                <li>
                  <a
                    href={`/t/${props.tournamentCode}/match/${match.matchId}`}
                    aria-label={buildAriaLabel(match)}
                    class="block rounded-lg border border-surface-lighter bg-surface-light px-3 py-2 hover:bg-surface-lighter focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary transition-colors"
                  >
                    <div class="flex items-center justify-between" aria-hidden="true">
                      <span class="text-sm text-on-surface truncate">
                        <Show when={match.court}>
                          <span class="text-on-surface-muted">Ct {match.court}: </span>
                        </Show>
                        {match.team1Name} vs {match.team2Name}
                      </span>
                      <span class="text-on-surface-muted ml-2" aria-hidden="true">&rarr;</span>
                    </div>
                    <div aria-hidden="true" class="mt-0.5">
                      <Show when={match.status === 'in-progress'}>
                        <span class="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
                          <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          LIVE
                        </span>
                      </Show>
                      <Show when={match.status === 'completed'}>
                        <span class="text-xs font-semibold text-green-400">FINAL</span>
                      </Show>
                    </div>
                  </a>
                </li>
              )}
            </For>
          </ul>

          <Show when={overflowCount() > 0}>
            <div class="mt-2 text-center">
              <span class="text-xs text-on-surface-muted">
                {overflowCount()} more live &rarr;
              </span>
            </div>
          </Show>
        </Show>
      </section>
    </Show>
  );
};

export default LiveNowSection;
