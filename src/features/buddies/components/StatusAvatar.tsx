import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { RsvpResponse, DayOfStatus } from '../../../data/types';
import { getRingColor, isGrayedOut, getIndicatorType } from '../engine/statusAvatarHelpers';
import type { IndicatorType } from '../engine/statusAvatarHelpers';

interface StatusAvatarProps {
  displayName: string;
  photoURL: string | null;
  response: RsvpResponse;
  dayOfStatus: DayOfStatus;
  size?: 'sm' | 'md' | 'lg';
}

function getSizeClasses(size: 'sm' | 'md' | 'lg'): string {
  if (size === 'sm') return 'w-8 h-8 text-xs ring-2';
  if (size === 'lg') return 'w-14 h-14 text-lg ring-[3px]';
  return 'w-10 h-10 text-sm ring-2';
}

function getIndicatorSize(size: 'sm' | 'md' | 'lg'): string {
  if (size === 'sm') return 'w-3 h-3 -bottom-0.5 -right-0.5';
  if (size === 'lg') return 'w-5 h-5 -bottom-0.5 -right-0.5';
  return 'w-4 h-4 -bottom-0.5 -right-0.5';
}

function StatusIndicator(props: { type: IndicatorType; sizeClass: string }) {
  return (
    <Show when={props.type}>
      {(type) => (
        <div class={`absolute ${props.sizeClass} flex items-center justify-center`}>
          {/* Here: green check circle */}
          <Show when={type() === 'here'}>
            <svg class="w-full h-full" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#10b981" />
              <path d="M6 10l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </Show>

          {/* On-my-way: blue motion dots */}
          <Show when={type() === 'on-my-way'}>
            <svg class="w-full h-full" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#3b82f6" />
              <circle cx="6" cy="10" r="1.5" fill="white" />
              <circle cx="10" cy="10" r="1.5" fill="white" />
              <circle cx="14" cy="10" r="1.5" fill="white" />
            </svg>
          </Show>

          {/* Can't make it: gray X circle */}
          <Show when={type() === 'cant-make-it'}>
            <svg class="w-full h-full" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#6b7280" />
              <path d="M7 7l6 6M13 7l-6 6" stroke="white" stroke-width="2" stroke-linecap="round" />
            </svg>
          </Show>

          {/* Maybe: amber question mark */}
          <Show when={type() === 'maybe'}>
            <svg class="w-full h-full" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#f59e0b" />
              <text x="10" y="14" text-anchor="middle" fill="white" font-size="12" font-weight="bold">?</text>
            </svg>
          </Show>
        </div>
      )}
    </Show>
  );
}

const StatusAvatar: Component<StatusAvatarProps> = (props) => {
  const size = () => props.size ?? 'md';
  const initial = () => (props.displayName || '?').charAt(0).toUpperCase();
  const ringColor = () => getRingColor(props.response, props.dayOfStatus);
  const sizeClasses = () => getSizeClasses(size());
  const grayedOut = () => isGrayedOut(props.response, props.dayOfStatus);
  const indicatorType = () => getIndicatorType(props.response, props.dayOfStatus);
  const indicatorSizeClass = () => getIndicatorSize(size());

  return (
    <div class={`relative inline-flex ${grayedOut() ? 'opacity-50' : ''}`}>
      <Show
        when={props.photoURL}
        fallback={
          <div
            class={`rounded-full flex items-center justify-center font-bold bg-surface-lighter text-on-surface ring-offset-surface ring-offset-1 ${sizeClasses()} ${ringColor()}`}
          >
            {initial()}
          </div>
        }
      >
        {(url) => (
          <img
            src={url()}
            alt={props.displayName}
            class={`rounded-full object-cover ring-offset-surface ring-offset-1 ${sizeClasses()} ${ringColor()}`}
          />
        )}
      </Show>
      <StatusIndicator type={indicatorType()} sizeClass={indicatorSizeClass()} />
    </div>
  );
};

export default StatusAvatar;
