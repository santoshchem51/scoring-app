import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
import { playerRepository } from '../../../data/repositories/playerRepository';

const AddPlayerForm: Component = () => {
  const [name, setName] = createSignal('');
  const [showError, setShowError] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const trimmed = name().trim();
    if (!trimmed) {
      setShowError(true);
      return;
    }
    await playerRepository.create(trimmed);
    setName('');
    setShowError(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} class="flex gap-2" aria-label="Add player">
        <div class="flex-1">
          <label for="player-name" class="sr-only">Player name</label>
          <input
            id="player-name"
            type="text"
            value={name()}
            onInput={(e) => { setName(e.currentTarget.value); setShowError(false); }}
            maxLength={30}
            class="w-full bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary"
            placeholder="Player name"
            aria-describedby={showError() ? 'player-name-error' : undefined}
            aria-invalid={showError() ? 'true' : undefined}
          />
        </div>
        <button
          type="submit"
          aria-label="Add player"
          class="bg-primary text-surface font-semibold px-6 rounded-xl active:scale-95 transition-transform"
        >
          Add
        </button>
      </form>
      <Show when={showError()}>
        <p id="player-name-error" class="text-error text-xs mt-1" role="alert">Please enter a player name</p>
      </Show>
    </>
  );
};

export default AddPlayerForm;
