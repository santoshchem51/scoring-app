import { createResource, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import EmptyState from '../../shared/components/EmptyState';
import TournamentCard from './components/TournamentCard';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';

const TournamentListPage: Component = () => {
  const { user } = useAuth();

  const [tournaments] = createResource(
    () => user()?.uid,
    async (uid) => {
      if (!uid) return [];
      return firestoreTournamentRepository.getByOrganizer(uid);
    },
  );

  return (
    <PageLayout title="Tournaments">
      <div class="p-4">
        <Show
          when={tournaments() && tournaments()!.length > 0}
          fallback={
            <EmptyState
              icon={
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              }
              title="No Tournaments"
              description="Create your first tournament and start organizing games."
              actionLabel="Create Tournament"
              actionHref="/tournaments/new"
            />
          }
        >
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider">Your Tournaments</h2>
            <A
              href="/tournaments/new"
              class="bg-primary text-surface text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition-transform"
            >
              + New
            </A>
          </div>
          <ul role="list" class="space-y-3 list-none p-0 m-0">
            <For each={tournaments()}>
              {(t) => <li><TournamentCard tournament={t} /></li>}
            </For>
          </ul>
        </Show>
      </div>
    </PageLayout>
  );
};

export default TournamentListPage;
