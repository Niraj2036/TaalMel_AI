import { CanonicalTransaction, MatchResult, ExceptionData } from '../types';
import { hasDescriptionConflict } from './conflict-detector';

const TOLERANCE = parseInt(process.env.TOLERANCE_MINOR_UNITS || '5', 10);
const MAX_DATE_LAG_DAYS = parseInt(process.env.MAX_DATE_LAG_DAYS || '45', 10);

interface Pass1Result {
  matched: MatchResult[];
  exceptions: ExceptionData[];
  unmatchedInternal: CanonicalTransaction[];
  unmatchedBank: CanonicalTransaction[];
}

function withinDateLag(dateA: string, dateB: string, days: number): boolean {
  const diff = Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime());
  return diff <= days * 24 * 60 * 60 * 1000;
}

/**
 * Pass 1: 1:1 matching between gateway settlements and bank credits.
 */
export function runPass1Exact(
  gatewayTxns: CanonicalTransaction[],
  bankTxns: CanonicalTransaction[]
): Pass1Result {
  const matched: MatchResult[] = [];
  const exceptions: ExceptionData[] = [];
  const matchedGatewayIds = new Set<string>();
  const matchedBankIds = new Set<string>();

  const bankAmountIndex = new Map<number, CanonicalTransaction[]>();
  for (const bank of bankTxns) {
    const arr = bankAmountIndex.get(bank.amount) || [];
    arr.push(bank);
    bankAmountIndex.set(bank.amount, arr);
  }

  for (const gw of gatewayTxns) {
    if (matchedGatewayIds.has(gw.id)) continue;
    if (gw.amount <= 0) continue;

    let bestCandidate: CanonicalTransaction | null = null;
    let bestDiff = Infinity;

    for (const bank of bankTxns) {
      if (matchedBankIds.has(bank.id)) continue;

      // Skip bank records with explicit anomaly keywords or customer conflicts
      if (hasDescriptionConflict(bank, [gw])) continue;

      const diff = Math.abs(bank.amount - gw.amount);
      if (diff <= TOLERANCE && withinDateLag(gw.date, bank.date, MAX_DATE_LAG_DAYS)) {
        if (diff < bestDiff) {
          bestDiff = diff;
          bestCandidate = bank;
        }
      }
    }

    if (bestCandidate) {
      matched.push({
        matchId: crypto.randomUUID(),
        internalTxnIds: [gw.id],
        bankTxnIds: [bestCandidate.id],
        matchType: '1:1',
        confidenceScore: bestDiff === 0 ? 100 : 90,
        evidence: [
          `Amount match (diff=${bestDiff} paise)`,
          `Date window OK`,
          `Gateway: ${gw.sourceTxnId} → Bank: ${bestCandidate.sourceTxnId}`,
        ],
      });
      matchedGatewayIds.add(gw.id);
      matchedBankIds.add(bestCandidate.id);
    }
  }

  const unmatchedInternal = gatewayTxns.filter(g => !matchedGatewayIds.has(g.id));
  const unmatchedBank = bankTxns.filter(b => !matchedBankIds.has(b.id));

  return { matched, exceptions, unmatchedInternal, unmatchedBank };
}
