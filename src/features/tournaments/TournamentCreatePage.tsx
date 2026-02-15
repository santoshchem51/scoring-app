import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import PageLayout from '../../shared/components/PageLayout';
import OptionCard from '../../shared/components/OptionCard';
import { useAuth } from '../../shared/hooks/useAuth';
import { firestoreTournamentRepository } from '../../data/firebase/firestoreTournamentRepository';
import type {
  TournamentFormat, GameType, ScoringMode, MatchFormat, Tournament, TournamentRules,
} from '../../data/types';
import { validateTournamentForm } from './engine/validateTournament';
import type { TournamentFormErrors } from './engine/validateTournament';

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
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [fieldErrors, setFieldErrors] = createSignal<TournamentFormErrors>({});

  const canCreate = () => {
    const errors = validateTournamentForm({
      name: name(), date: date(), location: location(),
      maxPlayers: maxPlayers(), gameType: gameType(),
    });
    return Object.keys(errors).length === 0 && !!user();
  };

  const handleCreate = async () => {
    const errors = validateTournamentForm({
      name: name(), date: date(), location: location(),
      maxPlayers: maxPlayers(), gameType: gameType(),
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

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
        teamFormation: gameType() === 'singles' ? null : 'byop',
        minPlayers: null,
        entryFee: null,
        rules: emptyRules,
        pausedFrom: null,
        cancellationReason: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
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
          <input id="t-name" type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} maxLength={60}
            class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary" placeholder="e.g., Spring Classic 2026" />
            <Show when={fieldErrors().name}>
              <p class="text-red-500 text-xs mt-1">{fieldErrors().name}</p>
            </Show>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="t-date" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">Date</label>
            <input id="t-date" type="date" value={date()} onInput={(e) => setDate(e.currentTarget.value)}
              class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary" />
            <Show when={fieldErrors().date}>
              <p class="text-red-500 text-xs mt-1">{fieldErrors().date}</p>
            </Show>
          </div>
          <div>
            <label for="t-location" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider mb-2 block">Location</label>
            <input id="t-location" type="text" value={location()} onInput={(e) => setLocation(e.currentTarget.value)} maxLength={60}
              class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary" placeholder="e.g., City Park Courts" />
            <Show when={fieldErrors().location}>
              <p class="text-red-500 text-xs mt-1">{fieldErrors().location}</p>
            </Show>
          </div>
        </div>

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
          <input id="t-max" type="number" min="4" max="128" value={maxPlayers()} onInput={(e) => setMaxPlayers(e.currentTarget.value)}
            class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:border-primary" placeholder="No limit" />
            <Show when={fieldErrors().maxPlayers}>
              <p class="text-red-500 text-xs mt-1">{fieldErrors().maxPlayers}</p>
            </Show>
        </div>
      </div>

      <div class="fixed bottom-16 left-0 right-0 p-4 bg-surface/95 backdrop-blur-sm safe-bottom">
        <div class="max-w-lg mx-auto md:max-w-3xl">
          <Show when={error()}>
            <p class="text-red-500 text-sm text-center mb-2">{error()}</p>
          </Show>
          <button type="button" onClick={handleCreate} disabled={!canCreate() || saving()}
            class={`w-full bg-primary text-surface font-bold text-lg py-4 rounded-xl transition-transform ${canCreate() && !saving() ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}>
            {saving() ? 'Creating...' : 'Create Tournament'}
          </button>
        </div>
      </div>
    </PageLayout>
  );
};

export default TournamentCreatePage;
