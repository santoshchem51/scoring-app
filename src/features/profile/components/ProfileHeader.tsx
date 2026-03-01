import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { Tier, TierConfidence } from '../../../data/types';
import TierBadge from './TierBadge';

interface ProfileHeaderProps {
  displayName: string;
  email: string;
  photoURL: string | null;
  createdAt: number;
  tier?: Tier;
  tierConfidence?: TierConfidence;
  hasStats: boolean;
}

function formatMemberSince(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const ProfileHeader: Component<ProfileHeaderProps> = (props) => {
  return (
    <header class="flex flex-col items-center text-center gap-2 py-4" aria-label="Player profile">
      <Show
        when={props.photoURL}
        fallback={
          <div class="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-surface font-bold text-xl ring-2 ring-surface-light">
            {props.displayName?.charAt(0) ?? '?'}
          </div>
        }
      >
        <img
          src={props.photoURL!}
          alt={`Profile photo of ${props.displayName}`}
          class="w-16 h-16 rounded-full ring-2 ring-surface-light"
          referrerpolicy="no-referrer"
        />
      </Show>

      <div class="flex items-center gap-2 flex-wrap justify-center">
        <h1 class="text-xl font-bold text-on-surface">{props.displayName}</h1>
        <Show when={props.hasStats && props.tier && props.tierConfidence}>
          <TierBadge tier={props.tier!} confidence={props.tierConfidence!} />
        </Show>
      </div>

      <p class="text-sm text-on-surface-muted">{props.email}</p>
      <p class="text-xs text-on-surface-muted">
        Member since {formatMemberSince(props.createdAt)}
      </p>
    </header>
  );
};

export default ProfileHeader;
