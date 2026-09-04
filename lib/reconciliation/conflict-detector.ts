import { CanonicalTransaction } from '../types';

/**
 * Checks if a bank transaction has explicit description anomalies or customer conflicts
 * with candidate gateway/ERP transaction(s).
 */
export function hasDescriptionConflict(
  bankTxn: CanonicalTransaction,
  candidateTxns: CanonicalTransaction[]
): boolean {
  const bankDesc = (bankTxn.description || '').toUpperCase();
  const bankMetaStr = JSON.stringify(bankTxn.metadata || {}).toUpperCase();
  const fullBankText = `${bankTxn.sourceTxnId || ''} ${bankTxn.referenceId || ''} ${bankTxn.utr || ''} ${bankDesc} ${bankMetaStr}`.toUpperCase();

  // 1. Explicit anomaly keywords in bank narration/reference
  const anomalyKeywords = [
    'WRONG REFERENCE',
    'AMOUNT MISMATCH',
    'UNKNOWN BANK CREDIT',
    'UNAUTHORIZED',
    'DISPUTE',
    'SUSPICIOUS',
    'REJECTED',
    'FAILED',
    'WRONG CUSTOMER',
    'FALSE',
    'DECOY',
    'UNALLOCATED',
    'UNIDENTIFIED',
  ];

  if (anomalyKeywords.some(kw => fullBankText.includes(kw))) {
    return true;
  }

  // 2. Customer mismatch check
  const bankCustMatch = fullBankText.match(/(CUSTOMER_\d+|OTHER CUSTOMER)/i);
  if (bankCustMatch) {
    const bankCust = bankCustMatch[0].toUpperCase();

    if (bankCust === 'OTHER CUSTOMER') {
      return true;
    }

    for (const cand of candidateTxns) {
      const candText = (JSON.stringify(cand.metadata || {}) + ' ' + (cand.description || '')).toUpperCase();
      const candCustMatch = candText.match(/CUSTOMER_\d+/i);
      if (candCustMatch) {
        const candCust = candCustMatch[0].toUpperCase();
        if (bankCust !== candCust) {
          return true; // Customer mismatch
        }
      }
    }
  }

  return false;
}
