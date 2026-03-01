import type { RecentResult, Tier, TierConfidence } from '../../data/types';

// --- Constants ---

const TIER_MULTIPLIER: Record<Tier, number> = {
  beginner: 0.5,
  intermediate: 0.8,
  advanced: 1.0,
  expert: 1.3,
};

const RECENCY_BUCKETS = [
  { maxIndex: 10, weight: 1.0 },   // last 10 matches
  { maxIndex: 25, weight: 0.8 },   // matches 11-25
  { maxIndex: 50, weight: 0.6 },   // matches 26-50
] as const;

const DAMPING_MATCHES = 15;
const PRIOR_SCORE = 0.25;

// --- Score Computation ---

function getRecencyWeight(index: number): number {
  for (const bucket of RECENCY_BUCKETS) {
    if (index < bucket.maxIndex) return bucket.weight;
  }
  return RECENCY_BUCKETS[RECENCY_BUCKETS.length - 1].weight;
}

export function computeTierScore(results: RecentResult[]): number {
  if (results.length === 0) return PRIOR_SCORE;

  let weightedWins = 0;
  let totalWeight = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const recency = getRecencyWeight(i);
    const tierMul = TIER_MULTIPLIER[r.opponentTier];

    if (r.result === 'win') {
      weightedWins += recency * tierMul;
    }
    totalWeight += recency;
  }

  const rawScore = totalWeight > 0 ? weightedWins / totalWeight : 0;

  // Bayesian damping: pull toward prior for small samples
  const dampingFactor = Math.min(results.length / DAMPING_MATCHES, 1.0);
  const score = PRIOR_SCORE + (rawScore - PRIOR_SCORE) * dampingFactor;

  return Math.max(0, Math.min(1, score));
}

// Stubs - implemented in Task 3 and Task 4
export function computeTier(_score: number, currentTier: Tier): Tier {
  return currentTier;
}

export function computeTierConfidence(_matchCount: number, _uniqueOpponents: number): TierConfidence {
  return 'low';
}
