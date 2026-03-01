import { createSignal, createResource, Show } from 'solid-js';
import type { Component } from 'solid-js';
import PageLayout from '../../shared/components/PageLayout';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { firestoreInvitationRepository } from '../../data/firebase/firestoreInvitationRepository';
import BrowseTab from './components/BrowseTab';
import MyTournamentsTab from './components/MyTournamentsTab';

type TabId = 'browse' | 'my';

const DiscoverPage: Component = () => {
  const { user } = useAuth();

  // Resolve smart default tab based on user state
  const [smartDefault] = createResource(
    () => user()?.uid,
    async (uid) => {
      if (!uid) return 'browse' as TabId;

      // Check pending invitations first
      const pending = await firestoreInvitationRepository.getPendingForUser(uid);
      if (pending.length > 0) return 'my' as TabId;

      // Check if user has any tournaments (any role)
      const [organized, participantResult, scorekeeping] = await Promise.all([
        firestoreTournamentRepository.getByOrganizer(uid),
        firestoreTournamentRepository.getByParticipant(uid),
        firestoreTournamentRepository.getByScorekeeper(uid),
      ]);

      if (organized.length > 0 || participantResult.tournamentIds.length > 0 || scorekeeping.length > 0) {
        return 'my' as TabId;
      }

      return 'browse' as TabId;
    },
  );

  const [tabOverride, setTabOverride] = createSignal<TabId | null>(null);

  const activeTab = (): TabId => {
    const override = tabOverride();
    if (override) return override;

    // While loading smart default, show browse for logged-in users
    if (user() && smartDefault.loading) return 'browse';

    return smartDefault() ?? 'browse';
  };

  const tabClass = (tab: TabId) => {
    const base = 'flex-1 px-4 py-2 text-sm rounded-lg transition-colors';
    if (activeTab() === tab) {
      return `${base} bg-primary/10 text-primary font-semibold`;
    }
    return `${base} text-on-surface-muted`;
  };

  return (
    <PageLayout title="Tournaments">
      <div class="p-4">
        {/* Tab switcher — only for logged-in users */}
        <Show when={user()}>
          <div role="tablist" class="flex gap-1 bg-surface-lighter rounded-xl p-1 mb-4">
            <button
              role="tab"
              aria-selected={activeTab() === 'browse'}
              aria-label="Browse"
              class={tabClass('browse')}
              onClick={() => setTabOverride('browse')}
            >
              Browse
            </button>
            <button
              role="tab"
              aria-selected={activeTab() === 'my'}
              aria-label="My Tournaments"
              class={tabClass('my')}
              onClick={() => setTabOverride('my')}
            >
              My Tournaments
            </button>
          </div>
        </Show>

        {/* Tab content */}
        <Show when={activeTab() === 'browse'}>
          <BrowseTab />
        </Show>
        <Show when={activeTab() === 'my' && user()}>
          {(u) => <MyTournamentsTab userId={u().uid} />}
        </Show>
      </div>
    </PageLayout>
  );
};

export default DiscoverPage;
