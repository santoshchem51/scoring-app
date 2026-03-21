import type { Component } from 'solid-js';
import { Show } from 'solid-js';

interface BuddyAvatarProps {
  displayName: string;
  photoURL: string | null;
  team: 1 | 2 | null;
  teamColor: string;
  onClick: () => void;
}

const BuddyAvatar: Component<BuddyAvatarProps> = (props) => {
  const initial = () => props.displayName.charAt(0).toUpperCase();

  const ariaLabel = () => {
    const teamStr = props.team ? `Team ${props.team}` : 'unassigned';
    return `${props.displayName}, ${teamStr}. Tap to change.`;
  };

  return (
    <button
      type="button"
      data-testid="buddy-avatar"
      class="flex flex-col items-center gap-1 flex-shrink-0 active:scale-95 transition-transform"
      style={{ width: '56px' }}
      onClick={props.onClick}
      aria-label={ariaLabel()}
    >
      <div
        class="relative w-12 h-12 rounded-full overflow-hidden border-2"
        style={{ "border-color": props.team ? props.teamColor : 'var(--color-surface-lighter)' }}
      >
        <Show
          when={props.photoURL}
          fallback={
            <div class="w-full h-full flex items-center justify-center bg-surface-light text-on-surface font-bold text-lg">
              {initial()}
            </div>
          }
        >
          <img src={props.photoURL!} alt="" class="w-full h-full object-cover" />
        </Show>
        <Show when={props.team}>
          <div
            class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ "background-color": props.teamColor }}
          >
            T{props.team}
          </div>
        </Show>
      </div>
      <span class="text-xs text-on-surface-muted truncate w-full text-center">{props.displayName}</span>
    </button>
  );
};

export default BuddyAvatar;
