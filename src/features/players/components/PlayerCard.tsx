import type { Component } from 'solid-js';
import { playerRepository } from '../../../data/repositories/playerRepository';
import type { Player } from '../../../data/types';

interface Props {
  player: Player;
}

const PlayerCard: Component<Props> = (props) => {
  const joinDate = () => new Date(props.player.createdAt).toLocaleDateString();

  const handleDelete = async () => {
    if (confirm(`Delete ${props.player.name}?`)) {
      await playerRepository.delete(props.player.id);
    }
  };

  return (
    <div class="bg-surface-light rounded-xl p-4 flex items-center justify-between">
      <div>
        <div class="font-semibold text-on-surface">{props.player.name}</div>
        <div class="text-xs text-on-surface-muted">Joined {joinDate()}</div>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        class="text-error text-sm px-3 py-1 rounded-lg hover:bg-error/10 transition-colors"
      >
        Delete
      </button>
    </div>
  );
};

export default PlayerCard;
