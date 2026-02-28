import { createResource, createMemo, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { useTournamentLive } from './hooks/useTournamentLive';
import PoolTable from './components/PoolTable';
import BracketView from './components/BracketView';
import TournamentResults from './components/TournamentResults';
import { statusLabels, statusColors, formatLabels } from './constants';
import { InteractiveBackground } from '../../shared/canvas';

const PublicTournamentPage: Component = () => {
  const params = useParams();

  // Step 1: Resolve share code to tournament ID (one-shot)
  const [resolved] = createResource(
    () => params.code,
    (code) => firestoreTournamentRepository.getByShareCode(code),
  );

  // Step 2: Subscribe to live updates once we have the tournament ID
  const live = useTournamentLive(() => resolved()?.id);

  // Use live data if available, fall back to resolved data during initial load
  const tournament = () => live.tournament() ?? resolved();

  // --- Derived State ---

  const teamNames = createMemo<Record<string, string>>(() => {
    const t = live.teams();
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
      <div class="relative">
        <InteractiveBackground mode="static" waveCount={6} waveOpacity={0.1} />
        <div class="relative z-10 p-4 space-y-6">
        {/* Loading state */}
        <Show when={!resolved.loading} fallback={
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
                      {live.teams().length}{t().maxPlayers ? ` / ${t().maxPlayers}` : ''}
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
                    poolStandings={live.pools()[0]?.standings}
                    bracketSlots={live.bracket().length > 0 ? live.bracket() : undefined}
                    teamNames={teamNames()}
                  />
                </Show>

                {/* Pool Tables (read-only — no onScoreMatch/onEditMatch) */}
                <Show when={showPoolTables() && live.pools().length > 0}>
                  <div class="space-y-4">
                    <h2 class="font-bold text-on-surface text-lg">Pool Standings</h2>
                    <For each={live.pools()}>
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
                <Show when={showBracketView() && live.bracket().length > 0}>
                  <div class="space-y-4">
                    <h2 class="font-bold text-on-surface text-lg">Bracket</h2>
                    <BracketView
                      slots={live.bracket()}
                      teamNames={teamNames()}
                    />
                  </div>
                </Show>
              </>
            )}
          </Show>
        </Show>
        </div>
      </div>
    </PageLayout>
  );
};

export default PublicTournamentPage;
