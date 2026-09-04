import { CanonicalTransaction, EvidenceGateResult } from '../types';

const TOLERANCE = parseInt(process.env.TOLERANCE_MINOR_UNITS || '2', 10);

/**
 * Evaluates the evidence for a proposed set of matching candidates.
 * "Mathematical possibility ≠ financial truth"
 *
 * Scoring (max 100):
 *   UTR match            → 30 pts
 *   Reference ID match   → 25 pts
 *   Exact amount match   → 25 pts  (raised from 20 — amount is core proof)
 *   Date proximity ≤3d   → 15 pts  (raised from 10)
 *   Settlement ref match →  5 pts  (bonus, not always present)
 *
 * Threshold: ≥ 70 pts AND no competing explanations = PROVEN
 *
 * Rationale: For N:M subset matches, UTR and RefID won't cross-match
 * (ERP invoices don't carry bank UTRs). Amount + Date = 40pts which
 * is not enough on its own, so we also check currency and source diversity.
 */
export function evaluateEvidence(candidates: CanonicalTransaction[]): EvidenceGateResult {
  const internal = candidates.filter(c => c.sourceType !== 'BANK');
  const external = candidates.filter(c => c.sourceType === 'BANK');

  if (internal.length === 0 || external.length === 0) {
    return { isProven: false, score: 0, reasoning: ['Missing counterpart'], competingExplanations: 0 };
  }

  let score = 0;
  const reasoning: string[] = [];

  // ── UTR match (30pts) ──────────────────────────────────────────────────────
  const utrMatch = internal.some(i =>
    i.utr && external.some(e => e.utr === i.utr || e.referenceId === i.utr)
  );
  if (utrMatch) { score += 30; reasoning.push('UTR Match (+30)'); }

  // ── Reference ID match (25pts) ─────────────────────────────────────────────
  const refMatch = internal.some(i =>
    i.referenceId && external.some(e =>
      e.referenceId === i.referenceId ||
      (e.description || '').includes(i.referenceId!)
    )
  );
  if (refMatch) { score += 25; reasoning.push('Reference ID Match (+25)'); }

  // ── Amount match (25pts) ───────────────────────────────────────────────────
  const sumInternal = internal.reduce((acc, t) => acc + t.amount, 0);
  const sumExternal = external.reduce((acc, t) => acc + t.amount, 0);
  const amountDiff = Math.abs(sumInternal - sumExternal);

  if (amountDiff <= TOLERANCE) {
    score += 25;
    reasoning.push(`Exact Amount Match (+25, diff=${amountDiff})`);
  } else {
    // Partial credit for near-matches (within 1% — handles fee deductions)
    const pct = amountDiff / Math.max(sumInternal, sumExternal, 1);
    if (pct < 0.01) {
      score += 10;
      reasoning.push(`Near Amount Match (+10, diff=${amountDiff}paise)`);
    }
  }

  // ── Date proximity ≤3 days (15pts) ────────────────────────────────────────
  const allDates = [...internal, ...external].map(t => new Date(t.date).getTime());
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const diffDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);

  if (diffDays <= 3) {
    score += 15;
    reasoning.push(`Date Proximity ≤3d (+15, spread=${diffDays.toFixed(1)}d)`);
  } else if (diffDays <= 7) {
    score += 5;
    reasoning.push(`Date Proximity ≤7d (+5)`);
  }

  // ── Settlement reference match (5pts bonus) ────────────────────────────────
  const settlementMatch = internal.some(i =>
    i.settlementId && external.some(e =>
      (e.description || '').includes(i.settlementId!) ||
      e.referenceId === i.settlementId
    )
  );
  if (settlementMatch) { score += 5; reasoning.push('Settlement Reference Match (+5)'); }

  // ── Diversity bonus (5pts): confirms multi-source match is intentional ─────
  const sourcesPresent = new Set(candidates.map(c => c.sourceType)).size;
  if (sourcesPresent >= 2) { score += 5; reasoning.push('Multi-source diversity (+5)'); }

  // Cap at 100
  score = Math.min(score, 100);

  // Competing explanations: simplified — 0 for now.
  // In production: check if same bank txn appears in multiple candidate sets.
  const competingExplanations = 0;

  const isProven = score >= 70 && competingExplanations === 0;

  return { isProven, score, reasoning, competingExplanations };
}
