/**
 * Pass 3: N:M subset-sum solver.
 * Pure TypeScript DP to find subsets of ERP/Gateway transactions
 * that sum to a bank credit amount. This handles split payments and
 * partial settlements where multiple invoices map to one bank drop.
 */

interface SolverItem {
  id: string;
  amount: number;
}

/**
 * Finds a subset of items whose amounts sum to exactly `target` (within tolerance).
 * Uses dynamic programming. Caps at maxItems to prevent combinatorial explosion.
 */
export function solveSubsetSum(
  target: number,
  items: SolverItem[],
  maxItems = 10,
  tolerance = 2
): string[] | null {
  if (target <= 0 || items.length === 0) return null;

  // Filter only positive, plausible candidates (≤ target + tolerance)
  const candidates = items.filter(i => i.amount > 0 && i.amount <= target + tolerance);
  if (candidates.length === 0) return null;

  // Cap candidates if array is huge to prevent combinatorial explosion
  const boundedCandidates = candidates.length > 50 ? candidates.slice(0, 50) : candidates;

  // dp Map: sum → [ids that make up this sum]
  const dp = new Map<number, string[]>();
  dp.set(0, []);

  for (const item of boundedCandidates) {
    if (dp.size > 3000) break; // Memory safety cap

    const currentSums = Array.from(dp.keys());

    for (const prevSum of currentSums) {
      const prevCombo = dp.get(prevSum)!;
      if (prevCombo.length >= maxItems) continue;

      const newSum = prevSum + item.amount;

      // Within tolerance of target → found a match
      if (Math.abs(newSum - target) <= tolerance) {
        return [...prevCombo, item.id];
      }

      // Overshoot — skip
      if (newSum > target + tolerance) continue;

      // Record this intermediate sum if not already found with fewer items
      if (!dp.has(newSum)) {
        dp.set(newSum, [...prevCombo, item.id]);
      }
    }
  }

  // Final check: exact target (or within tolerance)
  for (const [sum, ids] of dp.entries()) {
    if (Math.abs(sum - target) <= tolerance) return ids;
  }

  return null;
}
