import { createResource, createMemo, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { firestoreTeamRepository } from '../../data/firebase/firestoreTeamRepository';
import { firestorePoolRepository } from '../../data/firebase/firestorePoolRepository';
import { firestoreBracketRepository } from '../../data/firebase/firestoreBracketRepository';
import PoolTable from './components/PoolTable';
import BracketView from './components/BracketView';
import TournamentResults from './components/TournamentResults';
import { statusLabels, statusColors, formatLabels } from './constants';

const PublicTournamentPage: Component = () => {
  const params = useParams();

  // --- Data Fetching ---

  const [tournament] = createResource(
    () => params.code,
    (code) => firestoreTournamentRepository.getByShareCode(code),
  );

  const [teams] = createResource(
    () => tournament()?.id ?? null,
    (id) => {
      if (!id) return Promise.resolve([]);
      return firestoreTeamRepository.getByTournament(id);
    },
  );

  // Pools: only fetch when status is pool-play or later and format uses pools
  const [pools] = createResource(
    () => {
      const t = tournament();
      if (!t) return null;
      const hasPoolPlay = t.format === 'round-robin' || t.format === 'pool-bracket';
      const pastRegistration = ['pool-play', 'bracket', 'completed'].includes(t.status);
      if (hasPoolPlay && pastRegistration) return t.id;
      return null;
    },
    (id) => {
      if (!id) return Promise.resolve([]);
      return firestorePoolRepository.getByTournament(id);
    },
  );

  // Bracket: only fetch when status is bracket or later and format uses bracket
  const [bracketSlots] = createResource(
    () => {
      const t = tournament();
      if (!t) return null;
      const hasBracket = t.format === 'single-elimination' || t.format === 'pool-bracket';
      const inBracketPhase = ['bracket', 'completed'].includes(t.status);
      if (hasBracket && inBracketPhase) return t.id;
      return null;
    },
    (id) => {
      if (!id) return Promise.resolve([]);
      return firestoreBracketRepository.getByTournament(id);
    },
  );

  // --- Derived State ---

  const teamNames = createMemo<Record<string, string>>(() => {
    const t = teams();
    if (!t) return {};
    const map: Record<string, string> = {};
    for (const team of t) {
      map[team.id] = team.name;
    }
    return map;
  });

  const showPoolTables = createMemo(() => {
    const t = tournament();
    if (!t) return false;
    const inPhase = ['pool-play', 'bracket', 'completed'].includes(t.status);
    const hasPoolFormat = t.format === 'round-robin' || t.format === 'pool-bracket';
    return inPhase && hasPoolFormat;
  });

  const showBracketView = createMemo(() => {
    const t = tournament();
    if (!t) return false;
    const inPhase = ['bracket', 'completed'].includes(t.status);
    const hasBracketFormat = t.format === 'single-elimination' || t.format === 'pool-bracket';
    return inPhase && hasBracketFormat;
  });

  // --- Render ---

  return (
    <PageLayout title={tournament()?.name ?? 'Tournament'}>
      <div class="p-4 space-y-6">
        {/* Loading state */}
        <Show when={!tournament.loading} fallback={
          <div class="flex items-center justify-center min-h-[40vh]">
            <p class="text-on-surface-muted">Loading tournament...</p>
          </div>
        }>
          {/* Not found state */}
          <Show when={tournament()} fallback={
            <div class="flex flex-col items-center justify-center min-h-[40vh] gap-4">
              <p class="text-2xl font-bold text-on-surface">Tournament Not Found</p>
              <p class="text-on-surface-muted">This share link may be invalid or the tournament is no longer public.</p>
              <a href="/" class="inline-block px-6 py-3 bg-primary text-surface font-semibold rounded-xl active:scale-95 transition-transform">
                Back to Home
              </a>
            </div>
          }>
            {(t) => (
              <>
                {/* Status Card */}
                <div class="bg-surface-light rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div class="text-xs text-on-surface-muted uppercase tracking-wider">Status</div>
                    <span class={`inline-block mt-1 text-sm font-bold px-3 py-1 rounded-full ${statusColors[t().status] ?? ''}`}>
                      {statusLabels[t().status] ?? t().status}
                    </span>
                  </div>
                </div>

                {/* Info Grid */}
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

                {/* Registration Open Info Card */}
                <Show when={t().status === 'registration'}>
                  <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-center">
                    <p class="text-blue-400 font-semibold">Registration is Open</p>
                    <p class="text-blue-400/70 text-sm mt-1">Sign in to register for this tournament.</p>
                  </div>
                </Show>

                {/* Tournament Results (completed) */}
                <Show when={t().status === 'completed'}>
                  <TournamentResults
                    format={t().format}
                    poolStandings={pools()?.[0]?.standings}
                    bracketSlots={bracketSlots() ?? undefined}
                    teamNames={teamNames()}
                  />
                </Show>

                {/* Pool Tables (read-only — no onScoreMatch/onEditMatch) */}
                <Show when={showPoolTables() && (pools()?.length ?? 0) > 0}>
                  <div class="space-y-4">
                    <h2 class="font-bold text-on-surface text-lg">Pool Standings</h2>
                    <For each={pools()}>
                      {(pool) => (
                        <PoolTable
                          poolId={pool.id}
                          poolName={pool.name}
                          standings={pool.standings}
                          teamNames={teamNames()}
                          advancingCount={t().config.teamsPerPoolAdvancing ?? 2}
                          schedule={pool.schedule}
                        />
                      )}
                    </For>
                  </div>
                </Show>

                {/* Bracket View (read-only — no onScoreMatch/onEditMatch) */}
                <Show when={showBracketView() && (bracketSlots()?.length ?? 0) > 0}>
                  <div class="space-y-4">
                    <h2 class="font-bold text-on-surface text-lg">Bracket</h2>
                    <BracketView
                      slots={bracketSlots()!}
                      teamNames={teamNames()}
                    />
                  </div>
                </Show>
              </>
            )}
          </Show>
        </Show>
      </div>
    </PageLayout>
  );
};

export default PublicTournamentPage;
