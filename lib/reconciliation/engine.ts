import {
  CanonicalTransaction,
  ReconciliationResult,
  MatchResult,
  ExceptionData,
  ExceptionType
} from '../types';
import { runPass1Exact } from './pass1-exact';
import { runPass2Group } from './pass2-group';
import { solveSubsetSum } from './pass3-solver';
import { evaluateEvidence } from './evidence-gate';
import { hasDescriptionConflict } from './conflict-detector';

const TOLERANCE = parseInt(process.env.TOLERANCE_MINOR_UNITS || '5', 10);
const MAX_DATE_LAG = parseInt(process.env.MAX_DATE_LAG_DAYS || '45', 10);

function withinDateLag(a: string, b: string, days = MAX_DATE_LAG) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= days * 86400000;
}

/**
 * Main reconciliation orchestrator.
 *
 * Group-First Architecture:
 * Pass 1: Gateway Groups (BULK, SPLIT, NM, REF, etc.) → Bank Credits (N:1, 1:N, N:M)
 * Pass 2: Single Gateway records (1:1) → remaining Bank Credits
 * Pass 3: ERP invoices → remaining Bank Credits (subset-sum)
 * Pass 4: Link ERP records to already-matched Gateway records by amount+date
 */
export function reconcile(
  erpTxns: CanonicalTransaction[],
  bankTxns: CanonicalTransaction[],
  gatewayTxns: CanonicalTransaction[],
  runId: string
): ReconciliationResult {
  const startTime = Date.now();
  const matches: MatchResult[] = [];
  const exceptions: ExceptionData[] = [];

  const matchedBankIds    = new Set<string>();
  const matchedGatewayIds = new Set<string>();
  const matchedErpIds     = new Set<string>();

  let currentBank = [...bankTxns];

  // ── Pass 1: Group / Settlement Matching (N:1, 1:N, N:M) ───────────────────
  // Process settlement groups FIRST so individual 1:1 matching does not greedily
  // consume bank entries that belong to multi-item groups.
  const pass1Group = runPass2Group(gatewayTxns, currentBank);
  matches.push(...pass1Group.matched);
  pass1Group.matched.forEach(m => {
    m.internalTxnIds.forEach(id => matchedGatewayIds.add(id));
    m.bankTxnIds.forEach(id => matchedBankIds.add(id));
  });

  currentBank = currentBank.filter(b => !matchedBankIds.has(b.id));
  const remainingGateway = gatewayTxns.filter(g => !matchedGatewayIds.has(g.id) && g.amount > 0);

  // ── Pass 2: Single 1:1 Matching (Gateway → Bank) ──────────────────────────
  const pass2Single = runPass1Exact(remainingGateway, currentBank);
  matches.push(...pass2Single.matched);
  pass2Single.matched.forEach(m => {
    m.internalTxnIds.forEach(id => matchedGatewayIds.add(id));
    m.bankTxnIds.forEach(id => matchedBankIds.add(id));
  });

  currentBank = currentBank.filter(b => !matchedBankIds.has(b.id));

  // ── Pass 3: ERP Invoices → remaining Bank credits (subset-sum) ────────────
  const erpItems = erpTxns.map(e => ({ id: e.id, amount: e.amount }));
  const p3MatchedBankIds = new Set<string>();
  const p3MatchedErpIds  = new Set<string>();

  for (const bank of currentBank) {
    if (bank.amount <= 0) continue;
    if (hasDescriptionConflict(bank, [])) continue;

    const available = erpItems.filter(i => !p3MatchedErpIds.has(i.id));
    const subsetIds = solveSubsetSum(bank.amount, available, 10, TOLERANCE);
    if (subsetIds && subsetIds.length > 0) {
      const candidateErp = erpTxns.filter(e => subsetIds.includes(e.id));
      const evidence = evaluateEvidence([...candidateErp, bank]);
      if (evidence.isProven) {
        matches.push({
          matchId: crypto.randomUUID(),
          internalTxnIds: subsetIds,
          bankTxnIds: [bank.id],
          matchType: subsetIds.length === 1 ? '1:1' : 'N:M',
          confidenceScore: evidence.score,
          evidence: evidence.reasoning,
        });
        p3MatchedBankIds.add(bank.id);
        subsetIds.forEach(id => p3MatchedErpIds.add(id));
      }
    }
  }
  p3MatchedBankIds.forEach(id => matchedBankIds.add(id));
  p3MatchedErpIds.forEach(id => matchedErpIds.add(id));
  currentBank = currentBank.filter(b => !matchedBankIds.has(b.id));

  // ── Pass 4: Link ERP records covered by Gateway→Bank matches ─────────────
  // Build lookup map from Gateway ID -> existing match object
  const gwToMatchMap = new Map<string, MatchResult>();
  for (const m of matches) {
    for (const id of m.internalTxnIds) {
      gwToMatchMap.set(id, m);
    }
  }

  const matchedGwByAmount = new Map<number, CanonicalTransaction[]>();
  for (const gw of gatewayTxns) {
    if (!matchedGatewayIds.has(gw.id)) continue;
    const arr = matchedGwByAmount.get(gw.amount) || [];
    arr.push(gw);
    matchedGwByAmount.set(gw.amount, arr);
  }

  const matchedGwByGross = new Map<number, CanonicalTransaction[]>();
  for (const gw of gatewayTxns) {
    if (!matchedGatewayIds.has(gw.id)) continue;
    const gross = gw.amount + gw.fee + gw.tax;
    const arr = matchedGwByGross.get(gross) || [];
    arr.push(gw);
    matchedGwByGross.set(gross, arr);
  }

  for (const erp of erpTxns) {
    if (matchedErpIds.has(erp.id)) continue;

    const candidates = [
      ...(matchedGwByAmount.get(erp.amount) || []),
      ...(matchedGwByGross.get(erp.amount) || []),
    ];

    for (const gw of candidates) {
      if (withinDateLag(erp.date, gw.date, MAX_DATE_LAG)) {
        matchedErpIds.add(erp.id);

        const existingMatch = gwToMatchMap.get(gw.id);
        if (existingMatch) {
          // Merge ERP transaction into existing Bank <-> Gateway match for full 3-way evidence
          if (!existingMatch.internalTxnIds.includes(erp.id)) {
            existingMatch.internalTxnIds.push(erp.id);
          }
          existingMatch.evidence.push(
            `ERP record: ${erp.sourceTxnId} (₹${(erp.amount / 100).toFixed(2)})`
          );
        } else {
          // Gateway was not matched to Bank (un-deposited)
          matches.push({
            matchId: crypto.randomUUID(),
            internalTxnIds: [gw.id, erp.id],
            bankTxnIds: [],
            matchType: '1:1',
            confidenceScore: 85,
            evidence: [
              `ERP reconciled via Gateway: ${gw.sourceTxnId}`,
              `ERP record: ${erp.sourceTxnId}`,
              `Amount match: ₹${(erp.amount / 100).toFixed(2)}`,
              `Date proximity OK`,
            ],
          });
        }

        const pool = matchedGwByAmount.get(erp.amount) || [];
        const idx = pool.indexOf(gw);
        if (idx > -1) pool.splice(idx, 1);
        break;
      }
    }
  }

  // ── Classify remaining unmatched ──────────────────────────────────────────
  const unmatchedBankFinal = currentBank;
  const unmatchedGw      = gatewayTxns.filter(g => !matchedGatewayIds.has(g.id) && g.amount > 0);
  const unmatchedErp     = erpTxns.filter(e => !matchedErpIds.has(e.id));

  for (const txn of unmatchedBankFinal) {
    exceptions.push({
      exceptionId: crypto.randomUUID(),
      type: ExceptionType.MISSING_IN_LEDGER,
      severity: 'HIGH',
      description: `Bank credit has no matching gateway/ERP record`,
      relatedTxnIds: [txn.id],
      amountDifference: txn.amount,
    });
  }

  for (const txn of unmatchedGw) {
    exceptions.push({
      exceptionId: crypto.randomUUID(),
      type: ExceptionType.MISSING_IN_BANK,
      severity: 'MEDIUM',
      description: `Gateway settlement has no corresponding bank credit`,
      relatedTxnIds: [txn.id],
      amountDifference: txn.amount,
    });
  }

  for (const txn of unmatchedErp) {
    exceptions.push({
      exceptionId: crypto.randomUUID(),
      type: ExceptionType.MISSING_IN_BANK,
      severity: 'LOW',
      description: `ERP invoice has no corresponding gateway or bank payment`,
      relatedTxnIds: [txn.id],
      amountDifference: txn.amount,
    });
  }

  // ── Metrics ───────────────────────────────────────────────────────────────
  const allMatchedBankTxnIds = new Set(
    matches.flatMap(m => m.bankTxnIds)
  );
  const matchedBankCount = allMatchedBankTxnIds.size;
  const matchRate = bankTxns.length > 0
    ? (matchedBankCount / bankTxns.length) * 100
    : 0;

  const totalCases = bankTxns.length;
  const exceptionCases = unmatchedBankFinal.length;
  const reviewRate = totalCases > 0
    ? (exceptionCases / totalCases) * 100
    : 0;

  const totalAmountReconciled = bankTxns
    .filter(t => allMatchedBankTxnIds.has(t.id))
    .reduce((s, t) => s + t.amount, 0);

  return {
    runId,
    timestamp: new Date().toISOString(),
    metrics: {
      totalInternalProcessed: erpTxns.length + gatewayTxns.length,
      totalBankProcessed: bankTxns.length,
      matchedCount: matchedBankCount,
      exceptionCount: exceptions.length,
      matchRate: Number(matchRate.toFixed(2)),
      totalAmountReconciled,
      processingTimeMs: Date.now() - startTime,
    },
    matches,
    exceptions,
  };
}
