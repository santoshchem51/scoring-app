import { createSignal, For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { GameResult } from '../../../data/types';
import { validateGameScores, deriveWinnerFromGames } from '../engine/rescoring';

export interface ScoreEditData {
  games: GameResult[];
  winningSide: 1 | 2;
}

interface Props {
  open: boolean;
  team1Name: string;
  team2Name: string;
  games: GameResult[];
  onSave: (data: ScoreEditData) => void;
  onCancel: () => void;
  externalError?: string;
}

const ScoreEditModal: Component<Props> = (props) => {
  const [editedGames, setEditedGames] = createSignal<GameResult[]>([]);
  const [error, setError] = createSignal('');

  const initGames = () => {
    setEditedGames(props.games.map((g) => ({ ...g })));
    setError('');
  };

  // Initialize on each open
  const isOpen = () => {
    if (props.open) initGames();
    return props.open;
  };

  const updateScore = (gameIndex: number, field: 'team1Score' | 'team2Score', value: number) => {
    setEditedGames((prev) =>
      prev.map((g, i) => (i === gameIndex ? { ...g, [field]: Math.max(0, value) } : g)),
    );
  };

  const handleSave = () => {
    const games = editedGames();

    const correctedGames: GameResult[] = games.map((g) => ({
      ...g,
      winningSide: g.team1Score > g.team2Score ? (1 as const) : (2 as const),
    }));

    const validation = validateGameScores(correctedGames);
    if (!validation.valid) {
      setError(validation.message ?? 'Invalid scores.');
      return;
    }

    const winningSide = deriveWinnerFromGames(correctedGames);
    if (!winningSide) {
      setError('Could not determine match winner.');
      return;
    }

    props.onSave({ games: correctedGames, winningSide });
  };

  return (
    <Show when={isOpen()}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div class="bg-surface rounded-2xl w-full max-w-sm overflow-hidden">
          {/* Header */}
          <div class="px-4 py-3 bg-surface-light border-b border-surface-lighter">
            <h2 class="font-bold text-on-surface text-sm">
              Edit Score — {props.team1Name} vs {props.team2Name}
            </h2>
          </div>

          {/* Game Scores */}
          <div class="p-4 space-y-3">
            <For each={editedGames()}>
              {(game, index) => (
                <div class="flex items-center gap-3">
                  <span class="text-xs text-on-surface-muted w-16 shrink-0">Game {game.gameNumber}</span>
                  <div class="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      min="0"
                      value={game.team1Score}
                      onInput={(e) => updateScore(index(), 'team1Score', parseInt(e.currentTarget.value) || 0)}
                      class="w-16 text-center bg-surface-light border border-surface-lighter rounded-lg px-2 py-2 text-on-surface font-semibold text-sm"
                    />
                    <span class="text-on-surface-muted text-xs">-</span>
                    <input
                      type="number"
                      min="0"
                      value={game.team2Score}
                      onInput={(e) => updateScore(index(), 'team2Score', parseInt(e.currentTarget.value) || 0)}
                      class="w-16 text-center bg-surface-light border border-surface-lighter rounded-lg px-2 py-2 text-on-surface font-semibold text-sm"
                    />
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Error Display */}
          <Show when={error() || props.externalError}>
            <div class="px-4 pb-2">
              <p class="text-red-400 text-xs">{error() || props.externalError}</p>
            </div>
          </Show>

          {/* Buttons */}
          <div class="px-4 py-3 flex gap-3 border-t border-surface-lighter">
            <button
              type="button"
              onClick={() => props.onCancel()}
              class="flex-1 py-2 text-sm font-semibold text-on-surface-muted bg-surface-light rounded-lg active:scale-95 transition-transform"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              class="flex-1 py-2 text-sm font-semibold text-surface bg-primary rounded-lg active:scale-95 transition-transform"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ScoreEditModal;
