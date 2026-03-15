import { createResource, createMemo, createSignal, createEffect, on, onCleanup, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import type { LiveNowMatch } from './components/LiveNowSection';
import { useParams } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { useTournamentLive } from './hooks/useTournamentLive';
import PoolTable from './components/PoolTable';
import BracketView from './components/BracketView';
import TournamentResults from './components/TournamentResults';
import LiveNowSection from './components/LiveNowSection';
import TournamentPhaseIndicator from './components/TournamentPhaseIndicator';
import { statusLabels, statusColors, formatLabels } from './constants';
import { InteractiveBackground } from '../../shared/canvas';
import { getInProgressMatches } from './engine/matchFiltering';
import SpectatorFooter from '../../shared/components/SpectatorFooter';

const PublicTournamentPage: Component = () => {
  const params = useParams();

  // Step 1: Resolve share code to tournament ID (one-shot)
  const [resolved] = createResource(
    () => params.code,
    (code) => firestoreTournamentRepository.getByShareCode(code),
  );

  // Step 2: Subscribe to live updates once we have the tournament ID
  const live = useTournamentLive(() => resolved()?.id, { skipRegistrations: true });

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

  const inProgressMatches = createMemo(() => {
    const { startedPoolMatches, bracketMatches } = getInProgressMatches(live.pools(), live.bracket());
    const names = teamNames();

    // Convert to LiveNowMatch format
    const matches = [
      ...startedPoolMatches.map((m) => ({
        matchId: m.matchId,
        team1Name: names[m.team1Id] ?? m.team1Id,
        team2Name: names[m.team2Id] ?? m.team2Id,
        court: m.court ?? undefined,
        status: 'in-progress' as const,
      })),
      ...bracketMatches.map((s) => ({
        matchId: s.matchId,
        team1Name: names[s.team1Id ?? ''] ?? 'TBD',
        team2Name: names[s.team2Id ?? ''] ?? 'TBD',
        court: undefined,
        status: 'in-progress' as const,
      })),
    ];
    return matches;
  });

  // Track recently completed matches for 5-minute retention
  const RETENTION_MS = 5 * 60 * 1000;
  const [retainedMatches, setRetainedMatches] = createSignal<Map<string, { match: LiveNowMatch; completedAt: number }>>(new Map());

  createEffect(on(inProgressMatches, (current, prev) => {
    if (!prev) return; // first run, no previous value
    const currentIds = new Set(current.map(m => m.matchId));
    for (const match of prev) {
      if (!currentIds.has(match.matchId)) {
        setRetainedMatches(p => {
          const next = new Map(p);
          next.set(match.matchId, { match: { ...match, status: 'completed' as const }, completedAt: Date.now() });
          return next;
        });
      }
    }
  }));

  // Prune stale retained matches every 30s
  let isMounted = true;

  const pruneInterval = setInterval(() => {
    if (!isMounted) return;
    const now = Date.now();
    const current = retainedMatches();
    let hasStale = false;
    for (const [, entry] of current) {
      if (now - entry.completedAt > RETENTION_MS) { hasStale = true; break; }
    }
    if (!hasStale) return;
    setRetainedMatches(prev => {
      const next = new Map(prev);
      for (const [id, entry] of next) {
        if (now - entry.completedAt > RETENTION_MS) next.delete(id);
      }
      return next;
    });
  }, 30_000);

  onCleanup(() => {
    isMounted = false;
    clearInterval(pruneInterval);
  });

  // Merge live + retained for LiveNowSection
  const allVisibleMatches = createMemo(() => {
    const liveMatches = inProgressMatches();
    const retained = Array.from(retainedMatches().values()).map(r => r.match);
    return [...liveMatches, ...retained];
  });

  const upcomingMatches = createMemo(() => {
    const names = teamNames();
    const upcoming = live.pools().flatMap((pool) =>
      pool.schedule
        .filter((entry) => entry.matchId == null)
        .slice(0, 3)
        .map((entry) => ({
          team1Name: names[entry.team1Id] ?? entry.team1Id,
          team2Name: names[entry.team2Id] ?? entry.team2Id,
          court: entry.court ?? undefined,
        }))
    );
    return upcoming.slice(0, 3);
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

                {/* Tournament Phase Indicator */}
                <Show when={['pool-play', 'bracket', 'completed'].includes(t().status)}>
                  <TournamentPhaseIndicator
                    status={t().status}
                    liveMatchCount={inProgressMatches().length}
                  />
                </Show>

                {/* Live Now Section */}
                <LiveNowSection
                  matches={allVisibleMatches()}
                  tournamentCode={params.code}
                  upcomingMatches={upcomingMatches()}
                />

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

                <SpectatorFooter />
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
