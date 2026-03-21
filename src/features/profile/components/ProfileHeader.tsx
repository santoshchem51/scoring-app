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

const ALLOWED_PHOTO_DOMAINS = ['lh3.googleusercontent.com', 'lh4.googleusercontent.com', 'lh5.googleusercontent.com', 'lh6.googleusercontent.com'];

function isSafePhotoURL(url: string | null): string | false {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (!ALLOWED_PHOTO_DOMAINS.some(d => parsed.hostname === d)) return false;
    return url;
  } catch {
    return false;
  }
}

const ProfileHeader: Component<ProfileHeaderProps> = (props) => {
  return (
    <header class="flex flex-col items-center text-center gap-2 py-4" aria-label="Player profile">
      <Show
        when={isSafePhotoURL(props.photoURL)}
        fallback={
          <div class="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-surface font-bold text-xl ring-2 ring-surface-light">
            {props.displayName?.charAt(0) ?? '?'}
          </div>
        }
      >
        {(url) => (
          <img
            src={url()}
            alt={`Profile photo of ${props.displayName}`}
            class="w-16 h-16 rounded-full ring-2 ring-surface-light"
            referrerpolicy="no-referrer"
          />
        )}
      </Show>

      <div class="flex items-center gap-2 flex-wrap justify-center">
        <h1 class="text-xl font-bold text-on-surface">
          {props.displayName || props.email}
        </h1>
        <Show when={props.hasStats && props.tier && props.tierConfidence}>
          <TierBadge tier={props.tier!} confidence={props.tierConfidence!} />
        </Show>
      </div>

      <Show when={!props.displayName}>
        <a href="/settings" class="text-sm text-primary underline" aria-label="Set your display name">
          Set your display name
        </a>
      </Show>
      <Show when={props.displayName}>
        <p class="text-sm text-on-surface-muted">{props.email}</p>
      </Show>
      <p class="text-xs text-on-surface-muted">
        Member since {formatMemberSince(props.createdAt)}
      </p>
    </header>
  );
};

export default ProfileHeader;
