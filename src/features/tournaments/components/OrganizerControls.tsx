import { createSignal, Show } from 'solid-js';
import type { Component } from 'solid-js';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { firestoreTournamentRepository } from '../../../data/firebase/firestoreTournamentRepository';
import type { Tournament } from '../../../data/types';

interface Props {
  tournament: Tournament;
  onUpdated: () => void;
}

const OrganizerControls: Component<Props> = (props) => {
  const [showCancel, setShowCancel] = createSignal(false);
  const [error, setError] = createSignal('');

  const isPaused = () => props.tournament.status === 'paused';
  const canPause = () => ['pool-play', 'bracket'].includes(props.tournament.status);
  const canCancel = () => !['completed', 'cancelled'].includes(props.tournament.status);

  const handlePauseResume = async () => {
    setError('');
    try {
      if (isPaused()) {
        // Resume: restore to pre-pause status
        const resumeTo = props.tournament.pausedFrom ?? 'pool-play';
        await firestoreTournamentRepository.updateStatus(props.tournament.id, resumeTo, { pausedFrom: null });
      } else {
        // Pause: save current status, then set to paused
        await firestoreTournamentRepository.updateStatus(props.tournament.id, 'paused', { pausedFrom: props.tournament.status });
      }
      props.onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update tournament status');
    }
  };

  const handleCancel = async () => {
    setError('');
    try {
      await firestoreTournamentRepository.updateStatus(props.tournament.id, 'cancelled', { reason: 'Cancelled by organizer' });
      setShowCancel(false);
      props.onUpdated();
    } catch (e) {
      setShowCancel(false);
      setError(e instanceof Error ? e.message : 'Failed to cancel tournament');
    }
  };

  const handleEndEarly = async () => {
    setError('');
    try {
      await firestoreTournamentRepository.updateStatus(props.tournament.id, 'completed');
      props.onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to end tournament');
    }
  };

  return (
    <div class="bg-surface-light rounded-xl p-4 space-y-3">
      <h3 class="font-bold text-on-surface text-sm">Organizer Controls</h3>
      <Show when={error()}>
        <p class="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error()}</p>
      </Show>
      <div class="flex flex-wrap gap-2">
        <Show when={canPause() || isPaused()}>
          <button type="button" onClick={handlePauseResume}
            class="text-sm font-semibold px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 active:scale-95 transition-transform">
            {isPaused() ? 'Resume' : 'Pause'}
          </button>
        </Show>
        <Show when={canPause() || isPaused()}>
          <button type="button" onClick={handleEndEarly}
            class="text-sm font-semibold px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 active:scale-95 transition-transform">
            End Early
          </button>
        </Show>
        <Show when={canCancel()}>
          <button type="button" onClick={() => setShowCancel(true)}
            class="text-sm font-semibold px-4 py-2 rounded-lg bg-red-500/20 text-red-400 active:scale-95 transition-transform">
            Cancel Tournament
          </button>
        </Show>
      </div>
      <ConfirmDialog open={showCancel()} title="Cancel Tournament"
        message="This will cancel the tournament and notify all participants. This cannot be undone."
        confirmLabel="Cancel Tournament" variant="danger" onConfirm={handleCancel} onCancel={() => setShowCancel(false)} />
    </div>
  );
};

export default OrganizerControls;
