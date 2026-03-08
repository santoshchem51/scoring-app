import type { AchievementTier, AchievementCategory } from '../../../data/types';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string;
}

export const ACHIEVEMENT_DEFINITIONS: BadgeDefinition[] = [
  // Milestones
  { id: 'first_rally', name: 'First Rally', description: 'Play your first match', category: 'milestones', tier: 'bronze', icon: '🏓' },
  { id: 'warming_up', name: 'Warming Up', description: 'Play 10 matches', category: 'milestones', tier: 'bronze', icon: '🌡️' },
  { id: 'battle_tested', name: 'Battle Tested', description: 'Play 25 matches', category: 'milestones', tier: 'silver', icon: '⚔️' },
  { id: 'half_century', name: 'Half Century', description: 'Play 50 matches', category: 'milestones', tier: 'silver', icon: '🎯' },
  { id: 'century_club', name: 'Century Club', description: 'Play 100 matches', category: 'milestones', tier: 'gold', icon: '💯' },
  // Streaks
  { id: 'hat_trick', name: 'Hat Trick', description: 'Win 3 matches in a row', category: 'streaks', tier: 'bronze', icon: '🎩' },
  { id: 'on_fire', name: 'On Fire', description: 'Win 5 matches in a row', category: 'streaks', tier: 'silver', icon: '🔥' },
  { id: 'unstoppable', name: 'Unstoppable', description: 'Win 10 matches in a row', category: 'streaks', tier: 'gold', icon: '⚡' },
  // Improvement
  { id: 'moving_up', name: 'Moving Up', description: 'Reach Intermediate tier', category: 'improvement', tier: 'bronze', icon: '📈' },
  { id: 'level_up', name: 'Level Up', description: 'Reach Advanced tier', category: 'improvement', tier: 'silver', icon: '🚀' },
  { id: 'elite', name: 'Elite', description: 'Reach Expert tier', category: 'improvement', tier: 'gold', icon: '👑' },
  { id: 'proven', name: 'Proven', description: 'Reach high tier confidence', category: 'improvement', tier: 'silver', icon: '✅' },
  // Social
  { id: 'new_rival', name: 'New Rival', description: 'Play against 5 different opponents', category: 'social', tier: 'bronze', icon: '🤝' },
  { id: 'social_butterfly', name: 'Social Butterfly', description: 'Play against 15 different opponents', category: 'social', tier: 'silver', icon: '🦋' },
  { id: 'community_pillar', name: 'Community Pillar', description: 'Play against 30 different opponents', category: 'social', tier: 'gold', icon: '🏛️' },
  // Moments
  { id: 'shutout', name: 'Shutout', description: 'Win a game without opponent scoring', category: 'moments', tier: 'silver', icon: '🛡️' },
  { id: 'comeback_kid', name: 'Comeback Kid', description: 'Lose game 1 but win the match', category: 'moments', tier: 'silver', icon: '💪' },
  { id: 'perfect_match', name: 'Perfect Match', description: 'Win every game in a best-of-3+', category: 'moments', tier: 'silver', icon: '✨' },
  { id: 'doubles_specialist', name: 'Doubles Specialist', description: 'Win 25 doubles matches', category: 'moments', tier: 'silver', icon: '👥' },
  { id: 'singles_ace', name: 'Singles Ace', description: 'Win 25 singles matches', category: 'moments', tier: 'silver', icon: '🎾' },
  // Consistency
  { id: 'first_win', name: 'First Win', description: 'Win your first match', category: 'consistency', tier: 'bronze', icon: '🏆' },
  { id: 'winning_ways', name: 'Winning Ways', description: 'Reach 60% win rate (20+ matches)', category: 'consistency', tier: 'silver', icon: '📊' },
  { id: 'dominant_force', name: 'Dominant Force', description: 'Reach 75% win rate (30+ matches)', category: 'consistency', tier: 'gold', icon: '💎' },
];

export function getDefinition(id: string): BadgeDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find(d => d.id === id);
}

export function getDefinitionsByCategory(category: AchievementCategory): BadgeDefinition[] {
  return ACHIEVEMENT_DEFINITIONS.filter(d => d.category === category);
}
