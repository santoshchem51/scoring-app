interface PlayerForPairing {
  userId: string;
  skillRating: number | null;
}

type PlayerPair = [PlayerForPairing, PlayerForPairing];

const DEFAULT_RATING = 3.0;

function effectiveRating(player: PlayerForPairing): number {
  return player.skillRating ?? DEFAULT_RATING;
}

/**
 * Pair players by closest skill rating.
 * Sorts by rating, then pairs adjacent players.
 * Returns pairs sorted by average team rating (highest first, for seeding).
 * Odd player count: last player is left unpaired (not included in output).
 */
export function autoPairByRating(players: PlayerForPairing[]): PlayerPair[] {
  if (players.length < 2) return [];

  const sorted = [...players].sort((a, b) => effectiveRating(b) - effectiveRating(a));
  const pairs: PlayerPair[] = [];

  for (let i = 0; i + 1 < sorted.length; i += 2) {
    pairs.push([sorted[i], sorted[i + 1]]);
  }

  pairs.sort((a, b) => {
    const avgA = (effectiveRating(a[0]) + effectiveRating(a[1])) / 2;
    const avgB = (effectiveRating(b[0]) + effectiveRating(b[1])) / 2;
    return avgB - avgA;
  });

  return pairs;
}
