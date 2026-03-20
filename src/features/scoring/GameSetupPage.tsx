import type { Component } from 'solid-js';
import { createSignal, createEffect, on, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import OptionCard from '../../shared/components/OptionCard';
import ColorPicker from '../../shared/components/ColorPicker';
import { matchRepository } from '../../data/repositories/matchRepository';
import type { GameType, ScoringMode, MatchFormat, Match, MatchConfig } from '../../data/types';
import { settings } from '../../stores/settingsStore';
import { DEFAULT_TEAM1_COLOR, DEFAULT_TEAM2_COLOR } from '../../shared/constants/teamColors';
import { cloudSync } from '../../data/firebase/cloudSync';
import { Zap } from 'lucide-solid';
import BuddyPicker from './components/BuddyPicker';
import { buildTeamArrays } from './helpers/buddyPickerHelpers';
import { useAuth } from '../../shared/hooks/useAuth';

const GameSetupPage: Component = () => {
  const navigate = useNavigate();

  const [gameType, setGameType] = createSignal<GameType>('doubles');
  const [scoringMode, setScoringMode] = createSignal<ScoringMode>(settings().defaultScoringMode);
  const [matchFormat, setMatchFormat] = createSignal<MatchFormat>(settings().defaultMatchFormat);
  const [pointsToWin, setPointsToWin] = createSignal<11 | 15 | 21>(settings().defaultPointsToWin);
  const [team1Name, setTeam1Name] = createSignal('Team 1');
  const [team2Name, setTeam2Name] = createSignal('Team 2');
  const [team1Color, setTeam1Color] = createSignal(DEFAULT_TEAM1_COLOR);
  const [team2Color, setTeam2Color] = createSignal(DEFAULT_TEAM2_COLOR);
  const [scorerRole, setScorerRole] = createSignal<'player' | 'spectator'>('player');
  const [scorerTeam, setScorerTeam] = createSignal<1 | 2>(1);
  const [roleExpanded, setRoleExpanded] = createSignal(false);
  const [buddyAssignments, setBuddyAssignments] = createSignal<Record<string, 1 | 2>>({});
  const [searchUserInfo, setSearchUserInfo] = createSignal<
    Record<string, { displayName: string; photoURL: string | null }>
  >({});

  const { user } = useAuth();

  const canStart = () => team1Name().trim() !== '' && team2Name().trim() !== '';

  const handleBuddyAssign = (userId: string, team: 1 | 2) => {
    setBuddyAssignments((prev) => ({ ...prev, [userId]: team }));
  };

  const handleBuddyUnassign = (userId: string) => {
    setBuddyAssignments((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const handleSearchAssign = (
    userId: string,
    team: 1 | 2,
    info: { displayName: string; photoURL: string | null },
  ) => {
    setSearchUserInfo((prev) => ({ ...prev, [userId]: info }));
    setBuddyAssignments((prev) => ({ ...prev, [userId]: team }));
  };

  const handleSearchUnassign = (userId: string) => {
    setSearchUserInfo((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setBuddyAssignments((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  // Capacity pruning: when switching to singles, keep max 1 per team
  createEffect(
    on(gameType, (gt) => {
      if (gt !== 'singles') return;
      setBuddyAssignments((prev) => {
        const pruned: Record<string, 1 | 2> = {};
        let t1 = 0;
        let t2 = 0;
        for (const [uid, team] of Object.entries(prev)) {
          if (team === 1 && t1 < 1) { pruned[uid] = 1; t1++; }
          else if (team === 2 && t2 < 1) { pruned[uid] = 2; t2++; }
        }
        const removedUids = Object.keys(prev).filter((uid) => !(uid in pruned));
        if (removedUids.length > 0) {
          setSearchUserInfo((si) => {
            const next = { ...si };
            for (const uid of removedUids) delete next[uid];
            return next;
          });
        }
        return pruned;
      });
    }),
  );

  const startGame = async () => {
    const config: MatchConfig = {
      gameType: gameType(),
      scoringMode: scoringMode(),
      matchFormat: matchFormat(),
      pointsToWin: pointsToWin(),
    };

    const { team1, team2, sharedWith } = buildTeamArrays(buddyAssignments(), {
      scorerUid: user()?.uid ?? '',
      scorerRole: scorerRole(),
      scorerTeam: scorerTeam(),
    });

    const match: Match = {
      id: crypto.randomUUID(),
      config,
      team1PlayerIds: team1,
      team2PlayerIds: team2,
      team1Name: team1Name().trim(),
      team2Name: team2Name().trim(),
      team1Color: team1Color(),
      team2Color: team2Color(),
      games: [],
      winningSide: null,
      status: 'in-progress',
      startedAt: Date.now(),
      completedAt: null,
      scorerRole: scorerRole(),
      scorerTeam: scorerTeam(),
    };

    try {
      await matchRepository.save(match);
      cloudSync.syncMatchToCloud(match, sharedWith);
      navigate(`/score/${match.id}`);
    } catch (err) {
      console.error('Failed to save match:', err);
      alert('Failed to start game. Please try again.');
    }
  };

  const quickStart = async () => {
    const s = settings();
    const config: MatchConfig = {
      gameType: 'doubles',
      scoringMode: s.defaultScoringMode,
      matchFormat: s.defaultMatchFormat,
      pointsToWin: s.defaultPointsToWin,
    };
    const match: Match = {
      id: crypto.randomUUID(),
      config,
      team1PlayerIds: [],
      team2PlayerIds: [],
      team1Name: 'Team 1',
      team2Name: 'Team 2',
      team1Color: DEFAULT_TEAM1_COLOR,
      team2Color: DEFAULT_TEAM2_COLOR,
      games: [],
      winningSide: null,
      status: 'in-progress',
      startedAt: Date.now(),
      completedAt: null,
      scorerRole: 'player',
      scorerTeam: 1,
    };
    try {
      await matchRepository.save(match);
      cloudSync.syncMatchToCloud(match);
      navigate(`/score/${match.id}`);
    } catch (err) {
      console.error('Failed to start quick game:', err);
    }
  };

  return (
    <PageLayout title="New Game">
      <div class="p-4 pb-24">
        {/* Quick Game */}
        <button
          type="button"
          onClick={quickStart}
          class="w-full bg-primary text-surface font-bold text-lg py-5 rounded-2xl active:scale-95 transition-transform flex items-center justify-center gap-3"
          aria-label="Quick Game — start with defaults"
        >
          <Zap size={24} />
          Quick Game
        </button>

        {/* Divider */}
        <div class="flex items-center gap-3 text-on-surface-muted my-6">
          <div class="flex-1 border-t border-surface-lighter" />
          <span class="text-xs uppercase tracking-wider">or customize</span>
          <div class="flex-1 border-t border-surface-lighter" />
        </div>

        {/* Two-column grid for the form */}
        <div class="md:grid md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
          {/* Left column: Game options */}
          <div class="space-y-6">
            {/* Game Type */}
            <fieldset>
              <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Game Type</legend>
              <div class="grid grid-cols-2 gap-3">
                <OptionCard label="Singles" description="1 vs 1" selected={gameType() === 'singles'} onClick={() => setGameType('singles')} />
                <OptionCard label="Doubles" description="2 vs 2" selected={gameType() === 'doubles'} onClick={() => setGameType('doubles')} />
              </div>
            </fieldset>

            {/* Scoring Mode */}
            <fieldset>
              <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Scoring</legend>
              <div class="grid grid-cols-2 gap-3">
                <OptionCard label="Side-Out" description="Serving team scores" selected={scoringMode() === 'sideout'} onClick={() => setScoringMode('sideout')} />
                <OptionCard label="Rally" description="Point every rally" selected={scoringMode() === 'rally'} onClick={() => setScoringMode('rally')} />
              </div>
            </fieldset>

            {/* Points to Win */}
            <fieldset>
              <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Points to Win</legend>
              <div class="grid grid-cols-3 gap-2 min-w-0">
                <OptionCard label="11" selected={pointsToWin() === 11} onClick={() => setPointsToWin(11)} />
                <OptionCard label="15" selected={pointsToWin() === 15} onClick={() => setPointsToWin(15)} />
                <OptionCard label="21" selected={pointsToWin() === 21} onClick={() => setPointsToWin(21)} />
              </div>
            </fieldset>

            {/* Match Format */}
            <fieldset>
              <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Match Format</legend>
              <div class="grid grid-cols-3 gap-2 min-w-0">
                <OptionCard label="1 Game" selected={matchFormat() === 'single'} onClick={() => setMatchFormat('single')} />
                <OptionCard label="Best of 3" selected={matchFormat() === 'best-of-3'} onClick={() => setMatchFormat('best-of-3')} />
                <OptionCard label="Best of 5" selected={matchFormat() === 'best-of-5'} onClick={() => setMatchFormat('best-of-5')} />
              </div>
            </fieldset>
          </div>

          {/* Right column: Teams */}
          <div class="space-y-6">
            {/* Team Names */}
            <fieldset>
              <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Teams</legend>
              <div class="space-y-3">
                <div>
                  <label for="team1-name" class="sr-only">Team 1 name</label>
                  <input
                    id="team1-name"
                    type="text"
                    value={team1Name()}
                    onInput={(e) => setTeam1Name(e.currentTarget.value)}
                    maxLength={30}
                    class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
                    placeholder="Team 1 name"
                  />
                  <div class="mt-2">
                    <ColorPicker selected={team1Color()} onSelect={setTeam1Color} label="Team 1 color" />
                  </div>
                </div>
                <div>
                  <label for="team2-name" class="sr-only">Team 2 name</label>
                  <input
                    id="team2-name"
                    type="text"
                    value={team2Name()}
                    onInput={(e) => setTeam2Name(e.currentTarget.value)}
                    maxLength={30}
                    class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary"
                    placeholder="Team 2 name"
                  />
                  <div class="mt-2">
                    <ColorPicker selected={team2Color()} onSelect={setTeam2Color} label="Team 2 color" />
                  </div>
                </div>
              </div>
            </fieldset>
          </div>
        </div>

        {/* Add Players */}
        <Show when={user()}>
          <BuddyPicker
            buddyAssignments={buddyAssignments()}
            searchUserInfo={searchUserInfo()}
            scorerRole={scorerRole()}
            scorerTeam={scorerTeam()}
            scorerUid={user()!.uid}
            team1Name={team1Name()}
            team2Name={team2Name()}
            team1Color={team1Color()}
            team2Color={team2Color()}
            gameType={gameType()}
            onAssign={handleBuddyAssign}
            onUnassign={handleBuddyUnassign}
            onSearchAssign={handleSearchAssign}
            onSearchUnassign={handleSearchUnassign}
          />
        </Show>

        {/* Your Role */}
        <div class="mt-6">
          <Show
            when={roleExpanded()}
            fallback={
              <div class="flex items-center justify-between bg-surface-light rounded-xl px-4 py-3">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-on-surface-muted">Your Role:</span>
                  <span class="text-sm font-semibold text-on-surface">
                    {scorerRole() === 'player' ? "I'm Playing" : 'Scoring for Others'}
                  </span>
                  <Show when={scorerRole() === 'player'}>
                    <span
                      class="inline-block w-3 h-3 rounded-full"
                      style={{ "background-color": scorerTeam() === 1 ? team1Color() : team2Color() }}
                    />
                  </Show>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleExpanded(true)}
                  class="text-sm text-primary font-semibold"
                >
                  Change
                </button>
              </div>
            }
          >
            <fieldset>
              <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Your Role</legend>
              <div class="grid grid-cols-2 gap-3">
                <OptionCard
                  label="I'm Playing"
                  description="Track your stats"
                  selected={scorerRole() === 'player'}
                  onClick={() => setScorerRole('player')}
                />
                <OptionCard
                  label="Scoring for Others"
                  description="No stats for you"
                  selected={scorerRole() === 'spectator'}
                  onClick={() => setScorerRole('spectator')}
                />
              </div>
              <Show when={scorerRole() === 'player'}>
                <div class="mt-3">
                  <p class="text-sm text-on-surface-muted mb-2">Which team are you on?</p>
                  <div class="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setScorerTeam(1)}
                      class={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                        scorerTeam() === 1
                          ? 'border-primary bg-primary/20 text-on-surface'
                          : 'border-surface-lighter bg-surface-light text-on-surface-muted'
                      }`}
                    >
                      <span
                        class="inline-block w-3 h-3 rounded-full"
                        style={{ "background-color": team1Color() }}
                      />
                      <span class="text-sm font-semibold">{team1Name() || 'Team 1'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setScorerTeam(2)}
                      class={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                        scorerTeam() === 2
                          ? 'border-primary bg-primary/20 text-on-surface'
                          : 'border-surface-lighter bg-surface-light text-on-surface-muted'
                      }`}
                    >
                      <span
                        class="inline-block w-3 h-3 rounded-full"
                        style={{ "background-color": team2Color() }}
                      />
                      <span class="text-sm font-semibold">{team2Name() || 'Team 2'}</span>
                    </button>
                  </div>
                </div>
              </Show>
              <button
                type="button"
                onClick={() => setRoleExpanded(false)}
                class="mt-3 text-sm text-on-surface-muted underline"
              >
                Done
              </button>
            </fieldset>
          </Show>
        </div>
      </div>

      {/* Sticky Start Button */}
      <div class="fixed bottom-16 left-0 right-0 p-4 bg-surface/95 backdrop-blur-sm safe-bottom">
        <div class="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl">
          <button
            type="button"
            onClick={startGame}
            disabled={!canStart()}
            aria-label="Start game"
            class={`w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl transition-transform ${canStart() ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
          >
            Start Game
          </button>
        </div>
      </div>
    </PageLayout>
  );
};

export default GameSetupPage;
