import { createResource, For, Show, Switch, Match } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { AlertTriangle, Sparkles } from 'lucide-solid';
import PageLayout from '../../shared/components/PageLayout';
import EmptyState from '../../shared/components/EmptyState';
import TournamentCard from './components/TournamentCard';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import InvitationInbox from './components/InvitationInbox';

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
        <Show when={user()}>
          {(u) => <InvitationInbox userId={u().uid} />}
        </Show>
        <Switch>
          <Match when={tournaments.loading}>
            <div class="flex flex-col items-center justify-center py-16 gap-3">
              <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p class="text-sm text-on-surface-muted">Loading tournaments...</p>
            </div>
          </Match>
          <Match when={tournaments.error}>
            <div class="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <AlertTriangle size={40} class="text-red-400" />
              <p class="text-sm text-red-400 font-semibold">Failed to load tournaments</p>
              <p class="text-xs text-on-surface-muted max-w-xs break-all">
                {(() => {
                  const msg = tournaments.error?.message || 'Please check your connection and try again.';
                  const urlMatch = msg.match(/(https:\/\/\S+)/);
                  if (urlMatch) {
                    const before = msg.slice(0, urlMatch.index);
                    const url = urlMatch[1];
                    const after = msg.slice((urlMatch.index || 0) + url.length);
                    return <>{before}<a href={url} target="_blank" rel="noopener noreferrer" class="text-primary underline break-all">{url}</a>{after}</>;
                  }
                  return msg;
                })()}
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
              icon={<Sparkles size={32} />}
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
