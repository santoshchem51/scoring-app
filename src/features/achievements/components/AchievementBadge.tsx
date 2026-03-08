import { Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { AchievementProgress } from '../engine/achievementHelpers';

export interface AchievementDisplayItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  unlocked: boolean;
  unlockedAt?: number;
  progress?: AchievementProgress;
}

interface AchievementBadgeProps {
  item: AchievementDisplayItem;
}

const TIER_BORDER: Record<string, string> = {
  bronze: 'border-l-amber-600',
  silver: 'border-l-[#c0c0c0]',
  gold: 'border-l-yellow-400',
};

const TIER_LABEL_COLOR: Record<string, string> = {
  bronze: 'text-amber-600',
  silver: 'text-[#c0c0c0]',
  gold: 'text-yellow-400',
};

const AchievementBadge: Component<AchievementBadgeProps> = (props) => {
  return (
    <div
      role="listitem"
      aria-label={props.item.unlocked
        ? `${props.item.name}, ${props.item.tier} tier, unlocked. ${props.item.description}`
        : `${props.item.name}, locked. ${props.item.description}${props.item.progress ? `. Progress: ${props.item.progress.current} of ${props.item.progress.target}` : ''}`}
      aria-disabled={!props.item.unlocked}
      class={`border-l-4 rounded-xl p-3 ${
        props.item.unlocked
          ? `bg-surface-light ${TIER_BORDER[props.item.tier] ?? 'border-l-primary'}`
          : 'bg-gray-900 border-l-gray-600'
      }`}
    >
      <div class="flex items-start gap-2">
        <span aria-hidden="true" class={`text-xl flex-shrink-0 ${props.item.unlocked ? '' : 'grayscale opacity-50'}`}>
          {props.item.unlocked ? props.item.icon : '\uD83D\uDD12'}
        </span>
        <div class="flex-1 min-w-0">
          <div class={`text-xs font-semibold leading-tight ${props.item.unlocked ? 'text-on-surface' : 'text-gray-400'}`}>
            {props.item.name}
          </div>
          <div class={`text-[10px] uppercase tracking-wider font-medium mt-0.5 ${TIER_LABEL_COLOR[props.item.tier] ?? 'text-on-surface-muted'}`}>
            {props.item.tier}
          </div>
        </div>
      </div>

      {/* Progress bar for locked badges */}
      <Show when={!props.item.unlocked && props.item.progress}>
        {(progress) => (
          <div class="mt-2 w-full h-1 bg-surface-lighter rounded-full overflow-hidden">
            <div
              class={`h-full rounded-full ${props.item.unlocked ? 'bg-primary' : 'bg-gray-500'}`}
              style={{ width: `${Math.min(100, (progress().current / progress().target) * 100)}%` }}
            />
          </div>
        )}
      </Show>
    </div>
  );
};

export default AchievementBadge;
