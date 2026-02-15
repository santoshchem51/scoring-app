import { createResource, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { firestoreTeamRepository } from '../../data/firebase/firestoreTeamRepository';
import { firestoreRegistrationRepository } from '../../data/firebase/firestoreRegistrationRepository';
import type { TournamentStatus } from '../../data/types';
import { statusLabels, formatLabels } from './constants';

const TournamentDashboardPage: Component = () => {
  const params = useParams();
  const { user } = useAuth();

  const [tournament, { refetch: refetchTournament }] = createResource(
    () => params.id,
    (id) => firestoreTournamentRepository.getById(id),
  );

  const [teams] = createResource(() => params.id, (id) => firestoreTeamRepository.getByTournament(id));
  const [registrations] = createResource(() => params.id, (id) => firestoreRegistrationRepository.getByTournament(id));

  const isOrganizer = () => {
    const t = tournament();
    const u = user();
    return t && u && t.organizerId === u.uid;
  };

  const handleStatusAdvance = async () => {
    const t = tournament();
    if (!t) return;
    const nextStatus: Record<string, TournamentStatus> = {
      setup: 'registration', registration: 'pool-play', 'pool-play': 'bracket', bracket: 'completed',
    };
    const next = nextStatus[t.status];
    if (!next) return;
    await firestoreTournamentRepository.updateStatus(t.id, next);
    refetchTournament();
  };

  return (
    <PageLayout title={tournament()?.name ?? 'Tournament'}>
      <div class="p-4 space-y-6">
        <Show when={tournament()} fallback={<p class="text-on-surface-muted">Loading...</p>}>
          {(t) => (
            <>
              <div class="bg-surface-light rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div class="text-xs text-on-surface-muted uppercase tracking-wider">Status</div>
                  <div class="font-bold text-on-surface text-lg">{statusLabels[t().status] ?? t().status}</div>
                </div>
                <Show when={isOrganizer() && t().status !== 'completed' && t().status !== 'cancelled'}>
                  <button type="button" onClick={handleStatusAdvance}
                    class="bg-primary text-surface text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition-transform">
                    Advance
                  </button>
                </Show>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="bg-surface-light rounded-xl p-4">
                  <div class="text-xs text-on-surface-muted uppercase tracking-wider">Date</div>
                  <div class="font-semibold text-on-surface">
                    {new Date(t().date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div class="bg-surface-light rounded-xl p-4">
                  <div class="text-xs text-on-surface-muted uppercase tracking-wider">Location</div>
                  <div class="font-semibold text-on-surface">{t().location || 'TBD'}</div>
                </div>
                <div class="bg-surface-light rounded-xl p-4">
                  <div class="text-xs text-on-surface-muted uppercase tracking-wider">Format</div>
                  <div class="font-semibold text-on-surface">{formatLabels[t().format] ?? t().format}</div>
                </div>
                <div class="bg-surface-light rounded-xl p-4">
                  <div class="text-xs text-on-surface-muted uppercase tracking-wider">Teams</div>
                  <div class="font-semibold text-on-surface">
                    {teams()?.length ?? 0}{t().maxPlayers ? ` / ${t().maxPlayers}` : ''}
                  </div>
                </div>
              </div>

              <div class="bg-surface-light rounded-xl p-4">
                <div class="text-xs text-on-surface-muted uppercase tracking-wider mb-2">Registrations</div>
                <div class="font-semibold text-on-surface text-2xl">{registrations()?.length ?? 0}</div>
              </div>
            </>
          )}
        </Show>
      </div>
    </PageLayout>
  );
};

export default TournamentDashboardPage;
