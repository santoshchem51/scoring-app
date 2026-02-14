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
      <form onSubmit={handleSubmit} class="flex gap-2">
        <input
          type="text"
          value={name()}
          onInput={(e) => { setName(e.currentTarget.value); setShowError(false); }}
          maxLength={30}
          class="flex-1 bg-surface-light border border-surface-lighter rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary"
          placeholder="Player name"
        />
        <button
          type="submit"
          class="bg-primary text-surface font-semibold px-6 rounded-xl active:scale-95 transition-transform"
        >
          Add
        </button>
      </form>
      <Show when={showError()}>
        <p class="text-error text-xs mt-1">Please enter a player name</p>
      </Show>
    </>
  );
};

export default AddPlayerForm;
