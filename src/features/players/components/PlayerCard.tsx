import type { Component } from 'solid-js';
import { playerRepository } from '../../../data/repositories/playerRepository';
import { db } from '../../../data/db';
import type { Player } from '../../../data/types';

interface Props {
  player: Player;
}

const PlayerCard: Component<Props> = (props) => {
  const joinDate = () => new Date(props.player.createdAt).toLocaleDateString();

  const handleDelete = async () => {
    if (confirm(`Delete ${props.player.name}?`)) {
      await playerRepository.delete(props.player.id);
      // Cascade: remove player ID from match records
      const t1Matches = await db.matches.where('team1PlayerIds').equals(props.player.id).toArray();
      for (const m of t1Matches) {
        await db.matches.update(m.id, {
          team1PlayerIds: m.team1PlayerIds.filter(id => id !== props.player.id),
        });
      }
      const t2Matches = await db.matches.where('team2PlayerIds').equals(props.player.id).toArray();
      for (const m of t2Matches) {
        await db.matches.update(m.id, {
          team2PlayerIds: m.team2PlayerIds.filter(id => id !== props.player.id),
        });
      }
    }
  };

  return (
    <div class="bg-surface-light rounded-xl p-4 flex items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="font-semibold text-on-surface truncate">{props.player.name}</div>
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
