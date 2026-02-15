import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import MatchCard from './components/MatchCard';
import EmptyState from '../../shared/components/EmptyState';
import { useLiveQuery } from '../../data/useLiveQuery';
import { matchRepository } from '../../data/repositories/matchRepository';

const HistoryPage: Component = () => {
  const { data: matches } = useLiveQuery(() => matchRepository.getCompleted());

  return (
    <PageLayout title="Match History">
      <div class="p-4 space-y-3">
        <Show
          when={matches() && matches()!.length > 0}
          fallback={
            <EmptyState
              icon={
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="No Matches Yet"
              description="Start your first game and your match history will appear here."
              actionLabel="Start a Game"
              actionHref="/"
            />
          }
        >
          <div class="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
            <For each={matches()}>
              {(match) => <MatchCard match={match} />}
            </For>
          </div>
        </Show>
      </div>
    </PageLayout>
  );
};

export default HistoryPage;
