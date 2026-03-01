import { createSignal, createResource, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import OptionCard from '../../shared/components/OptionCard';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import type {
  TournamentFormat, GameType, ScoringMode, MatchFormat, Tournament, TournamentRules, TournamentAccessMode,
} from '../../data/types';
import { validateTournamentForm } from './engine/validateTournament';
import type { TournamentFormErrors } from './engine/validateTournament';
import AccessModeSelector from './components/AccessModeSelector';
import { firestoreBuddyGroupRepository } from '../../data/firebase/firestoreBuddyGroupRepository';

const emptyRules: TournamentRules = {
  registrationDeadline: null, checkInRequired: false, checkInOpens: null, checkInCloses: null,
  scoringRules: '', timeoutRules: '', conductRules: '', penalties: [], additionalNotes: '',
};

const TournamentCreatePage: Component = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = createSignal('');
  const [location, setLocation] = createSignal('');
  const [date, setDate] = createSignal('');
  const [format, setFormat] = createSignal<TournamentFormat>('round-robin');
  const [gameType, setGameType] = createSignal<GameType>('doubles');
  const [scoringMode, setScoringMode] = createSignal<ScoringMode>('sideout');
  const [matchFormat, setMatchFormat] = createSignal<MatchFormat>('single');
  const [pointsToWin, setPointsToWin] = createSignal<11 | 15 | 21>(11);
  const [poolCount, _setPoolCount] = createSignal(2);
  const [teamsAdvancing, _setTeamsAdvancing] = createSignal(2);
  const [maxPlayers, setMaxPlayers] = createSignal('');
  const [teamFormation, setTeamFormation] = createSignal<'byop' | 'auto-pair'>('byop');
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [touched, setTouched] = createSignal<Record<string, boolean>>({});
  const [accessMode, setAccessMode] = createSignal<TournamentAccessMode>('open');
  const [listed, setListed] = createSignal(true);
  const [buddyGroupId, setBuddyGroupId] = createSignal<string | null>(null);
  const [buddyGroupName, setBuddyGroupName] = createSignal<string | null>(null);
  const [buddyGroups, setBuddyGroups] = createSignal<Array<{ id: string; name: string }>>([]);

  createResource(
    () => user()?.uid,
    async (uid) => {
      const groups = await firestoreBuddyGroupRepository.getGroupsByUser(uid);
      setBuddyGroups(groups.map((g) => ({ id: g.id, name: g.name })));
    },
  );

  const handleAccessModeChange = (mode: TournamentAccessMode) => {
    setAccessMode(mode);
    if (mode === 'open' || mode === 'approval') {
      setListed(true);
    }
    if (mode !== 'group') {
      setBuddyGroupId(null);
      setBuddyGroupName(null);
    }
  };

  const fieldErrors = (): TournamentFormErrors => validateTournamentForm({
    name: name(), date: date(), location: location(),
    maxPlayers: maxPlayers(), gameType: gameType(),
  });

  const canCreate = () => Object.keys(fieldErrors()).length === 0 && !!user();

  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));
  const showError = (field: keyof TournamentFormErrors) => touched()[field] ? fieldErrors()[field] : undefined;

  const handleCreate = async () => {
    setTouched({ name: true, date: true, location: true, maxPlayers: true, gameType: true });
    if (Object.keys(fieldErrors()).length > 0) return;

    if (accessMode() === 'group' && !buddyGroupId()) {
      setError('Select a group before continuing.');
      return;
    }

    const currentUser = user();
    if (!currentUser || saving()) return;

    setError('');
    setSaving(true);
    try {
      const tournament: Tournament = {
        id: crypto.randomUUID(),
        name: name().trim(),
        date: new Date(date()).getTime(),
        location: location().trim(),
        format: format(),
        config: {
          gameType: gameType(), scoringMode: scoringMode(), matchFormat: matchFormat(),
          pointsToWin: pointsToWin(),
          poolCount: format() === 'round-robin' ? 1 : poolCount(),
          teamsPerPoolAdvancing: teamsAdvancing(),
        },
        organizerId: currentUser.uid,
        scorekeeperIds: [],
        status: 'setup',
        maxPlayers: (() => { const n = parseInt(maxPlayers(), 10); return !isNaN(n) && n >= 4 ? n : null; })(),
        teamFormation: gameType() === 'singles' ? null : teamFormation(),
        minPlayers: null,
        entryFee: null,
        rules: emptyRules,
        pausedFrom: null,
        cancellationReason: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessMode: accessMode(),
        listed: listed(),
        visibility: listed() ? 'public' as const : 'private' as const,
        shareCode: crypto.randomUUID().slice(0, 8).toUpperCase(),
        buddyGroupId: accessMode() === 'group' ? buddyGroupId() : null,
        buddyGroupName: accessMode() === 'group' ? buddyGroupName() : null,
        registrationCounts: { confirmed: 0, pending: 0 },
      };

      await firestoreTournamentRepository.save(tournament);
      navigate(`/tournaments/${tournament.id}`);
    } catch (err) {
      console.error('Failed to create tournament:', err);
      setError('Failed to create tournament. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout title="Create Tournament">
      <div class="p-4 pb-24 space-y-6">
        <div>
          <label for="t-name" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">Tournament Name</label>
          <input id="t-name" type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} onBlur={() => markTouched('name')} maxLength={60}
            class={`w-full bg-surface-light border rounded-xl px-4 py-3 text-on-surface focus:border-primary ${showError('name') ? 'border-red-500' : 'border-surface-lighter'}`} placeholder="e.g., Spring Classic 2026" />
            <Show when={showError('name')}>
              <p class="text-red-500 text-xs mt-1">{showError('name')}</p>
            </Show>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="t-date" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">Date</label>
            <input id="t-date" type="date" value={date()} onInput={(e) => setDate(e.currentTarget.value)} onBlur={() => markTouched('date')}
              class={`w-full bg-surface-light border rounded-xl px-4 py-3 text-on-surface focus:border-primary ${showError('date') ? 'border-red-500' : 'border-surface-lighter'}`} />
            <Show when={showError('date')}>
              <p class="text-red-500 text-xs mt-1">{showError('date')}</p>
            </Show>
          </div>
          <div>
            <label for="t-location" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">Location</label>
            <input id="t-location" type="text" value={location()} onInput={(e) => setLocation(e.currentTarget.value)} onBlur={() => markTouched('location')} maxLength={60}
              class={`w-full bg-surface-light border rounded-xl px-4 py-3 text-on-surface focus:border-primary ${showError('location') ? 'border-red-500' : 'border-surface-lighter'}`} placeholder="e.g., City Park Courts" />
            <Show when={showError('location')}>
              <p class="text-red-500 text-xs mt-1">{showError('location')}</p>
            </Show>
          </div>
        </div>

        {/* Access section divider */}
        <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mt-6 mb-2">Access</div>

        <AccessModeSelector
          accessMode={accessMode()}
          listed={listed()}
          buddyGroupId={buddyGroupId()}
          buddyGroupName={buddyGroupName()}
          buddyGroups={buddyGroups()}
          onAccessModeChange={handleAccessModeChange}
          onListedChange={setListed}
          onGroupChange={(id, name) => { setBuddyGroupId(id); setBuddyGroupName(name); }}
        />

        {/* Game Rules section divider */}
        <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mt-6 mb-2">Game Rules</div>

        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Format</legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="Round Robin" description="Everyone plays everyone" selected={format() === 'round-robin'} onClick={() => setFormat('round-robin')} />
            <OptionCard label="Elimination" description="Single elimination" selected={format() === 'single-elimination'} onClick={() => setFormat('single-elimination')} />
            <OptionCard label="Pool + Bracket" description="Pools then bracket" selected={format() === 'pool-bracket'} onClick={() => setFormat('pool-bracket')} />
          </div>
        </fieldset>

        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Game Type</legend>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard label="Singles" description="1 vs 1" selected={gameType() === 'singles'} onClick={() => setGameType('singles')} />
            <OptionCard label="Doubles" description="2 vs 2" selected={gameType() === 'doubles'} onClick={() => setGameType('doubles')} />
          </div>
        </fieldset>

        <Show when={gameType() === 'doubles'}>
          <fieldset>
            <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Team Formation</legend>
            <div class="grid grid-cols-2 gap-3">
              <OptionCard label="BYOP" description="Bring your own partner" selected={teamFormation() === 'byop'} onClick={() => setTeamFormation('byop')} />
              <OptionCard label="Auto-Pair" description="Pair by skill level" selected={teamFormation() === 'auto-pair'} onClick={() => setTeamFormation('auto-pair')} />
            </div>
          </fieldset>
        </Show>

        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Scoring</legend>
          <div class="grid grid-cols-2 gap-3">
            <OptionCard label="Side-Out" selected={scoringMode() === 'sideout'} onClick={() => setScoringMode('sideout')} />
            <OptionCard label="Rally" selected={scoringMode() === 'rally'} onClick={() => setScoringMode('rally')} />
          </div>
        </fieldset>

        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Points to Win</legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="11" selected={pointsToWin() === 11} onClick={() => setPointsToWin(11)} />
            <OptionCard label="15" selected={pointsToWin() === 15} onClick={() => setPointsToWin(15)} />
            <OptionCard label="21" selected={pointsToWin() === 21} onClick={() => setPointsToWin(21)} />
          </div>
        </fieldset>

        <fieldset>
          <legend class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-3">Match Format</legend>
          <div class="grid grid-cols-3 gap-3">
            <OptionCard label="1 Game" selected={matchFormat() === 'single'} onClick={() => setMatchFormat('single')} />
            <OptionCard label="Best of 3" selected={matchFormat() === 'best-of-3'} onClick={() => setMatchFormat('best-of-3')} />
            <OptionCard label="Best of 5" selected={matchFormat() === 'best-of-5'} onClick={() => setMatchFormat('best-of-5')} />
          </div>
        </fieldset>

        <div>
          <label for="t-max" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">Max Players (optional)</label>
          <input id="t-max" type="number" min="4" max="128" value={maxPlayers()} onInput={(e) => setMaxPlayers(e.currentTarget.value)} onBlur={() => markTouched('maxPlayers')}
            class={`w-full bg-surface-light border rounded-xl px-4 py-3 text-on-surface focus:border-primary ${showError('maxPlayers') ? 'border-red-500' : 'border-surface-lighter'}`} placeholder="No limit" />
            <Show when={showError('maxPlayers')}>
              <p class="text-red-500 text-xs mt-1">{showError('maxPlayers')}</p>
            </Show>
        </div>
      </div>

      <div class="fixed bottom-16 left-0 right-0 p-4 bg-surface/95 backdrop-blur-sm safe-bottom">
        <div class="max-w-lg mx-auto md:max-w-3xl">
          <Show when={error()}>
            <p class="text-red-500 text-sm text-center mb-2">{error()}</p>
          </Show>
          <Show when={!canCreate() && Object.keys(touched()).length > 0}>
            <p class="text-amber-400 text-sm text-center mb-2">
              Please fix the highlighted fields above
            </p>
          </Show>
          <button type="button" onClick={handleCreate} disabled={saving()}
            class={`w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl transition-transform ${!saving() ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}>
            {saving() ? 'Creating...' : 'Create Tournament'}
          </button>
        </div>
      </div>
    </PageLayout>
  );
};

export default TournamentCreatePage;
