import { CanonicalTransaction } from '../types';

/**
 * Hash bucket indexing for O(1) candidate lookup.
 * Generates various indexes to quickly find potential matches based on specific criteria.
 */

export function buildAmountIndex(txns: CanonicalTransaction[]): Map<number, CanonicalTransaction[]> {
  const index = new Map<number, CanonicalTransaction[]>();
  for (const txn of txns) {
    const arr = index.get(txn.amount) || [];
    arr.push(txn);
    index.set(txn.amount, arr);
  }
  return index;
}

export function buildUTRIndex(txns: CanonicalTransaction[]): Map<string, CanonicalTransaction[]> {
  const index = new Map<string, CanonicalTransaction[]>();
  for (const txn of txns) {
    if (txn.utr) {
      const arr = index.get(txn.utr) || [];
      arr.push(txn);
      index.set(txn.utr, arr);
    }
  }
  return index;
}

export function buildSettlementIndex(txns: CanonicalTransaction[]): Map<string, CanonicalTransaction[]> {
  const index = new Map<string, CanonicalTransaction[]>();
  for (const txn of txns) {
    if (txn.settlementId) {
      const arr = index.get(txn.settlementId) || [];
      arr.push(txn);
      index.set(txn.settlementId, arr);
    }
  }
  return index;
}

export function buildDateIndex(txns: CanonicalTransaction[]): Map<string, CanonicalTransaction[]> {
  const index = new Map<string, CanonicalTransaction[]>();
  for (const txn of txns) {
    // Extract YYYY-MM-DD from ISO string
    const dateKey = txn.date.substring(0, 10);
    const arr = index.get(dateKey) || [];
    arr.push(txn);
    index.set(dateKey, arr);
  }
  return index;
}
