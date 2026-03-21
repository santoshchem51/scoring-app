import { createSignal, createResource, createMemo, Show, Suspense } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams, A } from '@solidjs/router';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { useLiveMatch } from './hooks/useLiveMatch';
import { useScoreEventStream } from './hooks/useScoreEventStream';
import { useSpectatorProjection } from './hooks/useSpectatorProjection';
import { extractLiveScore, extractGameCount } from './engine/scoreExtraction';
import SpectatorScoreboard from './components/SpectatorScoreboard';
import PlayByPlayFeed from './components/PlayByPlayFeed';
import MatchAnalytics from './components/MatchAnalytics';
import { SegmentedControl } from '../../shared/components/SegmentedControl';
import SpectatorFooter from '../../shared/components/SpectatorFooter';
import { trackFeatureUsed } from '../../shared/observability/analytics';

const TABS = [
  { id: 'play-by-play', label: 'Play-by-Play' },
  { id: 'stats', label: 'Stats' },
] as const;

const PublicMatchPage: Component = () => {
  trackFeatureUsed('spectator_view');
  const params = useParams();
  const [activeTab, setActiveTab] = createSignal<'play-by-play' | 'stats'>('play-by-play');

  // Step 1: Resolve share code → tournament (one-shot)
  const [tournament] = createResource(
    () => params.code,
    (code) => firestoreTournamentRepository.getByShareCode(code),
  );

  // Step 2: Live match subscription
  const liveMatch = useLiveMatch(() => params.matchId);

  // Step 3: Score event stream for play-by-play
  const eventStream = useScoreEventStream(() => params.matchId);

  // Step 4: Spectator projection for sanitized team names
  const spectator = useSpectatorProjection(() => params.matchId);

  // Derived: team names — prefer spectator projection (sanitized), fall back to match doc
  const team1Name = createMemo(() => spectator.projection()?.publicTeam1Name ?? liveMatch.match()?.team1Name ?? 'Team 1');
  const team2Name = createMemo(() => spectator.projection()?.publicTeam2Name ?? liveMatch.match()?.team2Name ?? 'Team 2');

  // Derived: validate match belongs to this tournament
  const mismatch = createMemo(() => {
    const t = tournament();
    const m = liveMatch.match();
    if (!t || !m) return false;
    return m.tournamentId !== t.id;
  });

  // Derived: extract scores
  const liveScore = createMemo(() => extractLiveScore(liveMatch.match()));
  const gameCount = createMemo(() => extractGameCount(liveMatch.match()));

  // Derived: current game number
  const gameNumber = createMemo(() => {
    const m = liveMatch.match();
    if (!m) return 1;
    return m.games.length + (m.status === 'in-progress' ? 1 : 0);
  });

  return (
    <div class="flex flex-col" style={{ height: '100dvh' }}>
      {/* Nav bar */}
      <nav class="flex items-center gap-2 px-4 py-3 bg-surface-light border-b border-surface-light/50">
        <A href={'/t/' + params.code} class="text-primary font-medium text-sm hover:underline">
          &larr; Back to Tournament
        </A>
        <Show when={tournament()}>
          <span class="text-on-surface-muted text-sm">
            &middot; {tournament()!.name}
          </span>
        </Show>
      </nav>

      {/* Loading state */}
      <Show when={!tournament.loading && !liveMatch.loading()} fallback={
        <div class="flex-1 p-4">
          <SpectatorScoreboard
            team1Name="..."
            team2Name="..."
            team1Score={0}
            team2Score={0}
            team1Wins={0}
            team2Wins={0}
            gameNumber={1}
            status="in-progress"
            loading={true}
          />
        </div>
      }>
        {/* Error: tournament not found */}
        <Show when={tournament()} fallback={
          <div class="flex-1 flex flex-col items-center justify-center gap-4 p-4">
            <p class="text-xl font-bold text-on-surface">Tournament not found</p>
            <p class="text-on-surface-muted">This share link may be invalid or expired.</p>
            <A href="/" class="px-6 py-3 bg-primary text-surface font-semibold rounded-xl">
              Back to Home
            </A>
          </div>
        }>
          {/* Error: match revoked */}
          <Show when={spectator.projection()?.status !== 'revoked'} fallback={
            <div class="text-center p-8 text-on-surface-muted">
              <p class="text-lg font-semibold">Match No Longer Public</p>
              <p class="text-sm mt-2">The organizer has made this match private.</p>
            </div>
          }>
          {/* Error: match-tournament mismatch */}
          <Show when={!mismatch()} fallback={
            <div class="flex-1 flex flex-col items-center justify-center gap-4 p-4">
              <p class="text-xl font-bold text-on-surface">Match not found in this tournament</p>
              <A href={'/t/' + params.code} class="px-6 py-3 bg-primary text-surface font-semibold rounded-xl">
                Back to Tournament
              </A>
            </div>
          }>
            {/* Scoreboard */}
            <div class="flex-none p-4 pb-0">
              <SpectatorScoreboard
                team1Name={team1Name()}
                team2Name={team2Name()}
                team1Score={liveScore().team1Score}
                team2Score={liveScore().team2Score}
                team1Wins={gameCount().team1Wins}
                team2Wins={gameCount().team2Wins}
                gameNumber={gameNumber()}
                status={liveMatch.match()?.status ?? 'in-progress'}
                isDoubles={liveMatch.match()?.config.gameType === 'doubles'}
              />
            </div>

            {/* Segmented Control */}
            <div class="flex-none px-4 py-3">
              <SegmentedControl
                segments={[...TABS]}
                activeId={activeTab()}
                onSelect={(id) => setActiveTab(id as 'play-by-play' | 'stats')}
                ariaLabel="Match view"
              />
            </div>

            {/* Tab content */}
            <div
              role="tabpanel"
              id={`panel-${activeTab()}`}
              aria-labelledby={`tab-${activeTab()}`}
              class="flex-1 overflow-y-auto px-4 pb-4"
              style={{ 'min-height': '0' }}
            >
              <Show when={activeTab() === 'play-by-play'} fallback={
                <MatchAnalytics
                  events={eventStream.events()}
                  team1Name={team1Name()}
                  team2Name={team2Name()}
                />
              }>
                <PlayByPlayFeed
                  events={eventStream.events()}
                  team1Name={team1Name()}
                  team2Name={team2Name()}
                />
              </Show>
            </div>

            <SpectatorFooter />
          </Show>
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export default PublicMatchPage;
