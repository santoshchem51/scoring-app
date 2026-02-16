import { createSignal, createResource, createMemo, Show, For } from 'solid-js';
import type { Component } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import { firestoreTeamRepository } from '../../data/firebase/firestoreTeamRepository';
import { firestoreRegistrationRepository } from '../../data/firebase/firestoreRegistrationRepository';
import { firestorePoolRepository } from '../../data/firebase/firestorePoolRepository';
import { firestoreBracketRepository } from '../../data/firebase/firestoreBracketRepository';
import { generatePools } from './engine/poolGenerator';
import { generateRoundRobinSchedule } from './engine/roundRobin';
import { calculateStandings } from './engine/standings';
import { validatePoolCompletion, validateBracketCompletion } from './engine/completionValidation';
import { seedBracketFromPools } from './engine/bracketSeeding';
import { generateBracket } from './engine/bracketGenerator';
import { createTeamsFromRegistrations } from './engine/teamFormation';
import PoolTable from './components/PoolTable';
import BracketView from './components/BracketView';
import RegistrationForm from './components/RegistrationForm';
import FeeTracker from './components/FeeTracker';
import TournamentResults from './components/TournamentResults';
import OrganizerControls from './components/OrganizerControls';
import OrganizerPlayerManager from './components/OrganizerPlayerManager';
import OrganizerPairingPanel from './components/OrganizerPairingPanel';
import { statusLabels, statusColors, formatLabels } from './constants';
import { matchRepository } from '../../data/repositories/matchRepository';
import type { TournamentStatus, TournamentFormat, TournamentPool, PoolStanding, Match } from '../../data/types';
import ScoreEditModal from './components/ScoreEditModal';
import type { ScoreEditData } from './components/ScoreEditModal';
import { checkBracketRescoreSafety } from './engine/rescoring';
import { advanceBracketWinner } from './engine/bracketAdvancement';
import { cloudSync } from '../../data/firebase/cloudSync';
import ShareTournamentModal from './components/ShareTournamentModal';
import { generateShareCode } from './engine/shareCode';
import { useTournamentLive } from './hooks/useTournamentLive';
import { detectViewerRole } from './engine/roleDetection';
import type { ViewerRole } from './engine/roleDetection';
import { getPlayerTeamId, getPlayerMatches, getPlayerStats } from './engine/playerStats';
import MyMatchesSection from './components/MyMatchesSection';
import MyStatsCard from './components/MyStatsCard';
import ScorekeeperMatchList from './components/ScorekeeperMatchList';

// Format-aware status transitions (no pool-play for single-elimination, no bracket for round-robin)
const statusTransitions: Record<TournamentFormat, Partial<Record<TournamentStatus, TournamentStatus>>> = {
  'round-robin': {
    setup: 'registration',
    registration: 'pool-play',
    'pool-play': 'completed',
  },
  'single-elimination': {
    setup: 'registration',
    registration: 'bracket',
    bracket: 'completed',
  },
  'pool-bracket': {
    setup: 'registration',
    registration: 'pool-play',
    'pool-play': 'bracket',
    bracket: 'completed',
  },
};

const TournamentDashboardPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [error, setError] = createSignal('');
  const [advancing, setAdvancing] = createSignal(false);
  const [editingMatch, setEditingMatch] = createSignal<Match | null>(null);
  const [editingContext, setEditingContext] = createSignal<{
    type: 'pool' | 'bracket';
    poolId?: string;
    slotId?: string;
    team1Id: string;
    team2Id: string;
  } | null>(null);
  const [editModalError, setEditModalError] = createSignal('');
  const [showShareModal, setShowShareModal] = createSignal(false);

  // --- Live Data (replaces createResource + refetch) ---
  const live = useTournamentLive(() => params.id);

  // Fetch user's existing registration for RegistrationForm
  const [existingRegistration, { refetch: refetchExistingReg }] = createResource(
    () => {
      const u = user();
      const id = params.id;
      if (!u || !id) return null;
      return { tournamentId: id, userId: u.uid };
    },
    (source) => {
      if (!source) return Promise.resolve(undefined);
      return firestoreRegistrationRepository.getByUser(source.tournamentId, source.userId);
    },
  );

  // --- Derived State ---

  const isOrganizer = () => {
    const t = live.tournament();
    const u = user();
    return !!t && !!u && t.organizerId === u.uid;
  };

  const teamNames = createMemo<Record<string, string>>(() => {
    const t = live.teams();
    const map: Record<string, string> = {};
    for (const team of t) {
      map[team.id] = team.name;
    }
    return map;
  });

  const role = createMemo<ViewerRole>(() => {
    const t = live.tournament();
    const u = user();
    if (!t) return 'spectator';
    return detectViewerRole(t, u?.uid ?? null, live.registrations());
  });

  const playerTeamId = createMemo(() => {
    const u = user();
    if (!u) return null;
    return getPlayerTeamId(u.uid, live.registrations(), live.teams());
  });

  const playerMatches = createMemo(() => {
    const tid = playerTeamId();
    if (!tid) return [];
    return getPlayerMatches(tid, live.pools(), live.bracket(), teamNames());
  });

  const playerStats = createMemo(() => {
    const tid = playerTeamId();
    if (!tid) return { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0 };
    return getPlayerStats(tid, live.pools(), live.bracket());
  });

  const playerTeamName = createMemo(() => {
    const tid = playerTeamId();
    if (!tid) return '';
    return teamNames()[tid] ?? '';
  });

  const userNames = createMemo<Record<string, string>>(() => {
    const regs = live.registrations();
    const map: Record<string, string> = {};
    for (const reg of regs) {
      map[reg.userId] = reg.playerName || `Player ${reg.userId.slice(0, 6)}`;
    }
    return map;
  });

  const nextStatus = createMemo<TournamentStatus | null>(() => {
    const t = live.tournament();
    if (!t) return null;
    const transitions = statusTransitions[t.format];
    if (!transitions) return null;
    return transitions[t.status] ?? null;
  });

  const nextStatusLabel = createMemo(() => {
    const next = nextStatus();
    if (!next) return '';
    return statusLabels[next] ?? next;
  });

  const showPoolTables = createMemo(() => {
    const t = live.tournament();
    if (!t) return false;
    const inPhase = ['pool-play', 'bracket', 'completed'].includes(t.status);
    const hasPoolFormat = t.format === 'round-robin' || t.format === 'pool-bracket';
    return inPhase && hasPoolFormat;
  });

  const showBracketView = createMemo(() => {
    const t = live.tournament();
    if (!t) return false;
    const inPhase = ['bracket', 'completed'].includes(t.status);
    const hasBracketFormat = t.format === 'single-elimination' || t.format === 'pool-bracket';
    return inPhase && hasBracketFormat;
  });

  // --- Status Advance with Side Effects ---

  const handleStatusAdvance = async () => {
    const t = live.tournament();
    const next = nextStatus();
    if (!t || !next || advancing()) return;

    setError('');
    setAdvancing(true);

    try {
      const currentStatus = t.status;
      const fmt = t.format;

      // Validate completion prerequisites before advancing to completed
      if (next === 'completed') {
        if (fmt === 'round-robin') {
          const currentPools = live.pools();
          const poolResult = validatePoolCompletion(currentPools);
          if (!poolResult.valid) {
            setError(poolResult.message ?? 'Not all pool matches are completed.');
            setAdvancing(false);
            return;
          }
        }

        if (fmt === 'single-elimination' || fmt === 'pool-bracket') {
          const currentSlots = live.bracket();
          const bracketResult = validateBracketCompletion(currentSlots);
          if (!bracketResult.valid) {
            setError(bracketResult.message ?? 'Bracket is not complete.');
            setAdvancing(false);
            return;
          }
        }
      }

      // registration -> pool-play or bracket: create teams first
      if (currentStatus === 'registration' && (next === 'pool-play' || next === 'bracket')) {
        const regs = live.registrations();
        if (regs.length < 2) {
          setError('At least 2 registrations are required.');
          setAdvancing(false);
          return;
        }

        // Create teams from registrations
        const mode = t.config.gameType === 'singles'
          ? 'singles' as const
          : (t.teamFormation ?? 'byop') as 'byop' | 'auto-pair';
        const { teams: newTeams, unmatched } = createTeamsFromRegistrations(regs, t.id, mode, userNames());

        if (newTeams.length < 2) {
          setError(`Only ${newTeams.length} team(s) could be formed. ${unmatched.length} player(s) unmatched. Need at least 2 teams.`);
          setAdvancing(false);
          return;
        }

        // Save teams to Firestore
        for (const team of newTeams) {
          await firestoreTeamRepository.save(team);
        }

        const teamIds = newTeams.map((tm) => tm.id);

        if (next === 'pool-play') {
          // Generate pools
          const poolCount = t.config.poolCount ?? (fmt === 'round-robin' ? 1 : 2);
          const poolAssignments = generatePools(teamIds, poolCount);

          for (let i = 0; i < poolAssignments.length; i++) {
            const poolTeamIds = poolAssignments[i];
            const schedule = generateRoundRobinSchedule(poolTeamIds);
            const pool: TournamentPool = {
              id: crypto.randomUUID(),
              tournamentId: t.id,
              name: `Pool ${String.fromCharCode(65 + i)}`,
              teamIds: poolTeamIds,
              schedule,
              standings: poolTeamIds.map((tid) => ({
                teamId: tid, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0,
              })),
            };
            await firestorePoolRepository.save(pool);
          }
        } else {
          // Generate bracket
          const slots = generateBracket(t.id, teamIds);
          for (const slot of slots) {
            await firestoreBracketRepository.save(slot);
          }
        }

        await firestoreTournamentRepository.updateStatus(t.id, next);
      }

      // pool-play -> bracket (for pool-bracket)
      else if (currentStatus === 'pool-play' && next === 'bracket' && fmt === 'pool-bracket') {
        const currentPools = live.pools();
        if (currentPools.length === 0) {
          setError('No pools found. Cannot advance to bracket.');
          setAdvancing(false);
          return;
        }

        const allPoolStandings: PoolStanding[][] = [];

        for (const pool of currentPools) {
          // Calculate standings using the pool's team IDs and any completed matches
          // For now, use the existing standings from the pool (updated during match play)
          const standings = calculateStandings(pool.teamIds, [], (m) => ({ team1: m.team1Name, team2: m.team2Name }));
          allPoolStandings.push(standings);
          await firestorePoolRepository.updateStandings(t.id, pool.id, standings);
        }

        const teamsPerPoolAdvancing = t.config.teamsPerPoolAdvancing ?? 2;
        const seededTeamIds = seedBracketFromPools(allPoolStandings, teamsPerPoolAdvancing);

        if (seededTeamIds.length < 2) {
          setError('Not enough teams to seed a bracket.');
          setAdvancing(false);
          return;
        }

        const slots = generateBracket(t.id, seededTeamIds);
        for (const slot of slots) {
          await firestoreBracketRepository.save(slot);
        }

        await firestoreTournamentRepository.updateStatus(t.id, next);
      }

      // pool-play -> completed (for round-robin)
      else if (currentStatus === 'pool-play' && next === 'completed' && fmt === 'round-robin') {
        const currentPools = live.pools();

        for (const pool of currentPools) {
          const standings = calculateStandings(pool.teamIds, [], (m) => ({ team1: m.team1Name, team2: m.team2Name }));
          await firestorePoolRepository.updateStandings(t.id, pool.id, standings);
        }

        await firestoreTournamentRepository.updateStatus(t.id, next);
      }

      // bracket -> completed
      else if (currentStatus === 'bracket' && next === 'completed') {
        await firestoreTournamentRepository.updateStatus(t.id, next);
      }

      // Generic fallback (e.g., setup -> registration)
      else {
        await firestoreTournamentRepository.updateStatus(t.id, next);
      }

      // Live data auto-updates via onSnapshot; only refetch user-specific resource
      refetchExistingReg();
    } catch (err) {
      console.error('Failed to advance tournament status:', err);
      setError(err instanceof Error ? err.message : 'Failed to advance tournament status. Please try again.');
    } finally {
      setAdvancing(false);
    }
  };

  // --- Callbacks for child components ---

  const handleRegistered = () => {
    refetchExistingReg();
  };

  const handleOrganizerUpdated = () => {
    // Live data auto-updates via onSnapshot
  };

  const handleFeeUpdated = () => {
    // Live data auto-updates via onSnapshot
  };

  const createAndNavigateToMatch = async (team1Id: string, team2Id: string, extra: { poolId?: string; bracketSlotId?: string }) => {
    const t = live.tournament();
    if (!t) return;
    const team1 = live.teams().find((tm) => tm.id === team1Id);
    const team2 = live.teams().find((tm) => tm.id === team2Id);

    const match: Match = {
      id: crypto.randomUUID(),
      config: {
        gameType: t.config.gameType,
        scoringMode: t.config.scoringMode,
        matchFormat: t.config.matchFormat,
        pointsToWin: t.config.pointsToWin,
      },
      team1PlayerIds: team1?.playerIds ?? [],
      team2PlayerIds: team2?.playerIds ?? [],
      team1Name: team1?.name ?? team1Id,
      team2Name: team2?.name ?? team2Id,
      games: [],
      winningSide: null,
      status: 'in-progress',
      startedAt: Date.now(),
      completedAt: null,
      tournamentId: t.id,
      tournamentTeam1Id: team1Id,
      tournamentTeam2Id: team2Id,
      poolId: extra.poolId ?? null,
      bracketSlotId: extra.bracketSlotId ?? null,
    };

    try {
      await matchRepository.save(match);
      // Sync match to Firestore for real-time LiveScoreCard
      cloudSync.syncMatchToCloud(match);
      // Set matchId on bracket slot so BracketView shows LiveScoreCard
      if (extra.bracketSlotId) {
        await firestoreBracketRepository.updateMatchId(t.id, extra.bracketSlotId, match.id);
      }
      navigate(`/score/${match.id}`);
    } catch (err) {
      console.error('Failed to create match:', err);
      alert('Failed to start match. Please try again.');
    }
  };

  const handleScorePoolMatch = (poolId: string, team1Id: string, team2Id: string) => {
    createAndNavigateToMatch(team1Id, team2Id, { poolId });
  };

  const handleScoreBracketMatch = (slotId: string, team1Id: string, team2Id: string) => {
    createAndNavigateToMatch(team1Id, team2Id, { bracketSlotId: slotId });
  };

  const handleEditPoolMatch = async (poolId: string, matchId: string, team1Id: string, team2Id: string) => {
    try {
      const match = await matchRepository.getById(matchId);
      if (!match) {
        setError('Match not found.');
        return;
      }
      setEditingMatch(match);
      setEditingContext({ type: 'pool', poolId, team1Id, team2Id });
      setEditModalError('');
    } catch (err) {
      console.error('Failed to load match for editing:', err);
      setError('Failed to load match data.');
    }
  };

  const handleEditBracketMatch = async (slotId: string, matchId: string, team1Id: string, team2Id: string) => {
    try {
      const match = await matchRepository.getById(matchId);
      if (!match) {
        setError('Match not found.');
        return;
      }
      setEditingMatch(match);
      setEditingContext({ type: 'bracket', slotId, team1Id, team2Id });
      setEditModalError('');
    } catch (err) {
      console.error('Failed to load match for editing:', err);
      setError('Failed to load match data.');
    }
  };

  const handleCancelEdit = () => {
    setEditingMatch(null);
    setEditingContext(null);
    setEditModalError('');
  };

  const handleToggleVisibility = async (newVisibility: 'private' | 'public') => {
    const t = live.tournament();
    if (!t) return;

    let shareCode = t.shareCode;
    if (newVisibility === 'public' && !shareCode) {
      shareCode = generateShareCode();
    }

    await firestoreTournamentRepository.updateVisibility(t.id, newVisibility, shareCode);
    // Live data auto-updates via onSnapshot
  };

  const handleSaveEditedScore = async (data: ScoreEditData) => {
    const match = editingMatch();
    const ctx = editingContext();
    const t = live.tournament();
    if (!match || !ctx || !t) return;

    try {
      // For bracket matches, check safety before saving
      if (ctx.type === 'bracket' && ctx.slotId) {
        const slots = live.bracket();
        const currentSlot = slots.find((s) => s.id === ctx.slotId);
        if (currentSlot) {
          const newWinnerTeamId = data.winningSide === 1 ? ctx.team1Id : ctx.team2Id;
          const safety = checkBracketRescoreSafety(currentSlot, newWinnerTeamId, slots);
          if (!safety.safe) {
            setEditModalError(safety.message ?? 'Cannot change bracket winner.');
            return;
          }
        }
      }

      // Update match record
      const updatedMatch: Match = {
        ...match,
        games: data.games,
        winningSide: data.winningSide,
      };
      await matchRepository.save(updatedMatch);
      cloudSync.syncMatchToCloud(updatedMatch);

      // Pool match: recalculate standings
      if (ctx.type === 'pool' && ctx.poolId) {
        const pool = await firestorePoolRepository.getById(t.id, ctx.poolId);
        if (pool) {
          const allMatches = await matchRepository.getAll();
          const poolMatches = allMatches.filter(
            (m) => m.tournamentId === t.id && m.poolId === ctx.poolId && m.status === 'completed',
          );

          const standings = calculateStandings(
            pool.teamIds,
            poolMatches,
            (m) => ({ team1: m.tournamentTeam1Id ?? '', team2: m.tournamentTeam2Id ?? '' }),
          );

          await firestorePoolRepository.updateScheduleAndStandings(
            t.id, ctx.poolId, pool.schedule, standings,
          );
        }
      }

      // Bracket match: update winner if changed
      if (ctx.type === 'bracket' && ctx.slotId) {
        const slots = live.bracket();
        const currentSlot = slots.find((s) => s.id === ctx.slotId);
        if (currentSlot) {
          const newWinnerTeamId = data.winningSide === 1 ? ctx.team1Id : ctx.team2Id;

          // Update current slot result
          await firestoreBracketRepository.updateResult(t.id, ctx.slotId, newWinnerTeamId, match.id);

          // If winner changed and there's a next slot, update next slot's team assignment
          if (currentSlot.winnerId !== newWinnerTeamId && currentSlot.nextSlotId) {
            const advance = advanceBracketWinner(currentSlot, newWinnerTeamId, slots);
            if (advance) {
              await firestoreBracketRepository.updateSlotTeam(t.id, advance.slotId, advance.field, advance.teamId);
            }
          }
        }
      }

      // Close modal — live data auto-updates via onSnapshot
      setEditingMatch(null);
      setEditingContext(null);
      setEditModalError('');
    } catch (err) {
      console.error('Failed to save edited score:', err);
      setEditModalError(err instanceof Error ? err.message : 'Failed to save score.');
    }
  };

  // --- Render ---

  return (
    <PageLayout title={live.tournament()?.name ?? 'Tournament'}>
      <div class="p-4 space-y-6">
        <Show when={!live.loading()} fallback={<p class="text-on-surface-muted">Loading...</p>}>
        <Show when={live.tournament()} fallback={<p class="text-on-surface-muted">Tournament not found.</p>}>
          {(t) => (
            <>
              {/* Error Banner */}
              <Show when={error()}>
                <div class="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <p class="text-red-400 text-sm">{error()}</p>
                  <button type="button" onClick={() => setError('')}
                    class="text-red-400/60 text-xs mt-1 underline">
                    Dismiss
                  </button>
                </div>
              </Show>

              {/* Status Card with Advance Button */}
              <div class="bg-surface-light rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div class="text-xs text-on-surface-muted uppercase tracking-wider">Status</div>
                  <span class={`inline-block mt-1 text-sm font-bold px-3 py-1 rounded-full ${statusColors[t().status] ?? ''}`}>
                    {statusLabels[t().status] ?? t().status}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <Show when={isOrganizer()}>
                    <button
                      type="button"
                      onClick={() => setShowShareModal(true)}
                      class="text-sm font-semibold text-primary px-3 py-1 border border-primary/30 rounded-lg active:scale-95 transition-transform"
                    >
                      Share
                    </button>
                  </Show>
                  <Show when={isOrganizer() && nextStatus()}>
                    <button type="button" onClick={handleStatusAdvance}
                      disabled={advancing()}
                      class={`bg-primary text-surface text-sm font-semibold px-4 py-2 rounded-lg transition-transform ${advancing() ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}>
                      {advancing() ? 'Advancing...' : `Advance to ${nextStatusLabel()}`}
                    </button>
                  </Show>
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

              {/* Registration Section */}
              <Show when={t().status === 'registration'}>
                <div class="space-y-4">
                  <Show when={isOrganizer()}>
                    <OrganizerPlayerManager
                      tournament={t()}
                      registrations={live.registrations()}
                      onUpdated={handleRegistered}
                    />
                    <Show when={t().config.gameType === 'doubles' && t().teamFormation === 'byop'}>
                      <OrganizerPairingPanel
                        tournamentId={t().id}
                        registrations={live.registrations()}
                        userNames={userNames()}
                        onUpdated={handleRegistered}
                      />
                    </Show>
                  </Show>
                  <RegistrationForm
                    tournament={t()}
                    existingRegistration={existingRegistration()}
                    onRegistered={handleRegistered}
                  />
                </div>
              </Show>

              {/* Player Dashboard (registered players only) */}
              <Show when={role() === 'player' && playerTeamId()}>
                <MyMatchesSection
                  matches={playerMatches()}
                  teamNames={teamNames()}
                  playerTeamName={playerTeamName()}
                />
                <MyStatsCard
                  stats={playerStats()}
                  playerTeamName={playerTeamName()}
                />
              </Show>

              {/* Scorekeeper Match List */}
              <Show when={role() === 'scorekeeper'}>
                <ScorekeeperMatchList
                  pools={live.pools()}
                  bracket={live.bracket()}
                  teamNames={teamNames()}
                  onScorePoolMatch={handleScorePoolMatch}
                  onScoreBracketMatch={handleScoreBracketMatch}
                />
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

              {/* Pool Tables */}
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
                        onScoreMatch={handleScorePoolMatch}
                        onEditMatch={isOrganizer() ? handleEditPoolMatch : undefined}
                      />
                    )}
                  </For>
                </div>
              </Show>

              {/* Bracket View */}
              <Show when={showBracketView() && live.bracket().length > 0}>
                <div class="space-y-4">
                  <h2 class="font-bold text-on-surface text-lg">Bracket</h2>
                  <BracketView
                    slots={live.bracket()}
                    teamNames={teamNames()}
                    onScoreMatch={handleScoreBracketMatch}
                    onEditMatch={isOrganizer() ? handleEditBracketMatch : undefined}
                  />
                </div>
              </Show>

              {/* Fee Tracker (organizer only, when entry fee exists) */}
              <Show when={isOrganizer() && t().entryFee}>
                <FeeTracker
                  tournamentId={t().id}
                  entryFee={t().entryFee!}
                  registrations={live.registrations()}
                  isOrganizer={true}
                  userNames={userNames()}
                  onUpdated={handleFeeUpdated}
                />
              </Show>

              {/* Organizer Controls */}
              <Show when={isOrganizer() && !['completed', 'cancelled'].includes(t().status)}>
                <OrganizerControls
                  tournament={t()}
                  onUpdated={handleOrganizerUpdated}
                />
              </Show>

              {/* Score Edit Modal */}
              <Show when={editingMatch()}>
                {(match) => (
                  <ScoreEditModal
                    open={true}
                    team1Name={match().team1Name}
                    team2Name={match().team2Name}
                    games={match().games}
                    onSave={handleSaveEditedScore}
                    onCancel={handleCancelEdit}
                    externalError={editModalError()}
                  />
                )}
              </Show>

              <Show when={live.tournament()}>
                {(t) => (
                  <ShareTournamentModal
                    open={showShareModal()}
                    tournamentId={t().id}
                    tournamentName={t().name}
                    tournamentDate={new Date(t().date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    tournamentLocation={t().location || 'TBD'}
                    visibility={t().visibility ?? 'private'}
                    shareCode={t().shareCode ?? null}
                    organizerId={t().organizerId}
                    registeredUserIds={live.registrations().map((r) => r.userId)}
                    onToggleVisibility={handleToggleVisibility}
                    onClose={() => setShowShareModal(false)}
                  />
                )}
              </Show>
            </>
          )}
        </Show>
        </Show>
      </div>
    </PageLayout>
  );
};

export default TournamentDashboardPage;
