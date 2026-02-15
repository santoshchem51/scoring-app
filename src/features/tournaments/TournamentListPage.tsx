import { createResource, For, Show, Switch, Match } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import EmptyState from '../../shared/components/EmptyState';
import TournamentCard from './components/TournamentCard';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';

const TournamentListPage: Component = () => {
  const { user } = useAuth();

  const [tournaments, { refetch }] = createResource(
    () => user()?.uid,
    async (uid) => {
      if (!uid) return [];
      return firestoreTournamentRepository.getByOrganizer(uid);
    },
  );

  return (
    <PageLayout title="Tournaments">
      <div class="p-4">
        <Switch>
          <Match when={tournaments.loading}>
            <div class="flex flex-col items-center justify-center py-16 gap-3">
              <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p class="text-sm text-on-surface-muted">Loading tournaments...</p>
            </div>
          </Match>
          <Match when={tournaments.error}>
            <div class="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p class="text-sm text-red-400 font-semibold">Failed to load tournaments</p>
              <p class="text-xs text-on-surface-muted max-w-xs">
                {tournaments.error?.message?.includes('index')
                  ? 'A Firestore index is required. Check the browser console for the link to create it.'
                  : 'Please check your connection and try again.'}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                class="mt-2 px-4 py-2 bg-primary text-surface text-sm font-semibold rounded-lg active:scale-95 transition-transform"
              >
                Retry
              </button>
            </div>
          </Match>
          <Match when={tournaments() && tournaments()!.length === 0}>
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
          </Match>
          <Match when={tournaments() && tournaments()!.length > 0}>
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
          </Match>
        </Switch>
      </div>
    </PageLayout>
  );
};

export default TournamentListPage;
