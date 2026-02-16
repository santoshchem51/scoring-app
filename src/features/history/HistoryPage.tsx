import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import MatchCard from './components/MatchCard';
import EmptyState from '../../shared/components/EmptyState';
import { Clock } from 'lucide-solid';
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
              icon={<Clock size={32} />}
              title="No Matches Yet"
              description="Start your first game and your match history will appear here."
              actionLabel="Start a Game"
              actionHref="/new"
            />
          }
        >
          <ul role="list" class="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0 list-none p-0 m-0">
            <For each={matches()}>
              {(match) => <li><MatchCard match={match} /></li>}
            </For>
          </ul>
        </Show>
      </div>
    </PageLayout>
  );
};

export default HistoryPage;
