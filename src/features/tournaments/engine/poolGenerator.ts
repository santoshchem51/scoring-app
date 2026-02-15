/**
 * Distribute teams into pools using snake-draft ordering.
 * Teams should be pre-sorted by seed (index 0 = top seed).
 */
export function generatePools(teamIds: string[], poolCount: number): string[][] {
  const pools: string[][] = Array.from({ length: poolCount }, () => []);

  let direction = 1;
  let poolIndex = 0;

  for (const teamId of teamIds) {
    pools[poolIndex].push(teamId);

    const nextIndex = poolIndex + direction;
    if (nextIndex >= poolCount || nextIndex < 0) {
      direction *= -1;
    } else {
      poolIndex = nextIndex;
    }
  }

  return pools;
}
