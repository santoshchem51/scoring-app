import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { useAuth } from '../hooks/useAuth';
import { cloudSync } from '../../data/firebase/cloudSync';

export const SyncErrorBanner: Component = () => {
  const { syncError, setSyncError } = useAuth();

  const retry = () => {
    cloudSync.pullCloudMatchesToLocal()
      .then(() => setSyncError(false))
      .catch(() => {});
  };

  return (
    <Show when={syncError()}>
      <button
        type="button"
        onClick={retry}
        class="w-full text-center text-sm text-amber-400 bg-amber-400/10 py-2 px-4 rounded-lg"
      >
        Couldn't load cloud matches. Tap to retry.
      </button>
    </Show>
  );
};
