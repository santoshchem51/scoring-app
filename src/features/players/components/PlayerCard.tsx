import { createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { playerRepository } from '../../../data/repositories/playerRepository';
import { db } from '../../../data/db';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import type { Player } from '../../../data/types';

interface Props {
  player: Player;
}

const PlayerCard: Component<Props> = (props) => {
  const joinDate = () => new Date(props.player.createdAt).toLocaleDateString();
  const [showConfirm, setShowConfirm] = createSignal(false);

  const handleDelete = async () => {
    setShowConfirm(false);
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
  };

  return (
    <>
      <div class="bg-surface-light rounded-xl p-4 flex items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-on-surface truncate">{props.player.name}</div>
          <div class="text-xs text-on-surface-muted">Joined {joinDate()}</div>
        </div>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          aria-label={`Delete ${props.player.name}`}
          class="text-error text-sm px-4 py-3 min-h-[48px] rounded-lg hover:bg-error/10 active:scale-95 transition-all"
        >
          Delete
        </button>
      </div>
      <ConfirmDialog
        open={showConfirm()}
        title="Delete Player"
        message={`Are you sure you want to delete ${props.player.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
};

export default PlayerCard;
