import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';
import { playerRepository } from '../../../data/repositories/playerRepository';

const AddPlayerForm: Component = () => {
  const [name, setName] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const trimmed = name().trim();
    if (!trimmed) return;
    await playerRepository.create(trimmed);
    setName('');
  };

  return (
    <form onSubmit={handleSubmit} class="flex gap-2">
      <input
        type="text"
        value={name()}
        onInput={(e) => setName(e.currentTarget.value)}
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
  );
};

export default AddPlayerForm;
