import { Show, For, createSignal, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import type { StatsSummary, CachedAchievement, AchievementCategory } from '../../../data/types';
import { ACHIEVEMENT_DEFINITIONS } from '../engine/badgeDefinitions';
import { computeProgress } from '../engine/achievementHelpers';
import AchievementBadge from './AchievementBadge';
import type { AchievementDisplayItem } from './AchievementBadge';

interface TrophyCaseProps {
  unlocked: CachedAchievement[] | undefined;
  stats: StatsSummary | null;
}

const CATEGORY_ORDER: AchievementCategory[] = ['milestones', 'streaks', 'improvement', 'social', 'moments', 'consistency'];

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  milestones: 'Milestones',
  streaks: 'Streaks',
  improvement: 'Improvement',
  social: 'Social',
  moments: 'Moments',
  consistency: 'Consistency',
};

const TrophyCase: Component<TrophyCaseProps> = (props) => {
  const displayItems = createMemo(() => {
    const unlockedList = props.unlocked ?? [];
    const unlockedById = new Map(unlockedList.map(u => [u.achievementId, u]));

    return ACHIEVEMENT_DEFINITIONS.map(def => {
      const cached = unlockedById.get(def.id);
      return {
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        tier: def.tier,
        category: def.category,
        unlocked: !!cached,
        unlockedAt: cached?.unlockedAt,
        progress: cached ? undefined : computeProgress(def, props.stats),
      };
    });
  });

  const itemsByCategory = createMemo(() => {
    const items = displayItems();
    const grouped = new Map<AchievementCategory, (AchievementDisplayItem & { category: AchievementCategory })[]>();
    for (const cat of CATEGORY_ORDER) {
      grouped.set(cat, items.filter(i => i.category === cat));
    }
    return grouped;
  });

  const unlockedCount = createMemo(() => displayItems().filter(i => i.unlocked).length);

  return (
    <section aria-labelledby="trophycase-heading" class="space-y-4">
      <h2 id="trophycase-heading" class="text-sm font-semibold text-on-surface-muted uppercase tracking-wider">
        Achievements ({unlockedCount()}/{ACHIEVEMENT_DEFINITIONS.length})
      </h2>

      <For each={CATEGORY_ORDER}>
        {(category) => {
          const items = () => itemsByCategory().get(category) ?? [];
          const unlockedItems = () => items().filter(i => i.unlocked);
          const lockedItems = () => items().filter(i => !i.unlocked);
          const nextAchievable = () => lockedItems()[0];
          const [showLocked, setShowLocked] = createSignal(false);

          const visibleItems = () => {
            const unlocked = unlockedItems();
            const next = nextAchievable();
            if (showLocked()) return items();
            return next ? [...unlocked, next] : unlocked;
          };

          return (
            <Show when={items().length > 0}>
              <div class="space-y-2">
                <h3 class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider">
                  {CATEGORY_LABELS[category]}
                </h3>
                <div role="list" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  <For each={visibleItems()}>
                    {(item) => <AchievementBadge item={item} />}
                  </For>
                </div>
                <Show when={!showLocked() && lockedItems().length > 1}>
                  <button
                    type="button"
                    class="text-xs text-on-surface-muted hover:text-on-surface transition-colors"
                    onClick={() => setShowLocked(true)}
                  >
                    Show {lockedItems().length - 1} more locked
                  </button>
                </Show>
                <Show when={showLocked() && lockedItems().length > 1}>
                  <button
                    type="button"
                    class="text-xs text-on-surface-muted hover:text-on-surface transition-colors"
                    onClick={() => setShowLocked(false)}
                  >
                    Hide locked
                  </button>
                </Show>
              </div>
            </Show>
          );
        }}
      </For>
    </section>
  );
};

export default TrophyCase;
