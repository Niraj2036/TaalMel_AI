import { CanonicalTransaction, MatchResult } from '../types';
import { solveSubsetSum } from './pass3-solver';
import { hasDescriptionConflict } from './conflict-detector';

interface Pass2Result {
  matched: MatchResult[];
  unmatchedGateway: CanonicalTransaction[];
  unmatchedBank: CanonicalTransaction[];
}

const MAX_DATE_LAG_DAYS = parseInt(process.env.MAX_DATE_LAG_DAYS || '45', 10);
const TOLERANCE = parseInt(process.env.TOLERANCE_MINOR_UNITS || '5', 10);

function withinDateLag(dateA: string, dateB: string, days: number): boolean {
  const diff = Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime());
  return diff <= days * 24 * 60 * 60 * 1000;
}

export function runPass2Group(
  gatewayTxns: CanonicalTransaction[],
  bankTxns: CanonicalTransaction[]
): Pass2Result {
  const matched: MatchResult[] = [];
  const matchedBankIds    = new Set<string>();
  const matchedGatewayIds = new Set<string>();

  // Filter out bank transactions that have description conflicts from candidates
  const cleanBankTxns = bankTxns.filter(b => !hasDescriptionConflict(b, []));

  // ── Direction A: N gateway (same settlementId) → 1 bank ──────────────────
  const settlementGroups = new Map<string, CanonicalTransaction[]>();
  const noSettlement: CanonicalTransaction[] = [];

  for (const txn of gatewayTxns) {
    if (txn.settlementId) {
      const arr = settlementGroups.get(txn.settlementId) || [];
      arr.push(txn);
      settlementGroups.set(txn.settlementId, arr);
    } else {
      noSettlement.push(txn);
    }
  }

  for (const [settlementId, group] of settlementGroups.entries()) {
    const netSum = group.reduce((s, t) => s + t.amount, 0);
    const latestGwDate = group.reduce((d, t) => t.date > d ? t.date : d, group[0].date);

    let found = false;
    for (const bank of cleanBankTxns) {
      if (matchedBankIds.has(bank.id)) continue;
      if (hasDescriptionConflict(bank, group)) continue;

      const diff = Math.abs(bank.amount - netSum);
      if (diff <= TOLERANCE && withinDateLag(bank.date, latestGwDate, MAX_DATE_LAG_DAYS)) {
        matched.push({
          matchId: crypto.randomUUID(),
          internalTxnIds: group.map(t => t.id),
          bankTxnIds: [bank.id],
          matchType: group.length === 1 ? '1:1' : 'N:1',
          confidenceScore: 92,
          evidence: [
            `Settlement group: ${settlementId}`,
            `Net sum match (diff=${diff} paise)`,
            `Date window OK`,
          ],
        });
        matchedBankIds.add(bank.id);
        group.forEach(t => matchedGatewayIds.add(t.id));
        found = true;
        break;
      }
    }
    if (found) continue;

    // Direction A2: N gateway → M bank (split settlement — subset-sum on bank entries)
    const availBankItems = cleanBankTxns
      .filter(b => !matchedBankIds.has(b.id) && !hasDescriptionConflict(b, group) && withinDateLag(b.date, latestGwDate, MAX_DATE_LAG_DAYS))
      .map(b => ({ id: b.id, amount: b.amount }));

    const bankSubset = solveSubsetSum(netSum, availBankItems, 10, TOLERANCE);
    if (bankSubset && bankSubset.length > 0) {
      matched.push({
        matchId: crypto.randomUUID(),
        internalTxnIds: group.map(t => t.id),
        bankTxnIds: bankSubset,
        matchType: 'N:M',
        confidenceScore: 88,
        evidence: [
          `Split settlement: ${settlementId}`,
          `${group.length} gateway → ${bankSubset.length} bank entries`,
          `Sum match within tolerance`,
        ],
      });
      bankSubset.forEach(id => matchedBankIds.add(id));
      group.forEach(t => matchedGatewayIds.add(t.id));
    }
  }

  // ── Direction B: 1 gateway → N bank (partial payments) ───────────────────
  const unmatchedGw = [...noSettlement, ...gatewayTxns.filter(g =>
    g.settlementId && !matchedGatewayIds.has(g.id)
  )].filter(g => !matchedGatewayIds.has(g.id) && g.amount > 0);

  const availableBank = cleanBankTxns.filter(b => !matchedBankIds.has(b.id));

  for (const gw of unmatchedGw) {
    if (matchedGatewayIds.has(gw.id)) continue;

    const bankInWindow = availableBank.filter(b =>
      !matchedBankIds.has(b.id) && !hasDescriptionConflict(b, [gw]) && withinDateLag(gw.date, b.date, MAX_DATE_LAG_DAYS)
    );

    if (bankInWindow.length === 0) continue;

    const bankItems = bankInWindow.map(b => ({ id: b.id, amount: b.amount }));
    const subsetIds = solveSubsetSum(gw.amount, bankItems, 10, TOLERANCE);

    if (subsetIds && subsetIds.length > 0) {
      const bankMatched = bankInWindow.filter(b => subsetIds.includes(b.id));

      matched.push({
        matchId: crypto.randomUUID(),
        internalTxnIds: [gw.id],
        bankTxnIds: bankMatched.map(b => b.id),
        matchType: bankMatched.length === 1 ? '1:1' : '1:N',
        confidenceScore: 88,
        evidence: [
          `Partial payment: ${bankMatched.length} bank entries sum to gateway amount`,
          `Gateway: ${gw.sourceTxnId}, amount=${gw.amount}`,
          `Bank sum within tolerance`,
        ],
      });
      matchedGatewayIds.add(gw.id);
      bankMatched.forEach(b => matchedBankIds.add(b.id));
    }
  }

  // Handle charge+refund netting
  const refundBatches = new Map<string, CanonicalTransaction[]>();
  for (const txn of gatewayTxns) {
    if (!txn.settlementId || matchedGatewayIds.has(txn.id)) continue;
    const arr = refundBatches.get(txn.settlementId) || [];
    arr.push(txn);
    refundBatches.set(txn.settlementId, arr);
  }

  for (const [batchId, group] of refundBatches.entries()) {
    if (group.some(t => matchedGatewayIds.has(t.id))) continue;
    const hasRefund = group.some(t => t.amount < 0);
    if (!hasRefund) continue;

    const netAmount = group.reduce((s, t) => s + t.amount, 0);
    if (netAmount <= 0) continue;

    const latestDate = group.reduce((d, t) => t.date > d ? t.date : d, group[0].date);

    for (const bank of cleanBankTxns) {
      if (matchedBankIds.has(bank.id)) continue;
      if (hasDescriptionConflict(bank, group)) continue;

      if (Math.abs(bank.amount - netAmount) <= TOLERANCE &&
          withinDateLag(bank.date, latestDate, MAX_DATE_LAG_DAYS)) {
        matched.push({
          matchId: crypto.randomUUID(),
          internalTxnIds: group.map(t => t.id),
          bankTxnIds: [bank.id],
          matchType: 'N:1',
          confidenceScore: 90,
          evidence: [
            `Charge+Refund netting: batch ${batchId}`,
            `Net after refund = ${netAmount} paise`,
          ],
        });
        matchedBankIds.add(bank.id);
        group.forEach(t => matchedGatewayIds.add(t.id));
        break;
      }
    }
  }

  const unmatchedGateway = gatewayTxns.filter(g => !matchedGatewayIds.has(g.id) && g.amount > 0);
  const unmatchedBank    = bankTxns.filter(b => !matchedBankIds.has(b.id));

  return { matched, unmatchedGateway, unmatchedBank };
}
