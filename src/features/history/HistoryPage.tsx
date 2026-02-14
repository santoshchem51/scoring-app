import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import MatchCard from './components/MatchCard';
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
            <div class="text-center text-on-surface-muted py-12">
              <p class="text-lg">No matches yet</p>
              <p class="text-sm mt-1">Start a game to see history here</p>
            </div>
          }
        >
          <For each={matches()}>
            {(match) => <MatchCard match={match} />}
          </For>
        </Show>
      </div>
    </PageLayout>
  );
};

export default HistoryPage;
