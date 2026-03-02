import { For } from 'solid-js';
import type { Component } from 'solid-js';
import type { Tier, TierConfidence } from '../../../data/types';

interface TierColors {
  bg: string;
  text: string;
  dot: string;
}

const TIER_COLORS: Record<Tier, TierColors> = {
  beginner: { bg: 'bg-slate-500/20', text: 'text-slate-400', dot: 'bg-slate-400' },
  intermediate: { bg: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-400' },
  advanced: { bg: 'bg-orange-400/20', text: 'text-orange-400', dot: 'bg-orange-400' },
  expert: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400' },
};

export function getTierColor(tier: Tier): TierColors {
  return TIER_COLORS[tier];
}

export function getConfidenceDots(confidence: TierConfidence): Array<{ filled: boolean }> {
  const filledCount = confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;
  return [
    { filled: filledCount >= 1 },
    { filled: filledCount >= 2 },
    { filled: filledCount >= 3 },
  ];
}

interface TierBadgeProps {
  tier: Tier;
  confidence: TierConfidence;
}

const TierBadge: Component<TierBadgeProps> = (props) => {
  const colors = () => getTierColor(props.tier);
  const dots = () => getConfidenceDots(props.confidence);

  return (
    <span
      class={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase ${colors().bg} ${colors().text}`}
      aria-label={`Skill tier: ${props.tier}, confidence: ${props.confidence}`}
    >
      {props.tier}
      <span class="inline-flex gap-0.5" aria-hidden="true">
        <For each={dots()}>
          {(dot) => (
            <span
              class={`w-1.5 h-1.5 rounded-full ${dot.filled ? colors().dot : `${colors().dot} opacity-25`}`}
            />
          )}
        </For>
      </span>
    </span>
  );
};

export default TierBadge;
